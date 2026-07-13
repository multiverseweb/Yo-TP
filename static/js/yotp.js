/**
 * Yo!TP — Drop-in Email OTP Verification
 * Include this script on any page to require email OTP verification before access.
 *
 * Usage: <script src="https://YOUR-DOMAIN/static/js/yotp.js"></script>
 *
 * The script auto-detects the service URL from its own src attribute.
 * All UI is self-contained — no external CSS required.
 */
(function () {
  "use strict";

  // ── Configuration ──────────────────────────────────────────────────
  const STORAGE_KEY = "__yotp_verified__";
  const SESSION_TTL = 0; // 0 = sessionStorage (cleared on tab close)

  // Auto-detect service URL from the script's src
  const scripts = document.getElementsByTagName("script");
  const currentScript = document.currentScript || scripts[scripts.length - 1];
  const scriptSrc = currentScript.getAttribute("src") || "";
  const SERVICE_URL = scriptSrc.replace(/\/static\/js\/yotp\.js.*$/, "");

  // ── Check if already verified ──────────────────────────────────────
  if (sessionStorage.getItem(STORAGE_KEY) === "true") {
    return; // Already verified, let the page load normally
  }

  // ── Hide the page ──────────────────────────────────────────────────
  const originalDisplay = document.documentElement.style.display;
  document.documentElement.style.visibility = "hidden";
  document.documentElement.style.overflow = "hidden";

  // ── Inject styles ──────────────────────────────────────────────────
  const OVERLAY_STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@500&display=swap');

    #__yotp_overlay__ {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000000;
      font-family: 'Inter', -apple-system, sans-serif;
      color: #ffffff;
      overflow: hidden;
      padding: 16px;
    }

    #__yotp_overlay__ * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .__yotp_card {
      position: relative;
      width: 100%;
      max-width: 380px;
      padding: 10px !important;
      background: rgba(20, 20, 20, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 5px !important;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
      animation: __yotp_enter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      opacity: 0;
      transform: translateY(10px);
      display: flex;
      flex-direction: column;
      gap: 10px !important;
    }

    @keyframes __yotp_enter {
      to { opacity: 1; transform: translateY(0); }
    }

    #__yotp_step_email, #__yotp_step_otp, .__yotp_success {
      display: flex;
      flex-direction: column;
      gap: 10px !important;
    }

    .__yotp_title {
      text-align: center;
      font-size: 1.8rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0 !important;
      letter-spacing: -0.04em;
    }

    .__yotp_subtitle {
      text-align: center;
      font-size: 0.85rem;
      color: #999999;
      margin: 0 !important;
      line-height: 1.3;
    }

    .__yotp_label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: #cccccc;
      margin: 0 !important;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .__yotp_input {
      width: 100%;
      padding: 5px 10px !important;
      background: #111111;
      border: 1px solid #333333;
      border-radius: 5px !important;
      color: #ffffff;
      font-size: 1rem;
      font-family: 'Inter', sans-serif;
      outline: none;
      transition: border-color 0.2s ease;
      margin: 0 !important;
    }

    .__yotp_input:focus {
      border-color: #777777;
    }

    .__yotp_input::placeholder { color: #555555; }

    .__yotp_input_otp {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.5rem;
      text-align: center;
      letter-spacing: 0.3em;
      padding: 5px 10px !important;
    }

    .__yotp_btn {
      width: 100%;
      padding: 5px 10px !important;
      margin: 0 !important;
      background: #ffffff;
      color: #000000;
      font-size: 1rem;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      border: none;
      border-radius: 5px !important;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.1s ease;
    }

    .__yotp_btn:hover:not(:disabled) { 
      background: #e5e5e5; 
      transform: translateY(-1px);
    }
    
    .__yotp_btn:active:not(:disabled) {
      transform: translateY(0);
    }
    
    .__yotp_btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .__yotp_btn_secondary {
      background: transparent;
      border: 1px solid #333333;
      color: #cccccc;
      margin: 0 !important;
    }

    .__yotp_btn_secondary:hover:not(:disabled) { 
      background: #111111; 
      border-color: #555555;
    }

    .__yotp_error {
      margin: 0 !important;
      padding: 5px 10px !important;
      background: rgba(255, 50, 50, 0.1);
      border: 1px solid rgba(255, 50, 50, 0.2);
      border-radius: 5px !important;
      color: #ff5555;
      font-size: 0.75rem;
      text-align: center;
      display: none;
    }
    .__yotp_error.visible { display: block; }

    .__yotp_success { text-align: center; padding: 10px !important; margin: 0 !important; }

    .__yotp_timer {
      text-align: center;
      margin: 0 !important;
      font-size: 0.75rem;
      color: #888888;
    }

    .__yotp_timer_value {
      font-family: 'JetBrains Mono', monospace;
      color: #ffffff;
      font-weight: 600;
    }

    .__yotp_timer_expired { color: #ff5555; }

    .__yotp_spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(0,0,0,0.3);
      border-top-color: #000;
      border-radius: 50%;
      animation: __yotp_spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }

    .__yotp_btn_secondary .__yotp_spinner {
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
    }

    @keyframes __yotp_spin { to { transform: rotate(360deg); } }

    .__yotp_powered {
      text-align: center;
      margin: 0 !important;
      font-size: 0.7rem;
      color: #666666;
    }

    .__yotp_powered a {
      color: #cccccc;
      text-decoration: none;
      font-weight: 600;
    }
    .__yotp_powered a:hover { color: #ffffff; }
    .__yotp_hidden { display: none !important; }
  `;

  // ── Create overlay ─────────────────────────────────────────────────
  function createOverlay() {
    const style = document.createElement("style");
    style.textContent = OVERLAY_STYLES;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.id = "__yotp_overlay__";

    overlay.innerHTML = `
      <div class="__yotp_card">
        <!-- Step 1: Email -->
        <div id="__yotp_step_email">
          <p class="__yotp_subtitle">Enter email for one-time code</p>
          <input class="__yotp_input" id="__yotp_email_input" type="email" placeholder="you@example.com" autocomplete="email" autofocus />
          <div class="__yotp_error" id="__yotp_email_error"></div>
          <button class="__yotp_btn" id="__yotp_send_btn" type="button">Send Code</button>
        </div>

        <!-- Step 2: OTP -->
        <div id="__yotp_step_otp" class="__yotp_hidden">
          <p class="__yotp_subtitle" id="__yotp_otp_subtitle">6-digit code sent</p>
          <input class="__yotp_input __yotp_input_otp" id="__yotp_otp_input" type="text" placeholder="000000" maxlength="6" inputmode="numeric" autocomplete="one-time-code" />
          <div class="__yotp_timer" id="__yotp_timer">
            Expires in <span class="__yotp_timer_value" id="__yotp_timer_value">30</span>s
          </div>
          <div class="__yotp_error" id="__yotp_otp_error"></div>
          <button class="__yotp_btn" id="__yotp_verify_btn" type="button">Verify</button>
          <button class="__yotp_btn __yotp_btn_secondary" id="__yotp_resend_btn" type="button">Resend</button>
        </div>

        <!-- Step 3: Success -->
        <div id="__yotp_step_success" class="__yotp_hidden">
          <div class="__yotp_success">
            <h2 class="__yotp_title">Verified</h2>
            <p class="__yotp_subtitle">Redirecting...</p>
          </div>
        </div>

        <div class="__yotp_powered">
          Powered by <a href="https://github.com/multiverseweb/Yo-TP" target="_blank" rel="noopener">Yo!TP</a>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  // ── State ──────────────────────────────────────────────────────────
  let currentEmail = "";
  let currentToken = "";
  let timerInterval = null;

  // ── API helpers ────────────────────────────────────────────────────
  async function apiSendOTP(email) {
    const res = await fetch(`${SERVICE_URL}/api/send-otp/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return res.json().then((data) => ({ ok: res.ok, status: res.status, ...data }));
  }

  async function apiVerifyOTP(email, otp, token) {
    const res = await fetch(`${SERVICE_URL}/api/verify-otp/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, token }),
    });
    return res.json().then((data) => ({ ok: res.ok, status: res.status, ...data }));
  }

  // ── Timer ──────────────────────────────────────────────────────────
  function startTimer() {
    let seconds = 30;
    const timerValue = document.getElementById("__yotp_timer_value");
    const timerEl = document.getElementById("__yotp_timer");

    clearInterval(timerInterval);
    timerValue.textContent = seconds;
    timerValue.classList.remove("__yotp_timer_expired");
    timerEl.innerHTML = `Code expires in <span class="__yotp_timer_value" id="__yotp_timer_value">${seconds}</span>s`;

    timerInterval = setInterval(() => {
      seconds--;
      const tv = document.getElementById("__yotp_timer_value");
      if (seconds <= 0) {
        clearInterval(timerInterval);
        timerEl.innerHTML = `<span class="__yotp_timer_expired">Code expired — request a new one</span>`;
      } else {
        if (tv) {
          tv.textContent = seconds;
          if (seconds <= 10) tv.classList.add("__yotp_timer_expired");
        }
      }
    }, 1000);
  }

  // ── Show error ─────────────────────────────────────────────────────
  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.classList.add("visible");
  }

  function hideError(elementId) {
    const el = document.getElementById(elementId);
    el.textContent = "";
    el.classList.remove("visible");
  }

  // ── Set button loading state ───────────────────────────────────────
  function setLoading(btn, loading, text) {
    btn.disabled = loading;
    btn.innerHTML = loading
      ? `<span class="__yotp_spinner"></span>${text}`
      : text;
  }

  // ── Show page ──────────────────────────────────────────────────────
  function revealPage() {
    sessionStorage.setItem(STORAGE_KEY, "true");
    const overlay = document.getElementById("__yotp_overlay__");

    // Show success
    document.getElementById("__yotp_step_otp").classList.add("__yotp_hidden");
    document.getElementById("__yotp_step_success").classList.remove("__yotp_hidden");

    setTimeout(() => {
      overlay.style.transition = "opacity 0.4s ease";
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.remove();
        document.documentElement.style.visibility = "";
        document.documentElement.style.overflow = "";
      }, 400);
    }, 800);
  }

  // ── Init ───────────────────────────────────────────────────────────
  function init() {
    const overlay = createOverlay();

    // Make page visible again (overlay covers it)
    document.documentElement.style.visibility = "";
    document.documentElement.style.overflow = "";

    const emailInput = document.getElementById("__yotp_email_input");
    const otpInput = document.getElementById("__yotp_otp_input");
    const sendBtn = document.getElementById("__yotp_send_btn");
    const verifyBtn = document.getElementById("__yotp_verify_btn");
    const resendBtn = document.getElementById("__yotp_resend_btn");
    const stepEmail = document.getElementById("__yotp_step_email");
    const stepOtp = document.getElementById("__yotp_step_otp");
    const otpSubtitle = document.getElementById("__yotp_otp_subtitle");

    // ── Send OTP ───────────────────────────────────────────────────
    async function handleSendOTP() {
      const email = emailInput.value.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        showError("__yotp_email_error", "Please enter a valid email address.");
        return;
      }

      hideError("__yotp_email_error");
      setLoading(sendBtn, true, "Sending...");

      try {
        const result = await apiSendOTP(email);
        if (result.ok) {
          currentEmail = email;
          currentToken = result.token;

          // Switch to OTP step
          stepEmail.classList.add("__yotp_hidden");
          stepOtp.classList.remove("__yotp_hidden");
          otpSubtitle.textContent = `We sent a 6-digit code to ${email}`;
          otpInput.focus();
          startTimer();
        } else {
          showError("__yotp_email_error", result.error || "Failed to send OTP.");
        }
      } catch (err) {
        showError("__yotp_email_error", "Network error. Please check your connection.");
      } finally {
        setLoading(sendBtn, false, "Send Code");
      }
    }

    sendBtn.addEventListener("click", (e) => { e.preventDefault(); handleSendOTP(); });
    emailInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSendOTP();
      }
    });

    // ── Verify OTP ─────────────────────────────────────────────────
    async function handleVerifyOTP() {
      const otp = otpInput.value.trim();
      if (!otp || otp.length < 6) {
        showError("__yotp_otp_error", "Please enter the 6-digit code.");
        return;
      }

      hideError("__yotp_otp_error");
      setLoading(verifyBtn, true, "Verifying...");

      try {
        const result = await apiVerifyOTP(currentEmail, otp, currentToken);
        if (result.ok && result.verified) {
          clearInterval(timerInterval);
          revealPage();
        } else {
          showError("__yotp_otp_error", result.error || "Invalid OTP.");
          otpInput.value = "";
          otpInput.focus();
        }
      } catch (err) {
        showError("__yotp_otp_error", "Network error. Please try again.");
      } finally {
        setLoading(verifyBtn, false, "Verify");
      }
    }

    verifyBtn.addEventListener("click", (e) => { e.preventDefault(); handleVerifyOTP(); });
    otpInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleVerifyOTP();
      }
    });

    // Only allow digits in OTP input
    otpInput.addEventListener("input", () => {
      otpInput.value = otpInput.value.replace(/\D/g, "");
    });

    // ── Resend OTP ─────────────────────────────────────────────────
    resendBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      hideError("__yotp_otp_error");
      setLoading(resendBtn, true, "Resending...");

      try {
        const result = await apiSendOTP(currentEmail);
        if (result.ok) {
          currentToken = result.token;
          otpInput.value = "";
          otpInput.focus();
          startTimer();
        } else {
          showError("__yotp_otp_error", result.error || "Failed to resend OTP.");
        }
      } catch (err) {
        showError("__yotp_otp_error", "Network error. Please try again.");
      } finally {
        setLoading(resendBtn, false, "Resend");
      }
    });
  }

  // ── Bootstrap ──────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
