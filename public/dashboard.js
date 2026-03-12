import { auth, db, functions } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const api = {
  groupsGet: httpsCallable(functions, "groups-get"),
  groupsLeave: httpsCallable(functions, "groups-leave"),
  groupsSend: httpsCallable(functions, "groups-send"),
  profileRemove: httpsCallable(functions, "profile-remove"),
};

const ACTIVE_QUARTER = localStorage.getItem("activeQuarter") || "Winter 2026";
const ACTIVE_CLASS_INDEX = 0;

const myGroups = [];

/* Profile helpers */
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

/* Profile menu */
const profileMenuBtn = document.getElementById("profileMenuBtn");
const profileMenu = document.getElementById("profileMenu");
const signOutBtn = document.getElementById("signOutBtn");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");

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

deleteAccountBtn?.addEventListener("click", async () => {
  const firstConfirm = confirm("Are you sure you want to delete your account? This will remove your profile, connections, and study group membership.");
  if (!firstConfirm) return;

  const secondConfirm = confirm("This cannot be undone. Delete your account?");
  if (!secondConfirm) return;

  try {
    await api.profileRemove({});
    await signOut(auth);
    window.location.href = "signin.html";
  } catch (err) {
    console.error("profile-remove failed:", err);
    alert("Could not delete account. Try again.");
  }
});

/* DOM helper */
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

/* Member helpers */
function normalizeMember(member) {
  const m = member || {};
  const name = m.name || "Anonymous";

  return {
    id: m.id || "",
    name,
    major: m.major || "",
    email: m.email || "",
    initials: initialsFromName(name),
  };
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

/* Render one member */
function renderMemberHTML(member) {
  return `
    <div class="studentCard">
      <div class="avatarCircle small">${member.initials}</div>

      <div class="studentMain">
        <div class="studentTopRow">
          <div class="studentName">${member.name}</div>
        </div>
        ${member.major ? `<div class="studentMeta">${member.major}</div>` : ""}
        ${member.email ? `<div class="studentEmail">${member.email}</div>` : ""}
      </div>
    </div>
  `;
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

    const memberList = el("div", "studentList");
    if (Array.isArray(g.membersData) && g.membersData.length) {
      memberList.innerHTML = g.membersData.map(renderMemberHTML).join("");
    } else {
      memberList.innerHTML = `<div class="miniNote">No visible members yet.</div>`;
    }
    left.append(memberList);

    const right = el("div", "myGroupRight");

    const members = el("div", "memberCount");
    members.append(el("span", null, "👥"), el("span", null, String(g.members ?? 0)));

    const messageBtn = el("button", "btnGhost", "Message Group");
    messageBtn.type = "button";
    messageBtn.dataset.action = "messageGroup";
    messageBtn.dataset.groupId = g.id || "";

    const leaveBtn = el("button", "btnGhost", "Leave");
    leaveBtn.type = "button";
    leaveBtn.dataset.action = "leaveGroup";
    leaveBtn.dataset.groupId = g.id || "";

    right.append(members, messageBtn, leaveBtn);
    row.append(left, right);
    wrap.append(row);
  });
}

/* Click handlers */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const groupId = btn.dataset.groupId;

  if (action === "leaveGroup") {
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

    return;
  }

  if (action === "messageGroup") {
    if (!groupId) {
      alert("This group cannot be messaged yet.");
      return;
    }

    const message = prompt("Enter a message to send to your study group:");
    if (!message || !message.trim()) return;

    try {
      await api.groupsSend({
        group: groupId,
        message: message.trim(),
      });

      alert("Message sent to group.");
    } catch (err) {
      console.error("groups-send failed:", err);
      alert("Backend error sending group message.");
    }

    return;
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
      const membersData = Array.isArray(g.members)
        ? g.members.map(normalizeMember)
        : [];

      myGroups.push({
        id: g.id || "",
        course: g.course || "Course",
        name: `Study Group • ${g.time || ""}`,
        next: g.time || "TBD",
        members: membersData.length,
        membersData,
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