/**
 * Attendance reports must count every register, however much data there is.
 *
 * Supabase's API returns at most 1000 rows per request and silently drops
 * the rest (the stub in helpers.js does the same). A school of ~420 pupils
 * writes ~420 homeroom rows a day, so any report that read raw rows without
 * paging stopped updating within days — the dashboard's week grid lost
 * Wednesday onwards while teachers kept taking registers.
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, rowsOf } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');
const schoolTime = require('../utils/schoolTime');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = '9a6ff1d0-6d70-4a38-b6e7-c1f4f3dc63aa';

const uuid = (kind, n) => `${kind}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CLASS_IDS = Array.from({ length: 14 }, (_, i) => uuid('c0000000', i + 1));
const PUPILS_PER_CLASS = 30;

const user = (id, role, name) => ({
    id, school_id: SCHOOL, name, email: `${role}@school.et`,
    password_hash: '$2a$12$placeholderplaceholderplaceholderplaceholderplaceholder',
    role, is_active: true,
});
const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin User');
const MAIN = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Ms. Mahilet');

const classes = () => CLASS_IDS.map((id, i) => ({ id, school_id: SCHOOL, name: `Class ${String(i + 1).padStart(2, '0')}` }));
const students = () => CLASS_IDS.flatMap((classId, c) =>
    Array.from({ length: PUPILS_PER_CLASS }, (_, p) => ({
        id: uuid('a0000000', c * 100 + p + 1), school_id: SCHOOL, class_id: classId,
        name: `Pupil ${c + 1}.${p + 1}`, admission_no: `BIS-${c + 1}-${p + 1}`, roll_num: p + 1, is_active: true,
    })));

let seq = 0;
const register = (date, classIndex, status) => Array.from({ length: PUPILS_PER_CLASS }, (_, p) => ({
    id: uuid('e0000000', (seq += 1)),
    school_id: SCHOOL,
    student_id: uuid('a0000000', classIndex * 100 + p + 1),
    class_id: CLASS_IDS[classIndex],
    subject_id: null,
    date,
    status: typeof status === 'function' ? status(p) : status,
    marked_by: MAIN.id,
    created_at: `${date}T05:15:00.000Z`,
    updated_at: `${date}T05:15:00.000Z`,
}));

const baseTables = (attendance) => ({
    schools: [{ id: SCHOOL, name: 'BIS NOC' }],
    users: [ADMIN, MAIN],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    terms: [],
    classes: classes(),
    students: students(),
    attendance,
    class_staff: [],
});

beforeEach(() => { seq = 0; });

describe('attendance reports read past the 1000-row API cap', () => {
    // The whole school week: 14 classes x 30 pupils x 5 days = 2100 rows.
    // Mon/Tue everyone present; Wed–Fri the first 15 of every class absent.
    const week = schoolTime.schoolWeek(schoolTime.todayIso());
    const weekRows = () => week.flatMap((date, d) => CLASS_IDS.flatMap((_, c) =>
        register(date, c, (p) => (d <= 1 || p >= 15 ? 'present' : 'absent'))));

    test('week grid: every class shows a tick for every day its register was taken', async () => {
        const rows = weekRows();
        const today = schoolTime.todayIso();
        if (!week.includes(today)) rows.push(...register(today, 0, 'present'));
        reset(baseTables(rows));

        const res = await request(app).get(`/api/attendance/week?date=${week[0]}`).auth(signToken(ADMIN));
        assert.equal(res.status, 200);
        const missing = res.body.classes.flatMap((k) =>
            k.days.filter((d) => !['taken', 'partial'].includes(d.status)).map((d) => `${k.className} ${d.date}`));
        assert.deepEqual(missing, [], 'registers that were taken must show as taken');
        assert.equal(res.body.totals.marked, 2100);

        const summary = await request(app).get('/api/dashboard/summary').auth(signToken(ADMIN));
        assert.equal(summary.status, 200);
        assert.equal(summary.body.attendanceToday.marked, rows.filter((r) => r.date === today).length);
    });

    test('data center: the attendance rate uses every record ever taken', async () => {
        reset(baseTables(weekRows()));
        const res = await request(app).get('/api/datacenter/stats').auth(signToken(ADMIN));
        assert.equal(res.status, 200);
        // 1470 present of 2100. The first 1000 rows alone would claim 92%.
        assert.equal(res.body.attendanceRate, 70);
    });

    test('attendance summary counts every record', async () => {
        reset(baseTables(weekRows()));
        const res = await request(app).get('/api/attendance/summary').auth(signToken(ADMIN));
        assert.equal(res.status, 200);
        assert.equal(res.body.total, 2100);
        assert.deepEqual(res.body.byStatus, { present: 1470, absent: 630 });
    });

    test('monthly grid: a big class over a full month keeps every day', async () => {
        // Last month, 50 pupils, every school day: ~1100 rows for one class.
        const lastMonth = schoolTime.addDays(`${schoolTime.currentMonth()}-01`, -1).slice(0, 7);
        const { from, to } = schoolTime.monthBounds(lastMonth);
        const days = [];
        for (let d = from; d <= to; d = schoolTime.addDays(d, 1)) {
            if (schoolTime.isoWeekday(d) <= 5) days.push(d);
        }
        const bigClass = CLASS_IDS[0];
        const pupils = Array.from({ length: 50 }, (_, p) => ({
            id: uuid('a1000000', p + 1), school_id: SCHOOL, class_id: bigClass,
            name: `Big ${p + 1}`, admission_no: `BIG-${p + 1}`, roll_num: p + 1, is_active: true,
        }));
        const rows = days.flatMap((date) => pupils.map((pupil) => ({
            id: uuid('e1000000', (seq += 1)), school_id: SCHOOL, student_id: pupil.id, class_id: bigClass,
            subject_id: null, date, status: 'present', marked_by: MAIN.id,
        })));
        assert.ok(rows.length > 1000);
        reset({ ...baseTables(rows), students: pupils });

        const res = await request(app)
            .get(`/api/attendance/monthly-grid?classId=${bigClass}&month=${lastMonth}`)
            .auth(signToken(ADMIN));
        assert.equal(res.status, 200);
        assert.equal(res.body.days.length, days.length);
        for (const pupil of res.body.students) {
            assert.equal(Object.keys(pupil.marks).length, days.length, `${pupil.name} lost days`);
        }
    });

    test("a student's attendance history is complete", async () => {
        const pupilId = uuid('a0000000', 1);
        // A year of lesson-by-lesson attendance: 1200 rows for one pupil.
        const rows = Array.from({ length: 1200 }, (_, i) => ({
            id: uuid('e2000000', i + 1), school_id: SCHOOL, student_id: pupilId, class_id: CLASS_IDS[0],
            subject_id: uuid('d0000000', (i % 6) + 1),
            date: schoolTime.addDays('2026-01-05', Math.floor(i / 6)),
            status: i % 10 === 0 ? 'absent' : 'present', marked_by: MAIN.id,
        }));
        reset(baseTables(rows));

        const res = await request(app).get(`/api/attendance/student/${pupilId}`).auth(signToken(ADMIN));
        assert.equal(res.status, 200);
        assert.equal(res.body.stats.total, 1200);
        assert.equal(res.body.stats.absent, 120);
    });
});

describe('selectAll', () => {
    const { selectAll } = require('../utils/selectAll');

    test('stays complete even when the project caps pages below the page size', async () => {
        const rows = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, school_id: SCHOOL, n: i }));
        reset({ things: rows }, { maxRows: 3 });
        const all = await selectAll('things', 'id, n', (q) => q.eq('school_id', SCHOOL));
        assert.deepEqual(all.map((r) => r.n), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    test('one request when everything fits in a page', async () => {
        reset({ things: [{ id: 'a', school_id: SCHOOL }] });
        assert.equal((await selectAll('things', 'id', (q) => q.eq('school_id', SCHOOL))).length, 1);
        reset({ things: [] });
        assert.deepEqual(await selectAll('things', 'id'), []);
    });
});

afterEach(() => { schoolTime.clock.now = () => new Date(); });

module.exports = { SCHOOL, YEAR, CLASS_IDS, ADMIN, MAIN, uuid, register, students, classes };
