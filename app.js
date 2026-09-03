import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const membersCol = collection(db, "members");

const SESSIONS = [
  { key: "drum", label: "드럼" },
  { key: "bass", label: "베이스" },
  { key: "guitar", label: "일렉기타" },
  { key: "vocal_f", label: "보컬(여)" },
  { key: "vocal_m", label: "보컬(남)" },
];
const SESSION_LABEL = Object.fromEntries(SESSIONS.map((s) => [s.key, s.label]));

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 9); // 09시 ~ 23시 (각 1시간)

const slotKey = (day, hour) => `${day}_${hour}`;

// ---- state ----
let me = loadMe(); // { id, name, session } | null
let membersData = new Map(); // id -> { name, session, slots }

// ---- dom refs ----
const meInfoEl = document.getElementById("me-info");
const editMeBtn = document.getElementById("edit-me-btn");
const modal = document.getElementById("identity-modal");
const nameInput = document.getElementById("name-input");
const sessionSelect = document.getElementById("session-select");
const saveMeBtn = document.getElementById("save-me-btn");
const leaveBtn = document.getElementById("leave-btn");
const gridEl = document.getElementById("grid");
const summaryListEl = document.getElementById("summary-list");
const memberGroupsEl = document.getElementById("member-groups");

function loadMe() {
  const raw = localStorage.getItem("band-schedule-me");
  return raw ? JSON.parse(raw) : null;
}

function saveMe(next) {
  me = next;
  localStorage.setItem("band-schedule-me", JSON.stringify(me));
}

function clearMe() {
  me = null;
  localStorage.removeItem("band-schedule-me");
}

// ---- identity modal ----
function openModal({ allowLeave }) {
  nameInput.value = me?.name ?? "";
  sessionSelect.value = me?.session ?? "drum";
  leaveBtn.classList.toggle("hidden", !allowLeave);
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

editMeBtn.addEventListener("click", () => openModal({ allowLeave: true }));

saveMeBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const session = sessionSelect.value;
  if (!name) {
    nameInput.focus();
    return;
  }
  const id = me?.id ?? crypto.randomUUID();
  const existingSlots = membersData.get(id)?.slots ?? {};
  saveMe({ id, name, session });
  await setDoc(doc(membersCol, id), {
    name,
    session,
    slots: existingSlots,
    updatedAt: serverTimestamp(),
  });
  closeModal();
  renderMeBox();
});

leaveBtn.addEventListener("click", async () => {
  if (!me) return;
  if (!confirm("밴드 목록에서 나가시겠습니까? 내가 표시한 가능 시간도 모두 삭제됩니다.")) return;
  await deleteDoc(doc(membersCol, me.id));
  clearMe();
  closeModal();
  renderMeBox();
});

function renderMeBox() {
  if (!me) {
    meInfoEl.textContent = "";
    return;
  }
  meInfoEl.innerHTML = `<b>${escapeHtml(me.name)}</b> · ${SESSION_LABEL[me.session]}`;
}

