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
    throw new Error('Missing CONNECTION_MASTER_KEY environment variable for credential encryption.');
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
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    cipherText: encrypted.toString('base64')
  };
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

  const credentialPayload = input.credential ?? input.credentials ?? null;
  if (!credentialPayload || typeof credentialPayload !== 'object') {
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

export async function getConnectionStatuses() {
  const store = await readStore();
  return store.connections.map((connection) => sanitizeConnection(connection));
}
