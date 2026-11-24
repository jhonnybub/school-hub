// SchoolHub.js
// וידג׳ט Scriptable למערכת של כיתה ט׳3
//
// התקנה:
// 1. פתחו את Scriptable, לחצו +, הדביקו את הקובץ, שמרו בשם SchoolHub
// 2. לחיצה ארוכה על מסך הבית → הוספת וידג׳ט Scriptable
//    Edit Widget → Script: SchoolHub, When Interacting: Run Script
//
// האתר: https://jhonnybub.github.io/school-hub/

const SITE_URL = "https://jhonnybub.github.io/school-hub/";
const SCHEDULE_URL = SITE_URL + "data/schedule.json";
const BASE_URL = SITE_URL + "data/base_schedule.json";
const EXAMS_URL = SITE_URL + "data/exams.json";
const CACHE_NAME = "schoolhub-widget-cache.json";
const TZ = "Asia/Jerusalem";
const CLASS_NAME = "ט׳3";

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HE_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const EXAM_TYPES = { EXAM: true, QUIZ: true };
const TYPE_LABELS = { EXAM: "מבחן", QUIZ: "בוחן", EVENT: "אירוע", VACATION: "חופשה" };

// Built-in bell schedule. Daft's data often has start/end = null; fill by 1-based period.
const BELL_SCHEDULE = {
  1: { start: "08:30", end: "09:15" },
  2: { start: "09:15", end: "10:05" },
  3: { start: "10:20", end: "11:05" },
  4: { start: "11:05", end: "11:50" },
  5: { start: "12:10", end: "12:55" },
  6: { start: "12:55", end: "13:40" },
  7: { start: "13:55", end: "14:40" },
  8: { start: "14:40", end: "15:25" },
  9: { start: "15:30", end: "16:15" },
};

const COLOR = {
  bgLight: "#FFFFFF",
  bgDark: "#000000",
  textLight: "#000000",
  textDark: "#FFFFFF",
  secondaryLight: "#6B6B6B",
  secondaryDark: "#8E8E93",
  lineLight: "#EEEEEE",
  lineDark: "#2C2C2E",
  red: "#E10600",
};

// ---------------------------------------------------------------------------
// Date / time helpers (mirror index.html, Asia/Jerusalem)
// ---------------------------------------------------------------------------

function heQuotes(v) {
  return String(v ?? "").replace(/'/g, "׳").replace(/"/g, "״");
}

function timeText(value) {
  if (value == null || value === false) return "";
  const text = String(value).trim();
  if (!text || /^(null|undefined|none|n\/a)$/i.test(text)) return "";
  return text;
}

function parseISODate(value) {
  if (!value || typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { iso: `${m[1]}-${m[2]}-${m[3]}`, y: +m[1], mo: +m[2], d: +m[3] };
}

function addDays(iso, n) {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + n));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function weekdayIndex(iso) {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

function weekdayName(iso) {
  return WEEKDAYS[weekdayIndex(iso)];
}

function hebrewDayLetter(iso) {
  return HE_LETTERS[weekdayIndex(iso)];
}

function isWeekend(iso) {
  const i = weekdayIndex(iso);
  return i === 5 || i === 6;
}

function todayIsrael(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now instanceof Date ? now : new Date());
  return parts;
}

function nowIsrael(now) {
  const d = now instanceof Date ? now : new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type).value;
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    minute,
    minutes: hour * 60 + minute,
  };
}

