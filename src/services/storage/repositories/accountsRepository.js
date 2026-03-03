export function createAccountsRepository(adapter) {
  return {
    upsertAccount({ platformId, externalAccountId, displayName = null, now = new Date().toISOString() }) {
      return adapter.upsertAccount({ platformId, externalAccountId, displayName, now });
    }
  };
}
