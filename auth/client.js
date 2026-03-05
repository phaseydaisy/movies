import { AUTH_API_BASE_URL } from "../src/config.js";

const AUTH_SESSION_KEY = "cinenest:session";

function setSession(session) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function goVerify(email) {
  location.href = `../verify/?email=${encodeURIComponent(email)}`;
}

function getApiBase() {
  return String(AUTH_API_BASE_URL || "").trim().replace(/\/$/, "");
}

async function callAuthApi(path, payload) {
  const base = getApiBase();
  if (!base || base.includes("<your-subdomain>")) {
    throw new Error("Set AUTH_API_BASE_URL in src/config.js");
  }

  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({ ok: false, message: "Invalid server response" }));
  if (!response.ok) {
    return { ...data, ok: false };
  }
  return data;
}

function showMessage(text, isError = true) {
  const message = document.getElementById("authMessage");
  if (!message) return;
  message.textContent = text;
  message.classList.remove("hidden", "text-red-300", "text-emerald-300");
  message.classList.add(isError ? "text-red-300" : "text-emerald-300");
}

function goHome() {
  location.href = "../index.html";
}

function wireSignIn() {
  const form = document.getElementById("signinForm");
  if (!form) return false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = String(document.getElementById("email")?.value || "").trim().toLowerCase();
    const password = String(document.getElementById("password")?.value || "");

    if (!email || !password) {
      showMessage("Email and password are required.");
      return;
    }

    const data = await callAuthApi("/auth/signin", { email, password }).catch((error) => ({ ok: false, message: error.message }));

    if (!data.ok) {
      if (data.needsVerification) {
        clearSession();
      }
      showMessage(data.message || "Could not sign in.");
      if (data.needsVerification) {
        setTimeout(() => goVerify(email), 700);
      }
      return;
    }

    setSession(data.session || { email });
    showMessage("Signed in. Redirecting...", false);
    setTimeout(goHome, 500);
  });

  return true;
}

function wireSignUp() {
  const form = document.getElementById("signupForm");
  if (!form) return false;
  const submitButton = document.getElementById("signupSubmit");

  let signupInFlight = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (signupInFlight) return;
    signupInFlight = true;
    if (submitButton) submitButton.disabled = true;

    const name = String(document.getElementById("name")?.value || "").trim();
    const email = String(document.getElementById("email")?.value || "").trim().toLowerCase();
    const password = String(document.getElementById("password")?.value || "");

    if (!name || !email || !password) {
      showMessage("Name, email, and password are required.");
      signupInFlight = false;
      if (submitButton) submitButton.disabled = false;
      return;
    }

    if (password.length < 6) {
      showMessage("Password must be at least 6 characters.");
      signupInFlight = false;
      if (submitButton) submitButton.disabled = false;
      return;
    }

    const data = await callAuthApi("/auth/signup", { name, email, password }).catch((error) => ({ ok: false, message: error.message }));
    if (!data.ok) {
      showMessage(data.message || "Could not create account.");
      signupInFlight = false;
      if (submitButton) submitButton.disabled = false;
      return;
    }

    const resend = await callAuthApi("/auth/resend", { email }).catch((error) => ({ ok: false, message: error.message }));
    const resendCooldown = Number(resend?.retryAfterSeconds || 0);
    const resendAccepted = resend.ok || resendCooldown > 0;

    clearSession();
    showMessage(
      resendAccepted
        ? "Account created. Verification code sent. Redirecting..."
        : (resend.message || data.message || "Account created. Verification required."),
      !resendAccepted
    );
    setTimeout(() => goVerify(email), 700);
  });

  return true;
}

function wireVerify() {
  const form = document.getElementById("verifyForm");
  if (!form) return false;

  const params = new URLSearchParams(location.search);
  const emailInput = document.getElementById("email");
  const codeInput = document.getElementById("verificationCode");
  const resendBtn = document.getElementById("sendCode") || document.getElementById("resendCode");
  const emailFromQuery = String(params.get("email") || "").trim().toLowerCase();
  let resendCountdown = null;

  if (emailFromQuery) emailInput.value = emailFromQuery;

  const resetResendButton = () => {
    if (!resendBtn) return;
    resendBtn.disabled = false;
    resendBtn.textContent = "Send code";
  };

  const startResendCooldown = (seconds) => {
    if (!resendBtn) return;
    const total = Number(seconds);
    if (!Number.isFinite(total) || total <= 0) {
      resetResendButton();
      return;
    }

    if (resendCountdown) {
      clearInterval(resendCountdown);
      resendCountdown = null;
    }

    let remaining = Math.max(1, Math.ceil(total));
    resendBtn.disabled = true;
    resendBtn.textContent = `Send code (${remaining}s)`;

    resendCountdown = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(resendCountdown);
        resendCountdown = null;
        resetResendButton();
        return;
      }
      resendBtn.textContent = `Send code (${remaining}s)`;
    }, 1000);
  };

  if (resendBtn) {
    resendBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      if (resendBtn.disabled) return;

      const email = String(emailInput.value || "").trim().toLowerCase();
      if (!email) {
        showMessage("Email is required.");
        return;
      }

      resendBtn.disabled = true;
      resendBtn.textContent = "Sending...";

      const data = await callAuthApi("/auth/resend", { email }).catch((error) => ({ ok: false, message: error.message }));
      showMessage(data.message || (data.ok ? "Verification code sent." : "Could not send code."), !data.ok);

      const retryAfterSeconds = Number(data?.retryAfterSeconds || 0);
      if (retryAfterSeconds > 0) {
        startResendCooldown(retryAfterSeconds);
      } else {
        resetResendButton();
      }
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = String(emailInput.value || "").trim().toLowerCase();
    const code = String(codeInput.value || "").trim();

    if (!email || !code) {
      showMessage("Email and verification code are required.");
      return;
    }

    const data = await callAuthApi("/auth/verify", { email, code }).catch((error) => ({ ok: false, message: error.message }));

    if (!data.ok) {
      showMessage(data.message || "Could not verify code.");
      return;
    }

    setSession(data.session || { email });
    showMessage(data.message || "Email verified. Redirecting...", false);
    setTimeout(goHome, 500);
  });

  return true;
}

function init() {
  const signin = wireSignIn();
  const signup = wireSignUp();
  const verify = wireVerify();
  if (!signin && !signup && !verify) {
    console.warn("Auth form not found.");
  }
}

init();
