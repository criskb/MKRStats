import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'fs/promises';
import os from 'os';
import path from 'path';

async function loadStoreModule(storePath) {
  process.env.CONNECTION_MASTER_KEY = 'test-master-key';
  process.env.CONNECTION_CONFIG_STORE_PATH = storePath;
  return import(`../src/services/connectors/connectionConfigStore.js?ts=${Date.now()}-${Math.random()}`);
}

test('upsertConnectionConfig persists encrypted credential blob and returns sanitized status', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mkrstats-connection-store-'));
  const storePath = path.join(tempDir, 'connections.json');
  const { upsertConnectionConfig, getConnectionStatuses } = await loadStoreModule(storePath);

  const saved = await upsertConnectionConfig({
    platformId: 'cgtrader',
    accountId: 'alice',
    authType: 'apiKey',
    credential: { apiKey: 'secret-token', handle: 'alice' },
    status: 'active',
    lastValidatedAt: '2026-01-01T10:00:00.000Z',
    lastError: null
  });

  assert.equal(saved.platformId, 'cgtrader');
  assert.equal(saved.accountId, 'alice');
  assert.equal(saved.status, 'active');
  assert.equal(typeof saved.updatedAt, 'string');
  assert.equal(saved.encryptedCredentialBlob, undefined);

  const statuses = await getConnectionStatuses();
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].authType, 'apiKey');
  assert.equal(statuses[0].lastError, null);

  const raw = JSON.parse(await readFile(storePath, 'utf8'));
  assert.equal(raw.connections.length, 1);
  assert.equal(typeof raw.connections[0].encryptedCredentialBlob.cipherText, 'string');
  assert.equal(raw.connections[0].encryptedCredentialBlob.cipherText.includes('secret-token'), false);
});
