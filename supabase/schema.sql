-- =============================================================================
-- BIS NOC School Management System — database schema
-- Target: Supabase / PostgreSQL 15+
--
-- Apply with:  supabase db push        (or paste into the SQL editor)
-- Then apply:  supabase/functions.sql
-- This script is idempotent and safe to re-run.
--
-- SECURITY MODEL
-- Row Level Security is enabled on every table with NO permissive policies.
-- The `anon` and `authenticated` keys can read nothing. All access goes
-- through the backend, which holds the service-role key and authorises each
-- request with its own JWT + role checks.
--
-- STAFFING MODEL
--   Each class has one main teacher and one assistant teacher (class_staff).
--   Subjects are a school-wide catalogue; class_subjects assigns a teacher to
--   a (class, subject) pair, so one subject teacher can cover many classes
--   while a class can draw its subjects from many teachers.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
-- Lets GIST indexes mix plain equality columns with range overlap, which is
-- what the timetable's double-booking constraints need.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- PostgreSQL ships no range type over TIME, so define one for lesson periods.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'timerange') THEN
        CREATE TYPE timerange AS RANGE (subtype = TIME);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- academic_years
--
-- Staffing, subject assignments, timetables and marks are all scoped to a
-- year so next year's setup can be built without disturbing this year's
-- records. Exactly one year per school is flagged current.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS academic_years (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    starts_on  DATE NOT NULL,
    ends_on    DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (school_id, name),
    CONSTRAINT year_dates_ordered CHECK (ends_on > starts_on)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_current_year_per_school
    ON academic_years(school_id) WHERE is_current;


-- ---------------------------------------------------------------------------
-- terms
--
-- Three per year, each typically 10–12 weeks, but the length is whatever the
-- dates say — a term can run for any span the school needs.
--
-- Week numbers are derived from starts_on rather than stored, so shifting a
-- term's dates re-labels its weeks automatically instead of leaving lesson
-- plans pointing at the wrong week.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terms (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    term_index       INTEGER NOT NULL CHECK (term_index BETWEEN 1 AND 6),
    name             TEXT NOT NULL,
    starts_on        DATE NOT NULL,
    ends_on          DATE NOT NULL,
    is_current       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (academic_year_id, term_index),
    CONSTRAINT term_dates_ordered CHECK (ends_on > starts_on)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_current_term_per_school
    ON terms(school_id) WHERE is_current;

-- Two terms in the same year must not overlap.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_terms') THEN
        ALTER TABLE terms ADD CONSTRAINT no_overlapping_terms
        EXCLUDE USING GIST (
            academic_year_id WITH =,
            daterange(starts_on, ends_on, '[]') WITH &&
        );
    END IF;
END $$;

/** Total teaching weeks in a term. */
CREATE OR REPLACE FUNCTION term_week_count(p_starts DATE, p_ends DATE)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$
    SELECT GREATEST(1, CEIL((p_ends - p_starts + 1) / 7.0)::INTEGER);
$$;


-- ---------------------------------------------------------------------------
-- users — every human who can log in
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id          UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name               TEXT NOT NULL,
    email              CITEXT NOT NULL UNIQUE,
    phone              TEXT,
    password_hash      TEXT NOT NULL,
    role               TEXT NOT NULL CONSTRAINT users_role_check CHECK (role IN (
                       'admin', 'main_teacher', 'assistant_teacher', 'subject_teacher', 'store_manager')),
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    is_email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    pending_email      TEXT,
    verification_code  TEXT,
    verification_code_expires_at TIMESTAMPTZ,
    login_code         TEXT,
    login_code_expires_at TIMESTAMPTZ,
    last_login_at      TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id, role);

-- Existing databases created before the store_manager role existed still carry
-- the old four-role CHECK. Widen it in place so a fresh schema.sql run (which
-- defines the new constraint inline above) and an upgrade both converge.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;
    ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'main_teacher', 'assistant_teacher', 'subject_teacher', 'store_manager'));
END $$;


-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    year_level INTEGER,
    capacity   INTEGER CHECK (capacity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (school_id, name)
);


-- ---------------------------------------------------------------------------
-- class_staff — who runs a class
--
-- One main teacher and one assistant teacher per class per year, enforced by
-- the partial unique index below. A member of staff may appear against
-- several classes if the school needs it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_staff (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position         TEXT NOT NULL CHECK (position IN ('main', 'assistant')),
    assigned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (class_id, user_id, academic_year_id)
);

