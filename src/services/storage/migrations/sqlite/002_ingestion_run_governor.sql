ALTER TABLE ingestion_runs ADD COLUMN ended_at TEXT;
ALTER TABLE ingestion_runs ADD COLUMN error_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ingestion_runs ADD COLUMN rate_limited_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ingestion_runs ADD COLUMN rate_limit_events TEXT;
ALTER TABLE ingestion_runs ADD COLUMN next_scheduled_at TEXT;
