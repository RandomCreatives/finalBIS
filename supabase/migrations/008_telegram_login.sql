-- =============================================================================
-- Telegram login & notifications
--
-- Run this block in the Supabase SQL editor to upgrade an EXISTING database.
-- Fresh databases are covered by supabase/schema.sql.
--
--  1. telegram_id        — the staff member's Telegram user id (what the login
--                          widget signs and what we message later). Nullable;
--                          unique so one Telegram account maps to one login.
--  2. telegram_username  — display convenience, captured at link time.
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)
    WHERE telegram_id IS NOT NULL;
