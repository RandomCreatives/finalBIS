/**
 * Weekly timetable placement.
 *
 * Pure function: given each class's subject load for the week (subject +
 * teacher + sessions), it places every session into the Mon–Fri lesson
 * periods such that no teacher and no class is double-booked, spreading
 * each subject across days (a subject with ≤5 sessions lands at most once
 * per day per class when possible — Maths gets exactly one slot per day).
 *
 * Returns { ok, slots } where each slot is { assignment, day, period }.
 * Deterministic — no randomness, so results are reproducible.
 */

const DAYS = [1, 2, 3, 4, 5];

const LESSON_PERIODS = [
    ['08:30', '09:20'],
    ['09:20', '10:10'],
    ['10:40', '11:30'],
    ['11:30', '12:20'],
    ['13:10', '14:00'],
    ['14:10', '15:00'],
];

const REGISTRATION = { start: '08:10', end: '08:30' };

/**
 * @param {Array<{classId, subjectCode, teacherId, sessions}>} assignments
 * @returns {{ok: boolean, slots?: Array<{assignment, day, period}>, reason?: string}}
 */
const generateWeek = (assignments) => {
    // Total weekly load per teacher — high-load teachers get placed first.
    const teacherLoad = new Map();
    for (const a of assignments) {
        teacherLoad.set(a.teacherId, (teacherLoad.get(a.teacherId) || 0) + a.sessions);
    }

    // One item per session to place.
    const items = [];
    for (const a of assignments) {
        for (let i = 0; i < a.sessions; i += 1) items.push(a);
    }
    items.sort((x, y) => (teacherLoad.get(y.teacherId) - teacherLoad.get(x.teacherId))
        || x.subjectCode.localeCompare(y.subjectCode));

    const teacherBusy = new Set(); // `${teacher}|${day}|${period}`
    const classBusy = new Set();   // `${class}|${day}|${period}`
    const classDaySubjects = new Map(); // `${class}|${day}` -> Set(subjectCode)
    const teacherDayCount = new Map(); // `${teacher}|${day}` -> count
    const classDayCount = new Map();   // `${class}|${day}` -> count

    const slots = [];

    for (const item of items) {
        let best = null;

        for (const day of DAYS) {
            for (let period = 0; period < LESSON_PERIODS.length; period += 1) {
                if (teacherBusy.has(`${item.teacherId}|${day}|${period}`)) continue;
                if (classBusy.has(`${item.classId}|${day}|${period}`)) continue;

                const dayKey = `${item.classId}|${day}`;
                const subjectsToday = classDaySubjects.get(dayKey) || new Set();
                const sameSubjectToday = subjectsToday.has(item.subjectCode) ? 100 : 0;
                const score = sameSubjectToday
                    + (classDayCount.get(dayKey) || 0)
                    + 2 * (teacherDayCount.get(`${item.teacherId}|${day}`) || 0);

                if (!best || score < best.score) {
                    best = { day, period, score };
                }
            }
        }

        if (!best) {
            return {
                ok: false,
                reason: `No free slot for ${item.subjectCode} (class ${item.classId})`,
            };
        }

        const { day, period } = best;
        teacherBusy.add(`${item.teacherId}|${day}|${period}`);
        classBusy.add(`${item.classId}|${day}|${period}`);

        const dayKey = `${item.classId}|${day}`;
        if (!classDaySubjects.has(dayKey)) classDaySubjects.set(dayKey, new Set());
        classDaySubjects.get(dayKey).add(item.subjectCode);
        classDayCount.set(dayKey, (classDayCount.get(dayKey) || 0) + 1);

        const tKey = `${item.teacherId}|${day}`;
        teacherDayCount.set(tKey, (teacherDayCount.get(tKey) || 0) + 1);

        slots.push({ assignment: item, day, period });
    }

    return { ok: true, slots };
};

module.exports = { generateWeek, DAYS, LESSON_PERIODS, REGISTRATION };
