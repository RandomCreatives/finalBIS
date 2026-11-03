-- READ-ONLY audit for the Year 4 - Magenta subject/marks visibility issue.
-- Run in Supabase SQL Editor only when you have the right production access.
-- This file contains SELECT statements only: it does not change accounts,
-- assignments, marksheets, assessments, or marks.
--
-- Review the returned academic year and term IDs against the teacher's page
-- selections before deciding that any mark or assignment is missing. In
-- particular, Global Citizenship may be coded GLS or legacy GCT.

-- 1) Current academic year and the main-teacher account currently seated.
SELECT
    c.school_id,
    c.id AS class_id,
    c.name AS class_name,
    ay.id AS current_academic_year_id,
    ay.name AS current_academic_year,
    cs.id AS main_teacher_seat_id,
    u.id AS main_teacher_user_id,
    u.name AS main_teacher_name,
    u.email AS main_teacher_email,
    u.role AS main_teacher_role,
    u.is_active AS main_teacher_active
FROM classes c
LEFT JOIN academic_years ay
       ON ay.school_id = c.school_id AND ay.is_current = TRUE
LEFT JOIN class_staff cs
       ON cs.school_id = c.school_id
      AND cs.class_id = c.id
      AND cs.academic_year_id = ay.id
      AND cs.position = 'main'
LEFT JOIN users u
       ON u.id = cs.user_id AND u.school_id = c.school_id
WHERE c.name = 'Year 4 - Magenta'
ORDER BY c.school_id, cs.id;

-- 2) Current-year subject seats, including unassigned seats and the main
-- teacher for comparison. Zero rows for a subject means there is no seat.
SELECT
    c.school_id,
    c.id AS class_id,
    c.name AS class_name,
    ay.id AS academic_year_id,
    ay.name AS academic_year,
    main_user.id AS seated_main_teacher_id,
    main_user.name AS seated_main_teacher,
    cs.id AS class_subject_id,
    s.id AS subject_id,
    s.code AS subject_code,
    s.name AS subject_name,
    s.taught_by,
    cs.sessions_per_week,
    assigned.id AS assigned_teacher_id,
    assigned.name AS assigned_teacher_name,
    assigned.email AS assigned_teacher_email,
    assigned.role AS assigned_teacher_role
FROM classes c
LEFT JOIN academic_years ay
       ON ay.school_id = c.school_id AND ay.is_current = TRUE
LEFT JOIN class_staff main_seat
       ON main_seat.school_id = c.school_id
      AND main_seat.class_id = c.id
      AND main_seat.academic_year_id = ay.id
      AND main_seat.position = 'main'
LEFT JOIN users main_user
       ON main_user.id = main_seat.user_id AND main_user.school_id = c.school_id
LEFT JOIN class_subjects cs
       ON cs.school_id = c.school_id
      AND cs.class_id = c.id
      AND cs.academic_year_id = ay.id
LEFT JOIN subjects s
       ON s.id = cs.subject_id AND s.school_id = c.school_id
LEFT JOIN users assigned
       ON assigned.id = cs.teacher_id AND assigned.school_id = c.school_id
WHERE c.name = 'Year 4 - Magenta'
ORDER BY c.school_id, s.code NULLS FIRST, cs.id;

-- 3) Available terms across all academic years for this class's school.
-- Compare the selected term ID in Marksheets with the term containing records.
SELECT
    c.school_id,
    ay.id AS academic_year_id,
    ay.name AS academic_year,
    t.id AS term_id,
    t.term_index,
    t.name AS term_name,
    t.is_current,
    t.starts_on,
    t.ends_on
FROM classes c
JOIN academic_years ay ON ay.school_id = c.school_id
JOIN terms t ON t.school_id = c.school_id AND t.academic_year_id = ay.id
WHERE c.name = 'Year 4 - Magenta'
ORDER BY c.school_id, ay.starts_on DESC, t.term_index;

-- 4) Final marksheet records stored against Magenta, grouped by year, term,
-- subject and the account that last entered each row. Counts expose whether
-- records exist without dumping individual pupils' marks.
SELECT
    c.school_id,
    c.id AS class_id,
    ay.name AS academic_year,
    t.id AS term_id,
    t.name AS term_name,
    t.term_index,
    t.is_current AS term_is_current,
    s.id AS subject_id,
    s.code AS subject_code,
    s.name AS subject_name,
    m.entered_by AS entered_by_user_id,
    COALESCE(entered_by.name, '(unknown or deleted account)') AS entered_by_name,
    COUNT(m.id) AS saved_result_rows,
    COUNT(DISTINCT m.student_id) AS pupils_with_results,
    MAX(m.updated_at) AS last_updated_at
