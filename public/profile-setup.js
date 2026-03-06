import { auth, functions } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

console.log("profile-setup.js LOADED");

const completeBtn = document.getElementById("completeSetupBtn");

const api = {
  profileSetup: httpsCallable(functions, "profile-setup"),
  profileGet: httpsCallable(functions, "profile-get"),
};

// UI helpers
function visTextToNum(text) {
  const t = (text || "").toLowerCase();

  if (t.includes("everyone")) return 0;
  if (t.includes("same course")) return 1;
  if (t.includes("same section")) return 2;
  if (t.includes("study group")) return 3;
  if (t.includes("connection")) return 4;
  if (t.includes("no one")) return 5;

  return 1;
}

function visNumToText(num) {
  switch (num) {
    case 0: return "Everyone";
    case 1: return "People in same course";
    case 2: return "People in same section";
    case 3: return "People in study groups";
    case 4: return "My connections only";
    case 5: return "No one";
    default: return "People in same course";
  }
}

function setSelectByVis(id, num) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = visNumToText(num);
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

function setInputVal(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value || "";
}

function getSelectedInterests() {
  return [...document.querySelectorAll(".interestItem.isSelected")].map((b) =>
    (b.textContent || "").trim()
  );
}

function setSelectedInterests(interests = []) {
  const wanted = new Set(interests);
  document.querySelectorAll(".interestItem").forEach((btn) => {
    const label = (btn.textContent || "").trim();
    const selected = wanted.has(label);
    btn.classList.toggle("isSelected", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function fillProfileForm(data) {
  if (!data) return;

  setInputVal("name", data.name === "Anonymous" ? "" : data.name);
  setInputVal("major", data.major);
  setInputVal("minor", data.minor);
  setInputVal("classYear", data.classYear);
  setInputVal("contactEmail", data.email);

  const genderEl = document.getElementById("gender");
  if (genderEl && data.gender_text) {
    genderEl.value = data.gender_text;
  }

  setSelectedInterests(data.interests || []);

  setSelectByVis("overallVis", data.def_vis);
  setSelectByVis("nameVis", data.name_vis);
  setSelectByVis("majorVis", data.major_vis);
  setSelectByVis("minorVis", data.minor_vis);
  setSelectByVis("classYearVis", data.classYear_vis);
  setSelectByVis("genderVis", data.gender_vis);
  setSelectByVis("emailVis", data.email_vis);
  setSelectByVis("interestsVis", data.interests_vis);
  setSelectByVis("pastClassVis", data.past_classes_vis);
  setSelectByVis("currentClassVis", data.cur_classes_vis);
  setSelectByVis("futureClassVis", data.future_classes_vis);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "signin.html";
    return;
  }

  const contactEmail = document.getElementById("contactEmail");
  if (contactEmail && !contactEmail.value) {
    contactEmail.value = user.email || "";
  }

  try {
    const res = await api.profileGet();
    fillProfileForm(res.data);
  } catch (err) {
    console.error("profile-get failed:", err);
  }
});

completeBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    window.location.href = "signin.html";
    return;
  }

  const name = getInputVal("name");
  const major = getInputVal("major");
  const minor = getInputVal("minor");
  const classYear = getInputVal("classYear");
  const contactEmail = getInputVal("contactEmail") || (user.email || "");

  const genderText = getInputVal("gender");
  const gender = genderText && genderText !== "Male" ? true : false;

  const interests = getSelectedInterests();
  const def_vis = getSelectVis("overallVis");

  const payload = {
    def_vis,

    name_vis: getSelectVis("nameVis"),
    major_vis: getSelectVis("majorVis"),
    minor_vis: getSelectVis("minorVis"),
    classYear_vis: getSelectVis("classYearVis"),
    gender_vis: getSelectVis("genderVis"),
    email_vis: getSelectVis("emailVis"),
    interests_vis: getSelectVis("interestsVis"),

    past_classes_vis: getSelectVis("pastClassVis"),
    cur_classes_vis: getSelectVis("currentClassVis"),
    future_classes_vis: getSelectVis("futureClassVis"),

    name: name || "Anonymous",
    major,
    minor,
    classYear,
    email: contactEmail,
    interests,
    gender,
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