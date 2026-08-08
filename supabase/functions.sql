-- =============================================================================
-- Database functions
-- Apply after schema.sql. Idempotent (CREATE OR REPLACE).
--
-- Each function body is a single transaction: if any statement raises, the
-- whole thing rolls back. This is how multi-step operations stay consistent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- transfer_student
-- Moves a student and writes the audit row atomically.
-- Historical attendance/marks keep their original class: they are facts about
-- where the student was at the time.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION transfer_student(
    p_student_id  UUID,
    p_to_class_id UUID,
    p_reason      TEXT,
    p_actor_id    UUID,
    p_school_id   UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from_class_id UUID;
    v_result        JSON;
BEGIN
    SELECT class_id INTO v_from_class_id
    FROM students
    WHERE id = p_student_id AND school_id = p_school_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_to_class_id AND school_id = p_school_id) THEN
        RAISE EXCEPTION 'CLASS_NOT_FOUND';
    END IF;

    IF v_from_class_id IS NOT DISTINCT FROM p_to_class_id THEN
        RAISE EXCEPTION 'SAME_CLASS';
    END IF;

    UPDATE students SET class_id = p_to_class_id WHERE id = p_student_id;

    INSERT INTO student_transfers (student_id, from_class_id, to_class_id, reason, transferred_by)
    VALUES (p_student_id, v_from_class_id, p_to_class_id, p_reason, p_actor_id);

    SELECT json_build_object(
        'id', s.id, 'admission_no', s.admission_no, 'name', s.name,
        'roll_num', s.roll_num, 'class_id', s.class_id, 'is_active', s.is_active,
        'special_needs', s.special_needs,
        'class', CASE WHEN c.id IS NULL THEN NULL
                      ELSE json_build_object('id', c.id, 'name', c.name) END
    ) INTO v_result
    FROM students s LEFT JOIN classes c ON c.id = s.class_id
    WHERE s.id = p_student_id;

    RETURN v_result;
END;
$$;


