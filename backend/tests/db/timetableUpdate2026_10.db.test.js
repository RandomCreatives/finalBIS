/**
 * supabase/migrations/030_timetable_update_2026_10.sql against a real
 * PostgreSQL engine (PGlite).
 *
 * The database is seeded the way the September scripts left it (seats per
 * setup/restructure/assign-subject-teachers 2026-27, registration at 08:10,
 * a clash-free week placed by the app's own generator, Special Needs Support
 * on Year 3 Blue), then the migration runs exactly as it would in the
 * Supabase SQL Editor. The expected grid comes from
 * fixtures/timetable-2026-10.json, a cell-by-cell transcription of the PDFs
 * (Year_3_Time_Table_Updated.pdf, Year_4_Time_Table_Updated.pdf).
 *
 * The people below are test fixtures. Subject-teacher names match the
 * accounts the September scripts created; class-teacher surnames are made up
 * and only need to match the migration's class-teacher patterns.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const { createTestDb } = require('./harness');
const { generateWeek, LESSON_PERIODS, REGISTRATION } = require('../../utils/timetableGenerator');
const FIXTURE = require('./fixtures/timetable-2026-10.json');

const MIGRATION = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '030_timetable_update_2026_10.sql'),
    'utf8'
);

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const CLASS_TEACHERS = {
    'Year 3 - Blue': 'Mahilet N.',
    'Year 3 - Yellow': 'Meron T.',
    'Year 3 - Red': 'Kalkidan Zewdu',
    'Year 3 - Green': 'Degnet A.',
    'Year 4 - Blue': 'Mulugeta B.',
    'Year 4 - Purple': 'Mekdelawit Abate',
    'Year 4 - Lavender': 'Selam G.',
    'Year 4 - Crimson': 'Simegn H.',
    'Year 4 - Green': 'Samrawit Eshetu',
    'Year 4 - Yellow': 'Mariamawit K.',
    'Year 4 - Magenta': 'Abigia Alemayehu Dogamo',
    'Year 4 - Red': 'Denebe L.',
    'Year 4 - Violet': 'Abigiya M.',
    'Year 4 - Orange': 'Mekdelawit N.',
};
const CLASSES = Object.keys(CLASS_TEACHERS);

/** Name on the PDF -> account the migration should use (default database). */
const SUBJECT_LABELS = {
    'Mr. Emmanuel': 'Emmanuel',
    'Mr. Yadan': 'English Teacher 3',
    'Mr. Mike': 'Michael Okwara Okwara',
    'Mr. Desire': 'Dihurwe Desire',
    'Ms. Fremnet': 'Fremnet Mamo Esubalew',
    'Ms. Mihret': 'Mihiret Moges H/Mariam',
    'Mr. Andu': 'Andu Getachew Tulu',
    'Mr. Kal': 'Kalab Bizueinh Mekonen',
    'Mr. Gebre': 'Gebremariam Yismaw Fanthahun',
    'Mr. Yalew': 'Yalew Endale Gossaye',
    'Mr. Sena': 'Sena Elias Tasisa',
    'Mr. Thomas': 'Thomas Asmelash Gebray',
    'Mr. Amanuel': 'Amanuel Teamu Tsegaye',
    'New Teacher (Music)': 'Music Teacher 1',
    'French Teacher (TBC)': 'French Teacher 2',
};

const SEN_TEACHER = 'Hanna Bekele';

const SUBJECTS = [
    ['MAT', 'Mathematics', 'main_teacher'],
    ['SCI', 'Science', 'main_teacher'],
    ['GLS', 'Global Citizenship', 'main_teacher'],
    ['REG', 'Registration', 'main_teacher'],
    ['ENG', 'English', 'subject_teacher'],
    ['SPL', 'Spelling', 'subject_teacher'],
    ['AMH', 'Amharic', 'subject_teacher'],
    ['FRA', 'French', 'subject_teacher'],
    ['ART', 'Art', 'subject_teacher'],
    ['MUS', 'Music', 'subject_teacher'],
    ['PE', 'Physical Education', 'subject_teacher'],
    ['ICT', 'ICT', 'subject_teacher'],
    ['SNS', 'Special Needs Support', 'subject_teacher'],
    ['GEO', 'Geography', 'subject_teacher'],
    ['HIS', 'History', 'subject_teacher'],
];