function parseTimeMinutes(value) {
  const text = timeText(value);
  if (!text) return null;
  const m = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function dateAtMinutes(iso, minutes, fromDate) {
  const [y, mo, d] = iso.split("-").map(Number);
  const probe = fromDate instanceof Date ? fromDate : new Date(`${iso}T12:00:00`);
  const clock = nowIsrael(probe);
  const utcMs = probe.getTime() + (minutes - clock.minutes) * 60 * 1000;
  const probeIso = clock.date;
  const dayDelta = Math.round(
    (Date.UTC(y, mo - 1, d) - (() => {
      const [py, pm, pd] = probeIso.split("-").map(Number);
      return Date.UTC(py, pm - 1, pd);
    })()) / 86400000
  );
  return new Date(utcMs + dayDelta * 86400000);
}

function bellFor(num) {
  const n = Number(num);
  if (!Number.isInteger(n) || n < 1) return null;
  return BELL_SCHEDULE[n] || null;
}

function fillLessonTimes(lesson, index) {
  if (!lesson || typeof lesson !== "object") return lesson;
  const num = lesson.num != null && lesson.num !== "" ? Number(lesson.num) : (index + 1);
  const bells = bellFor(num);
  const start = timeText(lesson.start) || (bells && bells.start) || "";
  const end = timeText(lesson.end) || (bells && bells.end) || "";
  return Object.assign({}, lesson, { num, start: start || null, end: end || null });
}

function formatLessonTime(lesson) {
  const start = timeText(lesson && lesson.start);
  const end = timeText(lesson && lesson.end);
  if (start && end) return `${start}–${end}`;
  return start || end || "";
}

function formatRoom(room) {
  const r = String(room || "").trim();
  if (!r) return "";
  if (/^חדר\b/.test(r)) return r;
  if (/^\d+$/.test(r)) return `חדר ${r}`;
  return heQuotes(r);
}

function firstName(teacher) {
  const t = heQuotes(String(teacher || "").trim());
  if (!t) return "";
  return t.split(/\s+/)[0];
}

function lessonFlag(lesson) {
  if (!lesson || typeof lesson !== "object") return "";
  const truthy = (v) => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";
  const raw = lesson.status || lesson.flag || lesson.state || lesson.change_type || "";
  const text = String(raw).trim();
  const lower = text.toLowerCase();
  const cancelledWords = ["cancelled", "canceled", "cancel", "בוטל"];
  if (
    truthy(lesson.cancelled) || truthy(lesson.canceled) ||
    cancelledWords.includes(lower) || text === "בוטל"
  ) return "בוטל";
  if (
    truthy(lesson.changed) || truthy(lesson.substituted) ||
    lower === "changed" || lower === "change" ||
    lower === "substituted" || lower === "substitution" ||
    text === "שינוי"
  ) return "שינוי";
  if (typeof lesson.change === "boolean" && lesson.change) return "שינוי";
  if (typeof lesson.change === "string") {
    const c = lesson.change.trim();
    if (c && !["false", "0", "no"].includes(c.toLowerCase())) {
      return cancelledWords.includes(c.toLowerCase()) || c === "בוטל" ? "בוטל" : "שינוי";
    }
  }
  return "";
}

function normalizeSchedule(raw) {
  if (!raw) return null;
  let result = null;
  if (Array.isArray(raw)) {
    result = { class: raw[0] && raw[0].class, days: raw };
  } else if (Array.isArray(raw.days)) {
    result = { class: raw.class || raw.class_name, days: raw.days };
  } else if (raw.lessons || raw.date) {
    result = { class: raw.class || raw.class_name, days: [raw] };
  }
  if (!result) return null;
  result.days = (result.days || []).map((day) => {
    if (!day || typeof day !== "object") return day;
    const lessons = Array.isArray(day.lessons) ? day.lessons.map(fillLessonTimes) : day.lessons;
    return Object.assign({}, day, { lessons });
  });
  return result;
}

function normalizeExams(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return { events: raw };
  const events = raw.events || raw.exams;
  if (!Array.isArray(events)) return null;
  return { events };
}

function daysUntil(iso, today) {
  const a = parseISODate(iso), b = parseISODate(today);
  if (!a || !b) return 0;
  return Math.round(Date.UTC(a.y, a.mo - 1, a.d) - Date.UTC(b.y, b.mo - 1, b.d)) / 86400000;
}

function daysUntilLabel(iso, today) {
  const delta = daysUntil(iso, today);
  if (delta === 0) return "היום";
  if (delta === 1) return "מחר";
  if (delta === -1) return "אתמול";
  if (delta > 1) return `בעוד ${delta} ימים`;
  return `לפני ${Math.abs(delta)} ימים`;
}

function examSubject(item) {
  const type = String((item && item.type) || "").toUpperCase();
  const fallback = (item && item.typeLabel) || TYPE_LABELS[type] || type || "מבחן";
  const title = String((item && (item.title || item.subject)) || fallback).trim();
  const parts = title.split(/\s+[—–-]\s+/);
  return heQuotes((parts[0] || title).trim());
}

function examKindWord(item) {
  const type = String((item && item.type) || "").toUpperCase();
  if (type === "QUIZ") return "בוחן";
  return "מבחן";
}

function listExamEvents(exams) {
  const raw = !exams ? [] : (Array.isArray(exams) ? exams : (exams.events || exams.exams || []));
  return raw
    .map((item) => ({ date: (parseISODate(item.eventDate || item.date) || {}).iso, item }))
    .filter((x) => x.date && EXAM_TYPES[String((x.item.type || "").toUpperCase())])
    .sort((a, b) => a.date.localeCompare(b.date));
}

function examOnDay(exams, iso) {
  if (!iso) return null;
  const hit = listExamEvents(exams).find((x) => x.date === iso);
  return hit ? { date: hit.date, item: hit.item, subject: examSubject(hit.item), kind: examKindWord(hit.item) } : null;
}

function upcomingExam(exams, todayIso) {
  const hit = listExamEvents(exams).find((x) => x.date >= todayIso);
  if (!hit) return null;
  const delta = daysUntil(hit.date, todayIso);
  return {
    date: hit.date,
    item: hit.item,
    subject: examSubject(hit.item),
    kind: examKindWord(hit.item),
    delta,
    countdown: daysUntilLabel(hit.date, todayIso),
    urgent: delta >= 0 && delta < 3,
  };
}

function parseWeekCell(cell) {
  return String(cell || "").split(/\s+\/\s+/).map((part) => part.trim()).filter(Boolean).map((part) => {
    const m = part.match(/^(.*?)\s*\((.*)\)\s*$/);
    const subject = heQuotes((m ? m[1] : part).trim());
    const bits = m ? m[2].split(",").map((b) => b.trim()).filter(Boolean) : [];
    return {
      subject,
      teacher: firstName(bits[0] || ""),
      room: heQuotes(bits.slice(1).join(", ")),
    };
  });
}

function parseDailyGroups(lesson) {
  if (Array.isArray(lesson.groups) && lesson.groups.length) return lesson.groups;
  const subjects = String(lesson.subject || "").split("/").map((s) => heQuotes(s.trim())).filter(Boolean);
  const teachers = String(lesson.teacher || "").split("/").map((s) => firstName(s.trim())).filter(Boolean);
  const rooms = String(lesson.room || "").split("/").map((s) => heQuotes(s.trim())).filter(Boolean);
  const n = Math.max(subjects.length, 1);
  const groups = [];
  for (let i = 0; i < n; i++) {
    groups.push({
      subject: subjects[i] || subjects[0] || "שיעור",
      teacher: teachers[i] || (n === 1 ? (teachers[0] || "") : ""),
      room: rooms[i] || (n === 1 ? (rooms[0] || "") : ""),
    });
  }
  return groups;
}

function subjectLine(lesson) {
  const names = [];
  parseDailyGroups(lesson).forEach((g) => {
    if (g.subject && names.indexOf(g.subject) === -1) names.push(g.subject);
  });
  return names.join(" / ") || "שיעור";
}

function roomLine(lesson) {
  const rooms = [];
  parseDailyGroups(lesson).forEach((g) => {
    const r = formatRoom(g.room);
    if (r && rooms.indexOf(r) === -1) rooms.push(r);
  });
  return rooms.join(" / ");
}

function dayFromBase(base, iso) {
  if (!base || !base.days) return null;
  const letter = hebrewDayLetter(iso);
  const dayMap = base.days[letter] || {};
  const lessons = Object.keys(dayMap)
    .map((k) => [Number(k), dayMap[k]])
    .filter(([num, cell]) => Number.isInteger(num) && num >= 1 && String(cell || "").trim())
    .sort((a, b) => a[0] - b[0])
    .map(([num, cell], i) => {
      const groups = parseWeekCell(cell);
      const subjects = groups.map((g) => g.subject);
      const teachers = groups.map((g) => g.teacher);
      const rooms = groups.map((g) => g.room);
      const uniqueRooms = rooms.filter((r, idx) => r && rooms.indexOf(r) === idx);
      const raw = {
        num,
        start: null,
        end: null,
        subject: subjects.join("/"),
        teacher: teachers.filter(Boolean).join("/"),
        room: uniqueRooms.length === 1 ? uniqueRooms[0] : (uniqueRooms.join("/") || null),
        status: null,
        groups,
      };
      return fillLessonTimes(raw, i);
    });
  return {
    date: iso,
    class: (base && base.class) || CLASS_NAME,
    lessons,
    source: "base",
  };
}

function findLiveDay(schedule, iso) {
  const norm = normalizeSchedule(schedule);
  if (!norm) return null;
  const day = (norm.days || []).find((d) => {
    const p = parseISODate(d && d.date);
    return p && p.iso === iso;
  });
  if (!day) return null;
  const lessons = (day.lessons || []).filter((l) => Number(l.num) >= 1);
  return Object.assign({}, day, { lessons, source: "live" });
}

function dayForIso(iso, schedule, base) {
  const live = findLiveDay(schedule, iso);
  if (live && (live.lessons || []).length) return live;
  const fromBase = dayFromBase(base, iso);
  if (fromBase && fromBase.lessons.length) return fromBase;
  return live || fromBase || null;
}

function nextSchoolDate(iso) {
  let d = addDays(iso, 1);
  for (let i = 0; i < 8; i++) {
    if (!isWeekend(d)) return d;
    d = addDays(d, 1);
  }
  return addDays(iso, 1);
}

function isDayOver(day, dayIso, now) {
  const clock = nowIsrael(now);
  if (!day || !dayIso || dayIso !== clock.date) return false;
  const ends = (day.lessons || [])
    .map((lesson, i) => fillLessonTimes(lesson, Number(lesson && lesson.num) ? Number(lesson.num) - 1 : i))
    .filter((lesson) => lessonFlag(lesson) !== "בוטל")
    .map((lesson) => parseTimeMinutes(lesson.end))
    .filter((m) => m != null);
  if (!ends.length) return false;
  return clock.minutes >= Math.max(...ends);
}

function annotateLessons(day, now) {
  const clock = nowIsrael(now);
  const iso = day && day.date;
  const isToday = iso && iso === clock.date;
  const lessons = ((day && day.lessons) || []).map((lesson, i) => {
    const filled = fillLessonTimes(lesson, Number(lesson && lesson.num) ? Number(lesson.num) - 1 : i);
    const flag = lessonFlag(filled);
    const start = parseTimeMinutes(filled.start);
    const end = parseTimeMinutes(filled.end);
    const cancelled = flag === "בוטל";
    const done = isToday && !cancelled && end != null && clock.minutes >= end;
    const current = isToday && !cancelled && !done && start != null && end != null &&
      clock.minutes >= start && clock.minutes < end;
    return Object.assign({}, filled, {
      flag,
      cancelled,
      done,
      current,
      isNext: false,
      startMins: start,
      endMins: end,
      subjectText: subjectLine(filled),
      roomText: roomLine(filled),
      startText: timeText(filled.start),
      endText: timeText(filled.end),
      timeText: formatLessonTime(filled),
    });
  });
  if (isToday) {
    const next = lessons.find((l) => !l.cancelled && !l.done && !l.current && l.startMins != null && clock.minutes < l.startMins) || null;
    if (next) next.isNext = true;
  } else if (lessons.length) {
    // Upcoming day: no 'הבא' mark and no bold-next (the tag has no meaning there).
  }
  return lessons;
}

function firstActive(lessons) {
  return (lessons || []).find((l) => !l.cancelled) || (lessons && lessons[0]) || null;
}

function headerTitle(todayIso, targetIso) {
  const name = weekdayName(targetIso);
  if (targetIso === todayIso) return `היום · ${name}`;
  if (targetIso === addDays(todayIso, 1)) return `מחר · ${name}`;
  return `יום ${name}`;
}

function dayBounds(lessons) {
  const list = lessons || [];
  const first = list[0];
  const last = list.length ? list[list.length - 1] : null;
  const lastActive = [...list].reverse().find((l) => !l.cancelled) || last;
  return {
    firstStart: (first && first.startText) || "",
    lastEnd: (lastActive && lastActive.endText) || (last && last.endText) || "",
    count: list.length,
  };
}

function nextBoundaryDate(lessons, todayIso, now) {
  const clock = nowIsrael(now);
  const d = now instanceof Date ? now : new Date();
  const plus30 = new Date(d.getTime() + 30 * 60 * 1000);
  if (!lessons || !lessons.length) return plus30;
  const candidates = [];
  lessons.forEach((l) => {
    if (l.cancelled) return;
    if (l.current && l.endMins != null) candidates.push(l.endMins);
    if (!l.done && !l.current && l.startMins != null && l.startMins > clock.minutes) {
      candidates.push(l.startMins);
    }
  });
  if (!candidates.length) return plus30;
  const nextMins = Math.min.apply(null, candidates);
  const at = dateAtMinutes(todayIso, nextMins, d);
  if (!(at instanceof Date) || isNaN(at.getTime())) return plus30;
  if (at.getTime() <= d.getTime() + 30 * 1000) return plus30;
  return at;
}

function lessonRowData(l, showingToday) {
  return {
    num: l.num,
    subject: l.subjectText,
    start: l.startText,
    end: l.endText,
    time: l.timeText,
    room: l.roomText,
    flag: l.flag || "",
    cancelled: !!l.cancelled,
    done: !!l.done,
    current: !!l.current,
    next: !!l.isNext,
    emphasize: !!(showingToday && l.isNext),
  };
}

function buildModel(now, schedule, base, exams) {
  const clock = nowIsrael(now);
  const todayIso = clock.date;
  const todayDay = dayForIso(todayIso, schedule, base);
  const todayOver = isWeekend(todayIso) || !todayDay || !(todayDay.lessons || []).length || isDayOver(todayDay, todayIso, now);

  let targetIso;
  let showingToday = false;
  if (isWeekend(todayIso) || todayOver) {
    targetIso = nextSchoolDate(todayIso);
    showingToday = false;
  } else {
    targetIso = todayIso;
    showingToday = true;
  }

  const day = dayForIso(targetIso, schedule, base);
  const lessons = day ? annotateLessons(day, now) : [];
  const current = lessons.find((l) => l.current) || null;
  const next = lessons.find((l) => l.isNext) || null;
  const focus = current || next || firstActive(lessons);
  const bounds = dayBounds(lessons);
  const onDayExam = examOnDay(exams, targetIso);
  const nextExam = upcomingExam(exams, todayIso);

  let refreshAt;
  if (showingToday) refreshAt = nextBoundaryDate(lessons, todayIso, now);
  else {
    const d = now instanceof Date ? now : new Date();
    refreshAt = new Date(d.getTime() + 30 * 60 * 1000);
  }

  const header = headerTitle(todayIso, targetIso);
  const range = bounds.firstStart && bounds.lastEnd ? `${bounds.firstStart}–${bounds.lastEnd}` : (bounds.firstStart || "");
  const countLine = bounds.count ? `${bounds.count} שיעורים · עד ${bounds.lastEnd}` : "";
  const startLine = bounds.firstStart ? `מתחילים ב־${bounds.firstStart} · ${bounds.count} שיעורים` : "";

  // Small anchor: first-lesson start, or current/next start when today is in session.
  let anchorStart = bounds.firstStart;
  let anchorSubject = focus ? focus.subjectText : "";
  let anchorFlag = focus ? (focus.flag || "") : "";
  let anchorCancelled = !!(focus && focus.cancelled);
  if (showingToday && focus) {
    anchorStart = focus.startText || anchorStart;
    anchorSubject = focus.subjectText;
    anchorFlag = focus.flag || "";
    anchorCancelled = !!focus.cancelled;
  }

  const smallExam = onDayExam ? `${onDayExam.kind} ב${onDayExam.subject}` : "";

  return {
    todayIso,
    targetIso,
    showingToday,
    afterSchool: !showingToday,
    weekday: weekdayName(targetIso),
    header,
    range,
    count: bounds.count,
    countLine,
    startLine,
    firstStart: bounds.firstStart,
    lastEnd: bounds.lastEnd,
    anchorStart,
    anchorSubject,
    anchorFlag,
    anchorCancelled,
    smallExam,
    onDayExam,
    nextExam,
    focus,
    current,
    next,
    lessons,
    rows: lessons.map((l) => lessonRowData(l, showingToday)),
    source: (day && day.source) || (lessons.length ? "live" : "none"),
    className: (day && day.class) || CLASS_NAME,
    empty: !lessons.length,
    refreshAt,
    clock,
  };
}

function smallView(model) {
  return {
    size: "small",
    header: model.header,
    time: model.anchorStart || "",
    subject: model.anchorSubject || (model.empty ? "אין שיעורים" : ""),
    flag: model.anchorFlag || "",
    cancelled: !!model.anchorCancelled,
    footer: model.smallExam || model.countLine || "",
    footerIsExam: !!model.smallExam,
  };
}

function mediumView(model) {
  const all = model.rows || [];
  const overflow = all.length > 4 ? all.length - 4 : 0;
  const rows = all.slice(0, 4);
  return {
    size: "medium",
    header: model.header,
    range: model.range,
    rows,
    overflow,
    overflowLabel: overflow ? `⁦+${overflow}⁩ נוספים` : "",
    empty: !all.length,
  };
}

function largeView(model) {
  const all = model.rows || [];
  const compact = all.length > 7;
  return {
    size: "large",
    header: model.header,
    startLine: model.startLine,
    rows: all.slice(0, 8),
    compact,
    showRoom: (row) => !!(row.room && row.subject.length <= 24),
    exam: model.nextExam || null,
    empty: !all.length,
  };
}

function describeModel(model) {
  return { small: smallView(model), medium: mediumView(model), large: largeView(model), model };
}

// ---------------------------------------------------------------------------
// Scriptable I/O and widget UI
// ---------------------------------------------------------------------------

function dynColor(lightHex, darkHex) {
  if (typeof Color === "undefined") return lightHex;
  return Color.dynamic(new Color(lightHex), new Color(darkHex));
}

function theme() {
  return {
    bg: dynColor(COLOR.bgLight, COLOR.bgDark),
    text: dynColor(COLOR.textLight, COLOR.textDark),
    secondary: dynColor(COLOR.secondaryLight, COLOR.secondaryDark),
    line: dynColor(COLOR.lineLight, COLOR.lineDark),
    red: typeof Color !== "undefined" ? new Color(COLOR.red) : COLOR.red,
  };
}

function fontRegular(size) { return Font.systemFont(size); }
function fontBold(size) { return Font.boldSystemFont(size); }
function fontSemibold(size) {
  if (typeof Font.semiboldSystemFont === "function") return Font.semiboldSystemFont(size);
  return Font.boldSystemFont(size);
}

function cachePath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), CACHE_NAME);
}