-- ---------------------------------------------------------------------------
-- return_library_loan
-- Marks a loan returned. Borrowing is free of charge, so no fine is computed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION return_library_loan(
    p_loan_id   UUID,
    p_school_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_due_on DATE;
    v_status TEXT;
    v_days   INTEGER;
    v_result JSON;
BEGIN
    SELECT due_on, status INTO v_due_on, v_status
    FROM library_loans
    WHERE id = p_loan_id AND school_id = p_school_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'LOAN_NOT_FOUND'; END IF;
    IF v_status = 'returned' THEN RAISE EXCEPTION 'ALREADY_RETURNED'; END IF;

    v_days := GREATEST(0, CURRENT_DATE - v_due_on);

    UPDATE library_loans
    SET returned_on = CURRENT_DATE, status = 'returned'
    WHERE id = p_loan_id;

    SELECT json_build_object(
        'id', id, 'status', status, 'returned_on', returned_on,
        'days_late', v_days
    ) INTO v_result FROM library_loans WHERE id = p_loan_id;

    RETURN v_result;
END;
$$;


-- ---------------------------------------------------------------------------
-- mark_attendance
--
-- Bulk upsert for one class on one date.
--
-- This must be a function rather than a PostgREST upsert: attendance is keyed
-- by two PARTIAL unique indexes (homeroom vs subject), and ON CONFLICT can
-- only infer a partial index when the statement repeats the index predicate —
-- something PostgREST cannot express. Doing it here also makes marking a whole
-- register a single atomic operation.
--
-- p_records: JSON array of { studentId, status, note }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_attendance(
    p_school_id  UUID,
    p_class_id   UUID,
    p_subject_id UUID,
    p_date       DATE,
    p_marked_by  UUID,
    p_records    JSON
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_record JSON;
    v_count  INTEGER := 0;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM classes WHERE id = p_class_id AND school_id = p_school_id
    ) THEN
        RAISE EXCEPTION 'CLASS_NOT_FOUND';
    END IF;

    FOR v_record IN SELECT * FROM json_array_elements(p_records)
    LOOP
        IF p_subject_id IS NULL THEN
            -- Homeroom register: one row per student per day.
            INSERT INTO attendance (
                school_id, student_id, class_id, subject_id, date, status, note, marked_by
            )
            VALUES (
                p_school_id,
                (v_record ->> 'studentId')::UUID,
                p_class_id,
                NULL,
                p_date,
                v_record ->> 'status',
                NULLIF(v_record ->> 'note', ''),
                p_marked_by
            )
            ON CONFLICT (student_id, date) WHERE subject_id IS NULL
            DO UPDATE SET
                status    = EXCLUDED.status,
                note      = EXCLUDED.note,
                class_id  = EXCLUDED.class_id,
                marked_by = EXCLUDED.marked_by;
        ELSE
            -- Subject register: one row per student per day per subject.
            INSERT INTO attendance (
                school_id, student_id, class_id, subject_id, date, status, note, marked_by
            )
            VALUES (
                p_school_id,
                (v_record ->> 'studentId')::UUID,
                p_class_id,
                p_subject_id,
                p_date,
                v_record ->> 'status',
                NULLIF(v_record ->> 'note', ''),
                p_marked_by
            )
            ON CONFLICT (student_id, date, subject_id) WHERE subject_id IS NOT NULL
            DO UPDATE SET
                status    = EXCLUDED.status,
                note      = EXCLUDED.note,
                class_id  = EXCLUDED.class_id,
                marked_by = EXCLUDED.marked_by;
        END IF;

        v_count := v_count + 1;
    END LOOP;

    RETURN json_build_object('count', v_count);
END;
$$;


-- ---------------------------------------------------------------------------
-- assign_class_staff
--
-- Places a teacher as a class's main or assistant for a year. Because only
-- one person may hold each position, this atomically vacates the seat first,
-- avoiding a unique-violation race between two admins acting at once.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION assign_class_staff(
    p_class_id  UUID,
    p_user_id   UUID,
    p_position  TEXT,
    p_year_id   UUID,
    p_school_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    IF p_position NOT IN ('main', 'assistant') THEN
        RAISE EXCEPTION 'INVALID_POSITION';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id AND school_id = p_school_id) THEN
        RAISE EXCEPTION 'CLASS_NOT_FOUND';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = p_user_id AND school_id = p_school_id AND is_active
    ) THEN
        RAISE EXCEPTION 'USER_NOT_FOUND';
    END IF;

    -- Vacate the seat, then fill it.
    DELETE FROM class_staff
    WHERE class_id = p_class_id AND position = p_position AND academic_year_id = p_year_id;

    -- The same person cannot hold both seats in one class.
    DELETE FROM class_staff
    WHERE class_id = p_class_id AND user_id = p_user_id AND academic_year_id = p_year_id;

    INSERT INTO class_staff (school_id, academic_year_id, class_id, user_id, position)
    VALUES (p_school_id, p_year_id, p_class_id, p_user_id, p_position);

    SELECT json_build_object(
        'class_id', p_class_id,
        'position', p_position,
        'user', json_build_object('id', u.id, 'name', u.name, 'email', u.email, 'role', u.role)
    ) INTO v_result
    FROM users u WHERE u.id = p_user_id;

    RETURN v_result;
END;
$$;