// September allocation (assign-subject-teachers-2026-27.js).
const SEPT_ENGLISH = {
    'Dihurwe Desire': ['Year 3 - Blue', 'Year 3 - Green', 'Year 4 - Blue', 'Year 4 - Purple', 'Year 4 - Lavender'],
    'Michael Okwara Okwara': ['Year 3 - Yellow', 'Year 3 - Red', 'Year 4 - Crimson', 'Year 4 - Green', 'Year 4 - Yellow'],
    'English Teacher 3': ['Year 4 - Magenta', 'Year 4 - Red', 'Year 4 - Violet', 'Year 4 - Orange'],
};
const SEPT_GROUP_1 = new Set([
    'Year 3 - Green', 'Year 3 - Red', 'Year 4 - Blue', 'Year 4 - Purple',
    'Year 4 - Lavender', 'Year 4 - Crimson', 'Year 4 - Green',
]);

/** Expected account name for a PDF cell's teacher. */
const accountFor = (label, className, labels) => (
    label === FIXTURE.classes[className].classTeacher ? CLASS_TEACHERS[className] : labels[label]
);

const emailFor = (name) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}@test.et`;

let t;

const one = async (sql, params) => (await t.query(sql, params)).rows[0];
const rows = async (sql, params) => (await t.query(sql, params)).rows;

/** Runs the migration like the SQL Editor does: the whole file at once. */
const runMigration = async () => {
    const results = await t.db.exec(MIGRATION);
    return results[results.length - 1].rows;
};

const migrationError = async () => {
    try {
        await t.db.exec(MIGRATION);
        return null;
    } catch (err) {
        return err.message;
    }
};

/**
 * Seeds the school as the September scripts left it. Returns lookups.
 */
async function seedSeptember() {
    const school = await one(`INSERT INTO schools (name) VALUES ('BIS NOC Gerji') RETURNING id`);
    const pastYear = await one(
        `INSERT INTO academic_years (school_id, name, starts_on, ends_on, is_current)
         VALUES ($1, '2025/2026', '2025-09-01', '2026-07-31', FALSE) RETURNING id`,
        [school.id]
    );
    const year = await one(
        `INSERT INTO academic_years (school_id, name, starts_on, ends_on, is_current)
         VALUES ($1, '2026/2027', '2026-09-01', '2027-07-31', TRUE) RETURNING id`,
        [school.id]
    );
    const term = await one(
        `INSERT INTO terms (school_id, academic_year_id, term_index, name, starts_on, ends_on, is_current)
         VALUES ($1, $2, 1, 'Term 1', '2026-09-01', '2026-11-17', TRUE) RETURNING id`,
        [school.id, year.id]
    );

    const people = [
        { name: 'Mike', email: 'mike@bisnoc.local', role: 'admin', active: true },
        ...Object.values(CLASS_TEACHERS).map((name) => ({ name, role: 'main_teacher', active: true })),
        ...[
            'Dihurwe Desire', 'Michael Okwara Okwara', 'English Teacher 3',
            'Fremnet Mamo Esubalew', 'Mihiret Moges H/Mariam', 'Andu Getachew Tulu',
            'Kalab Bizueinh Mekonen', 'Gebremariam Yismaw Fanthahun', 'Yalew Endale Gossaye',
            'Sena Elias Tasisa', 'Music Teacher 1', 'Thomas Asmelash Gebray',
            'Amanuel Teamu Tsegaye', SEN_TEACHER,
        ].map((name) => ({ name, role: 'subject_teacher', active: true })),
        // Noise the migration must ignore.
        { name: 'English Teacher 4', role: 'subject_teacher', active: false },
    ].map((p) => ({ ...p, email: p.email || emailFor(p.name) }));

    const users = new Map();
    for (const u of await rows(
        `INSERT INTO users (school_id, name, email, password_hash, role, is_active)
         SELECT $1, x.name, x.email, 'x', x.role, x.active
         FROM jsonb_to_recordset($2::jsonb) AS x(name TEXT, email TEXT, role TEXT, active BOOLEAN)
         RETURNING id, name`,
        [school.id, JSON.stringify(people)]
    )) users.set(u.name, u.id);

    const subjects = new Map();
    for (const s of await rows(
        `INSERT INTO subjects (school_id, code, name, taught_by, is_semester)
         SELECT $1, x.code, x.name, x.taught_by, x.code = 'GLS'
         FROM jsonb_to_recordset($2::jsonb) AS x(code TEXT, name TEXT, taught_by TEXT)
         RETURNING id, code`,
        [school.id, JSON.stringify(SUBJECTS.map(([code, name, taughtBy]) => ({ code, name, taught_by: taughtBy })))]
    )) subjects.set(s.code, s.id);

    const classes = new Map();
    for (const c of await rows(
        `INSERT INTO classes (school_id, name, year_level, capacity)
         SELECT $1, x.name, x.level, 30
         FROM jsonb_to_recordset($2::jsonb) AS x(name TEXT, level INT)
         RETURNING id, name`,
        [school.id, JSON.stringify(CLASSES.map((name) => ({ name, level: Number(name[5]) })))]
    )) classes.set(c.name, c.id);

    // Three pupils per class, plus one who has left (not counted).
    const pupils = CLASSES.flatMap((c, i) => [1, 2, 3].map((n) => ({
        class_id: classes.get(c), admission_no: `BIS-${i + 1}-${n}`, name: `Pupil ${i + 1}.${n}`, roll: n, active: true,
    })));
    pupils.push({ class_id: classes.get('Year 3 - Blue'), admission_no: 'BIS-LEFT', name: 'Former Pupil', roll: null, active: false });
    await t.query(
        `INSERT INTO students (school_id, class_id, admission_no, name, roll_num, is_active)
         SELECT $1, x.class_id, x.admission_no, x.name, x.roll, x.active
         FROM jsonb_to_recordset($2::jsonb) AS x(class_id UUID, admission_no TEXT, name TEXT, roll INT, active BOOLEAN)`,
        [school.id, JSON.stringify(pupils)]
    );

    await t.query(
        `INSERT INTO class_staff (school_id, academic_year_id, class_id, user_id, position)
         SELECT $1, $2, x.class_id, x.user_id, 'main'
         FROM jsonb_to_recordset($3::jsonb) AS x(class_id UUID, user_id UUID)`,
        [school.id, year.id, JSON.stringify(CLASSES.map((c) => ({
            class_id: classes.get(c), user_id: users.get(CLASS_TEACHERS[c]),
        })))]
    );

    // September seats.
    const seats = [];
    for (const c of CLASSES) {
        const main = CLASS_TEACHERS[c];
        const english = Object.keys(SEPT_ENGLISH).find((n) => SEPT_ENGLISH[n].includes(c));
        const g1 = SEPT_GROUP_1.has(c);
        const add = (code, teacher, sessions) => seats.push({ c, code, teacher, sessions });
        add('REG', main, 5);
        add('MAT', main, 5);
        add('SCI', main, 3);
        add('GLS', main, 2);
        add('ENG', english, 5);
        add('SPL', c.startsWith('Year 3') ? 'English Teacher 3' : english, 1);
        add('AMH', g1 ? 'Mihiret Moges H/Mariam' : 'Fremnet Mamo Esubalew', 3);
        add('ART', g1 ? 'Kalab Bizueinh Mekonen' : 'Andu Getachew Tulu', 2);
        add('MUS', g1 ? 'Music Teacher 1' : 'Sena Elias Tasisa', 2);
        add('PE', g1 ? 'Gebremariam Yismaw Fanthahun' : 'Yalew Endale Gossaye', 2);
        add('FRA', 'Thomas Asmelash Gebray', 1);
        add('ICT', 'Amanuel Teamu Tsegaye', 1);
        if (c === 'Year 3 - Blue') add('SNS', SEN_TEACHER, 2);
    }

    const seatRows = await rows(
        `INSERT INTO class_subjects (school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week)
         SELECT $1, $2, x.class_id, x.subject_id, x.teacher_id, x.sessions
         FROM jsonb_to_recordset($3::jsonb) AS x(class_id UUID, subject_id UUID, teacher_id UUID, sessions INT)
         RETURNING id, class_id, subject_id, teacher_id, sessions_per_week`,
        [school.id, year.id, JSON.stringify(seats.map((s) => ({
            class_id: classes.get(s.c),
            subject_id: subjects.get(s.code),
            teacher_id: users.get(s.teacher),
            sessions: s.sessions,
        })))]
    );
    const codeById = new Map([...subjects].map(([code, id]) => [id, code]));
    const seatId = new Map(seatRows.map((s) => [`${s.class_id}|${codeById.get(s.subject_id)}`, s.id]));

    // Registration 08:10-08:30 every day, then a clash-free week of lessons.
    const slots = [];
    for (const c of CLASSES) {
        for (let day = 1; day <= 5; day += 1) {
            slots.push({ seat: seatId.get(`${classes.get(c)}|REG`), day, s: REGISTRATION.start, e: REGISTRATION.end });
        }
    }
    const week = generateWeek(
        seatRows
            .filter((s) => codeById.get(s.subject_id) !== 'REG')
            .map((s) => ({
                classId: s.class_id, subjectCode: codeById.get(s.subject_id),
                teacherId: s.teacher_id, sessions: s.sessions_per_week, seatId: s.id,
            })),
        new Set(),
        true
    );
    for (const { assignment, day, period } of week.slots) {
        const [s, e] = LESSON_PERIODS[period];
        slots.push({ seat: assignment.seatId, day, s, e });
    }

    await t.query(
        `INSERT INTO timetable_slots (school_id, academic_year_id, class_subject_id, day_of_week, starts_at, ends_at)
         SELECT $1, $2, x.seat, x.day, x.s::time, x.e::time
         FROM jsonb_to_recordset($3::jsonb) AS x(seat UUID, day INT, s TEXT, e TEXT)`,
        [school.id, year.id, JSON.stringify(slots)]
    );

    // Last year's timetable must not be touched.
    const oldSeat = await one(
        `INSERT INTO class_subjects (school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week)
         VALUES ($1, $2, $3, $4, $5, 5) RETURNING id`,
        [school.id, pastYear.id, classes.get('Year 3 - Blue'), subjects.get('ENG'), users.get('Dihurwe Desire')]
    );
    await t.query(
        `INSERT INTO timetable_slots (school_id, academic_year_id, class_subject_id, day_of_week, starts_at, ends_at)
         VALUES ($1, $2, $3, 1, '08:30', '09:20')`,
        [school.id, pastYear.id, oldSeat.id]
    );

    // A scheme of work on a seat that changes teacher (Year 4 Purple English).
    const scheme = await one(
        `INSERT INTO schemes_of_work (school_id, term_id, class_subject_id, author_id, title)
         VALUES ($1, $2, $3, $4, 'Year 4 Purple English - Term 1') RETURNING id`,
        [school.id, term.id, seatId.get(`${classes.get('Year 4 - Purple')}|ENG`), users.get('Dihurwe Desire')]
    );

    return { school, year, pastYear, term, users, subjects, classes, seatId, scheme, oldSeatId: oldSeat.id };
}

/** Lesson grid of the 14 classes as `${class}|${day}|${period}` -> `${code}|${teacher}`. */
async function readGrid() {
    const lessons = await rows(
        `SELECT c.name AS class_name, ts.day_of_week AS day, left(ts.starts_at::text, 5) AS starts,
                left(ts.ends_at::text, 5) AS ends, s.code, u.name AS teacher,
                ts.teacher_id IS NOT DISTINCT FROM cs.teacher_id AS in_sync
         FROM timetable_slots ts
         JOIN academic_years ay ON ay.id = ts.academic_year_id AND ay.is_current
         JOIN classes c         ON c.id = ts.class_id
         JOIN class_subjects cs ON cs.id = ts.class_subject_id
         JOIN subjects s        ON s.id = cs.subject_id
         LEFT JOIN users u      ON u.id = ts.teacher_id
         WHERE s.code <> 'REG'`
    );
    const grid = {};
    for (const l of lessons) {
        const period = LESSON_PERIODS.findIndex(([s, e]) => s === l.starts && e === l.ends);
        assert.ok(period >= 0, `lesson outside the lesson periods: ${JSON.stringify(l)}`);
        assert.ok(l.in_sync, `slot teacher out of sync with its seat: ${JSON.stringify(l)}`);
        const key = `${l.class_name}|${DAY_NAMES[l.day - 1]}|P${period + 1}`;
        assert.equal(grid[key], undefined, `two lessons in ${key}`);
        grid[key] = `${l.code}|${l.teacher}`;
    }
    return grid;
}

function expectedGrid(labels = SUBJECT_LABELS) {
    const grid = {};
    for (const [className, page] of Object.entries(FIXTURE.classes)) {
        for (const day of DAY_NAMES) {
            page.days[day].forEach((cell, p) => {
                const [code, label] = cell.split('|');
                const teacher = accountFor(label, className, labels);
                assert.ok(teacher, `no account mapped for "${label}"`);
                grid[`${className}|${day}|P${p + 1}`] = `${code}|${teacher}`;
            });
        }
    }
    return grid;
}

/** Everything a failed run must leave untouched. */
async function snapshot() {
    const backups = (await one(`SELECT to_regclass('public.timetable_backups') IS NOT NULL AS present`)).present
        ? Number((await one(`SELECT count(*) AS n FROM timetable_backups`)).n)
        : 0;
    return {
        seats: await rows(`SELECT id, class_id, subject_id, teacher_id, sessions_per_week, updated_at
                           FROM class_subjects ORDER BY id`),
        slots: await rows(`SELECT id, class_subject_id, class_id, teacher_id, day_of_week, starts_at, ends_at
                           FROM timetable_slots ORDER BY id`),
        users: await rows(`SELECT id, name, email, role, is_active, updated_at FROM users ORDER BY id`),
        backups,
    };
}

before(async () => {
    t = await createTestDb();
});

after(async () => {
    if (t) await t.close();
});

describe('030 timetable update on the September database', () => {
    let seed;
    let before030;
    let summary;

    before(async () => {
        await t.query(`TRUNCATE schools RESTART IDENTITY CASCADE`);
        seed = await seedSeptember();
        before030 = await snapshot();
        summary = await runMigration();
    });

    test('every lesson of all 14 classes matches the PDFs cell for cell', async () => {
        const grid = await readGrid();
        assert.equal(Object.keys(grid).length, 420);
        assert.deepEqual(grid, expectedGrid());
    });

    test('registration (08:10-08:30) is untouched', async () => {
        const reg = async () => rows(
            `SELECT ts.id, ts.class_id, ts.teacher_id, ts.day_of_week, ts.starts_at, ts.ends_at
             FROM timetable_slots ts
             JOIN class_subjects cs ON cs.id = ts.class_subject_id
             JOIN subjects s ON s.id = cs.subject_id
             WHERE s.code = 'REG' ORDER BY ts.id`
        );
        const after030 = await reg();
        assert.equal(after030.length, 70);
        const regIds = new Set(after030.map((r) => r.id));
        const regBefore = before030.slots.filter((s) => regIds.has(s.id));
        assert.equal(regBefore.length, 70);
        assert.deepEqual(
            after030.map(({ id, day_of_week: d, starts_at: s, ends_at: e }) => ({ id, d, s, e })),
            regBefore.map(({ id, day_of_week: d, starts_at: s, ends_at: e }) => ({ id, d, s, e }))
        );
        assert.ok(after030.every((r) => r.starts_at === '08:10:00' && r.ends_at === '08:30:00'));
    });

    test('seats carry the new weekly load and the PDF teacher; none deleted', async () => {
        const seats = await rows(
            `SELECT c.name AS class_name, s.code, u.name AS teacher, cs.sessions_per_week AS n,
                    (SELECT count(*)::int FROM timetable_slots ts WHERE ts.class_subject_id = cs.id) AS placed
             FROM class_subjects cs
             JOIN classes c ON c.id = cs.class_id
             JOIN subjects s ON s.id = cs.subject_id
             LEFT JOIN users u ON u.id = cs.teacher_id
             WHERE cs.academic_year_id = $1`,
            [seed.year.id]
        );
        const load = { MAT: 6, ENG: 5, SPL: 1, SCI: 3, GLS: 3, AMH: 3, FRA: 2, ART: 2, MUS: 2, PE: 2, ICT: 1, REG: 5 };
        for (const s of seats) {
            assert.equal(s.placed, s.n, `${s.class_name} ${s.code}: ${s.placed} placed vs ${s.n} per week`);
            if (s.code === 'SNS') continue;
            assert.equal(s.n, load[s.code], `${s.class_name} ${s.code}`);
            if (['MAT', 'SCI', 'GLS', 'REG'].includes(s.code)) {
                assert.equal(s.teacher, CLASS_TEACHERS[s.class_name], `${s.class_name} ${s.code}`);
            }
        }
        // Special Needs Support has no room on the new grid: kept, dormant.
        const sns = seats.find((s) => s.code === 'SNS');
        assert.deepEqual(sns, { class_name: 'Year 3 - Blue', code: 'SNS', teacher: SEN_TEACHER, n: 0, placed: 0 });

        const idsAfter = new Set((await rows(`SELECT id FROM class_subjects`)).map((r) => r.id));
        for (const s of before030.seats) assert.ok(idsAfter.has(s.id), 'a seat was deleted');
        assert.equal(idsAfter.size, before030.seats.length, 'no new seats were needed');
    });

    test('plans stay with their class and subject and follow the new teacher', async () => {
        const row = await one(
            `SELECT u.name AS teacher FROM schemes_of_work sw
             JOIN class_subjects cs ON cs.id = sw.class_subject_id
             JOIN users u ON u.id = cs.teacher_id
             WHERE sw.id = $1`,
            [seed.scheme.id]
        );
        assert.equal(row.teacher, 'Emmanuel');
    });

    test('creates Mr. Emmanuel and French Teacher 2, nothing else', async () => {
        const created = await rows(
            `SELECT name, email, role, is_active, password_hash FROM users
             WHERE id::text NOT IN (SELECT jsonb_array_elements_text($1::jsonb)) ORDER BY name`,
            [JSON.stringify(before030.users.map((u) => u.id))]
        );
        assert.deepEqual(created.map(({ name, email, role, is_active: a }) => ({ name, email, role, a })), [
            { name: 'Emmanuel', email: 'emmanuel@bisnoc.local', role: 'subject_teacher', a: true },
            { name: 'French Teacher 2', email: 'french.teacher.2@bisnocgerji.local', role: 'subject_teacher', a: true },
        ]);
        // The standard basic credential (SUBJECT_BASIC_PASSWORD).
        assert.ok(bcrypt.compareSync('BisNoc2026!', created[0].password_hash));

        // Mr. Yadan has no account yet, so his classes stay on the placeholder.
        const et3 = await one(`SELECT is_active FROM users WHERE name = 'English Teacher 3'`);
        assert.equal(et3.is_active, true);
        const et4 = await one(`SELECT is_active FROM users WHERE name = 'English Teacher 4'`);
        assert.equal(et4.is_active, false, 'unrelated deactivated placeholder left alone');
    });

    // The app derives a teacher's sign-in card, classes, students and marks
    // permissions from their teaching seats (auth.listSubjectTeachers,
    // utils/classAccess, marksheet.controller). Mirror those rules here.
    test('Mr. Emmanuel can work from day one: card, classes, students, marks', async () => {
        const me = await one(`SELECT id FROM users WHERE email = 'emmanuel@bisnoc.local'`);
        const args = [me.id, seed.year.id];

        const card = await rows(
            `SELECT s.name AS subject, count(*)::int AS seats
             FROM class_subjects cs
             JOIN subjects s ON s.id = cs.subject_id
             JOIN users u ON u.id = cs.teacher_id
             WHERE cs.teacher_id = $1 AND cs.academic_year_id = $2 AND s.code <> 'REG'
               AND u.is_active AND u.role = 'subject_teacher'
             GROUP BY s.name ORDER BY s.name`,
            args
        );
        assert.deepEqual(card, [{ subject: 'English', seats: 4 }, { subject: 'Spelling', seats: 4 }]);

        const classes = await rows(
            `SELECT name FROM classes WHERE id IN (
                 SELECT class_id FROM class_staff WHERE user_id = $1 AND academic_year_id = $2
                 UNION
                 SELECT class_id FROM class_subjects WHERE teacher_id = $1 AND academic_year_id = $2)
             ORDER BY name`,
            args
        );
        assert.deepEqual(classes.map((c) => c.name),
            ['Year 3 - Blue', 'Year 4 - Crimson', 'Year 4 - Orange', 'Year 4 - Purple']);

        const pupils = await rows(
            `SELECT id, class_id FROM students
             WHERE is_active AND class_id IN (
                 SELECT class_id FROM class_subjects WHERE teacher_id = $1 AND academic_year_id = $2)`,
            args
        );
        assert.equal(pupils.length, 12);

        const pairs = new Set((await rows(
            `SELECT c.name || ' ' || s.code AS pair
             FROM class_subjects cs
             JOIN classes c ON c.id = cs.class_id
             JOIN subjects s ON s.id = cs.subject_id
             WHERE cs.teacher_id = $1 AND cs.academic_year_id = $2`,
            args
        )).map((r) => r.pair));
        assert.ok(pairs.has('Year 4 - Purple ENG') && pairs.has('Year 4 - Purple SPL'));
        assert.ok(!pairs.has('Year 4 - Purple MAT'), 'Maths stays with the class teacher');
        assert.ok(!pairs.has('Year 3 - Yellow ENG'), 'not one of his classes');

        // English marks for his pupils save like anyone else's.
        for (const pupil of pupils) {
            await t.query(
                `INSERT INTO marksheets (school_id, academic_year_id, student_id, subject_id, class_id,
                                         term_id, marks, max_marks, entered_by)
                 VALUES ($1, $2, $3, $4, $5, $6, 42, 50, $7)`,
                [seed.school.id, seed.year.id, pupil.id, seed.subjects.get('ENG'), pupil.class_id, seed.term.id, me.id]
            );
        }
        const saved = await one(`SELECT count(*)::int AS n FROM marksheets WHERE entered_by = $1`, [me.id]);
        assert.equal(saved.n, 12);
    });

    test('teacher loads match the PDFs; the result table reports them', async () => {
        const byTeacher = Object.fromEntries(summary.map((r) => [r.teacher, r]));
        const expected = {
            Emmanuel: 24,
            'Michael Okwara Okwara': 24,
            'Dihurwe Desire': 18,
            'English Teacher 3': 18,
            'Mihiret Moges H/Mariam': 21,
            'Fremnet Mamo Esubalew': 21,
            'Kalab Bizueinh Mekonen': 14,
            'Andu Getachew Tulu': 14,
            'Sena Elias Tasisa': 14,
            'Music Teacher 1': 14,
            'Yalew Endale Gossaye': 14,
            'Gebremariam Yismaw Fanthahun': 14,
            'Thomas Asmelash Gebray': 14,
            'French Teacher 2': 14,
            'Amanuel Teamu Tsegaye': 14,
        };
        for (const name of Object.values(CLASS_TEACHERS)) expected[name] = 12;
        assert.deepEqual(
            Object.fromEntries(Object.entries(byTeacher).map(([k, v]) => [k, Number(v.lessons_per_week)])),
            expected
        );
        assert.equal(byTeacher.Emmanuel.classes, 'Year 3 - Blue, Year 4 - Crimson, Year 4 - Orange, Year 4 - Purple');
        assert.equal(byTeacher.Emmanuel.subjects, 'English, Spelling');
        // His students come with his classes: 4 classes x 3 active pupils.
        assert.equal(Number(byTeacher.Emmanuel.students), 12);
        assert.equal(Number(byTeacher['Sena Elias Tasisa'].students), 21);
        assert.equal(Number(byTeacher['Mahilet N.'].students), 3, 'pupils who left are not counted');
        assert.match(byTeacher.Emmanuel.note, /BisNoc2026!/);
        assert.match(byTeacher['English Teacher 3'].note, /placeholder/);
        assert.match(byTeacher['French Teacher 2'].note, /placeholder/);
        assert.equal(byTeacher['Sena Elias Tasisa'].note, '');
    });

    test('last year is untouched', async () => {
        const n = await one(
            `SELECT count(*)::int AS n FROM timetable_slots WHERE academic_year_id = $1`, [seed.pastYear.id]
        );
        assert.equal(n.n, 1);
        const seat = await one(`SELECT sessions_per_week AS n FROM class_subjects WHERE id = $1`, [seed.oldSeatId]);
        assert.equal(seat.n, 5);
    });

    test('keeps a backup of the replaced seats and lessons', async () => {
        const backups = await rows(`SELECT reason, seats, slots, academic_year_id FROM timetable_backups`);
        assert.equal(backups.length, 1);
        const [b] = backups;
        assert.equal(b.academic_year_id, seed.year.id);
        const yearSeats = before030.seats.filter((s) => s.id !== seed.oldSeatId);
        const yearSlots = before030.slots.filter((s) => s.class_subject_id !== seed.oldSeatId);
        assert.equal(b.seats.length, yearSeats.length);
        assert.equal(b.slots.length, yearSlots.length);
        assert.deepEqual(new Set(b.slots.map((s) => s.id)), new Set(yearSlots.map((s) => s.id)));
    });

    test('the backup table is locked down like every other table', async () => {
        const rls = await one(
            `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'public.timetable_backups'::regclass`
        );
        assert.deepEqual(rls, { relrowsecurity: true, relforcerowsecurity: true });
        const policies = await one(`SELECT count(*)::int AS n FROM pg_policies WHERE tablename = 'timetable_backups'`);
        assert.equal(policies.n, 0);
        for (const role of ['anon', 'authenticated']) {
            const p = await one(`SELECT has_table_privilege($1, 'public.timetable_backups', 'SELECT') AS ok`, [role]);
            assert.equal(p.ok, false, `${role} can read timetable_backups`);
        }
    });

    test('running it again changes nothing', async () => {
        const first = await snapshot();
        const again = await runMigration();
        assert.deepEqual(await snapshot(), first);
        assert.deepEqual(again, summary);
    });
});

describe('030 timetable update: other databases', () => {
    let seed;

    beforeEach(async () => {
        await t.query(`TRUNCATE schools RESTART IDENTITY CASCADE`);
        seed = await seedSeptember();
    });

    test('uses existing accounts for Mr. Yadan and Mr. Emmanuel; retires the emptied placeholder', async () => {
        await t.query(
            `INSERT INTO users (school_id, name, email, password_hash, role) VALUES
             ($1, 'Yadan Tesfaye', 'yadan@test.et', 'x', 'subject_teacher'),
             ($1, 'Emmanuel Okafor', 'emmanuel.okafor@test.et', 'x', 'subject_teacher')`,
            [seed.school.id]
        );
        // Renamed since September: found by the fallback pattern.
        await t.query(`UPDATE users SET name = 'Michael Okwara' WHERE name = 'Michael Okwara Okwara'`);
        // A deactivated placeholder the timetable needs is simply re-activated.
        await t.query(`UPDATE users SET is_active = FALSE WHERE name = 'Music Teacher 1'`);
        const usersBefore = Number((await one(`SELECT count(*) AS n FROM users`)).n);

        await runMigration();

        const labels = {
            ...SUBJECT_LABELS,
            'Mr. Yadan': 'Yadan Tesfaye',
            'Mr. Emmanuel': 'Emmanuel Okafor',
            'Mr. Mike': 'Michael Okwara',
        };
        assert.deepEqual(await readGrid(), expectedGrid(labels));

        const usersAfter = Number((await one(`SELECT count(*) AS n FROM users`)).n);
        assert.equal(usersAfter, usersBefore + 1, 'only French Teacher 2 is created');
        const state = Object.fromEntries((await rows(
            `SELECT name, is_active FROM users WHERE name IN ('English Teacher 3', 'Music Teacher 1')`
        )).map((u) => [u.name, u.is_active]));
        assert.deepEqual(state, { 'English Teacher 3': false, 'Music Teacher 1': true });
        const seatsLeft = await one(
            `SELECT count(*)::int AS n FROM class_subjects cs JOIN users u ON u.id = cs.teacher_id
             WHERE u.name = 'English Teacher 3'`
        );
        assert.equal(seatsLeft.n, 0);
    });

    test('stops, changing nothing, when a class teacher does not match the PDF', async () => {
        const stranger = await one(
            `INSERT INTO users (school_id, name, email, password_hash, role)
             VALUES ($1, 'Yeabsira Kebede', 'yeabsira@test.et', 'x', 'main_teacher') RETURNING id`,
            [seed.school.id]
        );
        await t.query(
            `UPDATE class_staff SET user_id = $1 WHERE class_id = $2 AND position = 'main'`,
            [stranger.id, seed.classes.get('Year 4 - Green')]
        );
        const before030 = await snapshot();
        const message = await migrationError();
        assert.match(message, /Year 4 - Green: the class teacher on record is "Yeabsira Kebede", but the new timetable says Ms\. Samrawit/);
        assert.match(message, /Nothing was changed/);
        assert.deepEqual(await snapshot(), before030);
    });

    test('stops, changing nothing, on a clash with a class outside Year 3/4', async () => {
        // Find a period where Mr. Amanuel teaches ICT on the new timetable...
        let slot;
        for (const [className, page] of Object.entries(FIXTURE.classes)) {
            for (const [d, day] of DAY_NAMES.entries()) {
                const p = page.days[day].findIndex((cell) => cell === 'ICT|Mr. Amanuel');
                if (p >= 0 && !slot) slot = { className, day: d + 1, period: p };
            }
        }
        const [starts, ends] = LESSON_PERIODS[slot.period];
        const amanuel = seed.users.get('Amanuel Teamu Tsegaye');
        // ...and book him into another class at that time.
        await t.query(
            `DELETE FROM timetable_slots WHERE teacher_id = $1 AND day_of_week = $2 AND starts_at = $3`,
            [amanuel, slot.day, starts]
        );
        const y5 = await one(
            `INSERT INTO classes (school_id, name, year_level) VALUES ($1, 'Year 5 - Blue', 5) RETURNING id`,
            [seed.school.id]
        );
        const y5Seat = await one(
            `INSERT INTO class_subjects (school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week)
             VALUES ($1, $2, $3, $4, $5, 1) RETURNING id`,
            [seed.school.id, seed.year.id, y5.id, seed.subjects.get('ICT'), amanuel]
        );
        await t.query(
            `INSERT INTO timetable_slots (school_id, academic_year_id, class_subject_id, day_of_week, starts_at, ends_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [seed.school.id, seed.year.id, y5Seat.id, slot.day, starts, ends]
        );

        const before030 = await snapshot();
        const message = await migrationError();
        const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][slot.day - 1];
        assert.ok(
            message.includes(`Amanuel Teamu Tsegaye already teaches Year 5 - Blue on ${dayName} at ${starts}`),
            message
        );
        assert.deepEqual(await snapshot(), before030);
    });

    test('stops, changing nothing, when a named teacher has no account', async () => {
        await t.query(`UPDATE users SET name = 'S. E. Tasisa' WHERE name = 'Sena Elias Tasisa'`);
        const before030 = await snapshot();
        const message = await migrationError();
        assert.match(message, /No staff account found for Mr\. Sena \(expected "Sena Elias Tasisa"\)/);
        assert.deepEqual(await snapshot(), before030);
    });

    test('stops when a name on the timetable matches two accounts', async () => {
        await t.query(
            `INSERT INTO users (school_id, name, email, password_hash, role) VALUES
             ($1, 'Yadan Tesfaye', 'yadan@test.et', 'x', 'subject_teacher'),
             ($1, 'Yadan Girma', 'yadan.g@test.et', 'x', 'subject_teacher')`,
            [seed.school.id]
        );
        const before030 = await snapshot();
        const message = await migrationError();
        assert.match(message, /Mr\. Yadan on the timetable matches more than one account \("Yadan Girma", "Yadan Tesfaye"\)/);
        assert.deepEqual(await snapshot(), before030);
    });

    test('refuses to run outside 2026/2027', async () => {
        await t.query(`UPDATE academic_years SET is_current = FALSE`);
        await t.query(`UPDATE academic_years SET is_current = TRUE WHERE name = '2025/2026'`);
        const before030 = await snapshot();
        const message = await migrationError();
        assert.match(message, /2026\/2027 is not the current academic year/);
        assert.deepEqual(await snapshot(), before030);
    });
});
