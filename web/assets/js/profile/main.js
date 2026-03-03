import { getPlatforms, upsertConnection } from '../api/client.js';
import {
  encryptPayload,
  decryptPayload,
  loadEncryptedConnections,
  saveEncryptedConnections,
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
        <span>Master passphrase (required to encrypt/decrypt)</span>
        <input id="master-passphrase" type="password" autocomplete="new-password" required />
      </label>

      ${rows}

      <div class="control-actions">
        <button type="submit" class="button-primary">Save Encrypted Settings</button>
        <button id="unlock-btn" type="button" class="button-secondary">Unlock Saved Settings</button>
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

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!passphraseInput.value) {
        status('Passphrase is required.', true);
        return;
      }

      try {
        const values = collectValues(form, platforms);
        const encrypted = await encryptPayload({ values, updatedAt: new Date().toISOString() }, passphraseInput.value);
        saveEncryptedConnections(encrypted);
        saveConnectionMeta(values);

        const upserts = Object.entries(values)
          .map(([platformId, config]) => {
            const accountId = config.handle?.trim?.() || 'default';
            const apiKey = config.apiKey?.trim?.() || '';
            const handle = config.handle?.trim?.() || '';

            if (!handle && !apiKey) {
              return null;
            }

            return upsertConnection({
              platformId,
              accountId,
              authType: 'apiKey',
              credential: {
                handle,
                apiKey
              },
              status: apiKey ? 'active' : 'pending',
              lastValidatedAt: null,
              lastError: null
            });
          })
          .filter(Boolean);

        await Promise.all(upserts);

        const configured = Object.values(values).filter((row) => row.handle?.trim?.() || row.apiKey?.trim?.()).length;
        status(`Settings saved. ${configured} platform(s) encrypted in browser and synced to backend.`);
      } catch (error) {
        status(`Unable to save settings: ${error.message}`, true);
      }
    });

    document.querySelector('#unlock-btn').addEventListener('click', async () => {
      const encrypted = loadEncryptedConnections();
      if (!encrypted) {
        status('No encrypted settings found.');
        return;
      }

      if (!passphraseInput.value) {
        status('Enter passphrase to decrypt saved settings.', true);
        return;
      }

      try {
        const payload = await decryptPayload(encrypted, passphraseInput.value);
        const values = payload.values ?? {};
        applyValues(form, values, platforms);
        saveConnectionMeta(values);
        const configured = Object.values(values).filter((row) => row.handle?.trim?.() || row.apiKey?.trim?.()).length;
        status(`Settings decrypted and scope metadata synced (${configured} configured). Last updated: ${payload.updatedAt ?? 'unknown'}`);
      } catch {
        status('Decryption failed. Check passphrase.', true);
      }
    });

    document.querySelector('#clear-btn').addEventListener('click', () => {
      clearEncryptedConnections();
      form.reset();
      status('Encrypted settings removed from this browser.');
    });
  } catch (error) {
    root.innerHTML = `Failed to load settings page: ${error.message}`;
  }
}

initProfile();
