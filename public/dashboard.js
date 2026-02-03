const suggested = [
  {
    course: "CSCI 61",
    title: "Data Structures",
    day: "Monday, Jan 6",
    time: "2:00 PM - 4:00 PM",
    location: "Library Study Room 204",
    members: 4,
    match: 95,
  },
  {
    course: "MATH 13",
    title: "Calculus I",
    day: "Wednesday, Jan 8",
    time: "4:00 PM - 6:00 PM",
    location: "O'Connor Hall Room 112",
    members: 5,
    match: 88,
  },
  {
    course: "CSCI 61",
    title: "Data Structures",
    day: "Thursday, Jan 9",
    time: "10:00 AM - 12:00 PM",
    location: "Alameda Hall Room 139",
    members: 3,
    match: 82,
  },
  {
    course: "PHIL 26",
    title: "Ethics",
    day: "Friday, Jan 10",
    time: "1:00 PM - 3:00 PM",
    location: "Library Study Room 201",
    members: 6,
    match: 78,
  },
];

const myGroups = [
  { course: "CSCI 61", name: "Data Structures Study Squad", next: "Tomorrow at 3:00 PM - 5:00 PM", members: 5 },
  { course: "MATH 13", name: "Calculus Study Sessions", next: "Friday at 1:00 PM - 3:00 PM", members: 4 },
  { course: "PHIL 26", name: "Ethics Discussion", next: "Friday at 1:00 PM - 3:00 PM", members: 6 },
];

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

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
    actions.append(
      el("div", "matchPill", `${g.match}% match`)
    );

    const joinBtn = el("button", "btnPrimary", "Join");
    joinBtn.type = "button";
    joinBtn.addEventListener("click", () => {
      const joined = suggested.splice(idx, 1)[0];
      myGroups.unshift({
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
    left.append(el("div", "coursePill", g.course));
    left.append(el("div", "groupName", g.name));
    const next = el("div", "nextLine");
    next.append(el("span", null, "⏱️"), el("span", null, `Next: ${g.next}`));
    left.append(next);

    const members = el("div", "memberCount");
    members.append(el("span", null, "👥"), el("span", null, String(g.members)));

    row.append(left, members);
    wrap.append(row);
  });
}

renderSuggested();
renderMyGroups();
