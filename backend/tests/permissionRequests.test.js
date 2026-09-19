const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');

const { reset } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const ADMIN = 'd4f1a2b8-7c63-4e59-9f21-3a8e6b0d5c74';
const MAIN = 'f6a3b4d0-9e85-4a7b-b143-5c0a8d2f9e06';
const SUBJECT = 'e5f2a3c9-8d74-4f6a-a032-4b9f7c1e8d95';
const CLASS = '7a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d';
const STUDENT = '8b2c3d4e-5f6a-4b8c-9d0e-1f2a3b4c5d6e';
const OTHER_STUDENT = '9c3d4e5f-6a7b-4c9d-8e1f-2a3b4c5d6e7f';
const YEAR = '4f7aeca3-8acb-4a14-b2c7-b5462818211e';
const OTHER_TEACHER = 'eeee4444-4444-4444-8444-444444444444';
const REQUEST = 'aaaabbbb-cccc-4ddd-8eee-ffff00001111';

const seedAll = () => reset({
    users: [
        { id: ADMIN, school_id: SCHOOL, name: 'Admin', email: 'a@a.et', password_hash: 'x', role: 'admin', is_active: true },
        { id: MAIN, school_id: SCHOOL, name: 'Main Teacher', email: 'm@m.et', password_hash: 'x', role: 'main_teacher', is_active: true },
        { id: SUBJECT, school_id: SCHOOL, name: 'Subject Teacher', email: 's@s.et', password_hash: 'x', role: 'subject_teacher', is_active: true },
    ],
    academic_years: [{ id: YEAR, school_id: SCHOOL, is_current: true }],
    classes: [{ id: CLASS, school_id: SCHOOL, name: 'Year 3 - Blue' }],
    students: [
        { id: STUDENT, school_id: SCHOOL, class_id: CLASS, name: 'Hanna Y.' },
        { id: OTHER_STUDENT, school_id: SCHOOL, class_id: 'some-other-class', name: 'Not In Class' },
    ],
    class_staff: [
        { id: 'seat-1', school_id: SCHOOL, class_id: CLASS, user_id: MAIN, academic_year_id: YEAR, position: 'main' },
    ],
});

const seedWithRequest = () => reset({
    users: [
        { id: ADMIN, school_id: SCHOOL, name: 'Admin', email: 'a@a.et', password_hash: 'x', role: 'admin', is_active: true },
        { id: MAIN, school_id: SCHOOL, name: 'Main Teacher', email: 'm@m.et', password_hash: 'x', role: 'main_teacher', is_active: true },
        { id: OTHER_TEACHER, school_id: SCHOOL, name: 'Other Teacher', email: 'o@o.et', password_hash: 'x', role: 'subject_teacher', is_active: true },
    ],
    academic_years: [{ id: YEAR, school_id: SCHOOL, is_current: true }],
    classes: [{ id: CLASS, school_id: SCHOOL, name: 'Year 3 - Blue' }],
    students: [{ id: STUDENT, school_id: SCHOOL, class_id: CLASS, name: 'Hanna Y.' }],
    permission_requests: [{
        id: REQUEST, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS,
        student_id: STUDENT, requester_id: MAIN, reason: 'Hanna leaves at 10:30 for a dental check-up.',
        pickup_time: '2026-09-22T10:30:00.000Z', status: 'pending',
        created_at: '2026-09-21T08:00:00Z', updated_at: '2026-09-21T08:00:00Z',
    }],
});

const tokenFor = (id, role) =>
    signToken({ id, role }, { audience: 'auth' });

/* ── create ─────────────────────────────────────────────────────────── */

