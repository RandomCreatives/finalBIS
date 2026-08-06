/**
 * Integration tests against a real PostgreSQL engine (PGlite/WASM).
 *
 * These execute supabase/schema.sql and functions.sql for real, so they cover
 * the things a stubbed client cannot: CHECK and EXCLUDE constraints, triggers,
 * cascades and PL/pgSQL bodies.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { createTestDb, seedBaseline } = require('./harness');

let t;
let ids;

before(async () => {
    t = await createTestDb();
});

after(async () => {
    if (t) await t.close();
});

// Each test starts from a clean graph.
beforeEach(async () => {
    await t.query(`TRUNCATE schools RESTART IDENTITY CASCADE`);
    ids = await seedBaseline(t.query);
});

describe('schema applies and enforces its rules', () => {
    test('all expected tables exist', async () => {
        const { rows } = await t.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' ORDER BY table_name`
        );
        const names = rows.map((r) => r.table_name);

        for (const expected of [
            'schools', 'academic_years', 'terms', 'users', 'classes', 'class_staff',
            'subjects', 'class_subjects', 'timetable_slots', 'students',
            'student_transfers', 'attendance', 'marksheets', 'library_loans',
            'clinic_visits', 'schemes_of_work', 'scheme_weeks', 'lesson_plans',
            'calendar_events', 'threads', 'thread_participants', 'messages',
            'tasks', 'notices', 'notice_receipts',
        ]) {
            assert.ok(names.includes(expected), `missing table: ${expected}`);
        }
    });

    test('row level security is forced on every table', async () => {
        const { rows } = await t.query(
            `SELECT relname FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind = 'r'
               AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)`
        );
        assert.equal(rows.length, 0, `RLS not forced on: ${rows.map((r) => r.relname).join(', ')}`);
    });

    test('no permissive policies exist, so anon can read nothing', async () => {
        const { rows } = await t.query(`SELECT policyname FROM pg_policies WHERE schemaname = 'public'`);
        assert.equal(rows.length, 0, 'unexpected RLS policy present');
    });

    test('updated_at is maintained by trigger', async () => {
        const { rows: [before] } = await t.query(
            `SELECT updated_at FROM classes WHERE id = $1`, [ids.classAId]
        );
        await t.query(`UPDATE classes SET name = 'Year 3A (renamed)' WHERE id = $1`, [ids.classAId]);
        const { rows: [after] } = await t.query(
            `SELECT updated_at FROM classes WHERE id = $1`, [ids.classAId]
        );

        assert.ok(after.updated_at >= before.updated_at);
    });

    test('email uniqueness is case-insensitive via citext', async () => {
        const err = await t.expectFailure(
            `INSERT INTO users (school_id, name, email, password_hash, role)
             VALUES ($1, 'Dup', 'ADMIN@TEST.ET', 'x', 'admin')`,
            [ids.schoolId]
        );
        assert.match(err || '', /duplicate key|unique/i);
    });

    test('an invalid role is rejected', async () => {
        const err = await t.expectFailure(
            `INSERT INTO users (school_id, name, email, password_hash, role)
             VALUES ($1, 'Bad', 'bad@test.et', 'x', 'headmaster')`,
            [ids.schoolId]
        );
        assert.match(err || '', /check constraint/i);
    });
});

describe('terms', () => {
    test('term_week_count matches the API arithmetic', async () => {
        const { rows } = await t.query(`SELECT term_week_count('2026-09-01','2026-11-17') AS w`);
        assert.equal(rows[0].w, 12);
    });

    test('overlapping terms in the same year are rejected', async () => {
        const err = await t.expectFailure(
            `INSERT INTO terms (school_id, academic_year_id, term_index, name, starts_on, ends_on)
             VALUES ($1, $2, 2, 'Overlap', '2026-11-10', '2027-01-30')`,
            [ids.schoolId, ids.yearId]
        );
        assert.match(err || '', /exclusion constraint/i);
    });

    test('non-overlapping terms are accepted', async () => {
        const { rows } = await t.query(
            `INSERT INTO terms (school_id, academic_year_id, term_index, name, starts_on, ends_on)
             VALUES ($1, $2, 2, 'Term 2', '2027-01-06', '2027-03-23') RETURNING id`,
            [ids.schoolId, ids.yearId]
        );
        assert.ok(rows[0].id);
    });

    test('a term must end after it starts', async () => {
        const err = await t.expectFailure(
            `INSERT INTO terms (school_id, academic_year_id, term_index, name, starts_on, ends_on)
             VALUES ($1, $2, 3, 'Backwards', '2027-05-01', '2027-04-01')`,
            [ids.schoolId, ids.yearId]
        );
        assert.match(err || '', /term_dates_ordered/i);
    });

    test('set_current_term promotes one term and demotes the rest', async () => {
        const { rows: [t2] } = await t.query(
            `INSERT INTO terms (school_id, academic_year_id, term_index, name, starts_on, ends_on)
             VALUES ($1, $2, 2, 'Term 2', '2027-01-06', '2027-03-23') RETURNING id`,
            [ids.schoolId, ids.yearId]
        );

        await t.query(`SELECT set_current_term($1, $2)`, [t2.id, ids.schoolId]);

        const { rows } = await t.query(
            `SELECT id, is_current FROM terms WHERE school_id = $1 ORDER BY term_index`,
            [ids.schoolId]
        );
        assert.equal(rows.filter((r) => r.is_current).length, 1);
        assert.equal(rows.find((r) => r.is_current).id, t2.id);
    });

    test('only one term per school can be current', async () => {
        const err = await t.expectFailure(
            `INSERT INTO terms (school_id, academic_year_id, term_index, name, starts_on, ends_on, is_current)
             VALUES ($1, $2, 2, 'Also current', '2027-01-06', '2027-03-23', TRUE)`,
            [ids.schoolId, ids.yearId]
        );
        assert.match(err || '', /uniq_current_term_per_school|duplicate key/i);
    });
});

describe('class staffing', () => {
    test('a class cannot have two main teachers', async () => {
        await t.query(
            `INSERT INTO class_staff (school_id, academic_year_id, class_id, user_id, position)
             VALUES ($1, $2, $3, $4, 'main')`,
            [ids.schoolId, ids.yearId, ids.classAId, ids.mainTeacherId]
        );

        const err = await t.expectFailure(
            `INSERT INTO class_staff (school_id, academic_year_id, class_id, user_id, position)
             VALUES ($1, $2, $3, $4, 'main')`,
            [ids.schoolId, ids.yearId, ids.classAId, ids.subjectTeacherId]
        );
        assert.match(err || '', /uniq_class_position|duplicate key/i);
    });

    test('assign_class_staff replaces the incumbent atomically', async () => {
        await t.query(`SELECT assign_class_staff($1, $2, 'main', $3, $4)`,
            [ids.classAId, ids.mainTeacherId, ids.yearId, ids.schoolId]);
        await t.query(`SELECT assign_class_staff($1, $2, 'main', $3, $4)`,
            [ids.classAId, ids.subjectTeacherId, ids.yearId, ids.schoolId]);

        const { rows } = await t.query(
            `SELECT user_id FROM class_staff WHERE class_id = $1 AND position = 'main'`,
            [ids.classAId]
        );
        assert.equal(rows.length, 1);
        assert.equal(rows[0].user_id, ids.subjectTeacherId);
    });

    test('rotate_class_staff swaps two classes without violating the unique index', async () => {
        await t.query(`SELECT assign_class_staff($1, $2, 'main', $3, $4)`,
            [ids.classAId, ids.mainTeacherId, ids.yearId, ids.schoolId]);
        await t.query(`SELECT assign_class_staff($1, $2, 'main', $3, $4)`,
            [ids.classBId, ids.subjectTeacherId, ids.yearId, ids.schoolId]);

        await t.query(`SELECT rotate_class_staff($1, $2, 'main', $3, $4)`,
            [ids.classAId, ids.classBId, ids.yearId, ids.schoolId]);

        const { rows } = await t.query(
            `SELECT class_id, user_id FROM class_staff WHERE position = 'main'`
        );
        const byClass = Object.fromEntries(rows.map((r) => [r.class_id, r.user_id]));

        assert.equal(byClass[ids.classAId], ids.subjectTeacherId, 'A should now hold B\'s teacher');
        assert.equal(byClass[ids.classBId], ids.mainTeacherId, 'B should now hold A\'s teacher');
    });

    test('rotating a class with itself is refused', async () => {
        const err = await t.expectFailure(
            `SELECT rotate_class_staff($1, $1, 'main', $2, $3)`,
            [ids.classAId, ids.yearId, ids.schoolId]
        );
        assert.match(err || '', /SAME_CLASS/);
    });
});

describe('timetable clash prevention', () => {
    let engAssignment;
    let mathAssignment;

    beforeEach(async () => {
        const { rows: [eng] } = await t.query(
            `INSERT INTO class_subjects (school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week)
             VALUES ($1, $2, $3, $4, $5, 5) RETURNING id`,
            [ids.schoolId, ids.yearId, ids.classAId, ids.englishId, ids.subjectTeacherId]
        );
        engAssignment = eng.id;

        const { rows: [mat] } = await t.query(
            `INSERT INTO class_subjects (school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week)
             VALUES ($1, $2, $3, $4, $5, 5) RETURNING id`,
            [ids.schoolId, ids.yearId, ids.classAId, ids.mathsId, ids.mainTeacherId]
        );
        mathAssignment = mat.id;
    });

    const addSlot = (assignment, day, from, to) =>
        t.query(
            `INSERT INTO timetable_slots
                (school_id, academic_year_id, class_subject_id, class_id, day_of_week, starts_at, ends_at)
             VALUES ($1, $2, $3, '00000000-0000-0000-0000-000000000000', $4, $5, $6) RETURNING id`,
            [ids.schoolId, ids.yearId, assignment, day, from, to]
        );

    test('the trigger fills class_id and teacher_id from the assignment', async () => {
        const { rows: [slot] } = await addSlot(engAssignment, 1, '09:00', '09:45');

        const { rows } = await t.query(
            `SELECT class_id, teacher_id FROM timetable_slots WHERE id = $1`, [slot.id]
        );
        assert.equal(rows[0].class_id, ids.classAId);
        assert.equal(rows[0].teacher_id, ids.subjectTeacherId);
    });

    test('a class cannot sit two overlapping lessons', async () => {
        await addSlot(engAssignment, 1, '09:00', '09:45');

        const err = await t.expectFailure(
            `INSERT INTO timetable_slots
                (school_id, academic_year_id, class_subject_id, class_id, day_of_week, starts_at, ends_at)
             VALUES ($1, $2, $3, '00000000-0000-0000-0000-000000000000', 1, '09:30', '10:15')`,
            [ids.schoolId, ids.yearId, mathAssignment]
        );
        assert.match(err || '', /no_class_double_booking/);
    });

    test('back-to-back periods are allowed', async () => {
        await addSlot(engAssignment, 1, '09:00', '09:45');
        const { rows } = await addSlot(mathAssignment, 1, '09:45', '10:30');
        assert.ok(rows[0].id, 'a lesson starting as another ends must be accepted');
    });

    test('a teacher cannot be in two classes at once', async () => {
        // Same subject teacher, two different classes, same time.
        const { rows: [engB] } = await t.query(
            `INSERT INTO class_subjects (school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week)
             VALUES ($1, $2, $3, $4, $5, 5) RETURNING id`,
            [ids.schoolId, ids.yearId, ids.classBId, ids.englishId, ids.subjectTeacherId]
        );

        await addSlot(engAssignment, 2, '11:00', '11:45');

        const err = await t.expectFailure(
            `INSERT INTO timetable_slots
                (school_id, academic_year_id, class_subject_id, class_id, day_of_week, starts_at, ends_at)
             VALUES ($1, $2, $3, '00000000-0000-0000-0000-000000000000', 2, '11:15', '12:00')`,
            [ids.schoolId, ids.yearId, engB.id]
        );
        assert.match(err || '', /no_teacher_double_booking/);
    });

    test('the same slot on a different day is fine', async () => {
        await addSlot(engAssignment, 1, '09:00', '09:45');
        const { rows } = await addSlot(engAssignment, 2, '09:00', '09:45');
        assert.ok(rows[0].id);
    });

    test('reassigning a subject moves its timetable to the new teacher', async () => {
        const { rows: [slot] } = await addSlot(engAssignment, 3, '13:00', '13:45');

        await t.query(`UPDATE class_subjects SET teacher_id = $1 WHERE id = $2`,
            [ids.mainTeacherId, engAssignment]);

        const { rows } = await t.query(`SELECT teacher_id FROM timetable_slots WHERE id = $1`, [slot.id]);
        assert.equal(rows[0].teacher_id, ids.mainTeacherId, 'the cascade trigger should have run');
    });
});

describe('attendance', () => {
    let studentId;

    beforeEach(async () => {
        const { rows } = await t.query(
            `INSERT INTO students (school_id, class_id, admission_no, name)
             VALUES ($1, $2, 'A-001', 'Meron K.') RETURNING id`,
            [ids.schoolId, ids.classAId]
        );
        studentId = rows[0].id;
    });

    test('mark_attendance inserts a homeroom register', async () => {
        const records = JSON.stringify([{ studentId, status: 'present', note: '' }]);

        const { rows } = await t.query(
            `SELECT mark_attendance($1, $2, NULL, '2026-09-07', $3, $4::json) AS result`,
            [ids.schoolId, ids.classAId, ids.mainTeacherId, records]
        );
        assert.equal(rows[0].result.count, 1);
    });

    test('marking the same day twice updates rather than duplicates', async () => {
        const first = JSON.stringify([{ studentId, status: 'present', note: '' }]);
        const second = JSON.stringify([{ studentId, status: 'late', note: 'bus' }]);

        await t.query(`SELECT mark_attendance($1, $2, NULL, '2026-09-07', $3, $4::json)`,
            [ids.schoolId, ids.classAId, ids.mainTeacherId, first]);
        await t.query(`SELECT mark_attendance($1, $2, NULL, '2026-09-07', $3, $4::json)`,
            [ids.schoolId, ids.classAId, ids.mainTeacherId, second]);

        const { rows } = await t.query(
            `SELECT status, note FROM attendance WHERE student_id = $1 AND subject_id IS NULL`,
            [studentId]
        );

        assert.equal(rows.length, 1, 'the partial unique index should have forced an update');
        assert.equal(rows[0].status, 'late');
        assert.equal(rows[0].note, 'bus');
    });

    test('homeroom and subject registers coexist for the same day', async () => {
        const { rows: [assignment] } = await t.query(
            `INSERT INTO class_subjects (school_id, academic_year_id, class_id, subject_id, teacher_id)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [ids.schoolId, ids.yearId, ids.classAId, ids.englishId, ids.subjectTeacherId]
        );
        assert.ok(assignment.id);

        const records = JSON.stringify([{ studentId, status: 'present', note: '' }]);

        await t.query(`SELECT mark_attendance($1, $2, NULL, '2026-09-07', $3, $4::json)`,
            [ids.schoolId, ids.classAId, ids.mainTeacherId, records]);
        await t.query(`SELECT mark_attendance($1, $2, $5, '2026-09-07', $3, $4::json)`,
            [ids.schoolId, ids.classAId, ids.subjectTeacherId, records, ids.englishId]);

        const { rows } = await t.query(
            `SELECT COUNT(*)::int AS n FROM attendance WHERE student_id = $1 AND date = '2026-09-07'`,
            [studentId]
        );
        assert.equal(rows[0].n, 2);
    });

    test('an invalid attendance status is rejected', async () => {
        const err = await t.expectFailure(
            `INSERT INTO attendance (school_id, student_id, class_id, date, status)
             VALUES ($1, $2, $3, '2026-09-08', 'teleported')`,
            [ids.schoolId, studentId, ids.classAId]
        );
        assert.match(err || '', /check constraint/i);
    });
});

describe('student placement and transfer', () => {
    const makeStudent = async (no) => {
        const { rows } = await t.query(
            `INSERT INTO students (school_id, admission_no, name) VALUES ($1, $2, $3) RETURNING id`,
            [ids.schoolId, no, `Pupil ${no}`]
        );
        return rows[0].id;
    };

    test('assign_students_to_class places unassigned pupils', async () => {
        const a = await makeStudent('A-101');
        const b = await makeStudent('A-102');

        const { rows } = await t.query(
            `SELECT assign_students_to_class($1::json, $2, $3, $4, NULL) AS result`,
            [JSON.stringify([a, b]), ids.classAId, ids.adminId, ids.schoolId]
        );

        assert.equal(rows[0].result.placed, 2);
        assert.equal(rows[0].result.moved, 0);
    });

    test('capacity is enforced', async () => {
        // Year 3A has capacity 3.
        const students = [];
        for (let i = 0; i < 4; i += 1) students.push(await makeStudent(`B-20${i}`));

        const err = await t.expectFailure(
            `SELECT assign_students_to_class($1::json, $2, $3, $4, NULL)`,
            [JSON.stringify(students), ids.classAId, ids.adminId, ids.schoolId]
        );
        assert.match(err || '', /OVER_CAPACITY/);
    });

    test('moving a pupil between classes writes a transfer record', async () => {
        const a = await makeStudent('A-201');

        await t.query(`SELECT assign_students_to_class($1::json, $2, $3, $4, NULL)`,
            [JSON.stringify([a]), ids.classAId, ids.adminId, ids.schoolId]);

        const { rows } = await t.query(
            `SELECT assign_students_to_class($1::json, $2, $3, $4, 'Rebalancing') AS result`,
            [JSON.stringify([a]), ids.classBId, ids.adminId, ids.schoolId]
        );

        assert.equal(rows[0].result.moved, 1);

        const { rows: audit } = await t.query(
            `SELECT from_class_id, to_class_id, reason FROM student_transfers WHERE student_id = $1`,
            [a]
        );
        assert.equal(audit.length, 1);
        assert.equal(audit[0].from_class_id, ids.classAId);
        assert.equal(audit[0].to_class_id, ids.classBId);
    });

    test('transfer_student rolls the move and the audit row together', async () => {
        const a = await makeStudent('A-301');
        await t.query(`UPDATE students SET class_id = $1 WHERE id = $2`, [ids.classAId, a]);

        await t.query(`SELECT transfer_student($1, $2, 'Parent request', $3, $4)`,
            [a, ids.classBId, ids.adminId, ids.schoolId]);

        const { rows: [student] } = await t.query(`SELECT class_id FROM students WHERE id = $1`, [a]);
        const { rows: audit } = await t.query(
            `SELECT id FROM student_transfers WHERE student_id = $1`, [a]
        );

        assert.equal(student.class_id, ids.classBId);
        assert.equal(audit.length, 1);
    });

    test('transferring into the same class is refused', async () => {
        const a = await makeStudent('A-401');
        await t.query(`UPDATE students SET class_id = $1 WHERE id = $2`, [ids.classAId, a]);

        const err = await t.expectFailure(
            `SELECT transfer_student($1, $2, NULL, $3, $4)`,
            [a, ids.classAId, ids.adminId, ids.schoolId]
        );
        assert.match(err || '', /SAME_CLASS/);
    });
});

describe('library', () => {
    let studentId;
    let loanId;

    beforeEach(async () => {
        const { rows } = await t.query(
            `INSERT INTO students (school_id, class_id, admission_no, name)
             VALUES ($1, $2, 'L-001', 'Borrower') RETURNING id`,
            [ids.schoolId, ids.classAId]
        );
        studentId = rows[0].id;

        const { rows: loan } = await t.query(
            `INSERT INTO library_loans (school_id, student_id, book_title, borrowed_on, due_on)
             VALUES ($1, $2, 'Things Fall Apart', CURRENT_DATE - 10, CURRENT_DATE - 3)
             RETURNING id`,
            [ids.schoolId, studentId]
        );
        loanId = loan[0].id;
    });

    test('returning late charges 5 ETB per day', async () => {
        const { rows } = await t.query(`SELECT return_library_loan($1, $2) AS result`,
            [loanId, ids.schoolId]);

        assert.equal(rows[0].result.days_late, 3);
        assert.equal(Number(rows[0].result.fine_amount), 15);
        assert.equal(rows[0].result.fine_paid, false);
    });

    test('returning on time charges nothing and settles the loan', async () => {
        const { rows: [fresh] } = await t.query(
            `INSERT INTO library_loans (school_id, student_id, book_title, due_on)
             VALUES ($1, $2, 'On Time', CURRENT_DATE + 5) RETURNING id`,
            [ids.schoolId, studentId]
        );

        const { rows } = await t.query(`SELECT return_library_loan($1, $2) AS result`,
            [fresh.id, ids.schoolId]);

        assert.equal(Number(rows[0].result.fine_amount), 0);
        assert.equal(rows[0].result.fine_paid, true);
    });

    test('a book cannot be returned twice', async () => {
        await t.query(`SELECT return_library_loan($1, $2)`, [loanId, ids.schoolId]);

        const err = await t.expectFailure(`SELECT return_library_loan($1, $2)`, [loanId, ids.schoolId]);
        assert.match(err || '', /ALREADY_RETURNED/);
    });

    test('a due date before the borrow date is rejected', async () => {
        const err = await t.expectFailure(
            `INSERT INTO library_loans (school_id, student_id, book_title, borrowed_on, due_on)
             VALUES ($1, $2, 'Impossible', CURRENT_DATE, CURRENT_DATE - 1)`,
            [ids.schoolId, studentId]
        );
        assert.match(err || '', /due_after_borrow/);
    });
});

describe('planning', () => {
    let assignmentId;

    beforeEach(async () => {
        const { rows } = await t.query(
            `INSERT INTO class_subjects (school_id, academic_year_id, class_id, subject_id, teacher_id)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [ids.schoolId, ids.yearId, ids.classAId, ids.englishId, ids.subjectTeacherId]
        );
        assignmentId = rows[0].id;
    });

    test('create_scheme_with_weeks scaffolds one row per teaching week', async () => {
        const { rows } = await t.query(
            `SELECT create_scheme_with_weeks($1, $2, $3, $4, 'English — Term 1', NULL) AS result`,
            [ids.schoolId, ids.termId, assignmentId, ids.subjectTeacherId]
        );

        assert.equal(rows[0].result.week_count, 12);

        const { rows: weeks } = await t.query(
            `SELECT COUNT(*)::int AS n FROM scheme_weeks WHERE scheme_id = $1`,
            [rows[0].result.id]
        );
        assert.equal(weeks[0].n, 12);
    });

    test('a second scheme for the same subject and term is refused', async () => {
        await t.query(`SELECT create_scheme_with_weeks($1, $2, $3, $4, 'First', NULL)`,
            [ids.schoolId, ids.termId, assignmentId, ids.subjectTeacherId]);

        const err = await t.expectFailure(
            `SELECT create_scheme_with_weeks($1, $2, $3, $4, 'Second', NULL)`,
            [ids.schoolId, ids.termId, assignmentId, ids.subjectTeacherId]
        );
        assert.match(err || '', /SCHEME_EXISTS/);
    });

    test('review_planning_document approves a submitted scheme', async () => {
        const { rows: [created] } = await t.query(
            `SELECT create_scheme_with_weeks($1, $2, $3, $4, 'English', NULL) AS result`,
            [ids.schoolId, ids.termId, assignmentId, ids.subjectTeacherId]
        );
        const schemeId = created.result.id;

        await t.query(`UPDATE schemes_of_work SET status = 'submitted' WHERE id = $1`, [schemeId]);

        const { rows } = await t.query(
            `SELECT review_planning_document('scheme', $1, 'approved', 'Good', $2, $3) AS result`,
            [schemeId, ids.adminId, ids.schoolId]
        );
        assert.equal(rows[0].result.status, 'approved');
    });

    test('a draft cannot be reviewed', async () => {
        const { rows: [created] } = await t.query(
            `SELECT create_scheme_with_weeks($1, $2, $3, $4, 'English', NULL) AS result`,
            [ids.schoolId, ids.termId, assignmentId, ids.subjectTeacherId]
        );

        const err = await t.expectFailure(
            `SELECT review_planning_document('scheme', $1, 'approved', NULL, $2, $3)`,
            [created.result.id, ids.adminId, ids.schoolId]
        );
        assert.match(err || '', /NOT_SUBMITTED/);
    });

    test('one lesson plan per week per subject', async () => {
        await t.query(
            `INSERT INTO lesson_plans (school_id, term_id, class_subject_id, author_id, week_number, topic)
             VALUES ($1, $2, $3, $4, 1, 'Week one')`,
            [ids.schoolId, ids.termId, assignmentId, ids.subjectTeacherId]
        );

        const err = await t.expectFailure(
            `INSERT INTO lesson_plans (school_id, term_id, class_subject_id, author_id, week_number, topic)
             VALUES ($1, $2, $3, $4, 1, 'Duplicate')`,
            [ids.schoolId, ids.termId, assignmentId, ids.subjectTeacherId]
        );
        assert.match(err || '', /duplicate key|unique/i);
    });
});

describe('marksheets and calendar', () => {
    test('marks above the maximum are rejected', async () => {
        const { rows: [student] } = await t.query(
            `INSERT INTO students (school_id, class_id, admission_no, name)
             VALUES ($1, $2, 'M-001', 'Pupil') RETURNING id`,
            [ids.schoolId, ids.classAId]
        );

        const err = await t.expectFailure(
            `INSERT INTO marksheets (school_id, student_id, subject_id, term_id, marks, max_marks)
             VALUES ($1, $2, $3, $4, 120, 100)`,
            [ids.schoolId, student.id, ids.englishId, ids.termId]
        );
        assert.match(err || '', /marks_within_max/);
    });

    test('one mark per student, subject and term', async () => {
        const { rows: [student] } = await t.query(
            `INSERT INTO students (school_id, class_id, admission_no, name)
             VALUES ($1, $2, 'M-002', 'Pupil') RETURNING id`,
            [ids.schoolId, ids.classAId]
        );

        await t.query(
            `INSERT INTO marksheets (school_id, student_id, subject_id, term_id, marks)
             VALUES ($1, $2, $3, $4, 80)`,
            [ids.schoolId, student.id, ids.englishId, ids.termId]
        );

        const err = await t.expectFailure(
            `INSERT INTO marksheets (school_id, student_id, subject_id, term_id, marks)
             VALUES ($1, $2, $3, $4, 90)`,
            [ids.schoolId, student.id, ids.englishId, ids.termId]
        );
        assert.match(err || '', /duplicate key|unique/i);
    });

    test('an event cannot end before it starts', async () => {
        const err = await t.expectFailure(
            `INSERT INTO calendar_events (school_id, title, starts_on, ends_on)
             VALUES ($1, 'Backwards', '2026-10-10', '2026-10-01')`,
            [ids.schoolId]
        );
        assert.match(err || '', /event_dates_ordered/);
    });

    test('deleting a class cascades its events but not its students', async () => {
        await t.query(
            `INSERT INTO calendar_events (school_id, class_id, title, starts_on, ends_on)
             VALUES ($1, $2, 'Class trip', '2026-10-01', '2026-10-01')`,
            [ids.schoolId, ids.classBId]
        );
        const { rows: [student] } = await t.query(
            `INSERT INTO students (school_id, class_id, admission_no, name)
             VALUES ($1, $2, 'C-001', 'Pupil') RETURNING id`,
            [ids.schoolId, ids.classBId]
        );

        await t.query(`DELETE FROM classes WHERE id = $1`, [ids.classBId]);

        const { rows: events } = await t.query(
            `SELECT id FROM calendar_events WHERE class_id = $1`, [ids.classBId]
        );
        const { rows: [survivor] } = await t.query(
            `SELECT class_id FROM students WHERE id = $1`, [student.id]
        );

        assert.equal(events.length, 0, 'class events should cascade away');
        assert.equal(survivor.class_id, null, 'the pupil should survive, unassigned');
    });
});
