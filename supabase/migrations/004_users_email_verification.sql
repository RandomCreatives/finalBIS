-- =============================================================================
-- Email verification & passwordless Gmail login columns
--
-- Run this block in the Supabase SQL editor to upgrade an EXISTING database.
-- Fresh databases are covered by supabase/schema.sql.
--
--  1. is_email_verified        — account's Gmail has been verified
--  2. pending_email            — the Gmail address awaiting verification
--  3. verification_code        — 6-digit code emailed when linking a Gmail
--  4. verification_code_expires_at — when that code stops being valid
--  5. login_code               — 6-digit code for passwordless Gmail sign-in
--  6. login_code_expires_at    — when the sign-in code stops being valid
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_code_expires_at TIMESTAMPTZ;
