-- 009: Fix gaps from earlier migrations
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS)

-- 1. Add last_login_at column (missing from initial schema tracking)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. Create store_requests if it doesn't exist (from schema.sql, but migration 003 may not have run)
CREATE TABLE IF NOT EXISTS store_requests (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id           UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id    UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    request_number      TEXT NOT NULL,
    requester_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id            UUID REFERENCES classes(id) ON DELETE SET NULL,
    items               JSONB NOT NULL DEFAULT '[]',
    purpose             TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'store_approved', 'approved', 'rejected')),
    store_reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    store_reviewed_at   TIMESTAMPTZ,
    store_review_note   TEXT,
    admin_reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_reviewed_at   TIMESTAMPTZ,
    admin_review_note   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, request_number)
);

-- 3. Enable RLS on store_requests (safe even if already enabled)
ALTER TABLE store_requests ENABLE ROW LEVEL SECURITY;

-- 4. Add performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_terms_school_starts ON terms(school_id, starts_on);
CREATE INDEX IF NOT EXISTS idx_calendar_events_school_term ON calendar_events(school_id, term_id);
CREATE INDEX IF NOT EXISTS idx_students_school_gender ON students(school_id, gender);
CREATE INDEX IF NOT EXISTS idx_clinic_visits_school_date ON clinic_visits(school_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_school_year ON timetable_slots(school_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_marksheets_school_term ON marksheets(school_id, term_id);
CREATE INDEX IF NOT EXISTS idx_store_requests_school ON store_requests(school_id);