// ---- grid skeleton ----
function buildGridSkeleton() {
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.appendChild(document.createElement("th"));
  DAYS.forEach((d) => {
    const th = document.createElement("th");
    th.textContent = d;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  gridEl.appendChild(thead);

  const tbody = document.createElement("tbody");
  HOURS.forEach((hour) => {
    const row = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = `${String(hour).padStart(2, "0")}:00`;
    row.appendChild(th);

    DAYS.forEach((day) => {
      const td = document.createElement("td");
      td.className = "cell";
      td.dataset.day = day;
      td.dataset.hour = String(hour);

      const dotsWrap = document.createElement("div");
      dotsWrap.className = "cell-dots";
      SESSIONS.forEach((s) => {
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.dataset.session = s.key;
        dotsWrap.appendChild(dot);
      });
      td.appendChild(dotsWrap);

      td.addEventListener("click", () => toggleMySlot(day, hour));
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  gridEl.appendChild(tbody);
}

async function toggleMySlot(day, hour) {
  if (!me) {
    openModal({ allowLeave: false });
    return;
  }
  const key = slotKey(day, hour);
  const mine = membersData.get(me.id) ?? { name: me.name, session: me.session, slots: {} };
  const nextValue = !mine.slots[key];

  // optimistic local update so it feels instant
  mine.slots = { ...mine.slots, [key]: nextValue };
  membersData.set(me.id, mine);
  renderAll();

  await updateDoc(doc(membersCol, me.id), {
    [`slots.${key}`]: nextValue,
    updatedAt: serverTimestamp(),
  });
}

// ---- rendering ----
function computeSlotAvailability(day, hour) {
  const key = slotKey(day, hour);
  const namesBySession = Object.fromEntries(SESSIONS.map((s) => [s.key, []]));
  membersData.forEach((m) => {
    if (m.slots && m.slots[key] && namesBySession[m.session]) {
      namesBySession[m.session].push(m.name);
    }
  });
  const fullBand = SESSIONS.every((s) => namesBySession[s.key].length > 0);
  return { namesBySession, fullBand };
}

function renderGridCells() {
  gridEl.querySelectorAll("td.cell").forEach((td) => {
    const day = td.dataset.day;
    const hour = Number(td.dataset.hour);
    const key = slotKey(day, hour);
    const { namesBySession, fullBand } = computeSlotAvailability(day, hour);

    const mine = me && membersData.get(me.id)?.slots?.[key];
    td.classList.toggle("full-band", fullBand);
    td.classList.toggle("mine", Boolean(mine));

    const tooltipLines = SESSIONS.filter((s) => namesBySession[s.key].length > 0).map(
      (s) => `${s.label}: ${namesBySession[s.key].join(", ")}`
    );
    td.title = tooltipLines.length ? tooltipLines.join("\n") : "가능한 멤버 없음";

    SESSIONS.forEach((s) => {
      const dotEl = td.querySelector(`.dot[data-session="${s.key}"]`);
      dotEl.classList.toggle("on", namesBySession[s.key].length > 0);
    });
  });
}

function renderSummary() {
  const fullBandSlots = [];
  DAYS.forEach((day) => {
    HOURS.forEach((hour) => {
      if (computeSlotAvailability(day, hour).fullBand) {
        fullBandSlots.push({ day, hour });
      }
    });
  });

  if (fullBandSlots.length === 0) {
    summaryListEl.innerHTML =
      '<span class="muted">아직 전 세션이 동시에 가능한 시간이 없습니다.</span>';
    return;
  }

  summaryListEl.innerHTML = fullBandSlots
    .map((s) => `<span class="summary-chip">${s.day} ${String(s.hour).padStart(2, "0")}:00</span>`)
    .join("");
}

function renderMemberList() {
  const groups = Object.fromEntries(SESSIONS.map((s) => [s.key, []]));
  membersData.forEach((m, id) => {
    if (groups[m.session]) groups[m.session].push({ id, name: m.name });
  });

  memberGroupsEl.innerHTML = SESSIONS.map((s) => {
    const members = groups[s.key];
    const items = members.length
      ? members
          .map(
            (m) =>
              `<div class="member-name ${m.id === me?.id ? "self" : ""}">${escapeHtml(m.name)}</div>`
          )
          .join("")
      : '<div class="member-name muted">-</div>';
    return `
      <div class="member-group">
        <div class="member-group-title"><i class="dot" data-session="${s.key}"></i>${s.label}</div>
        ${items}
      </div>`;
  }).join("");
}

function renderAll() {
  renderGridCells();
  renderSummary();
  renderMemberList();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---- realtime subscription ----
function subscribe() {
  onSnapshot(membersCol, (snapshot) => {
    membersData = new Map();
    snapshot.forEach((docSnap) => {
      membersData.set(docSnap.id, docSnap.data());
    });
    renderAll();
  });
}

// ---- init ----
function init() {
  buildGridSkeleton();
  subscribe();
  renderMeBox();
  if (!me) {
    openModal({ allowLeave: false });
  }
}

init();
