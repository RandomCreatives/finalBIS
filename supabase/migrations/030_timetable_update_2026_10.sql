-- 030_timetable_update_2026_10.sql
-- New Year 3 & Year 4 timetable (received 15 October 2026) and the new
-- English teacher, Mr. Emmanuel.
--
-- Source: Year_3_Time_Table_Updated.pdf and Year_4_Time_Table_Updated.pdf,
-- one page per class, Monday to Friday, periods 1-6. The grid below is a
-- cell-by-cell transcription of those pages. (The colour legend at the foot
-- of some pages is out of date; the grid itself is what gets applied.)
--
-- WHAT IT DOES (current academic year 2026/2027, the 14 Year 3/4 classes)
--   * Replaces every class's weekly lessons with the new grid: 30 lessons per
--     class, 420 in all. Registration (08:10-08:30) is left exactly as it is.
--       Every class: Maths 6, English 5, Spelling 1, Science 3, Global
--       Citizenship 3, Amharic 3, French 2, Art 2, Music 2, PE 2, ICT 1
--       (until now: Maths 5, Global Citizenship 2, French 1).
--   * Points each class/subject seat (class_subjects) at the teacher named on
--     the new timetable and sets its lessons per week. Seats are updated,
--     never deleted, so schemes of work and lesson plans stay with their class
--     and subject. A seat the new timetable has no room for (e.g. Special
--     Needs Support on Year 3 Blue) is kept, with 0 lessons per week.
--   * Mr. Emmanuel (new English teacher): uses his account if one exists (a
--     subject teacher whose name contains "Emmanuel"); otherwise creates it:
--     name "Emmanuel", emmanuel@bisnoc.local, subject teacher, first password
--     BisNoc2026! (the standard basic credential; he changes it under
--     Settings, and the Staff page can reset it).
--   * Mr. Yadan: uses his account if one exists (name contains "Yadan");
--     otherwise his classes stay on the "English Teacher 3" placeholder.
--     Rename that account to him on the Staff page and everything follows.
--   * "French Teacher (TBC)" -> placeholder account "French Teacher 2"
--     "New Teacher (Music)"  -> placeholder account "Music Teacher 1"
--     (created if missing, re-activated if deactivated).
--   * A placeholder account left with no lessons at all (English Teacher 3,
--     once Mr. Yadan has his own account) is deactivated.
--   * The previous seats and lessons are copied into timetable_backups first.
--
-- SAFETY
--   * One block, one transaction. Every check runs before anything is
--     written, and any problem (a class teacher who doesn't match the PDF, a
--     teacher who can't be found, a clash with another class) stops the run
--     with a plain-English message and changes NOTHING.
--   * The database's own double-booking rules still guard every lesson.
--   * Safe to re-run: once applied, running it again changes nothing.
--
-- HOW TO RUN: Supabase -> SQL Editor -> New query -> paste this whole file ->
-- Run. The result is a table of every Year 3/4 teacher's lessons per week.


-- ---------------------------------------------------------------------------
-- timetable_backups: one row per timetable rewrite, holding the replaced
-- seats and lessons as JSON. Locked down like every other table (RLS on and
-- forced, no policies, nothing granted to anon/authenticated).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timetable_backups (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    reason           TEXT NOT NULL,
    seats            JSONB NOT NULL,
    slots            JSONB NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE timetable_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_backups FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON timetable_backups FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON timetable_backups FROM authenticated;
    END IF;
END $$;


DO $migration$
DECLARE
    -- bcrypt hash of BisNoc2026!, the basic credential every subject-teacher
    -- account starts (and resets) to: SUBJECT_BASIC_PASSWORD in
    -- backend/controllers/auth.controller.js, same hash as migration 012.
    c_basic_hash CONSTANT TEXT   := '$2a$12$jVvHpVG5qszwKEk8k0suCea/J50mLYP071GLFkw9/NmQwOl.9ppQe';
    c_reason     CONSTANT TEXT   := '030: new Year 3/4 timetable received 2026-10-15';
    c_days       CONSTANT TEXT[] := ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    -- Placeholder accounts are named like "French Teacher 2".
    c_placeholder CONSTANT TEXT  := '\steacher\s+\d+$';

    v_school  UUID;
    v_year    UUID;
    v_gc      TEXT;
    v_user    UUID;
    v_how     TEXT;
    v_n       INTEGER;
    v_list    TEXT;
    v_removed INTEGER;
    v_added   INTEGER;
    v_acct    RECORD;
    r         RECORD;
BEGIN
    -- =====================================================================
    -- 1. Which school and year
    -- =====================================================================
    SELECT count(*) INTO v_n FROM schools;
    IF v_n <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one school in the database, found %. Nothing was changed.', v_n;
    END IF;
    SELECT id INTO v_school FROM schools;

    SELECT id INTO v_year
    FROM academic_years
    WHERE school_id = v_school AND is_current AND name = '2026/2027';
    IF v_year IS NULL THEN
        RAISE EXCEPTION 'This timetable is for 2026/2027, but 2026/2027 is not the current academic year. Nothing was changed.';
    END IF;

    -- =====================================================================
    -- 2. The new timetable
    -- =====================================================================
    CREATE TEMP TABLE tt_period (
        period    INTEGER PRIMARY KEY,
        starts_at TIME NOT NULL,
        ends_at   TIME NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO tt_period (period, starts_at, ends_at) VALUES
        (1, '08:30', '09:20'),
        (2, '09:20', '10:10'),   -- snack 10:10-10:40
        (3, '10:40', '11:30'),
        (4, '11:30', '12:20'),   -- lunch 12:20-13:10
        (5, '13:10', '14:00'),   -- mini break 14:00-14:10
        (6, '14:10', '15:00');

    -- One row per class per day with periods 1-6 left to right, i.e. one
    -- column of the PDF page. GLS = Global Citizenship.
    CREATE TEMP TABLE tt_grid (
        class_name  TEXT    NOT NULL,
        day_of_week INTEGER NOT NULL,
        period      INTEGER NOT NULL,
        code        TEXT    NOT NULL,
        PRIMARY KEY (class_name, day_of_week, period)
    ) ON COMMIT DROP;

    INSERT INTO tt_grid (class_name, day_of_week, period, code)
    SELECT v.class_name,
           array_position(ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], v.day),
           p.period,
           (ARRAY[v.p1, v.p2, v.p3, v.p4, v.p5, v.p6])[p.period]
    FROM (VALUES
        -- class              day    P1     P2     P3     P4     P5     P6
        ('Year 3 - Blue',     'Mon', 'MAT', 'FRA', 'MAT', 'AMH', 'PE',  'ENG'),
        ('Year 3 - Blue',     'Tue', 'ENG', 'MAT', 'ART', 'GLS', 'SPL', 'SCI'),
        ('Year 3 - Blue',     'Wed', 'ENG', 'MAT', 'MUS', 'SCI', 'AMH', 'GLS'),
        ('Year 3 - Blue',     'Thu', 'ENG', 'ART', 'MAT', 'FRA', 'SCI', 'MUS'),
        ('Year 3 - Blue',     'Fri', 'AMH', 'ENG', 'MAT', 'ICT', 'GLS', 'PE'),

        ('Year 3 - Yellow',   'Mon', 'ART', 'ENG', 'MAT', 'ICT', 'SCI', 'AMH'),
        ('Year 3 - Yellow',   'Tue', 'AMH', 'MAT', 'ENG', 'GLS', 'MUS', 'PE'),
        ('Year 3 - Yellow',   'Wed', 'MUS', 'MAT', 'ENG', 'PE',  'SCI', 'AMH'),
        ('Year 3 - Yellow',   'Thu', 'MAT', 'FRA', 'MAT', 'ART', 'GLS', 'ENG'),
        ('Year 3 - Yellow',   'Fri', 'ENG', 'MAT', 'FRA', 'SCI', 'SPL', 'GLS'),

        ('Year 3 - Red',      'Mon', 'ENG', 'PE',  'MAT', 'FRA', 'SCI', 'ART'),
        ('Year 3 - Red',      'Tue', 'MAT', 'PE',  'ART', 'GLS', 'AMH', 'ENG'),
        ('Year 3 - Red',      'Wed', 'ENG', 'SCI', 'MAT', 'ICT', 'GLS', 'AMH'),
        ('Year 3 - Red',      'Thu', 'MAT', 'ENG', 'MAT', 'FRA', 'GLS', 'MUS'),
        ('Year 3 - Red',      'Fri', 'MUS', 'MAT', 'AMH', 'SCI', 'ENG', 'SPL'),

        ('Year 3 - Green',    'Mon', 'SCI', 'ICT', 'MAT', 'MUS', 'ENG', 'AMH'),
        ('Year 3 - Green',    'Tue', 'ENG', 'MAT', 'MAT', 'MUS', 'SPL', 'GLS'),
        ('Year 3 - Green',    'Wed', 'ART', 'MAT', 'ENG', 'GLS', 'AMH', 'SCI'),
        ('Year 3 - Green',    'Thu', 'ENG', 'PE',  'MAT', 'ART', 'SCI', 'FRA'),
        ('Year 3 - Green',    'Fri', 'ENG', 'FRA', 'MAT', 'AMH', 'GLS', 'PE'),

        ('Year 4 - Blue',     'Mon', 'MAT', 'MUS', 'MAT', 'PE',  'GLS', 'ENG'),
        ('Year 4 - Blue',     'Tue', 'FRA', 'MAT', 'ICT', 'ENG', 'GLS', 'AMH'),
        ('Year 4 - Blue',     'Wed', 'FRA', 'MAT', 'ART', 'SCI', 'ENG', 'PE'),
        ('Year 4 - Blue',     'Thu', 'MAT', 'ART', 'AMH', 'SCI', 'ENG', 'SPL'),
        ('Year 4 - Blue',     'Fri', 'AMH', 'MAT', 'MUS', 'GLS', 'ENG', 'SCI'),

        ('Year 4 - Purple',   'Mon', 'FRA', 'MAT', 'ENG', 'SCI', 'SPL', 'GLS'),
        ('Year 4 - Purple',   'Tue', 'ICT', 'MAT', 'AMH', 'SCI', 'ART', 'ENG'),
        ('Year 4 - Purple',   'Wed', 'PE',  'AMH', 'MAT', 'MUS', 'GLS', 'ENG'),
        ('Year 4 - Purple',   'Thu', 'GLS', 'MUS', 'MAT', 'PE',  'ENG', 'AMH'),
        ('Year 4 - Purple',   'Fri', 'MAT', 'MAT', 'ART', 'FRA', 'SCI', 'ENG'),

        ('Year 4 - Lavender', 'Mon', 'ART', 'MAT', 'AMH', 'GLS', 'ENG', 'MUS'),
        ('Year 4 - Lavender', 'Tue', 'MAT', 'ENG', 'MAT', 'FRA', 'GLS', 'PE'),
        ('Year 4 - Lavender', 'Wed', 'MAT', 'MUS', 'SCI', 'AMH', 'ENG', 'GLS'),
        ('Year 4 - Lavender', 'Thu', 'MAT', 'FRA', 'ENG', 'AMH', 'SCI', 'ICT'),
        ('Year 4 - Lavender', 'Fri', 'PE',  'MAT', 'ENG', 'SCI', 'ART', 'SPL'),

        ('Year 4 - Crimson',  'Mon', 'ENG', 'MAT', 'ART', 'AMH', 'SCI', 'FRA'),
        ('Year 4 - Crimson',  'Tue', 'AMH', 'MUS', 'MAT', 'ENG', 'GLS', 'FRA'),
        ('Year 4 - Crimson',  'Wed', 'MAT', 'ENG', 'GLS', 'PE',  'SCI', 'ICT'),
        ('Year 4 - Crimson',  'Thu', 'MAT', 'ENG', 'MAT', 'MUS', 'SCI', 'SPL'),
        ('Year 4 - Crimson',  'Fri', 'ART', 'GLS', 'MAT', 'PE',  'ENG', 'AMH'),

        ('Year 4 - Green',    'Mon', 'AMH', 'MAT', 'ENG', 'GLS', 'SPL', 'PE'),
        ('Year 4 - Green',    'Tue', 'MAT', 'ENG', 'MAT', 'PE',  'SCI', 'MUS'),
        ('Year 4 - Green',    'Wed', 'AMH', 'MAT', 'FRA', 'GLS', 'ART', 'ENG'),
        ('Year 4 - Green',    'Thu', 'AMH', 'MAT', 'ICT', 'SCI', 'ENG', 'ART'),
        ('Year 4 - Green',    'Fri', 'MAT', 'GLS', 'ENG', 'SCI', 'MUS', 'FRA'),

        ('Year 4 - Yellow',   'Mon', 'AMH', 'ENG', 'MAT', 'FRA', 'GLS', 'MUS'),
        ('Year 4 - Yellow',   'Tue', 'MAT', 'PE',  'ENG', 'GLS', 'SPL', 'SCI'),
        ('Year 4 - Yellow',   'Wed', 'MAT', 'ENG', 'MAT', 'ART', 'SCI', 'FRA'),
        ('Year 4 - Yellow',   'Thu', 'AMH', 'MAT', 'ENG', 'GLS', 'PE',  'ART'),
        ('Year 4 - Yellow',   'Fri', 'ICT', 'ENG', 'MAT', 'AMH', 'SCI', 'MUS'),

        ('Year 4 - Magenta',  'Mon', 'MAT', 'GLS', 'PE',  'MUS', 'SCI', 'ENG'),
        ('Year 4 - Magenta',  'Tue', 'ENG', 'MAT', 'AMH', 'FRA', 'SCI', 'ICT'),
        ('Year 4 - Magenta',  'Wed', 'MAT', 'ART', 'MAT', 'ENG', 'SPL', 'GLS'),
        ('Year 4 - Magenta',  'Thu', 'ENG', 'MAT', 'AMH', 'MUS', 'GLS', 'FRA'),
        ('Year 4 - Magenta',  'Fri', 'ENG', 'MAT', 'ART', 'PE',  'SCI', 'AMH'),

        ('Year 4 - Red',      'Mon', 'MAT', 'AMH', 'ENG', 'SCI', 'ART', 'GLS'),
        ('Year 4 - Red',      'Tue', 'ENG', 'FRA', 'MAT', 'SPL', 'ART', 'AMH'),
        ('Year 4 - Red',      'Wed', 'ENG', 'AMH', 'MAT', 'FRA', 'MUS', 'SCI'),
        ('Year 4 - Red',      'Thu', 'MAT', 'GLS', 'PE',  'SCI', 'ENG', 'MAT'),
        ('Year 4 - Red',      'Fri', 'PE',  'ENG', 'MAT', 'MUS', 'GLS', 'ICT'),

        ('Year 4 - Violet',   'Mon', 'ENG', 'MAT', 'ART', 'SCI', 'MAT', 'FRA'),
        ('Year 4 - Violet',   'Tue', 'MAT', 'MUS', 'MAT', 'AMH', 'GLS', 'ENG'),
        ('Year 4 - Violet',   'Wed', 'PE',  'ICT', 'MAT', 'AMH', 'GLS', 'ENG'),
        ('Year 4 - Violet',   'Thu', 'PE',  'MAT', 'ENG', 'SCI', 'AMH', 'GLS'),
        ('Year 4 - Violet',   'Fri', 'ART', 'MUS', 'ENG', 'SPL', 'FRA', 'SCI'),

        ('Year 4 - Orange',   'Mon', 'MAT', 'MUS', 'SCI', 'ENG', 'GLS', 'ICT'),
        ('Year 4 - Orange',   'Tue', 'ART', 'ENG', 'MAT', 'PE',  'GLS', 'FRA'),
        ('Year 4 - Orange',   'Wed', 'AMH', 'MAT', 'ENG', 'GLS', 'SPL', 'PE'),
        ('Year 4 - Orange',   'Thu', 'MAT', 'MUS', 'MAT', 'ENG', 'SCI', 'AMH'),
        ('Year 4 - Orange',   'Fri', 'FRA', 'MAT', 'AMH', 'ENG', 'ART', 'SCI')
    ) AS v(class_name, day, p1, p2, p3, p4, p5, p6)
    CROSS JOIN generate_series(1, 6) AS p(period);

    -- Who teaches what in each class (the teacher keys are resolved to staff
    -- accounts in step 5). Maths, Science and Global Citizenship are taught by
    -- the class teacher, checked against class staffing in step 3.
    CREATE TEMP TABLE tt_plan (
        class_name  TEXT NOT NULL,
        code        TEXT NOT NULL,
        teacher_key TEXT NOT NULL,
        PRIMARY KEY (class_name, code)
    ) ON COMMIT DROP;

    INSERT INTO tt_plan (class_name, code, teacher_key)
    SELECT v.class_name, s.code, s.teacher_key
    FROM (VALUES
        -- class              English     Spelling    Amharic    French        Art     Music        PE       ICT
        ('Year 3 - Blue',     'EMMANUEL', 'EMMANUEL', 'FREMNET', 'FRENCH_TBC', 'ANDU', 'MUSIC_TBC', 'GEBRE', 'AMANUEL'),
        ('Year 3 - Yellow',   'YADAN',    'YADAN',    'FREMNET', 'FRENCH_TBC', 'ANDU', 'MUSIC_TBC', 'GEBRE', 'AMANUEL'),
        ('Year 3 - Red',      'MIKE',     'MIKE',     'MIHRET',  'THOMAS',     'KAL',  'SENA',      'YALEW', 'AMANUEL'),
        ('Year 3 - Green',    'DESIRE',   'DESIRE',   'MIHRET',  'THOMAS',     'KAL',  'SENA',      'YALEW', 'AMANUEL'),
        ('Year 4 - Blue',     'DESIRE',   'DESIRE',   'MIHRET',  'THOMAS',     'KAL',  'SENA',      'YALEW', 'AMANUEL'),
        ('Year 4 - Purple',   'EMMANUEL', 'EMMANUEL', 'MIHRET',  'THOMAS',     'KAL',  'SENA',      'YALEW', 'AMANUEL'),
        ('Year 4 - Lavender', 'YADAN',    'YADAN',    'MIHRET',  'THOMAS',     'KAL',  'SENA',      'YALEW', 'AMANUEL'),
        ('Year 4 - Crimson',  'EMMANUEL', 'EMMANUEL', 'MIHRET',  'THOMAS',     'KAL',  'SENA',      'YALEW', 'AMANUEL'),
        ('Year 4 - Green',    'MIKE',     'MIKE',     'MIHRET',  'THOMAS',     'KAL',  'SENA',      'YALEW', 'AMANUEL'),
        ('Year 4 - Yellow',   'MIKE',     'MIKE',     'FREMNET', 'FRENCH_TBC', 'ANDU', 'MUSIC_TBC', 'GEBRE', 'AMANUEL'),
        ('Year 4 - Magenta',  'MIKE',     'MIKE',     'FREMNET', 'FRENCH_TBC', 'ANDU', 'MUSIC_TBC', 'GEBRE', 'AMANUEL'),
        ('Year 4 - Red',      'YADAN',    'YADAN',    'FREMNET', 'FRENCH_TBC', 'ANDU', 'MUSIC_TBC', 'GEBRE', 'AMANUEL'),
        ('Year 4 - Violet',   'DESIRE',   'DESIRE',   'FREMNET', 'FRENCH_TBC', 'ANDU', 'MUSIC_TBC', 'GEBRE', 'AMANUEL'),
        ('Year 4 - Orange',   'EMMANUEL', 'EMMANUEL', 'FREMNET', 'FRENCH_TBC', 'ANDU', 'MUSIC_TBC', 'GEBRE', 'AMANUEL')
    ) AS v(class_name, eng, spl, amh, fra, art, mus, pe, ict)
    CROSS JOIN LATERAL (VALUES
        ('ENG', v.eng), ('SPL', v.spl), ('AMH', v.amh), ('FRA', v.fra),
        ('ART', v.art), ('MUS', v.mus), ('PE',  v.pe),  ('ICT', v.ict),
        ('MAT', 'CLASS'), ('SCI', 'CLASS'), ('GLS', 'CLASS')
    ) AS s(code, teacher_key);

    -- The class teacher printed on each page, and how to recognise them in
    -- class staffing (a case-insensitive pattern on the account name).
    CREATE TEMP TABLE tt_class (
        class_name   TEXT PRIMARY KEY,
        on_timetable TEXT NOT NULL,
        name_pattern TEXT NOT NULL,
        class_id     UUID,
        teacher_id   UUID
    ) ON COMMIT DROP;

    INSERT INTO tt_class (class_name, on_timetable, name_pattern) VALUES
        ('Year 3 - Blue',     'Ms. Mahilet',    '^mahilet\M'),
        ('Year 3 - Yellow',   'Ms. Meron',      '^meron\M'),
        ('Year 3 - Red',      'Ms. Kalkidan',   '^kalkidan\M'),
        ('Year 3 - Green',    'Mr. Degnet',     '^degi?net\M'),
        ('Year 4 - Blue',     'Mr. Mulugeta',   '^mulugeta\M'),
        ('Year 4 - Purple',   'Ms. Mekdelawit', '^mekdelawit\s+a'),
        ('Year 4 - Lavender', 'Ms. Selam',      '^selam\M'),
        ('Year 4 - Crimson',  'Ms. Simegn',     '^simegn\M'),
        ('Year 4 - Green',    'Ms. Samrawit',   '^samrawit\M'),
        ('Year 4 - Yellow',   'Ms. Mariamawit', '^mariam'),
        ('Year 4 - Magenta',  'Ms. Abigail',    '^(abigail|abigia)\M'),
        ('Year 4 - Red',      'Ms. Denebe',     '^denebe\M'),
        ('Year 4 - Violet',   'Ms. Abigiya',    '^abigiya\M'),
        ('Year 4 - Orange',   'Ms. Mekdelawit', '^mekdelawit\s+n');

    -- How each teacher on the timetable maps to a staff account:
    --   1. the account named account_name; else
    --   2. the one active subject teacher whose name matches name_pattern; else
    --   3. the account named create_name, or the one with create_email, or a
    --      new subject-teacher account with that name and email; else stop.
    CREATE TEMP TABLE tt_teacher (
        teacher_key  TEXT PRIMARY KEY,
        on_timetable TEXT NOT NULL,
        account_name TEXT,
        name_pattern TEXT,
        create_name  TEXT,
        create_email TEXT,
        user_id      UUID,
        how          TEXT
    ) ON COMMIT DROP;

    INSERT INTO tt_teacher (teacher_key, on_timetable, account_name, name_pattern, create_name, create_email) VALUES
        ('EMMANUEL',   'Mr. Emmanuel',         'Emmanuel',                     '\mem+anuel\M', 'Emmanuel',          'emmanuel@bisnoc.local'),
        ('YADAN',      'Mr. Yadan',            NULL,                           '\myadan\M',    'English Teacher 3', 'english.teacher.3@bisnocgerji.local'),
        ('MIKE',       'Mr. Mike',             'Michael Okwara Okwara',        '\mokwara\M',   NULL,                NULL),
        ('DESIRE',     'Mr. Desire',           'Dihurwe Desire',               '\mdesire\M',   NULL,                NULL),
        ('FREMNET',    'Ms. Fremnet',          'Fremnet Mamo Esubalew',        '^fremnet\M',   NULL,                NULL),
        ('MIHRET',     'Ms. Mihret',           'Mihiret Moges H/Mariam',       '^mihi?ret\M',  NULL,                NULL),
        ('ANDU',       'Mr. Andu',             'Andu Getachew Tulu',           '^andu\M',      NULL,                NULL),
        ('KAL',        'Mr. Kal',              'Kalab Bizueinh Mekonen',       '^kal(ab)?\M',  NULL,                NULL),
        ('GEBRE',      'Mr. Gebre',            'Gebremariam Yismaw Fanthahun', '^gebre',       NULL,                NULL),
        ('YALEW',      'Mr. Yalew',            'Yalew Endale Gossaye',         '^yalew\M',     NULL,                NULL),
        ('SENA',       'Mr. Sena',             'Sena Elias Tasisa',            '^sena\M',      NULL,                NULL),
        ('THOMAS',     'Mr. Thomas',           'Thomas Asmelash Gebray',       '^thomas\M',    NULL,                NULL),
        ('AMANUEL',    'Mr. Amanuel',          'Amanuel Teamu Tsegaye',        '^amanuel\M',   NULL,                NULL),
        ('MUSIC_TBC',  'New Teacher (Music)',  'Music Teacher 1',              NULL,           'Music Teacher 1',   'music.teacher.1@bisnocgerji.local'),
        ('FRENCH_TBC', 'French Teacher (TBC)', 'French Teacher 2',             NULL,           'French Teacher 2',  'french.teacher.2@bisnocgerji.local');

    -- Self-checks on the data above (they guard this file, not the database).
    SELECT count(*) INTO v_n FROM tt_grid;
    IF v_n <> 14 * 30
       OR (SELECT count(*) FROM tt_class) <> 14
       OR EXISTS (SELECT 1 FROM tt_grid g
                  WHERE NOT EXISTS (SELECT 1 FROM tt_class c WHERE c.class_name = g.class_name)
                     OR NOT EXISTS (SELECT 1 FROM tt_plan p WHERE p.class_name = g.class_name AND p.code = g.code))
       OR EXISTS (SELECT 1 FROM tt_plan p
                  WHERE NOT EXISTS (SELECT 1 FROM tt_grid g WHERE g.class_name = p.class_name AND g.code = p.code)
                     OR (p.teacher_key <> 'CLASS'
                         AND NOT EXISTS (SELECT 1 FROM tt_teacher t WHERE t.teacher_key = p.teacher_key)))
    THEN
        RAISE EXCEPTION 'Internal check failed: the timetable data in this file is inconsistent. Nothing was changed.';
    END IF;

    -- =====================================================================
    -- 3. Classes and their class teachers
    -- =====================================================================
    UPDATE tt_class t
    SET class_id = c.id
    FROM classes c
    WHERE c.school_id = v_school AND c.name = t.class_name;

    SELECT string_agg(class_name, ', ' ORDER BY class_name) INTO v_list
    FROM tt_class WHERE class_id IS NULL;
    IF v_list IS NOT NULL THEN
        RAISE EXCEPTION 'Class not found: %. Nothing was changed.', v_list;
    END IF;

    FOR r IN
        SELECT t.class_name, t.on_timetable, t.name_pattern,
               count(cs.id)            AS mains,
               min(u.name)             AS main_name,
               bool_and(u.is_active)   AS main_active,
               (array_agg(u.id))[1]    AS main_id
        FROM tt_class t
        LEFT JOIN class_staff cs
               ON cs.class_id = t.class_id AND cs.academic_year_id = v_year AND cs.position = 'main'
        LEFT JOIN users u ON u.id = cs.user_id
        GROUP BY t.class_name, t.on_timetable, t.name_pattern
        ORDER BY t.class_name
    LOOP
        IF r.mains = 0 THEN
            RAISE EXCEPTION '% has no class teacher for 2026/2027; the new timetable says %. Set one on the Staff Assignment page, then run this file again. Nothing was changed.',
                r.class_name, r.on_timetable;
        ELSIF r.mains > 1 THEN
            RAISE EXCEPTION '% has % class teachers on record; the new timetable says %. Fix it on the Staff Assignment page, then run this file again. Nothing was changed.',
                r.class_name, r.mains, r.on_timetable;
        ELSIF r.main_name !~* r.name_pattern THEN
            RAISE EXCEPTION '%: the class teacher on record is "%", but the new timetable says %. Fix it on the Staff Assignment page (or check the timetable), then run this file again. Nothing was changed.',
                r.class_name, r.main_name, r.on_timetable;
        ELSIF NOT r.main_active THEN
            RAISE EXCEPTION '%: class teacher "%" is deactivated. Re-activate the account on the Staff page, then run this file again. Nothing was changed.',
                r.class_name, r.main_name;
        END IF;

        UPDATE tt_class SET teacher_id = r.main_id WHERE class_name = r.class_name;
    END LOOP;

    -- =====================================================================
    -- 4. Subjects
    -- =====================================================================
    -- Global Citizenship has been GLS since September; older data used GCT.
    -- Use whichever one the timetable already schedules (GLS on a tie).
    SELECT s.code INTO v_gc
    FROM subjects s
    LEFT JOIN class_subjects cs
           ON cs.subject_id = s.id AND cs.academic_year_id = v_year AND cs.sessions_per_week > 0
    WHERE s.school_id = v_school AND s.code IN ('GLS', 'GCT')
    GROUP BY s.code
    ORDER BY count(cs.id) DESC, s.code = 'GLS' DESC
    LIMIT 1;

    CREATE TEMP TABLE tt_subject (
        code       TEXT PRIMARY KEY,   -- the code used in this file
        subject_id UUID
    ) ON COMMIT DROP;

    INSERT INTO tt_subject (code, subject_id)
    SELECT x.code, s.id
    FROM unnest(ARRAY['MAT', 'ENG', 'SPL', 'SCI', 'GLS', 'AMH', 'FRA', 'ART', 'MUS', 'PE', 'ICT']) AS x(code)
    LEFT JOIN subjects s
           ON s.school_id = v_school
          AND s.code = CASE WHEN x.code = 'GLS' THEN coalesce(v_gc, 'GLS') ELSE x.code END;

    SELECT string_agg(code, ', ' ORDER BY code) INTO v_list FROM tt_subject WHERE subject_id IS NULL;
    IF v_list IS NOT NULL THEN
        RAISE EXCEPTION 'Subject code not found on the Subjects page: % (GLS = Global Citizenship). Nothing was changed.', v_list;
    END IF;

    -- =====================================================================
    -- 5. Teachers -> staff accounts
    -- =====================================================================
    FOR r IN SELECT * FROM tt_teacher ORDER BY teacher_key LOOP
        v_user := NULL;
        v_how  := NULL;

        -- 5.1 The exact account name.
        IF r.account_name IS NOT NULL THEN
            SELECT count(*), (array_agg(id))[1] INTO v_n, v_user
            FROM users
            WHERE school_id = v_school AND lower(btrim(name)) = lower(r.account_name);
            IF v_n > 1 THEN
                RAISE EXCEPTION 'There are % staff accounts named "%" (% on the timetable). Rename or remove the duplicate on the Staff page, then run this file again. Nothing was changed.',
                    v_n, r.account_name, r.on_timetable;
            END IF;
            IF v_user IS NOT NULL THEN v_how := 'found by name'; END IF;
        END IF;

        -- 5.2 Otherwise the one active subject teacher whose name matches.
        IF v_user IS NULL AND r.name_pattern IS NOT NULL THEN
            SELECT count(*), (array_agg(id))[1], string_agg(name, '", "' ORDER BY name)
            INTO v_n, v_user, v_list
            FROM users
            WHERE school_id = v_school AND role = 'subject_teacher' AND is_active
              AND name ~* r.name_pattern;
            IF v_n > 1 THEN
                RAISE EXCEPTION '% on the timetable matches more than one account ("%"). Rename one of them on the Staff page, then run this file again. Nothing was changed.',
                    r.on_timetable, v_list;
            END IF;
            IF v_user IS NOT NULL THEN v_how := 'found by name'; END IF;
        END IF;

        -- 5.3 Otherwise the stand-in account: found, or created.
        IF v_user IS NULL AND r.create_name IS NOT NULL THEN
            SELECT count(*), (array_agg(id))[1] INTO v_n, v_user
            FROM users
            WHERE school_id = v_school AND lower(btrim(name)) = lower(r.create_name);
            IF v_n > 1 THEN
                RAISE EXCEPTION 'There are % staff accounts named "%". Rename or remove the duplicate on the Staff page, then run this file again. Nothing was changed.',
                    v_n, r.create_name;
            END IF;
            IF v_user IS NULL THEN
                SELECT id INTO v_user FROM users WHERE email = r.create_email;
            END IF;

            IF v_user IS NOT NULL THEN
                v_how := CASE WHEN r.create_name ~* c_placeholder
                              THEN 'placeholder account' ELSE 'found by email' END;
            ELSE
                INSERT INTO users (school_id, name, email, password_hash, role)
                VALUES (v_school, r.create_name, r.create_email, c_basic_hash, 'subject_teacher')
                RETURNING id INTO v_user;
                v_how := 'NEW account, first password BisNoc2026!';
            END IF;
        END IF;

        IF v_user IS NULL THEN
            RAISE EXCEPTION 'No staff account found for % (expected "%"). Add or rename the account on the Staff page, then run this file again. Nothing was changed.',
                r.on_timetable, r.account_name;
        END IF;

        -- 5.4 It must be an active subject teacher. Placeholders are simply
        -- re-activated; a deactivated real teacher is left to the admin.
        SELECT name, role, is_active INTO v_acct FROM users WHERE id = v_user;
        IF v_acct.role <> 'subject_teacher' THEN
            RAISE EXCEPTION '% on the timetable resolves to "%", which is a % account, not a subject teacher. Fix the account on the Staff page, then run this file again. Nothing was changed.',
                r.on_timetable, v_acct.name, v_acct.role;
        END IF;
        IF NOT v_acct.is_active THEN
            IF v_acct.name ~* c_placeholder THEN
                UPDATE users SET is_active = TRUE WHERE id = v_user;
                v_how := v_how || ', re-activated';
            ELSE
                RAISE EXCEPTION '% on the timetable resolves to "%", but that account is deactivated. Re-activate it on the Staff page, then run this file again. Nothing was changed.',
                    r.on_timetable, v_acct.name;
            END IF;
        END IF;

        UPDATE tt_teacher SET user_id = v_user, how = v_how WHERE teacher_key = r.teacher_key;
    END LOOP;

    SELECT string_agg(DISTINCT u.name, ', ') INTO v_list
    FROM tt_teacher t
    JOIN users u ON u.id = t.user_id
    WHERE t.user_id IN (SELECT user_id FROM tt_teacher GROUP BY user_id HAVING count(*) > 1);
    IF v_list IS NOT NULL THEN
        RAISE EXCEPTION 'One account would stand in for two different teachers on the timetable: %. Nothing was changed.', v_list;
    END IF;

    FOR r IN
        SELECT t.on_timetable, u.name, t.how
        FROM tt_teacher t JOIN users u ON u.id = t.user_id
        ORDER BY t.on_timetable
    LOOP
        RAISE NOTICE '% -> % (%)', r.on_timetable, r.name, r.how;
    END LOOP;

    -- =====================================================================
    -- 6. Target seats and lessons
    -- =====================================================================
    CREATE TEMP TABLE tt_seat (
        class_id   UUID    NOT NULL,
        subject_id UUID    NOT NULL,
        teacher_id UUID    NOT NULL,
        sessions   INTEGER NOT NULL,
        PRIMARY KEY (class_id, subject_id)
    ) ON COMMIT DROP;

    INSERT INTO tt_seat (class_id, subject_id, teacher_id, sessions)
    SELECT c.class_id,
           s.subject_id,
           CASE WHEN p.teacher_key = 'CLASS' THEN c.teacher_id ELSE t.user_id END,
           (SELECT count(*) FROM tt_grid g WHERE g.class_name = p.class_name AND g.code = p.code)
    FROM tt_plan p
    JOIN tt_class c   ON c.class_name = p.class_name
    JOIN tt_subject s ON s.code = p.code
    LEFT JOIN tt_teacher t ON t.teacher_key = p.teacher_key;

    CREATE TEMP TABLE tt_slot ON COMMIT DROP AS
    SELECT c.class_id, c.class_name, s.subject_id, g.code, se.teacher_id,
           g.day_of_week, g.period, pe.starts_at, pe.ends_at
    FROM tt_grid g
    JOIN tt_class c   ON c.class_name = g.class_name
    JOIN tt_subject s ON s.code = g.code
    JOIN tt_seat se   ON se.class_id = c.class_id AND se.subject_id = s.subject_id
    JOIN tt_period pe ON pe.period = g.period;

    -- Nobody may be in two classes at once on the new timetable itself.
    SELECT string_agg(format('%s on %s period %s', u.name, c_days[x.day_of_week], x.period), '; ')
    INTO v_list
    FROM (SELECT teacher_id, day_of_week, period
          FROM tt_slot GROUP BY teacher_id, day_of_week, period HAVING count(*) > 1) x
    JOIN users u ON u.id = x.teacher_id;
    IF v_list IS NOT NULL THEN
        RAISE EXCEPTION 'The new timetable puts a teacher in two classes at once: %. Nothing was changed.', v_list;
    END IF;

    -- =====================================================================
    -- 7. Already applied? Then leave everything exactly as it is.
    -- =====================================================================
    WITH live AS (
        SELECT ts.class_id, cs.subject_id, ts.day_of_week, ts.starts_at, ts.ends_at
        FROM timetable_slots ts
        JOIN tt_class c        ON c.class_id = ts.class_id
        JOIN class_subjects cs ON cs.id = ts.class_subject_id
        JOIN subjects s        ON s.id = cs.subject_id
        WHERE ts.academic_year_id = v_year AND s.code <> 'REG'
    ), target AS (
        SELECT class_id, subject_id, day_of_week, starts_at, ends_at FROM tt_slot
    )
    SELECT (SELECT count(*) FROM (SELECT * FROM target EXCEPT SELECT * FROM live) a)
         + (SELECT count(*) FROM (SELECT * FROM live EXCEPT SELECT * FROM target) b)
         + (SELECT count(*)
            FROM tt_seat t
            LEFT JOIN class_subjects cs
                   ON cs.academic_year_id = v_year AND cs.class_id = t.class_id AND cs.subject_id = t.subject_id
            WHERE cs.id IS NULL
               OR cs.teacher_id IS DISTINCT FROM t.teacher_id
               OR cs.sessions_per_week <> t.sessions)
         + (SELECT count(*)
            FROM class_subjects cs
            JOIN tt_class c ON c.class_id = cs.class_id
            JOIN subjects s ON s.id = cs.subject_id
            WHERE cs.academic_year_id = v_year AND s.code <> 'REG' AND cs.sessions_per_week > 0
              AND NOT EXISTS (SELECT 1 FROM tt_seat t
                              WHERE t.class_id = cs.class_id AND t.subject_id = cs.subject_id))
    INTO v_n;

    IF v_n = 0 THEN
        RAISE NOTICE 'The new timetable is already in place. Nothing changed.';
        RETURN;
    END IF;

    -- =====================================================================
    -- 8. Back up the current seats and lessons of these classes
    -- =====================================================================
    INSERT INTO timetable_backups (school_id, academic_year_id, reason, seats, slots)
    VALUES (
        v_school, v_year, c_reason,
        (SELECT coalesce(jsonb_agg(to_jsonb(cs) ORDER BY cs.class_id, cs.subject_id), '[]'::jsonb)
         FROM class_subjects cs JOIN tt_class c ON c.class_id = cs.class_id
         WHERE cs.academic_year_id = v_year),
        (SELECT coalesce(jsonb_agg(to_jsonb(ts) ORDER BY ts.class_id, ts.day_of_week, ts.starts_at), '[]'::jsonb)
         FROM timetable_slots ts JOIN tt_class c ON c.class_id = ts.class_id
         WHERE ts.academic_year_id = v_year)
    );

    -- Who held seats here before, so emptied placeholders can be tidied up.
    CREATE TEMP TABLE tt_old_holder ON COMMIT DROP AS
    SELECT DISTINCT cs.teacher_id AS user_id
    FROM class_subjects cs JOIN tt_class c ON c.class_id = cs.class_id
    WHERE cs.academic_year_id = v_year AND cs.teacher_id IS NOT NULL;

    -- =====================================================================
    -- 9. Clear the old lessons (registration stays)
    -- =====================================================================
    DELETE FROM timetable_slots ts
    USING tt_class c, class_subjects cs, subjects s
    WHERE ts.academic_year_id = v_year
      AND ts.class_id = c.class_id
      AND cs.id = ts.class_subject_id
      AND s.id = cs.subject_id
      AND s.code <> 'REG';
    GET DIAGNOSTICS v_removed = ROW_COUNT;

    -- =====================================================================
    -- 10. Seats: teacher + lessons per week. Never deleted.
    -- =====================================================================
    INSERT INTO class_subjects (school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week)
    SELECT v_school, v_year, t.class_id, t.subject_id, t.teacher_id, t.sessions
    FROM tt_seat t
    ON CONFLICT (class_id, subject_id, academic_year_id) DO UPDATE
        SET teacher_id        = EXCLUDED.teacher_id,
            sessions_per_week = EXCLUDED.sessions_per_week
        WHERE class_subjects.teacher_id IS DISTINCT FROM EXCLUDED.teacher_id
           OR class_subjects.sessions_per_week IS DISTINCT FROM EXCLUDED.sessions_per_week;

    -- Seats the new timetable has no room for keep their teacher and their
    -- plans, with 0 lessons per week.
    FOR r IN
        SELECT cs.id, c.class_name, s.name AS subject, cs.sessions_per_week
        FROM class_subjects cs
        JOIN tt_class c ON c.class_id = cs.class_id
        JOIN subjects s ON s.id = cs.subject_id
        WHERE cs.academic_year_id = v_year AND s.code <> 'REG' AND cs.sessions_per_week > 0
          AND NOT EXISTS (SELECT 1 FROM tt_seat t
                          WHERE t.class_id = cs.class_id AND t.subject_id = cs.subject_id)
        ORDER BY c.class_name, s.name
    LOOP
        UPDATE class_subjects SET sessions_per_week = 0 WHERE id = r.id;
        RAISE NOTICE '% - %: not on the new timetable, seat kept with 0 lessons a week (was %).',
            r.class_name, r.subject, r.sessions_per_week;
    END LOOP;

    -- =====================================================================
    -- 11. Clashes with the rest of the school's timetable
    -- =====================================================================
    SELECT string_agg(DISTINCT format('%s already teaches %s on %s at %s',
                                      u.name, oc.name, c_days[e.day_of_week], left(e.starts_at::text, 5)), '; ')
    INTO v_list
    FROM tt_slot x
    JOIN timetable_slots e
      ON e.academic_year_id = v_year AND e.teacher_id = x.teacher_id AND e.day_of_week = x.day_of_week
     AND e.starts_at < x.ends_at AND x.starts_at < e.ends_at
    JOIN users u    ON u.id = x.teacher_id
    JOIN classes oc ON oc.id = e.class_id;
    IF v_list IS NOT NULL THEN
        RAISE EXCEPTION 'Clash with the rest of the timetable: %. Free those periods first, then run this file again. Nothing was changed.', v_list;
    END IF;

    SELECT string_agg(DISTINCT format('%s already has %s on %s at %s',
                                      x.class_name, s.name, c_days[e.day_of_week], left(e.starts_at::text, 5)), '; ')
    INTO v_list
    FROM tt_slot x
    JOIN timetable_slots e
      ON e.academic_year_id = v_year AND e.class_id = x.class_id AND e.day_of_week = x.day_of_week
     AND e.starts_at < x.ends_at AND x.starts_at < e.ends_at
    JOIN class_subjects cs ON cs.id = e.class_subject_id
    JOIN subjects s        ON s.id = cs.subject_id;
    IF v_list IS NOT NULL THEN
        RAISE EXCEPTION 'Clash with the rest of the timetable: %. Nothing was changed.', v_list;
    END IF;

    -- =====================================================================
    -- 12. Place the new lessons (the trigger fills in class and teacher)
    -- =====================================================================
    INSERT INTO timetable_slots (school_id, academic_year_id, class_subject_id, day_of_week, starts_at, ends_at)
    SELECT v_school, v_year, cs.id, x.day_of_week, x.starts_at, x.ends_at
    FROM tt_slot x
    JOIN class_subjects cs
      ON cs.academic_year_id = v_year AND cs.class_id = x.class_id AND cs.subject_id = x.subject_id;
    GET DIAGNOSTICS v_added = ROW_COUNT;

    -- =====================================================================
    -- 13. Final checks
    -- =====================================================================
    IF v_added <> 14 * 30 THEN
        RAISE EXCEPTION 'Check failed: placed % lessons instead of 420. Nothing was changed.', v_added;
    END IF;

    -- Every seat's lessons on the timetable equal its lessons per week.
    SELECT string_agg(format('%s - %s: %s on the timetable, %s a week', c.class_name, s.name, n.slots, cs.sessions_per_week), '; ')
    INTO v_list
    FROM class_subjects cs
    JOIN tt_class c ON c.class_id = cs.class_id
    JOIN subjects s ON s.id = cs.subject_id
    CROSS JOIN LATERAL (SELECT count(*) AS slots FROM timetable_slots ts WHERE ts.class_subject_id = cs.id) n
    WHERE cs.academic_year_id = v_year AND s.code <> 'REG' AND n.slots <> cs.sessions_per_week;
    IF v_list IS NOT NULL THEN
        RAISE EXCEPTION 'Check failed: %. Nothing was changed.', v_list;
    END IF;

    -- =====================================================================
    -- 14. Tidy up: placeholders with no lessons left are deactivated
    -- =====================================================================
    FOR r IN
        SELECT u.id, u.name, (u.name ~* c_placeholder) AS is_placeholder
        FROM users u
        JOIN tt_old_holder h ON h.user_id = u.id
        WHERE u.is_active AND u.role = 'subject_teacher'
          AND NOT EXISTS (SELECT 1 FROM class_subjects cs
                          WHERE cs.teacher_id = u.id AND cs.academic_year_id = v_year
                            AND cs.sessions_per_week > 0)
        ORDER BY u.name
    LOOP
        IF r.is_placeholder THEN
            UPDATE users SET is_active = FALSE WHERE id = r.id;
            RAISE NOTICE 'Placeholder "%" has no lessons left and was deactivated.', r.name;
        ELSE
            RAISE NOTICE '% no longer has any lessons this year.', r.name;
        END IF;
    END LOOP;

    RAISE NOTICE 'Done: % old lessons removed, % new lessons placed in 14 classes. Registration unchanged.', v_removed, v_added;
END $migration$;


-- ---------------------------------------------------------------------------
-- Result: every Year 3/4 teacher's week (registration excluded). A teacher's
-- students, marksheets, attendance and planning all follow these classes and
-- subjects, so nothing else needs setting up per teacher.
-- ---------------------------------------------------------------------------
WITH lessons AS (
    SELECT ts.teacher_id, ts.class_id, sj.name AS subject, sj.code
    FROM timetable_slots ts
    JOIN academic_years ay ON ay.id = ts.academic_year_id AND ay.is_current
    JOIN classes c         ON c.id = ts.class_id
    JOIN class_subjects cs ON cs.id = ts.class_subject_id
    JOIN subjects sj       ON sj.id = cs.subject_id
    WHERE c.name ~ '^Year [34] - ' AND sj.code <> 'REG'
)
SELECT u.name                                                  AS teacher,
       string_agg(DISTINCT l.subject, ', ' ORDER BY l.subject) AS subjects,
       count(*)                                                AS lessons_per_week,
       string_agg(DISTINCT c.name, ', ' ORDER BY c.name)       AS classes,
       (SELECT count(*)
        FROM students st
        WHERE st.is_active
          AND st.class_id IN (SELECT l2.class_id FROM lessons l2 WHERE l2.teacher_id = u.id))
                                                               AS students,
       CASE
           WHEN u.name ~* '\steacher\s+\d+$'
               THEN 'placeholder: rename on the Staff page once the teacher is confirmed'
           WHEN u.email = 'emmanuel@bisnoc.local' AND u.last_login_at IS NULL
               THEN 'new account: first password BisNoc2026! (change it under Settings)'
           ELSE ''
       END                                                     AS note
FROM lessons l
JOIN users u   ON u.id = l.teacher_id
JOIN classes c ON c.id = l.class_id
GROUP BY u.id, u.name, u.email, u.last_login_at
ORDER BY bool_or(l.code IN ('MAT', 'SCI', 'GLS', 'GCT')), min(l.subject), u.name;
