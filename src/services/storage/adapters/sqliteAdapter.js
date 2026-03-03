import { mkdir } from 'fs/promises';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

export class SqliteStorageAdapter {
  constructor(databasePath) {
    this.databasePath = databasePath;
    this.db = null;
  }

  async initialize() {
    await mkdir(path.dirname(this.databasePath), { recursive: true });
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS collection_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_type TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        fetched_platforms INTEGER DEFAULT 0,
        upserted_platform_rows INTEGER DEFAULT 0,
        upserted_model_rows INTEGER DEFAULT 0,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS platform_daily_metrics (
        platform_id TEXT NOT NULL,
        date TEXT NOT NULL,
        views INTEGER NOT NULL DEFAULT 0,
        downloads INTEGER NOT NULL DEFAULT 0,
        sales INTEGER NOT NULL DEFAULT 0,
        revenue REAL NOT NULL DEFAULT 0,
        collected_at TEXT NOT NULL,
        PRIMARY KEY (platform_id, date)
      );

      CREATE TABLE IF NOT EXISTS model_daily_metrics (
        platform_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        model_title TEXT NOT NULL,
        date TEXT NOT NULL,
        downloads INTEGER NOT NULL DEFAULT 0,
        sales INTEGER NOT NULL DEFAULT 0,
        revenue REAL NOT NULL DEFAULT 0,
        collected_at TEXT NOT NULL,
        PRIMARY KEY (platform_id, model_id, date)
      );
    `);
  }

  async createCollectionRun({ runType, status, startedAt }) {
    const stmt = this.db.prepare(`
      INSERT INTO collection_runs (run_type, status, started_at)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(runType, status, startedAt);
    return result.lastInsertRowid;
  }

  async completeCollectionRun(id, { status, completedAt, fetchedPlatforms, upsertedPlatformRows, upsertedModelRows, errorMessage = null }) {
    const stmt = this.db.prepare(`
      UPDATE collection_runs
      SET status = ?, completed_at = ?, fetched_platforms = ?, upserted_platform_rows = ?, upserted_model_rows = ?, error_message = ?
      WHERE id = ?
    `);
    stmt.run(status, completedAt, fetchedPlatforms, upsertedPlatformRows, upsertedModelRows, errorMessage, id);
  }

  async upsertPlatformDailyMetrics(rows) {
    const stmt = this.db.prepare(`
      INSERT INTO platform_daily_metrics (platform_id, date, views, downloads, sales, revenue, collected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform_id, date) DO UPDATE SET
        views = excluded.views,
        downloads = excluded.downloads,
        sales = excluded.sales,
        revenue = excluded.revenue,
        collected_at = excluded.collected_at
    `);

    for (const row of rows) {
      stmt.run(row.platformId, row.date, row.views, row.downloads, row.sales, row.revenue, row.collectedAt);
    }
  }

  async upsertModelDailyMetrics(rows) {
    const stmt = this.db.prepare(`
      INSERT INTO model_daily_metrics (platform_id, model_id, model_title, date, downloads, sales, revenue, collected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform_id, model_id, date) DO UPDATE SET
        model_title = excluded.model_title,
        downloads = excluded.downloads,
        sales = excluded.sales,
        revenue = excluded.revenue,
        collected_at = excluded.collected_at
    `);

    for (const row of rows) {
      stmt.run(row.platformId, row.modelId, row.modelTitle, row.date, row.downloads, row.sales, row.revenue, row.collectedAt);
    }
  }

  async getPlatformDailyMetrics(platformIds = []) {
    let query = 'SELECT * FROM platform_daily_metrics';
    const values = [];

    if (platformIds.length) {
      query += ` WHERE platform_id IN (${platformIds.map(() => '?').join(',')})`;
      values.push(...platformIds);
    }

    query += ' ORDER BY date ASC';
    return this.db.prepare(query).all(...values);
  }

  async getModelDailyMetrics(platformIds = []) {
    let query = 'SELECT * FROM model_daily_metrics';
    const values = [];

    if (platformIds.length) {
      query += ` WHERE platform_id IN (${platformIds.map(() => '?').join(',')})`;
      values.push(...platformIds);
    }

    return this.db.prepare(query).all(...values);
  }
}