FROM classes c
JOIN marksheets m
  ON m.school_id = c.school_id AND m.class_id = c.id
LEFT JOIN terms t
  ON t.id = m.term_id AND t.school_id = c.school_id
LEFT JOIN academic_years ay
  ON ay.id = t.academic_year_id AND ay.school_id = c.school_id
LEFT JOIN subjects s
  ON s.id = m.subject_id AND s.school_id = c.school_id
LEFT JOIN users entered_by
  ON entered_by.id = m.entered_by AND entered_by.school_id = c.school_id
WHERE c.name = 'Year 4 - Magenta'
GROUP BY c.school_id, c.id, ay.name, t.id, t.name, t.term_index,
         t.is_current, s.id, s.code, s.name, m.entered_by, entered_by.name
ORDER BY c.school_id, ay.name, t.term_index, s.code, entered_by.name;

-- 5) Possible legacy rows that have no class_id but belong to pupils who are
-- enrolled in Magenta now. These are NOT automatically Magenta's historical
-- marks; verify their history before any remediation. The application class
-- marksheet filter does not include class_id IS NULL rows.
SELECT
    c.school_id,
    c.id AS current_class_id,
    c.name AS current_class_name,
    ay.name AS term_academic_year,
    t.id AS term_id,
    t.name AS term_name,
    s.code AS subject_code,
    s.name AS subject_name,
    COUNT(m.id) AS unlinked_result_rows,
    COUNT(DISTINCT m.student_id) AS currently_enrolled_pupils,
    MAX(m.updated_at) AS last_updated_at
FROM classes c
JOIN students st
  ON st.school_id = c.school_id AND st.class_id = c.id
JOIN marksheets m
  ON m.school_id = c.school_id
 AND m.student_id = st.id
 AND m.class_id IS NULL
LEFT JOIN terms t
  ON t.id = m.term_id AND t.school_id = c.school_id
LEFT JOIN academic_years ay
  ON ay.id = t.academic_year_id AND ay.school_id = c.school_id
LEFT JOIN subjects s
  ON s.id = m.subject_id AND s.school_id = c.school_id
WHERE c.name = 'Year 4 - Magenta'
GROUP BY c.school_id, c.id, c.name, ay.name, t.id, t.name, s.code, s.name
ORDER BY c.school_id, ay.name, t.name, s.code;

-- 6) Continuous-assessment marks, if marks were entered in the Class Home
-- assessment grid rather than directly in the Marksheets page.
SELECT
    c.school_id,
    ay.name AS academic_year,
    t.id AS term_id,
    t.name AS term_name,
    s.code AS subject_code,
    s.name AS subject_name,
    a.id AS assessment_id,
    a.label AS assessment_name,
    COALESCE(entered_by.name, '(unknown or deleted account)') AS entered_by_name,
    COUNT(am.id) AS saved_assessment_marks,
    COUNT(DISTINCT am.student_id) AS pupils_with_marks,
    MAX(am.updated_at) AS last_updated_at
FROM classes c
JOIN assessments a
  ON a.school_id = c.school_id AND a.class_id = c.id
LEFT JOIN terms t
  ON t.id = a.term_id AND t.school_id = c.school_id
LEFT JOIN academic_years ay
  ON ay.id = COALESCE(a.academic_year_id, t.academic_year_id)
 AND ay.school_id = c.school_id
LEFT JOIN subjects s
  ON s.id = a.subject_id AND s.school_id = c.school_id
LEFT JOIN assessment_marks am
  ON am.school_id = c.school_id AND am.assessment_id = a.id
LEFT JOIN users entered_by
  ON entered_by.id = am.entered_by AND entered_by.school_id = c.school_id
WHERE c.name = 'Year 4 - Magenta'
GROUP BY c.school_id, ay.name, t.id, t.name, s.code, s.name,
         a.id, a.label, entered_by.name
ORDER BY c.school_id, ay.name, t.name, s.code, a.sort_order, a.label, entered_by.name;