-- At most one main and one assistant per class, per year.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_class_position
    ON class_staff(class_id, position, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_class_staff_user ON class_staff(user_id, academic_year_id);


-- ---------------------------------------------------------------------------
-- subjects — school-wide catalogue
--
-- "English" is one row, not one row per class. Which classes take it, and who
-- teaches each, lives in class_subjects.
-- ---------------------------------------------------------------------------
-- taught_by records the school's policy for a subject:
--   subject_teacher — English, Amharic, Music, Arts, PE, French
--   main_teacher    — Maths, Science and semester-assigned subjects, which the
--                     class's own main teacher delivers
-- The API warns when an assignment contradicts this, and the timetable uses it
-- to default the right teacher.
CREATE TABLE IF NOT EXISTS subjects (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    code        TEXT NOT NULL,
    taught_by   TEXT NOT NULL DEFAULT 'subject_teacher'
                CHECK (taught_by IN ('subject_teacher', 'main_teacher')),
    is_semester BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (school_id, code),
    UNIQUE (school_id, name)
);


-- ---------------------------------------------------------------------------
-- class_subjects — the teaching assignment
--
-- One row per (class, subject, year), naming the teacher responsible. This is
-- what lets three English teachers cover four classes each while a fourth
-- subject spreads differently.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_subjects (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id  UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    class_id          UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id        UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    sessions_per_week INTEGER NOT NULL DEFAULT 0 CHECK (sessions_per_week >= 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (class_id, subject_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_class_subjects_teacher
    ON class_subjects(teacher_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_class
    ON class_subjects(class_id, academic_year_id);


-- ---------------------------------------------------------------------------
-- timetable_slots — weekly schedule
--
-- class_id and teacher_id are denormalised from class_subjects so the two
-- EXCLUDE constraints below can enforce, in the database:
--   * a class cannot sit two lessons at once
--   * a teacher cannot be in two rooms at once
-- A plain unique index cannot express "overlapping time ranges", so this uses
-- a GIST exclusion constraint over a timerange. The trigger further down keeps
-- the denormalised columns honest.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timetable_slots (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    class_subject_id UUID NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
    class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    day_of_week      INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    starts_at        TIME NOT NULL,
    ends_at          TIME NOT NULL,
    room             TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT slot_times_ordered CHECK (ends_at > starts_at)
);

DO $$ BEGIN
    -- One class, one lesson at a time.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_class_double_booking') THEN
        ALTER TABLE timetable_slots ADD CONSTRAINT no_class_double_booking
        EXCLUDE USING GIST (
            class_id WITH =,
            academic_year_id WITH =,
            day_of_week WITH =,
            timerange(starts_at, ends_at, '[)') WITH &&
        );
    END IF;

    -- One teacher, one room at a time. Free periods (NULL teacher) are exempt.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_teacher_double_booking') THEN
        ALTER TABLE timetable_slots ADD CONSTRAINT no_teacher_double_booking
        EXCLUDE USING GIST (
            teacher_id WITH =,
            academic_year_id WITH =,
            day_of_week WITH =,
            timerange(starts_at, ends_at, '[)') WITH &&
        ) WHERE (teacher_id IS NOT NULL);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_timetable_year    ON timetable_slots(academic_year_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_class   ON timetable_slots(class_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable_slots(teacher_id, day_of_week);

-- Keep the denormalised columns in step with the assignment they came from,
-- so the exclusion constraints can never be fooled by a stale value.
CREATE OR REPLACE FUNCTION sync_timetable_denormals()
RETURNS TRIGGER AS $$
BEGIN
    SELECT cs.class_id, cs.teacher_id
    INTO NEW.class_id, NEW.teacher_id
    FROM class_subjects cs
    WHERE cs.id = NEW.class_subject_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_timetable_sync ON timetable_slots;
CREATE TRIGGER trg_timetable_sync
    BEFORE INSERT OR UPDATE OF class_subject_id ON timetable_slots
    FOR EACH ROW EXECUTE FUNCTION sync_timetable_denormals();

-- Reassigning a subject's teacher must move their timetable with them,
-- otherwise the schedule would still show the previous teacher.
CREATE OR REPLACE FUNCTION cascade_teacher_to_timetable()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id THEN
        UPDATE timetable_slots
        SET teacher_id = NEW.teacher_id
        WHERE class_subject_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_teacher ON class_subjects;
CREATE TRIGGER trg_cascade_teacher
    AFTER UPDATE OF teacher_id ON class_subjects
    FOR EACH ROW EXECUTE FUNCTION cascade_teacher_to_timetable();


-- ---------------------------------------------------------------------------
-- store_requests — class resource requisitions
--
-- Teachers request classroom items (books, markers, pens, pencils, ...) for
-- their class. The flow is two-stage: a store manager reviews the request
-- first, then the admin gives the final approval. `items` is a JSONB array of
-- { item, quantity, note } so the form stays simple and the printed
-- requisition mirrors what was typed.
--
-- Statuses:
--   pending        submitted, waiting for the store manager
--   store_approved store manager approved, waiting for the admin
--   approved       admin gave the final approval (printable record)
--   rejected       turned down at either stage (note recorded)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_requests (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id  UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    request_number    TEXT NOT NULL,
    requester_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id          UUID REFERENCES classes(id) ON DELETE SET NULL,
    items             JSONB NOT NULL DEFAULT '[]'::jsonb,
    purpose           TEXT,
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'store_approved', 'approved', 'rejected')),
    store_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    store_reviewed_at TIMESTAMPTZ,
    store_review_note TEXT,
    admin_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_reviewed_at TIMESTAMPTZ,
    admin_review_note TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (school_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_store_requests_school
    ON store_requests(school_id, status);
CREATE INDEX IF NOT EXISTS idx_store_requests_requester
    ON store_requests(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_requests_class
    ON store_requests(class_id);


-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id          UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id           UUID REFERENCES classes(id) ON DELETE SET NULL,
    admission_no       TEXT NOT NULL,
    name               TEXT NOT NULL,
    roll_num           INTEGER CHECK (roll_num > 0),
    date_of_birth      DATE,
    gender             TEXT CHECK (gender IN ('male', 'female', 'other')),
    guardian_name      TEXT,
    guardian_phone     TEXT,
    guardian_email     CITEXT,
    special_needs      BOOLEAN NOT NULL DEFAULT FALSE,
    special_needs_note TEXT,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (school_id, admission_no)
);

CREATE INDEX IF NOT EXISTS idx_students_class  ON students(class_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);


-- ---------------------------------------------------------------------------
-- student_transfers — audit trail for class moves
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_transfers (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    from_class_id  UUID REFERENCES classes(id) ON DELETE SET NULL,
    to_class_id    UUID REFERENCES classes(id) ON DELETE SET NULL,
    reason         TEXT,
    transferred_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_student ON student_transfers(student_id);


-- ---------------------------------------------------------------------------
-- attendance
--   homeroom → subject_id NULL, one record per student per day
--   subject  → subject_id set, one record per student per day per subject
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    date       DATE NOT NULL,
    status     TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    note       TEXT,
    marked_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_homeroom
    ON attendance(student_id, date) WHERE subject_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_subject
    ON attendance(student_id, date, subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);


-- ---------------------------------------------------------------------------
-- marksheets — one row per student / subject / term / year
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marksheets (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id       UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id         UUID REFERENCES classes(id) ON DELETE SET NULL,
    term_id          UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    marks            NUMERIC(6, 2) NOT NULL CHECK (marks >= 0),
    max_marks        NUMERIC(6, 2) NOT NULL DEFAULT 100 CHECK (max_marks > 0),
    percentage       NUMERIC(5, 2),
    grade            TEXT,
    entered_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT marks_within_max CHECK (marks <= max_marks),
    UNIQUE (student_id, subject_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_marksheets_class_term ON marksheets(class_id, term_id);


-- ---------------------------------------------------------------------------
-- library_loans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS library_loans (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    book_title  TEXT NOT NULL,
    book_author TEXT,
    book_isbn   TEXT,
    borrowed_on DATE NOT NULL DEFAULT CURRENT_DATE,
    due_on      DATE NOT NULL,
    returned_on DATE,
    status      TEXT NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned')),
    issued_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT due_after_borrow CHECK (due_on >= borrowed_on)
);

CREATE INDEX IF NOT EXISTS idx_loans_student ON library_loans(student_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_status  ON library_loans(school_id, status, due_on);


-- ---------------------------------------------------------------------------
-- clinic_visits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinic_visits (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id          UUID REFERENCES classes(id) ON DELETE SET NULL,
    visit_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    complaint         TEXT NOT NULL,
    incident_type     TEXT NOT NULL CHECK (incident_type IN (
                          'illness', 'injury', 'accident', 'emergency',
                          'routine_checkup', 'medication', 'first_aid', 'other')),
    severity          TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN (
                          'minor', 'moderate', 'severe', 'critical')),
    diagnosis         TEXT,
    treatment         TEXT,
    outcome           TEXT NOT NULL CHECK (outcome IN (
                          'returned_to_class', 'sent_home', 'referred_to_hospital', 'observation')),
    parent_notified   BOOLEAN NOT NULL DEFAULT FALSE,
    leave_status      TEXT CHECK (leave_status IN ('pending', 'approved', 'rejected')),
    leave_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    leave_reviewed_at TIMESTAMPTZ,
    attended_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_student ON clinic_visits(student_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_clinic_leave   ON clinic_visits(school_id, leave_status)
    WHERE leave_status IS NOT NULL;


-- =============================================================================
-- PLANNING — schemes of work and weekly lesson plans
-- =============================================================================

-- ---------------------------------------------------------------------------
-- schemes_of_work
--
-- One per teacher, per (class, subject), per term: the term-long outline a
-- teacher submits before teaching starts. Keyed on class_subject_id so it is
-- automatically tied to the right teacher and class.
--
-- Review workflow: draft -> submitted -> approved | changes_requested.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schemes_of_work (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    term_id          UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    class_subject_id UUID NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
    author_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    title            TEXT NOT NULL,
    -- The big picture for the term.
    aims             TEXT,
    assessment_plan  TEXT,
    resources        TEXT,
    status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                         'draft', 'submitted', 'approved', 'changes_requested')),
    submitted_at     TIMESTAMPTZ,
    reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at      TIMESTAMPTZ,
    review_note      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (term_id, class_subject_id)
);

CREATE INDEX IF NOT EXISTS idx_schemes_author ON schemes_of_work(author_id, term_id);
CREATE INDEX IF NOT EXISTS idx_schemes_status ON schemes_of_work(school_id, status);


-- ---------------------------------------------------------------------------
-- scheme_weeks — the week-by-week outline inside a scheme
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheme_weeks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheme_id   UUID NOT NULL REFERENCES schemes_of_work(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number > 0),
    topic       TEXT NOT NULL,
    objectives  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scheme_id, week_number)
);


-- ---------------------------------------------------------------------------
-- lesson_plans — one per week, per (class, subject)
--
-- Sits under the scheme of work: the scheme says what week 4 covers, the
-- lesson plan says how it will be taught.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lesson_plans (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    term_id          UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    class_subject_id UUID NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
    scheme_id        UUID REFERENCES schemes_of_work(id) ON DELETE SET NULL,
    author_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    week_number      INTEGER NOT NULL CHECK (week_number > 0),
    topic            TEXT NOT NULL,
    objectives       TEXT,
    activities       TEXT,
    resources        TEXT,
    homework         TEXT,
    -- Filled in after teaching: what actually happened.
    reflection       TEXT,
    status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                         'draft', 'submitted', 'approved', 'changes_requested')),
    submitted_at     TIMESTAMPTZ,
    reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at      TIMESTAMPTZ,
    review_note      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (term_id, class_subject_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_plans_author ON lesson_plans(author_id, term_id, week_number);
CREATE INDEX IF NOT EXISTS idx_plans_status ON lesson_plans(school_id, status);


-- =============================================================================
-- CALENDAR
-- =============================================================================

-- ---------------------------------------------------------------------------
-- calendar_events
--
-- The school calendar: term dates, exams, meetings, holidays, trips.
--
-- Audience controls who sees an event; a NULL class_id means school-wide,
-- otherwise it is specific to one class. all_day events ignore the times.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    term_id     UUID REFERENCES terms(id) ON DELETE SET NULL,
    class_id    UUID REFERENCES classes(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    category    TEXT NOT NULL DEFAULT 'event' CHECK (category IN (
                    'event', 'exam', 'meeting', 'holiday', 'trip', 'deadline', 'training')),
    audience    TEXT NOT NULL DEFAULT 'all' CHECK (audience IN (
                    'all', 'main_teacher', 'assistant_teacher', 'subject_teacher')),
    starts_on   DATE NOT NULL,
    ends_on     DATE NOT NULL,
    starts_at   TIME,
    ends_at     TIME,
    all_day     BOOLEAN NOT NULL DEFAULT TRUE,
    location    TEXT,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT event_dates_ordered CHECK (ends_on >= starts_on),
    CONSTRAINT event_times_ordered CHECK (
        all_day OR starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at
    )
);

CREATE INDEX IF NOT EXISTS idx_events_range ON calendar_events(school_id, starts_on, ends_on);
CREATE INDEX IF NOT EXISTS idx_events_class ON calendar_events(class_id) WHERE class_id IS NOT NULL;


-- =============================================================================
-- COMMUNICATION LAYER
-- =============================================================================

-- ---------------------------------------------------------------------------
-- threads — a conversation, optionally about a student or a class
--
-- Threads carry status and priority so a conversation is a piece of work that
-- gets resolved, not a message that scrolls away.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS threads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject         TEXT NOT NULL,
    -- Optional context: what the conversation is about.
    student_id      UUID REFERENCES students(id) ON DELETE SET NULL,
    class_id        UUID REFERENCES classes(id) ON DELETE SET NULL,
    category        TEXT NOT NULL DEFAULT 'general' CHECK (category IN (
                        'general', 'student', 'class', 'academic', 'welfare', 'admin')),
    priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,
    -- Denormalised so the inbox can sort without touching the messages table.
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threads_school  ON threads(school_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_student ON threads(student_id) WHERE student_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- thread_participants — who is in a conversation, and what they have read
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thread_participants (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id    UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_user ON thread_participants(user_id);


-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id  UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    sender_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);


-- ---------------------------------------------------------------------------
-- tasks — assignable, trackable action items
--
-- The productivity half of admin ↔ teacher communication: a request with an
-- owner, a due date and a visible state, rather than a message someone hopes
-- was read.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    assigned_to  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Optional context
    class_id     UUID REFERENCES classes(id) ON DELETE SET NULL,
    student_id   UUID REFERENCES students(id) ON DELETE SET NULL,
    thread_id    UUID REFERENCES threads(id) ON DELETE SET NULL,
    due_on       DATE,
    priority     TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                     'pending', 'in_progress', 'done', 'cancelled')),
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigned_to, status, due_on);
CREATE INDEX IF NOT EXISTS idx_tasks_school   ON tasks(school_id, status);


-- ---------------------------------------------------------------------------
-- notices — broadcast announcements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notices (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    body              TEXT NOT NULL,
    -- Who should see it.
    audience          TEXT NOT NULL DEFAULT 'all' CHECK (audience IN (
                          'all', 'main_teacher', 'assistant_teacher', 'subject_teacher')),
    -- When true the recipient must actively confirm they have read it.
    requires_ack      BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned         BOOLEAN NOT NULL DEFAULT FALSE,
    posted_on         DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notices_school ON notices(school_id, posted_on DESC);


-- ---------------------------------------------------------------------------
-- notice_receipts — who read (and acknowledged) what
--
-- Closes the loop on broadcasts: an admin can see exactly which teachers have
-- seen a notice instead of assuming.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notice_receipts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notice_id       UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    UNIQUE (notice_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_notice ON notice_receipts(notice_id);


-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'schools', 'academic_years', 'terms', 'users', 'classes', 'class_staff',
        'subjects', 'class_subjects', 'timetable_slots', 'students', 'attendance',
        'marksheets', 'library_loans', 'clinic_visits', 'schemes_of_work',
        'scheme_weeks', 'lesson_plans', 'calendar_events', 'threads', 'tasks', 'notices',
        'store_requests'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s', t);
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
    END LOOP;
END $$;


-- ---------------------------------------------------------------------------
-- Row Level Security: on everywhere, no policies granted.
--
-- The anon/authenticated roles are created by Supabase. Guarded here so the
-- script also runs on a plain PostgreSQL instance (local dev, CI, tests).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'schools', 'academic_years', 'terms', 'users', 'classes', 'class_staff',
        'subjects', 'class_subjects', 'timetable_slots', 'students', 'student_transfers',
        'attendance', 'marksheets', 'library_loans', 'clinic_visits',
        'schemes_of_work', 'scheme_weeks', 'lesson_plans', 'calendar_events',
        'threads', 'thread_participants', 'messages', 'tasks', 'notices', 'notice_receipts',
        'store_requests'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
    END LOOP;
END $$;
