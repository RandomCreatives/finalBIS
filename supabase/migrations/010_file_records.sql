-- 010: File records table for Google Drive integration
-- Files are stored on Google Drive; metadata is tracked here for querying.

CREATE TABLE IF NOT EXISTS file_records (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    google_drive_id TEXT NOT NULL,
    name          TEXT NOT NULL,
    mime_type     TEXT,
    size_bytes    BIGINT DEFAULT 0,
    category      TEXT NOT NULL DEFAULT 'other'
                  CHECK (category IN ('academic', 'administrative', 'student', 'staff', 'other')),
    description   TEXT,
    uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE file_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_file_records_school ON file_records(school_id);
CREATE INDEX IF NOT EXISTS idx_file_records_category ON file_records(school_id, category);
CREATE INDEX IF NOT EXISTS idx_file_records_uploaded ON file_records(uploaded_by);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_file_records_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_file_records_updated ON file_records;
CREATE TRIGGER trg_file_records_updated
    BEFORE UPDATE ON file_records
    FOR EACH ROW EXECUTE FUNCTION update_file_records_timestamp();
