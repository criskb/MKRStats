import { mkdir } from 'fs/promises';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { runSqliteMigrations } from '../migrations/runMigrations.js';

export class SqliteStorageAdapter {
  constructor(databasePath) {
    this.databasePath = databasePath;
    this.db = null;
  }

  async initialize() {
    await mkdir(path.dirname(this.databasePath), { recursive: true });
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    await runSqliteMigrations(this.db);
  }

  async createIngestionRun({ runType, status, startedAt }) {
    const stmt = this.db.prepare(`
      INSERT INTO ingestion_runs (run_type, status, started_at)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(runType, status, startedAt);
    return result.lastInsertRowid;
  }

  async completeIngestionRun(
    id,
    {
      status,
      completedAt,
      fetchedPlatforms,
      upsertedItemRows,
      upsertedMetricRows,
      errorMessage = null,
      platformQualityMetrics = null,
      qualitySummary = null
    }
  ) {
    const stmt = this.db.prepare(`
      UPDATE ingestion_runs
      SET status = ?, completed_at = ?, fetched_platforms = ?, upserted_item_rows = ?, upserted_metric_rows = ?, error_message = ?, platform_quality_metrics = ?, quality_summary = ?
      WHERE id = ?
    `);
    stmt.run(
      status,
      completedAt,
      fetchedPlatforms,
      upsertedItemRows,
      upsertedMetricRows,
      errorMessage,
      platformQualityMetrics ? JSON.stringify(platformQualityMetrics) : null,
      qualitySummary ? JSON.stringify(qualitySummary) : null,
      id
    );
  }

  async upsertAccount({ platformId, externalAccountId, displayName = null, now }) {
    const stmt = this.db.prepare(`
      INSERT INTO accounts (platform_id, external_account_id, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(platform_id, external_account_id) DO UPDATE SET
        display_name = excluded.display_name,
        updated_at = excluded.updated_at
      RETURNING *
    `);
    return stmt.get(platformId, externalAccountId, displayName, now, now);
  }

  async upsertItem({ accountId, externalItemId, title, now }) {
    const stmt = this.db.prepare(`
      INSERT INTO items (account_id, external_item_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id, external_item_id) DO UPDATE SET
        title = excluded.title,
        updated_at = excluded.updated_at
      RETURNING *
    `);
    return stmt.get(accountId, externalItemId, title, now, now);
  }

  async upsertItemDailyMetric({ itemId, date, views, downloads, sales, revenue, capturedAt }) {
    const stmt = this.db.prepare(`
      INSERT INTO item_metrics_daily (item_id, date, views, downloads, sales, revenue, captured_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_id, date) DO UPDATE SET
        views = excluded.views,
        downloads = excluded.downloads,
        sales = excluded.sales,
        revenue = excluded.revenue,
        captured_at = excluded.captured_at
    `);
    stmt.run(itemId, date, views, downloads, sales, revenue, capturedAt);
  }

  async insertRawSnapshot({ ingestionRunId, accountId, itemId, date, dedupeHash, payload, capturedAt }) {
    const stmt = this.db.prepare(`
      INSERT INTO item_snapshot_raw (ingestion_run_id, account_id, item_id, date, dedupe_hash, payload, captured_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(dedupe_hash) DO NOTHING
    `);
    const result = stmt.run(ingestionRunId, accountId, itemId, date, dedupeHash, JSON.stringify(payload), capturedAt);
    return result.changes > 0;
  }

  async getPlatformDailyMetrics(platformIds = []) {
    let query = `
      SELECT a.platform_id, md.date, SUM(md.views) AS views, SUM(md.downloads) AS downloads, SUM(md.sales) AS sales, SUM(md.revenue) AS revenue, MAX(md.captured_at) AS collected_at
      FROM item_metrics_daily md
      JOIN items i ON i.id = md.item_id
      JOIN accounts a ON a.id = i.account_id
    `;
    const values = [];
    if (platformIds.length) {
      query += ` WHERE a.platform_id IN (${platformIds.map(() => '?').join(',')})`;
      values.push(...platformIds);
    }

    query += ' GROUP BY a.platform_id, md.date ORDER BY md.date ASC';
    return this.db.prepare(query).all(...values);
  }

  async getItemDailyMetrics(platformIds = []) {
    let query = `
      SELECT a.platform_id, i.external_item_id AS model_id, i.title AS model_title, md.date,
             md.downloads, md.sales, md.revenue, md.captured_at AS collected_at
      FROM item_metrics_daily md
      JOIN items i ON i.id = md.item_id
      JOIN accounts a ON a.id = i.account_id
    `;
    const values = [];
    if (platformIds.length) {
      query += ` WHERE a.platform_id IN (${platformIds.map(() => '?').join(',')})`;
      values.push(...platformIds);
    }

    return this.db.prepare(query).all(...values);
  }

  async getRecentIngestionRuns(limit = 20) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const rows = this.db.prepare(
      `SELECT * FROM ingestion_runs ORDER BY started_at DESC LIMIT ?`
    ).all(safeLimit);

    return rows.map((row) => ({
      ...row,
      platform_quality_metrics: row.platform_quality_metrics ? JSON.parse(row.platform_quality_metrics) : null,
      quality_summary: row.quality_summary ? JSON.parse(row.quality_summary) : null
    }));
  }
}
