function queryString(params) {
  const query = new URLSearchParams(params);
  return query.toString();
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

export function getExportUrl(params = { platform: 'all', horizon: 14 }) {
  return `/api/export.csv?${queryString(params)}`;
}
