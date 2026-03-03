import { PLATFORM_CONFIG } from '../../config/platforms.js';
import { getConnectionStatuses } from './connectionConfigStore.js';
import { buildMockPlatformSnapshot, isMockFallbackEnabled, normalizeSnapshot } from './baseConnector.js';
import { fetchCults3dSnapshot } from './clients/cults3dClient.js';
import { fetchMakerworldSnapshot } from './clients/makerworldClient.js';
import { fetchThangsSnapshot } from './clients/thangsClient.js';
import { fetchPrintablesSnapshot } from './clients/printablesClient.js';

const CLIENT_BY_PLATFORM = {
  cults3d: fetchCults3dSnapshot,
  makerworld: fetchMakerworldSnapshot,
  thangs: fetchThangsSnapshot,
  printables: fetchPrintablesSnapshot
};

const ACTIVE_STATUSES = new Set(['active', 'connected', 'validated']);

function findActiveConnection(connections, platformId) {
  return connections.find((connection) => connection.platformId === platformId && ACTIVE_STATUSES.has(connection.status));
}

function buildConnectorMetadata({ status, usedMockData = false, error = null, quality = null }) {
  return {
    connector: {
      status,
      usedMockData,
      error
    },
    quality
  };
}

async function fetchPlatformSnapshot(platform, activeConnection) {
  const client = CLIENT_BY_PLATFORM[platform.id];

  if (!activeConnection) {
    const snapshot = normalizeSnapshot(platform.id, { source: 'connector_unavailable', series: [], models: [] });
    return {
      ...platform,
      snapshot,
      metadata: buildConnectorMetadata({
        status: 'error',
        quality: snapshot.quality,
        error: { code: 'NO_ACTIVE_CONNECTION', message: `No active connection configured for ${platform.id}.` }
      })
    };
  }

  if (!client) {
    const snapshot = normalizeSnapshot(platform.id, { source: 'connector_unavailable', series: [], models: [] });
    return {
      ...platform,
      snapshot,
      metadata: buildConnectorMetadata({
        status: 'error',
        quality: snapshot.quality,
        error: { code: 'UNSUPPORTED_PLATFORM', message: `No connector client implemented for ${platform.id}.` }
      })
    };
  }

  try {
    const snapshot = isMockFallbackEnabled()
      ? buildMockPlatformSnapshot(platform.id)
      : await client(activeConnection);

    return {
      ...platform,
      snapshot,
      metadata: buildConnectorMetadata({ status: 'ok', usedMockData: isMockFallbackEnabled(), quality: snapshot.quality })
    };
  } catch (error) {
    const snapshot = normalizeSnapshot(platform.id, { source: 'connector_error', series: [], models: [] });
    return {
      ...platform,
      snapshot,
      metadata: buildConnectorMetadata({
        status: 'error',
        usedMockData: false,
        quality: snapshot.quality,
        error: {
          code: error.code ?? 'CONNECTOR_FAILURE',
          message: error.message
        }
      })
    };
  }
}

export async function fetchAllPlatformStats() {
  const connections = await getConnectionStatuses();

  return Promise.all(
    PLATFORM_CONFIG.map(async (platform) => {
      const activeConnection = findActiveConnection(connections, platform.id);
      return fetchPlatformSnapshot(platform, activeConnection);
    })
  );
}
