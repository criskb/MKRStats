function round2(value) {
  return Number(value.toFixed(2));
}

function sumRows(timeline, field) {
  return timeline.reduce((acc, row) => acc + row[field], 0);
}

function percentageChange(current, previous) {
  if (previous === 0) return 0;
  return round2(((current - previous) / previous) * 100);
}

function deltaMetric(current, previous) {
  return {
    current: round2(current),
    previous: round2(previous),
    change: round2(current - previous),
    changePct: percentageChange(current, previous)
  };
}

export function aggregatePortfolioData(platformPayload) {
  const dailyTotals = new Map();
  const modelMap = new Map();
  const platformSummaries = [];

  for (const platform of platformPayload) {
    let platformViews = 0;
    let platformDownloads = 0;
    let platformSales = 0;
    let platformRevenue = 0;

    for (const row of platform.snapshot.series) {
      const existing = dailyTotals.get(row.date) ?? {
        date: row.date,
        views: 0,
        downloads: 0,
        likes: 0,
        sales: 0,
        revenue: 0
      };

      existing.views += row.views;
      existing.downloads += row.downloads;
      existing.sales += row.sales;
      existing.revenue = round2(existing.revenue + row.revenue);
      dailyTotals.set(row.date, existing);

      platformViews += row.views;
      platformDownloads += row.downloads;
      platformSales += row.sales;
      platformRevenue = round2(platformRevenue + row.revenue);
    }

    for (const model of platform.snapshot.models) {
      const existing = modelMap.get(model.title) ?? {
        title: model.title,
        downloads: 0,
        sales: 0,
        revenue: 0
      };

      existing.downloads += model.downloads;
      existing.sales += model.sales;
      existing.revenue = round2(existing.revenue + model.revenue);
      modelMap.set(model.title, existing);
    }

    platformSummaries.push({
      platformId: platform.id,
      name: platform.name,
      integrationMode: platform.integrationMode,
      downloads: platformDownloads,
      sales: platformSales,
      views: platformViews,
      revenue: platformRevenue,
      conversionRate: round2((platformSales / Math.max(platformDownloads, 1)) * 100),
      revenuePerDownload: round2(platformRevenue / Math.max(platformDownloads, 1))
    });
  }

  const timeline = [...dailyTotals.values()].sort((a, b) => a.date.localeCompare(b.date));

  const totals = {
    views: sumRows(timeline, 'views'),
    downloads: sumRows(timeline, 'downloads'),
    sales: sumRows(timeline, 'sales'),
    revenue: round2(sumRows(timeline, 'revenue'))
  };

  const topModels = [...modelMap.values()]
    .map((model) => ({
      ...model,
      conversionRate: round2((model.sales / Math.max(model.downloads, 1)) * 100)
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const topPerformer = topModels[0] ?? null;
  const trailing7 = timeline.slice(-7);
  const previous7 = timeline.slice(-14, -7);

  const trailingRevenue = round2(sumRows(trailing7, 'revenue'));
  const previousRevenue = round2(sumRows(previous7, 'revenue'));
  const trailingDownloads = sumRows(trailing7, 'downloads');
  const previousDownloads = sumRows(previous7, 'downloads');
  const trailingSales = sumRows(trailing7, 'sales');
  const previousSales = sumRows(previous7, 'sales');

  const conversionRate = round2((totals.sales / Math.max(totals.downloads, 1)) * 100);

  const funnel = {
    views: totals.views,
    downloads: totals.downloads,
    sales: totals.sales,
    viewToDownloadRate: round2((totals.downloads / Math.max(totals.views, 1)) * 100),
    downloadToSaleRate: round2((totals.sales / Math.max(totals.downloads, 1)) * 100)
  };

  const kpiDeltas = {
    revenue7d: deltaMetric(trailingRevenue, previousRevenue),
    downloads7d: deltaMetric(trailingDownloads, previousDownloads),
    sales7d: deltaMetric(trailingSales, previousSales)
  };

  return {
    totals,
    timeline,
    topModels,
    platformSummaries: platformSummaries.sort((a, b) => b.revenue - a.revenue),
    funnel,
    kpiDeltas,
    insights: {
      conversionRate,
      trailingRevenue,
      previousRevenue,
      trailingDownloads,
      trailingSales,
      revenueTrendPct: percentageChange(trailingRevenue, previousRevenue),
      downloadTrendPct: percentageChange(trailingDownloads, previousDownloads),
      salesTrendPct: percentageChange(trailingSales, previousSales),
      averageDailyRevenue: round2(totals.revenue / Math.max(timeline.length, 1)),
      topPerformer
    }
  };
}
