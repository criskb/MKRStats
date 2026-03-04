'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header.js';

const SECURE_KEY = 'mkrstats_secure_connections_v1';
const PLAIN_KEY = 'mkrstats_plain_connections_v1';

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.message ?? String(response.status));
  return payload;
}

function toBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function deriveKey(passphrase, salt) {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptPayload(payload, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { salt: toBase64(salt), iv: toBase64(iv), cipher: toBase64(cipher) };
}

async function decryptPayload(encrypted, passphrase) {
  const salt = fromBase64(encrypted.salt);
  const iv = fromBase64(encrypted.iv);
  const cipher = fromBase64(encrypted.cipher);
  const key = await deriveKey(passphrase, salt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

export default function ProfilePage() {
  const [platforms, setPlatforms] = useState([]);
  const [form, setForm] = useState({});
  const [status, setStatus] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    Promise.all([jsonFetch('/api/platforms'), jsonFetch('/api/connections')])
      .then(([platformPayload, connectionPayload]) => {
        setPlatforms(platformPayload.platforms ?? []);
        setConnections(connectionPayload.connections ?? []);

        const initial = {};
        for (const p of platformPayload.platforms ?? []) {
          initial[p.id] = { handle: '', apiKey: '' };
        }

        const plainRaw = localStorage.getItem(PLAIN_KEY);
        if (plainRaw) {
          try {
            const parsed = JSON.parse(plainRaw);
            if (parsed?.values) {
              setForm({ ...initial, ...parsed.values });
              setStatus(`Loaded plain saved settings (${parsed.updatedAt ?? 'unknown time'}).`);
              return;
            }
          } catch {
            // ignore malformed local payload
          }
        }

        setForm(initial);
      })
      .catch((error) => setStatus(`Failed to load profile context: ${error.message}`));
  }, []);

  const configuredCount = useMemo(
    () => Object.values(form).filter((row) => row?.handle?.trim?.() || row?.apiKey?.trim?.()).length,
    [form]
  );

  const onSave = async (event) => {
    event.preventDefault();

    try {
      if (passphrase.trim()) {
        const encrypted = await encryptPayload({ values: form, updatedAt: new Date().toISOString() }, passphrase.trim());
        localStorage.setItem(SECURE_KEY, JSON.stringify(encrypted));
        localStorage.removeItem(PLAIN_KEY);
      } else {
        localStorage.setItem(PLAIN_KEY, JSON.stringify({ values: form, updatedAt: new Date().toISOString() }));
        localStorage.removeItem(SECURE_KEY);
      }

      await jsonFetch('/api/connections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connections: form })
      });

      const connectionPayload = await jsonFetch('/api/connections');
      setConnections(connectionPayload.connections ?? []);
      setStatus(`Connections saved (${configuredCount} configured).`);
    } catch (error) {
      setStatus(`Save failed: ${error.message}`);
    }
  };

  const onLoadSaved = async () => {
    const secureRaw = localStorage.getItem(SECURE_KEY);
    if (secureRaw) {
      if (!passphrase.trim()) {
        setStatus('Enter passphrase to decrypt saved settings.');
        return;
      }
      try {
        const decrypted = await decryptPayload(JSON.parse(secureRaw), passphrase.trim());
        if (decrypted?.values) {
          setForm((prev) => ({ ...prev, ...decrypted.values }));
          setStatus(`Encrypted settings loaded (${decrypted.updatedAt ?? 'unknown time'}).`);
          return;
        }
      } catch {
        setStatus('Could not decrypt saved settings (wrong passphrase?).');
        return;
      }
    }

    const plainRaw = localStorage.getItem(PLAIN_KEY);
    if (plainRaw) {
      try {
        const parsed = JSON.parse(plainRaw);
        if (parsed?.values) {
          setForm((prev) => ({ ...prev, ...parsed.values }));
          setStatus(`Plain settings loaded (${parsed.updatedAt ?? 'unknown time'}).`);
          return;
        }
      } catch {
        setStatus('Saved plain settings are corrupted.');
        return;
      }
    }

    setStatus('No saved local settings found.');
  };

  return (
    <>
      <Header
        title="MKRStats Profile"
        subtitle="Configure platform handles and API keys."
        current="profile"
      />

      <main className="dashboard-grid">
        <section className="widget col-8">
          <header className="widget__header">Connection Settings</header>
          <div className="widget__content">
            <form className="profile-form" onSubmit={onSave}>
              <label className="control-field">
                <span>Master passphrase (optional, only for local encrypted storage)</span>
                <input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} type="password" />
              </label>

              {platforms.map((platform) => (
                <div className="profile-row" key={platform.id}>
                  <h3>{platform.name}</h3>
                  <label>Handle / nickname
                    <input
                      value={form[platform.id]?.handle ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [platform.id]: { ...prev[platform.id], handle: e.target.value } }))}
                    />
                  </label>
                  <label>API key / token
                    <input
                      type="password"
                      value={form[platform.id]?.apiKey ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [platform.id]: { ...prev[platform.id], apiKey: e.target.value } }))}
                    />
                  </label>
                </div>
              ))}

              <div className="control-actions">
                <button className="button-primary" type="submit">Save settings</button>
                <button className="button-secondary" type="button" onClick={onLoadSaved}>Load saved settings</button>
              </div>

              <p className="security-note">{status}</p>
            </form>
          </div>
        </section>

        <section className="widget col-4">
          <header className="widget__header">Saved connections</header>
          <div className="widget__content">
            {!connections.length && <p className="security-note">No server-side connections saved yet.</p>}
            {!!connections.length && (
              <table className="table">
                <thead><tr><th>Platform</th><th>Account</th><th>Status</th></tr></thead>
                <tbody>
                  {connections.map((row) => (
                    <tr key={`${row.platformId}:${row.accountId}`}>
                      <td>{row.platformId}</td>
                      <td>{row.accountId}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
