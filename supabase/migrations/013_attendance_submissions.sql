-- ============================================================================
-- 013_attendance_submissions.sql
-- Monthly attendance review & submission workflow.
--
-- One row per class per month. When a main teacher submits, status is
-- 'submitted' and the month's registers become read-only for non-admins
-- (enforced in the API). An admin can return a month for correction
-- (status 'returned'), which unlocks it; the teacher then resubmits.
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_submissions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    month        TEXT NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    status       TEXT NOT NULL DEFAULT 'submitted'
                 CHECK (status IN ('submitted', 'returned')),
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (class_id, month)
);

CREATE INDEX IF NOT EXISTS idx_attendance_submissions_school
    ON attendance_submissions(school_id, month);
