/**
 * School time: East Africa Time — Addis Ababa, GMT+3.
 *
 * The API runs in UTC (Vercel), so `new Date().toISOString().slice(0, 10)` is
 * the *UTC* date — yesterday at school between 00:00 and 03:00 — and
 * `getDay()` / `getHours()` read the server's clock, not the school's. Every
 * "today", weekday, month and clock time in the API comes from here instead.
 *
 * Ethiopia has no daylight saving, so school time is a fixed UTC+3 offset.
 * Calendar dates ('YYYY-MM-DD') are handled as plain dates: arithmetic on
 * them never involves a time zone.
 */

const SCHOOL_TIME_ZONE = 'Africa/Addis_Ababa';
const SCHOOL_UTC_OFFSET = '+03:00';
const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Swappable clock so tests can pin "now". Production never touches it. */
const clock = { now: () => new Date() };

/** A Date whose UTC fields read the school's wall clock. */
const wallClock = (now = clock.now()) => new Date(now.getTime() + OFFSET_MS);

/** Today's date at school, 'YYYY-MM-DD'. */
const todayIso = (now) => wallClock(now).toISOString().slice(0, 10);

/** This month at school, 'YYYY-MM'. */
const currentMonth = (now) => todayIso(now).slice(0, 7);

/** The school's clock time, 'HH:MM'. */
const timeNow = (now) => wallClock(now).toISOString().slice(11, 16);

const parseDay = (isoDate) => Date.parse(`${isoDate}T00:00:00Z`);

/** ISO weekday of a calendar date: 1 = Monday … 7 = Sunday. */
const isoWeekday = (isoDate) => {
    const day = new Date(parseDay(isoDate)).getUTCDay();
    return day === 0 ? 7 : day;
};

/** Today's ISO weekday at school. */
const weekdayToday = (now) => isoWeekday(todayIso(now));

/** Calendar arithmetic on 'YYYY-MM-DD' strings. */
const addDays = (isoDate, days) =>
    new Date(parseDay(isoDate) + days * DAY_MS).toISOString().slice(0, 10);

/** Whole days from one calendar date to another. */
const daysBetween = (fromIso, toIso) => Math.round((parseDay(toIso) - parseDay(fromIso)) / DAY_MS);

/** Monday–Friday of the school week containing `isoDate` (Sunday looks back). */
const schoolWeek = (isoDate = todayIso()) => {
    const monday = addDays(isoDate, 1 - isoWeekday(isoDate));
    return [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset));
};

/** First and last calendar day of a month 'YYYY-MM'. */
const monthBounds = (month) => {
    const [year, mon] = month.split('-').map(Number);
    const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
};

/** Minutes since midnight of an 'HH:MM' clock time. */
const minutesOf = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
};

/** "Thursday 15 October" — a calendar date, never shifted. */
const formatDay = (isoDate, options = { weekday: 'long', day: 'numeric', month: 'long' }) =>
    new Date(parseDay(isoDate)).toLocaleDateString('en-GB', { timeZone: 'UTC', ...options });

/** "08:12" — a timestamp shown on the school's clock. */
const formatTime = (value) =>
    new Date(value).toLocaleTimeString('en-GB', {
        timeZone: SCHOOL_TIME_ZONE, hour: '2-digit', minute: '2-digit',
    });

module.exports = {
    SCHOOL_TIME_ZONE,
    SCHOOL_UTC_OFFSET,
    clock,
    wallClock,
    todayIso,
    currentMonth,
    timeNow,
    isoWeekday,
    weekdayToday,
    addDays,
    daysBetween,
    schoolWeek,
    monthBounds,
    minutesOf,
    formatDay,
    formatTime,
};
