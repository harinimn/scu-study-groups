import { auth, functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

// Backend callables
const api = {
  classesGet: httpsCallable(functions, "classes-get"),
  groupsSet: httpsCallable(functions, "groups-set"),
};

const acc = document.getElementById("classesAccordion");
const statusEl = document.getElementById("classesStatus");
if (!acc) throw new Error("Accordion not found");

const ACTIVE_QUARTER = localStorage.getItem("activeQuarter") || "Winter 2026";

function setStatus(text = "") {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.style.display = text ? "block" : "none";
}

function closeAll() {
  acc.querySelectorAll(".accItem").forEach((item) => item.classList.remove("isOpen"));
}

function makeGridHTML() {
  const times = [
    "8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM",
    "1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM",
    "6:00 PM","7:00 PM","8:00 PM",
  ];
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  let html = `<table class="timeGrid" data-field="grid">
    <thead><tr><th class="timeCol"></th>${days.map(d => `<th>${d}</th>`).join("")}</tr></thead>
    <tbody>`;

  times.forEach((t, r) => {
    html += `<tr><td class="timeCol">${t}</td>`;
    for (let c = 0; c < days.length; c++) html += `<td data-r="${r}" data-c="${c}"></td>`;
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

function itemBodyHTML({ course, section }) {
  return `
    <div class="formRow">
      <div class="rowLabel">
        <span class="rowIcon">⏱️</span>
        <div><div class="rowTitle">Hours per week you want to study for this class</div></div>
      </div>
      <input class="textInput" type="number" min="0" placeholder="e.g., 5" data-field="hours" />
    </div>

    <div class="divider"></div>

    <div class="formRow">
      <div class="rowLabel">
        <span class="rowIcon">🗓️</span>
        <div>
          <div class="rowTitle">Preferred study times</div>
          <div class="rowSub">Click on time slots to select when you're available to study</div>
        </div>
      </div>

      <div class="gridWrap">
        <div class="gridScroller">${makeGridHTML()}</div>
        <div class="gridHint">Tip: drag across cells for faster selection</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="formRow">
      <div class="rowLabel">
        <span class="rowIcon">👤</span>
        <div><div class="rowTitle">Study with</div></div>
      </div>

      <div class="choiceList">
        <label class="choiceCard">
          <input type="checkbox" data-field="studyWith" value="same_section" />
          <div class="choiceText">
            <div class="choiceTitle">People in the same section</div>
            <div class="choiceSub">Section ${section || "—"}</div>
          </div>
        </label>

        <label class="choiceCard">
          <input type="checkbox" data-field="studyWith" value="other_sections" />
          <div class="choiceText">
            <div class="choiceTitle">People in other sections</div>
            <div class="choiceSub">Any section of ${course}</div>
          </div>
        </label>
      </div>
    </div>

    <button class="saveBtn" type="button">Save Preferences for ${course}</button>
  `;
}

function itemHTML({ course, section, classIndex }) {
  return `
    <div class="accItem" data-course="${course}" data-section="${section}" data-class-index="${classIndex}">
      <button class="accHeader" type="button">
        <div class="accLeft">
          <span class="coursePill">${course}</span>
          <div class="accText">
            <div class="accTitle">Course ${course}</div>
            <div class="accSub">Section ${section || "—"}</div>
          </div>
        </div>
        <span class="chev">⌄</span>
      </button>

      <div class="accBody">
        ${itemBodyHTML({ course, section })}
      </div>
    </div>
  `;
}

function renderClasses(classes) {
  const list = Array.isArray(classes) ? classes : [];

  if (!list.length) {
    acc.innerHTML = `<div class="miniNote">No classes found for ${ACTIVE_QUARTER}.</div>`;
    return;
  }

  acc.innerHTML = list
    .map((c, idx) => {
      const course = c.course || c.code || `Class ${idx + 1}`;
      const section = c.section ? String(c.section) : "";
      return itemHTML({ course, section, classIndex: idx });
    })
    .join("");

  wireAccordion();

  const first = acc.querySelector(".accItem");
  if (first) first.classList.add("isOpen");
}

function wireAccordion() {
  acc.addEventListener("click", (e) => {
    const header = e.target.closest(".accHeader");
    if (!header) return;
    const item = header.closest(".accItem");
    if (!item) return;

    const isOpen = item.classList.contains("isOpen");
    closeAll();
    if (!isOpen) item.classList.add("isOpen");
  });

  acc.querySelectorAll(".accItem").forEach((item) => {
    wireGridInteractions(item);
    wireSave(item);
  });
}

function wireGridInteractions(item) {
  const grid = item.querySelector(".timeGrid");
  if (!grid) return;
  if (grid.dataset.wired === "1") return;
  grid.dataset.wired = "1";

  let isDragging = false;
  let dragMode = null;
  let didDrag = false;
  let startCell = null;

  grid.style.userSelect = "none";

  function isDataCell(td) {
    return td && td.tagName === "TD" && !td.classList.contains("timeCol");
  }
  function setCell(td, mode) {
    if (!isDataCell(td)) return;
    td.classList.toggle("isOn", mode === "on");
  }
  function toggleCell(td) {
    if (!isDataCell(td)) return;
    td.classList.toggle("isOn");
  }

  grid.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const td = e.target.closest("td");
    if (!isDataCell(td)) return;

    isDragging = true;
    didDrag = false;
    startCell = td;
    dragMode = td.classList.contains("isOn") ? "off" : "on";
    e.preventDefault();
  });

  grid.addEventListener("mouseover", (e) => {
    if (!isDragging) return;
    const td = e.target.closest("td");
    if (!isDataCell(td)) return;

    if (td !== startCell) didDrag = true;
    setCell(td, dragMode);
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    if (!didDrag && startCell) toggleCell(startCell);

    isDragging = false;
    dragMode = null;
    startCell = null;
    didDrag = false;
  });
}

function wireSave(item) {
  const btn = item.querySelector(".saveBtn");
  if (!btn) return;
  if (btn.dataset.wired === "1") return;
  btn.dataset.wired = "1";

  btn.addEventListener("click", async () => {
    if (!auth.currentUser) return alert("Please sign in first.");

    const course = item.dataset.course || "Course";
    const classIndex = Number(item.dataset.classIndex || 0);

    const hoursEl = item.querySelector('[data-field="hours"]');
    const slots = hoursEl ? Number(hoursEl.value || 0) : 0;

    const selectedCells = [...item.querySelectorAll(".timeGrid td.isOn")].map((td) => ({
      r: Number(td.dataset.r),
      c: Number(td.dataset.c),
    }));

    const times = selectedCells.map((x) => `${x.c}-${x.r}`);

    const studyWith = [...item.querySelectorAll('input[data-field="studyWith"]:checked')].map(
      (x) => x.value
    );

    const wantsOtherSections = studyWith.includes("other_sections");
    const section = !wantsOtherSections;
    const gender = false;

    const payload = {
      quarter: ACTIVE_QUARTER,
      class: classIndex,
      slots,
      times,
      section,
      gender,
    };

    console.log("groups-set payload:", { course, payload });

    try {
      await api.groupsSet(payload);
      alert(`Saved preferences for ${course}`);
    } catch (err) {
      console.error("groups-set failed:", err);
      alert("Backend error saving preferences.");
    }
  });
}

async function loadClasses() {
  if (!auth.currentUser) {
    setStatus("Please sign in to load classes.");
    return;
  }

  setStatus(`Loading your classes for ${ACTIVE_QUARTER}…`);

  try {
    const res = await api.classesGet({ quarter: ACTIVE_QUARTER });
    const classes = res?.data || [];
    setStatus("");
    renderClasses(classes);
  } catch (err) {
    console.error("classes-get failed:", err);
    setStatus("Could not load classes from backend.");
    acc.innerHTML = `<div class="miniNote">Backend error loading classes.</div>`;
  }
}

auth.onAuthStateChanged((user) => {
  if (!user) {
    setStatus("Please sign in to load classes.");
    return;
  }
  loadClasses();
});