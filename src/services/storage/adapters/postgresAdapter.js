import { runPostgresMigrations } from '../migrations/runMigrations.js';

export class PostgresStorageAdapter {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.pool = null;
  }

  async initialize() {
    const { Pool } = await import('pg');
    this.pool = new Pool({ connectionString: this.connectionString });
    await runPostgresMigrations(this.pool);
  }

  async createIngestionRun({ runType, status, startedAt }) {
    const { rows } = await this.pool.query(
      `INSERT INTO ingestion_runs (run_type, status, started_at) VALUES ($1, $2, $3) RETURNING id`,
      [runType, status, startedAt]
    );
    return rows[0].id;
  }

  async completeIngestionRun(id, payload) {
    await this.pool.query(
      `UPDATE ingestion_runs
       SET status = $1, completed_at = $2, fetched_platforms = $3, upserted_item_rows = $4, upserted_metric_rows = $5, error_message = $6, platform_quality_metrics = $7, quality_summary = $8
       WHERE id = $9`,
      [
        payload.status,
        payload.completedAt,
        payload.fetchedPlatforms,
        payload.upsertedItemRows,
        payload.upsertedMetricRows,
        payload.errorMessage,
        payload.platformQualityMetrics ?? null,
        payload.qualitySummary ?? null,
        id
      ]
    );
  }

  async upsertAccount({ platformId, externalAccountId, displayName = null, now }) {
    const { rows } = await this.pool.query(
      `INSERT INTO accounts (platform_id, external_account_id, display_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT(platform_id, external_account_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [platformId, externalAccountId, displayName, now]
    );
    return rows[0];
  }

  async upsertItem({ accountId, externalItemId, title, now }) {
    const { rows } = await this.pool.query(
      `INSERT INTO items (account_id, external_item_id, title, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT(account_id, external_item_id) DO UPDATE SET
       title = EXCLUDED.title,
       updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [accountId, externalItemId, title, now]
    );
    return rows[0];
  }

  async upsertItemDailyMetric({ itemId, date, views, downloads, sales, revenue, capturedAt }) {
    await this.pool.query(
      `INSERT INTO item_metrics_daily (item_id, date, views, downloads, sales, revenue, captured_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (item_id, date) DO UPDATE SET
       views = EXCLUDED.views,
       downloads = EXCLUDED.downloads,
       sales = EXCLUDED.sales,
       revenue = EXCLUDED.revenue,
       captured_at = EXCLUDED.captured_at`,
      [itemId, date, views, downloads, sales, revenue, capturedAt]
    );
  }

  async insertRawSnapshot({ ingestionRunId, accountId, itemId, date, dedupeHash, payload, capturedAt }) {
    const result = await this.pool.query(
      `INSERT INTO item_snapshot_raw (ingestion_run_id, account_id, item_id, date, dedupe_hash, payload, captured_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (dedupe_hash) DO NOTHING`,
      [ingestionRunId, accountId, itemId, date, dedupeHash, payload, capturedAt]
    );
    return result.rowCount > 0;
  }

  async getPlatformDailyMetrics(platformIds = []) {
    if (platformIds.length) {
      const { rows } = await this.pool.query(
        `SELECT a.platform_id, md.date, SUM(md.views)::int AS views, SUM(md.downloads)::int AS downloads,
                SUM(md.sales)::int AS sales, SUM(md.revenue)::numeric(12,2) AS revenue, MAX(md.captured_at) AS collected_at
         FROM item_metrics_daily md
         JOIN items i ON i.id = md.item_id
         JOIN accounts a ON a.id = i.account_id
         WHERE a.platform_id = ANY($1::text[])
         GROUP BY a.platform_id, md.date
         ORDER BY md.date ASC`,
        [platformIds]
      );
      return rows;
    }

    const { rows } = await this.pool.query(
      `SELECT a.platform_id, md.date, SUM(md.views)::int AS views, SUM(md.downloads)::int AS downloads,
              SUM(md.sales)::int AS sales, SUM(md.revenue)::numeric(12,2) AS revenue, MAX(md.captured_at) AS collected_at
       FROM item_metrics_daily md
       JOIN items i ON i.id = md.item_id
       JOIN accounts a ON a.id = i.account_id
       GROUP BY a.platform_id, md.date
       ORDER BY md.date ASC`
    );
    return rows;
  }

  async getItemDailyMetrics(platformIds = []) {
    if (platformIds.length) {
      const { rows } = await this.pool.query(
        `SELECT a.platform_id, i.external_item_id AS model_id, i.title AS model_title, md.date,
                md.downloads, md.sales, md.revenue, md.captured_at AS collected_at
         FROM item_metrics_daily md
         JOIN items i ON i.id = md.item_id
         JOIN accounts a ON a.id = i.account_id
         WHERE a.platform_id = ANY($1::text[])`,
        [platformIds]
      );
      return rows;
    }

    const { rows } = await this.pool.query(
      `SELECT a.platform_id, i.external_item_id AS model_id, i.title AS model_title, md.date,
              md.downloads, md.sales, md.revenue, md.captured_at AS collected_at
       FROM item_metrics_daily md
       JOIN items i ON i.id = md.item_id
       JOIN accounts a ON a.id = i.account_id`
    );
    return rows;
  }

  async getRecentIngestionRuns(limit = 20) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const { rows } = await this.pool.query(
      `SELECT * FROM ingestion_runs ORDER BY started_at DESC LIMIT $1`,
      [safeLimit]
    );
    return rows;
  }
}
