/**
 * supabase/migrations/032_magenta_main_teacher_bethelhem.sql against a real
 * PostgreSQL engine (PGlite).
 *
 * Seeds 2026/2027 the way migrations 009/030 leave it — Year 4 - Magenta with
 * Ms. Abigia Alemayehu Dogamo as main teacher, her Mathematics/Science/Global
 * Citizenship seats, an English seat held by a subject teacher, and lessons
 * placed in the timetable — then runs the migration exactly as it would run
 * in the Supabase SQL Editor.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const { createTestDb } = require('./harness');

const MIGRATION = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '032_magenta_main_teacher_bethelhem.sql'),
    'utf8'
);

const ABIGIA = 'Abigia Alemayehu Dogamo';
const BETHELHEM = 'Bethelhem Girma';
const MAGENTA = 'Year 4 - Magenta';
const OTHER_CLASS = 'Year 4 - Violet';

let t;
let ids;

/** Lesson periods used by the school (08:30 onwards). */
const PERIODS = [
    ['08:30', '09:10'],
    ['09:10', '09:50'],
    ['09:50', '10:30'],
];

/**
 * Fresh graph for each test:
 *   Abigia        main teacher of Magenta
 *   Betselot      subject teacher (English in Magenta)
 *   Bethelhem     only when a test asks for a pre-existing account
 */