function readCache() {
  try {
    const fm = FileManager.local();
    const p = cachePath();
    if (!fm.fileExists(p)) return null;
    return JSON.parse(fm.readString(p));
  } catch (e) {
    return null;
  }
}

function writeCache(schedule, base, exams) {
  try {
    const fm = FileManager.local();
    fm.writeString(cachePath(), JSON.stringify({
      savedAt: new Date().toISOString(),
      schedule,
      base,
      exams,
    }));
  } catch (e) {}
}

async function fetchJson(url) {
  const sep = url.indexOf("?") >= 0 ? "&" : "?";
  const req = new Request(url + sep + "t=" + Date.now());
  req.timeoutInterval = 15;
  return await req.loadJSON();
}

async function loadData() {
  let schedule = null, base = null, exams = null;
  try { schedule = await fetchJson(SCHEDULE_URL); } catch (e) { schedule = null; }
  try { base = await fetchJson(BASE_URL); } catch (e) { base = null; }
  try { exams = await fetchJson(EXAMS_URL); } catch (e) { exams = null; }
  if (schedule || base || exams) {
    const cached = readCache() || {};
    writeCache(schedule || cached.schedule || null, base || cached.base || null, exams || cached.exams || null);
    return {
      schedule: schedule || cached.schedule || null,
      base: base || cached.base || null,
      exams: exams || cached.exams || null,
      fromCache: !schedule || !base,
    };
  }
  const cached = readCache();
  if (cached && (cached.schedule || cached.base || cached.exams)) {
    return { schedule: cached.schedule || null, base: cached.base || null, exams: cached.exams || null, fromCache: true };
  }
  return { schedule: null, base: null, exams: null, fromCache: false };
}

