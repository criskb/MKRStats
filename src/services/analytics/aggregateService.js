export function aggregatePortfolioData(platformPayload) {
  const dailyTotals = new Map();
  const modelMap = new Map();

  for (const platform of platformPayload) {
    for (const row of platform.snapshot.series) {
      const existing = dailyTotals.get(row.date) ?? {
        date: row.date,
        views: 0,
        downloads: 0,
        sales: 0,
        revenue: 0
      };

      existing.views += row.views;
      existing.downloads += row.downloads;
      existing.sales += row.sales;
      existing.revenue = Number((existing.revenue + row.revenue).toFixed(2));
      dailyTotals.set(row.date, existing);
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
      existing.revenue = Number((existing.revenue + model.revenue).toFixed(2));
      modelMap.set(model.title, existing);
    }
  }

  const timeline = [...dailyTotals.values()].sort((a, b) => a.date.localeCompare(b.date));
  const topModels = [...modelMap.values()]
    .map((model) => ({
      ...model,
      conversionRate: Number(((model.sales / Math.max(model.downloads, 1)) * 100).toFixed(2))
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const totals = timeline.reduce(
    (acc, row) => ({
      views: acc.views + row.views,
      downloads: acc.downloads + row.downloads,
      sales: acc.sales + row.sales,
      revenue: Number((acc.revenue + row.revenue).toFixed(2))
    }),
    { views: 0, downloads: 0, sales: 0, revenue: 0 }
  );

  return { totals, timeline, topModels };
}
