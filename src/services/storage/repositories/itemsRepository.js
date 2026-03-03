export function createItemsRepository(adapter) {
  return {
    upsertItem({ accountId, externalItemId, title, now = new Date().toISOString() }) {
      return adapter.upsertItem({ accountId, externalItemId, title, now });
    }
  };
}
