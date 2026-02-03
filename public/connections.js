// Tabs
const tabButtons = document.querySelectorAll(".segBtn");
const panels = {
  connections: document.getElementById("tab-connections"),
  requests: document.getElementById("tab-requests"),
  discover: document.getElementById("tab-discover"),
};

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("isActive"));
    btn.classList.add("isActive");

    Object.values(panels).forEach((p) => p.classList.remove("isActive"));
    panels[btn.dataset.tab].classList.add("isActive");
  });
});

// Sample data (replace with backend later)
const state = {
  connections: [
    {
      initials: "SC",
      name: "Sarah Chen",
      major: "Computer Science",
      email: "schen@scu.edu",
      courses: ["CSCI 61", "MATH 13"],
      anonymous: false,
    },
    {
      initials: "A",
      name: "Anonymous",
      major: "",
      email: "",
      courses: ["PHIL 26"],
      anonymous: true,
    },
    {
      initials: "MR",
      name: "Michael Rodriguez",
      major: "Mathematics",
      email: "mrodriguez@scu.edu",
      courses: ["MATH 13"],
      anonymous: false,
    },
  ],
  incoming: [
    { initials: "ET", name: "Emily Thompson", major: "Engineering", email: "ethompson@scu.edu", when: "2 hours ago", course: "MATH 13" },
    { initials: "DK", name: "David Kim", major: "Computer Science", email: "dkim@scu.edu", when: "1 day ago", course: "CSCI 61" },
  ],
  outgoing: [
    { initials: "A", name: "Anonymous", email: "ajohnson@scu.edu", when: "Sent 3 days ago", course: "ENGL 2" },
  ],
  discover: [
    {
      initials: "JW",
      name: "Jessica Wu",
      major: "Computer Science",
      mutual: "2 mutual",
      interests: "3 interests",
      course: "CSCI 61",
      common: "Data Structures, Algorithms, Web Development",
    },
    {
      initials: "A",
      name: "Anonymous",
      major: "",
      mutual: "1 mutual",
      interests: "2 interests",
      course: "PHIL 26",
      common: "Ethics, Philosophy",
    },
    {
      initials: "ML",
      name: "Marcus Lee",
      major: "Mathematics",
      mutual: "3 mutual",
      interests: "2 interests",
      course: "MATH 13",
      common: "Calculus, Linear Algebra",
    },
  ],
};

const connectionsList = document.getElementById("connectionsList");
const incomingList = document.getElementById("incomingList");
const outgoingList = document.getElementById("outgoingList");
const discoverList = document.getElementById("discoverList");

function pillTags(courses = []) {
  return `
    <div class="tagRow">
      ${courses.map((c) => `<span class="tag">${c}</span>`).join("")}
    </div>
  `;
}

function renderConnections() {
  connectionsList.innerHTML = state.connections
    .map((p) => {
      return `
      <div class="personCard">
        <div class="avatarCircle">${p.initials}</div>

        <div class="personMain">
          <div class="personName">${p.name}</div>
          ${p.major ? `<div class="personMeta">${p.major}</div>` : ""}
          ${p.email ? `<div class="personEmail">${p.email}</div>` : ""}
          ${pillTags(p.courses)}
        </div>

        <div class="actions">
          <button class="iconBtn" type="button" title="Message">✉️</button>
          <button class="iconBtn danger" type="button" title="Remove">🗑️</button>
        </div>
      </div>
      `;
    })
    .join("");
}

function renderRequests() {
  document.getElementById("incomingCount").textContent = `(${state.incoming.length})`;
  document.getElementById("outgoingCount").textContent = `(${state.outgoing.length})`;

  incomingList.innerHTML = state.incoming
    .map(
      (p) => `
    <div class="personCard softGreen">
      <div class="avatarCircle">${p.initials}</div>

      <div class="personMain">
        <div class="personName">${p.name}</div>
        <div class="personMeta">${p.major}</div>
        <div class="personEmail">${p.email}</div>
        <div class="personMeta">${p.when}</div>
        <div class="tagRow"><span class="tag">${p.course}</span></div>
      </div>

      <div class="actions">
        <button class="smallBtn primary" type="button">✓ Accept</button>
        <button class="smallBtn ghost" type="button">✕</button>
      </div>
    </div>
  `
    )
    .join("");

  outgoingList.innerHTML = state.outgoing
    .map(
      (p) => `
    <div class="personCard">
      <div class="avatarCircle">${p.initials}</div>

      <div class="personMain">
        <div class="personName">${p.name}</div>
        <div class="personEmail">${p.email}</div>
        <div class="personMeta">${p.when}</div>
        <div class="tagRow"><span class="tag">${p.course}</span></div>
      </div>

      <div class="actions">
        <button class="smallBtn ghost" type="button">Withdraw</button>
      </div>
    </div>
  `
    )
    .join("");
}

function renderDiscover() {
  discoverList.innerHTML = state.discover
    .map(
      (p) => `
    <div class="personCard">
      <div class="avatarCircle">${p.initials}</div>

      <div class="personMain">
        <div class="personName">${p.name}</div>
        ${p.major ? `<div class="personMeta">${p.major}</div>` : ""}
        <div class="tagRow">
          <span class="tag">${p.mutual}</span>
          <span class="tag">${p.interests}</span>
          <span class="tag green">${p.course}</span>
        </div>
        <div class="personMeta" style="margin-top:6px;">
          Common interests:
          <span style="color: rgba(17,24,39,0.75); font-weight:700;">${p.common}</span>
        </div>
      </div>

      <div class="actions">
        <button class="smallBtn ghost" type="button">👤 Connect</button>
      </div>
    </div>
  `
    )
    .join("");
}

// Send request (frontend stub)
document.getElementById("sendRequestBtn").addEventListener("click", () => {
  const email = document.getElementById("emailInput").value.trim();
  if (!email) return alert("Enter an SCU email.");
  if (!email.toLowerCase().endsWith("@scu.edu")) return alert("Use your @scu.edu email.");

  console.log("Send connection request to:", email);
  alert("Request sent (stub). Hook to backend later.");
});

// Initial render
renderConnections();
renderRequests();
renderDiscover();

// Update counts on tabs
document.getElementById("countConnections").textContent = state.connections.length;
document.getElementById("countRequests").textContent = state.incoming.length + state.outgoing.length;
