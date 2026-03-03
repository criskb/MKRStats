export function createItemMetricsDailyRepository(adapter) {
  return {
    upsertDailyMetric(payload) {
      return adapter.upsertItemDailyMetric(payload);
    },
    listByPlatforms(platformIds = []) {
      return adapter.getPlatformDailyMetrics(platformIds);
    },
    listItemMetricsByPlatforms(platformIds = []) {
      return adapter.getItemDailyMetrics(platformIds);
    }
  };
}
