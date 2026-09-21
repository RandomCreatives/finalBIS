/**
 * Bell language — how the school talks about its day.
 *
 * The timetable stores 24-hour times ("13:10"), but nobody at school says
 * "13:10" — the day is spoken as "1st period … 6th period" with 12-hour
 * times. One place converts storage → school language: mirror of the
 * backend's LESSON_PERIODS (utils/timetableGenerator).
 *
 *   1st period   8:30–9:20 AM     4th period  11:30 AM–12:20 PM
 *   2nd period   9:20–10:10 AM    5th period  1:10–2:00 PM
 *   3rd period  10:40–11:30 AM    6th period  2:10–3:00 PM
 *
 * Anything off the bell (registration 8:10–8:30 AM, walk-in slots added
 * by hand) gets the 12-hour time with no period name.
 */

const BELL = [
    ['08:30', '09:20'],
    ['09:20', '10:10'],
    ['10:40', '11:30'],
    ['11:30', '12:20'],
    ['13:10', '14:00'],
    ['14:10', '15:00'],
];

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

/** "13:10" / "13:10:00" → "1:10 PM"; "08:30" → "8:30 AM". */
export const to12h = (t) => {
    if (!t) return '';
    const [h, m] = t.slice(0, 5).split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
};

/** "08:30" → "1st"; null for registration / off-bell times. */
export const periodOrdinal = (startsAt) => {
    const idx = BELL.findIndex(([start]) => start === startsAt?.slice(0, 5));
    return idx >= 0 ? ORDINALS[idx] : null;
};

/** ("13:10", "14:00") → "1:10–2:00 PM" (suffix repeated when it flips). */
export const timeRange = (startsAt, endsAt) => {
    const from = to12h(startsAt);
    const to = to12h(endsAt);
    const [fromTime, fromSuffix] = from.split(' ');
    const [, toSuffix] = to.split(' ');
    return fromSuffix === toSuffix ? `${fromTime}–${to}` : `${from}–${to}`;
};

/**
 * Full school-language label for a lesson: "1st period · 8:30–9:20 AM",
 * or just "8:10–8:30 AM" for registration and other off-bell rows.
 */
export const lessonLabel = (startsAt, endsAt) => {
    const ord = periodOrdinal(startsAt);
    const range = timeRange(startsAt, endsAt);
    return ord ? `${ord} period · ${range}` : range;
};