function addRightText(stack, str, opts) {
  const t = stack.addText(String(str || ""));
  t.rightAlignText();
  if (opts.font) t.font = opts.font;
  if (opts.color) t.textColor = opts.color;
  t.lineLimit = opts.lineLimit || 1;
  if (typeof opts.scale === "number") t.minimumScaleFactor = opts.scale;
  return t;
}

function addDivider(widget, t, width) {
  const line = widget.addStack();
  line.layoutHorizontally();
  line.backgroundColor = t.line;
  line.size = new Size(width, 1);
  return line;
}

function addLessonRow(parent, row, t, fonts, showRoom) {
  const stack = parent.addStack();
  stack.layoutHorizontally();
  stack.centerAlignContent();

  const left = stack.addStack();
  left.layoutHorizontally();
  left.centerAlignContent();
  if (showRoom && row.room) {
    const room = left.addText(row.room);
    room.font = fonts.room;
    room.textColor = t.secondary;
    room.lineLimit = 1;
    room.minimumScaleFactor = 0.8;
    left.addSpacer(5);
  }
  if (row.start) {
    const time = left.addText(row.start);
    time.font = fonts.time;
    time.textColor = t.secondary;
    time.lineLimit = 1;
  }

  stack.addSpacer();

  if (row.flag) {
    const tag = stack.addText(row.flag);
    tag.font = fonts.flag;
    tag.textColor = t.red;
    tag.lineLimit = 1;
    stack.addSpacer(5);
  }
  const sub = stack.addText(row.subject);
  sub.font = row.emphasize ? fonts.subjectBold : fonts.subject;
  sub.textColor = (row.cancelled || row.done) ? t.secondary : t.text;
  sub.lineLimit = 1;
  sub.minimumScaleFactor = 0.8;
  sub.rightAlignText();
  return stack;
}

