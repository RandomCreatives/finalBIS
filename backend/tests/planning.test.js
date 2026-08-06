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
const SCHEME = 'a7c3e591-8d24-4b60-9f17-3e5a8c1d7b04';
const PLAN = 'b8d4f6a2-9e35-4c71-a028-4f6b9d2e8c15';
const EVENT = 'c9e5a713-0f46-4d82-b139-5a7c0e3f9d26';

const user = (id, role, name) => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase()}@school.et`,
    password_hash: '$2a$12$x', role, is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin');
const MAIN = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Meron');
const ENG_T = user('343d1a63-716b-492c-88ca-f466c50aea97', 'subject_teacher', 'Dawit');
const OTHER_T = user('7d3e5f91-4a26-4c80-b5e3-9f1a7c2d6b48', 'subject_teacher', 'Hanna');

const tokenFor = (u) => signToken(u);

// A term running 11 weeks.
const TERM_ROW = {
    id: TERM, school_id: SCHOOL, academic_year_id: YEAR, term_index: 1,
    name: 'Term 1', starts_on: '2026-09-01', ends_on: '2026-11-17', is_current: true,
};

const tables = () => ({
    users: [ADMIN, MAIN, ENG_T, OTHER_T],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    terms: [TERM_ROW],
    classes: [{ id: CLASS_A, school_id: SCHOOL, name: 'Year 3A' }],
    subjects: [{ id: SUBJ_ENG, school_id: SCHOOL, name: 'English', code: 'ENG', taught_by: 'subject_teacher' }],
    class_subjects: [{
        id: CS_ENG_A, school_id: SCHOOL, academic_year_id: YEAR,
        class_id: CLASS_A, subject_id: SUBJ_ENG, teacher_id: ENG_T.id, sessions_per_week: 5,
    }],
    class_staff: [],
    schemes_of_work: [],
    scheme_weeks: [],
    lesson_plans: [],
    calendar_events: [],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

describe('terms', () => {
    test('a term reports its week count from its dates', async () => {
        const res = await request(app).get('/api/terms').auth(tokenFor(MAIN));

        assert.equal(res.status, 200);
        // 1 Sep to 17 Nov inclusive = 78 days = 12 weeks.
        assert.equal(res.body.terms[0].weekCount, 12);
    });

    test('term weeks are listed with their dates', async () => {
        const res = await request(app).get(`/api/terms/${TERM}/weeks`).auth(tokenFor(ENG_T));

        assert.equal(res.status, 200);
        assert.equal(res.body.weeks.length, 12);
        assert.equal(res.body.weeks[0].weekNumber, 1);
        assert.equal(res.body.weeks[0].startsOn, '2026-09-01');
        // A week must never run past the end of term.
        assert.ok(res.body.weeks[11].endsOn <= TERM_ROW.ends_on);
    });

    test('only an admin may create or retire a term', async () => {
        const payload = { name: 'Term 2', termIndex: 2, startsOn: '2027-01-06', endsOn: '2027-03-23' };

        assert.equal((await request(app).post('/api/terms').auth(tokenFor(MAIN)).send(payload)).status, 403);
        assert.equal((await request(app).post('/api/terms').auth(tokenFor(ADMIN)).send(payload)).status, 201);
    });

    test('a term must end after it starts', async () => {
        const res = await request(app)
            .post('/api/terms')
            .auth(tokenFor(ADMIN))
            .send({ name: 'Bad', termIndex: 2, startsOn: '2027-03-23', endsOn: '2027-01-06' });

        assert.equal(res.status, 400);
    });

    test('the current term is reported with the running week', async () => {
        const res = await request(app).get('/api/terms/current').auth(tokenFor(ENG_T));

        assert.equal(res.status, 200);
        assert.equal(res.body.term.id, TERM);
    });

    test('terms require authentication', async () => {
        assert.equal((await request(app).get('/api/terms')).status, 401);
    });
});

describe('schemes of work', () => {
    test('a teacher can start a scheme, scaffolded by week', async () => {
        let called = null;
        supabaseStub._rpc.create_scheme_with_weeks = (args) => {
            called = args;
            return { data: { id: SCHEME, title: args.p_title, week_count: 12, status: 'draft' }, error: null };
        };

        const res = await request(app)
            .post('/api/planning/schemes')
            .auth(tokenFor(ENG_T))
            .send({ classSubjectId: CS_ENG_A, title: 'English — Term 1' });

        assert.equal(res.status, 201);
        assert.equal(res.body.scheme.week_count, 12);
        assert.equal(called.p_author_id, ENG_T.id);
        assert.equal(called.p_term_id, TERM);
    });

    test('a duplicate scheme for the same subject and term is refused', async () => {
        supabaseStub._rpc.create_scheme_with_weeks = () => ({
            data: null, error: { message: 'SCHEME_EXISTS' },
        });

        const res = await request(app)
            .post('/api/planning/schemes')
            .auth(tokenFor(ENG_T))
            .send({ classSubjectId: CS_ENG_A, title: 'Duplicate' });

        assert.equal(res.status, 409);
    });

    test('a teacher sees only their own schemes', async () => {
        reset({
            ...tables(),
            schemes_of_work: [
                { id: SCHEME, school_id: SCHOOL, term_id: TERM, class_subject_id: CS_ENG_A, author_id: ENG_T.id, title: 'Mine', status: 'draft' },
                { id: 'other-scheme', school_id: SCHOOL, term_id: TERM, class_subject_id: CS_ENG_A, author_id: OTHER_T.id, title: 'Theirs', status: 'draft' },
            ],
        });

        const mine = await request(app).get('/api/planning/schemes').auth(tokenFor(ENG_T));
        assert.equal(mine.body.schemes.length, 1);
        assert.equal(mine.body.schemes[0].title, 'Mine');

        // An admin reviews everything.
        const all = await request(app).get('/api/planning/schemes').auth(tokenFor(ADMIN));
        assert.equal(all.body.schemes.length, 2);
    });

    test('another teacher cannot open your scheme', async () => {
        reset({
            ...tables(),
            schemes_of_work: [{ id: SCHEME, school_id: SCHOOL, term_id: TERM, class_subject_id: CS_ENG_A, author_id: ENG_T.id, title: 'Mine', status: 'draft' }],
        });

        const res = await request(app).get(`/api/planning/schemes/${SCHEME}`).auth(tokenFor(OTHER_T));
        assert.equal(res.status, 403);
    });

    test('an approved scheme can no longer be edited by its author', async () => {
        reset({
            ...tables(),
            schemes_of_work: [{ id: SCHEME, school_id: SCHOOL, term_id: TERM, class_subject_id: CS_ENG_A, author_id: ENG_T.id, title: 'Mine', status: 'approved' }],
        });

        const res = await request(app)
            .patch(`/api/planning/schemes/${SCHEME}`)
            .auth(tokenFor(ENG_T))
            .send({ title: 'Sneaky edit' });

        assert.equal(res.status, 409);
    });
});

describe('lesson plans', () => {
    test('a teacher can save a weekly plan', async () => {
        const res = await request(app)
            .put('/api/planning/lesson-plans')
            .auth(tokenFor(ENG_T))
            .send({ classSubjectId: CS_ENG_A, weekNumber: 3, topic: 'Persuasive writing' });

        assert.equal(res.status, 200);
        assert.equal(res.body.lessonPlan.weekNumber, 3);
        assert.equal(rowsOf('lesson_plans').length, 1);
    });

    test('a week beyond the end of term is rejected', async () => {
        const res = await request(app)
            .put('/api/planning/lesson-plans')
            .auth(tokenFor(ENG_T))
            .send({ classSubjectId: CS_ENG_A, weekNumber: 40, topic: 'Too far' });

        assert.equal(res.status, 400);
        assert.match(res.body.message, /only has 12 teaching weeks/);
    });

    test('one teacher cannot overwrite another\'s plan', async () => {
        reset({
            ...tables(),
            lesson_plans: [{
                id: PLAN, school_id: SCHOOL, term_id: TERM, class_subject_id: CS_ENG_A,
                author_id: ENG_T.id, week_number: 3, topic: 'Mine', status: 'draft',
            }],
        });

        const res = await request(app)
            .put('/api/planning/lesson-plans')
            .auth(tokenFor(OTHER_T))
            .send({ classSubjectId: CS_ENG_A, weekNumber: 3, topic: 'Hijacked' });

        assert.equal(res.status, 403);
    });

    test('a plan requires a topic', async () => {
        const res = await request(app)
            .put('/api/planning/lesson-plans')
            .auth(tokenFor(ENG_T))
            .send({ classSubjectId: CS_ENG_A, weekNumber: 2 });

        assert.equal(res.status, 400);
    });
});

describe('submission and review', () => {
    const draft = (status = 'draft') => ({
        ...tables(),
        schemes_of_work: [{
            id: SCHEME, school_id: SCHOOL, term_id: TERM, class_subject_id: CS_ENG_A,
            author_id: ENG_T.id, title: 'English', status,
        }],
    });

    test('the author submits for review', async () => {
        reset(draft());
        const res = await request(app)
            .post(`/api/planning/schemes/${SCHEME}/submit`)
            .auth(tokenFor(ENG_T));

        assert.equal(res.status, 200);
        assert.equal(res.body.document.status, 'submitted');
        assert.ok(res.body.document.submittedAt);
    });

    test('someone else cannot submit it', async () => {
        reset(draft());
        const res = await request(app)
            .post(`/api/planning/schemes/${SCHEME}/submit`)
            .auth(tokenFor(OTHER_T));

        assert.equal(res.status, 403);
    });

    test('submitting twice is refused', async () => {
        reset(draft('submitted'));
        const res = await request(app)
            .post(`/api/planning/schemes/${SCHEME}/submit`)
            .auth(tokenFor(ENG_T));

        assert.equal(res.status, 409);
    });

    test('an admin can approve a submitted scheme', async () => {
        reset(draft('submitted'));
        supabaseStub._rpc.review_planning_document = (args) => ({
            data: { id: args.p_document_id, status: args.p_decision, review_note: args.p_note },
            error: null,
        });

        const res = await request(app)
            .post(`/api/planning/schemes/${SCHEME}/review`)
            .auth(tokenFor(ADMIN))
            .send({ decision: 'approved', note: 'Good coverage' });

        assert.equal(res.status, 200);
        assert.equal(res.body.document.status, 'approved');
    });

    test('a subject teacher cannot review', async () => {
        reset(draft('submitted'));
        const res = await request(app)
            .post(`/api/planning/schemes/${SCHEME}/review`)
            .auth(tokenFor(ENG_T))
            .send({ decision: 'approved' });

        assert.equal(res.status, 403);
    });

    test('reviewing an unsubmitted document is refused', async () => {
        reset(draft());
        supabaseStub._rpc.review_planning_document = () => ({
            data: null, error: { message: 'NOT_SUBMITTED' },
        });

        const res = await request(app)
            .post(`/api/planning/schemes/${SCHEME}/review`)
            .auth(tokenFor(ADMIN))
            .send({ decision: 'approved' });

        assert.equal(res.status, 409);
    });

    test('an invalid decision is rejected', async () => {
        reset(draft('submitted'));
        const res = await request(app)
            .post(`/api/planning/schemes/${SCHEME}/review`)
            .auth(tokenFor(ADMIN))
            .send({ decision: 'maybe' });

        assert.equal(res.status, 400);
    });

    test('the planning overview is for reviewers only', async () => {
        assert.equal((await request(app).get('/api/planning/overview').auth(tokenFor(ENG_T))).status, 403);
        assert.equal((await request(app).get('/api/planning/overview').auth(tokenFor(ADMIN))).status, 200);
    });

    test('the overview flags a missing scheme', async () => {
        const res = await request(app).get('/api/planning/overview').auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.rows.length, 1);
        assert.equal(res.body.rows[0].schemeStatus, 'missing');
        assert.equal(res.body.summary.schemesMissing, 1);
        assert.equal(res.body.term.weekCount, 12);
    });
});

describe('calendar', () => {
    test('an admin can publish an event', async () => {
        const res = await request(app)
            .post('/api/calendar')
            .auth(tokenFor(ADMIN))
            .send({
                title: 'End of term exams', category: 'exam',
                startsOn: '2026-11-09', endsOn: '2026-11-13',
            });

        assert.equal(res.status, 201);
        assert.equal(res.body.event.category, 'exam');
        assert.equal(res.body.event.allDay, true);
    });

    test('a subject teacher cannot publish events', async () => {
        const res = await request(app)
            .post('/api/calendar')
            .auth(tokenFor(ENG_T))
            .send({ title: 'My event', startsOn: '2026-10-01' });

        assert.equal(res.status, 403);
    });

    test('an unknown category is rejected', async () => {
        const res = await request(app)
            .post('/api/calendar')
            .auth(tokenFor(ADMIN))
            .send({ title: 'Odd', category: 'party', startsOn: '2026-10-01' });

        assert.equal(res.status, 400);
    });

    test('role-targeted events are hidden from other roles', async () => {
        reset({
            ...tables(),
            calendar_events: [{
                id: EVENT, school_id: SCHOOL, title: 'Main teacher briefing',
                category: 'meeting', audience: 'main_teacher',
                starts_on: '2026-10-01', ends_on: '2026-10-01', all_day: true,
            }],
        });

        const forMain = await request(app)
            .get('/api/calendar?from=2026-09-01&to=2026-10-31')
            .auth(tokenFor(MAIN));
        assert.equal(forMain.body.events.length, 1);

        const forSubject = await request(app)
            .get('/api/calendar?from=2026-09-01&to=2026-10-31')
            .auth(tokenFor(ENG_T));
        assert.equal(forSubject.body.events.length, 0);
    });

    test('an event spanning the window is included', async () => {
        reset({
            ...tables(),
            calendar_events: [{
                id: EVENT, school_id: SCHOOL, title: 'Half term',
                category: 'holiday', audience: 'all',
                starts_on: '2026-09-25', ends_on: '2026-10-05', all_day: true,
            }],
        });

        // Window sits entirely inside the event.
        const res = await request(app)
            .get('/api/calendar?from=2026-09-28&to=2026-09-30')
            .auth(tokenFor(ADMIN));

        assert.equal(res.body.events.length, 1);
    });

    test('the calendar requires authentication', async () => {
        assert.equal((await request(app).get('/api/calendar')).status, 401);
        assert.equal((await request(app).get('/api/calendar/upcoming')).status, 401);
    });
});
