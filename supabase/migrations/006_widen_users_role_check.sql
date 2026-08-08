-- =============================================================================
-- Widen the users.role CHECK to include store_manager.
--
-- Run this block in the Supabase SQL editor to upgrade an EXISTING database.
-- Fresh databases are covered by supabase/schema.sql.
--
-- The store_manager role was added to the app's role model after some
-- deployments were created, so those databases still carry the original
-- four-role CHECK (admin, main_teacher, assistant_teacher, subject_teacher)
-- and reject creating a store manager.
-- =============================================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'main_teacher', 'assistant_teacher', 'subject_teacher', 'store_manager'));
