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
const CACHE_NAME = "schoolhub-widget-cache.json";
const TZ = "Asia/Jerusalem";
const CLASS_NAME = "ט׳3";

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HE_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

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
  mutedLight: "#6B6B6B",
  mutedDark: "#A3A3A3",
  cancelledLight: "#9A9A9A",
  cancelledDark: "#7A7A7A",
  lineLight: "#EEEEEE",
  lineDark: "#2A2A2A",
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

function minutesToHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dateAtMinutes(iso, minutes, fromDate) {
  const [y, mo, d] = iso.split("-").map(Number);
  // Build a Date in Asia/Jerusalem for iso + HH:MM.
  // Use the offset of fromDate (or a noon probe) so DST is correct.
  const probe = fromDate instanceof Date ? fromDate : new Date(`${iso}T12:00:00`);
  const clock = nowIsrael(probe);
  const utcMs = probe.getTime() + (minutes - clock.minutes) * 60 * 1000;
  // Adjust the calendar date if the probe isn't the same iso (rare).
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
  // Already first names in the data ("לין", "קרן"). Drop any leftover last name.
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

// Weekly cell: "ספרדית (אינה, ט'3) / פיזיולוגיה של המאמץ (בתיה)"
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
  const groups = parseDailyGroups(lesson);
  const names = [];
  groups.forEach((g) => {
    if (g.subject && names.indexOf(g.subject) === -1) names.push(g.subject);
  });
  return names.join(" / ") || "שיעור";
}

function teacherLine(lesson) {
  const names = [];
  parseDailyGroups(lesson).forEach((g) => {
    const t = firstName(g.teacher);
    if (t && names.indexOf(t) === -1) names.push(t);
  });
  return names.join(" / ");
}

function roomLine(lesson) {
  const rooms = [];
  parseDailyGroups(lesson).forEach((g) => {
    const r = formatRoom(g.room);
    if (r && rooms.indexOf(r) === -1) rooms.push(r);
  });
  return rooms.join(" / ");
}

function metaLine(lesson, opts) {
  const parts = [];
  const time = formatLessonTime(lesson);
  if (time) parts.push(time);
  const room = roomLine(lesson);
  if (room) parts.push(room);
  if (opts && opts.teacher) {
    const t = teacherLine(lesson);
    if (t) parts.push(t);
  }
  return parts.join(" · ");
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

function isLessonDone(lesson, dayIso, now) {
  const clock = nowIsrael(now);
  if (!dayIso || dayIso !== clock.date) return false;
  if (lessonFlag(lesson) === "בוטל") return false;
  const end = parseTimeMinutes(lesson && lesson.end);
  if (end == null) return false;
  return clock.minutes >= end;
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
      teacherText: teacherLine(filled),
      roomText: roomLine(filled),
      timeText: formatLessonTime(filled),
      metaText: "",
    });
  });
  let next = null;
  if (isToday) {
    next = lessons.find((l) => !l.cancelled && !l.done && !l.current && l.startMins != null && clock.minutes < l.startMins) || null;
    if (next) next.isNext = true;
  } else if (lessons.length) {
    const first = lessons.find((l) => !l.cancelled) || null;
    if (first) first.isNext = true;
  }
  lessons.forEach((l) => {
    l.metaText = metaLine(l, { teacher: false });
  });
  return lessons;
}

function firstActive(lessons) {
  return (lessons || []).find((l) => !l.cancelled) || null;
}

function remainingLessons(lessons, limit) {
  const list = (lessons || []).filter((l) => !l.done);
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

function relativeDayLabel(targetIso, todayIso) {
  if (targetIso === todayIso) return "היום";
  if (targetIso === addDays(todayIso, 1)) return "מחר";
  return `יום ${weekdayName(targetIso)}`;
}

function startHint(targetIso, todayIso, first) {
  const start = first && timeText(first.start);
  if (!start) {
    return targetIso === addDays(todayIso, 1) ? "אין לימודים מחר" : `אין לימודים ביום ${weekdayName(targetIso)}`;
  }
  if (targetIso === addDays(todayIso, 1)) return `מחר מתחילים ב-${start}`;
  return `ביום ${weekdayName(targetIso)} מתחילים ב-${start}`;
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
    if (l.current && l.endMins != null) {
      // already added end
    }
  });
  // Also refresh at the end of a just-ended lesson's successor already covered.
  if (!candidates.length) return plus30;
  const nextMins = Math.min.apply(null, candidates);
  const at = dateAtMinutes(todayIso, nextMins, d);
  if (!(at instanceof Date) || isNaN(at.getTime())) return plus30;
  // If the boundary is in the past or too soon (< 30s), fall back.
  if (at.getTime() <= d.getTime() + 30 * 1000) return plus30;
  return at;
}

