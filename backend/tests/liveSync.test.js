const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, rowsOf } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const ADMIN = {
    id: 'b7180a79-119a-4dfb-9934-aa683058abf6',
    school_id: SCHOOL,
    name: 'Admin',
    email: 'admin@school.et',
    password_hash: '$2a$12$x',
    role: 'admin',
    is_active: true,
};
const token = signToken(ADMIN);

const tables = () => ({
    users: [ADMIN],
    students: [{
        id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        school_id: SCHOOL,
        name: 'Abel T',
        class_id: '713bfeaa-d141-44f0-864a-cee594efb105',
        roll_num: 1,
        is_active: true,
    }],
    student_requests: [],
    classes: [{ id: '713bfeaa-d141-44f0-864a-cee594efb105', school_id: SCHOOL, name: 'Year 3 - Blue' }],
    class_staff: [],
    class_subjects: [],
    assessments: [],
    assessment_marks: [],
    marksheets: [],
});

beforeEach(() => reset(tables()));

describe('GET /api/sync/version', () => {
    test('requires authentication and returns no-cache response headers', async () => {
        const anonymous = await request(app).get('/api/sync/version');
        assert.equal(anonymous.status, 401);

        const authenticated = await request(app).get('/api/sync/version').auth(token);
        assert.equal(authenticated.status, 200);
        assert.match(authenticated.headers['cache-control'], /no-store/);
        assert.ok(authenticated.body.studentsVersion);
        assert.ok(authenticated.body.assignmentsVersion);
    });

    test('the version is stable until roster, assignment, or marks data changes', async () => {
        const initial = await request(app).get('/api/sync/version').auth(token);
        assert.equal(initial.status, 200);

        const unchanged = await request(app).get('/api/sync/version').auth(token);
        assert.equal(unchanged.body.version, initial.body.version);

        rowsOf('students').push({
            id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
            school_id: SCHOOL,
            name: 'New Pupil',
            class_id: '713bfeaa-d141-44f0-864a-cee594efb105',
            roll_num: 2,
            is_active: true,
        });
        const rosterChanged = await request(app).get('/api/sync/version').auth(token);
        assert.notEqual(rosterChanged.body.studentsVersion, initial.body.studentsVersion);
        assert.notEqual(rosterChanged.body.version, initial.body.version);

        rowsOf('class_subjects').push({
            id: 'f6a7b8c9-d0e1-4f2a-8b3c-4d5e6f708192',
            school_id: SCHOOL,
            class_id: '713bfeaa-d141-44f0-864a-cee594efb105',
            teacher_id: ADMIN.id,
            academic_year_id: 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40',
        });
        const assignmentChanged = await request(app).get('/api/sync/version').auth(token);
        assert.notEqual(assignmentChanged.body.assignmentsVersion, rosterChanged.body.assignmentsVersion);
        assert.notEqual(assignmentChanged.body.version, rosterChanged.body.version);

        rowsOf('assessment_marks').push({
            id: 'c3d4e5f6-a7b8-4c9d-9e1f-2a3b4c5d6e7f',
            school_id: SCHOOL,
            assessment_id: 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f70',
            student_id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
            marks: 8,
            updated_at: '2026-10-28T10:00:00.000Z',
        });
        const marksChanged = await request(app).get('/api/sync/version').auth(token);
        assert.notEqual(marksChanged.body.assessmentMarksVersion, initial.body.assessmentMarksVersion);
        assert.notEqual(marksChanged.body.version, rosterChanged.body.version);
    });

    test('sync version is scoped to the authenticated school', async () => {
        rowsOf('students').push({
            id: 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081',
            school_id: 'another-school',
            name: 'Out of scope',
            class_id: null,
            roll_num: null,
            is_active: true,
        });

        const inScope = await request(app).get('/api/sync/version').auth(token);
        assert.equal(inScope.status, 200);
        assert.ok(inScope.body.studentsVersion);
    });
});
