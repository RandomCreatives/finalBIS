const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, rowsOf, supabaseStub } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40';
const CLASS_A = '713bfeaa-d141-44f0-864a-cee594efb105';
const CLASS_B = '2c4e6a80-1f3d-4b5c-8e7a-9d0f1b2c3e45';
const SUBJECT_EN = 'e8c792f8-5e0f-4a8b-96e6-9a07ea4c932a';
const THREAD = '6d5c4b3a-2e1f-4a09-b8c7-d6e5f4a3b2c1';
const TASK = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';

const user = (id, role, name) => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase()}@school.et`,
    password_hash: '$2a$12$x', role, is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin');
const MAIN = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Meron');
const SUBJ = user('343d1a63-716b-492c-88ca-f466c50aea97', 'subject_teacher', 'Dawit');
const OTHER = user('43d3dcca-5eba-4682-b5e5-9be5d3e9836c', 'assistant_teacher', 'Sara');

const tokenFor = (u) => signToken(u);

const baseTables = () => ({
    users: [ADMIN, MAIN, SUBJ, OTHER],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    classes: [
        { id: CLASS_A, school_id: SCHOOL, name: 'Year 3A' },
        { id: CLASS_B, school_id: SCHOOL, name: 'Year 3B' },
    ],
    subjects: [{ id: SUBJECT_EN, school_id: SCHOOL, name: 'English', code: 'ENG' }],
    class_staff: [],
    class_subjects: [],
    threads: [],
    thread_participants: [],
    messages: [],
    tasks: [],
    notices: [],
    notice_receipts: [],
    students: [],
    attendance: [],
    timetable_slots: [],
});

beforeEach(() => {
    reset(baseTables());
    supabaseStub._rpc = {};
});

describe('teaching assignments', () => {
    test('an admin can assign one subject teacher across several classes', async () => {
        const res = await request(app)
            .post('/api/assignments/subjects/bulk')
            .auth(tokenFor(ADMIN))
            .send({ subjectId: SUBJECT_EN, teacherId: SUBJ.id, classIds: [CLASS_A, CLASS_B], sessionsPerWeek: 5 });

        assert.equal(res.status, 200);
        assert.equal(res.body.assignments.length, 2);

        const rows = rowsOf('class_subjects');
        assert.equal(rows.length, 2);
        assert.ok(rows.every((r) => r.teacher_id === SUBJ.id));
        assert.ok(rows.every((r) => r.academic_year_id === YEAR), 'assignments are year-scoped');
    });

    test('a teacher cannot change assignments', async () => {
        const res = await request(app)
            .post('/api/assignments/subjects/bulk')
            .auth(tokenFor(MAIN))
            .send({ subjectId: SUBJECT_EN, teacherId: SUBJ.id, classIds: [CLASS_A] });

        assert.equal(res.status, 403);
    });

    test('bulk assignment requires at least one class', async () => {
        const res = await request(app)
            .post('/api/assignments/subjects/bulk')
            .auth(tokenFor(ADMIN))
            .send({ subjectId: SUBJECT_EN, teacherId: SUBJ.id, classIds: [] });

        assert.equal(res.status, 400);
    });

    test('class staffing rejects an invalid position', async () => {
        const res = await request(app)
            .put('/api/assignments/class-staff')
            .auth(tokenFor(ADMIN))
            .send({ classId: CLASS_A, userId: MAIN.id, position: 'headmaster' });

        assert.equal(res.status, 400);
    });

    test('workload reporting is admin-only', async () => {
        assert.equal((await request(app).get('/api/assignments/workload').auth(tokenFor(MAIN))).status, 403);
        assert.equal((await request(app).get('/api/assignments/workload').auth(tokenFor(ADMIN))).status, 200);
    });

    test('workload flags classes with no main teacher', async () => {
        const res = await request(app).get('/api/assignments/workload').auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        // Neither class is staffed in the base fixture.
        assert.equal(res.body.gaps.length, 2);
        assert.ok(res.body.gaps.every((g) => g.missingMain));
    });
});

describe('conversations', () => {
    const seedThread = () => {
        reset({
            ...baseTables(),
            threads: [{
                id: THREAD, school_id: SCHOOL, subject: 'Attendance concern',
                category: 'student', priority: 'high', status: 'open',
                created_by: ADMIN.id, last_message_at: '2026-03-01T09:00:00Z',
                created_at: '2026-03-01T09:00:00Z',
            }],
            thread_participants: [
                { id: 'p1', thread_id: THREAD, user_id: ADMIN.id, last_read_at: '2026-03-01T09:00:00Z' },
                { id: 'p2', thread_id: THREAD, user_id: MAIN.id, last_read_at: null },
            ],
            messages: [
                { id: 'm1', thread_id: THREAD, sender_id: ADMIN.id, body: 'Can you look into this?', created_at: '2026-03-01T09:00:00Z' },
            ],
        });
    };

    test('a participant can read the thread', async () => {
        seedThread();
        const res = await request(app).get(`/api/threads/${THREAD}`).auth(tokenFor(MAIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.thread.subject, 'Attendance concern');
        assert.equal(res.body.messages.length, 1);
    });

    test('a non-participant is refused', async () => {
        seedThread();
        const res = await request(app).get(`/api/threads/${THREAD}`).auth(tokenFor(OTHER));

        assert.equal(res.status, 403);
    });

    test('a non-participant cannot post into the thread', async () => {
        seedThread();
        supabaseStub._rpc.post_message = () => ({
            data: null, error: { message: 'NOT_A_PARTICIPANT' },
        });

        const res = await request(app)
            .post(`/api/threads/${THREAD}/messages`)
            .auth(tokenFor(OTHER))
            .send({ body: 'let me in' });

        assert.equal(res.status, 403);
    });

    test('unread counts ignore your own messages', async () => {
        seedThread();
        // ADMIN sent the only message and has read up to it.
        const adminRes = await request(app).get('/api/threads/unread-count').auth(tokenFor(ADMIN));
        assert.equal(adminRes.body.unread, 0);

        // MAIN has never read it.
        const mainRes = await request(app).get('/api/threads/unread-count').auth(tokenFor(MAIN));
        assert.equal(mainRes.body.unread, 1);
    });

    test('opening a thread clears its unread count', async () => {
        seedThread();
        await request(app).get(`/api/threads/${THREAD}`).auth(tokenFor(MAIN));

        const after = await request(app).get('/api/threads/unread-count').auth(tokenFor(MAIN));
        assert.equal(after.body.unread, 0);
    });

    test('the inbox only lists threads you belong to', async () => {
        seedThread();
        const mine = await request(app).get('/api/threads').auth(tokenFor(MAIN));
        assert.equal(mine.body.threads.length, 1);

        const theirs = await request(app).get('/api/threads').auth(tokenFor(OTHER));
        assert.equal(theirs.body.threads.length, 0);
    });

    test('starting a conversation requires a recipient', async () => {
        const res = await request(app)
            .post('/api/threads')
            .auth(tokenFor(ADMIN))
            .send({ subject: 'Hello', body: 'Test', participantIds: [] });

        assert.equal(res.status, 400);
    });

    test('any authenticated teacher can start a conversation', async () => {
        supabaseStub._rpc.create_thread = () => ({
            data: { id: THREAD, subject: 'Question', status: 'open' }, error: null,
        });

        const res = await request(app)
            .post('/api/threads')
            .auth(tokenFor(SUBJ))
            .send({ subject: 'Question', body: 'About Year 3A', participantIds: [ADMIN.id] });

        assert.equal(res.status, 201);
    });
});

describe('tasks', () => {
    const seedTask = (overrides = {}) => {
        reset({
            ...baseTables(),
            tasks: [{
                id: TASK, school_id: SCHOOL, title: 'Submit term marks',
                assigned_to: MAIN.id, assigned_by: ADMIN.id,
                due_on: '2026-03-10', priority: 'high', status: 'pending',
                created_at: '2026-03-01T09:00:00Z', ...overrides,
            }],
        });
    };

    test('an admin can assign a task', async () => {
        const res = await request(app)
            .post('/api/tasks')
            .auth(tokenFor(ADMIN))
            .send({ title: 'Submit term marks', assignedTo: MAIN.id, dueOn: '2026-03-10', priority: 'high' });

        assert.equal(res.status, 201);
        assert.equal(rowsOf('tasks').length, 1);
        assert.equal(rowsOf('tasks')[0].assigned_by, ADMIN.id);
    });

    test('a subject teacher cannot assign tasks to others', async () => {
        const res = await request(app)
            .post('/api/tasks')
            .auth(tokenFor(SUBJ))
            .send({ title: 'Do this', assignedTo: MAIN.id });

        assert.equal(res.status, 403);
    });

    test('the assignee can move a task to done', async () => {
        seedTask();
        const res = await request(app)
            .patch(`/api/tasks/${TASK}`)
            .auth(tokenFor(MAIN))
            .send({ status: 'done' });

        assert.equal(res.status, 200);
        assert.equal(res.body.task.status, 'done');
        assert.ok(res.body.task.completedAt, 'completion is timestamped');
    });

    test('an unrelated teacher cannot touch the task', async () => {
        seedTask();
        const res = await request(app)
            .patch(`/api/tasks/${TASK}`)
            .auth(tokenFor(OTHER))
            .send({ status: 'done' });

        assert.equal(res.status, 403);
    });

    test('the assignee cannot rewrite the task itself', async () => {
        seedTask();
        const res = await request(app)
            .patch(`/api/tasks/${TASK}`)
            .auth(tokenFor(MAIN))
            .send({ title: 'Something easier' });

        assert.equal(res.status, 403);
    });

    test('an overdue task is flagged', async () => {
        seedTask({ due_on: '2020-01-01' });
        const res = await request(app).get('/api/tasks').auth(tokenFor(MAIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.tasks[0].isOverdue, true);
    });

    test('a completed task is never flagged overdue', async () => {
        seedTask({ due_on: '2020-01-01', status: 'done' });
        const res = await request(app).get('/api/tasks').auth(tokenFor(MAIN));

        assert.equal(res.body.tasks[0].isOverdue, false);
    });

    test('rejects an unknown status', async () => {
        seedTask();
        const res = await request(app)
            .patch(`/api/tasks/${TASK}`)
            .auth(tokenFor(MAIN))
            .send({ status: 'almost' });

        assert.equal(res.status, 400);
    });
});

describe('notices with receipts', () => {
    const NOTICE = 'aa11bb22-cc33-4d44-8e55-ff6677889900';

    test('recording a read creates a receipt', async () => {
        reset({
            ...baseTables(),
            notices: [{
                id: NOTICE, school_id: SCHOOL, title: 'Staff meeting', body: 'Friday 4pm',
                audience: 'all', requires_ack: true, is_pinned: false, posted_on: '2026-03-01',
            }],
        });

        const res = await request(app)
            .post(`/api/notices/${NOTICE}/read`)
            .auth(tokenFor(MAIN))
            .send({ acknowledge: true });

        assert.equal(res.status, 200);
        assert.ok(res.body.receipt.acknowledgedAt, 'acknowledgement is recorded');
        assert.equal(rowsOf('notice_receipts').length, 1);
    });

    test('receipt reporting is admin-only', async () => {
        reset({
            ...baseTables(),
            notices: [{
                id: NOTICE, school_id: SCHOOL, title: 'Staff meeting', body: 'x',
                audience: 'all', requires_ack: false, is_pinned: false, posted_on: '2026-03-01',
            }],
        });

        assert.equal((await request(app).get(`/api/notices/${NOTICE}/receipts`).auth(tokenFor(MAIN))).status, 403);
        assert.equal((await request(app).get(`/api/notices/${NOTICE}/receipts`).auth(tokenFor(ADMIN))).status, 200);
    });

    test('a notice aimed at main teachers is hidden from subject teachers', async () => {
        reset({
            ...baseTables(),
            notices: [{
                id: NOTICE, school_id: SCHOOL, title: 'Homeroom briefing', body: 'x',
                audience: 'main_teacher', requires_ack: false, is_pinned: false, posted_on: '2026-03-01',
            }],
        });

        const main = await request(app).get('/api/notices').auth(tokenFor(MAIN));
        assert.equal(main.body.notices.length, 1);

        const subject = await request(app).get('/api/notices').auth(tokenFor(SUBJ));
        assert.equal(subject.body.notices.length, 0);
    });
});

describe('attendance', () => {
    test('marking a register goes through the atomic DB function', async () => {
        let called = null;
        supabaseStub._rpc.mark_attendance = (args) => {
            called = args;
            return { data: { count: 2 }, error: null };
        };

        const res = await request(app)
            .post('/api/attendance')
            .auth(tokenFor(MAIN))
            .send({
                classId: CLASS_A,
                date: '2026-03-01',
                records: [
                    { studentId: '57132c20-3d92-4c8d-83ce-93f08eb3a083', status: 'present' },
                    { studentId: '9a1b2c3d-4e5f-4071-8293-a4b5c6d7e8f9', status: 'absent' },
                ],
            });

        assert.equal(res.status, 201);
        assert.equal(res.body.count, 2);
        assert.ok(called, 'mark_attendance RPC should be used');
        // Homeroom register => no subject.
        assert.equal(called.p_subject_id, null);
        assert.equal(called.p_records.length, 2);
    });

    test('a subject register passes the subject through', async () => {
        let called = null;
        supabaseStub._rpc.mark_attendance = (args) => {
            called = args;
            return { data: { count: 1 }, error: null };
        };

        await request(app)
            .post('/api/attendance')
            .auth(tokenFor(SUBJ))
            .send({
                classId: CLASS_A,
                subjectId: SUBJECT_EN,
                date: '2026-03-01',
                records: [{ studentId: '57132c20-3d92-4c8d-83ce-93f08eb3a083', status: 'late' }],
            });

        assert.equal(called.p_subject_id, SUBJECT_EN);
    });
});

describe('personal dashboard', () => {
    test('every signed-in teacher can load their own dashboard', async () => {
        const res = await request(app).get('/api/dashboard/me').auth(tokenFor(SUBJ));

        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.homerooms));
        assert.ok(Array.isArray(res.body.teachingSubjects));
        assert.ok(Array.isArray(res.body.openTasks));
    });

    test('the school-wide dashboard stays admin-only', async () => {
        assert.equal((await request(app).get('/api/dashboard/summary').auth(tokenFor(MAIN))).status, 403);
        assert.equal((await request(app).get('/api/dashboard/summary').auth(tokenFor(ADMIN))).status, 200);
    });

    test('a teacher dashboard surfaces their assigned classes', async () => {
        reset({
            ...baseTables(),
            class_staff: [{
                id: 'cs1', school_id: SCHOOL, academic_year_id: YEAR,
                class_id: CLASS_A, user_id: MAIN.id, position: 'main',
            }],
        });

        const res = await request(app).get('/api/dashboard/me').auth(tokenFor(MAIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.homerooms.length, 1);
        assert.equal(res.body.homerooms[0].position, 'main');
    });

    test('unauthenticated access is refused', async () => {
        assert.equal((await request(app).get('/api/dashboard/me')).status, 401);
        assert.equal((await request(app).get('/api/threads')).status, 401);
        assert.equal((await request(app).get('/api/tasks')).status, 401);
        assert.equal((await request(app).get('/api/assignments/workload')).status, 401);
    });
});
