import { auth, functions } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

console.log("profile-setup.js LOADED");

const completeBtn = document.getElementById("completeSetupBtn");

const api = {
  profileSetup: httpsCallable(functions, "profile-setup"),
};

// ---- UI helpers ----
function visTextToNum(text) {
  // backend: 0 everyone, 1 same course, 2 same section, 3 study groups, 4 connections, 5 no one
  const t = (text || "").toLowerCase();

  if (t.includes("everyone")) return 0;
  if (t.includes("same course")) return 1;
  if (t.includes("same section")) return 2;
  if (t.includes("study group")) return 3;
  if (t.includes("connection")) return 4;
  if (t.includes("no one")) return 5;

  // safe default
  return 1;
}

function getSelectVis(id) {
  const el = document.getElementById(id);
  if (!el) return 1;
  return visTextToNum(el.value);
}

function getInputVal(id) {
  const el = document.getElementById(id);
  return (el?.value || "").trim();
}

function getSelectedInterests() {
  return [...document.querySelectorAll(".interestItem.isSelected")].map((b) =>
    (b.textContent || "").trim()
  );
}

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "signin.html";

  // default contactEmail to auth email if empty
  const contactEmail = document.getElementById("contactEmail");
  if (contactEmail && !contactEmail.value) {
    contactEmail.value = user?.email || "";
  }
});

completeBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    window.location.href = "signin.html";
    return;
  }

  // read UI
  const name = getInputVal("name");
  const major = getInputVal("major");
  const minor = getInputVal("minor");
  const classYear = getInputVal("classYear");
  const contactEmail = getInputVal("contactEmail") || (user.email || "");

  const genderText = getInputVal("gender"); // select value
  // partner backend expects falsy = male; keep it simple:
  const gender = genderText && genderText !== "Male" ? true : false;

  const interests = getSelectedInterests();

  const def_vis = getSelectVis("overallVis");

  const payload = {
    // overall visibility
    def_vis,

    // field-level vis
    name_vis: getSelectVis("nameVis"),
    major_vis: getSelectVis("majorVis"),
    minor_vis: getSelectVis("minorVis"),
    classYear_vis: getSelectVis("classYearVis"),
    gender_vis: getSelectVis("genderVis"),
    email_vis: getSelectVis("emailVis"),
    interests_vis: getSelectVis("interestsVis"),

    // class visibility defaults
    past_classes_vis: getSelectVis("pastClassVis"),
    cur_classes_vis: getSelectVis("currentClassVis"),
    future_classes_vis: getSelectVis("futureClassVis"),

    // actual profile fields
    name: name || "Anonymous",
    major,
    minor,
    classYear,
    email: contactEmail,        // store as "email" since he uses email_vis
    interests,

    // backend expects this shape
    gender,

    // OPTIONAL: keep text too (backend ignores extra fields)
    gender_text: genderText || "",
  };

  console.log("profile-setup payload:", payload);

  try {
    await api.profileSetup(payload);
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("profile-setup callable failed:", err);
    alert(err?.message || "Could not save your profile. Try again.");
  }
});