describe('POST /api/permission-requests', () => {
    beforeEach(seedAll);

    test('main teacher creates a pending request for a student of their class', async () => {
        const res = await request(app)
            .post('/api/permission-requests')
            .auth(tokenFor(MAIN, 'main_teacher'))
            .send({ classId: CLASS, studentId: STUDENT, reason: 'Parent collects Hanna at 10:30 for the dentist', pickupTime: '2026-09-22T10:30:00Z' });
        assert.equal(res.status, 201);
        assert.equal(res.body.request.status, 'pending');
        assert.equal(res.body.request.student.name, 'Hanna Y.');
        assert.equal(res.body.request.class.name, 'Year 3 - Blue');
        assert.match(res.body.request.reason, /dentist/);
    });

    test('rejects a student who is not enrolled in the class', async () => {
        const res = await request(app)
            .post('/api/permission-requests')
            .auth(tokenFor(MAIN, 'main_teacher'))
            .send({ classId: CLASS, studentId: OTHER_STUDENT, reason: 'Early pickup please' });
        assert.equal(res.status, 400);
        assert.match(res.body.message, /not enrolled/);
    });

    test('a teacher who is not the seated main teacher cannot request', async () => {
        const res = await request(app)
            .post('/api/permission-requests')
            .auth(tokenFor(SUBJECT, 'subject_teacher'))
            .send({ classId: CLASS, studentId: STUDENT, reason: 'Early pickup please' });
        assert.equal(res.status, 403);
        assert.match(res.body.message, /main teacher/);
    });

    test('admin may create for any class', async () => {
        const res = await request(app)
            .post('/api/permission-requests')
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ classId: CLASS, studentId: STUDENT, reason: 'Family travel, approved verbally' });
        assert.equal(res.status, 201);
    });

    test('missing student is rejected', async () => {
        const res = await request(app)
            .post('/api/permission-requests')
            .auth(tokenFor(MAIN, 'main_teacher'))
            .send({ classId: CLASS, reason: 'No student given' });
        assert.equal(res.status, 400);
    });
});

/* ── list scoping ───────────────────────────────────────────────────── */

describe('GET /api/permission-requests', () => {
    beforeEach(seedWithRequest);

    test('teacher sees only own requests', async () => {
        const res = await request(app)
            .get('/api/permission-requests')
            .auth(tokenFor(MAIN, 'main_teacher'));
        assert.equal(res.status, 200);
        assert.equal(res.body.requests.length, 1);
        assert.equal(res.body.requests[0].reason, 'Hanna leaves at 10:30 for a dental check-up.');
    });

    test('another teacher does not see it', async () => {
        const res = await request(app)
            .get('/api/permission-requests')
            .auth(tokenFor(OTHER_TEACHER, 'subject_teacher'));
        assert.equal(res.status, 200);
        assert.equal(res.body.requests.length, 0);
    });

    test('admin sees all requests and can filter by status', async () => {
        const all = await request(app).get('/api/permission-requests').auth(tokenFor(ADMIN, 'admin'));
        assert.equal(all.status, 200);
        assert.equal(all.body.requests.length, 1);

        const onlyDeclined = await request(app)
            .get('/api/permission-requests?status=declined').auth(tokenFor(ADMIN, 'admin'));
        assert.equal(onlyDeclined.body.requests.length, 0);
    });
});

/* ── review flow ────────────────────────────────────────────────────── */

describe('POST /api/permission-requests/:id/review', () => {
    beforeEach(seedWithRequest);

    test('admin approves with a note', async () => {
        const res = await request(app)
            .post(`/api/permission-requests/${REQUEST}/review`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ decision: 'approved', note: 'OK — inform the security desk.' });
        assert.equal(res.status, 200);
        assert.equal(res.body.request.status, 'approved');
        assert.equal(res.body.request.reviewNote, 'OK — inform the security desk.');
        assert.ok(res.body.request.reviewedAt);
    });

    test('admin declines', async () => {
        const res = await request(app)
            .post(`/api/permission-requests/${REQUEST}/review`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ decision: 'declined', note: 'Mid-exam week, sorry.' });
        assert.equal(res.status, 200);
        assert.equal(res.body.request.status, 'declined');
    });

    test('only admins can review', async () => {
        const res = await request(app)
            .post(`/api/permission-requests/${REQUEST}/review`)
            .auth(tokenFor(MAIN, 'main_teacher'))
            .send({ decision: 'approved' });
        assert.equal(res.status, 403);
    });

    test('reviewing twice conflicts', async () => {
        await request(app)
            .post(`/api/permission-requests/${REQUEST}/review`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ decision: 'approved' });
        const again = await request(app)
            .post(`/api/permission-requests/${REQUEST}/review`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ decision: 'declined' });
        assert.equal(again.status, 409);
        assert.match(again.body.message, /already approved/);
    });

    test('invalid decision is rejected', async () => {
        const res = await request(app)
            .post(`/api/permission-requests/${REQUEST}/review`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ decision: 'maybe' });
        assert.equal(res.status, 400);
    });
});