function contentWidth(family) {
  if (family === "small") return 170 - 32;
  return 364 - 32;
}

function buildSmallWidget(widget, model, t) {
  const v = smallView(model);
  widget.setPadding(16, 16, 16, 16);
  addRightText(widget, v.header, { font: fontSemibold(13), color: t.secondary });
  widget.addSpacer(6);
  addRightText(widget, v.time || "—", { font: fontBold(34), color: t.text, scale: 0.7 });
  widget.addSpacer(2);
  if (v.flag) {
    const row = widget.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    row.addSpacer();
    const tag = row.addText(v.flag);
    tag.font = fontSemibold(13);
    tag.textColor = t.red;
    tag.lineLimit = 1;
    row.addSpacer(5);
    const sub = row.addText(v.subject);
    sub.font = fontSemibold(17);
    sub.textColor = v.cancelled ? t.secondary : t.text;
    sub.lineLimit = 1;
    sub.minimumScaleFactor = 0.8;
    sub.rightAlignText();
  } else {
    addRightText(widget, v.subject, {
      font: fontSemibold(17),
      color: v.cancelled ? t.secondary : t.text,
      scale: 0.8,
    });
  }
  widget.addSpacer();
  if (v.footer) {
    addRightText(widget, v.footer, {
      font: v.footerIsExam ? fontSemibold(13) : fontRegular(13),
      color: v.footerIsExam ? t.red : t.secondary,
      scale: 0.8,
    });
  }
}

