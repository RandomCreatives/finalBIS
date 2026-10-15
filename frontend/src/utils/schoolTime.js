/*
 * School time: East Africa Time — Addis Ababa, GMT+3 (no daylight saving).
 *
 * Every date and time the app computes or shows — "today", the weekday, the
 * clock, when something was saved — is on the school's clock, whatever time
 * zone the device is set to, and never UTC.
 *
 * Two kinds of value:
 *  - calendar dates ('YYYY-MM-DD': registers, due dates, events) are plain
 *    dates and are shown exactly as stored (formatDay);
 *  - moments (timestamps: saved at, sent at) are shown on the school clock
 *    (formatDate / formatTime / formatDateTime).
 */

export const SCHOOL_TIME_ZONE = 'Africa/Addis_Ababa';
const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOCALE = 'en-GB';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A Date whose UTC fields read the school's wall clock. */
const wallClock = (now = new Date()) => new Date(now.getTime() + OFFSET_MS);

/** Today's date at school, 'YYYY-MM-DD'. */
export const schoolToday = (now) => wallClock(now).toISOString().slice(0, 10);

/** This month at school, 'YYYY-MM'. */
export const schoolMonth = (now) => schoolToday(now).slice(0, 7);

/** The hour at school, 0–23. */
export const schoolHour = (now) => wallClock(now).getUTCHours();

/** The school's clock time, 'HH:MM'. */
export const schoolClockTime = (now) => wallClock(now).toISOString().slice(11, 16);

/** ISO weekday of a calendar date: 1 = Monday … 7 = Sunday. */
export const weekdayOf = (isoDate) => {
    const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
    return day === 0 ? 7 : day;
};

/** Today's ISO weekday at school. */
export const schoolWeekday = (now) => weekdayOf(schoolToday(now));

/** 'YYYY-MM-DD' from calendar parts (monthIndex 0–11). */
export const isoDate = (year, monthIndex, day) =>
    `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Calendar arithmetic on 'YYYY-MM-DD' strings. */
export const addDays = (date, days) =>
    new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Monday of the school week containing `date` (a Sunday looks back). */
export const schoolWeekStart = (date = schoolToday()) => addDays(date, 1 - weekdayOf(date));

/** A calendar date ('YYYY-MM-DD'), never shifted. "15 Oct 2026" by default. */
export const formatDay = (date, options = { day: 'numeric', month: 'short', year: 'numeric' }) =>
    (date ? new Date(`${String(date).slice(0, 10)}T00:00:00Z`).toLocaleDateString(LOCALE, { ...options, timeZone: 'UTC' }) : '');

const asMoment = (value, format, options) => {
    if (value === null || value === undefined || value === '') return '';
    // A bare calendar date carries no time of day: show it as stored.
    if (typeof value === 'string' && DATE_ONLY.test(value)) return formatDay(value, options);
    return format(new Date(value), { ...options, timeZone: SCHOOL_TIME_ZONE });
};

/** The date of a moment, at school. "15 Oct 2026" by default. */
export const formatDate = (value, options = { day: 'numeric', month: 'short', year: 'numeric' }) =>
    asMoment(value, (d, o) => d.toLocaleDateString(LOCALE, o), options);

/** The time of a moment, on the school clock. "08:12" by default. */
export const formatTime = (value, options = { hour: '2-digit', minute: '2-digit' }) =>
    asMoment(value, (d, o) => d.toLocaleTimeString(LOCALE, o), options);

/** Date and time of a moment, at school. "15 Oct, 08:12" by default. */
export const formatDateTime = (value, options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) =>
    asMoment(value, (d, o) => d.toLocaleString(LOCALE, o), options);
