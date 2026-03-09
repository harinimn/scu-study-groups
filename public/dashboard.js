import { auth, db, functions } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";


const api = {
  groupsGet: httpsCallable(functions, "groups-get"),
  groupsLeave: httpsCallable(functions, "groups-leave"),
};

const ACTIVE_QUARTER = localStorage.getItem("activeQuarter") || "Winter 2026";
const ACTIVE_CLASS_INDEX = 0;

const myGroups = [];

function initialsFromName(name) {
  if (!name) return "AN";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "A";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

function updateDashboardProfile(profile, user) {
  const displayNameEl = document.getElementById("displayName");
  const profileMenuBtn = document.getElementById("profileMenuBtn");

  let name = profile?.name || "";

  if (!name || name === "Anonymous") {
    name = user?.email?.split("@")[0] || "Anonymous";
  }

  if (displayNameEl) {
    displayNameEl.textContent = name;
  }

  if (profileMenuBtn) {
    profileMenuBtn.textContent = initialsFromName(name);
  }
}

const profileMenuBtn = document.getElementById("profileMenuBtn");
const profileMenu = document.getElementById("profileMenu");
const signOutBtn = document.getElementById("signOutBtn");

profileMenuBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  profileMenu?.classList.toggle("isOpen");
});

document.addEventListener("click", (e) => {
  if (!profileMenu || !profileMenuBtn) return;
  if (!profileMenu.contains(e.target) && !profileMenuBtn.contains(e.target)) {
    profileMenu.classList.remove("isOpen");
  }
});

signOutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "signin.html";
  } catch (err) {
    console.error("sign out failed:", err);
    alert("Could not sign out. Try again.");
  }
});

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

/* Backend loader */
async function loadMyGroupsFromBackend() {
  const fields = [
    ["name", "Anonymous"],
    ["major", ""],
    ["email", ""],
  ];

  const res = await api.groupsGet({
    quarter: ACTIVE_QUARTER,
    class: ACTIVE_CLASS_INDEX,
    fields,
  });

  return res.data || [];
}

/* Suggested groups */
function renderSuggested() {
  const wrap = document.getElementById("suggestedList");
  const count = document.getElementById("suggestCount");
  if (!wrap || !count) return;

  count.textContent = "0";
  wrap.innerHTML = `<div class="miniNote">No suggested groups to show yet.</div>`;
}

/* My groups */
function renderMyGroups() {
  const wrap = document.getElementById("myGroupsList");
  const count = document.getElementById("myCount");
  if (!wrap || !count) return;

  wrap.innerHTML = "";
  count.textContent = String(myGroups.length);

  if (!myGroups.length) {
    wrap.innerHTML = `<div class="miniNote">You’re not in any study groups yet.</div>`;
    return;
  }

  myGroups.forEach((g) => {
    const row = el("div", "myRow");

    const left = el("div", "leftBlock");
    left.append(el("div", "coursePill", g.course || "Course"));
    left.append(el("div", "groupName", g.name || "Study Group"));

    const next = el("div", "nextLine");
    next.append(el("span", null, "⏱️"), el("span", null, `Next: ${g.next || "TBD"}`));
    left.append(next);

    const right = el("div", "myGroupRight");

    const members = el("div", "memberCount");
    members.append(el("span", null, "👥"), el("span", null, String(g.members ?? 1)));

    const leaveBtn = el("button", "btnGhost", "Leave");
    leaveBtn.type = "button";
    leaveBtn.dataset.action = "leaveGroup";
    leaveBtn.dataset.groupId = g.id || "";

    right.append(members, leaveBtn);
    row.append(left, right);
    wrap.append(row);
  });
}

/* Leave handler */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action='leaveGroup']");
  if (!btn) return;

  const groupId = btn.dataset.groupId;
  if (!confirm("Leave this study group?")) return;

  if (!groupId) {
    const row = btn.closest(".myRow");
    row?.remove();
    return;
  }

  try {
    await api.groupsLeave({ group: groupId });

    const idx = myGroups.findIndex((g) => g.id === groupId);
    if (idx !== -1) myGroups.splice(idx, 1);

    renderMyGroups();
  } catch (err) {
    console.error("groups-leave failed:", err);
    alert("Backend error leaving group.");
  }
});

/* Auth boot */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "signin.html";
    return;
  }

  if (!user.emailVerified) {
    window.location.href = "signin.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    window.location.href = "profile-setup.html";
    return;
  }

  const profile = snap.data() || {};
  updateDashboardProfile(profile, user);

  try {
    const backendGroups = await loadMyGroupsFromBackend();

    myGroups.length = 0;
    backendGroups.forEach((g) => {
      myGroups.push({
        id: g.id || "",
        course: g.course || "Course",
        name: g.name || `Study Group • ${g.time || ""}`,
        next: g.time || "TBD",
        members: Array.isArray(g.members) ? g.members.length : 1,
      });
    });

    renderMyGroups();
  } catch (err) {
    console.error("groups-get failed:", err);
    renderMyGroups();
  }

  renderSuggested();
});

renderSuggested();
renderMyGroups();