function buildMediumWidget(widget, model, t) {
  const v = mediumView(model);
  widget.setPadding(16, 16, 16, 16);
  const head = widget.addStack();
  head.layoutHorizontally();
  head.centerAlignContent();
  if (v.range) {
    const range = head.addText(v.range);
    range.font = fontRegular(15);
    range.textColor = t.secondary;
    range.lineLimit = 1;
  }
  head.addSpacer();
  const title = head.addText(v.header);
  title.font = fontBold(17);
  title.textColor = t.text;
  title.lineLimit = 1;
  title.rightAlignText();
  widget.addSpacer(10);

  if (v.empty) {
    addRightText(widget, "אין שיעורים", { font: fontSemibold(16), color: t.secondary });
    widget.addSpacer();
    return;
  }

  const fonts = {
    subject: fontSemibold(16),
    subjectBold: fontBold(16),
    time: fontRegular(14),
    room: fontRegular(13),
    flag: fontSemibold(13),
  };
  v.rows.forEach((row, i) => {
    if (i > 0) widget.addSpacer();
    addLessonRow(widget, row, t, fonts, false);
    if (i === v.rows.length - 1 && v.overflowLabel) {
      const over = widget.addStack();
      over.layoutHorizontally();
      over.addSpacer();
      const lab = over.addText(v.overflowLabel);
      lab.font = fontRegular(13);
      lab.textColor = t.secondary;
      lab.lineLimit = 1;
    }
  });
}