/* ── withdraw ───────────────────────────────────────────────────────── */

describe('DELETE /api/permission-requests/:id', () => {
    beforeEach(seedWithRequest);

    test('requester withdraws a pending request', async () => {
        const res = await request(app)
            .delete(`/api/permission-requests/${REQUEST}`)
            .auth(tokenFor(MAIN, 'main_teacher'));
        assert.equal(res.status, 200);

        const list = await request(app).get('/api/permission-requests').auth(tokenFor(MAIN, 'main_teacher'));
        assert.equal(list.body.requests.length, 0);
    });

    test('a reviewed request cannot be withdrawn', async () => {
        await request(app)
            .post(`/api/permission-requests/${REQUEST}/review`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ decision: 'approved' });
        const res = await request(app)
            .delete(`/api/permission-requests/${REQUEST}`)
            .auth(tokenFor(MAIN, 'main_teacher'));
        assert.equal(res.status, 409);
    });
});

/* ── badge counts ───────────────────────────────────────────────────── */

describe('GET /api/communications/badge-counts', () => {
    test('admin sees pending permission requests and unresolved store requests', async () => {
        reset({
            users: [{ id: ADMIN, school_id: SCHOOL, name: 'Admin', email: 'a@a.et', password_hash: 'x', role: 'admin', is_active: true }],
            classes: [{ id: CLASS, school_id: SCHOOL, name: 'Year 3 - Blue' }],
            students: [{ id: STUDENT, school_id: SCHOOL, class_id: CLASS, name: 'Hanna Y.' }],
            permission_requests: [
                { id: REQUEST, school_id: SCHOOL, class_id: CLASS, student_id: STUDENT, requester_id: 't', reason: 'x', status: 'pending', created_at: '2026-09-21T08:00:00Z' },
                { id: 'bbbbcccc-dddd-4eee-afff-000011112222', school_id: SCHOOL, class_id: CLASS, student_id: STUDENT, requester_id: 't', reason: 'y', status: 'approved', reviewed_by: ADMIN, created_at: '2026-09-21T09:00:00Z' },
            ],
            store_requests: [
                { id: 's1', school_id: SCHOOL, request_number: 'REQ-2026-0001', requester_id: 't', items: [], status: 'pending' },
                { id: 's2', school_id: SCHOOL, request_number: 'REQ-2026-0002', requester_id: 't', items: [], status: 'store_approved' },
                { id: 's3', school_id: SCHOOL, request_number: 'REQ-2026-0003', requester_id: 't', items: [], status: 'approved' },
            ],
        });
        const res = await request(app)
            .get('/api/communications/badge-counts')
            .auth(tokenFor(ADMIN, 'admin'));
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.badgeCounts, {
            storeRequestsPending: 2,      // pending + store_approved
            permissionRequestsPending: 1,
            conductReportsPending: 0,
        });
    });

    test('non-admins are not offered badge counts', async () => {
        seedAll();
        const res = await request(app)
            .get('/api/communications/badge-counts')
            .auth(tokenFor(MAIN, 'main_teacher'));
        assert.equal(res.status, 403);
    });
});
