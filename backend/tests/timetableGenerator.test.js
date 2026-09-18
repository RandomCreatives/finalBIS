const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { generateWeek, DAYS, LESSON_PERIODS } = require('../utils/timetableGenerator');

// Mirrors the 2026/27 plan: 14 classes, each with 26 lesson sessions.
const buildPlan = () => {
    const year3 = ['Blue', 'Yellow', 'Red', 'Green'];
    const year4 = ['Blue', 'Purple', 'Lavender', 'Crimson', 'Green', 'Yellow', 'Magenta', 'Red', 'Violet', 'Orange'];
    const classes = [
        ...year3.map((c) => ({ id: `y3-${c}`, year: 3, color: c })),
        ...year4.map((c) => ({ id: `y4-${c}`, year: 4, color: c })),
    ];

    const englishByClass = {};
    const y4split = { 1: year4.slice(0, 3), 2: year4.slice(3, 6), 3: year4.slice(6, 8), 4: year4.slice(8, 10) };
    year3.forEach((c, i) => { englishByClass[`y3-${c}`] = `eng-${i + 1}`; });
    Object.entries(y4split).forEach(([t, colors]) => {
        colors.forEach((c) => { englishByClass[`y4-${c}`] = `eng-${t}`; });
    });

    const paired = (subj, cls) => {
        const t1 = cls.year === 3
            ? ['Blue', 'Yellow'].includes(cls.color)
            : ['Blue', 'Purple', 'Lavender', 'Crimson', 'Green'].includes(cls.color);
        return `${subj}-${t1 ? 1 : 2}`;
    };

    const assignments = [];
    for (const cls of classes) {
        const push = (subjectCode, teacherId, sessions) =>
            assignments.push({ classId: cls.id, subjectCode, teacherId, sessions });

        push('MAT', `main-${cls.id}`, 5);
        push('SCI', `main-${cls.id}`, 3);
        push('GCT', `main-${cls.id}`, 2);
        push('ENG', englishByClass[cls.id], 5);
        push('SPL', englishByClass[cls.id], 1);
        push('AMH', paired('amh', cls), 2);
        push('MUS', paired('mus', cls), 2);
        push('ART', paired('art', cls), 2);
        push('PE', paired('pe', cls), 2);
        push('FRA', 'fra-1', 1);
        push('ICT', 'ict-1', 1);
    }
    return { classes, assignments };
};

describe('timetable generator — 2026/27 plan', () => {
    const { assignments } = buildPlan();
    const result = generateWeek(assignments);

    test('places every session', () => {
        assert.equal(result.ok, true, result.reason);
        const expected = assignments.reduce((n, a) => n + a.sessions, 0);
        assert.equal(result.slots.length, expected); // 14 × 26 = 364
        assert.equal(result.slots.length, 364);
    });

    test('no class is double-booked', () => {
        const seen = new Set();
        for (const s of result.slots) {
            const key = `${s.assignment.classId}|${s.day}|${s.period}`;
            assert.equal(seen.has(key), false, `class clash: ${key}`);
            seen.add(key);
        }
    });

    test('no teacher is double-booked', () => {
        const seen = new Set();
        for (const s of result.slots) {
            const key = `${s.assignment.teacherId}|${s.day}|${s.period}`;
            assert.equal(seen.has(key), false, `teacher clash: ${key}`);
            seen.add(key);
        }
    });

    test('Maths lands exactly once per day per class (5 sessions, 5 days)', () => {
        const { classes } = buildPlan();
        for (const cls of classes) {
            const days = result.slots
                .filter((s) => s.assignment.classId === cls.id && s.assignment.subjectCode === 'MAT')
                .map((s) => s.day);
            assert.equal(days.length, 5, `${cls.id} maths count`);
            assert.equal(new Set(days).size, 5, `${cls.id} maths spread`);
        }
    });

    test('subjects with ≤5 sessions appear at most once per day per class', () => {
        const seen = new Set();
        for (const s of result.slots) {
            const key = `${s.assignment.classId}|${s.assignment.subjectCode}|${s.day}`;
            assert.equal(seen.has(key), false, `same subject twice in one day: ${key}`);
            seen.add(key);
        }
    });

    test('heaviest English teacher (24 sessions) fits the 30-slot week', () => {
        const perTeacher = new Map();
        for (const s of result.slots) {
            perTeacher.set(s.assignment.teacherId, (perTeacher.get(s.assignment.teacherId) || 0) + 1);
        }
        const max = Math.max(...perTeacher.values());
        assert.ok(max <= DAYS.length * LESSON_PERIODS.length, `load ${max} exceeds the week`);
        assert.equal(perTeacher.get('eng-1'), 24);
    });
});
