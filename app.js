const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const calendarGrid = document.getElementById("calendarGrid");
const currentMonthLabel = document.getElementById("currentMonth");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");

const selectedDateLabel = document.getElementById("selectedDateLabel");
const eventForm = document.getElementById("eventForm");
const eventTitleInput = document.getElementById("eventTitle");
const eventMemoInput = document.getElementById("eventMemo");
const eventStartInput = document.getElementById("eventStart");
const eventEndInput = document.getElementById("eventEnd");
const eventList = document.getElementById("eventList");

const eventItemTemplate = document.getElementById("eventItemTemplate");

let currentYear;
let currentMonth; // 0-11
let selectedDate; // Date 객체
let events = {}; // { "YYYY-MM-DD": [ { id, title, memo, start, end } ] }
let editingEventId = null;

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function loadEvents() {
  try {
    const raw = window.localStorage.getItem("schedule-events");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveEvents() {
  window.localStorage.setItem("schedule-events", JSON.stringify(events));
}

function setInitialDate() {
  const today = new Date();
  currentYear = today.getFullYear();
  currentMonth = today.getMonth();
  selectedDate = today;
}

function renderMonthLabel() {
  currentMonthLabel.textContent = `${currentYear}년 ${currentMonth + 1}월`;
}

function buildCalendarDays(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const firstDayIndex = firstOfMonth.getDay();
  const lastOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastOfMonth.getDate();

  const prevLast = new Date(year, month, 0).getDate();

  const cells = [];

  // 헤더
  DAYS.forEach((d) => {
    const header = document.createElement("div");
    header.textContent = d;
    header.className = "day-header";
    cells.push(header);
  });

  // 이전 달 날짜들
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevLast - i;
    const cellDate = new Date(year, month - 1, dayNum);
    cells.push(createDayCell(cellDate, true));
  }

  // 이번 달
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d);
    cells.push(createDayCell(cellDate, false));
  }

  // 다음 달
  while (cells.length % 7 !== 0) {
    const dayNum = cells.length - (7 + firstDayIndex) - daysInMonth + 1;
    const cellDate = new Date(year, month + 1, dayNum);
    cells.push(createDayCell(cellDate, true));
  }

  return cells;
}

function createDayCell(date, isOutside) {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "day-cell";
  if (isOutside) cell.classList.add("outside");

  const label = document.createElement("div");
  label.className = "day-number";

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) {
    const badge = document.createElement("div");
    badge.className = "today-badge";
    badge.textContent = "오늘";
    cell.appendChild(badge);
  } else {
    label.textContent = date.getDate();
    cell.appendChild(label);
  }

  const key = formatDateKey(date);
  const dateEvents = events[key] || [];
  if (dateEvents.length > 0) {
    cell.classList.add("has-events");
    const mini = document.createElement("div");
    mini.className = "mini-event-row";

    const dot = document.createElement("div");
    dot.className = "mini-event-dot";
    mini.appendChild(dot);

    const text = document.createElement("div");
    text.className = "mini-event-text";
    text.textContent = dateEvents[0].title;
    mini.appendChild(text);
    cell.appendChild(mini);
  }

  const isSelected =
    selectedDate &&
    date.getFullYear() === selectedDate.getFullYear() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getDate() === selectedDate.getDate();

  if (isSelected) {
    cell.classList.add("selected");
  }

  cell.addEventListener("click", () => {
    selectedDate = date;
    renderCalendar();
    renderSelectedDate();
    renderEventList();
  });

  return cell;
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  const cells = buildCalendarDays(currentYear, currentMonth);
  cells.forEach((c) => calendarGrid.appendChild(c));
}

function renderSelectedDate() {
  if (!selectedDate) {
    selectedDateLabel.textContent = "날짜를 선택하세요";
    return;
  }
  const key = formatDateKey(selectedDate);
  const weekday = DAYS[selectedDate.getDay()];
  selectedDateLabel.textContent = `${key} (${weekday})`;
}

