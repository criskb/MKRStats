export function createItemSnapshotRawRepository(adapter) {
  return {
    insertSnapshot(payload) {
      return adapter.insertRawSnapshot(payload);
    },
    getLatestCapturedAt() {
      return adapter.getLatestRawSnapshotCapturedAt();
    }
  };
}
