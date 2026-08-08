-- =============================================================================
-- Make the library free: remove the overdue-fine columns and drop the fine
-- calculation from the return function.
--
-- Run this block in the Supabase SQL editor to upgrade an EXISTING database.
-- Fresh databases are covered by supabase/schema.sql + functions.sql.
-- =============================================================================

ALTER TABLE library_loans DROP COLUMN IF EXISTS fine_amount;
ALTER TABLE library_loans DROP COLUMN IF EXISTS fine_paid;

-- Replace return_library_loan with a version that marks the loan returned
-- without computing any fine.
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
