const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset } = require('./helpers');
const request = require('./request');
const { signToken } = require('../middleware/auth');
const app = require('../app');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = '4f7aeca3-8acb-4a14-b2c7-b5462818211e';
const TERM = '8dc6a92f-1111-4111-8111-0000000000a1';
const CLASS_A = '82e61fbc-9942-415c-909c-f408360a2ef4';
const CLASS_B = '7d3e5f91-4a26-4c80-b5e3-9f1a7c2d6b48';
const STU_A = 'b7180a79-119a-4dfb-9934-aa683058abf1';
const STU_B = 'b7180a79-119a-4dfb-9934-aa683058abf2';

const user = (id, role, name) => ({
    id, school_id: SCHOOL, role, name,
    email: `${id.slice(0, 8)}@school.et`, password_hash: 'x', is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin');
const MAIN_A = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Ms Alpha');
const MAIN_B = user('7d3e5f91-4a26-4c80-b5e3-9f1a7c2d6b48', 'main_teacher', 'Mr Beta');
const SUBJECT = user('b7180a79-119a-4dfb-9934-aa683058abf7', 'subject_teacher', 'Ms Gamma');

const tokenFor = (u) => signToken(u);

beforeEach(() => {
    reset({
        schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
        users: [ADMIN, MAIN_A, MAIN_B, SUBJECT],
        academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
        terms: [{ id: TERM, school_id: SCHOOL, academic_year_id: YEAR, term_index: 1, name: 'Term 1', is_current: true }],
        classes: [
            { id: CLASS_A, school_id: SCHOOL, name: 'Year 3 A', capacity: 25 },
            { id: CLASS_B, school_id: SCHOOL, name: 'Year 3 B', capacity: 25 },
        ],
        class_staff: [
            { id: 'cs-a', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: MAIN_A.id, position: 'main' },
            { id: 'cs-b', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_B, user_id: MAIN_B.id, position: 'main' },
        ],
        students: [
            { id: STU_A, school_id: SCHOOL, name: 'Abel T', admission_no: 'A001', roll_num: 1, class_id: CLASS_A, is_active: true },
            { id: STU_B, school_id: SCHOOL, name: 'Sara K', admission_no: 'A002', roll_num: 2, class_id: CLASS_B, is_active: true },
        ],
        student_payments: [],
        school_settings: [{ school_id: SCHOOL, teacher_payment_enabled: true, updated_by: null }],
    });
});

describe('teacher payment panel visibility', () => {
    test('teachers read the admin-controlled switch', async () => {
        const res = await request(app)
            .get('/api/settings/teacher-payments').auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        assert.equal(res.body.teacherPaymentsEnabled, true);
    });

    test('only an admin can switch teacher payment visibility', async () => {
        const refused = await request(app)
            .patch('/api/settings/teacher-payments').auth(tokenFor(MAIN_A))
            .send({ enabled: false });
        assert.equal(refused.status, 403);

        const changed = await request(app)
            .patch('/api/settings/teacher-payments').auth(tokenFor(ADMIN))
            .send({ enabled: false });
        assert.equal(changed.status, 200);
        assert.equal(changed.body.teacherPaymentsEnabled, false);

        const visible = await request(app)
            .get('/api/settings/teacher-payments').auth(tokenFor(MAIN_A));
        assert.equal(visible.body.teacherPaymentsEnabled, false);

        const blocked = await request(app)
            .put(`/api/students/${STU_A}/payment`).auth(tokenFor(MAIN_A))
            .send({ termId: TERM, status: 'paid_term' });
        assert.equal(blocked.status, 403);
    });
});

describe('PUT /api/students/:id/payment', () => {
    test('the class main teacher records paid_term, stamped with their name', async () => {
        const res = await request(app)
            .put(`/api/students/${STU_A}/payment`).auth(tokenFor(MAIN_A))
            .send({ termId: TERM, status: 'paid_term' });

        assert.equal(res.status, 200);
        assert.equal(res.body.payment.status, 'paid_term');
        assert.equal(res.body.payment.markedBy, 'Ms Alpha');
        assert.ok(res.body.payment.markedAt);
    });

    test('admin records paid_annum for a student in any class', async () => {
        const res = await request(app)
            .put(`/api/students/${STU_B}/payment`).auth(tokenFor(ADMIN))
            .send({ termId: TERM, status: 'paid_annum' });

        assert.equal(res.status, 200);
        assert.equal(res.body.payment.status, 'paid_annum');
    });

    test('another class\'s main teacher and subject teachers are refused', async () => {
        const other = await request(app)
            .put(`/api/students/${STU_A}/payment`).auth(tokenFor(MAIN_B))
            .send({ termId: TERM, status: 'paid_term' });
        assert.equal(other.status, 403);

        const subject = await request(app)
            .put(`/api/students/${STU_A}/payment`).auth(tokenFor(SUBJECT))
            .send({ termId: TERM, status: 'paid_term' });
        assert.equal(subject.status, 403);
    });

    test('recording again replaces the status; setting unpaid clears the row', async () => {
        await request(app).put(`/api/students/${STU_A}/payment`).auth(tokenFor(MAIN_A))
            .send({ termId: TERM, status: 'paid_term' });
        const again = await request(app).put(`/api/students/${STU_A}/payment`).auth(tokenFor(MAIN_A))
            .send({ termId: TERM, status: 'paid_annum' });
        assert.equal(again.status, 200);

        let list = await request(app).get(`/api/students/payments?termId=${TERM}`)
            .auth(tokenFor(ADMIN));
        const rows = list.body.payments.filter((p) => p.studentId === STU_A);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].status, 'paid_annum');

        const cleared = await request(app).put(`/api/students/${STU_A}/payment`).auth(tokenFor(MAIN_A))
            .send({ termId: TERM, status: 'unpaid' });
        assert.equal(cleared.status, 200);
        assert.equal(cleared.body.payment.status, 'unpaid');

        list = await request(app).get(`/api/students/payments?termId=${TERM}`).auth(tokenFor(ADMIN));
        assert.equal(list.body.payments.length, 0);
    });

    test('validation: bad status, missing term, unknown student or term', async () => {
        const badStatus = await request(app).put(`/api/students/${STU_A}/payment`).auth(tokenFor(ADMIN))
            .send({ termId: TERM, status: 'maybe' });
        assert.equal(badStatus.status, 400);

        const noTerm = await request(app).put(`/api/students/${STU_A}/payment`).auth(tokenFor(ADMIN))
            .send({ status: 'paid_term' });
        assert.equal(noTerm.status, 400);

        const ghost = await request(app).put('/api/students/11111111-2222-4333-8444-555555555555/payment').auth(tokenFor(ADMIN))
            .send({ termId: TERM, status: 'paid_term' });
        assert.equal(ghost.status, 404);

        const ghostTerm = await request(app).put(`/api/students/${STU_A}/payment`).auth(tokenFor(ADMIN))
            .send({ termId: '11111111-2222-4333-8444-555555555555', status: 'paid_term' });
        assert.equal(ghostTerm.status, 404);
    });

    test('sign-in is required', async () => {
        const res = await request(app).put(`/api/students/${STU_A}/payment`)
            .send({ termId: TERM, status: 'paid_term' });
        assert.equal(res.status, 401);
    });
});

describe('GET /api/students/payments', () => {
    test('requires a term and narrows by class', async () => {
        await request(app).put(`/api/students/${STU_A}/payment`).auth(tokenFor(MAIN_A))
            .send({ termId: TERM, status: 'paid_term' });
        await request(app).put(`/api/students/${STU_B}/payment`).auth(tokenFor(ADMIN))
            .send({ termId: TERM, status: 'paid_annum' });

        const missing = await request(app).get('/api/students/payments').auth(tokenFor(ADMIN));
        assert.equal(missing.status, 400);

        const all = await request(app).get(`/api/students/payments?termId=${TERM}`).auth(tokenFor(ADMIN));
        assert.equal(all.status, 200);
        assert.equal(all.body.payments.length, 2);

        const classA = await request(app)
            .get(`/api/students/payments?termId=${TERM}&classId=${CLASS_A}`).auth(tokenFor(MAIN_A));
        assert.deepEqual(classA.body.payments.map((p) => p.studentId), [STU_A]);
        assert.equal(classA.body.payments[0].markedBy, 'Ms Alpha');
    });
});
