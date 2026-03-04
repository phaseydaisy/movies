import { AUTH_API_BASE_URL } from "./config.js";

const AUTH_SESSION_KEY = "cinenest:session";

function setSession(session) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
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

function maybeShowDemoCode(data) {
  const demoCode = document.getElementById("demoCode");
  if (!demoCode) return;

  const code = data?.demoCode;
  if (!code) {
    demoCode.classList.add("hidden");
    demoCode.textContent = "";
    return;
  }

  demoCode.classList.remove("hidden");
  demoCode.textContent = `Demo code: ${code}`;
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
      maybeShowDemoCode(data);
      showMessage(data.message || "Could not sign in.");
      if (data.needsVerification) {
        setTimeout(() => goVerify(email), 700);
      }
      return;
    }

    maybeShowDemoCode(null);
    setSession(data.session || { email });
    showMessage("Signed in. Redirecting...", false);
    setTimeout(goHome, 500);
  });

  return true;
}

function wireSignUp() {
  const form = document.getElementById("signupForm");
  if (!form) return false;
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const submitButton = document.getElementById("signupSubmit");

  let signupInFlight = false;
  let autoSubmitTimer = null;

  const canAutoSubmit = () => {
    const name = String(nameInput?.value || "").trim();
    const email = String(emailInput?.value || "").trim();
    const password = String(passwordInput?.value || "");
    return !!name && !!email && password.length >= 6;
  };

  const scheduleAutoSubmit = () => {
    clearTimeout(autoSubmitTimer);
    if (signupInFlight || !canAutoSubmit()) return;
    autoSubmitTimer = setTimeout(() => {
      if (!signupInFlight && canAutoSubmit()) {
        form.requestSubmit();
      }
    }, 450);
  };

  [nameInput, emailInput, passwordInput].forEach((input) => {
    input?.addEventListener("input", scheduleAutoSubmit);
  });

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
      maybeShowDemoCode(data);
      showMessage(data.message || "Could not create account.");
      signupInFlight = false;
      if (submitButton) submitButton.disabled = false;
      return;
    }

    maybeShowDemoCode(data);
    showMessage(data.message || "Account created. Verification required.", false);
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
  const resendBtn = document.getElementById("resendCode");
  const demoCode = document.getElementById("demoCode");
  const emailFromQuery = String(params.get("email") || "").trim().toLowerCase();

  if (emailFromQuery) emailInput.value = emailFromQuery;

  resendBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    const email = String(emailInput.value || "").trim().toLowerCase();

    const data = await callAuthApi("/auth/resend", { email }).catch((error) => ({ ok: false, message: error.message }));
    maybeShowDemoCode(data);
    showMessage(data.message || (data.ok ? "Verification code resent." : "Could not resend code."), !data.ok);
  });

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
      maybeShowDemoCode(data);
      showMessage(data.message || "Could not verify code.");
      return;
    }

    maybeShowDemoCode(null);
    setSession(data.session || { email });
    showMessage(data.message || "Email verified. Redirecting...", false);
    setTimeout(goHome, 500);
  });

  emailInput.addEventListener("input", () => maybeShowDemoCode(null));
  if (demoCode) demoCode.classList.add("hidden");
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