function buildModel(now, schedule, base) {
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
  const remaining = remainingLessons(lessons, 5);
  const afterSchool = !showingToday;

  let label = "";
  if (showingToday && current) label = "עכשיו";
  else if (showingToday && next) label = "הבא";

  const header = showingToday
    ? `היום · ${weekdayName(todayIso)}`
    : (targetIso === addDays(todayIso, 1)
      ? `מחר · ${weekdayName(targetIso)}`
      : `יום ${weekdayName(targetIso)}`);

  const hint = afterSchool ? startHint(targetIso, todayIso, firstActive(lessons)) : "";

  let refreshAt;
  if (showingToday) {
    refreshAt = nextBoundaryDate(lessons, todayIso, now);
  } else {
    const d = now instanceof Date ? now : new Date();
    refreshAt = new Date(d.getTime() + 30 * 60 * 1000);
  }

  return {
    todayIso,
    targetIso,
    showingToday,
    afterSchool,
    weekday: weekdayName(targetIso),
    header,
    label,
    startHint: hint,
    focus,
    current,
    next,
    lessons,
    remaining,
    source: (day && day.source) || (lessons.length ? "live" : "none"),
    className: (day && day.class) || CLASS_NAME,
    empty: !lessons.length,
    refreshAt,
    clock,
  };
}

function smallView(model) {
  if (model.empty) {
    return {
      size: "small",
      header: model.header,
      label: "",
      title: "אין שיעורים",
      subtitle: model.afterSchool ? model.startHint : "",
      detail: "",
    };
  }
  if (model.afterSchool) {
    const f = model.focus;
    return {
      size: "small",
      header: model.header,
      label: "",
      title: model.startHint,
      subtitle: f ? f.subjectText : "",
      detail: f ? [f.timeText, f.roomText].filter(Boolean).join(" · ") : "",
    };
  }
  const f = model.focus;
  return {
    size: "small",
    header: model.header,
    label: model.label,
    title: f ? f.subjectText : "אין שיעורים",
    subtitle: f ? f.timeText : "",
    detail: f ? [f.roomText, f.teacherText].filter(Boolean).join(" · ") : "",
  };
}

function listView(model, size, limit) {
  const rows = (size === "large" ? model.lessons : model.remaining).slice(0, limit);
  return {
    size,
    header: model.header,
    label: model.afterSchool ? model.startHint : (model.label || ""),
    sourceNote: model.source === "base" ? "מערכת קבועה" : "",
    rows: rows.map((l) => ({
      num: l.num,
      subject: l.subjectText,
      meta: [l.timeText, l.roomText].filter(Boolean).join(" · "),
      teacher: l.teacherText,
      flag: l.flag,
      current: !!l.current,
      next: !!l.isNext,
      done: !!l.done,
      cancelled: !!l.cancelled,
    })),
    empty: !rows.length,
  };
}

function describeModel(model) {
  const small = smallView(model);
  const medium = listView(model, "medium", 5);
  const large = listView(model, "large", 12);
  return { small, medium, large, model };
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
    muted: dynColor(COLOR.mutedLight, COLOR.mutedDark),
    cancelled: dynColor(COLOR.cancelledLight, COLOR.cancelledDark),
    line: dynColor(COLOR.lineLight, COLOR.lineDark),
    red: typeof Color !== "undefined" ? new Color(COLOR.red) : COLOR.red,
  };
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

function writeCache(schedule, base) {
  try {
    const fm = FileManager.local();
    fm.writeString(cachePath(), JSON.stringify({
      savedAt: new Date().toISOString(),
      schedule,
      base,
    }));
  } catch (e) {
    // ignore cache write errors
  }
}

async function fetchJson(url) {
  const sep = url.indexOf("?") >= 0 ? "&" : "?";
  const req = new Request(url + sep + "t=" + Date.now());
  req.timeoutInterval = 15;
  return await req.loadJSON();
}

async function loadData() {
  let schedule = null;
  let base = null;
  let fromCache = false;
  try {
    schedule = await fetchJson(SCHEDULE_URL);
  } catch (e) {
    schedule = null;
  }
  try {
    base = await fetchJson(BASE_URL);
  } catch (e) {
    base = null;
  }
  if (schedule || base) {
    const cached = readCache() || {};
    writeCache(schedule || cached.schedule || null, base || cached.base || null);
    return {
      schedule: schedule || cached.schedule || null,
      base: base || cached.base || null,
      fromCache: !schedule || !base,
    };
  }
  const cached = readCache();
  if (cached && (cached.schedule || cached.base)) {
    return { schedule: cached.schedule || null, base: cached.base || null, fromCache: true };
  }
  return { schedule: null, base: null, fromCache: false };
}

function addAlignedText(stack, str, opts) {
  const t = stack.addText(String(str || ""));
  t.rightAlignText();
  if (opts.font) t.font = opts.font;
  if (opts.color) t.textColor = opts.color;
  if (opts.lineLimit) t.lineLimit = opts.lineLimit;
  if (typeof opts.opacity === "number") t.textOpacity = opts.opacity;
  return t;
}

function addHeaderRow(widget, model, t, fonts, withDot) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.addSpacer();
  const label = model.afterSchool ? "" : model.label;
  const head = label || model.header;
  const showDot = withDot && (model.showingToday || !!label);
  if (showDot) {
    const dot = row.addText("●");
    dot.font = fonts.dot;
    dot.textColor = t.red;
    row.addSpacer(4);
  }
  addAlignedText(row, head, { font: fonts.label, color: label ? t.text : t.muted, lineLimit: 1 });
}

