CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  platform_id TEXT NOT NULL,
  external_account_id TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (platform_id, external_account_id)
);

CREATE TABLE IF NOT EXISTS items (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  external_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (account_id, external_item_id)
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id BIGSERIAL PRIMARY KEY,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  fetched_platforms INTEGER DEFAULT 0,
  upserted_item_rows INTEGER DEFAULT 0,
  upserted_metric_rows INTEGER DEFAULT 0,
  error_message TEXT,
  platform_quality_metrics JSONB,
  quality_summary JSONB
);

CREATE TABLE IF NOT EXISTS item_snapshot_raw (
  id BIGSERIAL PRIMARY KEY,
  ingestion_run_id BIGINT REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  dedupe_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS item_metrics_daily (
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  sales INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (item_id, date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_item_metrics_daily_item_date ON item_metrics_daily(item_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_snapshot_raw_dedupe_hash ON item_snapshot_raw(dedupe_hash);
