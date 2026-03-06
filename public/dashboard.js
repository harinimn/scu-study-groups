import { auth, db, functions } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

/* Backend (groups.mjs) */
const api = {
  groupsGet: httpsCallable(functions, "groups-get"),
  groupsLeave: httpsCallable(functions, "groups-leave"),
};

const ACTIVE_QUARTER = "Winter 2026";
const ACTIVE_CLASS_INDEX = 0;

/* UI data */
const suggested = [
  { course: "CSCI 61", title: "Data Structures", day: "Monday, Jan 6", time: "2:00 PM - 4:00 PM", location: "Library Study Room 204", members: 4, match: 95 },
  { course: "MATH 13", title: "Calculus I", day: "Wednesday, Jan 8", time: "4:00 PM - 6:00 PM", location: "O'Connor Hall Room 112", members: 5, match: 88 },
  { course: "CSCI 61", title: "Data Structures", day: "Thursday, Jan 9", time: "10:00 AM - 12:00 PM", location: "Alameda Hall Room 139", members: 3, match: 82 },
  { course: "PHIL 26", title: "Ethics", day: "Friday, Jan 10", time: "1:00 PM - 3:00 PM", location: "Library Study Room 201", members: 6, match: 78 },
];

const myGroups = [];

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

/* Backend loaders */
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

/* Render */
function renderSuggested() {
  const wrap = document.getElementById("suggestedList");
  const count = document.getElementById("suggestCount");
  if (!wrap || !count) return;

  wrap.innerHTML = "";
  count.textContent = String(suggested.length);

  suggested.forEach((g, idx) => {
    const card = el("div", "suggestCard");

    const top = el("div", "suggestTop");
    const left = el("div");

    const pill = el("div", "coursePill", g.course);
    const title = el("div", "suggestTitle", g.title);

    const meta = el("div", "meta");
    const r1 = el("div", "metaRow");
    r1.append(el("span", "metaIcon", "🗓️"), el("span", null, `${g.day} • ${g.time}`));

    const r2 = el("div", "metaRow");
    r2.append(el("span", "metaIcon", "📍"), el("span", null, g.location));

    const r3 = el("div", "metaRow");
    r3.append(el("span", "metaIcon", "👤"), el("span", null, `${g.members} members`));

    meta.append(r1, r2, r3);
    left.append(pill, title, meta);

    const actions = el("div", "actions");
    actions.append(el("div", "matchPill", `${g.match}% match`));

    const joinBtn = el("button", "btnPrimary", "Join");
    joinBtn.type = "button";
    joinBtn.addEventListener("click", () => {
      const joined = suggested.splice(idx, 1)[0];

      myGroups.unshift({
        id: "", 
        course: joined.course,
        name: `${joined.title} Study Group`,
        next: `${joined.day} at ${joined.time}`,
        members: joined.members,
      });

      renderSuggested();
      renderMyGroups();
    });

    const skipBtn = el("button", "btnGhost", "Skip");
    skipBtn.type = "button";
    skipBtn.addEventListener("click", () => {
      suggested.splice(idx, 1);
      renderSuggested();
    });

    actions.append(joinBtn, skipBtn);
    top.append(left, actions);
    card.append(top);
    wrap.append(card);
  });
}

function renderMyGroups() {
  const wrap = document.getElementById("myGroupsList");
  const count = document.getElementById("myCount");
  if (!wrap || !count) return;

  wrap.innerHTML = "";
  count.textContent = String(myGroups.length);

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

/* Leave handler (backend) */
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
  if (!user) return (window.location.href = "signin.html");
  if (!user.emailVerified) return (window.location.href = "signin.html");

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return (window.location.href = "profile-setup.html");

  // load groups from backend
  try {
    const backendGroups = await loadMyGroupsFromBackend();

    myGroups.length = 0;
    backendGroups.forEach((g) => {
      myGroups.push({
        id: g.id, 
        course: "CSCI 61", 
        name: `Study Group • ${g.time || ""}`,
        next: g.time || "TBD",
        members: Array.isArray(g.members) ? g.members.length : 1,
      });
    });

    renderMyGroups();
  } catch (err) {
    console.error("groups-get failed:", err);
  }
});

renderSuggested();
renderMyGroups();