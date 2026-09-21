const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, rowsOf, supabaseStub } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40';
const TERM = 'd2b8f6a4-3c17-4e95-b083-7a1c5e9d2f64';
const CLASS_A = '713bfeaa-d141-44f0-864a-cee594efb105';
const SUBJ_ENG = 'e8c792f8-5e0f-4a8b-96e6-9a07ea4c932a';
const CS_ENG_A = '5a9c1e37-2d48-4b06-9f8e-1c3a5d7b9e02';
const PLAN = 'b8d4f6a2-9e35-4c71-a028-4f6b9d2e8c15';

const user = (id, role, name) => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase()}@school.et`,
    password_hash: '$2a$12$x', role, is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin');
const MAIN = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Meron');
const ENG_T = user('343d1a63-716b-492c-88ca-f466c50aea97', 'subject_teacher', 'Dawit');

const tokenFor = (u) => signToken(u);

const TERM_ROW = {
    id: TERM, school_id: SCHOOL, academic_year_id: YEAR, term_index: 1,
    name: 'Term 1', starts_on: '2026-09-01', ends_on: '2026-11-17', is_current: true,
};

const tables = () => ({
    users: [ADMIN, MAIN, ENG_T],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    terms: [TERM_ROW],
    classes: [{ id: CLASS_A, school_id: SCHOOL, name: 'Year 3A' }],
    subjects: [{ id: SUBJ_ENG, school_id: SCHOOL, name: 'English', code: 'ENG' }],
    class_subjects: [{
        id: CS_ENG_A, school_id: SCHOOL, academic_year_id: YEAR,
        class_id: CLASS_A, subject_id: SUBJ_ENG, teacher_id: ENG_T.id, sessions_per_week: 5,
    }],
    class_staff: [],
    notices: [],
    notice_receipts: [],
    notifications: [],
    assessments: [],
    schemes_of_work: [],
    lesson_plans: [],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

describe('bell feed — GET /api/notifications', () => {
    test('merges announcements and nudges, newest first, with unread count', async () => {
        const { notifications } = tables();
        reset({
            ...tables(),
            notices: [{
                id: '24b5e6c8-93ac-4c96-bf61-0d8e437c6600', school_id: SCHOOL,
                title: 'Assembly on Friday', body: 'Bring the choir registers.',
                audience: 'all', requires_ack: false, is_pinned: false,
                posted_on: '2026-09-22T07:00:00.000Z', created_by: ADMIN.id,
            }],
            notifications: [{
                id: 'eeb266d4-5e99-4215-a8f0-7b061536a51a', school_id: SCHOOL,
                user_id: ENG_T.id, kind: 'plan_reviewed', title: 'Plan approved',
                body: 'Your weekly lesson plan was approved', link: '/app/planning',
                dedupe_key: 'review:x', read_at: null,
                created_at: '2026-09-22T09:00:00.000Z',
            }],
        });

        const res = await request(app).get('/api/notifications').auth(tokenFor(ENG_T));

        assert.equal(res.status, 200);
        assert.equal(res.body.notifications.length, 2);
        assert.equal(res.body.unreadCount, 2);
        // Nudge written at 09:00 sorts before the 07:00 announcement.
        assert.equal(res.body.notifications[0].type, 'nudge');
        assert.equal(res.body.notifications[1].type, 'announcement');
        assert.equal(res.body.notifications[1].title, 'Assembly on Friday');
    });

    test('only shows announcements addressed to the caller and their own nudges', async () => {
        reset({
            ...tables(),
            notices: [{
                id: '24b5e6c8-93ac-4c96-bf61-0d8e437c6600', school_id: SCHOOL,
                title: 'Main teachers only', body: 'Roll-call drill.',
                audience: 'main_teacher', requires_ack: false, is_pinned: false,
                posted_on: '2026-09-22T07:00:00.000Z', created_by: ADMIN.id,
            }],
            notifications: [{
                id: 'eeb266d4-5e99-4215-a8f0-7b061536a51a', school_id: SCHOOL,
                user_id: ADMIN.id, kind: 'mark_column', title: 'New mark column',
                body: '"Quiz 1" opened', link: '/app/marksheets',
                dedupe_key: 'assessment:x', read_at: null,
                created_at: '2026-09-22T09:00:00.000Z',
            }],
        });

        const res = await request(app).get('/api/notifications').auth(tokenFor(ENG_T));

        assert.equal(res.status, 200);
        assert.equal(res.body.notifications.length, 0);
        assert.equal(res.body.unreadCount, 0);
    });

    test('a read announcement or nudge drops out of the unread count', async () => {
        const NOTICE = '24b5e6c8-93ac-4c96-bf61-0d8e437c6600';
        const NUDGE = 'eeb266d4-5e99-4215-a8f0-7b061536a51a';
        reset({
            ...tables(),
            notices: [{
                id: NOTICE, school_id: SCHOOL, title: 'Term dates', body: 'Term ends Nov 17.',
                audience: 'all', requires_ack: false, is_pinned: false,
                posted_on: '2026-09-22T07:00:00.000Z', created_by: ADMIN.id,
            }],
            notifications: [{
                id: NUDGE, school_id: SCHOOL, user_id: MAIN.id, kind: 'plan_reviewed',
                title: 'Changes requested', body: 'Please add week 5', link: '/app/planning',
                dedupe_key: 'review:y', read_at: null, created_at: '2026-09-22T08:00:00.000Z',
            }],
        });

        await request(app).post('/api/notifications/' + NUDGE + '/read').auth(tokenFor(MAIN));
        await request(app).post('/api/notices/' + NOTICE + '/read').send({}).auth(tokenFor(MAIN));

        const res = await request(app).get('/api/notifications').auth(tokenFor(MAIN));
        assert.equal(res.body.unreadCount, 0);
        assert.equal(res.body.notifications.length, 2);
    });

    test('nobody can read somebody else\'s nudge', async () => {
        const NUDGE = 'eeb266d4-5e99-4215-a8f0-7b061536a51a';
        reset({
            ...tables(),
            notifications: [{
                id: NUDGE, school_id: SCHOOL, user_id: MAIN.id, kind: 'plan_reviewed',
                title: 'Changes requested', body: '', link: null,
                dedupe_key: 'review:y', read_at: null, created_at: '2026-09-22T08:00:00.000Z',
            }],
        });

        const res = await request(app).post('/api/notifications/' + NUDGE + '/read').auth(tokenFor(ENG_T));
        assert.equal(res.status, 404);
    });
});

describe('announcement pushing — admins only', () => {
    test('an admin can push an announcement', async () => {
        const res = await request(app)
            .post('/api/notices')
            .auth(tokenFor(ADMIN))
            .send({ title: 'Staff meeting', body: 'Thursday after last period.' });

        assert.equal(res.status, 201);
    });

    test('a main teacher can no longer push an announcement', async () => {
        const res = await request(app)
            .post('/api/notices')
            .auth(tokenFor(MAIN))
            .send({ title: 'From my class', body: 'Biology trip money due.' });

        assert.equal(res.status, 403);
    });
});

describe('nudge producers', () => {
    test('opening a mark column nudges the admins once', async () => {
        // ENG_T teaches ENG in CLASS_A this year.
        const res = await request(app)
            .post('/api/assessments')
            .auth(tokenFor(ENG_T))
            .send({ classId: CLASS_A, subjectId: SUBJ_ENG, label: 'Quiz 1', maxMarks: 10 });

        assert.equal(res.status, 201);

        const nudges = rowsOf('notifications');
        assert.equal(nudges.length, 1);
        assert.equal(nudges[0].user_id, ADMIN.id);
        assert.equal(nudges[0].kind, 'mark_column');
        assert.match(nudges[0].body, /Quiz 1/);
        assert.match(nudges[0].body, /Year 3A/);
        assert.match(nudges[0].body, /Dawit/);

        // The teacher never nudges themselves.
        assert.ok(nudges.every((n) => n.user_id !== ENG_T.id));
    });

    test('an approved plan nudges its author, not the reviewer', async () => {
        reset({
            ...tables(),
            lesson_plans: [{
                id: PLAN, school_id: SCHOOL, author_id: ENG_T.id,
                status: 'submitted', week_of: '2026-09-21', content: 'Phonics.',
            }],
        });
        supabaseStub._rpc.review_planning_document = async () => ({
            data: { id: PLAN, status: 'approved', review_note: null }, error: null,
        });

        const res = await request(app)
            .post(`/api/planning/lesson-plans/${PLAN}/review`)
            .auth(tokenFor(ADMIN))
            .send({ decision: 'approved' });

        assert.equal(res.status, 200);

        const nudges = rowsOf('notifications');
        assert.equal(nudges.length, 1);
        assert.equal(nudges[0].user_id, ENG_T.id);
        assert.equal(nudges[0].kind, 'plan_reviewed');
        assert.equal(nudges[0].title, 'Plan approved');
        assert.match(nudges[0].body, /Admin/);
    });

    test('submitting a plan nudges the admins with a review pointer', async () => {
        reset({
            ...tables(),
            lesson_plans: [{
                id: PLAN, school_id: SCHOOL, author_id: ENG_T.id,
                status: 'draft', week_of: '2026-09-21', content: 'Phonics.',
            }],
        });

        const res = await request(app)
            .post(`/api/planning/lesson-plans/${PLAN}/submit`)
            .auth(tokenFor(ENG_T))
            .send({});

        assert.equal(res.status, 200);

        const nudges = rowsOf('notifications');
        assert.equal(nudges.length, 1);
        assert.equal(nudges[0].user_id, ADMIN.id);
        assert.equal(nudges[0].kind, 'plan_submitted');
        assert.match(nudges[0].body, /submitted for review by Dawit/);
    });

    test('handing in the month\'s attendance nudges the admins', async () => {
        reset({
            ...tables(),
            class_staff: [{
                id: 'f3d42796-f3f1-4c05-9d34-04f132a5b21c', school_id: SCHOOL,
                academic_year_id: YEAR, class_id: CLASS_A, user_id: MAIN.id, position: 'main',
            }],
            attendance_submissions: [],
        });

        // MAIN submits September attendance for their class.
        const res = await request(app)
            .post('/api/attendance/submit')
            .auth(tokenFor(MAIN))
            .send({ classId: CLASS_A, month: '2026-09' });

        assert.equal(res.status, 200);

        const nudges = rowsOf('notifications');
        assert.equal(nudges.length, 1);
        assert.equal(nudges[0].user_id, ADMIN.id);
        assert.equal(nudges[0].kind, 'attendance_submitted');
        assert.match(nudges[0].body, /2026-09/);
        assert.match(nudges[0].body, /Meron/);
    });
});
