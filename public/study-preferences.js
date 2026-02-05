import { auth, functions } from "./firebase.js";


const acc = document.getElementById("classesAccordion");
if (!acc) throw new Error("Accordion not found");

function closeAll() {
  acc.querySelectorAll(".accItem").forEach((item) => item.classList.remove("isOpen"));
}

acc.addEventListener("click", (e) => {
  const header = e.target.closest(".accHeader");
  if (!header) return;

  const item = header.closest(".accItem");
  const isOpen = item.classList.contains("isOpen");

  closeAll();
  if (!isOpen) item.classList.add("isOpen");

  ensureBodyTemplate(item);
  updateSaveLabel(item);
});

function updateSaveLabel(item) {
  const course = item.dataset.course || "Course";
  const btn = item.querySelector(".saveBtn");
  if (btn) btn.textContent = `Save Preferences for ${course}`;
}

function ensureBodyTemplate(item) {
  const body = item.querySelector(".accBody");
  if (!body) return;

  if (body.querySelector(".timeGrid") && body.querySelector(".saveBtn")) {
    wireGridInteractions(item);
    wireSave(item);
    return;
  }

  const course = item.dataset.course || "Course";
  const section = item.dataset.section || "";

  body.innerHTML = `
    <div class="formRow">
      <div class="rowLabel">
        <span class="rowIcon">⏱️</span>
        <div>
          <div class="rowTitle">Hours per week you want to study for this class</div>
        </div>
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
        <div class="gridScroller">
          ${makeGridHTML()}
        </div>
        <div class="gridHint">Tip: drag across cells for faster selection</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="formRow">
      <div class="rowLabel">
        <span class="rowIcon">👤</span>
        <div>
          <div class="rowTitle">Study with</div>
        </div>
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

  wireGridInteractions(item);
  wireSave(item);
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

function wireGridInteractions(item) {
  const grid = item.querySelector(".timeGrid");
  if (!grid) return;

  if (grid.dataset.wired === "1") return;
  grid.dataset.wired = "1";

  let isDragging = false;
  let dragMode = null;        // "on" | "off"
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

  // Start drag
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

  // Paint while dragging
  grid.addEventListener("mouseover", (e) => {
    if (!isDragging) return;

    const td = e.target.closest("td");
    if (!isDataCell(td)) return;

    // if you actually move across cells, it's a drag
    if (td !== startCell) didDrag = true;

    setCell(td, dragMode);
  });

  // Finish interaction:
  // - if no drag happened, treat as a click toggle on the start cell
  // - otherwise do nothing (painting already happened)
  window.addEventListener("mouseup", () => {
    if (!isDragging) return;

    if (!didDrag && startCell) {
      toggleCell(startCell);
    }

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

  btn.addEventListener("click", () => {
    const course = item.dataset.course || "Course";
    const hoursEl = item.querySelector('[data-field="hours"]');
    const hours = hoursEl ? Number(hoursEl.value || 0) : 0;

    const selectedCells = [...item.querySelectorAll(".timeGrid td.isOn")].map((td) => ({
      r: Number(td.dataset.r),
      c: Number(td.dataset.c),
    }));

    const studyWith = [...item.querySelectorAll('input[data-field="studyWith"]:checked')].map(
      (x) => x.value
    );

    const payload = { course, hours, grid: selectedCells, studyWith };
    console.log("Saving prefs:", payload);

    alert(`Saved preferences for ${course}`);
  });
}
