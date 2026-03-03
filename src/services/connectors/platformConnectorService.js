import { PLATFORM_CONFIG } from '../../config/platforms.js';
import { getConnectionStatuses } from './connectionConfigStore.js';
import { buildMockPlatformSnapshot, isMockFallbackEnabled, normalizeSnapshot } from './baseConnector.js';
import { getConnectorRegistration } from './registry.js';

const ACTIVE_STATUSES = new Set(['active', 'connected', 'validated']);

function findActiveConnections(connections, platformId) {
  return connections.filter((connection) => connection.platformId === platformId && ACTIVE_STATUSES.has(connection.status));
}

function buildConnectorMetadata({
  status,
  usedMockData = false,
  error = null,
  quality = null,
  accounts = { configured: 0, successful: 0, failed: 0 },
  capabilities = null
}) {
  return {
    connector: {
      status,
      usedMockData,
      error,
      accounts,
      capabilities
    },
    quality
  };
}

function mergeSnapshots(platformId, snapshots = [], source = 'platform_connector_dispatcher') {
  const byDate = new Map();
  const byModel = new Map();

  for (const snapshot of snapshots) {
    for (const row of snapshot.series ?? []) {
      const existing = byDate.get(row.date) ?? {
        date: row.date,
        views: 0,
        downloads: 0,
        likes: 0,
        sales: 0,
        revenue: 0,
        currency: row.currency ?? 'USD'
      };

      existing.views += Number(row.views ?? 0);
      existing.downloads += Number(row.downloads ?? 0);
      existing.likes += Number(row.likes ?? 0);
      existing.sales += Number(row.sales ?? 0);
      existing.revenue = Number((existing.revenue + Number(row.revenue ?? 0)).toFixed(2));
      byDate.set(row.date, existing);
    }

    for (const model of snapshot.models ?? []) {
      const key = String(model.id ?? model.title);
      const existing = byModel.get(key) ?? {
        id: key,
        title: model.title ?? 'Untitled Model',
        downloads: 0,
        likes: 0,
        sales: 0,
        revenue: 0
      };

      existing.downloads += Number(model.downloads ?? 0);
      existing.likes += Number(model.likes ?? 0);
      existing.sales += Number(model.sales ?? 0);
      existing.revenue = Number((existing.revenue + Number(model.revenue ?? 0)).toFixed(2));
      byModel.set(key, existing);
    }
  }

  return normalizeSnapshot(platformId, {
    source,
    fetchedAt: new Date().toISOString(),
    series: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    models: [...byModel.values()].sort((a, b) => b.revenue - a.revenue)
  });
}

async function fetchPlatformSnapshot(platform, activeConnections) {
  const registration = getConnectorRegistration(platform.id);

  if (activeConnections.length === 0) {
    const snapshot = normalizeSnapshot(platform.id, { source: 'connector_unavailable', series: [], models: [] });
    return {
      ...platform,
      snapshot,
      metadata: buildConnectorMetadata({
        status: 'error',
        quality: snapshot.quality,
        error: { code: 'NO_ACTIVE_CONNECTION', message: `No active connection configured for ${platform.id}.` },
        accounts: { configured: 0, successful: 0, failed: 0 },
        capabilities: registration?.capabilities ?? null
      })
    };
  }

  if (!registration?.client) {
    const snapshot = normalizeSnapshot(platform.id, { source: 'connector_unavailable', series: [], models: [] });
    return {
      ...platform,
      snapshot,
      metadata: buildConnectorMetadata({
        status: 'error',
        quality: snapshot.quality,
        error: { code: 'UNSUPPORTED_PLATFORM', message: `No connector client implemented for ${platform.id}.` },
        accounts: { configured: activeConnections.length, successful: 0, failed: activeConnections.length },
        capabilities: registration?.capabilities ?? null
      })
    };
  }

  const useMockData = isMockFallbackEnabled();

  try {
    if (useMockData) {
      const snapshot = buildMockPlatformSnapshot(platform.id);
      return {
        ...platform,
        snapshot,
        metadata: buildConnectorMetadata({
          status: 'ok',
          usedMockData: true,
          quality: snapshot.quality,
          accounts: {
            configured: activeConnections.length,
            successful: activeConnections.length,
            failed: 0
          },
          capabilities: registration.capabilities
        })
      };
    }

    const settled = await Promise.allSettled(activeConnections.map((connection) => registration.client(connection)));
    const successfulSnapshots = settled
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
    const failedSnapshots = settled.filter((result) => result.status === 'rejected');

    if (successfulSnapshots.length === 0) {
      const firstError = failedSnapshots[0]?.reason;
      throw firstError ?? new Error('No connector snapshots were returned.');
    }

    const snapshot = mergeSnapshots(platform.id, successfulSnapshots, `${platform.id}_account_dispatcher`);

    return {
      ...platform,
      snapshot,
      metadata: buildConnectorMetadata({
        status: failedSnapshots.length > 0 ? 'partial' : 'ok',
        usedMockData: false,
        quality: snapshot.quality,
        accounts: {
          configured: activeConnections.length,
          successful: successfulSnapshots.length,
          failed: failedSnapshots.length
        },
        capabilities: registration.capabilities,
        error: failedSnapshots.length > 0
          ? {
            code: 'PARTIAL_CONNECTOR_FAILURE',
            message: `${failedSnapshots.length} account connection(s) failed while collecting ${platform.id}.`
          }
          : null
      })
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
        capabilities: registration.capabilities,
        accounts: { configured: activeConnections.length, successful: 0, failed: activeConnections.length },
        error: {
          code: error.code ?? 'CONNECTOR_FAILURE',
          message: error.message
        }
      })
    };
  }
}

function logConnectorEvent(event, payload = {}) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    level: 'info',
    event,
    ts: new Date().toISOString(),
    ...payload
  }));
}

export async function fetchAllPlatformStats({ correlationId = null, runId = null } = {}) {
  logConnectorEvent('collection.connector_batch.started', { correlationId, runId });
  const connections = await getConnectionStatuses({ includeCredentials: true });

  const platformStats = await Promise.all(
    PLATFORM_CONFIG.map(async (platform) => {
      const activeConnections = findActiveConnections(connections, platform.id);
      logConnectorEvent('collection.connector.started', {
        correlationId,
        runId,
        platformId: platform.id,
        activeConnectionCount: activeConnections.length
      });

      const startedAt = Date.now();
      const result = await fetchPlatformSnapshot(platform, activeConnections);
      logConnectorEvent('collection.connector.completed', {
        correlationId,
        runId,
        platformId: platform.id,
        durationMs: Date.now() - startedAt,
        status: result.metadata?.connector?.status ?? 'unknown',
        errorCode: result.metadata?.connector?.error?.code ?? null
      });
      return result;
    })
  );

  logConnectorEvent('collection.connector_batch.completed', {
    correlationId,
    runId,
    platformCount: platformStats.length
  });

  return platformStats;
}