async function seed({ withBethelhemAccount = false, bethelhemElsewhere = false } = {}) {
    const { rows: [school] } = await t.query(
        `INSERT INTO schools (name) VALUES ('Test School') RETURNING id`
    );
    const { rows: [year] } = await t.query(
        `INSERT INTO academic_years (school_id, name, starts_on, ends_on, is_current)
         VALUES ($1, '2026/2027', '2026-09-01', '2027-07-31', TRUE) RETURNING id`,
        [school.id]
    );

    const mkClass = async (name) => (await t.query(
        `INSERT INTO classes (school_id, name, year_level, capacity)
         VALUES ($1, $2, 4, 30) RETURNING id`,
        [school.id, name]
    )).rows[0].id;

    const magenta = await mkClass(MAGENTA);
    const violet = await mkClass(OTHER_CLASS);

    const mkUser = async (name, role) => (await t.query(
        `INSERT INTO users (school_id, name, email, password_hash, role)
         VALUES ($1, $2, $3, 'x', $4) RETURNING id`,
        [school.id, name, `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@bisnoc.local`, role]
    )).rows[0].id;

    const abigia = await mkUser(ABIGIA, 'main_teacher');
    const englishTeacher = await mkUser('Betselot Tesfaye', 'subject_teacher');
    const bethelhem = withBethelhemAccount || bethelhemElsewhere
        ? await mkUser(BETHELHEM, 'main_teacher')
        : null;

    const mkSubject = async (name, code, taughtBy) => (await t.query(
        `INSERT INTO subjects (school_id, name, code, taught_by)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [school.id, name, code, taughtBy]
    )).rows[0].id;

    const mat = await mkSubject('Mathematics', 'MAT', 'main_teacher');
    const sci = await mkSubject('Science', 'SCI', 'main_teacher');
    const gls = await mkSubject('Global Citizenship', 'GLS', 'main_teacher');
    const eng = await mkSubject('English', 'ENG', 'subject_teacher');

    // Abigia leads Magenta; her class-teacher seats are hers, English is not.
    await t.query(
        `INSERT INTO class_staff (school_id, academic_year_id, class_id, user_id, position)
         VALUES ($1, $2, $3, $4, 'main')`,
        [school.id, year.id, magenta, abigia]
    );

    const seat = async (classId, subjectId, teacherId, sessions) => (await t.query(
        `INSERT INTO class_subjects (school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [school.id, year.id, classId, subjectId, teacherId, sessions]
    )).rows[0].id;

    const matSeat = await seat(magenta, mat, abigia, 6);
    const sciSeat = await seat(magenta, sci, abigia, 3);
    const glsSeat = await seat(magenta, gls, abigia, 3);
    const engSeat = await seat(magenta, eng, englishTeacher, 5);

    // Three of Abigia's lessons placed in the timetable.
    const slot = (seatId, day, [start, end]) => t.query(
        `INSERT INTO timetable_slots (school_id, academic_year_id, class_subject_id, day_of_week, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [school.id, year.id, seatId, day, start, end]
    );
    await slot(matSeat, 1, PERIODS[0]);
    await slot(sciSeat, 1, PERIODS[1]);
    await slot(glsSeat, 2, PERIODS[0]);
    await slot(engSeat, 2, PERIODS[1]);

    if (bethelhemElsewhere) {
        await t.query(
            `INSERT INTO class_staff (school_id, academic_year_id, class_id, user_id, position)
             VALUES ($1, $2, $3, $4, 'main')`,
            [school.id, year.id, violet, bethelhem]
        );
    }

    ids = { school: school.id, year: year.id, magenta, violet, abigia, bethelhem, englishTeacher };
    return ids;
}

const runMigration = () => t.db.exec(MIGRATION);

const mainTeacher = async (classId = ids.magenta) => {
    const { rows } = await t.query(
        `SELECT u.name FROM class_staff cs JOIN users u ON u.id = cs.user_id
         WHERE cs.class_id = $1 AND cs.position = 'main'`,
        [classId]
    );
    return rows.map((r) => r.name);
};

const seatTeacher = async (code) => {
    const { rows } = await t.query(
        `SELECT u.name FROM class_subjects cs
         JOIN subjects s ON s.id = cs.subject_id
         LEFT JOIN users u ON u.id = cs.teacher_id
         WHERE cs.class_id = $1 AND s.code = $2`,
        [ids.magenta, code]
    );
    return rows[0]?.name ?? null;
};

const lessonTeachers = async () => {
    const { rows } = await t.query(
        `SELECT DISTINCT u.name FROM timetable_slots ts
         JOIN class_subjects cs ON cs.id = ts.class_subject_id
         JOIN subjects s ON s.id = cs.subject_id
         LEFT JOIN users u ON u.id = ts.teacher_id
         WHERE s.taught_by = 'main_teacher'
         ORDER BY u.name`
    );
    return rows.map((r) => r.name);
};

before(async () => {
    t = await createTestDb();
});

after(async () => {
    if (t) await t.close();
});

beforeEach(async () => {
    await t.query(`TRUNCATE schools RESTART IDENTITY CASCADE`);
});

describe('032 — Year 4 Magenta: main teacher becomes Bethelhem Girma', () => {
    test('swaps the homeroom and hands over the class-teacher lessons', async () => {
        await seed();
        await runMigration();

        assert.deepEqual(await mainTeacher(), [BETHELHEM]);

        // Mathematics, Science and Global Citizenship follow the homeroom.
        assert.equal(await seatTeacher('MAT'), BETHELHEM);
        assert.equal(await seatTeacher('SCI'), BETHELHEM);
        assert.equal(await seatTeacher('GLS'), BETHELHEM);

        // ... and their placed lessons moved with them.
        assert.deepEqual(await lessonTeachers(), [BETHELHEM]);
    });

    test('leaves subject-teacher seats and the outgoing teacher alone', async () => {
        await seed();
        await runMigration();

        assert.equal(await seatTeacher('ENG'), 'Betselot Tesfaye', 'English is not a class-teacher seat');

        const { rows: [abigia] } = await t.query(
            `SELECT is_active, telegram_id FROM users WHERE name = $1`, [ABIGIA]
        );
        assert.equal(abigia.is_active, true, 'she keeps her account');

        const { rows } = await t.query(
            `SELECT count(*)::int AS n FROM class_staff WHERE user_id = $1 AND position = 'main'`,
            [ids.abigia]
        );
        assert.equal(rows[0].n, 0, 'she no longer seats the homeroom');
    });

    test('creates the new staff account with the standard first credential', async () => {
        await seed();
        await runMigration();

        const { rows: [bethelhem] } = await t.query(
            `SELECT email, role, is_active, password_hash FROM users WHERE name = $1`, [BETHELHEM]
        );
        assert.equal(bethelhem.email, 'bethelhem.girma@bisnoc.local');
        assert.equal(bethelhem.role, 'main_teacher');
        assert.equal(bethelhem.is_active, true);
        assert.match(bethelhem.password_hash, /^\$2[aby]\$12\$/, 'bcrypt hash, never plaintext');
        assert.ok(bcrypt.compareSync('year 4 magenta', bethelhem.password_hash));
    });

    test('reuses an existing account instead of creating a second one', async () => {
        await seed({ withBethelhemAccount: true });
        const before = await t.query(`SELECT count(*)::int AS n FROM users WHERE name = $1`, [BETHELHEM]);

        await runMigration();

        const after = await t.query(`SELECT count(*)::int AS n FROM users WHERE name = $1`, [BETHELHEM]);
        assert.equal(after.rows[0].n, before.rows[0].n);
        assert.deepEqual(await mainTeacher(), [BETHELHEM]);
    });

    test('is safe to re-run', async () => {
        await seed();
        await runMigration();
        const first = await t.query(`SELECT count(*)::int AS n FROM class_subjects`);

        await runMigration();

        assert.deepEqual(await mainTeacher(), [BETHELHEM]);
        const second = await t.query(`SELECT count(*)::int AS n FROM class_subjects`);
        assert.equal(second.rows[0].n, first.rows[0].n, 'no seats added or removed');

        const users = await t.query(`SELECT count(*)::int AS n FROM users WHERE name = $1`, [BETHELHEM]);
        assert.equal(users.rows[0].n, 1);
    });

    test('refuses when she already leads another class, changing nothing', async () => {
        await seed({ bethelhemElsewhere: true });

        await assert.rejects(runMigration, /already the main teacher of Year 4 - Violet/);

        assert.deepEqual(await mainTeacher(), [ABIGIA], 'Magenta is untouched');
        assert.equal(await seatTeacher('MAT'), ABIGIA);
    });

    test('refuses when the move would double-book her, changing nothing', async () => {
        await seed({ withBethelhemAccount: true });

        // She already teaches Year 4 - Violet at 08:30 on Monday, exactly when
        // Magenta's Mathematics lesson sits.
        const { rows: [violetMat] } = await t.query(
            `INSERT INTO class_subjects (school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week)
             SELECT $1, $2, $3, s.id, $4, 6 FROM subjects s WHERE s.code = 'MAT'
             RETURNING id`,
            [ids.school, ids.year, ids.violet, ids.bethelhem]
        );
        await t.query(
            `INSERT INTO timetable_slots (school_id, academic_year_id, class_subject_id, day_of_week, starts_at, ends_at)
             VALUES ($1, $2, $3, 1, '08:30', '09:10')`,
            [ids.school, ids.year, violetMat.id]
        );

        await assert.rejects(runMigration, /already teaches 1 lesson/);

        assert.deepEqual(await mainTeacher(), [ABIGIA]);
        assert.equal(await seatTeacher('MAT'), ABIGIA);
    });

    test('the database itself allows only one main teacher per class', async () => {
        // A safety net behind the migration's own guard: uniq_class_position
        // makes a second main seat impossible in the first place.
        await seed();

        const error = await t.expectFailure(
            `INSERT INTO class_staff (school_id, academic_year_id, class_id, user_id, position)
             VALUES ($1, $2, $3, $4, 'main')`,
            [ids.school, ids.year, ids.magenta, ids.englishTeacher]
        );
        assert.match(String(error), /uniq_class_position|duplicate key/i);

        await runMigration();
        assert.deepEqual(await mainTeacher(), [BETHELHEM]);
    });
});
