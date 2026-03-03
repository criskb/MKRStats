import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';
import { mkdtemp } from 'fs/promises';

test('runCollectionCycle stores platform history idempotently', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mkrstats-'));
  process.env.CONNECTION_MASTER_KEY = 'test-master-key';
  process.env.CONNECTION_CONFIG_STORE_PATH = path.join(tempDir, 'connection-configs.json');
  process.env.MKRSTATS_SQLITE_PATH = path.join(tempDir, 'metrics.sqlite');
  process.env.MKRSTATS_USE_MOCK_DATA = 'true';

  const { upsertConnectionConfig } = await import('../src/services/connectors/connectionConfigStore.js');
  const { initializeStorage, readPlatformHistory } = await import('../src/services/storage/index.js');
  const { runCollectionCycle } = await import('../src/services/collection/runCollectionCycle.js');

  await upsertConnectionConfig({
    platformId: 'cults3d',
    accountId: 'acct-1',
    authType: 'apiKey',
    credential: { apiKey: 'abc' },
    status: 'active'
  });

  await initializeStorage();
  const first = await runCollectionCycle({ runType: 'test_run' });
  const second = await runCollectionCycle({ runType: 'test_run' });

  assert.ok(first.upsertedItemRows > 0);
  assert.ok(first.upsertedMetricRows > 0);
  assert.equal(second.upsertedItemRows, first.upsertedItemRows);

  const history = await readPlatformHistory(['cults3d']);
  assert.equal(history.length, 1);
  assert.ok(history[0].snapshot.series.length > 0);
  assert.ok(history[0].snapshot.models.length > 0);
});
