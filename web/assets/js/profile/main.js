import { getPlatforms, saveConnections } from '../api/client.js';
import {
  encryptPayload,
  decryptPayload,
  loadEncryptedConnections,
  saveEncryptedConnections,
  loadPlainConnections,
  savePlainConnections,
  saveConnectionMeta,
  clearEncryptedConnections
} from './secureStore.js';

function renderForm(root, platforms, values = {}) {
  const rows = platforms
    .map((platform) => {
      const current = values[platform.id] ?? { handle: '', apiKey: '' };
      return `
      <div class="profile-row">
        <h3>${platform.name}</h3>
        <label>
          Handle / nickname
          <input name="${platform.id}__handle" value="${current.handle}" autocomplete="off" />
        </label>
        <label>
          API key / token
          <input name="${platform.id}__apiKey" type="password" value="${current.apiKey}" autocomplete="new-password" />
        </label>
      </div>
    `;
    })
    .join('');

  root.innerHTML = `
    <form id="profile-form" class="profile-form">
      <label class="control-field">
        <span>Master passphrase (optional — leave blank to store settings unencrypted in this browser)</span>
        <input id="master-passphrase" type="password" autocomplete="new-password" />
      </label>

      ${rows}

      <div class="control-actions">
        <button type="submit" class="button-primary">Save Settings</button>
        <button id="unlock-btn" type="button" class="button-secondary">Load Saved Settings</button>
      </div>

      <button id="clear-btn" type="button" class="button-danger">Clear Stored Data</button>
      <p id="status" class="security-note"></p>
    </form>
  `;
}

function collectValues(form, platforms) {
  const result = {};

  for (const platform of platforms) {
    result[platform.id] = {
      handle: form[`${platform.id}__handle`].value,
      apiKey: form[`${platform.id}__apiKey`].value
    };
  }

  return result;
}

function applyValues(form, values, platforms) {
  for (const platform of platforms) {
    const current = values[platform.id] ?? { handle: '', apiKey: '' };
    form[`${platform.id}__handle`].value = current.handle;
    form[`${platform.id}__apiKey`].value = current.apiKey;
  }
}

function countConfigured(values) {
  return Object.values(values).filter((row) => row.handle?.trim?.() || row.apiKey?.trim?.()).length;
}

async function syncConnectionsRemote(values) {
  try {
    await saveConnections(values);
    return { ok: true, message: '' };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}


function loadAnySavedValues() {
  const encrypted = loadEncryptedConnections();
  if (encrypted) return { mode: 'encrypted', payload: encrypted };
  const plain = loadPlainConnections();
  if (plain?.values) return { mode: 'plain', payload: plain };
  return null;
}

async function initProfile() {
  const root = document.querySelector('#profile-root');
  const status = (message, isError = false) => {
    const target = document.querySelector('#status');
    if (!target) return;
    target.textContent = message;
    target.style.color = isError ? '#ff9b9b' : '#aeb8c8';
  };

  try {
    const { platforms } = await getPlatforms();
    renderForm(root, platforms);

    const form = document.querySelector('#profile-form');
    const passphraseInput = document.querySelector('#master-passphrase');

    const existing = loadAnySavedValues();
    if (existing?.mode === 'plain') {
      applyValues(form, existing.payload.values ?? {}, platforms);
      status(`Loaded plain saved settings from ${existing.payload.updatedAt ?? 'unknown time'}.`);
    } else if (existing?.mode === 'encrypted') {
      status('Encrypted settings found. Enter passphrase and click "Load Saved Settings".');
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      try {
        const values = collectValues(form, platforms);
        if (passphraseInput.value) {
          const encrypted = await encryptPayload({ values, updatedAt: new Date().toISOString() }, passphraseInput.value);
          saveEncryptedConnections(encrypted);
        } else {
          savePlainConnections(values);
        }
        saveConnectionMeta(values);

        const remote = await syncConnectionsRemote(values);
        const configured = countConfigured(values);
        const remoteNote = remote.ok ? 'Server sync complete.' : `Server sync warning: ${remote.message}`;
        const localMode = passphraseInput.value ? 'encrypted' : 'plain';
        status(`Settings saved (${localMode}) in localStorage. ${configured} platform(s) configured for Our Stats scope. ${remoteNote}`);
      } catch (error) {
        status(`Unable to save settings: ${error.message}`, true);
      }
    });

    document.querySelector('#unlock-btn').addEventListener('click', async () => {
      const encrypted = loadEncryptedConnections();
      if (encrypted) {
        if (!passphraseInput.value) {
          status('Enter passphrase to decrypt saved settings.', true);
          return;
        }

        try {
          const payload = await decryptPayload(encrypted, passphraseInput.value);
          const values = payload.values ?? {};
          applyValues(form, values, platforms);
          saveConnectionMeta(values);

          const remote = await syncConnectionsRemote(values);
          const configured = countConfigured(values);
          const remoteNote = remote.ok ? 'Server sync complete.' : `Server sync warning: ${remote.message}`;

          status(
            `Encrypted settings loaded and scope metadata synced (${configured} configured). ${remoteNote} Last updated: ${payload.updatedAt ?? 'unknown'}`
          );
          return;
        } catch {
          status('Decryption failed. Check passphrase.', true);
          return;
        }
      }

      const plain = loadPlainConnections();
      if (plain?.values) {
        applyValues(form, plain.values, platforms);
        saveConnectionMeta(plain.values);
        status(`Plain settings loaded. Last updated: ${plain.updatedAt ?? 'unknown'}`);
        return;
      }

      status('No saved settings found.');
    });

    document.querySelector('#clear-btn').addEventListener('click', () => {
      clearEncryptedConnections();
      form.reset();
      status('Stored settings removed from this browser.');
    });
  } catch (error) {
    root.innerHTML = `Failed to load settings page: ${error.message}`;
  }
}

initProfile();
