-- =============================================================================
-- Permission Requests (Admin Communications — "Request")
--
-- Teachers request admin permission for class-related issues — the common
-- case is a parent collecting a child mid-class. Each request is tied to a
-- specific roster student, and an admin approves or declines it.
--
-- Run this block in the Supabase SQL editor to upgrade an EXISTING database.
-- Fresh databases get the same table from supabase/schema.sql.
-- =============================================================================

CREATE TABLE IF NOT EXISTS permission_requests (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id  UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    class_id          UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    requester_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason            TEXT NOT NULL,
    pickup_time       TIMESTAMPTZ,           -- optional expected release time
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'declined')),
    reviewed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at       TIMESTAMPTZ,
    review_note       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_requests_school
    ON permission_requests(school_id, status);
CREATE INDEX IF NOT EXISTS idx_permission_requests_requester
    ON permission_requests(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_permission_requests_class
    ON permission_requests(class_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_student
    ON permission_requests(student_id);