function buildSmallWidget(widget, model, t, fonts) {
  const v = smallView(model);
  widget.setPadding(12, 14, 12, 14);
  addHeaderRow(widget, model, t, fonts, true);
  widget.addSpacer(6);
  addAlignedText(widget, v.title, { font: fonts.title, color: t.text, lineLimit: 3 });
  if (v.subtitle) {
    widget.addSpacer(3);
    addAlignedText(widget, v.subtitle, { font: fonts.sub, color: t.text, lineLimit: 2 });
  }
  if (v.detail) {
    widget.addSpacer(2);
    addAlignedText(widget, v.detail, { font: fonts.meta, color: t.muted, lineLimit: 1 });
  }
  widget.addSpacer();
}

function buildListWidget(widget, model, t, fonts, size) {
  const limit = size === "large" ? 12 : 5;
  const v = listView(model, size, limit);
  const pad = size === "large" ? 14 : 12;
  widget.setPadding(pad, 16, 12, 16);
  addHeaderRow(widget, model, t, fonts, true);
  if (model.afterSchool && model.startHint) {
    widget.addSpacer(2);
    addAlignedText(widget, model.startHint, { font: fonts.meta, color: t.muted, lineLimit: 1 });
  }
  if (v.sourceNote && model.afterSchool) {
    addAlignedText(widget, v.sourceNote, { font: fonts.tiny, color: t.muted, lineLimit: 1 });
  }
  widget.addSpacer(6);
  if (v.empty) {
    addAlignedText(widget, "אין שיעורים", { font: fonts.sub, color: t.muted, lineLimit: 1 });
    widget.addSpacer();
    return;
  }
  v.rows.forEach((r, i) => {
    if (i > 0) widget.addSpacer(size === "large" ? 5 : 4);
    const row = widget.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();

    // LTR stack, RTL-friendly visual: time on the left, subject + number on the right.
    if (r.meta) {
      const meta = row.addText(r.meta);
      meta.font = fonts.tiny;
      meta.textColor = t.muted;
      meta.lineLimit = 1;
    }
    row.addSpacer();

    if (r.flag) {
      const tag = row.addText(r.flag);
      tag.font = fonts.tiny;
      tag.textColor = r.cancelled ? t.cancelled : t.red;
      tag.lineLimit = 1;
      row.addSpacer(4);
    }
    if (r.current || r.next) {
      const mark = row.addText(r.current ? "עכשיו" : "הבא");
      mark.font = fonts.tiny;
      mark.textColor = t.red;
      mark.lineLimit = 1;
      row.addSpacer(4);
    }
    const sub = row.addText(r.subject);
    sub.font = r.current ? fonts.rowBold : fonts.row;
    sub.textColor = r.cancelled || r.done ? t.cancelled : t.text;
    sub.lineLimit = 1;
    if (r.cancelled || r.done) sub.textOpacity = 0.7;
    row.addSpacer(6);
    const num = row.addText(String(r.num));
    num.font = fonts.num;
    num.textColor = t.muted;
    num.lineLimit = 1;
  });
  widget.addSpacer();
}

function fontsFor(family) {
  const small = family === "small";
  return {
    label: Font.boldSystemFont(small ? 11 : 12),
    title: Font.boldSystemFont(small ? 16 : 18),
    sub: Font.systemFont(small ? 13 : 14),
    meta: Font.systemFont(12),
    row: Font.systemFont(14),
    rowBold: Font.boldSystemFont(14),
    num: Font.systemFont(12),
    tiny: Font.systemFont(10),
    dot: Font.systemFont(8),
  };
}

function createWidget(family, model) {
  const widget = new ListWidget();
  const t = theme();
  widget.backgroundColor = t.bg;
  widget.url = SITE_URL;
  if (model.refreshAt instanceof Date && !isNaN(model.refreshAt.getTime())) {
    widget.refreshAfterDate = model.refreshAt;
  }
  const fonts = fontsFor(family);
  if (family === "medium") buildListWidget(widget, model, t, fonts, "medium");
  else if (family === "large" || family === "extraLarge") buildListWidget(widget, model, t, fonts, "large");
  else buildSmallWidget(widget, model, t, fonts);
  return widget;
}

function errorWidget(message) {
  const widget = new ListWidget();
  const t = theme();
  widget.backgroundColor = t.bg;
  widget.url = SITE_URL;
  widget.setPadding(14, 16, 14, 16);
  const title = widget.addText("SchoolHub");
  title.font = Font.boldSystemFont(14);
  title.textColor = t.text;
  title.rightAlignText();
  widget.addSpacer(6);
  const body = widget.addText(message || "אין נתונים כרגע");
  body.font = Font.systemFont(13);
  body.textColor = t.muted;
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
    model = buildModel(now, data.schedule, data.base);
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
    parseDailyGroups,
    lessonFlag,
    normalizeSchedule,
    dayFromBase,
    dayForIso,
    nextSchoolDate,
    isDayOver,
    buildModel,
    smallView,
    listView,
    describeModel,
    main,
  };
}
