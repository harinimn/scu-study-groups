import { auth, functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";


// Firebase callable functions 
const api = {
  send: httpsCallable(functions, "connections-send"),
};

const bc = new BroadcastChannel("scu-study-groups");
function notifyOutgoingAdded(person) {
  bc.postMessage({ type: "connections:outgoing:add", person, ts: Date.now() });
}

const requesting = new Set();

// Quarter nav (stub)
const quarters = ["Fall 2025", "Winter 2026", "Spring 2026", "Summer 2026"];
let quarterIdx = 1;

const quarterTitleEl = document.getElementById("quarterTitle");
document.getElementById("prevQuarterBtn").addEventListener("click", () => {
  quarterIdx = (quarterIdx - 1 + quarters.length) % quarters.length;
  quarterTitleEl.textContent = quarters[quarterIdx];
  closeAllCourseRows();
  renderCourses();
});
document.getElementById("nextQuarterBtn").addEventListener("click", () => {
  quarterIdx = (quarterIdx + 1) % quarters.length;
  quarterTitleEl.textContent = quarters[quarterIdx];
  closeAllCourseRows();
  renderCourses();
});

// State (stub)
const state = {
  courses: [
    {
      id: "c1",
      code: "CSCI 61",
      name: "Data Structures",
      section: "01",
      visibility: "same_course", 
      yourSection: [
        { uid: "u1", name: "Sarah Chen", major: "Computer Science", email: "schen@scu.edu", isConnection: true },
        { uid: "u2", name: "Michael Park", major: "Computer Engineering", email: "mpark@scu.edu", isConnection: false },
        { uid: "u3", name: "Anonymous", major: "", email: "", anonymous: true, isConnection: false },
      ],
      otherSections: [
        { uid: "u4", name: "Emily Johnson", major: "Computer Science", email: "ejohnson@scu.edu", section: "02", isConnection: false },
        { uid: "u5", name: "David Lee", major: "", email: "", section: "02", anonymous: true, isConnection: false },
      ],
    },
    {
      id: "c2",
      code: "MATH 13",
      name: "Calculus III",
      section: "02",
      visibility: "same_course",
      yourSection: [
        { uid: "u9", name: "Marcus Lee", major: "Mathematics", email: "mlee@scu.edu", isConnection: false },
      ],
      otherSections: [
        { uid: "u10", name: "Anonymous", major: "", email: "", section: "01", anonymous: true, isConnection: false },
        { uid: "u11", name: "Priya Nair", major: "Mathematics", email: "pnair@scu.edu", section: "01", isConnection: false },
      ],
    },
  ],
  openCourseId: "c1", 
};

const courseListEl = document.getElementById("courseList");

// Helpers
function initials(name) {
  if (!name) return "A";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "A";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function totalStudents(course) {
  return (course.yourSection?.length || 0) + (course.otherSections?.length || 0);
}

function closeAllCourseRows() {
  state.openCourseId = "";
}

function setOpen(courseId) {
  state.openCourseId = state.openCourseId === courseId ? "" : courseId;
  renderCourses();
}

function escAttr(str) {
  return encodeURIComponent(String(str ?? ""));
}
function unescAttr(str) {
  return decodeURIComponent(String(str ?? ""));
}

// Render
function renderCourses() {
  courseListEl.innerHTML = state.courses
    .map((c) => {
      const isOpen = state.openCourseId === c.id;

      return `
        <div class="courseRow ${isOpen ? "isOpen" : ""}" data-course-id="${c.id}">
          <button class="courseHeader" type="button">
            <div class="courseHeaderLeft">
              <span class="coursePill">${c.code}</span>
              <div class="courseHeaderText">
                <div class="courseName">${c.name || ""}</div>
                <div class="courseMeta">Section ${c.section}</div>
              </div>
            </div>

            <div class="courseHeaderRight">
              <span class="studentPill">${totalStudents(c)} students</span>
              <span class="chev">${isOpen ? "⌃" : "⌄"}</span>
            </div>
          </button>

          <div class="courseBody">
            <div class="visRow">
              <div class="visLabel">
                <span class="eyeIcon">👁️</span>
                <div>
                  <div class="visTitle">Who can see you’re in this course?</div>
                </div>
              </div>

              <select class="selectInput visSelect" data-vis-select>
                <option value="same_course" ${c.visibility === "same_course" ? "selected" : ""}>People in same course</option>
                <option value="same_section" ${c.visibility === "same_section" ? "selected" : ""}>People in my section</option>
                <option value="connections_only" ${c.visibility === "connections_only" ? "selected" : ""}>Connections only</option>
                <option value="nobody" ${c.visibility === "nobody" ? "selected" : ""}>Nobody</option>
              </select>
            </div>

            <div class="subBlock">
              <div class="subTitle">Your Section (${c.section}) - ${c.yourSection.length} students</div>
              <div class="studentList">
                ${c.yourSection.map((s) => studentCardHTML(s, false, c.code)).join("")}
              </div>
            </div>

            <div class="subBlock">
              <div class="subTitle">Other Sections - ${c.otherSections.length} students</div>
              <div class="studentList faint">
                ${c.otherSections.map((s) => studentCardHTML(s, true, c.code)).join("")}
              </div>
            </div>

            <button class="dangerLinkBtn" type="button" data-remove-course>
              🗑️ Remove Course
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  wireCourseRowHandlers();
}

function studentCardHTML(s, showSectionPill = false, courseCode = "") {
  const name = s.anonymous ? "Anonymous" : s.name;
  const email = s.anonymous ? "" : (s.email || "");
  const major = s.major || "";

  const sectionPill =
    showSectionPill && s.section
      ? `<span class="tinyPill gray">Sec ${s.section}</span>`
      : "";

  const isRequested = requesting.has(s.uid);

  let rightAction = "";
  if (s.isConnection) {
    rightAction = `<span class="tinyPill">Connection</span>`;
  } else if (isRequested) {
    rightAction = `<button class="iconBtn" type="button" disabled title="Requested">⏳</button>`;
  } else {
    rightAction = `
      <button
        class="iconBtn green btn-connect"
        type="button"
        data-uid="${s.uid}"
        data-name="${escAttr(name)}"
        data-major="${escAttr(major)}"
        data-email="${escAttr(email)}"
        data-course="${escAttr(courseCode)}"
        title="Connect"
      >👤+</button>
    `;
  }

  return `
    <div class="studentCard">
      <div class="avatarCircle small">${initials(name)}</div>

      <div class="studentMain">
        <div class="studentTopRow">
          <div class="studentName">${name}</div>
          <div class="studentBadges">${sectionPill}</div>
        </div>
        ${major ? `<div class="studentMeta">${major}</div>` : ""}
        ${email ? `<div class="studentEmail">${email}</div>` : ""}
      </div>

      <div class="studentActions">
        ${rightAction}
      </div>
    </div>
  `;
}

// Wiring
function wireCourseRowHandlers() {
  document.querySelectorAll(".courseRow").forEach((row) => {
    const id = row.dataset.courseId;

    row.querySelector(".courseHeader")?.addEventListener("click", () => setOpen(id));

    // visibility select 
    row.querySelector("[data-vis-select]")?.addEventListener("change", (e) => {
      const val = e.target.value;
      const course = state.courses.find((x) => x.id === id);
      if (!course) return;
      course.visibility = val;
    });

    // remove course
    row.querySelector("[data-remove-course]")?.addEventListener("click", () => {
      const course = state.courses.find((x) => x.id === id);
      if (!course) return;
      if (!confirm(`Remove ${course.code}?`)) return;

      state.courses = state.courses.filter((x) => x.id !== id);
      if (state.openCourseId === id) state.openCourseId = "";
      renderCourses();
    });
  });

  // Connect buttons: call backend & broadcast to connections page
  document.querySelectorAll(".btn-connect").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetUid = btn.dataset.uid;
      if (!targetUid) return;

      if (!auth.currentUser) {
        alert("Please sign in first.");
        return;
      }

      const name = unescAttr(btn.dataset.name || "Anonymous");
      const major = unescAttr(btn.dataset.major || "");
      const email = unescAttr(btn.dataset.email || "");
      const course = unescAttr(btn.dataset.course || "");

      requesting.add(targetUid);
      renderCourses();

      try {
        await api.send({ id: targetUid });

        notifyOutgoingAdded({
          id: targetUid,
          name,
          major,
          email,
          courses: course ? [course] : [],
          initials: initials(name),
        });
      } catch (err) {
        console.error(err);
        requesting.delete(targetUid);
        renderCourses();
        alert("Failed to send request (backend error).");
      }
    });
  });
}

// Add Course modal (stub)
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

addCourseBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
cancelAddBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

confirmAddBtn.addEventListener("click", () => {
  const code = (courseCodeInput.value || "").trim();
  const name = (courseNameInput.value || "").trim();
  const section = (sectionInput.value || "").trim();

  if (!code) return alert("Enter a course code.");
  if (!section) return alert("Enter a section.");

  state.courses.unshift({
    id: `c_${Date.now()}`,
    code,
    name,
    section,
    visibility: "same_course",
    yourSection: [],
    otherSections: [],
  });

  state.openCourseId = state.courses[0].id;
  closeModal();
  renderCourses();
});

// Auth boot
auth.onAuthStateChanged((user) => {
  if (!user) {
    console.log("Not logged in (courses page)");
    return;
  }
  console.log("Logged in as:", user.email);
});

// initial render
quarterTitleEl.textContent = quarters[quarterIdx];
renderCourses();
