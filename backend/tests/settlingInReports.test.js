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
const ACADEMIC_YEAR = 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40';
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
const SUBJECT_Y4 = user('b7a7809e-0f0c-4d5a-8f10-6b7c8d9e0f12', 'subject_teacher', 'Mekdes');
const tokenFor = (account) => signToken(account);

const tables = () => ({
    users: [ADMIN, MAIN, SUBJECT, SUBJECT_Y4],
    classes: [
        { id: CLASS_Y3, school_id: SCHOOL, name: 'Year 3 - Blue', year_level: 3 },
        { id: CLASS_Y4, school_id: SCHOOL, name: 'Year 4 - Green', year_level: 4 },
        { id: CLASS_Y5, school_id: SCHOOL, name: 'Year 5 - Blue', year_level: 5 },
    ],
    terms: [{ id: TERM_1, school_id: SCHOOL, academic_year_id: ACADEMIC_YEAR, name: 'Term 1' }],
    class_staff: [{
        id: 'main-seat-year-3',
        school_id: SCHOOL,
        academic_year_id: ACADEMIC_YEAR,
        class_id: CLASS_Y3,
        user_id: MAIN.id,
        position: 'main',
    }],
    subjects: [
        { id: 'subject-english', school_id: SCHOOL, name: 'English', code: 'ENG' },
        { id: 'subject-amharic', school_id: SCHOOL, name: 'Amharic', code: 'AMH' },
    ],
    class_subjects: [
        { id: 'assignment-english-y3', school_id: SCHOOL, academic_year_id: ACADEMIC_YEAR, class_id: CLASS_Y3, subject_id: 'subject-english', teacher_id: SUBJECT.id },
        { id: 'assignment-amharic-y3', school_id: SCHOOL, academic_year_id: ACADEMIC_YEAR, class_id: CLASS_Y3, subject_id: 'subject-amharic', teacher_id: SUBJECT.id },
        { id: 'assignment-english-y4', school_id: SCHOOL, academic_year_id: ACADEMIC_YEAR, class_id: CLASS_Y4, subject_id: 'subject-english', teacher_id: SUBJECT_Y4.id },
    ],
    students: [
        { id: STU_Y3, school_id: SCHOOL, name: 'Abel Tesfaye', admission_no: 'BIS-301', roll_num: 1, class_id: CLASS_Y3, is_active: true },
        { id: STU_Y4, school_id: SCHOOL, name: 'Bethlehem Adera', admission_no: 'BIS-401', roll_num: 1, class_id: CLASS_Y4, is_active: true },
        { id: STU_Y5, school_id: SCHOOL, name: 'Daniel Girma', admission_no: 'BIS-501', roll_num: 1, class_id: CLASS_Y5, is_active: true },
        { id: STU_OTHER_SCHOOL, school_id: OTHER_SCHOOL, name: 'Foreign Student', admission_no: 'X999', roll_num: 1, class_id: CLASS_Y3, is_active: true },
    ],
    settling_in_report_sections: [],
    settling_in_report_main_sections: [],
    marksheets: [{ id: 'marksheet-existing', school_id: SCHOOL, marks: 83 }],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

const getReport = (classId, token = tokenFor(ADMIN)) => request(app)
    .get(`/api/settling-in/classes/${classId}?termId=${TERM_1}`)
    .auth(token);

const getSubjectReport = (classId, subjectKey, studentId = STU_Y3, token = tokenFor(SUBJECT)) => request(app)
    .get(`/api/settling-in/subject-reports/${classId}?termId=${TERM_1}&subjectKey=${subjectKey}&studentId=${studentId}`)
    .auth(token);

const getSubjectClassReport = (classId, token = tokenFor(SUBJECT)) => request(app)
    .get(`/api/settling-in/subject-classes/${classId}?termId=${TERM_1}`)
    .auth(token);

const saveSection = (payload, token = tokenFor(ADMIN)) => request(app)
    .put('/api/settling-in/sections')
    .auth(token)
    .send(payload);

const saveMainTeacherSection = (payload, token = tokenFor(ADMIN)) => request(app)
    .put('/api/settling-in/main-teacher')
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
        assert.equal(res.body.students[0].mainTeacherSection, null);
        assert.deepEqual(res.body.template.mainTeacherSection.categories.map(({ key }) => key), [
            'conduct', 'organisation', 'attendance',
        ]);
        assert.deepEqual(res.body.template.mainTeacherSection.ratingOrder, [
            'pleasing', 'satisfactory', 'cause_for_concern',
        ]);
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

    test('explicit Year 3 class names recover when year_level is incorrectly set to 2', async () => {
        rowsOf('classes').find((item) => item.id === CLASS_Y3).year_level = 2;

        const res = await getReport(CLASS_Y3);

        assert.equal(res.status, 200);
        assert.equal(res.body.class.yearLevel, 3);
        assert.equal(res.body.template.label, 'Year 3');
        assert.match(res.body.template.subjects[0].criteria[0].text, /predictions using clues from the text/);
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

    test('a missing main-teacher migration names the required additive migration', async () => {
        reset(tables(), {
            errors: { settling_in_report_main_sections: missingTableError('settling_in_report_main_sections') },
        });
        const res = await getReport(CLASS_Y3);

        assert.equal(res.status, 503);
        assert.match(res.body.message, /035_settling_in_main_teacher_sections\.sql/);
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

describe('Subject-teacher individual Settling In reports', () => {
    test('English access returns only the selected student’s saved English section', async () => {
        const template = getSettlingInTemplate(3);
        const english = template.subjects.find((subject) => subject.key === 'english');
        const amharic = template.subjects.find((subject) => subject.key === 'amharic');
        rowsOf('settling_in_report_sections').push(
            {
                id: 'saved-english', school_id: SCHOOL, class_id: CLASS_Y3, student_id: STU_Y3,
                term_id: TERM_1, grade_level: 3, subject_key: 'english',
                ratings: { [english.criteria[0].id]: 'WW', conduct: 'pleasing', 'amharic-secret': 'WA' }, criteria_snapshot: english.criteria,
                template_version: template.version, saved_by: SUBJECT.id, updated_at: '2026-11-01T00:00:00.000Z',
            },
            {
                id: 'saved-amharic', school_id: SCHOOL, class_id: CLASS_Y3, student_id: STU_Y3,
                term_id: TERM_1, grade_level: 3, subject_key: 'amharic',
                ratings: { [amharic.criteria[0].id]: 'WA' }, criteria_snapshot: amharic.criteria,
                template_version: template.version, saved_by: SUBJECT.id, updated_at: '2026-11-01T00:00:00.000Z',
            },
        );
        rowsOf('settling_in_report_main_sections').push({
            id: 'saved-main-teacher', school_id: SCHOOL, class_id: CLASS_Y3, student_id: STU_Y3,
            term_id: TERM_1, grade_level: 3,
            ratings: { conduct: 'pleasing', organisation: 'satisfactory', attendance: 'pleasing' },
        });

        const res = await getSubjectReport(CLASS_Y3, 'english');
        assert.equal(res.status, 200);
        assert.equal(res.body.subject.key, 'english');
        assert.deepEqual(res.body.template.subjects.map((subject) => subject.key), ['english']);
        assert.equal(res.body.template.mainTeacherSection, undefined);
        assert.equal(res.body.student.id, STU_Y3);
        assert.equal(res.body.students, undefined);
        assert.deepEqual(Object.keys(res.body.student.sections), ['english']);
        assert.equal(res.body.student.sections.english.ratings[english.criteria[0].id], 'WW');
        assert.equal(res.body.student.sections.english.ratings.conduct, undefined);
        assert.equal(res.body.student.sections.english.ratings['amharic-secret'], undefined);
        assert.equal(JSON.stringify(res.body).includes('Amharic'), false);
        assert.equal(JSON.stringify(res.body).includes('Conduct'), false);
    });

    test('Amharic assignments can read only the selected student’s Amharic criteria and ratings', async () => {
        const amharic = getSettlingInTemplate(3).subjects.find((subject) => subject.key === 'amharic');
        rowsOf('settling_in_report_sections').push({
            id: 'saved-amharic', school_id: SCHOOL, class_id: CLASS_Y3, student_id: STU_Y3,
            term_id: TERM_1, grade_level: 3, subject_key: 'amharic',
            ratings: { [amharic.criteria[1].id]: 'WA' }, criteria_snapshot: amharic.criteria,
            template_version: getSettlingInTemplate(3).version, saved_by: SUBJECT.id,
        });

        const res = await getSubjectReport(CLASS_Y3, 'amharic');
        assert.equal(res.status, 200);
        assert.equal(res.body.subject.key, 'amharic');
        assert.deepEqual(res.body.template.subjects.map((subject) => subject.key), ['amharic']);
        assert.deepEqual(Object.keys(res.body.student.sections), ['amharic']);
        assert.equal(res.body.student.sections.amharic.ratings[amharic.criteria[1].id], 'WA');
    });

    test('Year 4 subject reports retain their own criteria and rating-column order', async () => {
        const year3English = getSettlingInTemplate(3).subjects.find((subject) => subject.key === 'english');
        const year4English = getSettlingInTemplate(4).subjects.find((subject) => subject.key === 'english');
        const res = await getSubjectReport(CLASS_Y4, 'english', STU_Y4, tokenFor(SUBJECT_Y4));

        assert.equal(res.status, 200);
        assert.equal(res.body.template.yearLevel, 4);
        assert.deepEqual(res.body.template.ratingOrder, ['WA', 'WW', 'WT']);
        assert.deepEqual(res.body.template.subjects.map((subject) => subject.key), ['english']);
        assert.notEqual(res.body.template.subjects[0].criteria[0].text, year3English.criteria[0].text);
        assert.equal(res.body.student.sections.english, undefined);
        assert.equal(year4English.criteria.length, 5);
    });

    test('assignment, subject, role, and student ownership are enforced server-side', async () => {
        const unassignedClass = await getSubjectReport(CLASS_Y4, 'english', STU_Y4);
        assert.equal(unassignedClass.status, 403);
        const unassignedSubject = await getSubjectReport(CLASS_Y4, 'amharic', STU_Y4, tokenFor(SUBJECT_Y4));
        assert.equal(unassignedSubject.status, 403);

        const otherSubject = await getSubjectReport(CLASS_Y3, 'mathematics');
        assert.equal(otherSubject.status, 400);

        const admin = await getSubjectReport(CLASS_Y3, 'english', STU_Y3, tokenFor(ADMIN));
        assert.equal(admin.status, 403);

        const fullReport = await getReport(CLASS_Y3, tokenFor(SUBJECT));
        assert.equal(fullReport.status, 403);

        const wrongClassStudent = await getSubjectReport(CLASS_Y3, 'english', STU_Y4);
        assert.equal(wrongClassStudent.status, 400);
        const foreignStudent = await getSubjectReport(CLASS_Y3, 'english', STU_OTHER_SCHOOL);
        assert.equal(foreignStudent.status, 404);

        rowsOf('students').find((student) => student.id === STU_Y3).is_active = false;
        const inactiveStudent = await getSubjectReport(CLASS_Y3, 'english', STU_Y3);
        assert.equal(inactiveStudent.status, 400);
    });
});

describe('Subject-teacher Settling In class progress', () => {
    test('Year 3 subject access works when the class has a legacy year_level value of 2', async () => {
        rowsOf('classes').find((item) => item.id === CLASS_Y3).year_level = 2;

        const res = await getSubjectClassReport(CLASS_Y3);

        assert.equal(res.status, 200);
        assert.equal(res.body.class.yearLevel, 3);
        assert.equal(res.body.template.label, 'Year 3');
        assert.deepEqual(res.body.template.subjects.map((subject) => subject.key), ['english', 'amharic']);
    });

    test('progress includes only assigned-subject completion counts, never ratings or form-tutor data', async () => {
        const template = getSettlingInTemplate(3);
        const english = template.subjects.find((subject) => subject.key === 'english');
        const amharic = template.subjects.find((subject) => subject.key === 'amharic');
        rowsOf('settling_in_report_sections').push(
            {
                id: 'saved-english', school_id: SCHOOL, class_id: CLASS_Y3, student_id: STU_Y3,
                term_id: TERM_1, grade_level: 3, subject_key: 'english',
                ratings: { [english.criteria[0].id]: 'WW', conduct: 'pleasing' },
                criteria_snapshot: english.criteria, updated_at: '2026-11-01T00:00:00.000Z',
            },
            {
                id: 'saved-amharic', school_id: SCHOOL, class_id: CLASS_Y3, student_id: STU_Y3,
                term_id: TERM_1, grade_level: 3, subject_key: 'amharic',
                ratings: { [amharic.criteria[0].id]: 'WA' }, criteria_snapshot: amharic.criteria,
            },
            {
                id: 'unassigned-mathematics', school_id: SCHOOL, class_id: CLASS_Y3, student_id: STU_Y3,
                term_id: TERM_1, grade_level: 3, subject_key: 'mathematics', ratings: { 'y3-mathematics-01': 'WA' },
            },
        );
        rowsOf('settling_in_report_main_sections').push({
            id: 'saved-main-teacher', school_id: SCHOOL, class_id: CLASS_Y3, student_id: STU_Y3,
            term_id: TERM_1, ratings: { conduct: 'pleasing' },
        });

        const res = await getSubjectClassReport(CLASS_Y3);
        assert.equal(res.status, 200);
        assert.equal(res.body.class.yearLevel, 3);
        assert.equal(res.body.term.academicYearId, ACADEMIC_YEAR);
        assert.deepEqual(res.body.template.subjects.map((subject) => subject.key), ['english', 'amharic']);
        assert.equal(res.body.students.length, 1);
        assert.deepEqual(Object.keys(res.body.students[0].sections).sort(), ['amharic', 'english']);
        assert.deepEqual(res.body.students[0].sections.english, {
            subjectKey: 'english', ratedCount: 1, totalCount: 5, complete: false, updatedAt: '2026-11-01T00:00:00.000Z',
        });
        assert.equal(res.body.students[0].sections.amharic.ratedCount, 1);
        assert.equal(res.body.students[0].sections.english.ratings, undefined);
        assert.equal(res.body.students[0].mainTeacherSection, undefined);
        assert.equal(JSON.stringify(res.body).includes('mathematics'), false);
        assert.equal(JSON.stringify(res.body).includes('Conduct'), false);
    });

    test('class progress requires an exact subject, class, and academic-year assignment', async () => {
        const unassignedClass = await getSubjectClassReport(CLASS_Y4);
        assert.equal(unassignedClass.status, 403);
        const assignedYearFour = await getSubjectClassReport(CLASS_Y4, tokenFor(SUBJECT_Y4));
        assert.equal(assignedYearFour.status, 200);
        assert.deepEqual(assignedYearFour.body.template.subjects.map((subject) => subject.key), ['english']);

        rowsOf('class_subjects').forEach((assignment) => {
            if (assignment.class_id === CLASS_Y3 && assignment.teacher_id === SUBJECT.id) {
                assignment.academic_year_id = 'another-academic-year';
            }
        });
        const wrongYear = await getSubjectClassReport(CLASS_Y3);
        assert.equal(wrongYear.status, 403);

        const admin = await getSubjectClassReport(CLASS_Y3, tokenFor(ADMIN));
        assert.equal(admin.status, 403);
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

    test('subject teachers can save only their assigned English or Amharic section without changing another section', async () => {
        const y3Amharic = getSettlingInTemplate(3).subjects.find((subject) => subject.key === 'amharic');
        const existingAmharic = {
            id: 'existing-amharic', school_id: SCHOOL, class_id: CLASS_Y3, student_id: STU_Y3,
            term_id: TERM_1, grade_level: 3, subject_key: 'amharic',
            ratings: { [y3Amharic.criteria[0].id]: 'WA' }, criteria_snapshot: y3Amharic.criteria,
            template_version: getSettlingInTemplate(3).version, saved_by: SUBJECT.id,
        };
        rowsOf('settling_in_report_sections').push(existingAmharic);

        const savedEnglish = await saveSection(sectionPayload(), tokenFor(SUBJECT));
        assert.equal(savedEnglish.status, 200);
        assert.equal(savedEnglish.body.section.subjectKey, 'english');
        assert.equal(rowsOf('settling_in_report_sections').length, 2);
        assert.deepEqual(existingAmharic.ratings, { [y3Amharic.criteria[0].id]: 'WA' });
        assert.equal(rowsOf('settling_in_report_sections').find((row) => row.subject_key === 'english').saved_by, SUBJECT.id);

        const y4English = getSettlingInTemplate(4).subjects.find((subject) => subject.key === 'english');
        const y4Payload = {
            classId: CLASS_Y4, studentId: STU_Y4, termId: TERM_1, subjectKey: 'english',
            ratings: { [y4English.criteria[0].id]: 'WW' },
        };
        const otherTeacherClass = await saveSection(y4Payload, tokenFor(SUBJECT));
        assert.equal(otherTeacherClass.status, 403);

        const assignedYearFour = await saveSection(y4Payload, tokenFor(SUBJECT_Y4));
        assert.equal(assignedYearFour.status, 200);
        const y4Amharic = getSettlingInTemplate(4).subjects.find((subject) => subject.key === 'amharic');
        const unassignedSubject = await saveSection({
            ...y4Payload,
            subjectKey: 'amharic',
            ratings: { [y4Amharic.criteria[0].id]: 'WT' },
        }, tokenFor(SUBJECT_Y4));
        assert.equal(unassignedSubject.status, 403);

        const wrongAcademicYearAssignments = rowsOf('class_subjects').filter((assignment) =>
            assignment.class_id === CLASS_Y4 && assignment.teacher_id === SUBJECT_Y4.id,
        );
        wrongAcademicYearAssignments.forEach((assignment) => { assignment.academic_year_id = 'another-academic-year'; });
        const wrongAcademicYear = await saveSection(y4Payload, tokenFor(SUBJECT_Y4));
        assert.equal(wrongAcademicYear.status, 403);

        const y3Maths = getSettlingInTemplate(3).subjects.find((subject) => subject.key === 'mathematics');
        const otherSubject = await saveSection({
            classId: CLASS_Y3, studentId: STU_Y3, termId: TERM_1, subjectKey: 'mathematics',
            ratings: { [y3Maths.criteria[0].id]: 'WA' },
        }, tokenFor(SUBJECT));
        assert.equal(otherSubject.status, 403);
        const mainTeacherSection = await saveMainTeacherSection({
            classId: CLASS_Y3, studentId: STU_Y3, termId: TERM_1,
            ratings: { conduct: 'pleasing', organisation: 'satisfactory', attendance: 'pleasing' },
        }, tokenFor(SUBJECT));
        assert.equal(mainTeacherSection.status, 403);
        assert.equal(rowsOf('settling_in_report_sections').length, 3);
    });

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

    const mainTeacherPayload = (overrides = {}) => ({
        classId: CLASS_Y3,
        studentId: STU_Y3,
        termId: TERM_1,
        ratings: {
            conduct: 'pleasing',
            organisation: 'satisfactory',
            attendance: null,
        },
        ...overrides,
    });

    test('admin saves main-teacher ratings separately and the student report returns them', async () => {
        const saved = await saveMainTeacherSection(mainTeacherPayload());

        assert.equal(saved.status, 200);
        assert.equal(saved.body.section.ratedCount, 2);
        assert.equal(saved.body.section.totalCount, 3);
        assert.equal(saved.body.section.complete, false);
        assert.deepEqual(saved.body.section.ratings, {
            conduct: 'pleasing',
            organisation: 'satisfactory',
            attendance: null,
        });
        assert.equal(rowsOf('settling_in_report_main_sections').length, 1);
        assert.equal(rowsOf('settling_in_report_main_sections')[0].saved_by, ADMIN.id);
        assert.equal(rowsOf('settling_in_report_sections').length, 0);

        const report = await getReport(CLASS_Y3);
        assert.deepEqual(report.body.students[0].mainTeacherSection.ratings, saved.body.section.ratings);
    });

    test('main-teacher ratings update in place and invalid categories or scale values are rejected', async () => {
        await saveMainTeacherSection(mainTeacherPayload());
        const updated = await saveMainTeacherSection(mainTeacherPayload({
            ratings: { conduct: 'cause_for_concern', organisation: null, attendance: 'pleasing' },
        }));
        assert.equal(updated.status, 200);
        assert.equal(rowsOf('settling_in_report_main_sections').length, 1);
        assert.equal(rowsOf('settling_in_report_main_sections')[0].ratings.conduct, 'cause_for_concern');

        const unknownCategory = await saveMainTeacherSection(mainTeacherPayload({
            ratings: { punctuality: 'pleasing' },
        }));
        assert.equal(unknownCategory.status, 400);

        const invalidRating = await saveMainTeacherSection(mainTeacherPayload({
            ratings: { conduct: 'WT' },
        }));
        assert.equal(invalidRating.status, 400);
        assert.equal(rowsOf('settling_in_report_main_sections').length, 1);
    });

    test('main-teacher section enforces student/class ownership and active status', async () => {
        const wrongClass = await saveMainTeacherSection(mainTeacherPayload({ studentId: STU_Y4 }));
        assert.equal(wrongClass.status, 400);
        const foreignStudent = await saveMainTeacherSection(mainTeacherPayload({ studentId: STU_OTHER_SCHOOL }));
        assert.equal(foreignStudent.status, 404);
        rowsOf('students').find((row) => row.id === STU_Y3).is_active = false;
        const inactive = await saveMainTeacherSection(mainTeacherPayload());
        assert.equal(inactive.status, 400);
        assert.equal(rowsOf('settling_in_report_main_sections').length, 0);
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

    test('main teachers can read only classes assigned to them as the main teacher', async () => {
        const assignedClass = await getReport(CLASS_Y3, tokenFor(MAIN));
        const unassignedClass = await getReport(CLASS_Y4, tokenFor(MAIN));
        const subjectTeacher = await getReport(CLASS_Y3, tokenFor(SUBJECT));

        assert.equal(assignedClass.status, 200);
        assert.equal(unassignedClass.status, 403);
        assert.equal(subjectTeacher.status, 403);
    });

    test('main teachers can save their sections and main-taught subjects, but cannot change English or Amharic', async () => {
        const english = getSettlingInTemplate(3).subjects.find((subject) => subject.key === 'english');
        const mathematics = getSettlingInTemplate(3).subjects.find((subject) => subject.key === 'mathematics');
        const savedEnglish = {
            id: 'english-assessment-existing',
            school_id: SCHOOL,
            class_id: CLASS_Y3,
            student_id: STU_Y3,
            term_id: TERM_1,
            grade_level: 3,
            subject_key: 'english',
            ratings: { 'y3-english-01': 'WW' },
            criteria_snapshot: english.criteria,
            template_version: getSettlingInTemplate(3).version,
            saved_by: SUBJECT.id,
            updated_at: '2026-11-01T00:00:00.000Z',
        };
        rowsOf('settling_in_report_sections').push(savedEnglish);

        const visibleReport = await getReport(CLASS_Y3, tokenFor(MAIN));
        assert.equal(visibleReport.status, 200);
        assert.equal(visibleReport.body.students[0].sections.english.ratings['y3-english-01'], 'WW');

        const mainSubjectSave = await saveSection({
            classId: CLASS_Y3,
            studentId: STU_Y3,
            termId: TERM_1,
            subjectKey: 'mathematics',
            ratings: { [mathematics.criteria[0].id]: 'WA' },
        }, tokenFor(MAIN));
        assert.equal(mainSubjectSave.status, 200);
        assert.equal(mainSubjectSave.body.section.subjectKey, 'mathematics');
        assert.equal(rowsOf('settling_in_report_sections').find((row) => row.subject_key === 'mathematics').saved_by, MAIN.id);

        const englishEdit = await saveSection(sectionPayload({ ratings: { 'y3-english-01': 'WT' } }), tokenFor(MAIN));
        const amharic = getSettlingInTemplate(3).subjects.find((subject) => subject.key === 'amharic');
        const amharicEdit = await saveSection({
            classId: CLASS_Y3,
            studentId: STU_Y3,
            termId: TERM_1,
            subjectKey: 'amharic',
            ratings: { [amharic.criteria[0].id]: 'WW' },
        }, tokenFor(MAIN));
        assert.equal(englishEdit.status, 403);
        assert.equal(amharicEdit.status, 403);
        assert.equal(savedEnglish.ratings['y3-english-01'], 'WW');

        const mainTeacherSection = await saveMainTeacherSection({
            classId: CLASS_Y3,
            studentId: STU_Y3,
            termId: TERM_1,
            ratings: { conduct: 'pleasing', organisation: 'satisfactory', attendance: null },
        }, tokenFor(MAIN));
        assert.equal(mainTeacherSection.status, 200);
        assert.equal(rowsOf('settling_in_report_main_sections')[0].saved_by, MAIN.id);
        assert.equal(rowsOf('settling_in_report_sections').length, 2);
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
