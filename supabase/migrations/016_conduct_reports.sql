-- =============================================================================
-- Conduct Reports (Admin Communications — "Conduct report")
--
-- Teachers record student behavior — praise, concerns and serious incidents —
-- for the admin. The admin acknowledges the report and eventually marks it
-- actioned, noting what was done so the teacher sees the follow-through:
--
--   new --(admin reads & acknowledges)--> acknowledged --(action taken)--> actioned
--
-- Run this block in the Supabase SQL editor to upgrade an EXISTING database.
-- Fresh databases get the same table from supabase/schema.sql.
-- =============================================================================

CREATE TABLE IF NOT EXISTS conduct_reports (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id  UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    class_id          UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    reporter_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type              TEXT NOT NULL
                      CHECK (type IN ('praise', 'concern', 'serious')),
    body              TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new', 'acknowledged', 'actioned')),
    handled_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    handled_at        TIMESTAMPTZ,
    action_note       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conduct_reports_school
    ON conduct_reports(school_id, status);
CREATE INDEX IF NOT EXISTS idx_conduct_reports_reporter
    ON conduct_reports(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conduct_reports_class
    ON conduct_reports(class_id);
CREATE INDEX IF NOT EXISTS idx_conduct_reports_student
    ON conduct_reports(student_id);
