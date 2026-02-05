import { auth } from "./firebase.js";

console.log("profile-setup.js loaded");

const completeBtn = document.getElementById("completeSetupBtn");

completeBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  // have to save profile fields in firestone in backend
  // for now just redirect
  window.location.href = "dashboard.html";
});

auth.onAuthStateChanged((user) => {
  if (!user) {
    console.log("Not logged in -> signin");
    window.location.href = "signin.html";
  }
});
