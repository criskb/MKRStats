const REQUIRED_FIELDS = ['date', 'views', 'downloads', 'sales', 'revenue'];

const DEFAULT_OUTLIER_LIMITS = {
  views: Number(process.env.MKRSTATS_OUTLIER_LIMIT_VIEWS ?? 500000),
  downloads: Number(process.env.MKRSTATS_OUTLIER_LIMIT_DOWNLOADS ?? 250000),
  sales: Number(process.env.MKRSTATS_OUTLIER_LIMIT_SALES ?? 100000),
  revenue: Number(process.env.MKRSTATS_OUTLIER_LIMIT_REVENUE ?? 1000000)
};

const DEFAULT_STALE_THRESHOLD_MINUTES = Number(process.env.MKRSTATS_STALE_SNAPSHOT_MINUTES ?? 1440);

function toSafeNumber(value, { decimals = 0 } = {}) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  if (decimals > 0) return Number(Math.max(0, parsed).toFixed(decimals));
  return Math.max(0, Math.floor(parsed));
}

function normalizeDate(value) {
  return String(value ?? '').slice(0, 10);
}

export function normalizeSeriesToCanonical(row = {}, defaultCurrency = 'USD') {
  return {
    date: normalizeDate(row.date),
    views: toSafeNumber(row.views),
    downloads: toSafeNumber(row.downloads),
    sales: toSafeNumber(row.sales),
    revenue: toSafeNumber(row.revenue, { decimals: 2 }),
    currency: String(row.currency ?? defaultCurrency).toUpperCase()
  };
}

export function normalizeModelToCanonical(row = {}) {
  const downloads = toSafeNumber(row.downloads);
  const sales = toSafeNumber(row.sales);
  const revenue = toSafeNumber(row.revenue, { decimals: 2 });

  return {
    id: String(row.id ?? row.title ?? `${Date.now()}`),
    title: String(row.title ?? 'Untitled Model'),
    downloads,
    sales,
    revenue,
    conversionRate: Number(((sales / Math.max(downloads, 1)) * 100).toFixed(2))
  };
}

function runQualityChecks(series = [], fetchedAt) {
  let missingRequired = 0;
  let duplicateDays = 0;
  let outlierValueCount = 0;
  const duplicateSet = new Set();
  const byDate = new Set();
  const sanitizedSeries = [];

  for (const row of series) {
    const missing = REQUIRED_FIELDS.some((field) => row[field] == null || (field === 'date' && !String(row[field]).trim()));
    if (missing) missingRequired += 1;

    if (byDate.has(row.date)) {
      duplicateDays += 1;
      duplicateSet.add(row.date);
      continue;
    }

    byDate.add(row.date);

    const clamped = { ...row };
    for (const metric of ['views', 'downloads', 'sales', 'revenue']) {
      const limit = DEFAULT_OUTLIER_LIMITS[metric];
      if (clamped[metric] > limit) {
        clamped[metric] = limit;
        outlierValueCount += 1;
      }
    }

    sanitizedSeries.push(clamped);
  }

  const parsedFetchedAt = Date.parse(fetchedAt ?? '');
  const staleAgeMinutes = Number.isNaN(parsedFetchedAt)
    ? null
    : Math.max(0, Math.round((Date.now() - parsedFetchedAt) / 60000));
  const isStale = staleAgeMinutes != null && staleAgeMinutes > DEFAULT_STALE_THRESHOLD_MINUTES;

  const checks = {
    requiredFieldCompleteness: {
      requiredFields: REQUIRED_FIELDS,
      totalRows: series.length,
      missingRows: missingRequired,
      completenessPct: series.length === 0 ? 100 : Math.round(((series.length - missingRequired) / series.length) * 100)
    },
    duplicateDayDetection: {
      duplicateDays,
      duplicateDates: [...duplicateSet]
    },
    outlierDetection: {
      clampingPolicy: {
        limits: DEFAULT_OUTLIER_LIMITS,
        action: 'clamp'
      },
      clampedValues: outlierValueCount
    },
    staleSnapshot: {
      thresholdMinutes: DEFAULT_STALE_THRESHOLD_MINUTES,
      ageMinutes: staleAgeMinutes,
      stale: isStale
    }
  };

  const penalty = (missingRequired * 5) + (duplicateDays * 15) + (outlierValueCount * 2) + (isStale ? 25 : 0);
  return {
    sanitizedSeries,
    checks,
    qualityScore: Math.max(0, 100 - penalty),
    hasFailures: missingRequired > 0 || duplicateDays > 0 || isStale
  };
}

export function validateAndNormalizeSnapshot(platformId, snapshot = {}) {
  const currency = String(snapshot.currency ?? 'USD').toUpperCase();
  const canonicalSeries = Array.isArray(snapshot.series)
    ? snapshot.series.map((row) => normalizeSeriesToCanonical(row, currency))
    : [];
  const canonicalModels = Array.isArray(snapshot.models)
    ? snapshot.models.map(normalizeModelToCanonical).sort((a, b) => b.revenue - a.revenue)
    : [];

  const quality = runQualityChecks(canonicalSeries, snapshot.fetchedAt);

  return {
    platformId,
    source: snapshot.source ?? 'platform_connector',
    fetchedAt: snapshot.fetchedAt ?? new Date().toISOString(),
    currency,
    series: quality.sanitizedSeries,
    models: canonicalModels,
    quality: {
      checks: quality.checks,
      qualityScore: quality.qualityScore,
      hasFailures: quality.hasFailures
    }
  };
}
