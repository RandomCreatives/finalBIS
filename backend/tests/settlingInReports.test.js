const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, rowsOf, supabaseStub, missingTableError } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');
const { getSettlingInTemplate } = require('../config/settlingInCriteria');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const OTHER_SCHOOL = '9f8e7d6c-5b4a-4321-9876-543210fedcba';
const TERM_1 = '6b2f4d08-3b7a-4a5e-9d2c-1f8e6a4b0c93';
const CLASS_Y3 = '713bfeaa-d141-44f0-864a-cee594efb105';
const CLASS_Y4 = '2c4e6a80-1f3d-4b5c-8e7a-9d0f1b2c3e45';
const CLASS_Y5 = 'd76f2027-0e2b-4e65-9937-c2705ddf0314';
const STU_Y3 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const STU_Y4 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const STU_Y5 = 'f6a7b8c9-d0e1-4f2a-b3c4-d5e6f7a8b9c0';
const STU_OTHER_SCHOOL = 'c3d4e5f6-a7b8-4c9d-9e1f-2a3b4c5d6e7f';

const user = (id, role, name) => ({
    id,
    school_id: SCHOOL,
    name,
    email: `${name.toLowerCase()}@school.et`,
    password_hash: '$2a$12$x',
    role,
    is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin');
const MAIN = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Meron');
const SUBJECT = user('343d1a63-716b-492c-88ca-f466c50aea97', 'subject_teacher', 'Dawit');
const tokenFor = (account) => signToken(account);

const tables = () => ({
    users: [ADMIN, MAIN, SUBJECT],
    classes: [
        { id: CLASS_Y3, school_id: SCHOOL, name: 'Year 3 - Blue', year_level: 3 },
        { id: CLASS_Y4, school_id: SCHOOL, name: 'Year 4 - Green', year_level: 4 },
        { id: CLASS_Y5, school_id: SCHOOL, name: 'Year 5 - Blue', year_level: 5 },
    ],
    terms: [{ id: TERM_1, school_id: SCHOOL, academic_year_id: 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40', name: 'Term 1' }],
    students: [
        { id: STU_Y3, school_id: SCHOOL, name: 'Abel Tesfaye', admission_no: 'BIS-301', roll_num: 1, class_id: CLASS_Y3, is_active: true },
        { id: STU_Y4, school_id: SCHOOL, name: 'Bethlehem Adera', admission_no: 'BIS-401', roll_num: 1, class_id: CLASS_Y4, is_active: true },
        { id: STU_Y5, school_id: SCHOOL, name: 'Daniel Girma', admission_no: 'BIS-501', roll_num: 1, class_id: CLASS_Y5, is_active: true },
        { id: STU_OTHER_SCHOOL, school_id: OTHER_SCHOOL, name: 'Foreign Student', admission_no: 'X999', roll_num: 1, class_id: CLASS_Y3, is_active: true },
    ],
    settling_in_report_sections: [],
    marksheets: [{ id: 'marksheet-existing', school_id: SCHOOL, marks: 83 }],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

const getReport = (classId, token = tokenFor(ADMIN)) => request(app)
    .get(`/api/settling-in/classes/${classId}?termId=${TERM_1}`)
    .auth(token);

const saveSection = (payload, token = tokenFor(ADMIN)) => request(app)
    .put('/api/settling-in/sections')
    .auth(token)
    .send(payload);

describe('Settling In Report class templates', () => {
    test('admin receives Year 3 criteria and active students for the selected class and term', async () => {
        const res = await getReport(CLASS_Y3);

        assert.equal(res.status, 200);
        assert.equal(res.body.class.yearLevel, 3);
        assert.equal(res.body.template.label, 'Year 3');
        assert.deepEqual(res.body.template.ratingOrder, ['WT', 'WW', 'WA']);
        assert.deepEqual(
            Object.fromEntries(res.body.template.subjects.map((subject) => [subject.key, subject.criteria.length])),
            { english: 5, mathematics: 9, science: 4, global_citizenship: 5, amharic: 3 },
        );
        assert.equal(res.body.template.subjects.find((subject) => subject.key === 'mathematics').assessorRole, 'main_teacher');
        assert.equal(res.body.template.subjects.find((subject) => subject.key === 'english').assessorRole, 'subject_teacher');
        assert.equal(res.body.students.length, 1);
        assert.equal(res.body.students[0].name, 'Abel Tesfaye');
        assert.deepEqual(res.body.students[0].sections, {});
    });

    test('Year 4 gets its distinct criteria and its sample rating-column order', async () => {
        const res = await getReport(CLASS_Y4);

        assert.equal(res.status, 200);
        assert.equal(res.body.class.yearLevel, 4);
        assert.equal(res.body.template.label, 'Year 4');
        assert.deepEqual(res.body.template.ratingOrder, ['WA', 'WW', 'WT']);
        assert.deepEqual(
            Object.fromEntries(res.body.template.subjects.map((subject) => [subject.key, subject.criteria.length])),
            { english: 5, mathematics: 8, science: 5, global_citizenship: 4, amharic: 3 },
        );
        assert.notEqual(
            res.body.template.subjects.find((subject) => subject.key === 'english').criteria[0].text,
            getSettlingInTemplate(3).subjects.find((subject) => subject.key === 'english').criteria[0].text,
        );
    });

    test('unsupported class years are rejected instead of being assigned another year template', async () => {
        const res = await getReport(CLASS_Y5);
        assert.equal(res.status, 400);
        assert.match(res.body.message, /Year 3 and Year 4 only/);
    });

    test('a missing migration reports the required setup instead of a generic server error', async () => {
        reset(tables(), {
            errors: { settling_in_report_sections: missingTableError('settling_in_report_sections') },
        });
        const res = await getReport(CLASS_Y3);

        assert.equal(res.status, 503);
        assert.match(res.body.message, /034_settling_in_reports\.sql/);
    });

    test('unknown and foreign classes/terms are not returned', async () => {
        const unknownClass = await getReport('d76f2027-0e2b-4e65-9937-c2705ddf0314');
        assert.equal(unknownClass.status, 400); // known Year 5 class, not a supported grade

        const foreignTermId = 'c3d4e5f6-a7b8-4c9d-9e1f-2a3b4c5d6e7f';
        const foreignTerm = await request(app)
            .get(`/api/settling-in/classes/${CLASS_Y3}?termId=${foreignTermId}`)
            .auth(tokenFor(ADMIN));
        assert.equal(foreignTerm.status, 404);
    });
});

describe('Settling In Report save and data isolation', () => {
    const sectionPayload = (overrides = {}) => {
        const subject = getSettlingInTemplate(3).subjects.find((item) => item.key === 'english');
        return {
            classId: CLASS_Y3,
            studentId: STU_Y3,
            termId: TERM_1,
            subjectKey: 'english',
            ratings: {
                [subject.criteria[0].id]: 'WW',
                [subject.criteria[1].id]: null,
            },
            ...overrides,
        };
    };

    test('admin saves one subject section against the student, class, term and exact Year 3 template', async () => {
        const res = await saveSection(sectionPayload());

        assert.equal(res.status, 200);
        assert.equal(res.body.section.subjectKey, 'english');
        assert.equal(res.body.section.ratedCount, 1);
        assert.equal(res.body.section.totalCount, 5);
        assert.equal(res.body.section.complete, false);
        assert.equal(rowsOf('settling_in_report_sections').length, 1);
        assert.equal(rowsOf('settling_in_report_sections')[0].grade_level, 3);
        assert.equal(rowsOf('settling_in_report_sections')[0].saved_by, ADMIN.id);
        assert.equal(rowsOf('settling_in_report_sections')[0].template_version, getSettlingInTemplate(3).version);
        assert.equal(rowsOf('marksheets').length, 1);
        assert.equal(rowsOf('marksheets')[0].marks, 83);
    });

    test('saved section appears on the same student class-and-term report card', async () => {
        await saveSection(sectionPayload());
        const res = await getReport(CLASS_Y3);

        assert.equal(res.status, 200);
        const section = res.body.students[0].sections.english;
        assert.equal(section.ratings['y3-english-01'], 'WW');
        assert.equal(section.ratedCount, 1);
        assert.equal(section.totalCount, 5);
    });

    test('saving the same subject again updates its one section instead of duplicating it', async () => {
        await saveSection(sectionPayload());
        const second = await saveSection(sectionPayload({ ratings: { 'y3-english-01': 'WA' } }));

        assert.equal(second.status, 200);
        assert.equal(rowsOf('settling_in_report_sections').length, 1);
        assert.equal(rowsOf('settling_in_report_sections')[0].ratings['y3-english-01'], 'WA');
    });

    test('a Year 3 criterion cannot be submitted against a Year 4 class', async () => {
        const payload = sectionPayload({ classId: CLASS_Y4, studentId: STU_Y4 });
        const res = await saveSection(payload);

        assert.equal(res.status, 400);
        assert.match(res.body.message, /criteria that do not belong/);
        assert.equal(rowsOf('settling_in_report_sections').length, 0);
    });

    test('unknown subjects, criterion IDs and rating values are rejected', async () => {
        const unknownSubject = await saveSection(sectionPayload({ subjectKey: 'french' }));
        assert.equal(unknownSubject.status, 400);

        const unknownCriterion = await saveSection(sectionPayload({ ratings: { 'y4-english-01': 'WT' } }));
        assert.equal(unknownCriterion.status, 400);

        const invalidRating = await saveSection(sectionPayload({ ratings: { 'y3-english-01': 'A+' } }));
        assert.equal(invalidRating.status, 400);
        assert.equal(rowsOf('settling_in_report_sections').length, 0);
    });

    test('a student from another class or school cannot receive the section', async () => {
        const wrongClass = await saveSection(sectionPayload({ studentId: STU_Y4 }));
        assert.equal(wrongClass.status, 400);

        const foreignStudent = await saveSection(sectionPayload({ studentId: STU_OTHER_SCHOOL }));
        assert.equal(foreignStudent.status, 404);
        assert.equal(rowsOf('settling_in_report_sections').length, 0);
    });

    test('inactive students cannot be assessed', async () => {
        rowsOf('students').find((row) => row.id === STU_Y3).is_active = false;
        const res = await saveSection(sectionPayload());
        assert.equal(res.status, 400);
        assert.match(res.body.message, /Inactive students/);
    });

    test('teacher and non-teaching roles are blocked by the admin-only first phase', async () => {
        const subjectTeacherGet = await getReport(CLASS_Y3, tokenFor(SUBJECT));
        const mainTeacherSave = await saveSection(sectionPayload(), tokenFor(MAIN));

        assert.equal(subjectTeacherGet.status, 403);
        assert.equal(mainTeacherSave.status, 403);
        assert.equal(rowsOf('settling_in_report_sections').length, 0);
    });

    test('missing authentication and malformed request values are rejected', async () => {
        const noAuth = await request(app).get(`/api/settling-in/classes/${CLASS_Y3}?termId=${TERM_1}`);
        assert.equal(noAuth.status, 401);

        const invalidRatings = await request(app)
            .put('/api/settling-in/sections')
            .auth(tokenFor(ADMIN))
            .send({ ...sectionPayload(), ratings: ['WT'] });
        assert.equal(invalidRatings.status, 400);
    });
});
