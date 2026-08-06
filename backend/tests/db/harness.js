/**
 * Real PostgreSQL for tests, via PGlite (Postgres compiled to WASM).
 *
 * This runs supabase/schema.sql and functions.sql against an actual database
 * engine, so constraints, triggers and PL/pgSQL functions are executed rather
 * than merely reviewed. No Docker or external server required.
 */
const fs = require('fs');
const path = require('path');

const SQL_DIR = path.join(__dirname, '..', '..', '..', 'supabase');

let PGlite;
let extensions;

/** Loads PGlite and its contrib extensions (ESM-only, hence dynamic import). */
async function loadPglite() {
    if (PGlite) return;

    ({ PGlite } = await import('@electric-sql/pglite'));

    const [{ btree_gist }, { citext }, { uuid_ossp }] = await Promise.all([
        import('@electric-sql/pglite/contrib/btree_gist'),
        import('@electric-sql/pglite/contrib/citext'),
        import('@electric-sql/pglite/contrib/uuid_ossp'),
    ]);

    extensions = { btree_gist, citext, uuid_ossp };
}

/**
 * Spins up a fresh in-memory database with the full schema applied.
 * Returns the PGlite instance plus a few helpers.
 */
async function createTestDb() {
    await loadPglite();

    const db = new PGlite({ extensions });

    const schema = fs.readFileSync(path.join(SQL_DIR, 'schema.sql'), 'utf8');
    const functions = fs.readFileSync(path.join(SQL_DIR, 'functions.sql'), 'utf8');

    await db.exec(schema);
    await db.exec(functions);

    return {
        db,
        /** Runs SQL and returns rows. */
        query: (sql, params) => db.query(sql, params),
        /** Runs SQL expecting failure; returns the error message, or null if it unexpectedly succeeded. */
        expectFailure: async (sql, params) => {
            try {
                await db.query(sql, params);
                return null;
            } catch (err) {
                return err.message;
            }
        },
        close: () => db.close(),
    };
}

/** Inserts a minimal school + year + term + class + subject graph. */
async function seedBaseline(query) {
    const { rows: [school] } = await query(
        `INSERT INTO schools (name) VALUES ('Test School') RETURNING id`
    );

    const { rows: [year] } = await query(
        `INSERT INTO academic_years (school_id, name, starts_on, ends_on, is_current)
         VALUES ($1, '2026/2027', '2026-09-01', '2027-07-31', TRUE) RETURNING id`,
        [school.id]
    );

    const { rows: [term] } = await query(
        `INSERT INTO terms (school_id, academic_year_id, term_index, name, starts_on, ends_on, is_current)
         VALUES ($1, $2, 1, 'Term 1', '2026-09-01', '2026-11-17', TRUE) RETURNING id`,
        [school.id, year.id]
    );

    const { rows: [admin] } = await query(
        `INSERT INTO users (school_id, name, email, password_hash, role)
         VALUES ($1, 'Admin', 'admin@test.et', 'x', 'admin') RETURNING id`,
        [school.id]
    );

    const { rows: [mainTeacher] } = await query(
        `INSERT INTO users (school_id, name, email, password_hash, role)
         VALUES ($1, 'Meron', 'meron@test.et', 'x', 'main_teacher') RETURNING id`,
        [school.id]
    );

    const { rows: [subjectTeacher] } = await query(
        `INSERT INTO users (school_id, name, email, password_hash, role)
         VALUES ($1, 'Dawit', 'dawit@test.et', 'x', 'subject_teacher') RETURNING id`,
        [school.id]
    );

    const { rows: [classA] } = await query(
        `INSERT INTO classes (school_id, name, capacity) VALUES ($1, 'Year 3A', 3) RETURNING id`,
        [school.id]
    );

    const { rows: [classB] } = await query(
        `INSERT INTO classes (school_id, name, capacity) VALUES ($1, 'Year 3B', 25) RETURNING id`,
        [school.id]
    );

    const { rows: [english] } = await query(
        `INSERT INTO subjects (school_id, name, code, taught_by)
         VALUES ($1, 'English', 'ENG', 'subject_teacher') RETURNING id`,
        [school.id]
    );

    const { rows: [maths] } = await query(
        `INSERT INTO subjects (school_id, name, code, taught_by)
         VALUES ($1, 'Mathematics', 'MAT', 'main_teacher') RETURNING id`,
        [school.id]
    );

    return {
        schoolId: school.id,
        yearId: year.id,
        termId: term.id,
        adminId: admin.id,
        mainTeacherId: mainTeacher.id,
        subjectTeacherId: subjectTeacher.id,
        classAId: classA.id,
        classBId: classB.id,
        englishId: english.id,
        mathsId: maths.id,
    };
}

module.exports = { createTestDb, seedBaseline };
