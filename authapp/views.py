import json
import time
from collections import defaultdict

import pyotp
from django.conf import settings
from django.core.mail import send_mail
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import OTPSession

# ---------------------------------------------------------------------------
# Rate limiting (in-memory) — max 5 OTP requests per email per 5 minutes
# ---------------------------------------------------------------------------
_rate_limit = defaultdict(list)  # email -> [timestamp, ...]
RATE_LIMIT_WINDOW = 300  # seconds
RATE_LIMIT_MAX = 5


def _is_rate_limited(email: str) -> bool:
    """Check if an email has exceeded the OTP request rate limit."""
    now = time.time()
    # Prune old entries
    _rate_limit[email] = [t for t in _rate_limit[email] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limit[email]) >= RATE_LIMIT_MAX:
        return True
    _rate_limit[email].append(now)
    return False


# ---------------------------------------------------------------------------
# Rate limiting (in-memory) — max 20 OTP requests per IP per hour
# ---------------------------------------------------------------------------
_ip_rate_limit = defaultdict(list)
IP_RATE_LIMIT_WINDOW = 3600  # seconds
IP_RATE_LIMIT_MAX = 20

def _is_ip_rate_limited(ip: str) -> bool:
    """Check if an IP has exceeded the overall request rate limit."""
    if not ip:
        return False
    now = time.time()
    _ip_rate_limit[ip] = [t for t in _ip_rate_limit[ip] if now - t < IP_RATE_LIMIT_WINDOW]
    if len(_ip_rate_limit[ip]) >= IP_RATE_LIMIT_MAX:
        return True
    _ip_rate_limit[ip].append(now)
    return False

def get_client_ip(request):
    """Extract the client IP from the request headers."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


# ---------------------------------------------------------------------------
# Landing page
# ---------------------------------------------------------------------------
def landing_page(request):
    """Render the marketing / landing page where developers copy the script tag."""
    return render(request, 'authapp/landing.html')


# ---------------------------------------------------------------------------
# API: Send OTP
# ---------------------------------------------------------------------------
@csrf_exempt
@require_POST
def send_otp(request):
    """Generate a TOTP and email it to the user.

    Expects JSON body: {"email": "user@example.com"}
    Returns JSON:      {"token": "<session-token>", "message": "OTP sent"}
    """
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid JSON body.'}, status=400)

    email = data.get('email', '').strip().lower()
    if not email or '@' not in email:
        return JsonResponse({'error': 'A valid email address is required.'}, status=400)

    # IP Rate-limit check
    client_ip = get_client_ip(request)
    if _is_ip_rate_limited(client_ip):
        return JsonResponse(
            {'error': 'Too many requests from this IP. Please wait and try again later.'},
            status=429,
        )

    # Email Rate-limit check
    if _is_rate_limited(email):
        return JsonResponse(
            {'error': 'Too many OTP requests. Please wait a few minutes and try again.'},
            status=429,
        )

    # Generate TOTP
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret, interval=30)
    otp_code = totp.now()

    # Create session
    token = OTPSession.generate_token()
    OTPSession.objects.create(email=email, secret=secret, token=token)

    # Send email
    try:
        send_mail(
            subject='Yo! Your Verification Code',
            message=(
                f'Your one-time verification code is: {otp_code}\n\n'
                f'This code is valid for 30 seconds.\n\n'
                f'If you did not request this, please ignore this email.'
            ),
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as exc:
        return JsonResponse(
            {'error': f'Failed to send OTP email. Details: {str(exc)}'},
            status=500,
        )

    return JsonResponse({'token': token, 'message': 'OTP sent successfully.'})


# ---------------------------------------------------------------------------
# API: Verify OTP
# ---------------------------------------------------------------------------
@csrf_exempt
@require_POST
def verify_otp(request):
    """Verify the OTP provided by the user.

    Expects JSON body: {"email": "user@example.com", "otp": "123456", "token": "<session-token>"}
    Returns JSON:      {"verified": true} or {"error": "..."}
    """
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Invalid JSON body.'}, status=400)

    email = data.get('email', '').strip().lower()
    otp_code = data.get('otp', '').strip()
    token = data.get('token', '').strip()

    if not all([email, otp_code, token]):
        return JsonResponse({'error': 'email, otp, and token are all required.'}, status=400)

    # Look up session
    try:
        session = OTPSession.objects.get(token=token, email=email)
    except OTPSession.DoesNotExist:
        return JsonResponse({'error': 'Invalid session. Please request a new OTP.'}, status=400)

    # Already verified
    if session.verified:
        return JsonResponse({'verified': True, 'message': 'Already verified.'})

    # Check if session is expired (max 2 minutes to allow for slight delays)
    age = (timezone.now() - session.created_at).total_seconds()
    if age > 120:
        return JsonResponse(
            {'error': 'Session expired. Please request a new OTP.'},
            status=400,
        )

    # Max attempts
    if session.attempts >= 5:
        return JsonResponse(
            {'error': 'Too many failed attempts. Please request a new OTP.'},
            status=400,
        )

    # Verify TOTP
    totp = pyotp.TOTP(session.secret, interval=30)
    if totp.verify(otp_code, valid_window=1):
        session.verified = True
        session.save()
        return JsonResponse({'verified': True, 'message': 'Verification successful.'})
    else:
        session.attempts += 1
        session.save()
        remaining = 5 - session.attempts
        return JsonResponse(
            {'error': f'Invalid OTP. {remaining} attempt(s) remaining.'},
            status=400,
        )

# ---------------------------------------------------------------------------
# API: Stats
# ---------------------------------------------------------------------------
def get_stats(request):
    """Return public statistics for the marketing page."""
    # Since there are no accounts, we track total verification events
    count = OTPSession.objects.count()
    return JsonResponse({'total_verifications': count})