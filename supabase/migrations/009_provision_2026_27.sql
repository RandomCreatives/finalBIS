-- ============================================================================
-- 009_provision_2026_27.sql
-- BIS NOC Gerji — 2026/27 academic year provisioning
--
-- Run in the Supabase SQL Editor. IDEMPOTENT: safe to run more than once —
-- every insert is guarded, existing rows are never overwritten.
--
-- Provisions, per the approved academic calendar:
--   * Academic year 2026/2027 (marked current)
--   * Term 1: 2026-09-21 → 2026-12-21 (marked current)
--   * Term 2: 2027-01-11 → 2027-04-30
--   * Term 3: 2027-05-06 → 2027-07-12
--   * The standard 8 subjects (if missing)
--   * 14 classes: 4 × Year 3, 10 × Year 4 — capacity 30 each
--   * Main-teacher seats for the 12 assigned homerooms
--     (Year 3 - Red and Year 4 - Green await assignments)
--   * Mathematics + Science teaching assignments for every class that has
--     a main teacher (main teachers deliver STEM per school policy)
-- ============================================================================

DO $$
DECLARE
    v_school_id uuid;
    v_year_id   uuid;
    n_rows      integer;
BEGIN
    -- ── school ────────────────────────────────────────────────────────────
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'No school found. Run the backend seed script first.';
    END IF;

    -- ── academic year 2026/2027 ───────────────────────────────────────────
    INSERT INTO academic_years (school_id, name, starts_on, ends_on, is_current)
    SELECT v_school_id, '2026/2027', DATE '2026-09-21', DATE '2027-07-12', FALSE
    WHERE NOT EXISTS (
        SELECT 1 FROM academic_years
        WHERE school_id = v_school_id AND name = '2026/2027'
    );

    SELECT id INTO v_year_id
    FROM academic_years
    WHERE school_id = v_school_id AND name = '2026/2027';

    UPDATE academic_years
    SET is_current = FALSE
    WHERE school_id = v_school_id AND id <> v_year_id AND is_current;

    UPDATE academic_years SET is_current = TRUE WHERE id = v_year_id;

    -- ── terms (approved calendar dates) ───────────────────────────────────
    INSERT INTO terms (school_id, academic_year_id, term_index, name, starts_on, ends_on)
    SELECT v_school_id, v_year_id, 1, 'Term 1', DATE '2026-09-21', DATE '2026-12-21'
    WHERE NOT EXISTS (
        SELECT 1 FROM terms WHERE academic_year_id = v_year_id AND term_index = 1
    );

    INSERT INTO terms (school_id, academic_year_id, term_index, name, starts_on, ends_on)
    SELECT v_school_id, v_year_id, 2, 'Term 2', DATE '2027-01-11', DATE '2027-04-30'
    WHERE NOT EXISTS (
        SELECT 1 FROM terms WHERE academic_year_id = v_year_id AND term_index = 2
    );

    INSERT INTO terms (school_id, academic_year_id, term_index, name, starts_on, ends_on)
    SELECT v_school_id, v_year_id, 3, 'Term 3', DATE '2027-05-06', DATE '2027-07-12'
    WHERE NOT EXISTS (
        SELECT 1 FROM terms WHERE academic_year_id = v_year_id AND term_index = 3
    );

    -- Term 1 is current (school year starts 21 Sep 2026).
    UPDATE terms SET is_current = FALSE WHERE school_id = v_school_id AND is_current;
    UPDATE terms SET is_current = TRUE
    WHERE academic_year_id = v_year_id AND term_index = 1;

    -- ── standard subjects ─────────────────────────────────────────────────
    INSERT INTO subjects (school_id, name, code, taught_by, is_semester)
    VALUES
        (v_school_id, 'English',            'ENG', 'subject_teacher', FALSE),
        (v_school_id, 'Amharic',            'AMH', 'subject_teacher', FALSE),
        (v_school_id, 'Music',              'MUS', 'subject_teacher', FALSE),
        (v_school_id, 'Arts',               'ART', 'subject_teacher', FALSE),
        (v_school_id, 'Physical Education', 'PE',  'subject_teacher', FALSE),
        (v_school_id, 'French',             'FRA', 'subject_teacher', FALSE),
        (v_school_id, 'Mathematics',        'MAT', 'main_teacher',    FALSE),
        (v_school_id, 'Science',            'SCI', 'main_teacher',    FALSE)
    ON CONFLICT (school_id, code) DO NOTHING;

    -- ── the 14 classes (approved 2026/27 roster) ──────────────────────────
    INSERT INTO classes (school_id, name, year_level, capacity)
    SELECT v_school_id, c.name, c.year_level, 30
    FROM (VALUES
        ('Year 3 - Blue',    3),
        ('Year 3 - Yellow',  3),
        ('Year 3 - Red',     3),
        ('Year 3 - Green',   3),
        ('Year 4 - Blue',    4),
        ('Year 4 - Purple',  4),
        ('Year 4 - Lavender',4),
        ('Year 4 - Crimson', 4),
        ('Year 4 - Green',   4),
        ('Year 4 - Yellow',  4),
        ('Year 4 - Magenta', 4),
        ('Year 4 - Red',     4),
        ('Year 4 - Violet',  4),
        ('Year 4 - Orange',  4)
    ) AS c(name, year_level)
    WHERE NOT EXISTS (
        SELECT 1 FROM classes cl
        WHERE cl.school_id = v_school_id AND cl.name = c.name
    );

    -- ── main-teacher seats (approved mapping, exact-name match) ───────────
    -- Year 3 - Red and Year 4 - Green are intentionally unassigned for now.
    INSERT INTO class_staff (school_id, academic_year_id, class_id, user_id, position)
    SELECT v_school_id, v_year_id, cl.id, u.id, 'main'
    FROM (VALUES
        ('Year 3 - Blue',     'Yeabsira Amdie Kidanewold'),
        ('Year 3 - Yellow',   'Meron Abebe Tarekegn'),
        ('Year 3 - Green',    'Degnet Engida Addis'),
        ('Year 4 - Blue',     'Mulugeta Jemberu Dargie'),
        ('Year 4 - Purple',   'Mekdelawit Abate Nebebe'),
        ('Year 4 - Lavender', 'Selam Goyte Abza'),
        ('Year 4 - Crimson',  'Simegn Yilma Akalu'),
        ('Year 4 - Yellow',   'Mariamawit Belay Nadew'),
        ('Year 4 - Magenta',  'Abigia Alemayehu Dogamo'),
        ('Year 4 - Red',      'Denebe Abu Shuniye'),
        ('Year 4 - Violet',   'Abigiya Tadele Biru'),
        ('Year 4 - Orange',   'Mekdelawit Nigusu Alemu')
    ) AS m(class_name, teacher_name)
    JOIN classes cl
        ON cl.school_id = v_school_id AND cl.name = m.class_name
    JOIN users u
        ON u.school_id = v_school_id AND u.name = m.teacher_name
    WHERE NOT EXISTS (
        SELECT 1 FROM class_staff cs
        WHERE cs.academic_year_id = v_year_id
          AND cs.class_id = cl.id
          AND cs.position = 'main'
    );

    GET DIAGNOSTICS n_rows = ROW_COUNT;
    RAISE NOTICE 'Main-teacher seats assigned this run: %', n_rows;

    -- Warn loudly if an approved name did not match any user row.
    PERFORM 1
    FROM (VALUES
        ('Year 3 - Blue',     'Yeabsira Amdie Kidanewold'),
        ('Year 3 - Yellow',   'Meron Abebe Tarekegn'),
        ('Year 3 - Green',    'Degnet Engida Addis'),
        ('Year 4 - Blue',     'Mulugeta Jemberu Dargie'),
        ('Year 4 - Purple',   'Mekdelawit Abate Nebebe'),
        ('Year 4 - Lavender', 'Selam Goyte Abza'),
        ('Year 4 - Crimson',  'Simegn Yilma Akalu'),
        ('Year 4 - Yellow',   'Mariamawit Belay Nadew'),
        ('Year 4 - Magenta',  'Abigia Alemayehu Dogamo'),
        ('Year 4 - Red',      'Denebe Abu Shuniye'),
        ('Year 4 - Violet',   'Abigiya Tadele Biru'),
        ('Year 4 - Orange',   'Mekdelawit Nigusu Alemu')
    ) AS m(class_name, teacher_name)
    WHERE NOT EXISTS (
        SELECT 1 FROM users u
        WHERE u.school_id = v_school_id AND u.name = m.teacher_name
    );
    IF FOUND THEN
        RAISE WARNING 'At least one approved teacher name did not match a user row — check the NOTICE list.';
    END IF;

    -- ── Maths & Science for every staffed class ───────────────────────────
    INSERT INTO class_subjects
        (school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week)
    SELECT v_school_id, v_year_id, cs.class_id, s.id, cs.user_id,
           CASE WHEN s.code = 'MAT' THEN 6 ELSE 5 END
    FROM class_staff cs
    JOIN subjects s
        ON s.school_id = v_school_id AND s.code IN ('MAT', 'SCI')
    WHERE cs.academic_year_id = v_year_id
      AND cs.position = 'main'
      AND NOT EXISTS (
          SELECT 1 FROM class_subjects x
          WHERE x.academic_year_id = v_year_id
            AND x.class_id = cs.class_id
            AND x.subject_id = s.id
      );

    GET DIAGNOSTICS n_rows = ROW_COUNT;
    RAISE NOTICE 'Maths/Science assignments added this run: %', n_rows;

    -- ── optional cleanup: deactivate leftover test accounts ───────────────
    -- These rows came from development/testing and pollute the public
    -- directory. Reversible: UPDATE users SET is_active = TRUE WHERE ...
    UPDATE users
    SET is_active = FALSE
    WHERE school_id = v_school_id
      AND name IN (
          'Amharic Teacher', 'Arts Teacher', 'Clinic Nurse', 'English Teacher',
          'French Teacher', 'Main Teacher', 'Music Teacher', 'PE Teacher',
          'Teacher Test', 'Test Teacher'
      )
      AND is_active = TRUE;

    GET DIAGNOSTICS n_rows = ROW_COUNT;
    RAISE NOTICE 'Test accounts deactivated: %', n_rows;

    RAISE NOTICE 'Provisioning complete for school %.', v_school_id;
END $$;

-- ── verification summary ─────────────────────────────────────────────────
SELECT 'academic years' AS what, count(*) FROM academic_years
UNION ALL
SELECT 'terms', count(*) FROM terms
UNION ALL
SELECT 'classes', count(*) FROM classes
UNION ALL
SELECT 'main-teacher seats (this year)', count(*) FROM class_staff WHERE position = 'main'
UNION ALL
SELECT 'teaching assignments (this year)', count(*) FROM class_subjects
UNION ALL
SELECT 'active staff', count(*) FROM users WHERE is_active = TRUE;