function buildLargeWidget(widget, model, t) {
  const v = largeView(model);
  widget.setPadding(16, 16, 16, 16);
  addRightText(widget, v.header, { font: fontBold(24), color: t.text, scale: 0.8 });
  if (v.startLine) {
    widget.addSpacer(4);
    addRightText(widget, v.startLine, { font: fontRegular(15), color: t.secondary, scale: 0.8 });
  }
  widget.addSpacer(14);

  if (v.empty) {
    addRightText(widget, "אין שיעורים", { font: fontSemibold(19), color: t.secondary });
    widget.addSpacer();
    return;
  }

  const subSize = v.compact ? 17 : 19;
  const timeSize = v.compact ? 15 : 16;
  const fonts = {
    subject: fontSemibold(subSize),
    subjectBold: fontBold(subSize),
    time: fontRegular(timeSize),
    room: fontRegular(13),
    flag: fontSemibold(13),
  };
  v.rows.forEach((row, i) => {
    if (i > 0) widget.addSpacer();
    const showRoom = !!(row.room && row.subject.length <= 24);
    addLessonRow(widget, row, t, fonts, showRoom);
  });

  if (v.exam) {
    widget.addSpacer();
    addDivider(widget, t, contentWidth("large"));
    widget.addSpacer(10);
    addRightText(widget, "מבחן הבא", { font: fontSemibold(13), color: t.secondary });
    widget.addSpacer(4);
    const row = widget.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    const count = row.addText(v.exam.countdown);
    count.font = fontRegular(14);
    count.textColor = v.exam.urgent ? t.red : t.secondary;
    count.lineLimit = 1;
    row.addSpacer();
    const sub = row.addText(v.exam.subject);
    sub.font = fontSemibold(16);
    sub.textColor = t.text;
    sub.lineLimit = 1;
    sub.minimumScaleFactor = 0.8;
    sub.rightAlignText();
  }
}

