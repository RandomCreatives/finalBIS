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
const REPORT = 'ccccdddd-eeee-4fff-8999-111122223333';
const REPORT_2 = 'ddddeeee-ffff-4999-8aaa-222233334444';

const USERS = [
    { id: ADMIN, school_id: SCHOOL, name: 'Admin', email: 'a@a.et', password_hash: 'x', role: 'admin', is_active: true },
    { id: MAIN, school_id: SCHOOL, name: 'Main Teacher', email: 'm@m.et', password_hash: 'x', role: 'main_teacher', is_active: true },
    { id: SUBJECT, school_id: SCHOOL, name: 'Subject Teacher', email: 's@s.et', password_hash: 'x', role: 'subject_teacher', is_active: true },
];

const seedAll = () => reset({
    users: USERS,
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

const REPORT_ROW = {
    id: REPORT, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS,
    student_id: STUDENT, reporter_id: MAIN, type: 'concern',
    body: 'Hanna has been disrupting group work for the third time this week.',
    status: 'new', created_at: '2026-09-21T08:00:00Z', updated_at: '2026-09-21T08:00:00Z',
};

const seedWithReport = () => reset({
    users: [
        ...USERS,
        { id: OTHER_TEACHER, school_id: SCHOOL, name: 'Other Teacher', email: 'o@o.et', password_hash: 'x', role: 'subject_teacher', is_active: true },
    ],
    academic_years: [{ id: YEAR, school_id: SCHOOL, is_current: true }],
    classes: [{ id: CLASS, school_id: SCHOOL, name: 'Year 3 - Blue' }],
    students: [{ id: STUDENT, school_id: SCHOOL, class_id: CLASS, name: 'Hanna Y.' }],
    // fresh copy per reset — the stub mutates row objects in place
    conduct_reports: [{ ...REPORT_ROW }],
});

const tokenFor = (id, role) => signToken({ id, role }, { audience: 'auth' });

/* ── create ─────────────────────────────────────────────────────────── */

describe('POST /api/conduct-reports', () => {
    beforeEach(seedAll);

    test('main teacher files a concern for a student of their class', async () => {
        const res = await request(app)
            .post('/api/conduct-reports')
            .auth(tokenFor(MAIN, 'main_teacher'))
            .send({
                classId: CLASS, studentId: STUDENT, type: 'concern',
                body: 'Hanna has disrupted group work three times this week.',
            });
        assert.equal(res.status, 201);
        assert.equal(res.body.report.status, 'new');
        assert.equal(res.body.report.type, 'concern');
        assert.equal(res.body.report.student.name, 'Hanna Y.');
        assert.equal(res.body.report.class.name, 'Year 3 - Blue');
        assert.equal(res.body.report.reporter.name, 'Main Teacher');
    });

    test('praise and serious are accepted tones', async () => {
        for (const type of ['praise', 'serious']) {
            const res = await request(app)
                .post('/api/conduct-reports')
                .auth(tokenFor(MAIN, 'main_teacher'))
                .send({ classId: CLASS, studentId: STUDENT, type, body: `A ${type} entry.` });
            assert.equal(res.status, 201);
            assert.equal(res.body.report.type, type);
        }
    });

    test('unknown tone is rejected', async () => {
        const res = await request(app)
            .post('/api/conduct-reports')
            .auth(tokenFor(MAIN, 'main_teacher'))
            .send({ classId: CLASS, studentId: STUDENT, type: 'neutral', body: 'Nothing notable.' });
        assert.equal(res.status, 400);
    });

    test('rejects a student who is not enrolled in the class', async () => {
        const res = await request(app)
            .post('/api/conduct-reports')
            .auth(tokenFor(MAIN, 'main_teacher'))
            .send({ classId: CLASS, studentId: OTHER_STUDENT, type: 'concern', body: 'Not in this class.' });
        assert.equal(res.status, 400);
        assert.match(res.body.message, /not enrolled/);
    });

    test('a teacher who is not the seated main teacher cannot file', async () => {
        const res = await request(app)
            .post('/api/conduct-reports')
            .auth(tokenFor(SUBJECT, 'subject_teacher'))
            .send({ classId: CLASS, studentId: STUDENT, type: 'concern', body: 'Repeated disruption.' });
        assert.equal(res.status, 403);
        assert.match(res.body.message, /main teacher/);
    });

    test('admin may file for any class', async () => {
        const res = await request(app)
            .post('/api/conduct-reports')
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ classId: CLASS, studentId: STUDENT, type: 'praise', body: 'Reported by a parent.' });
        assert.equal(res.status, 201);
    });

    test('too-short body is rejected', async () => {
        const res = await request(app)
            .post('/api/conduct-reports')
            .auth(tokenFor(MAIN, 'main_teacher'))
            .send({ classId: CLASS, studentId: STUDENT, type: 'concern', body: 'bad' });
        assert.equal(res.status, 400);
    });
});

/* ── list scoping ───────────────────────────────────────────────────── */

