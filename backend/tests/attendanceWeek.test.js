/**
 * The admin's week view: every class's registers Monday–Friday, any week,
 * with previous/next navigation and the term week number.
 *
 * Term 1 starts Monday 21 September 2026, so Thursday 15 October — the
 * pinned "now", 10:00 at school — is in Week 4.
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');
const schoolTime = require('../utils/schoolTime');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = '9a6ff1d0-6d70-4a38-b6e7-c1f4f3dc63aa';
const uuid = (kind, n) => `${kind}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BLUE = uuid('c0000000', 1);
const GREEN = uuid('c0000000', 2);
const SPARE = uuid('c0000000', 3);

const user = (n, role, name) => ({
    id: uuid('b0000000', n), school_id: SCHOOL, name, email: `user${n}@school.et`,
    password_hash: '$2a$12$placeholderplaceholderplaceholderplaceholderplaceholder', role, is_active: true,
});
const ADMIN = user(1, 'admin', 'Office Admin');
const MAHILET = user(2, 'main_teacher', 'Ms. Mahilet');

const pupils = (classId, n) => [1, 2].map((i) => ({
    id: uuid('a0000000', n * 10 + i), school_id: SCHOOL, class_id: classId, name: `Pupil ${n}.${i}`, is_active: true,
}));
const STUDENTS = [...pupils(BLUE, 1), ...pupils(GREEN, 2)];
const [B1, B2, G1] = STUDENTS;

let seq = 0;
const mark = (pupil, date, status = 'present') => ({
    id: uuid('e0000000', (seq += 1)), school_id: SCHOOL, student_id: pupil.id, class_id: pupil.class_id,
    subject_id: null, date, status,
});
const fullRegister = (pupilsOfClass, date, status) => pupilsOfClass.map((p) => mark(p, date, status));

const seed = (extra = {}) => reset({
    schools: [{ id: SCHOOL, name: 'BIS NOC' }],
    users: [ADMIN, MAHILET],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    terms: [{ id: 't1', school_id: SCHOOL, academic_year_id: YEAR, term_index: 1, name: 'Term 1',
        starts_on: '2026-09-21', ends_on: '2026-12-21', is_current: true }],
    classes: [
        { id: BLUE, school_id: SCHOOL, name: 'Year 3 - Blue' },
        { id: GREEN, school_id: SCHOOL, name: 'Year 3 - Green' },
        { id: SPARE, school_id: SCHOOL, name: 'Year 3 - Spare' },
    ],
    class_staff: [{ id: 's1', school_id: SCHOOL, academic_year_id: YEAR, class_id: BLUE, user_id: MAHILET.id, position: 'main' }],
    students: STUDENTS,
    attendance: [
        // This week (Week 4): Blue every day so far; Green Mon, half of Tue.
        ...['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'].flatMap((d) => fullRegister([B1, B2], d)),
        ...fullRegister([G1, STUDENTS[3]], '2026-10-12', 'late'),
        mark(G1, '2026-10-13', 'absent'),
        // Last week (Week 3): Wednesday 7th was a holiday.
        ...['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'].flatMap((d) => fullRegister([B1, B2], d)),
    ],
    calendar_events: [
        { id: 'h1', school_id: SCHOOL, class_id: null, title: 'Staff training day', category: 'holiday',
            starts_on: '2026-10-07', ends_on: '2026-10-07' },
        { id: 'h2', school_id: SCHOOL, class_id: GREEN, title: 'Green class trip', category: 'holiday',
            starts_on: '2026-10-08', ends_on: '2026-10-08' },
    ],
    ...extra,
});

const getWeek = (query = '') => request(app).get(`/api/attendance/week${query}`).auth(signToken(ADMIN));
const statuses = (body, classId) => body.classes.find((k) => k.classId === classId).days.map((d) => d.status);

beforeEach(() => {
    seq = 0;
    schoolTime.clock.now = () => new Date('2026-10-15T10:00:00+03:00');
    seed();
});
afterEach(() => { schoolTime.clock.now = () => new Date(); });

describe('attendance week view', () => {
    test('this week is Week 4 of Term 1: what is taken, missing and still to come', async () => {
        const res = await getWeek();
        assert.equal(res.status, 200);
        const body = res.body;

        assert.equal(body.weekStart, '2026-10-12');
        assert.equal(body.weekEnd, '2026-10-16');
        assert.equal(body.isCurrentWeek, true);
        assert.deepEqual(body.term, { name: 'Term 1', weekNumber: 4, weekCount: 14 });
        assert.equal(body.previousWeek, '2026-10-05');
        assert.equal(body.nextWeek, null, 'no next week from the current one');

        assert.deepEqual(body.days.map((d) => d.label), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
        assert.equal(body.days[3].isToday, true);
        assert.equal(body.days[4].isFuture, true);

        assert.deepEqual(statuses(body, BLUE), ['taken', 'taken', 'taken', 'taken', 'upcoming']);
        // Wednesday's register is missing; today's (Thursday) is still open.
        assert.deepEqual(statuses(body, GREEN), ['taken', 'partial', 'not_taken', 'pending', 'upcoming']);
        assert.deepEqual(statuses(body, SPARE), ['no_pupils', 'no_pupils', 'no_pupils', 'no_pupils', 'upcoming']);

        const blue = body.classes.find((k) => k.classId === BLUE);
        assert.equal(blue.mainTeacher, 'Ms. Mahilet');
        assert.deepEqual([blue.taken, blue.expected], [4, 4]);
        const green = body.classes.find((k) => k.classId === GREEN);
        assert.deepEqual([green.taken, green.expected], [2, 4]);
        assert.equal(green.days[0].late, 2);

        assert.deepEqual(body.days.map((d) => [d.taken, d.expected]), [[2, 2], [2, 2], [1, 2], [1, 2], [0, 0]]);
        assert.equal(body.totals.expected, 8);
        assert.equal(body.totals.taken, 6);
        assert.equal(body.totals.missing, 1, 'only days before today count as missing');
        assert.equal(body.totals.openToday, 1);
        assert.equal(body.totals.marked, 11);
    });

    test('previous week: any date in it opens Week 3, and a holiday is not a missing register', async () => {
        const res = await getWeek('?date=2026-10-07');
        assert.equal(res.status, 200);
        const body = res.body;

        assert.equal(body.weekStart, '2026-10-05');
        assert.equal(body.isCurrentWeek, false);
        assert.equal(body.term.weekNumber, 3);
        assert.equal(body.previousWeek, '2026-09-28');
        assert.equal(body.nextWeek, '2026-10-12');

        assert.equal(body.days[2].closed, 'Staff training day');
        assert.equal(body.days[3].closed, null, "one class's trip doesn't close the school");
        assert.deepEqual(statuses(body, BLUE), ['taken', 'taken', 'closed', 'taken', 'taken']);
        assert.deepEqual(statuses(body, GREEN), ['not_taken', 'not_taken', 'closed', 'not_taken', 'not_taken']);
        assert.equal(body.totals.expected, 8, '4 open days x 2 classes with pupils');
        assert.equal(body.totals.taken, 4);
        assert.equal(body.totals.missing, 4, "a past week's untaken registers are all missing");
        assert.equal(body.totals.openToday, 0);
    });

    test('a week before the term starts has no school days to chase', async () => {
        const res = await getWeek('?date=2026-09-16');
        assert.equal(res.body.term, null);
        assert.ok(res.body.days.every((d) => d.closed === 'No school'));
        assert.equal(res.body.totals.expected, 0);
        assert.equal(res.body.totals.missing, 0);

        const first = await getWeek('?date=2026-09-21');
        assert.equal(first.body.term.weekNumber, 1);
    });

    test('a term starting mid-week: that week is Week 1, the next Monday starts Week 2', async () => {
        seed({ terms: [{ id: 't2', school_id: SCHOOL, academic_year_id: YEAR, term_index: 2, name: 'Term 2',
            starts_on: '2026-09-23', ends_on: '2026-12-18', is_current: true }] });
        const first = await getWeek('?date=2026-09-23');
        assert.equal(first.body.term.weekNumber, 1);
        assert.deepEqual(first.body.days.map((d) => d.closed), ['No school', 'No school', null, null, null]);
        assert.equal((await getWeek('?date=2026-09-28')).body.term.weekNumber, 2);
    });

    test('a weekend date shows the school week it belongs to', async () => {
        assert.equal((await getWeek('?date=2026-10-17')).body.weekStart, '2026-10-12', 'Saturday');
        assert.equal((await getWeek('?date=2026-10-18')).body.weekStart, '2026-10-12', 'Sunday looks back');
    });

    test('only the office can see it', async () => {
        const teacher = await request(app).get('/api/attendance/week').auth(signToken(MAHILET));
        assert.equal(teacher.status, 403);
        assert.equal((await getWeek('?date=12-10-2026')).status, 400);
    });
});
