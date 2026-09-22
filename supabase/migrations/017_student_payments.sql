-- ============================================================================
-- 017_student_payments.sql
-- Per-term fee payment status per student (decision: Mike, 2026-09-22).
--
-- One row per student per term, created when a payment is recorded:
--   paid_term   — the parent paid for that term
--   paid_annum  — the parent settled the whole year up front
-- No row means unpaid. Main teachers mark payments from the class student
-- card; admins view everywhere and can correct. marked_by / marked_at keep
-- the paper trail. Status-only by design (amounts stay with the office).
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_payments (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    term_id    UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    status     TEXT NOT NULL CHECK (status IN ('paid_term', 'paid_annum')),
    marked_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    marked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_student_payments_school_term
    ON student_payments(school_id, term_id);
