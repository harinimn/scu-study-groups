import { auth } from "./firebase.js";

console.log("CONNECTIONS JS LOCAL-STATE MODE");

/* Tabs UI */
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
    panels[btn.dataset.tab]?.classList.add("isActive");
  });
});

/* State */
const state = {
  connections: [],
  incoming: [],
  outgoing: [],
  discover: [],
  query: "",
};

/* DOM refs */
const connectionsList = document.getElementById("connectionsList");
const incomingList = document.getElementById("incomingList");
const outgoingList = document.getElementById("outgoingList");
const discoverList = document.getElementById("discoverList");

const elCountConnections = document.getElementById("countConnections");
const elCountRequests = document.getElementById("countRequests");
const elIncomingCount = document.getElementById("incomingCount");
const elOutgoingCount = document.getElementById("outgoingCount");

const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");

/* Helpers */
function initialsFromName(name) {
  if (!name) return "A";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "A";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

function pillTags(courses = []) {
  const list = Array.isArray(courses) ? courses : [];
  if (!list.length) return "";
  return `
    <div class="tagRow">
      ${list.map((c) => `<span class="tag">${c}</span>`).join("")}
    </div>
  `;
}

function matchesQuery(p) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;

  const hay = [
    p.name,
    p.major,
    p.email,
    ...(Array.isArray(p.courses) ? p.courses : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(q);
}

function setCounts() {
  elCountConnections.textContent = state.connections.length;
  elCountRequests.textContent = state.incoming.length + state.outgoing.length;

  if (elIncomingCount) elIncomingCount.textContent = `(${state.incoming.length})`;
  if (elOutgoingCount) elOutgoingCount.textContent = `(${state.outgoing.length})`;
}

/* Render */
function renderConnections() {
  if (!connectionsList) return;
  const list = state.connections.filter(matchesQuery);

  connectionsList.innerHTML = list
    .map((p) => {
      return `
      <div class="personCard" data-id="${p.id}">
        <div class="avatarCircle">${p.initials}</div>

        <div class="personMain">
          <div class="personName">${p.name}</div>
          ${p.major ? `<div class="personMeta">${p.major}</div>` : ""}
          ${p.email ? `<div class="personEmail">${p.email}</div>` : ""}
          ${pillTags(p.courses)}
        </div>

        <div class="actions">
          <button class="iconBtn danger" data-action="remove" type="button" title="Remove">🗑️</button>
        </div>
      </div>
      `;
    })
    .join("");

  if (!list.length) {
    connectionsList.innerHTML = `<div class="personMeta">No connections found.</div>`;
  }
}

function renderRequests() {
  if (!incomingList || !outgoingList) return;

  const incoming = state.incoming.filter(matchesQuery);
  const outgoing = state.outgoing.filter(matchesQuery);

  incomingList.innerHTML = incoming
    .map((p) => {
      return `
      <div class="personCard softGreen" data-id="${p.id}">
        <div class="avatarCircle">${p.initials}</div>

        <div class="personMain">
          <div class="personName">${p.name}</div>
          ${p.major ? `<div class="personMeta">${p.major}</div>` : ""}
          ${p.email ? `<div class="personEmail">${p.email}</div>` : ""}
          ${pillTags(p.courses)}
        </div>

        <div class="actions">
          <button class="smallBtn primary" data-action="accept" type="button">✓ Accept</button>
          <button class="smallBtn ghost" data-action="deny" type="button">✕</button>
        </div>
      </div>
      `;
    })
    .join("");

  outgoingList.innerHTML = outgoing
    .map((p) => {
      return `
      <div class="personCard" data-id="${p.id}">
        <div class="avatarCircle">${p.initials}</div>

        <div class="personMain">
          <div class="personName">${p.name}</div>
          ${p.email ? `<div class="personEmail">${p.email}</div>` : ""}
          ${pillTags(p.courses)}
        </div>

        <div class="actions">
          <button class="smallBtn ghost" data-action="withdraw" type="button">Withdraw</button>
        </div>
      </div>
      `;
    })
    .join("");

  if (!incoming.length) incomingList.innerHTML = `<div class="personMeta">No incoming requests.</div>`;
  if (!outgoing.length) outgoingList.innerHTML = `<div class="personMeta">No outgoing requests.</div>`;
}

function renderDiscover() {
  if (!discoverList) return;
  const list = state.discover.filter(matchesQuery);

  discoverList.innerHTML = list
    .map((p) => {
      const alreadyConnected = state.connections.some((x) => x.id === p.id);
      const alreadyOutgoing = state.outgoing.some((x) => x.id === p.id);
      const alreadyIncoming = state.incoming.some((x) => x.id === p.id);

      let label = "👤 Connect";
      let disabled = false;

      if (alreadyConnected) {
        label = "Connected";
        disabled = true;
      } else if (alreadyOutgoing) {
        label = "Requested";
        disabled = true;
      } else if (alreadyIncoming) {
        label = "Incoming";
        disabled = true;
      }

      return `
      <div class="personCard" data-id="${p.id}">
        <div class="avatarCircle">${p.initials}</div>

        <div class="personMain">
          <div class="personName">${p.name}</div>
          ${p.major ? `<div class="personMeta">${p.major}</div>` : ""}
          ${p.email ? `<div class="personEmail">${p.email}</div>` : ""}
          ${pillTags(p.courses)}
        </div>

        <div class="actions">
          <button class="smallBtn ghost" data-action="connect" type="button" ${disabled ? "disabled" : ""}>
            ${label}
          </button>
        </div>
      </div>
      `;
    })
    .join("");

  if (!list.length) {
    discoverList.innerHTML = `<div class="personMeta">No results.</div>`;
  }
}

function renderAll() {
  setCounts();
  renderConnections();
  renderRequests();
  renderDiscover();
}

/* Cross-page sync (courses to connections)*/
const bc = new BroadcastChannel("scu-study-groups");

bc.onmessage = (event) => {
  const msg = event?.data;

  if (!msg || msg.type !== "connections:outgoing:add") return;

  const p = msg.person;
  if (!p?.id) return;

  const alreadyOutgoing = state.outgoing.some((x) => x.id === p.id);
  const alreadyConnected = state.connections.some((x) => x.id === p.id);
  const alreadyIncoming = state.incoming.some((x) => x.id === p.id);
  if (alreadyOutgoing || alreadyConnected || alreadyIncoming) return;

  state.outgoing.unshift({
    ...p,
    initials: p.initials || initialsFromName(p.name),
  });
  state.discover = state.discover.filter((x) => x.id !== p.id);

  renderAll();
};

/* Click handling (event delegation)*/
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const card = btn.closest(".personCard");
  const id = card?.dataset?.id;
  if (!id) return;

  if (action === "remove") {
    if (!confirm("Remove this connection?")) return;
    state.connections = state.connections.filter((p) => p.id !== id);
    renderAll();
    return;
  }

  if (action === "accept") {
    const person = state.incoming.find((p) => p.id === id);
    if (!person) return;
    state.incoming = state.incoming.filter((p) => p.id !== id);
    state.connections.unshift(person);
    renderAll();
    return;
  }

  if (action === "deny") {
    state.incoming = state.incoming.filter((p) => p.id !== id);
    renderAll();
    return;
  }

  if (action === "withdraw") {
    state.outgoing = state.outgoing.filter((p) => p.id !== id);
    renderAll();
    return;
  }

  if (action === "connect") {
    const person = state.discover.find((p) => p.id === id);
    if (!person) return;
    state.outgoing.unshift(person);
    renderAll();
    return;
  }
});

