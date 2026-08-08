-- =============================================================================
-- Store Requests — class resource requisitions
--
-- Run this block in the Supabase SQL editor to upgrade an EXISTING database.
-- Fresh databases are covered by running supabase/schema.sql, which now
-- contains the same table and the widened users role check.
--
--  1. Adds the 'store_manager' role to the users CHECK constraint.
--  2. Creates the store_requests table and its indexes.
-- =============================================================================

-- 1) Widen the users role CHECK to admit store managers.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;
    ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'main_teacher', 'assistant_teacher', 'subject_teacher', 'store_manager'));
END $$;

-- 2) Requisition table.
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
