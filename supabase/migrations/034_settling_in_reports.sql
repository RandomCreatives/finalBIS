-- Settling In Reports: per-student, per-subject attainment ratings.
-- Criteria are versioned and sent by the API from the approved Year 3/Year 4
-- templates. Each saved section snapshots its criteria so old printouts remain
-- interpretable if a future template version changes.

CREATE TABLE IF NOT EXISTS settling_in_report_sections (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id          UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    term_id           UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    grade_level       SMALLINT NOT NULL CHECK (grade_level IN (3, 4)),
    subject_key       TEXT NOT NULL CHECK (subject_key IN (
        'english', 'mathematics', 'science', 'global_citizenship', 'amharic'
    )),
    template_version TEXT NOT NULL,
    criteria_snapshot JSONB NOT NULL CHECK (jsonb_typeof(criteria_snapshot) = 'array'),
    ratings           JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(ratings) = 'object'),
    saved_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (school_id, class_id, student_id, term_id, subject_key)
);

CREATE INDEX IF NOT EXISTS idx_settling_in_sections_class_term
    ON settling_in_report_sections(school_id, class_id, term_id);
CREATE INDEX IF NOT EXISTS idx_settling_in_sections_student
    ON settling_in_report_sections(student_id, term_id);

DROP TRIGGER IF EXISTS trg_settling_in_report_sections_updated_at
    ON settling_in_report_sections;
CREATE TRIGGER trg_settling_in_report_sections_updated_at
    BEFORE UPDATE ON settling_in_report_sections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE settling_in_report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE settling_in_report_sections FORCE ROW LEVEL SECURITY;
REVOKE ALL ON settling_in_report_sections FROM anon, authenticated;
