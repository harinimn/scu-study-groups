import { auth } from "./firebase.js";
import { sendSignInLinkToEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const form = document.getElementById("signupForm");
const emailEl = document.getElementById("email");
const msgEl = document.getElementById("msg");

function setMsg(text, isError = false) {
  msgEl.textContent = text;
  msgEl.style.color = isError ? "#b91c1c" : "#065f46";
}

function isScuEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith("@scu.edu");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = emailEl.value.trim();

  if (!isScuEmail(email)) {
    setMsg("Please use your SCU email (ends with @scu.edu).", true);
    return;
  }

  const actionCodeSettings = {
    url: `${window.location.origin}/finish-signin.html`,
    handleCodeInApp: true,
  };

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    localStorage.setItem("emailForSignIn", email);
    setMsg("Check your email for the sign-up link. Open it on this device/browser.");
  } catch (err) {
    const code = err?.code || "";
    if (code === "auth/invalid-email") setMsg("That email looks invalid.", true);
    else if (code === "auth/too-many-requests") setMsg("Too many attempts. Try again later.", true);
    else setMsg("Could not send the email link. Try again.", true);
    console.error(err);
  }
});
