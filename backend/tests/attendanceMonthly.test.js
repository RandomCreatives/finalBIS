const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, rowsOf, supabaseStub } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

// A fully past month — school days are deterministic (Jan 2025: 23 weekdays).
const MONTH = '2025-01';
const D1 = '2025-01-06';
const D2 = '2025-01-07';
const D3 = '2025-01-08';

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40';
const CLASS_A = '713bfeaa-d141-44f0-864a-cee594efb105';
const CLASS_B = '2c4e6a80-1f3d-4b5c-8e7a-9d0f1b2c3e45';
const STU_1 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const STU_2 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

const user = (id, role, name) => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase()}@school.et`,
    password_hash: '$2a$12$x', role, is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin');
const MAIN_A = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Meron');
const MAIN_B = user('7d3e5f91-4a26-4c80-b5e3-9f1a7c2d6b48', 'main_teacher', 'Bekele');

const tokenFor = (u) => signToken(u);

const tables = () => ({
    schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
    users: [ADMIN, MAIN_A, MAIN_B],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    classes: [
        { id: CLASS_A, school_id: SCHOOL, name: 'Year 3A', capacity: 25 },
        { id: CLASS_B, school_id: SCHOOL, name: 'Year 3B', capacity: 25 },
    ],
    class_staff: [
        { id: 'cs-a', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: MAIN_A.id, position: 'main' },
        { id: 'cs-b', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_B, user_id: MAIN_B.id, position: 'main' },
    ],
    class_subjects: [
        // MAIN_A teaches THREE subjects in CLASS_A — the shape that crashed
        // production when assertClassAccess used maybeSingle().
        { id: 'cs-1', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: '3b7d9e15-8c2a-4f60-b1d4-7e5a9c0f2b38', teacher_id: MAIN_A.id, sessions_per_week: 6 },
        { id: 'cs-2', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: 'e8c792f8-5e0f-4a8b-96e6-9a07ea4c932a', teacher_id: MAIN_A.id, sessions_per_week: 5 },
        { id: 'cs-3', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: 'a9d8c7b6-5e4f-4a3b-9c8d-7e6f5a4b3c2d', teacher_id: MAIN_A.id, sessions_per_week: 2 },
    ],
    students: [
        { id: STU_1, school_id: SCHOOL, name: 'Abel T', admission_no: 'A001', roll_num: 1, class_id: CLASS_A, is_active: true },
        { id: STU_2, school_id: SCHOOL, name: 'Sara K', admission_no: 'A002', roll_num: 2, class_id: CLASS_A, is_active: true },
    ],
    attendance: [
        // Abel: present, late, absent  -> rate = 2/3 = 66.7
        { id: 'at-1', school_id: SCHOOL, student_id: STU_1, class_id: CLASS_A, subject_id: null, date: D1, status: 'present' },
        { id: 'at-2', school_id: SCHOOL, student_id: STU_1, class_id: CLASS_A, subject_id: null, date: D2, status: 'late' },
        { id: 'at-3', school_id: SCHOOL, student_id: STU_1, class_id: CLASS_A, subject_id: null, date: D3, status: 'absent' },
        // Sara: present, excused -> rate = 1/1 = 100 (excused leaves the denominator)
        { id: 'at-4', school_id: SCHOOL, student_id: STU_2, class_id: CLASS_A, subject_id: null, date: D1, status: 'present' },
        { id: 'at-5', school_id: SCHOOL, student_id: STU_2, class_id: CLASS_A, subject_id: null, date: D2, status: 'excused' },
    ],
    attendance_submissions: [],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

describe('GET /api/attendance/monthly', () => {
    test('aggregates counts and rate (late = attending, excused out of denominator)', async () => {
        const res = await request(app)
            .get(`/api/attendance/monthly?classId=${CLASS_A}&month=${MONTH}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        assert.equal(res.body.className, 'Year 3A');
        assert.equal(res.body.daysMarked, 3);
        assert.equal(res.body.schoolDays, 23); // Jan 2025 weekdays, month fully past
        assert.equal(res.body.submission, null);

        const abel = res.body.students.find((s) => s.name === 'Abel T');
        assert.deepEqual(
            [abel.present, abel.late, abel.absent, abel.excused, abel.markedDays],
            [1, 1, 1, 0, 3]
        );
        assert.equal(abel.attendanceRate, 66.7);

        const sara = res.body.students.find((s) => s.name === 'Sara K');
        assert.equal(sara.attendanceRate, 100);
    });

    test('a teacher cannot review another teacher\'s class', async () => {
        const res = await request(app)
            .get(`/api/attendance/monthly?classId=${CLASS_B}&month=${MONTH}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 403);
    });
});

describe('monthly submission workflow', () => {
    test('a main teacher submits their month', async () => {
        const res = await request(app)
            .post('/api/attendance/submit')
            .auth(tokenFor(MAIN_A))
            .send({ classId: CLASS_A, month: MONTH });

        assert.equal(res.status, 200);
        assert.equal(res.body.submission.status, 'submitted');
        assert.equal(rowsOf('attendance_submissions').length, 1);
        assert.equal(rowsOf('attendance_submissions')[0].class_id, CLASS_A);
    });

    test('a teacher cannot submit another teacher\'s month', async () => {
        const res = await request(app)
            .post('/api/attendance/submit')
            .auth(tokenFor(MAIN_A))
            .send({ classId: CLASS_B, month: MONTH });

        assert.equal(res.status, 403);
    });

    test('submitted months are locked for teachers', async () => {
        rowsOf('attendance_submissions').push({
            id: 'sub-1', school_id: SCHOOL, class_id: CLASS_A, month: MONTH,
            status: 'submitted', submitted_by: MAIN_A.id, submitted_at: new Date().toISOString(), note: null,
        });
        supabaseStub._rpc.mark_attendance = () => ({ data: { count: 1 }, error: null });

        const res = await request(app)
            .post('/api/attendance')
            .auth(tokenFor(MAIN_A))
            .send({ classId: CLASS_A, date: D1, records: [{ studentId: STU_1, status: 'present' }] });

        assert.equal(res.status, 409);
        assert.match(res.body.message, /locked/i);
    });

    test('admins can still mark a submitted month', async () => {
        rowsOf('attendance_submissions').push({
            id: 'sub-1', school_id: SCHOOL, class_id: CLASS_A, month: MONTH,
            status: 'submitted', submitted_by: MAIN_A.id, submitted_at: new Date().toISOString(), note: null,
        });
        supabaseStub._rpc.mark_attendance = () => ({ data: { count: 1 }, error: null });

        const res = await request(app)
            .post('/api/attendance')
            .auth(tokenFor(ADMIN))
            .send({ classId: CLASS_A, date: D1, records: [{ studentId: STU_1, status: 'present' }] });

        assert.equal(res.status, 201);
    });

    test('only admins can return a submission; returning unlocks the month', async () => {
        rowsOf('attendance_submissions').push({
            id: 'sub-1', school_id: SCHOOL, class_id: CLASS_A, month: MONTH,
            status: 'submitted', submitted_by: MAIN_A.id, submitted_at: new Date().toISOString(), note: null,
        });

        const denied = await request(app)
            .post('/api/attendance/return')
            .auth(tokenFor(MAIN_A))
            .send({ classId: CLASS_A, month: MONTH });
        assert.equal(denied.status, 403);

        // Even an admin must give a reason — the unlock leaves a paper trail.
        const noReason = await request(app)
            .post('/api/attendance/return')
            .auth(tokenFor(ADMIN))
            .send({ classId: CLASS_A, month: MONTH });
        assert.equal(noReason.status, 400);

        const blankReason = await request(app)
            .post('/api/attendance/return')
            .auth(tokenFor(ADMIN))
            .send({ classId: CLASS_A, month: MONTH, note: '   ' });
        assert.equal(blankReason.status, 400);

        const returned = await request(app)
            .post('/api/attendance/return')
            .auth(tokenFor(ADMIN))
            .send({ classId: CLASS_A, month: MONTH, note: 'Please fix the 7th' });
        assert.equal(returned.status, 200);
        assert.equal(returned.body.submission.status, 'returned');
        assert.equal(returned.body.submission.note, 'Please fix the 7th');

        // Teacher can mark again.
        supabaseStub._rpc.mark_attendance = () => ({ data: { count: 1 }, error: null });
        const remark = await request(app)
            .post('/api/attendance')
            .auth(tokenFor(MAIN_A))
            .send({ classId: CLASS_A, date: D1, records: [{ studentId: STU_1, status: 'present' }] });
        assert.equal(remark.status, 201);
    });
});

describe('GET /api/attendance/submissions', () => {
    test('a teacher sees only their class, with pending/submitted statuses', async () => {
        rowsOf('attendance_submissions').push({
            id: 'sub-1', school_id: SCHOOL, class_id: CLASS_A, month: MONTH,
            status: 'submitted', submitted_by: MAIN_A.id, submitted_at: new Date().toISOString(), note: null,
        });

        const res = await request(app)
            .get(`/api/attendance/submissions?month=${MONTH}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        assert.equal(res.body.submissions.length, 1);
        assert.equal(res.body.submissions[0].className, 'Year 3A');
        assert.equal(res.body.submissions[0].status, 'submitted');
    });

    test('an admin sees every class, pending where nothing was submitted', async () => {
        const res = await request(app)
            .get(`/api/attendance/submissions?month=${MONTH}`)
            .auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.submissions.length, 2);
        const statuses = Object.fromEntries(res.body.submissions.map((s) => [s.className, s.status]));
        assert.equal(statuses['Year 3A'], 'pending');
        assert.equal(statuses['Year 3B'], 'pending');
    });
});

