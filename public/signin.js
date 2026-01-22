import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const ENFORCE_SCU_EMAIL = false; // set true before deploy

const form = document.getElementById("signinForm");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const msgEl = document.getElementById("msg");

function setMsg(text, isError = false) {
  msgEl.textContent = text;
  msgEl.style.color = isError ? "#b91c1c" : "#065f46";
}

function isScuEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith("@scu.edu");
}

function mapSigninError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "That email looks invalid.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return "Could not sign in. Try again.";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = emailEl.value.trim();
  const password = passwordEl.value;

  if (ENFORCE_SCU_EMAIL && !isScuEmail(email)) {
    setMsg("Please use your SCU email (ends with @scu.edu).", true);
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // make sure emailVerified is up-to-date
    await cred.user.reload();

    if (!cred.user.emailVerified) {
      // helpful resend
      try {
        await sendEmailVerification(cred.user);
      } catch (_) {}

      await signOut(auth);
      setMsg("Please verify your email first. We just sent you a new verification email.", true);
      return;
    }

    setMsg("Signed in! Redirecting...");
    window.location.href = "profile-setup.html";
  } catch (err) {
    console.error(err);
    setMsg(mapSigninError(err?.code), true);
  }
});