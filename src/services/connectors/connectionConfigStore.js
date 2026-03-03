import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storeFilePath = process.env.CONNECTION_CONFIG_STORE_PATH
  ? path.resolve(process.env.CONNECTION_CONFIG_STORE_PATH)
  : path.resolve(__dirname, '../../../data/connection-configs.json');

function hashText(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function resolveMasterKey() {
  const configured = process.env.CONNECTION_MASTER_KEY;
  if (!configured) {
    return null;
  }

  const normalized = configured.trim();
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;

  if (base64Regex.test(normalized) && normalized.length % 4 === 0) {
    const decoded = Buffer.from(normalized, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  }

  return crypto.createHash('sha256').update(normalized).digest();
}

function encryptCredentialBlob(payload) {
  const masterKey = resolveMasterKey();
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');

  if (!masterKey) {
    return {
      alg: 'plain-v1',
      cipherText: plaintext.toString('base64')
    };
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    cipherText: encrypted.toString('base64')
  };
}

function decryptCredentialBlob(blob) {
  if (!blob || typeof blob !== 'object') return null;

  if (blob.alg === 'plain-v1') {
    const text = Buffer.from(String(blob.cipherText ?? ''), 'base64').toString('utf8');
    return JSON.parse(text);
  }

  const masterKey = resolveMasterKey();
  if (!masterKey) return null;

  const iv = Buffer.from(String(blob.iv ?? ''), 'base64');
  const authTag = Buffer.from(String(blob.authTag ?? ''), 'base64');
  const cipherText = Buffer.from(String(blob.cipherText ?? ''), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext);
}

function sanitizeConnection(connection) {
  return {
    platformId: connection.platformId,
    accountId: connection.accountId,
    authType: connection.authType,
    status: connection.status,
    lastValidatedAt: connection.lastValidatedAt,
    lastError: connection.lastError,
    updatedAt: connection.updatedAt
  };
}

function hydrateConnection(connection) {
  const credential = decryptCredentialBlob(connection.encryptedCredentialBlob);
  return {
    ...sanitizeConnection(connection),
    credential: credential ?? null
  };
}

async function readStore() {
  try {
    const raw = await readFile(storeFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.connections)) {
      return { version: 1, connections: [] };
    }

    return {
      version: Number(parsed.version) || 1,
      connections: parsed.connections
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { version: 1, connections: [] };
    }
    throw error;
  }
}

async function writeStore(payload) {
  const directory = path.dirname(storeFilePath);
  await mkdir(directory, { recursive: true });
  await writeFile(storeFilePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function normalizeInput(input = {}) {
  const platformId = String(input.platformId ?? '').trim();
  const accountId = String(input.accountId ?? '').trim();
  const authType = String(input.authType ?? 'apiKey').trim() || 'apiKey';

  if (!platformId || !accountId) {
    throw new Error('platformId and accountId are required.');
  }

  const credentialPayload = input.credential ?? input.credentials ?? {};
  if (typeof credentialPayload !== 'object' || Array.isArray(credentialPayload) || credentialPayload == null) {
    throw new Error('credential object is required.');
  }

  const status = String(input.status ?? 'pending').trim() || 'pending';

  return {
    platformId,
    accountId,
    authType,
    credentialPayload,
    status,
    lastValidatedAt: input.lastValidatedAt ? new Date(input.lastValidatedAt).toISOString() : null,
    lastError: input.lastError ? String(input.lastError) : null
  };
}

export async function upsertConnectionConfig(input) {
  const normalized = normalizeInput(input);
  const store = await readStore();
  const now = new Date().toISOString();
  const accountHash = hashText(`${normalized.platformId}:${normalized.accountId}`);

  const record = {
    platformId: normalized.platformId,
    accountId: normalized.accountId,
    authType: normalized.authType,
    encryptedCredentialBlob: encryptCredentialBlob(normalized.credentialPayload),
    status: normalized.status,
    lastValidatedAt: normalized.lastValidatedAt,
    lastError: normalized.lastError,
    updatedAt: now,
    accountHash
  };

  const existingIndex = store.connections.findIndex((item) => item.accountHash === accountHash);
  if (existingIndex >= 0) {
    store.connections[existingIndex] = record;
  } else {
    store.connections.push(record);
  }

  await writeStore(store);
  return sanitizeConnection(record);
}

export async function getConnectionStatuses({ includeCredentials = false } = {}) {
  const store = await readStore();
  return store.connections.map((connection) => (includeCredentials ? hydrateConnection(connection) : sanitizeConnection(connection)));
}

export async function authenticateBridgeSubmission({ platformId, accountHandle, apiToken, sessionId }) {
  const normalizedPlatformId = String(platformId ?? '').trim().toLowerCase();
  const normalizedAccountHandle = String(accountHandle ?? '').trim();
  const token = String(apiToken ?? '').trim();
  const session = String(sessionId ?? '').trim();

  if (!normalizedPlatformId || !normalizedAccountHandle || !token || !session) {
    return null;
  }

  const store = await readStore();
  for (const connection of store.connections) {
    if (String(connection.platformId ?? '').toLowerCase() !== normalizedPlatformId) continue;
    if (String(connection.accountId ?? '').trim() !== normalizedAccountHandle) continue;
    try {
      const credential = decryptCredentialBlob(connection.encryptedCredentialBlob);
      if (!credential || typeof credential !== 'object') continue;
      const expectedToken = String(credential.apiToken ?? credential.token ?? '').trim();
      const expectedSession = String(credential.sessionId ?? credential.session ?? '').trim();
      if (expectedToken === token && expectedSession === session) {
        return sanitizeConnection(connection);
      }
    } catch {
      continue;
    }
  }

  return null;
}
