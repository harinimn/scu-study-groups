import { auth, functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

/* Firebase Callables */
const api = {
  classesGet: httpsCallable(functions, "classes-get"),
  classesAdd: httpsCallable(functions, "classes-add"),
  classesDel: httpsCallable(functions, "classes-del"),
  classesSetVis: httpsCallable(functions, "classes-setVis"),
  classesListSection: httpsCallable(functions, "classes-listSection"),
  classesListCourse: httpsCallable(functions, "classes-listCourse"),
  sendConnection: httpsCallable(functions, "connections-send"),
};

/* Quarter Handling */
const quarters = ["Fall 2025", "Winter 2026", "Spring 2026", "Summer 2026"];

//later change this
const CURRENT_QUARTER = "Winter 2026";

const savedQuarter = localStorage.getItem("activeQuarter");
let quarterIdx = quarters.indexOf(savedQuarter);
if (quarterIdx === -1) quarterIdx = 1;

function quarterKey() {
  return quarters[quarterIdx];
}

function setActiveQuarter(q) {
  localStorage.setItem("activeQuarter", q);
}

/* DOM */
const quarterTitleEl = document.getElementById("quarterTitle");
const courseListEl = document.getElementById("courseList");

/* Cross-page sync (for connections page) */
const bc = new BroadcastChannel("scu-study-groups");

function notifyOutgoingAdded(person) {
  bc.postMessage({
    type: "connections:outgoing:add",
    person,
    ts: Date.now(),
  });
}

/* State */
const state = {
  courses: [],
  openCourseId: "",
  requesting: new Set(),
};

/* Helpers */
function uiVisToBackend(v) {
  switch (v) {
    case "same_course":
      return 1;
    case "same_section":
      return 2;
    case "connections_only":
      return 4;
    case "nobody":
      return 5;
    default:
      return 1;
  }
}

function backendVisToUi(n) {
  switch (n) {
    case 1:
      return "same_course";
    case 2:
      return "same_section";
    case 4:
      return "connections_only";
    case 5:
      return "nobody";
    default:
      return "same_course";
  }
}

function initials(name) {
  if (!name) return "A";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "A";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function escAttr(str) {
  return encodeURIComponent(String(str ?? ""));
}

function unescAttr(str) {
  return decodeURIComponent(String(str ?? ""));
}

function normalizePerson(p) {
  const person = p || {};
  return {
    id: person.id || "",
    name: person.name || "Anonymous",
    major: person.major || "",
    email: person.email || "",
    courses: Array.isArray(person.courses) ? person.courses : [],
    initials: person.initials || initials(person.name || "Anonymous"),
  };
}

/* Backend loading */
async function loadCourses() {
  if (!auth.currentUser) return;

  const q = quarterKey();
  setActiveQuarter(q);

  try {
    const res = await api.classesGet({ quarter: q });
    const classes = res?.data || [];

    const fields = [
      ["name", "Anonymous"],
      ["major", ""],
      ["email", ""],
      ["courses", []],
    ];

    const enrichedCourses = await Promise.all(
      classes.map(async (c, idx) => {
        let sameSection = [];
        let otherSections = [];

        try {
          const [sectionRes, courseRes] = await Promise.all([
            api.classesListSection({
              quarter: q,
              cur: CURRENT_QUARTER,
              class: idx,
              fields,
            }),
            api.classesListCourse({
              quarter: q,
              cur: CURRENT_QUARTER,
              class: idx,
              fields,
            }),
          ]);

          sameSection = (sectionRes?.data || []).map(normalizePerson);
          otherSections = (courseRes?.data || []).map(normalizePerson);
        } catch (listErr) {
          console.error(`Failed loading classmates for ${c.course}`, listErr);
        }

        return {
          id: `c_${idx}`,
          code: c.course || "",
          section: c.section || "",
          visibility: backendVisToUi(c.vis),
          _raw: c,
          sameSection,
          otherSections,
        };
      })
    );

    state.courses = enrichedCourses;
    state.openCourseId = state.courses[0]?.id || "";
    renderCourses();
  } catch (err) {
    console.error("Failed to load courses:", err);
    courseListEl.innerHTML = `<div class="miniNote">Backend error loading courses.</div>`;
  }
}

/* Rendering */
function renderStudentCard(p, courseCode = "") {
  const isRequested = state.requesting.has(p.id);

  let actionHTML = `
    <button
      class="iconBtn green btn-connect"
      type="button"
      data-id="${escAttr(p.id)}"
      data-name="${escAttr(p.name)}"
      data-major="${escAttr(p.major)}"
      data-email="${escAttr(p.email)}"
      data-course="${escAttr(courseCode)}"
      title="Connect"
    >👤+</button>
  `;

  if (!p.id) {
    actionHTML = `<span class="tinyPill gray">Unavailable</span>`;
  } else if (isRequested) {
    actionHTML = `<button class="iconBtn" type="button" disabled title="Requested">⏳</button>`;
  }

  return `
    <div class="studentCard">
      <div class="avatarCircle small">${p.initials}</div>

      <div class="studentMain">
        <div class="studentTopRow">
          <div class="studentName">${p.name}</div>
        </div>
        ${p.major ? `<div class="studentMeta">${p.major}</div>` : ""}
        ${p.email ? `<div class="studentEmail">${p.email}</div>` : ""}
      </div>

      <div class="studentActions">
        ${actionHTML}
      </div>
    </div>
  `;
}

function renderCourses() {
  if (!state.courses.length) {
    courseListEl.innerHTML = `<div class="miniNote">No courses yet for ${quarterKey()}.</div>`;
    return;
  }

  courseListEl.innerHTML = state.courses
    .map((c) => {
      const isOpen = state.openCourseId === c.id;

      return `
        <div class="courseRow ${isOpen ? "isOpen" : ""}" data-course-id="${c.id}">
          <button class="courseHeader" type="button">
            <div>
              <span class="coursePill">${c.code}</span>
              <div>Section ${c.section || "—"}</div>
            </div>
            <div class="chev">${isOpen ? "⌃" : "⌄"}</div>
          </button>

          <div class="courseBody">
            <div class="visRow">
              <div class="miniLabel">Who can see you in this course?</div>
              <select class="visSelect">
                <option value="same_course" ${c.visibility === "same_course" ? "selected" : ""}>Same Course</option>
                <option value="same_section" ${c.visibility === "same_section" ? "selected" : ""}>Same Section</option>
                <option value="connections_only" ${c.visibility === "connections_only" ? "selected" : ""}>Connections Only</option>
                <option value="nobody" ${c.visibility === "nobody" ? "selected" : ""}>Nobody</option>
              </select>
            </div>

            <div class="subBlock">
              <div class="subTitle">Same Section (${c.sameSection.length})</div>
              <div class="studentList">
                ${
                  c.sameSection.length
                    ? c.sameSection.map((p) => renderStudentCard(p, c.code)).join("")
                    : `<div class="miniNote">No visible classmates in this section.</div>`
                }
              </div>
            </div>

            <div class="subBlock">
              <div class="subTitle">Other Sections (${c.otherSections.length})</div>
              <div class="studentList faint">
                ${
                  c.otherSections.length
                    ? c.otherSections.map((p) => renderStudentCard(p, c.code)).join("")
                    : `<div class="miniNote">No visible classmates in other sections.</div>`
                }
              </div>
            </div>

            <button class="removeBtn" type="button">Remove Course</button>
          </div>
        </div>
      `;
    })
    .join("");

  wireHandlers();
}

/* Handlers */
function wireHandlers() {
  document.querySelectorAll(".courseRow").forEach((row) => {
    const id = row.dataset.courseId;
    const idx = state.courses.findIndex((c) => c.id === id);
    if (idx === -1) return;
    row.querySelector(".courseHeader")?.addEventListener("click", () => {
      state.openCourseId = state.openCourseId === id ? "" : id;
      renderCourses();
    });

    // visibility
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
        alert("Backend error saving visibility.");
      }
    });

    // remove
    row.querySelector(".removeBtn")?.addEventListener("click", async () => {
      if (!confirm(`Remove ${state.courses[idx].code}?`)) return;

      try {
        await api.classesDel({
          quarter: quarterKey(),
          class: idx,
        });

        await loadCourses();
      } catch (err) {
        console.error("delete failed:", err);
        alert("Backend error removing course.");
      }
    });
  });

  // connect buttons
  document.querySelectorAll(".btn-connect").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = unescAttr(btn.dataset.id || "");
      if (!targetId) return;

      if (!auth.currentUser) {
        alert("Please sign in first.");
        return;
      }

      const name = unescAttr(btn.dataset.name || "Anonymous");
      const major = unescAttr(btn.dataset.major || "");
      const email = unescAttr(btn.dataset.email || "");
      const course = unescAttr(btn.dataset.course || "");

      state.requesting.add(targetId);
      renderCourses();

      try {
        await api.sendConnection({ id: targetId });

        notifyOutgoingAdded({
          id: targetId,
          name,
          major,
          email,
          courses: course ? [course] : [],
          initials: initials(name),
        });
      } catch (err) {
        console.error("sendConnection failed:", err);
        state.requesting.delete(targetId);
        renderCourses();
        alert("Backend error sending connection request.");
      }
    });
  });
}

/* Modal */
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

/* Quarter nav */
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

/* Boot */
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  const q = quarterKey();
  quarterTitleEl.textContent = q;
  setActiveQuarter(q);
  await loadCourses();
});