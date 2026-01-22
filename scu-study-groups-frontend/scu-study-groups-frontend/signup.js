import { auth } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const ENFORCE_SCU_EMAIL = false; // set true before deploy

const form = document.getElementById("signupForm");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const confirmEl = document.getElementById("confirmPassword");
const msgEl = document.getElementById("msg");

function setMsg(text, isError = false) {
  msgEl.textContent = text;
  msgEl.style.color = isError ? "#b91c1c" : "#065f46";
}

function isScuEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith("@scu.edu");
}

function mapSignupError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "That email already has an account. Try signing in.";
    case "auth/invalid-email":
      return "That email looks invalid.";
    case "auth/weak-password":
      return "Password is too weak (minimum 6 characters).";
    case "auth/password-does-not-meet-requirements":
      return "Password must include at least one uppercase letter and one symbol.";
    case "auth/operation-not-allowed":
      return "Email/password auth is not enabled in Firebase.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return "Could not create the account. Try again.";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = emailEl.value.trim();
  const password = passwordEl.value;
  const confirm = confirmEl.value;

  if (ENFORCE_SCU_EMAIL && !isScuEmail(email)) {
    setMsg("Please use your SCU email (ends with @scu.edu).", true);
    return;
  }

  if (password !== confirm) {
    setMsg("Passwords do not match.", true);
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await sendEmailVerification(cred.user);
    await signOut(auth);

    setMsg("Account created! Check your email to verify, then sign in.");

    setTimeout(() => {
      window.location.href = "signin.html";
    }, 1500);
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    setMsg(mapSignupError(err?.code), true);
  }
});