function createWidget(family, model) {
  const widget = new ListWidget();
  const t = theme();
  widget.backgroundColor = t.bg;
  widget.url = SITE_URL;
  if (model.refreshAt instanceof Date && !isNaN(model.refreshAt.getTime())) {
    widget.refreshAfterDate = model.refreshAt;
  }
  const size = family || "small";
  if (size === "medium") buildMediumWidget(widget, model, t);
  else if (size === "large" || size === "extraLarge") buildLargeWidget(widget, model, t);
  else buildSmallWidget(widget, model, t);
  return widget;
}

function errorWidget(message) {
  const widget = new ListWidget();
  const t = theme();
  widget.backgroundColor = t.bg;
  widget.url = SITE_URL;
  widget.setPadding(16, 16, 16, 16);
  const title = widget.addText("SchoolHub");
  title.font = fontBold(15);
  title.textColor = t.text;
  title.rightAlignText();
  widget.addSpacer(6);
  const body = widget.addText(message || "אין נתונים כרגע");
  body.font = fontRegular(13);
  body.textColor = t.secondary;
  body.rightAlignText();
  body.lineLimit = 4;
  widget.addSpacer();
  return widget;
}

async function main() {
  let model;
  try {
    const data = await loadData();
    const now = new Date();
    model = buildModel(now, data.schedule, data.base, data.exams);
    if (model.empty && !data.schedule && !data.base) {
      const w = errorWidget("אין נתונים. פתחו את האפליקציה או נסו שוב כשיש רשת.");
      if (typeof config !== "undefined" && config.runsInWidget) Script.setWidget(w);
      else if (typeof Safari !== "undefined") Safari.open(SITE_URL);
      else if (typeof Script !== "undefined") Script.setWidget(w);
      if (typeof Script !== "undefined") Script.complete();
      return model;
    }
  } catch (e) {
    const w = errorWidget("לא הצלחתי לטעון את המערכת.");
    if (typeof Script !== "undefined") {
      if (typeof config !== "undefined" && config.runsInWidget) Script.setWidget(w);
      else if (typeof Safari !== "undefined") Safari.open(SITE_URL);
      Script.complete();
    }
    throw e;
  }

  const family = (typeof config !== "undefined" && config.widgetFamily) || "small";
  const widget = createWidget(family, model);

  if (typeof Script !== "undefined") {
    if (typeof config !== "undefined" && config.runsInWidget) {
      Script.setWidget(widget);
    } else if (typeof Safari !== "undefined") {
      Safari.open(SITE_URL);
    } else {
      Script.setWidget(widget);
    }
    Script.complete();
  }
  return model;
}

// --- runner ---
if (typeof Script !== "undefined") {
  main();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SITE_URL,
    BELL_SCHEDULE,
    todayIsrael,
    nowIsrael,
    addDays,
    weekdayName,
    hebrewDayLetter,
    fillLessonTimes,
    parseWeekCell,
    lessonFlag,
    normalizeSchedule,
    normalizeExams,
    dayFromBase,
    dayForIso,
    nextSchoolDate,
    isDayOver,
    examOnDay,
    upcomingExam,
    daysUntilLabel,
    buildModel,
    smallView,
    mediumView,
    largeView,
    describeModel,
    main,
  };
}