-- ---------------------------------------------------------------------------
-- rotate_class_staff
--
-- Swaps the staff of two classes in one transaction.
--
-- Must be atomic and must free both seats before refilling them: doing it as
-- two sequential assignments would trip the one-holder-per-position unique
-- index halfway through and leave a class unstaffed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rotate_class_staff(
    p_class_a   UUID,
    p_class_b   UUID,
    p_position  TEXT,
    p_year_id   UUID,
    p_school_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_a UUID;
    v_user_b UUID;
BEGIN
    IF p_position NOT IN ('main', 'assistant') THEN
        RAISE EXCEPTION 'INVALID_POSITION';
    END IF;

    IF p_class_a = p_class_b THEN
        RAISE EXCEPTION 'SAME_CLASS';
    END IF;

    SELECT user_id INTO v_user_a FROM class_staff
    WHERE class_id = p_class_a AND position = p_position
      AND academic_year_id = p_year_id AND school_id = p_school_id
    FOR UPDATE;

    SELECT user_id INTO v_user_b FROM class_staff
    WHERE class_id = p_class_b AND position = p_position
      AND academic_year_id = p_year_id AND school_id = p_school_id
    FOR UPDATE;

    IF v_user_a IS NULL AND v_user_b IS NULL THEN
        RAISE EXCEPTION 'NOTHING_TO_ROTATE';
    END IF;

    -- Vacate both seats first.
    DELETE FROM class_staff
    WHERE class_id IN (p_class_a, p_class_b)
      AND position = p_position AND academic_year_id = p_year_id;

    -- Refill them, crossed over.
    IF v_user_b IS NOT NULL THEN
        INSERT INTO class_staff (school_id, academic_year_id, class_id, user_id, position)
        VALUES (p_school_id, p_year_id, p_class_a, v_user_b, p_position);
    END IF;

    IF v_user_a IS NOT NULL THEN
        INSERT INTO class_staff (school_id, academic_year_id, class_id, user_id, position)
        VALUES (p_school_id, p_year_id, p_class_b, v_user_a, p_position);
    END IF;

    RETURN json_build_object(
        'rotated', TRUE,
        'position', p_position,
        'class_a', json_build_object('id', p_class_a, 'now_held_by', v_user_b),
        'class_b', json_build_object('id', p_class_b, 'now_held_by', v_user_a)
    );
END;
$$;


-- ---------------------------------------------------------------------------
-- assign_students_to_class
--
-- Places many students into a class at once, honouring capacity and recording
-- an audit row for anyone who was moved from another class.
--
-- p_student_ids: JSON array of student id strings.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION assign_students_to_class(
    p_student_ids JSON,
    p_class_id    UUID,
    p_actor_id    UUID,
    p_school_id   UUID,
    p_reason      TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_capacity  INTEGER;
    v_current   INTEGER;
    v_incoming  INTEGER;
    v_moved     INTEGER := 0;
    v_placed    INTEGER := 0;
    v_student   RECORD;
BEGIN
    SELECT capacity INTO v_capacity
    FROM classes WHERE id = p_class_id AND school_id = p_school_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CLASS_NOT_FOUND';
    END IF;

    SELECT COUNT(*) INTO v_current
    FROM students
    WHERE class_id = p_class_id AND is_active;

    SELECT COUNT(*) INTO v_incoming
    FROM json_array_elements_text(p_student_ids) AS sid
    JOIN students s ON s.id = sid::UUID
    WHERE s.school_id = p_school_id
      AND s.is_active
      AND (s.class_id IS DISTINCT FROM p_class_id);

    IF v_capacity IS NOT NULL AND (v_current + v_incoming) > v_capacity THEN
        RAISE EXCEPTION 'OVER_CAPACITY: % of % places free',
            GREATEST(0, v_capacity - v_current), v_capacity;
    END IF;

    FOR v_student IN
        SELECT s.id, s.class_id
        FROM json_array_elements_text(p_student_ids) AS sid
        JOIN students s ON s.id = sid::UUID
        WHERE s.school_id = p_school_id AND s.is_active
        FOR UPDATE OF s
    LOOP
        CONTINUE WHEN v_student.class_id IS NOT DISTINCT FROM p_class_id;

        UPDATE students SET class_id = p_class_id WHERE id = v_student.id;

        -- Only a move between classes is a transfer worth recording.
        IF v_student.class_id IS NOT NULL THEN
            INSERT INTO student_transfers (
                student_id, from_class_id, to_class_id, reason, transferred_by
            )
            VALUES (
                v_student.id, v_student.class_id, p_class_id,
                COALESCE(p_reason, 'Reassigned by administrator'), p_actor_id
            );
            v_moved := v_moved + 1;
        ELSE
            v_placed := v_placed + 1;
        END IF;
    END LOOP;

    RETURN json_build_object(
        'placed', v_placed,
        'moved', v_moved,
        'total', v_placed + v_moved
    );
END;
$$;


-- ---------------------------------------------------------------------------
-- set_current_term
--
-- Exactly one term per school may be current, so standing the previous one
-- down and promoting the new one has to happen together.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_current_term(
    p_term_id   UUID,
    p_school_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year_id UUID;
    v_result  JSON;
BEGIN
    SELECT academic_year_id INTO v_year_id
    FROM terms WHERE id = p_term_id AND school_id = p_school_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TERM_NOT_FOUND';
    END IF;

    UPDATE terms SET is_current = FALSE
    WHERE school_id = p_school_id AND is_current;

    UPDATE terms SET is_current = TRUE WHERE id = p_term_id;

    -- Making a term current implies its year is the working year too.
    UPDATE academic_years SET is_current = FALSE
    WHERE school_id = p_school_id AND is_current AND id <> v_year_id;

    UPDATE academic_years SET is_current = TRUE WHERE id = v_year_id;

    SELECT json_build_object(
        'id', id, 'name', name, 'starts_on', starts_on, 'ends_on', ends_on,
        'is_current', is_current, 'academic_year_id', academic_year_id
    ) INTO v_result FROM terms WHERE id = p_term_id;

    RETURN v_result;
END;
$$;


-- ---------------------------------------------------------------------------
-- create_scheme_with_weeks
--
-- Creates a scheme of work and scaffolds one blank row per teaching week, so
-- a teacher opens a ready-made outline rather than an empty page. Week count
-- comes from the term's own dates.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_scheme_with_weeks(
    p_school_id        UUID,
    p_term_id          UUID,
    p_class_subject_id UUID,
    p_author_id        UUID,
    p_title            TEXT,
    p_aims             TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scheme_id UUID;
    v_weeks     INTEGER;
    v_result    JSON;
BEGIN
    IF EXISTS (
        SELECT 1 FROM schemes_of_work
        WHERE term_id = p_term_id AND class_subject_id = p_class_subject_id
    ) THEN
        RAISE EXCEPTION 'SCHEME_EXISTS';
    END IF;

    SELECT term_week_count(starts_on, ends_on) INTO v_weeks
    FROM terms WHERE id = p_term_id AND school_id = p_school_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TERM_NOT_FOUND';
    END IF;

    INSERT INTO schemes_of_work (
        school_id, term_id, class_subject_id, author_id, title, aims
    )
    VALUES (p_school_id, p_term_id, p_class_subject_id, p_author_id, p_title, p_aims)
    RETURNING id INTO v_scheme_id;

    INSERT INTO scheme_weeks (scheme_id, week_number, topic)
    SELECT v_scheme_id, generate_series, ''
    FROM generate_series(1, v_weeks);

    SELECT json_build_object(
        'id', v_scheme_id, 'title', p_title, 'week_count', v_weeks, 'status', 'draft'
    ) INTO v_result;

    RETURN v_result;
END;
$$;


-- ---------------------------------------------------------------------------
-- review_planning_document
--
-- Approves or requests changes on a scheme or a lesson plan. Handles both
-- tables so the review rules live in one place.
-- p_kind: 'scheme' | 'lesson_plan'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION review_planning_document(
    p_kind        TEXT,
    p_document_id UUID,
    p_decision    TEXT,
    p_note        TEXT,
    p_reviewer_id UUID,
    p_school_id   UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status  TEXT;
    v_current TEXT;
    v_result  JSON;
BEGIN
    IF p_decision NOT IN ('approved', 'changes_requested') THEN
        RAISE EXCEPTION 'INVALID_DECISION';
    END IF;

    v_status := p_decision;

    IF p_kind = 'scheme' THEN
        SELECT status INTO v_current FROM schemes_of_work
        WHERE id = p_document_id AND school_id = p_school_id FOR UPDATE;

        IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;
        IF v_current = 'draft' THEN RAISE EXCEPTION 'NOT_SUBMITTED'; END IF;

        UPDATE schemes_of_work
        SET status = v_status, reviewed_by = p_reviewer_id,
            reviewed_at = NOW(), review_note = p_note
        WHERE id = p_document_id;

        SELECT json_build_object('id', id, 'status', status, 'review_note', review_note)
        INTO v_result FROM schemes_of_work WHERE id = p_document_id;

    ELSIF p_kind = 'lesson_plan' THEN
        SELECT status INTO v_current FROM lesson_plans
        WHERE id = p_document_id AND school_id = p_school_id FOR UPDATE;

        IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;
        IF v_current = 'draft' THEN RAISE EXCEPTION 'NOT_SUBMITTED'; END IF;

        UPDATE lesson_plans
        SET status = v_status, reviewed_by = p_reviewer_id,
            reviewed_at = NOW(), review_note = p_note
        WHERE id = p_document_id;

        SELECT json_build_object('id', id, 'status', status, 'review_note', review_note)
        INTO v_result FROM lesson_plans WHERE id = p_document_id;
    ELSE
        RAISE EXCEPTION 'INVALID_KIND';
    END IF;

    RETURN v_result;
END;
$$;


-- ---------------------------------------------------------------------------
-- post_message
--
-- Appends a message, bumps the thread's sort key and marks the sender caught
-- up — three writes that must not drift apart.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION post_message(
    p_thread_id UUID,
    p_sender_id UUID,
    p_body      TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_message_id UUID;
    v_now        TIMESTAMPTZ := NOW();
    v_result     JSON;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM thread_participants
        WHERE thread_id = p_thread_id AND user_id = p_sender_id
    ) THEN
        RAISE EXCEPTION 'NOT_A_PARTICIPANT';
    END IF;

    INSERT INTO messages (thread_id, sender_id, body, created_at)
    VALUES (p_thread_id, p_sender_id, p_body, v_now)
    RETURNING id INTO v_message_id;

    UPDATE threads SET last_message_at = v_now WHERE id = p_thread_id;

    -- Your own message never counts as unread to you.
    UPDATE thread_participants
    SET last_read_at = v_now
    WHERE thread_id = p_thread_id AND user_id = p_sender_id;

    SELECT json_build_object(
        'id', m.id, 'body', m.body, 'created_at', m.created_at,
        'sender', json_build_object('id', u.id, 'name', u.name, 'role', u.role)
    ) INTO v_result
    FROM messages m LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.id = v_message_id;

    RETURN v_result;
END;
$$;


-- ---------------------------------------------------------------------------
-- create_thread
--
-- Creates a conversation, enrols its participants (always including the
-- author) and posts the opening message in one transaction.
-- p_participants is a JSON array of user id strings.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_thread(
    p_school_id    UUID,
    p_subject      TEXT,
    p_body         TEXT,
    p_author_id    UUID,
    p_participants JSON,
    p_student_id   UUID DEFAULT NULL,
    p_class_id     UUID DEFAULT NULL,
    p_category     TEXT DEFAULT 'general',
    p_priority     TEXT DEFAULT 'normal'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_thread_id UUID;
    v_now       TIMESTAMPTZ := NOW();
    v_result    JSON;
BEGIN
    INSERT INTO threads (
        school_id, subject, student_id, class_id, category, priority,
        created_by, last_message_at
    )
    VALUES (
        p_school_id, p_subject, p_student_id, p_class_id, p_category, p_priority,
        p_author_id, v_now
    )
    RETURNING id INTO v_thread_id;

    -- Enrol everyone named, plus the author, ignoring duplicates.
    INSERT INTO thread_participants (thread_id, user_id)
    SELECT v_thread_id, uid::UUID
    FROM json_array_elements_text(p_participants) AS uid
    WHERE EXISTS (SELECT 1 FROM users WHERE id = uid::UUID AND school_id = p_school_id)
    ON CONFLICT (thread_id, user_id) DO NOTHING;

    INSERT INTO thread_participants (thread_id, user_id, last_read_at)
    VALUES (v_thread_id, p_author_id, v_now)
    ON CONFLICT (thread_id, user_id) DO UPDATE SET last_read_at = v_now;

    INSERT INTO messages (thread_id, sender_id, body, created_at)
    VALUES (v_thread_id, p_author_id, p_body, v_now);

    SELECT json_build_object('id', id, 'subject', subject, 'status', status)
    INTO v_result FROM threads WHERE id = v_thread_id;

    RETURN v_result;
END;
$$;


-- ---------------------------------------------------------------------------
-- Callable only by the backend's service-role key.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION transfer_student(UUID, UUID, TEXT, UUID, UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION return_library_loan(UUID, UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION mark_attendance(UUID, UUID, UUID, DATE, UUID, JSON) FROM anon, authenticated;
REVOKE ALL ON FUNCTION assign_class_staff(UUID, UUID, TEXT, UUID, UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION rotate_class_staff(UUID, UUID, TEXT, UUID, UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION assign_students_to_class(JSON, UUID, UUID, UUID, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION set_current_term(UUID, UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION create_scheme_with_weeks(UUID, UUID, UUID, UUID, TEXT, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION review_planning_document(TEXT, UUID, TEXT, TEXT, UUID, UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION post_message(UUID, UUID, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION create_thread(UUID, TEXT, TEXT, UUID, JSON, UUID, UUID, TEXT, TEXT) FROM anon, authenticated;
