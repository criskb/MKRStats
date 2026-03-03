export function createIngestionRunsRepository(adapter) {
  return {
    createRun(payload) {
      return adapter.createIngestionRun(payload);
    },
    completeRun(id, payload) {
      return adapter.completeIngestionRun(id, payload);
    },
    getRecentRuns(limit = 20) {
      return adapter.getRecentIngestionRuns(limit);
    }
  };
}
