import { auth, functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const api = {
  list: httpsCallable(functions, "connections-list"),
  pending: httpsCallable(functions, "connections-pending"),
  outgoing: httpsCallable(functions, "connections-outgoing"),
  common: httpsCallable(functions, "connections-common"),
  interests: httpsCallable(functions, "connections-interests"),
  send: httpsCallable(functions, "connections-send"),
  accept: httpsCallable(functions, "connections-accept"),
  deny: httpsCallable(functions, "connections-deny"),
  withdraw: httpsCallable(functions, "connections-withdraw"),
  del: httpsCallable(functions, "connections-del"),
};

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
const emailSearchResult = document.getElementById("emailSearchResult");

const elCountConnections = document.getElementById("countConnections");
const elCountRequests = document.getElementById("countRequests");
const elIncomingCount = document.getElementById("incomingCount");
const elOutgoingCount = document.getElementById("outgoingCount");

const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const emailSearchInput = document.getElementById("emailSearchInput");
const emailSearchBtn = document.getElementById("emailSearchBtn");

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

function interestTags(interests = []) {
  const list = Array.isArray(interests) ? interests : [];
  if (!list.length) return "";
  return `
    <div class="tagRow">
      ${list.map((i) => `<span class="tag">${i}</span>`).join("")}
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
    ...(Array.isArray(p.interests) ? p.interests : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(q);
}

function normalizePerson(p, source = "") {
  const person = p || {};
  return {
    ...person,
    id: person.id || "",
    name: person.name || "Anonymous",
    major: person.major || "",
    email: person.email || "",
    courses: Array.isArray(person.courses) ? person.courses : [],
    interests: Array.isArray(person.interests) ? person.interests : [],
    common: typeof person.common === "number" ? person.common : 0,
    source,
    initials: person.initials || initialsFromName(person.name),
  };
}

function dedupeById(list) {
  const map = new Map();

  for (const raw of list) {
    const p = normalizePerson(raw);

    if (!p.id) continue;

    if (!map.has(p.id)) {
      map.set(p.id, p);
      continue;
    }

    const prev = map.get(p.id);
    map.set(p.id, {
      ...prev,
      ...p,
      name: prev.name !== "Anonymous" ? prev.name : p.name,
      major: prev.major || p.major,
      email: prev.email || p.email,
      courses: prev.courses?.length ? prev.courses : p.courses,
      interests: prev.interests?.length ? prev.interests : p.interests,
      common: Math.max(prev.common || 0, p.common || 0),
      initials: prev.initials || p.initials,
      source: prev.source || p.source,
    });
  }

  return [...map.values()];
}

function allKnownPeople() {
  return dedupeById([
    ...state.connections,
    ...state.incoming,
    ...state.outgoing,
    ...state.discover,
  ]);
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
          ${p.interests?.length ? `<div class="personMeta">Interests</div>${interestTags(p.interests)}` : ""}
          ${p.common ? `<div class="personMeta">${p.common} shared match${p.common === 1 ? "" : "es"}</div>` : ""}
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

function renderEmailSearchResult(person, searchedEmail) {
  if (!emailSearchResult) return;

  if (!searchedEmail) {
    emailSearchResult.innerHTML = "";
    return;
  }

  if (!person) {
    emailSearchResult.innerHTML = `
      <div class="personCard">
        <div class="avatarCircle">?</div>
        <div class="personMain">
          <div class="personName">${searchedEmail}</div>
          <div class="personMeta">No loaded user matched this email. You can still send a request by email.</div>
        </div>
        <div class="actions">
          <button class="smallBtn ghost" data-action="connect-email" data-email="${searchedEmail}" type="button">
            Send Request
          </button>
        </div>
      </div>
    `;
    return;
  }

  const alreadyConnected = state.connections.some((x) => x.id === person.id);
  const alreadyOutgoing = state.outgoing.some((x) => x.id === person.id);
  const alreadyIncoming = state.incoming.some((x) => x.id === person.id);

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

  emailSearchResult.innerHTML = `
    <div class="personCard" data-id="${person.id}">
      <div class="avatarCircle">${person.initials}</div>

      <div class="personMain">
        <div class="personName">${person.name}</div>
        ${person.major ? `<div class="personMeta">${person.major}</div>` : ""}
        ${person.email ? `<div class="personEmail">${person.email}</div>` : ""}
        ${pillTags(person.courses)}
      </div>

      <div class="actions">
        <button
          class="smallBtn ghost"
          data-action="connect-email-result"
          data-id="${person.id}"
          data-email="${person.email}"
          type="button"
          ${disabled ? "disabled" : ""}
        >
          ${label}
        </button>
      </div>
    </div>
  `;
}

function renderAll() {
  setCounts();
  renderConnections();
  renderRequests();
  renderDiscover();
}

/* Cross-page sync (courses to connections) */
const bc = new BroadcastChannel("scu-study-groups");

bc.onmessage = (event) => {
  const msg = event?.data;

  if (!msg || msg.type !== "connections:outgoing:add") return;

  const p = normalizePerson(msg.person);
  if (!p?.id) return;

  const alreadyOutgoing = state.outgoing.some((x) => x.id === p.id);
  const alreadyConnected = state.connections.some((x) => x.id === p.id);
  const alreadyIncoming = state.incoming.some((x) => x.id === p.id);
  if (alreadyOutgoing || alreadyConnected || alreadyIncoming) return;

  state.outgoing.unshift(p);
  state.discover = state.discover.filter((x) => x.id !== p.id);

  renderAll();
};

/* Helpers for backend index-based actions */
function findIndexInIncoming(id) {
  return state.incoming.findIndex((p) => p.id === id);
}

function findIndexInOutgoing(id) {
  return state.outgoing.findIndex((p) => p.id === id);
}

function findIndexInConnections(id) {
  return state.connections.findIndex((p) => p.id === id);
}

/* Click handling */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const card = btn.closest(".personCard");
  const id = card?.dataset?.id;

  try {
    if (action === "accept") {
      const idx = findIndexInIncoming(id);
      if (idx < 0) return;
      await api.accept({ index: idx });
      await loadAll();
      return;
    }

    if (action === "deny") {
      const idx = findIndexInIncoming(id);
      if (idx < 0) return;
      await api.deny({ index: idx });
      await loadAll();
      return;
    }

    if (action === "withdraw") {
      const idx = findIndexInOutgoing(id);
      if (idx < 0) return;
      await api.withdraw({ index: idx });
      await loadAll();
      return;
    }

    if (action === "remove") {
      const idx = findIndexInConnections(id);
      if (idx < 0) return;
      await api.del({ index: idx });
      await loadAll();
      return;
    }

    if (action === "connect") {
      const person = state.discover.find((p) => p.id === id);
      if (!person) return;
      await api.send({ id: person.id });
      await loadAll();
      return;
    }

    if (action === "connect-email-result") {
      const targetId = btn.dataset.id || "";
      const targetEmail = btn.dataset.email || "";
      if (targetId) {
        await api.send({ id: targetId });
      } else if (targetEmail) {
        await api.send({ email: targetEmail });
      }
      await loadAll();
      return;
    }

    if (action === "connect-email") {
      const targetEmail = btn.dataset.email || "";
      if (!targetEmail) return;
      await api.send({ email: targetEmail });
      await loadAll();
      return;
    }
  } catch (err) {
    console.error("Action failed:", action, err);
    alert("Backend error. Try again.");
  }
});

/* Search */
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

/* Email search */
function findLoadedPersonByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  return allKnownPeople().find((p) => String(p.email || "").trim().toLowerCase() === normalized) || null;
}

if (emailSearchBtn) {
  emailSearchBtn.addEventListener("click", () => {
    const email = (emailSearchInput?.value || "").trim();
    if (!email) {
      renderEmailSearchResult(null, "");
      return;
    }

    const match = findLoadedPersonByEmail(email);
    renderEmailSearchResult(match, email);
  });
}

if (emailSearchInput) {
  emailSearchInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    emailSearchBtn?.click();
  });
}

/* Load all backend data */
async function loadAll() {
  const fields = [
    ["name", "Anonymous"],
    ["major", ""],
    ["email", ""],
    ["courses", []],
    ["interests", []],
  ];

  const [connectionsRes, incomingRes, outgoingRes, commonRes, interestsRes] = await Promise.all([
    api.list({ fields }),
    api.pending({ fields }),
    api.outgoing({ fields }),
    api.common({ fields }),
    api.interests({ fields }),
  ]);

  state.connections = dedupeById((connectionsRes.data || []).map((p) => normalizePerson(p, "connections")));
  state.incoming = dedupeById((incomingRes.data || []).map((p) => normalizePerson(p, "incoming")));
  state.outgoing = dedupeById((outgoingRes.data || []).map((p) => normalizePerson(p, "outgoing")));

  const discoverRaw = [
    ...((commonRes.data || []).map((p) => normalizePerson(p, "common"))),
    ...((interestsRes.data || []).map((p) => normalizePerson(p, "interests"))),
  ];

  state.discover = dedupeById(discoverRaw)
    .filter((p) => p.id)
    .filter((p) => !state.connections.some((x) => x.id === p.id))
    .sort((a, b) => (b.common || 0) - (a.common || 0));

  renderAll();

  // keep email result fresh if user already typed something
  const currentEmail = (emailSearchInput?.value || "").trim();
  if (currentEmail) {
    renderEmailSearchResult(findLoadedPersonByEmail(currentEmail), currentEmail);
  }
}

/* Boot */
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  try {
    await loadAll();
  } catch (e) {
    console.error("Failed to load connections:", e);
    alert("Backend error loading connections.");
  }
});