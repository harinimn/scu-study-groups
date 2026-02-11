import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("profile-setup.js loaded");

const completeBtn = document.getElementById("completeSetupBtn");

completeBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    window.location.href = "signin.html";
    return;
  }

  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        onboardingComplete: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("Failed to save onboardingComplete:", err);
    alert("Could not save your profile. Try again.");
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    console.log("Not logged in -> signin");
    window.location.href = "signin.html";
  }
});
