CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_id TEXT NOT NULL,
  external_account_id TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (platform_id, external_account_id)
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  external_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE (account_id, external_item_id)
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  fetched_platforms INTEGER DEFAULT 0,
  upserted_item_rows INTEGER DEFAULT 0,
  upserted_metric_rows INTEGER DEFAULT 0,
  error_message TEXT,
  platform_quality_metrics TEXT,
  quality_summary TEXT
);

CREATE TABLE IF NOT EXISTS item_snapshot_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingestion_run_id INTEGER,
  account_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  dedupe_hash TEXT NOT NULL,
  payload TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  FOREIGN KEY (ingestion_run_id) REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS item_metrics_daily (
  item_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  sales INTEGER NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (item_id, date),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_item_metrics_daily_item_date ON item_metrics_daily(item_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_snapshot_raw_dedupe_hash ON item_snapshot_raw(dedupe_hash);
