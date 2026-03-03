import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'fs/promises';
import os from 'os';
import path from 'path';

async function loadStoreModule(storePath, { masterKey = 'test-master-key' } = {}) {
  if (masterKey == null) {
    delete process.env.CONNECTION_MASTER_KEY;
  } else {
    process.env.CONNECTION_MASTER_KEY = masterKey;
  }
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

  const statusesWithCredentials = await getConnectionStatuses({ includeCredentials: true });
  assert.equal(statusesWithCredentials[0].credential.apiKey, 'secret-token');

  const raw = JSON.parse(await readFile(storePath, 'utf8'));
  assert.equal(raw.connections.length, 1);
  assert.equal(typeof raw.connections[0].encryptedCredentialBlob.cipherText, 'string');
  assert.equal(raw.connections[0].encryptedCredentialBlob.cipherText.includes('secret-token'), false);
});

test('upsertConnectionConfig supports plaintext fallback when CONNECTION_MASTER_KEY is missing', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mkrstats-connection-store-'));
  const storePath = path.join(tempDir, 'connections.json');
  const { upsertConnectionConfig, getConnectionStatuses } = await loadStoreModule(storePath, { masterKey: null });

  await upsertConnectionConfig({
    platformId: 'printables',
    accountId: 'alice',
    authType: 'handle_only',
    credential: { handle: 'alice' },
    status: 'active'
  });

  const statusesWithCredentials = await getConnectionStatuses({ includeCredentials: true });
  assert.equal(statusesWithCredentials[0].credential.handle, 'alice');

  const raw = JSON.parse(await readFile(storePath, 'utf8'));
  assert.equal(raw.connections[0].encryptedCredentialBlob.alg, 'plain-v1');
});

test('authenticateBridgeSubmission validates api token and session pair', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mkrstats-connection-store-'));
  const storePath = path.join(tempDir, 'connections.json');
  const { upsertConnectionConfig, authenticateBridgeSubmission } = await loadStoreModule(storePath);

  await upsertConnectionConfig({
    platformId: 'makerworld',
    accountId: 'alice',
    authType: 'bridge',
    credential: { apiToken: 'abc123', sessionId: 'sess-1' },
    status: 'active'
  });

  const accepted = await authenticateBridgeSubmission({
    platformId: 'makerworld',
    accountHandle: 'alice',
    apiToken: 'abc123',
    sessionId: 'sess-1'
  });
  assert.equal(accepted.accountId, 'alice');

  const rejected = await authenticateBridgeSubmission({
    platformId: 'makerworld',
    accountHandle: 'alice',
    apiToken: 'wrong',
    sessionId: 'sess-1'
  });
  assert.equal(rejected, null);
});