function renderEventList() {
  eventList.innerHTML = "";
  if (!selectedDate) return;
  const key = formatDateKey(selectedDate);
  const dateEvents = (events[key] || []).slice().sort((a, b) => {
    if (!a.start && !b.start) return 0;
    if (!a.start) return 1;
    if (!b.start) return -1;
    return a.start.localeCompare(b.start);
  });

  if (dateEvents.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-message";
    empty.textContent = "등록된 일정이 없습니다.";
    eventList.appendChild(empty);
    return;
  }

  dateEvents.forEach((ev) => {
    const node = eventItemTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = ev.id;

    const titleEl = node.querySelector(".event-title");
    const timeMemoEl = node.querySelector(".event-time-memo");
    const editBtn = node.querySelector(".edit-btn");
    const deleteBtn = node.querySelector(".delete-btn");

    titleEl.textContent = ev.title;

    const parts = [];
    if (ev.start || ev.end) {
      const t =
        (ev.start || "??:??") + " ~ " + (ev.end || (ev.start ? "" : "??:??"));
      parts.push(t.trim());
    }
    if (ev.memo) {
      parts.push(ev.memo);
    }
    timeMemoEl.textContent = parts.join("\n");

    editBtn.addEventListener("click", () => startEditEvent(ev.id));
    deleteBtn.addEventListener("click", () => deleteEvent(ev.id));

    eventList.appendChild(node);
  });
}

function startEditEvent(id) {
  if (!selectedDate) return;
  const key = formatDateKey(selectedDate);
  const dateEvents = events[key] || [];
  const found = dateEvents.find((e) => e.id === id);
  if (!found) return;

  editingEventId = id;
  eventTitleInput.value = found.title;
  eventMemoInput.value = found.memo || "";
  eventStartInput.value = found.start || "";
  eventEndInput.value = found.end || "";
  eventTitleInput.focus();
}

function deleteEvent(id) {
  if (!selectedDate) return;
  const key = formatDateKey(selectedDate);
  const dateEvents = events[key] || [];
  const next = dateEvents.filter((e) => e.id !== id);
  if (next.length === 0) {
    delete events[key];
  } else {
    events[key] = next;
  }
  saveEvents();
  renderCalendar();
  renderEventList();
}

function handleSubmitEvent(e) {
  e.preventDefault();
  if (!selectedDate) {
    alert("먼저 날짜를 선택하세요.");
    return;
  }

  const title = eventTitleInput.value.trim();
  const memo = eventMemoInput.value.trim();
  const start = eventStartInput.value;
  const end = eventEndInput.value;

  if (!title) {
    alert("일정 제목을 입력하세요.");
    eventTitleInput.focus();
    return;
  }

  const key = formatDateKey(selectedDate);
  if (!events[key]) events[key] = [];

  if (editingEventId) {
    events[key] = events[key].map((ev) =>
      ev.id === editingEventId
        ? {
            ...ev,
            title,
            memo,
            start,
            end,
          }
        : ev
    );
  } else {
    const newEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      memo,
      start,
      end,
    };
    events[key].push(newEvent);
  }

  saveEvents();
  resetForm();
  renderCalendar();
  renderEventList();
}

function resetForm() {
  eventForm.reset();
  editingEventId = null;
}

function changeMonth(offset) {
  currentMonth += offset;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear -= 1;
  } else if (currentMonth > 11) {
    currentMonth = 0;
    currentYear += 1;
  }
  renderMonthLabel();
  renderCalendar();
}

function init() {
  events = loadEvents();
  setInitialDate();
  renderMonthLabel();

  const today = new Date();
  selectedDate = today;
  renderCalendar();
  renderSelectedDate();
  renderEventList();

  prevMonthBtn.addEventListener("click", () => changeMonth(-1));
  nextMonthBtn.addEventListener("click", () => changeMonth(1));
  eventForm.addEventListener("submit", handleSubmitEvent);
}

document.addEventListener("DOMContentLoaded", init);

