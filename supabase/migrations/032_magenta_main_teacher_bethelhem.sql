-- =============================================================================
-- 032_magenta_main_teacher_bethelhem.sql
--
-- Year 4 - Magenta: the main teacher becomes Ms. Bethelhem Girma.
--   before: Ms. Abigia Alemayehu Dogamo
--   after:  Ms. Bethelhem Girma
--
-- WHAT IT DOES (current academic year 2026/2027 only)
--   1. Finds Ms. Bethelhem Girma's staff account, or creates it:
--        name  Bethelhem Girma
--        email bethelhem.girma@bisnoc.local   (same first.last pattern the
--              staff import uses)
--        role  main_teacher, active
--        first password "year 4 magenta" — the class card password every main
--        teacher starts (and resets) to. She can change it under Settings.
--   2. Makes her the class's single main teacher in class_staff.
--   3. Hands her the class-teacher subject seats in Magenta (Mathematics,
--      Science, Global Citizenship, Registration — every seat whose subject
--      the school gives to the class's own teacher) that the outgoing main
--      teacher held, plus any such seat still unassigned. The
--      class_subjects -> timetable_slots trigger moves her lessons with her,
--      so the timetable immediately shows her name.
--
-- WHAT IT LEAVES ALONE
--   * Ms. Abigia's account stays ACTIVE and untouched otherwise — she keeps
--     any non-homeroom seats (special-needs support, subject cover, assistant
--     duties). Deactivate her on the Staff page if she has left the school.
--     Nothing is deleted, so this is fully reversible (see ROLLBACK below).
--   * Subject-teacher seats (English, Amharic, French, Art, Music, PE, ICT,
--     Spelling) in Magenta are not touched, whoever holds them.
--   * Students, attendance, marksheets, notices and messages are keyed by
--     class, not by teacher, so none of it moves or changes.
--
-- SAFETY
--   * One DO block, one transaction. Every check runs before anything is
--     written; any problem stops the run with a plain-English message and
--     changes NOTHING.
--   * Refuses to run if Magenta already has two main teachers on record, if
--     Ms. Bethelhem is already the main teacher of a different class this
--     year, if the name matches more than one account, or if moving the
--     lessons would double-book her (the database's own exclusion
--     constraints are checked up front so the failure is readable).
--   * Safe to re-run: once applied, running it again reports "already" and
--     changes nothing.
--
-- HOW TO RUN: Supabase -> SQL Editor -> New query -> paste this whole file ->
-- Run. The result is a table listing Magenta's main teacher and seats.
--
-- ROLLBACK (only if needed):
--   UPDATE class_staff cs SET user_id = a.id
--     FROM classes c, users a
--    WHERE c.name = 'Year 4 - Magenta' AND cs.class_id = c.id
--      AND cs.position = 'main' AND a.name = 'Abigia Alemayehu Dogamo'
--      AND cs.user_id <> a.id;
--   UPDATE class_subjects cs SET teacher_id = a.id
--     FROM classes c, users a, users b, subjects s
--    WHERE c.name = 'Year 4 - Magenta' AND cs.class_id = c.id
--      AND cs.subject_id = s.id AND s.taught_by = 'main_teacher'
--      AND b.name = 'Bethelhem Girma' AND cs.teacher_id = b.id
--      AND a.name = 'Abigia Alemayehu Dogamo';
-- =============================================================================

DO $migration$
DECLARE
    -- bcrypt hash of 'year 4 magenta', the class card credential every main
    -- teacher starts (and resets) to.
    c_basic_hash CONSTANT TEXT := '$2a$12$.gPYAFdP7YCuzg4dnVPfqeBQHmmzDaHemVfUdQ6SEeESqP10mFO9u';
    c_legacy_hash CONSTANT TEXT := '$2a$12$jVvHpVG5qszwKEk8k0suCea/J50mLYP071GLFkw9/NmQwOl.9ppQe';
    c_class      CONSTANT TEXT := 'Year 4 - Magenta';
    c_teacher    CONSTANT TEXT := 'Bethelhem Girma';
    c_email      CONSTANT TEXT := 'bethelhem.girma@bisnoc.local';

    v_school    UUID;
    v_year      UUID;
    v_class     UUID;
    v_new       UUID;
    v_new_role  TEXT;
    v_old       UUID;
    v_old_name  TEXT;
    v_n         INTEGER;
    v_mains     INTEGER;
    v_list      TEXT;
    v_seats     INTEGER;
    v_slots     INTEGER;
    v_clashes   INTEGER;
    v_assistant UUID;
    v_email_name TEXT;
BEGIN
    -- =====================================================================
    -- 1. Which school, which year, which class
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
        RAISE EXCEPTION '2026/2027 is not the current academic year. Nothing was changed.';
    END IF;

    SELECT id INTO v_class
    FROM classes
    WHERE school_id = v_school AND name = c_class;
    IF v_class IS NULL THEN
        RAISE EXCEPTION 'Class "%" not found. Nothing was changed.', c_class;
    END IF;

    -- =====================================================================
    -- 2. Ms. Bethelhem Girma's account — find it, or create it
    -- =====================================================================
    SELECT count(*), (array_agg(id))[1], (array_agg(role))[1]
    INTO v_n, v_new, v_new_role
    FROM users
    WHERE school_id = v_school AND lower(btrim(name)) = lower(c_teacher);

    IF v_n > 1 THEN
        RAISE EXCEPTION 'There are % staff accounts named "%". Rename or remove the duplicate on the Staff page, then run this file again. Nothing was changed.',
            v_n, c_teacher;
    END IF;

    IF v_new IS NULL THEN
        -- An account may already exist under the school's email convention.
        SELECT id, name, role INTO v_new, v_email_name, v_new_role
        FROM users
        WHERE lower(email) = lower(c_email);

        IF v_new IS NOT NULL AND lower(btrim(v_email_name)) <> lower(c_teacher) THEN
            RAISE EXCEPTION 'The address % already belongs to "%", not "%". Fix the address on the Staff page, then run this file again. Nothing was changed.',
                c_email, v_email_name, c_teacher;
        END IF;
    END IF;

    IF v_new IS NULL THEN
        INSERT INTO users (school_id, name, email, password_hash, role, is_active)
        VALUES (v_school, c_teacher, c_email, c_basic_hash, 'main_teacher', TRUE)
        RETURNING id, role INTO v_new, v_new_role;

        RAISE NOTICE 'Created the staff account "%" <%>, role main_teacher, first password "year 4 magenta" — she can change it under Settings.', c_teacher, c_email;
    ELSE
        IF v_new_role NOT IN ('main_teacher', 'admin') THEN
            IF v_new_role IN ('subject_teacher', 'assistant_teacher') THEN
                UPDATE users SET role = 'main_teacher' WHERE id = v_new;
                RAISE NOTICE 'Promoted "%" from % to main_teacher.', c_teacher, v_new_role;
                v_new_role := 'main_teacher';
            ELSE
                RAISE EXCEPTION '"%" has the role %, which cannot take a class. Change the role on the Staff page, then run this file again. Nothing was changed.',
                    c_teacher, v_new_role;
            END IF;
        END IF;

        IF NOT (SELECT is_active FROM users WHERE id = v_new) THEN
            UPDATE users SET is_active = TRUE WHERE id = v_new;
            RAISE NOTICE 'Re-activated the staff account "%".', c_teacher;
        END IF;

        IF (SELECT password_hash FROM users WHERE id = v_new) = c_legacy_hash THEN
            UPDATE users SET password_hash = c_basic_hash WHERE id = v_new;
            RAISE NOTICE 'Updated "%" from legacy placeholder password to class card password ("year 4 magenta").', c_teacher;
        END IF;

        RAISE NOTICE 'Using the existing staff account for "%".', c_teacher;
    END IF;

    -- She can only lead one homeroom.
    SELECT string_agg(c.name, ', ' ORDER BY c.name) INTO v_list
    FROM class_staff cs
    JOIN classes c ON c.id = cs.class_id
    WHERE cs.user_id = v_new
      AND cs.academic_year_id = v_year
      AND cs.position = 'main'
      AND cs.class_id <> v_class;

    IF v_list IS NOT NULL THEN
        RAISE EXCEPTION '"%" is already the main teacher of % this year. Remove her there first (Staff Assignment page), then run this file again. Nothing was changed.',
            c_teacher, v_list;
    END IF;

    -- =====================================================================
    -- 3. The outgoing main teacher
    -- =====================================================================
    SELECT count(*), (array_agg(cs.user_id))[1]
    INTO v_mains, v_old
    FROM class_staff cs
    WHERE cs.class_id = v_class
      AND cs.academic_year_id = v_year
      AND cs.position = 'main';

    IF v_mains > 1 THEN
        RAISE EXCEPTION '"%" has % main teachers on record. Fix that on the Staff Assignment page, then run this file again. Nothing was changed.',
            c_class, v_mains;
    END IF;

    IF v_mains = 1 AND v_old = v_new THEN
        -- Already done (a re-run). Pick up any class-teacher seat that is
        -- still unassigned and make sure nothing else is left half-finished.
        UPDATE class_subjects cs
        SET teacher_id = v_new
        FROM subjects s
        WHERE s.id = cs.subject_id
          AND s.taught_by = 'main_teacher'
          AND cs.class_id = v_class
          AND cs.academic_year_id = v_year
          AND cs.teacher_id IS NULL;

        GET DIAGNOSTICS v_seats = ROW_COUNT;
        RAISE NOTICE '"%" is already the main teacher of "%". Unassigned class-teacher seats taken over: %. Nothing else to change.',
            c_teacher, c_class, v_seats;
        v_old := NULL;
    ELSIF v_mains = 1 THEN
        SELECT name INTO v_old_name FROM users WHERE id = v_old;
        IF NOT (SELECT is_active FROM users WHERE id = v_old) THEN
            RAISE NOTICE 'The outgoing main teacher "%" is deactivated; she is losing only the homeroom.', v_old_name;
        END IF;
    END IF;

    -- =====================================================================
    -- 4. Would the lessons clash? Check before writing anything.
    -- =====================================================================
    IF v_old IS NOT NULL THEN
        SELECT count(*) INTO v_clashes
        FROM class_subjects cs
        JOIN subjects s ON s.id = cs.subject_id AND s.taught_by = 'main_teacher'
        JOIN timetable_slots moving ON moving.class_subject_id = cs.id
        JOIN timetable_slots hers
             ON hers.teacher_id = v_new
            AND hers.academic_year_id = v_year
            AND hers.day_of_week = moving.day_of_week
            AND timerange(hers.starts_at, hers.ends_at, '[)')
                && timerange(moving.starts_at, moving.ends_at, '[)')
        WHERE cs.class_id = v_class
          AND cs.academic_year_id = v_year
          AND cs.teacher_id = v_old;

        IF v_clashes > 0 THEN
            RAISE EXCEPTION '"%" already teaches % lesson(s) at times "%" needs her. Move those lessons first (Timetable page), then run this file again. Nothing was changed.',
                c_teacher, v_clashes, c_class;
        END IF;
    END IF;

    -- =====================================================================
    -- 5. Swap the homeroom
    -- =====================================================================
    IF v_old IS NOT NULL THEN
        -- A duplicate assistant seat for the incoming teacher would collide
        -- with the UNIQUE (class, user, year) on class_staff.
        SELECT id INTO v_assistant
        FROM class_staff
        WHERE class_id = v_class AND academic_year_id = v_year
          AND user_id = v_new AND position = 'assistant';

        IF v_assistant IS NOT NULL THEN
            DELETE FROM class_staff WHERE id = v_assistant;
            RAISE NOTICE 'Removed her assistant-teacher seat on "%" (she is now the main teacher).', c_class;
        END IF;

        UPDATE class_staff
        SET user_id = v_new
        WHERE class_id = v_class
          AND academic_year_id = v_year
          AND user_id = v_old
          AND position = 'main';

        RAISE NOTICE 'Main teacher of "%": "%" -> "%".', c_class, v_old_name, c_teacher;

        -- =================================================================
        -- 6. Hand over the class-teacher subject seats
        --    (the trigger on class_subjects moves the timetable slots too)
        -- =================================================================
        UPDATE class_subjects cs
        SET teacher_id = v_new
        FROM subjects s
        WHERE s.id = cs.subject_id
          AND s.taught_by = 'main_teacher'
          AND cs.class_id = v_class
          AND cs.academic_year_id = v_year
          AND cs.teacher_id = v_old;

        GET DIAGNOSTICS v_seats = ROW_COUNT;
        RAISE NOTICE 'Class-teacher subject seats handed to "%": %', c_teacher, v_seats;

        SELECT count(*) INTO v_slots
        FROM class_subjects cs
        JOIN timetable_slots t ON t.class_subject_id = cs.id
        JOIN subjects s ON s.id = cs.subject_id AND s.taught_by = 'main_teacher'
        WHERE cs.class_id = v_class AND cs.academic_year_id = v_year AND cs.teacher_id = v_new;

        RAISE NOTICE 'Lessons on her timetable for "%": %', c_class, v_slots;
    ELSIF v_mains = 0 THEN
        -- No main teacher on record: seat her from scratch.
        INSERT INTO class_staff (school_id, academic_year_id, class_id, user_id, position)
        VALUES (v_school, v_year, v_class, v_new, 'main');

        UPDATE class_subjects cs
        SET teacher_id = v_new
        FROM subjects s
        WHERE s.id = cs.subject_id
          AND s.taught_by = 'main_teacher'
          AND cs.class_id = v_class
          AND cs.academic_year_id = v_year
          AND cs.teacher_id IS NULL;

        GET DIAGNOSTICS v_seats = ROW_COUNT;
        RAISE NOTICE '"%" had no main teacher; "%" is now the main teacher (% unassigned seat(s) handed over).',
            c_class, c_teacher, v_seats;
    END IF;

    RAISE NOTICE 'Done: "%" is taught by "%".', c_class, c_teacher;
END $migration$;


-- ── verification: Magenta's main teacher, seats and lessons ────────────────
SELECT c.name                                    AS class,
       u.name                                    AS main_teacher,
       s.code                                    AS subject,
       cs.sessions_per_week                      AS per_week,
       count(t.id)                               AS lessons_placed
FROM classes c
LEFT JOIN class_staff cs0
       ON cs0.class_id = c.id AND cs0.position = 'main'
LEFT JOIN users u ON u.id = cs0.user_id
LEFT JOIN class_subjects cs ON cs.class_id = c.id
LEFT JOIN subjects s ON s.id = cs.subject_id
LEFT JOIN timetable_slots t ON t.class_subject_id = cs.id
WHERE c.name = 'Year 4 - Magenta'
GROUP BY c.name, u.name, s.code, cs.sessions_per_week
ORDER BY s.code;
