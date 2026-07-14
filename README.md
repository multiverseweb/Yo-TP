# Yo!TP

**Email OTP Verification as a Service**

Add email OTP verification to any website with a single `<script>` tag. No signup, no API keys, and no backend configuration required.

[![Visitors](https://api.visitorbadge.io/api/visitors?path=multiverseweb2%2Yo-TP%20&countColor=%23263759&style=flat&initial=5767)](https://github.com/multiverseweb/Yo-TP)
![License](https://img.shields.io/badge/License-MIT-4e3eb5)
![GitHub Repo stars](https://img.shields.io/github/stars/multiverseweb/Yo-TP)
![Website Status](https://img.shields.io/website?url=https%3A%2F%2Fyo-tp.onrender.com&up_message=online&down_message=offline&label=status)

---

## What It Is

Yo!TP is a drop-in authentication service. When you include the Yo!TP script on your HTML page, the page content is immediately hidden behind a full-screen verification overlay. Visitors must enter their email address to receive a 6-digit Time-Based One-Time Password (TOTP) valid for 30 seconds. Only after entering the correct code is the original page content revealed.

## How to Use It

Add the following `<script>` tag to the `<head>` of any HTML page you want to protect:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Protected Page</title>

  <!-- Prevent page flashing before script loads -->
  <style id="__yotp_anti_flash__">html { display: none; }</style>
  
  <!-- Add this one line to protect your page -->
  <script src="https://yo-tp.onrender.com/static/js/yotp.js"></script>
</head>
<body>
  <h1>Secret Content</h1>
  <p>This content is only visible after email verification.</p>
</body>
</html>
```

The script will automatically detect the Yo!TP service URL and handle the entire verification flow. Verification status is stored in `sessionStorage`, so refreshing the page will not prompt the visitor again within the same browser session.

## API Reference

If you prefer to build a custom frontend integration, you can use the REST API directly.

### Send OTP

`POST https://yo-tp.onrender.com/api/send-otp/`

Request payload:
```json
{
  "email": "user@example.com"
}
```

### Verify OTP

`POST https://yo-tp.onrender.com/api/verify-otp/`

Request payload:
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "token": "session-token-string"
}
```

---

## Limitations & Security

Yo!TP is a **client-side (JavaScript) protection layer**. It is designed to be a quick, drop-in deterrence for casual use cases (like family blogs, portfolios, or pre-launch pages) where absolute security is not required.

Because the protection runs in the user's browser:
- **Scraping / Bots:** Bots that do not execute JavaScript (like `curl`, Python scripts, or search engine crawlers) will bypass the overlay and download the raw HTML of your page instantly.
- **Advanced Users:** Tech-savvy users can disable JavaScript in their browser to bypass the verification step entirely. (Though the anti-flash CSS prevents the page from rendering in this case, the raw source code is still readable).
- **Not for Sensitive Data:** Do not use this service to protect admin panels, paid digital goods, or sensitive personal information. True authentication must be implemented on your backend server.
