-- =============================================================================
-- 033_french_teacher_2_michael.sql
--
-- French, Teacher 2 -> Mr. Michael
--   before: French Teacher 2 (french.teacher.2@bisnocgerji.local)
--   after:  Mr. Michael      (mr.michael@bisnoc.local)
--
-- Distinct from Michael Okwara Okwara ("Mr. Mike", English & Spelling).
--
-- Renames the French Teacher 2 subject-teacher account in place (or hands over
-- its seats if a separate "Mr. Michael" account was already created manually)
-- so all 7 French class assignments (Year 3 Blue & Yellow; Year 4 Yellow,
-- Magenta, Red, Violet & Orange) and all 14 weekly French periods immediately
-- display Mr. Michael across /subject-login, /teachers, /tma, @bisnocbot, and
-- Admin Staff / Timetable views.
--
-- Safe to re-run (idempotent). Also applied automatically at runtime via
-- backend/services/frenchTeacher2Michael.js.
-- =============================================================================

DO $migration$
DECLARE
    c_basic_hash  CONSTANT TEXT := '$2a$12$jVvHpVG5qszwKEk8k0suCea/J50mLYP071GLFkw9/NmQwOl.9ppQe';
    c_old_email   CONSTANT TEXT := 'french.teacher.2@bisnocgerji.local';
    c_target_name CONSTANT TEXT := 'Mr. Michael';
    c_target_mail CONSTANT TEXT := 'mr.michael@bisnoc.local';

    v_school      UUID;
    v_placeholder UUID;
    v_existing    UUID;
    v_mail_taken  BOOLEAN;
BEGIN
    SELECT id INTO v_school FROM schools LIMIT 1;
    IF v_school IS NULL THEN
        RAISE NOTICE 'No school found — skipping.';
        RETURN;
    END IF;

    SELECT id INTO v_placeholder
    FROM users
    WHERE school_id = v_school
      AND (lower(email) = c_old_email OR name ~* '^french\s+teacher(\s+2|\s*\(tbc\))?$')
    ORDER BY (lower(email) = c_old_email) DESC
    LIMIT 1;

    IF v_placeholder IS NULL THEN
        RAISE NOTICE 'French Teacher 2 already staffed as % — nothing to change.', c_target_name;
        RETURN;
    END IF;

    SELECT id INTO v_existing
    FROM users
    WHERE school_id = v_school
      AND id <> v_placeholder
      AND (name ~* '^mr\.?\s+michael$' OR lower(email) = c_target_mail)
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
        UPDATE users
           SET is_active = TRUE,
               role = 'subject_teacher',
               password_hash = COALESCE(password_hash, c_basic_hash)
         WHERE id = v_existing;

        UPDATE class_subjects
           SET teacher_id = v_existing
         WHERE teacher_id = v_placeholder;

        UPDATE users
           SET is_active = FALSE
         WHERE id = v_placeholder;

        RAISE NOTICE 'Moved French Teacher 2 seats to existing % account and deactivated placeholder.', c_target_name;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM users WHERE id <> v_placeholder AND lower(email) = c_target_mail
        ) INTO v_mail_taken;

        UPDATE users
           SET name = c_target_name,
               email = CASE WHEN NOT v_mail_taken AND lower(email) = c_old_email THEN c_target_mail ELSE email END,
               role = 'subject_teacher',
               is_active = TRUE,
               password_hash = COALESCE(password_hash, c_basic_hash)
         WHERE id = v_placeholder;

        RAISE NOTICE 'Renamed French Teacher 2 in place to %.', c_target_name;
    END IF;
END $migration$;
