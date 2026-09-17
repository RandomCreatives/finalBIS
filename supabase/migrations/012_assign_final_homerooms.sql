-- ============================================================================
-- 012_assign_final_homerooms.sql
-- Assigns the last two main teachers of 2026/27:
--   Year 3 - Red  -> Ms. Kalkidan Zewdu   (new staff account)
--   Year 4 - Green -> Ms. Samrawit Eshetu (new staff account)
--
-- Neither teacher existed in the users table yet, so this migration creates
-- their accounts (role: main_teacher) with placeholder emails and a shared
-- TEMPORARY password — both should be changed at first sign-in (or reset
-- from the Staff page).
--
-- Run in the Supabase SQL Editor. Idempotent: safe to re-run.
-- ============================================================================

DO $$
DECLARE
    v_school_id uuid;
    v_year_id   uuid;
    v_hash      text := '$2a$12$jVvHpVG5qszwKEk8k0suCea/J50mLYP071GLFkw9/NmQwOl.9ppQe';
BEGIN
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'No school found.';
    END IF;

    SELECT id INTO v_year_id FROM academic_years
    WHERE school_id = v_school_id AND name = '2026/2027';
    IF v_year_id IS NULL THEN
        RAISE EXCEPTION 'Academic year 2026/2027 not found — run 009 first.';
    END IF;

    -- ── create the two staff accounts (placeholder emails) ────────────────
    INSERT INTO users (school_id, name, email, password_hash, role, is_active)
    SELECT v_school_id, 'Kalkidan Zewdu', 'kalkidan.zewdu@bisnoc.local', v_hash, 'main_teacher', TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM users WHERE email IN ('kalkidan.zewdu@bisnoc.local')
    );

    INSERT INTO users (school_id, name, email, password_hash, role, is_active)
    SELECT v_school_id, 'Samrawit Eshetu', 'samrawit.eshetu@bisnoc.local', v_hash, 'main_teacher', TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM users WHERE email IN ('samrawit.eshetu@bisnoc.local')
    );

    -- ── main-teacher seats ─────────────────────────────────────────────────
    INSERT INTO class_staff (school_id, academic_year_id, class_id, user_id, position)
    SELECT v_school_id, v_year_id, cl.id, u.id, 'main'
    FROM (VALUES
        ('Year 3 - Red',   'Kalkidan Zewdu'),
        ('Year 4 - Green', 'Samrawit Eshetu')
    ) AS m(class_name, teacher_name)
    JOIN classes cl ON cl.school_id = v_school_id AND cl.name = m.class_name
    JOIN users u   ON u.school_id = v_school_id AND u.name = m.teacher_name
    WHERE NOT EXISTS (
        SELECT 1 FROM class_staff cs
        WHERE cs.academic_year_id = v_year_id
          AND cs.class_id = cl.id
          AND cs.position = 'main'
    );

    -- ── Maths & Science for the two newly staffed classes ─────────────────
    INSERT INTO class_subjects
        (school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week)
    SELECT v_school_id, v_year_id, cs.class_id, s.id, cs.user_id,
           CASE WHEN s.code = 'MAT' THEN 6 ELSE 5 END
    FROM class_staff cs
    JOIN subjects s ON s.school_id = v_school_id AND s.code IN ('MAT', 'SCI')
    WHERE cs.academic_year_id = v_year_id
      AND cs.position = 'main'
      AND cs.class_id IN (
          SELECT id FROM classes
          WHERE school_id = v_school_id AND name IN ('Year 3 - Red', 'Year 4 - Green')
      )
      AND NOT EXISTS (
          SELECT 1 FROM class_subjects x
          WHERE x.academic_year_id = v_year_id
            AND x.class_id = cs.class_id
            AND x.subject_id = s.id
      );

    RAISE NOTICE 'Final homerooms assigned.';
END $$;

-- ── verification: every class and its main teacher ────────────────────────
SELECT c.name AS class, u.name AS main_teacher
FROM classes c
LEFT JOIN class_staff cs
       ON cs.class_id = c.id AND cs.position = 'main'
LEFT JOIN users u ON u.id = cs.user_id
ORDER BY c.year_level, c.name;