/* Search*/
if (searchInput) {
  searchInput.addEventListener("input", () => {
    state.query = searchInput.value || "";
    renderAll();
  });
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", () => {
    state.query = "";
    if (searchInput) searchInput.value = "";
    renderAll();
  });
}

/* Seed demo data */
function seed() {
  const mk = (id, name, major, email, courses) => ({
    id,
    name,
    major,
    email,
    courses,
    initials: initialsFromName(name),
  });

  state.connections = [
    mk("u1", "Sarah Chen", "Computer Science", "schen@scu.edu", ["CSCI 61", "MATH 13"]),
    mk("u2", "Anonymous", "", "", ["PHIL 26"]),
    mk("u3", "Michael Rodriguez", "Mathematics", "mrodriguez@scu.edu", ["MATH 13"]),
  ];

  state.incoming = [
    mk("u4", "Emily Thompson", "Engineering", "ethompson@scu.edu", ["MATH 13"]),
    mk("u5", "David Kim", "Computer Science", "dkim@scu.edu", ["CSCI 61"]),
  ];

  state.outgoing = [
    mk("u6", "A Johnson", "", "ajohnson@scu.edu", ["ENGL 2"]),
  ];

  state.discover = [
    mk("u7", "Jessica Wu", "Computer Science", "jwu@scu.edu", ["CSCI 61"]),
    mk("u8", "Marcus Lee", "Mathematics", "mlee@scu.edu", ["MATH 13"]),
    mk("u9", "Anonymous", "", "", ["PHIL 26"]),
  ];
}

/* Boot*/
auth.onAuthStateChanged((user) => {
  if (!user) {
    console.log("Not logged in");
    return;
  }
  console.log("Logged in as:", user.email);

  seed();
  renderAll();
});
