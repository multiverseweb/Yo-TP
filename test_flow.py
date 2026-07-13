import requests
import sqlite3
import pyotp
import time

BASE_URL = 'http://127.0.0.1:8000'
TEST_EMAIL = 'test_agent@example.com'

print("1. Checking initial stats...")
r = requests.get(f'{BASE_URL}/api/stats/')
print(r.json())

print("\n2. Sending OTP request...")
r = requests.post(f'{BASE_URL}/api/send-otp/', json={'email': TEST_EMAIL})
res = r.json()
print("Response:", res)
token = res.get('token')

if not token:
    print("Error: No token returned.")
    exit(1)

print("\n3. Looking up OTP in database...")
conn = sqlite3.connect('db.sqlite3')
c = conn.cursor()
c.execute("SELECT secret FROM authapp_otpsession WHERE token=?", (token,))
row = c.fetchone()
conn.close()

if not row:
    print("Error: Session not found in DB.")
    exit(1)

secret = row[0]
totp = pyotp.TOTP(secret, interval=30)
otp_code = totp.now()
print(f"Generated OTP from secret: {otp_code}")

print("\n4. Verifying OTP...")
r = requests.post(f'{BASE_URL}/api/verify-otp/', json={
    'email': TEST_EMAIL,
    'otp': otp_code,
    'token': token
})
print("Response:", r.json())

print("\n5. Checking final stats...")
r = requests.get(f'{BASE_URL}/api/stats/')
print(r.json())

print("\nTest complete.")
