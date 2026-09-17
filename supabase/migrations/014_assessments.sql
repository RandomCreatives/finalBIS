-- ============================================================================
-- 014_assessments.sql
-- Multiple assessments per subject (Quiz 1, Classwork, Exam, ...).
--
-- An assessment column is worth `max_marks` (its share of the 100-mark
-- total). Each student gets a raw score per assessment; the final mark for
-- (student, subject, term) is the SUM of the assessment scores, stored back
-- into the existing marksheets table so report cards keep working.
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessments (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id       UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    term_id          UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    label            TEXT NOT NULL,
    max_marks        NUMERIC(6, 2) NOT NULL DEFAULT 100 CHECK (max_marks > 0),
    sort_order       INTEGER NOT NULL DEFAULT 0,
    created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (class_id, subject_id, term_id, label)
);

CREATE INDEX IF NOT EXISTS idx_assessments_lookup
    ON assessments(class_id, subject_id, term_id);

CREATE TABLE IF NOT EXISTS assessment_marks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    marks         NUMERIC(6, 2) NOT NULL CHECK (marks >= 0),
    entered_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (assessment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_marks_student
    ON assessment_marks(student_id);
