-- =============================================================================
-- BIS NOC — Consolidated upgrade for EXISTING databases.
--
-- Combines migrations 003, 004, 005 and 006 into one block so a single paste
-- in the Supabase SQL editor brings a live database up to date.
--
--  * 003/006  widen users.role CHECK to include store_manager
--  * 003      create the store_requests table
--  * 004      add email-verification + passwordless-login columns to users
--  * 005      make the library free (drop fine columns, new return function)
--  * 005      refresh the RLS policy that was dropped with the fine columns
--
-- Idempotent: safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Widen the users role CHECK to admit store managers.
-- ---------------------------------------------------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'main_teacher', 'assistant_teacher', 'subject_teacher', 'store_manager'));

-- ---------------------------------------------------------------------------
-- 2) Email verification & passwordless Gmail login columns.
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_code_expires_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 3) Requisition table for the store.
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

-- Lock the new table down exactly like every other table in the schema:
-- RLS on and forced, no rights for anon/authenticated (the backend talks
-- through the service key, which bypasses RLS).
ALTER TABLE store_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON store_requests FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Library free: drop the fine columns and replace the return function.
-- ---------------------------------------------------------------------------
ALTER TABLE library_loans DROP COLUMN IF EXISTS fine_amount;
ALTER TABLE library_loans DROP COLUMN IF EXISTS fine_paid;

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
