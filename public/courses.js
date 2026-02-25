import { auth, functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const api = {
  classesGet: httpsCallable(functions, "classes-get"),
  classesAdd: httpsCallable(functions, "classes-add"),
  classesDel: httpsCallable(functions, "classes-del"),
  classesSetVis: httpsCallable(functions, "classes-setVis"),
};

const quarters = ["Fall 2025", "Winter 2026", "Spring 2026", "Summer 2026"];
let quarterIdx = 1;

function quarterKey() {
  return quarters[quarterIdx];
}

function setActiveQuarter(q) {
  localStorage.setItem("activeQuarter", q);
}

const quarterTitleEl = document.getElementById("quarterTitle");
const courseListEl = document.getElementById("courseList");

const state = {
  courses: [],
  openCourseId: "",
};

function uiVisToBackend(v) {
  switch (v) {
    case "same_course": return 1;
    case "same_section": return 2;
    case "connections_only": return 4;
    case "nobody": return 5;
    default: return 1;
  }
}
function backendVisToUi(n) {
  switch (n) {
    case 1: return "same_course";
    case 2: return "same_section";
    case 4: return "connections_only";
    case 5: return "nobody";
    default: return "same_course";
  }
}

async function loadCourses() {
  if (!auth.currentUser) return;

  const q = quarterKey();
  setActiveQuarter(q);

  try {
    const res = await api.classesGet({ quarter: q });
    const classes = res.data || [];

    state.courses = classes.map((c, idx) => ({
      id: `c_${idx}`,
      code: c.course || "",
      section: c.section || "",
      visibility: backendVisToUi(c.vis),
      _raw: c, // used for delete
    }));

    state.openCourseId = state.courses[0]?.id || "";
    renderCourses();
  } catch (err) {
    console.error("Failed to load courses:", err);
    courseListEl.innerHTML = `<div class="miniNote">Backend error loading courses.</div>`;
  }
}

function renderCourses() {
  courseListEl.innerHTML = state.courses
    .map((c) => {
      const isOpen = state.openCourseId === c.id;

      return `
        <div class="courseRow ${isOpen ? "isOpen" : ""}" data-course-id="${c.id}">
          <button class="courseHeader" type="button">
            <div>
              <span class="coursePill">${c.code}</span>
              <div>Section ${c.section}</div>
            </div>
            <div class="chev">${isOpen ? "⌃" : "⌄"}</div>
          </button>

          <div class="courseBody">
            <select class="visSelect">
              <option value="same_course" ${c.visibility === "same_course" ? "selected" : ""}>Same Course</option>
              <option value="same_section" ${c.visibility === "same_section" ? "selected" : ""}>Same Section</option>
              <option value="connections_only" ${c.visibility === "connections_only" ? "selected" : ""}>Connections Only</option>
              <option value="nobody" ${c.visibility === "nobody" ? "selected" : ""}>Nobody</option>
            </select>

            <button class="removeBtn" type="button">Remove Course</button>
          </div>
        </div>
      `;
    })
    .join("");

  wireHandlers();
}

function wireHandlers() {
  document.querySelectorAll(".courseRow").forEach((row) => {
    const id = row.dataset.courseId;
    const idx = state.courses.findIndex((c) => c.id === id);
    if (idx === -1) return;

    row.querySelector(".courseHeader")?.addEventListener("click", () => {
      state.openCourseId = state.openCourseId === id ? "" : id;
      renderCourses();
    });

    row.querySelector(".visSelect")?.addEventListener("change", async (e) => {
      const val = e.target.value;
      state.courses[idx].visibility = val;
      renderCourses();

      try {
        await api.classesSetVis({
          quarter: quarterKey(),
          class: idx,
          vis: uiVisToBackend(val),
        });
      } catch (err) {
        console.error("setVis failed:", err);
      }
    });

    row.querySelector(".removeBtn")?.addEventListener("click", async () => {
      if (!confirm(`Remove ${state.courses[idx].code}?`)) return;

      try {
        await api.classesDel({
          quarter: quarterKey(),
          class: state.courses[idx]._raw,
        });
        await loadCourses();
      } catch (err) {
        console.error("delete failed:", err);
      }
    });
  });
}

// Modal (you already have UI; keep it)
const modalBackdrop = document.getElementById("modalBackdrop");
const addCourseBtn = document.getElementById("addCourseBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelAddBtn = document.getElementById("cancelAddBtn");
const confirmAddBtn = document.getElementById("confirmAddBtn");

const courseCodeInput = document.getElementById("courseCodeInput");
const courseNameInput = document.getElementById("courseNameInput");
const sectionInput = document.getElementById("sectionInput");

function openModal() {
  modalBackdrop.classList.add("isOpen");
  modalBackdrop.setAttribute("aria-hidden", "false");
  courseCodeInput.value = "";
  courseNameInput.value = "";
  sectionInput.value = "";
  courseCodeInput.focus();
}
function closeModal() {
  modalBackdrop.classList.remove("isOpen");
  modalBackdrop.setAttribute("aria-hidden", "true");
}

addCourseBtn?.addEventListener("click", openModal);
closeModalBtn?.addEventListener("click", closeModal);
cancelAddBtn?.addEventListener("click", closeModal);
modalBackdrop?.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

confirmAddBtn?.addEventListener("click", async () => {
  const code = (courseCodeInput.value || "").trim();
  const section = (sectionInput.value || "").trim();

  if (!code) return alert("Enter a course code.");
  if (!section) return alert("Enter a section.");

  try {
    await api.classesAdd({
      quarter: quarterKey(),
      class: { course: code, section, vis: 1 },
    });
    closeModal();
    await loadCourses();
  } catch (err) {
    console.error("add failed:", err);
    alert("Backend error adding course.");
  }
});

document.getElementById("prevQuarterBtn")?.addEventListener("click", async () => {
  quarterIdx = (quarterIdx - 1 + quarters.length) % quarters.length;
  const q = quarterKey();
  quarterTitleEl.textContent = q;
  setActiveQuarter(q);
  await loadCourses();
});

document.getElementById("nextQuarterBtn")?.addEventListener("click", async () => {
  quarterIdx = (quarterIdx + 1) % quarters.length;
  const q = quarterKey();
  quarterTitleEl.textContent = q;
  setActiveQuarter(q);
  await loadCourses();
});

auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  const q = quarterKey();
  quarterTitleEl.textContent = q;
  setActiveQuarter(q);
  await loadCourses();
});