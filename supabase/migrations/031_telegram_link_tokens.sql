-- =============================================================================
-- 031_telegram_link_tokens.sql
--
-- One-time, short-lived Telegram account linking for active BIS staff.
--
-- FLOW
--   1. A signed-in staff member calls POST /api/auth/telegram-link. The API
--      mints a random 32-byte token, stores ONLY its SHA-256 hash here, and
--      returns https://t.me/<bot>?start=link_<token>.
--   2. The staff member opens the link in @bisnocbot. The bot hashes the
--      token it receives, claims the row exactly once (used_at), and binds
--      the Telegram identity to the existing staff account.
--
-- SECURITY PROPERTIES
--   * No plaintext token is ever stored, so a database dump cannot be
--     replayed into an account takeover.
--   * Tokens expire 10 minutes after issue (expires_at), and `used_at`
--     makes each token single-use. Consuming is an atomic conditional
--     UPDATE, so two concurrent /start presses can never both win.
--   * One outstanding token per staff account (partial unique index below).
--   * The Telegram id lands in users.telegram_id, which already has a
--     unique index, so one Telegram account maps to one staff login.
--   * Row Level Security is forced on and nothing is granted to anon or
--     authenticated, like every other table; only the server-side service
--     role (which bypasses RLS) touches it.
--
-- Safe to re-run: every statement is IF NOT EXISTS.
-- HOW TO RUN: Supabase -> SQL Editor -> New query -> paste -> Run.
--              (Fresh databases get this from supabase/schema.sql.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash        TEXT NOT NULL UNIQUE,
    expires_at        TIMESTAMPTZ NOT NULL,
    used_at           TIMESTAMPTZ,
    telegram_id       BIGINT,
    telegram_username TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT telegram_link_tokens_ttl CHECK (expires_at > created_at),
    CONSTRAINT telegram_link_tokens_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user ON telegram_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_expires ON telegram_link_tokens(expires_at);

-- At most one outstanding (unused) link per staff account.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_telegram_link_token
    ON telegram_link_tokens(user_id) WHERE used_at IS NULL;

-- RLS: forced on, no policies, no grants to anon/authenticated.
ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_link_tokens FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON telegram_link_tokens FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON telegram_link_tokens FROM authenticated;
    END IF;
END $$;

COMMENT ON TABLE telegram_link_tokens IS
    'Single-use Telegram account-link tokens (SHA-256 hashes only, 10-minute TTL).';