describe('GET /api/attendance/report.csv', () => {
    test('downloads a per-student CSV for the teacher\'s own class', async () => {
        const res = await request(app)
            .get(`/api/attendance/report.csv?classId=${CLASS_A}&month=${MONTH}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        const csv = res.body.raw;
        assert.match(csv, /Attendance %/);
        assert.match(csv, /Abel T/);
        assert.match(csv, /66\.7/);
        assert.match(csv, /Year 3A,2025-01/);
    });

    test('a teacher cannot export another class', async () => {
        const res = await request(app)
            .get(`/api/attendance/report.csv?classId=${CLASS_B}&month=${MONTH}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 403);
    });
});

describe('GET /api/attendance/monthly-grid', () => {
    test('returns school-day columns and per-student per-day marks', async () => {
        const res = await request(app)
            .get(`/api/attendance/monthly-grid?classId=${CLASS_A}&month=2025-01`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        assert.equal(res.body.className, 'Year 3A');
        // Jan 2025 fully past → 23 weekdays
        assert.equal(res.body.days.length, 23);
        assert.ok(res.body.days.includes(D1));

        const abel = res.body.students.find((s) => s.name === 'Abel T');
        assert.equal(abel.marks[D1], 'present');
        assert.equal(abel.marks[D2], 'late');
        assert.equal(abel.marks[D3], 'absent');
        assert.equal(abel.attendanceRate, 66.7);

        const sara = res.body.students.find((s) => s.name === 'Sara K');
        assert.equal(sara.marks[D2], 'excused');
        assert.equal(sara.attendanceRate, 100);
    });

    test('a teacher cannot view another teacher\'s grid', async () => {
        const res = await request(app)
            .get(`/api/attendance/monthly-grid?classId=${CLASS_B}&month=2025-01`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 403);
    });
});
