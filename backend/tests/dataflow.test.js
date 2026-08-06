const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = '9a6ff1d0-6d70-4a38-b6e7-c1f4f3dc63aa';
const TERM = '8b70f4f0-5e91-45b0-a3bc-ea5318c41c55';
const CLASS_A = '713bfeaa-d141-44f0-864a-cee594efb105';
const CLASS_B = 'f1854a14-025d-4a9b-b5fe-25fd3ef0aa17';
const SUBJECT = 'e8c792f8-5e0f-4a8b-96e6-9a07ea4c932a';
const CLASS_SUBJECT = '7dd1a63a-9a95-498d-9321-f1c92d07f456';
const THREAD = '9c93f0ec-bc75-47f7-8b08-c02c14cd4595';
const NOTICE = '934a8a55-fc5c-4ef4-bb17-9d7f5e44f5cb';

const isoDate = (offsetDays = 0) =>
    new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

const user = (id, role, name) => ({
    id,
    school_id: SCHOOL,
    name,
    email: `${role}@school.et`,
    password_hash: '$2a$12$placeholderplaceholderplaceholderplaceholderplaceholder',
    role,
    is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin User');
const MAIN = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Main Teacher');
const ASSISTANT = user('43d3dcca-5eba-4682-b5e5-9be5d3e9836c', 'assistant_teacher', 'Assistant Teacher');

const tokenFor = (u) => signToken(u);

beforeEach(() => {
    reset({
        users: [ADMIN, MAIN, ASSISTANT],
        academic_years: [
            {
                id: YEAR,
                school_id: SCHOOL,
                name: '2026/2027',
                starts_on: isoDate(-7),
                ends_on: isoDate(180),
                is_current: true,
            },
        ],
        terms: [
            {
                id: TERM,
                school_id: SCHOOL,
                academic_year_id: YEAR,
                name: 'Term 1',
                starts_on: isoDate(-2),
                ends_on: isoDate(60),
                is_current: true,
            },
        ],
        classes: [
            { id: CLASS_A, school_id: SCHOOL, name: 'Year 3' },
            { id: CLASS_B, school_id: SCHOOL, name: 'Year 4' },
        ],
        class_staff: [
            {
                id: '25b76899-dd52-4224-93f5-ef21eb93dcf0',
                school_id: SCHOOL,
                academic_year_id: YEAR,
                class_id: CLASS_A,
                user_id: MAIN.id,
                position: 'main',
            },
        ],
        subjects: [{ id: SUBJECT, school_id: SCHOOL, name: 'Mathematics', code: 'MATH' }],
        class_subjects: [
            {
                id: CLASS_SUBJECT,
                school_id: SCHOOL,
                academic_year_id: YEAR,
                class_id: CLASS_A,
                subject_id: SUBJECT,
                teacher_id: MAIN.id,
                sessions_per_week: 5,
            },
        ],
        attendance: [
            {
                id: '209ef40f-2aa5-449a-b9cd-d7ecfb99ced4',
                school_id: SCHOOL,
                class_id: CLASS_A,
                student_id: '57132c20-3d92-4c8d-83ce-93f08eb3a083',
                subject_id: null,
                date: isoDate(),
                status: 'present',
            },
        ],
        schemes_of_work: [
            {
                id: 'a5ef5b8b-30ed-4824-86f3-53c716589cd2',
                school_id: SCHOOL,
                term_id: TERM,
                class_subject_id: CLASS_SUBJECT,
                author_id: MAIN.id,
                status: 'submitted',
            },
        ],
        lesson_plans: [
            {
                id: 'de4393fd-875b-463e-bc4c-7e5bbadf0066',
                school_id: SCHOOL,
                term_id: TERM,
                class_subject_id: CLASS_SUBJECT,
                author_id: MAIN.id,
                week_number: 1,
                topic: 'Place value',
                status: 'changes_requested',
            },
        ],
        tasks: [
            {
                id: '95a44c86-4139-41f1-89fb-e8a2bb52fb55',
                school_id: SCHOOL,
                title: 'Submit class inventory',
                assigned_to: MAIN.id,
                assigned_by: ADMIN.id,
                status: 'pending',
                priority: 'high',
                due_on: isoDate(-1),
            },
        ],
        threads: [{ id: THREAD, school_id: SCHOOL, subject: 'Inventory', status: 'open', priority: 'high' }],
        thread_participants: [{ id: '1', thread_id: THREAD, user_id: MAIN.id, last_read_at: isoDate(-10) }],
        messages: [
            {
                id: '2',
                thread_id: THREAD,
                sender_id: ADMIN.id,
                body: 'Please confirm the inventory list.',
                created_at: new Date().toISOString(),
            },
        ],
        notices: [
            {
                id: NOTICE,
                school_id: SCHOOL,
                title: 'Policy acknowledgement',
                audience: 'main_teacher',
                requires_ack: true,
            },
        ],
        notice_receipts: [],
        clinic_visits: [
            {
                id: '4e4f6c93-1598-47dd-ac2b-07a9c4207bb5',
                school_id: SCHOOL,
                leave_status: 'pending',
            },
        ],
    });
});

describe('dashboard data-flow', () => {
    test('requires authentication', async () => {
        const res = await request(app).get('/api/dashboard/data-flow');
        assert.equal(res.status, 401);
    });

    test('summarises branch-wide teacher/admin flow for admins', async () => {
        const res = await request(app).get('/api/dashboard/data-flow').auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.role, 'admin');

        const byId = Object.fromEntries(res.body.flows.map((item) => [item.id, item]));
        assert.equal(byId.staffing.metric, '1/4 class seats');
        assert.equal(byId.attendance.metric, '1/2 classes submitted');
        assert.equal(byId.planning.metric, '1 awaiting review');
        assert.equal(byId.tasks.metric, '1 open task(s)');
        assert.equal(byId.messages.metric, '1 open thread(s)');
        assert.equal(byId.notices.metric, '1 ack(s) outstanding');
        assert.equal(byId.clinic.metric, '1 pending leave');
        assert.ok(res.body.healthScore < 100);
        assert.ok(res.body.openItems > 0);
    });

    test('scopes the flow map to a teacher\'s own responsibilities', async () => {
        const res = await request(app).get('/api/dashboard/data-flow').auth(tokenFor(MAIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.role, 'teacher');

        const byId = Object.fromEntries(res.body.flows.map((item) => [item.id, item]));
        assert.equal(byId.attendance.metric, 'Submitted today');
        assert.equal(byId.tasks.metric, '1 open task(s)');
        assert.equal(byId.messages.metric, '1 unread message(s)');
        assert.equal(byId.notices.metric, '1 ack(s) due');
        assert.ok(res.body.openItems >= 3);
    });
});
