const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, rowsOf } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40';
const CLASS_A = '713bfeaa-d141-44f0-864a-cee594efb105';
const CLASS_B = '823cfebb-d141-44f0-864a-cee594efb106';

const user = (id, role, name) => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase()}@school.et`,
    password_hash: '$2a$12$x', role, is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin');
const MAIN = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Meron');
const OTHER_MAIN = user('93f720ce-125d-426e-a1ad-0519471b3f05', 'main_teacher', 'Selam');
const ENG_T = user('343d1a63-716b-492c-88ca-f466c50aea97', 'subject_teacher', 'Dawit');
const tokenFor = (u) => signToken(u);

const REQ_ID = 'c8d4f6a2-9e35-4c71-a028-4f6b9d2e8c15';
const pendingRow = (over = {}) => ({
    id: REQ_ID, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A,
    requested_by: MAIN.id, name: 'New Child', gender: 'female', date_of_birth: '2018-01-01',
    guardian_name: 'Parent A', guardian_phone: '911000001', guardian_email: null,
    special_needs: false, special_needs_note: null, status: 'pending', review_note: null,
    reviewed_by: null, reviewed_at: null, student_id: null,
    created_at: '2026-09-22T08:00:00.000Z', updated_at: '2026-09-22T08:00:00.000Z', ...over,
});

const tables = () => ({
    users: [ADMIN, MAIN, OTHER_MAIN, ENG_T],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    classes: [
        { id: CLASS_A, school_id: SCHOOL, name: 'Year 3 - Red' },
        { id: CLASS_B, school_id: SCHOOL, name: 'Year 4 - Blue' },
    ],
    class_staff: [
        { id: 'a1b2c3d4-1111-4444-8888-000000000001', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: MAIN.id, position: 'main' },
        { id: 'a1b2c3d4-1111-4444-8888-000000000002', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_B, user_id: OTHER_MAIN.id, position: 'main' },
    ],
    students: [
        { id: 'd5e6f7a8-2222-4444-8888-0000000000aa', school_id: SCHOOL, class_id: CLASS_A, admission_no: 'BIS2026-315', name: 'Last Kid', roll_num: 24, gender: null, date_of_birth: null, guardian_name: null, guardian_phone: null, guardian_email: null, special_needs: false, special_needs_note: null, is_active: true },
    ],
    student_requests: [],
    notifications: [],
});

beforeEach(() => reset(tables()));

describe('POST /api/student-requests', () => {
    test('main teacher submits a request for their own class; admins get a nudge', async () => {
        const res = await request(app).post('/api/student-requests')
            .auth(tokenFor(MAIN))
            .send({ name: 'Hanna Girma', gender: 'female', guardianPhone: '911000002' });

        assert.equal(res.status, 201);
        assert.equal(res.body.request.name, 'Hanna Girma');
        assert.equal(res.body.request.className, 'Year 3 - Red');
        assert.equal(res.body.request.status, 'pending');

        const rows = rowsOf('student_requests');
        assert.equal(rows.length, 1);
        assert.equal(rows[0].class_id, CLASS_A);
        assert.equal(rows[0].requested_by, MAIN.id);

        const nudges = rowsOf('notifications');
        assert.equal(nudges.length, 1);
        assert.equal(nudges[0].user_id, ADMIN.id);
        assert.match(nudges[0].body, /Hanna Girma/);
        assert.match(nudges[0].dedupe_key, /^student_request:/);
    });

    test('subject teachers cannot submit', async () => {
        const res = await request(app).post('/api/student-requests')
            .auth(tokenFor(ENG_T)).send({ name: 'Kid X' });
        assert.equal(res.status, 403);
    });

    test('name is required', async () => {
        const res = await request(app).post('/api/student-requests')
            .auth(tokenFor(MAIN)).send({ name: '  ' });
        assert.equal(res.status, 400);
    });

    test('duplicate pending name in the same class is a conflict', async () => {
        reset({ ...tables(), student_requests: [pendingRow({ name: 'Hanna Girma' })] });
        const res = await request(app).post('/api/student-requests')
            .auth(tokenFor(MAIN)).send({ name: 'hanna girma' });
        assert.equal(res.status, 409);
    });
});

describe('GET /api/student-requests', () => {
    test('admin sees the whole school; main teacher sees only their class', async () => {
        reset({
            ...tables(),
            student_requests: [
                pendingRow({ name: 'Kid A' }),
                pendingRow({ id: 'e7f8a9b0-3333-4444-8888-0000000000bb', class_id: CLASS_B, requested_by: OTHER_MAIN.id, name: 'Kid B' }),
            ],
        });

        const admin = await request(app).get('/api/student-requests?status=pending').auth(tokenFor(ADMIN));
        assert.equal(admin.status, 200);
        assert.equal(admin.body.requests.length, 2);
        assert.equal(admin.body.requests.find((r) => r.classId === CLASS_A).requestedByName, 'Meron');

        const main = await request(app).get('/api/student-requests?status=pending').auth(tokenFor(MAIN));
        assert.equal(main.body.requests.length, 1);
        assert.equal(main.body.requests[0].name, 'Kid A');
    });
});

describe('PATCH /api/student-requests/:id/approve', () => {
    test('creating the student with the next admission + roll numbers and nudging the teacher', async () => {
        reset({ ...tables(), student_requests: [pendingRow()] });

        const res = await request(app).patch(`/api/student-requests/${REQ_ID}/approve`).auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.student.admissionNo, 'BIS2026-316');
        assert.equal(res.body.student.rollNum, 25);
        assert.equal(res.body.request.status, 'approved');

        const students = rowsOf('students');
        const created = students.find((s) => s.name === 'New Child');
        assert.ok(created);
        assert.equal(created.class_id, CLASS_A);
        assert.equal(created.guardian_phone, '911000001');

        const reqRow = rowsOf('student_requests')[0];
        assert.equal(reqRow.status, 'approved');
        assert.equal(reqRow.student_id, created.id);
        assert.equal(reqRow.reviewed_by, ADMIN.id);

        const nudges = rowsOf('notifications');
        assert.equal(nudges.length, 1);
        assert.equal(nudges[0].user_id, MAIN.id);
        assert.match(nudges[0].title, /Student added/);
        assert.match(nudges[0].dedupe_key, /^student_request_review:/);
    });

    test('a second review is refused', async () => {
        reset({ ...tables(), student_requests: [pendingRow({ status: 'approved' })] });
        const res = await request(app).patch(`/api/student-requests/${REQ_ID}/approve`).auth(tokenFor(ADMIN));
        assert.equal(res.status, 409);
    });

    test('main teachers cannot approve', async () => {
        reset({ ...tables(), student_requests: [pendingRow()] });
        const res = await request(app).patch(`/api/student-requests/${REQ_ID}/approve`).auth(tokenFor(MAIN));
        assert.equal(res.status, 403);
    });
});

describe('PATCH /api/student-requests/:id/reject', () => {
    test('decline keeps the note and nudges the teacher', async () => {
        reset({ ...tables(), student_requests: [pendingRow()] });

        const res = await request(app).patch(`/api/student-requests/${REQ_ID}/reject`)
            .auth(tokenFor(ADMIN)).send({ note: 'Please bring the birth certificate first' });

        assert.equal(res.status, 200);
        assert.equal(res.body.request.status, 'rejected');
        assert.equal(rowsOf('student_requests')[0].review_note, 'Please bring the birth certificate first');
        assert.equal(rowsOf('students').length, 1);

        const nudges = rowsOf('notifications');
        assert.equal(nudges.length, 1);
        assert.equal(nudges[0].user_id, MAIN.id);
        assert.match(nudges[0].body, /birth certificate/);
    });
});
