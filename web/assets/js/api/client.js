function queryString(params) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) {
        query.set(key, value.join(','));
      }
      continue;
    }
    query.set(key, String(value));
  }

  return query.toString();
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function getPlatforms() {
  const response = await fetch('/api/platforms');
  if (!response.ok) {
    throw new Error(`Failed to fetch platforms: ${response.status}`);
  }
  return response.json();
}

export async function getOverview(params = { platform: 'all', horizon: 14 }) {
  const response = await fetch(`/api/overview?${queryString(params)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch overview: ${response.status}`);
  }
  return response.json();
}

export async function saveConnections(connections = {}) {
  const response = await fetch('/api/connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connections })
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const detail = payload?.message ? `: ${payload.message}` : '';
    throw new Error(`Failed to save connection: ${response.status}${detail}`);
  }

  return payload;
}

export function getExportUrl(params = { platform: 'all', horizon: 14 }) {
  return `/api/export.csv?${queryString(params)}`;
}