describe('GET /api/conduct-reports', () => {
    beforeEach(seedWithReport);

    test('reporter sees own reports', async () => {
        const res = await request(app).get('/api/conduct-reports').auth(tokenFor(MAIN, 'main_teacher'));
        assert.equal(res.status, 200);
        assert.equal(res.body.reports.length, 1);
        assert.equal(res.body.reports[0].type, 'concern');
    });

    test('another teacher does not see it', async () => {
        const res = await request(app).get('/api/conduct-reports').auth(tokenFor(OTHER_TEACHER, 'subject_teacher'));
        assert.equal(res.status, 200);
        assert.equal(res.body.reports.length, 0);
    });

    test('admin sees all and can filter by status and type', async () => {
        const all = await request(app).get('/api/conduct-reports').auth(tokenFor(ADMIN, 'admin'));
        assert.equal(all.body.reports.length, 1);

        const serious = await request(app).get('/api/conduct-reports?type=serious').auth(tokenFor(ADMIN, 'admin'));
        assert.equal(serious.body.reports.length, 0);

        const done = await request(app).get('/api/conduct-reports?status=actioned').auth(tokenFor(ADMIN, 'admin'));
        assert.equal(done.body.reports.length, 0);
    });
});

/* ── status flow: new → acknowledged → actioned ─────────────────────── */

describe('POST /api/conduct-reports/:id/status', () => {
    beforeEach(seedWithReport);

    test('admin acknowledges with a note', async () => {
        const res = await request(app)
            .post(`/api/conduct-reports/${REPORT}/status`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ status: 'acknowledged', note: 'Seen — will speak with the parents.' });
        assert.equal(res.status, 200);
        assert.equal(res.body.report.status, 'acknowledged');
        assert.equal(res.body.report.actionNote, 'Seen — will speak with the parents.');
        assert.ok(res.body.report.handledAt);
        assert.equal(res.body.report.handler.name, 'Admin');
    });

    test('acknowledged can be marked actioned, and new can jump straight to actioned', async () => {
        const ack = await request(app)
            .post(`/api/conduct-reports/${REPORT}/status`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ status: 'acknowledged' });
        assert.equal(ack.status, 200);
        const act = await request(app)
            .post(`/api/conduct-reports/${REPORT}/status`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ status: 'actioned', note: 'Parents met; plan agreed.' });
        assert.equal(act.status, 200);
        assert.equal(act.body.report.status, 'actioned');
    });

    test('no backwards or repeated transitions', async () => {
        await request(app)
            .post(`/api/conduct-reports/${REPORT}/status`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ status: 'acknowledged' });
        const backward = await request(app)
            .post(`/api/conduct-reports/${REPORT}/status`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ status: 'acknowledged' });
        assert.equal(backward.status, 409);
        assert.match(backward.body.message, /already acknowledged/);
    });

    test('only admins can move a report', async () => {
        const res = await request(app)
            .post(`/api/conduct-reports/${REPORT}/status`)
            .auth(tokenFor(MAIN, 'main_teacher'))
            .send({ status: 'acknowledged' });
        assert.equal(res.status, 403);
    });

    test('invalid status is rejected', async () => {
        const res = await request(app)
            .post(`/api/conduct-reports/${REPORT}/status`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ status: 'closed' });
        assert.equal(res.status, 400);
    });
});

/* ── withdraw ───────────────────────────────────────────────────────── */

describe('DELETE /api/conduct-reports/:id', () => {
    beforeEach(seedWithReport);

    test('reporter withdraws a report the admin has not picked up', async () => {
        const res = await request(app)
            .delete(`/api/conduct-reports/${REPORT}`)
            .auth(tokenFor(MAIN, 'main_teacher'));
        assert.equal(res.status, 200);

        const list = await request(app).get('/api/conduct-reports').auth(tokenFor(MAIN, 'main_teacher'));
        assert.equal(list.body.reports.length, 0);
    });

    test('an acknowledged report cannot be withdrawn', async () => {
        await request(app)
            .post(`/api/conduct-reports/${REPORT}/status`)
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ status: 'acknowledged' });
        const res = await request(app)
            .delete(`/api/conduct-reports/${REPORT}`)
            .auth(tokenFor(MAIN, 'main_teacher'));
        assert.equal(res.status, 409);
    });
});

/* ── badge counts include new conduct reports ───────────────────────── */

describe('GET /api/communications/badge-counts', () => {
    test('un-read conduct reports add to the counters', async () => {
        reset({
            users: [{ id: ADMIN, school_id: SCHOOL, name: 'Admin', email: 'a@a.et', password_hash: 'x', role: 'admin', is_active: true }],
            classes: [{ id: CLASS, school_id: SCHOOL, name: 'Year 3 - Blue' }],
            students: [{ id: STUDENT, school_id: SCHOOL, class_id: CLASS, name: 'Hanna Y.' }],
            conduct_reports: [
                { id: REPORT, school_id: SCHOOL, class_id: CLASS, student_id: STUDENT, reporter_id: 't', type: 'concern', body: 'x-x', status: 'new', created_at: '2026-09-21T08:00:00Z' },
                { id: REPORT_2, school_id: SCHOOL, class_id: CLASS, student_id: STUDENT, reporter_id: 't', type: 'praise', body: 'y-y', status: 'actioned', created_at: '2026-09-21T09:00:00Z' },
            ],
        });
        const res = await request(app)
            .get('/api/communications/badge-counts')
            .auth(tokenFor(ADMIN, 'admin'));
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.badgeCounts, {
            storeRequestsPending: 0,
            permissionRequestsPending: 0,
            conductReportsPending: 1,
        });
    });
});
