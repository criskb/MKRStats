export class PostgresStorageAdapter {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.pool = null;
  }

  async initialize() {
    const { Pool } = await import('pg');
    this.pool = new Pool({ connectionString: this.connectionString });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS collection_runs (
        id BIGSERIAL PRIMARY KEY,
        run_type TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        fetched_platforms INTEGER DEFAULT 0,
        upserted_platform_rows INTEGER DEFAULT 0,
        upserted_model_rows INTEGER DEFAULT 0,
        error_message TEXT,
        platform_quality_metrics JSONB,
        quality_summary JSONB
      );

      CREATE TABLE IF NOT EXISTS platform_daily_metrics (
        platform_id TEXT NOT NULL,
        date DATE NOT NULL,
        views INTEGER NOT NULL DEFAULT 0,
        downloads INTEGER NOT NULL DEFAULT 0,
        sales INTEGER NOT NULL DEFAULT 0,
        revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
        collected_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (platform_id, date)
      );

      CREATE TABLE IF NOT EXISTS model_daily_metrics (
        platform_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        model_title TEXT NOT NULL,
        date DATE NOT NULL,
        downloads INTEGER NOT NULL DEFAULT 0,
        sales INTEGER NOT NULL DEFAULT 0,
        revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
        collected_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (platform_id, model_id, date)
      );
    `);

    await this.pool.query(`
      ALTER TABLE collection_runs ADD COLUMN IF NOT EXISTS platform_quality_metrics JSONB;
      ALTER TABLE collection_runs ADD COLUMN IF NOT EXISTS quality_summary JSONB;
    `);
  }

  async createCollectionRun({ runType, status, startedAt }) {
    const { rows } = await this.pool.query(
      `INSERT INTO collection_runs (run_type, status, started_at) VALUES ($1, $2, $3) RETURNING id`,
      [runType, status, startedAt]
    );
    return rows[0].id;
  }

  async completeCollectionRun(id, payload) {
    await this.pool.query(
      `UPDATE collection_runs
       SET status = $1, completed_at = $2, fetched_platforms = $3, upserted_platform_rows = $4, upserted_model_rows = $5, error_message = $6, platform_quality_metrics = $7, quality_summary = $8
       WHERE id = $9`,
      [
        payload.status,
        payload.completedAt,
        payload.fetchedPlatforms,
        payload.upsertedPlatformRows,
        payload.upsertedModelRows,
        payload.errorMessage,
        payload.platformQualityMetrics ?? null,
        payload.qualitySummary ?? null,
        id
      ]
    );
  }

  async upsertPlatformDailyMetrics(rows) {
    for (const row of rows) {
      await this.pool.query(
        `INSERT INTO platform_daily_metrics (platform_id, date, views, downloads, sales, revenue, collected_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (platform_id, date) DO UPDATE SET
         views = EXCLUDED.views,
         downloads = EXCLUDED.downloads,
         sales = EXCLUDED.sales,
         revenue = EXCLUDED.revenue,
         collected_at = EXCLUDED.collected_at`,
        [row.platformId, row.date, row.views, row.downloads, row.sales, row.revenue, row.collectedAt]
      );
    }
  }

  async upsertModelDailyMetrics(rows) {
    for (const row of rows) {
      await this.pool.query(
        `INSERT INTO model_daily_metrics (platform_id, model_id, model_title, date, downloads, sales, revenue, collected_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (platform_id, model_id, date) DO UPDATE SET
         model_title = EXCLUDED.model_title,
         downloads = EXCLUDED.downloads,
         sales = EXCLUDED.sales,
         revenue = EXCLUDED.revenue,
         collected_at = EXCLUDED.collected_at`,
        [row.platformId, row.modelId, row.modelTitle, row.date, row.downloads, row.sales, row.revenue, row.collectedAt]
      );
    }
  }

  async getPlatformDailyMetrics(platformIds = []) {
    if (platformIds.length) {
      const { rows } = await this.pool.query(
        `SELECT * FROM platform_daily_metrics WHERE platform_id = ANY($1::text[]) ORDER BY date ASC`,
        [platformIds]
      );
      return rows;
    }

    const { rows } = await this.pool.query('SELECT * FROM platform_daily_metrics ORDER BY date ASC');
    return rows;
  }

  async getModelDailyMetrics(platformIds = []) {
    if (platformIds.length) {
      const { rows } = await this.pool.query(
        `SELECT * FROM model_daily_metrics WHERE platform_id = ANY($1::text[])`,
        [platformIds]
      );
      return rows;
    }

    const { rows } = await this.pool.query('SELECT * FROM model_daily_metrics');
    return rows;
  }

  async getRecentCollectionRuns(limit = 20) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const { rows } = await this.pool.query(
      `SELECT * FROM collection_runs ORDER BY started_at DESC LIMIT $1`,
      [safeLimit]
    );
    return rows;
  }
}
