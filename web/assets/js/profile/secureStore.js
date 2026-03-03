const STORAGE_KEY = 'mkrstats_secure_connections_v1';
const CONNECTION_META_KEY = 'mkrstats_connection_meta_v1';

function toBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function deriveKey(passphrase, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 120000,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPayload(payload, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    cipher: toBase64(cipher)
  };
}

export async function decryptPayload(encrypted, passphrase) {
  const salt = fromBase64(encrypted.salt);
  const iv = fromBase64(encrypted.iv);
  const cipher = fromBase64(encrypted.cipher);
  const key = await deriveKey(passphrase, salt);

  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  const text = new TextDecoder().decode(plain);
  return JSON.parse(text);
}

export function loadEncryptedConnections() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveEncryptedConnections(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function saveConnectionMeta(values = {}) {
  const configuredPlatforms = Object.entries(values)
    .filter(([, config]) => {
      const handle = config?.handle?.trim?.() ?? '';
      const apiKey = config?.apiKey?.trim?.() ?? '';
      return Boolean(handle || apiKey);
    })
    .map(([platformId]) => platformId);

  const payload = {
    configuredPlatforms,
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(CONNECTION_META_KEY, JSON.stringify(payload));
}

export function loadConnectionMeta() {
  const raw = localStorage.getItem(CONNECTION_META_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.configuredPlatforms)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearEncryptedConnections() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CONNECTION_META_KEY);
}
