export async function getOverview() {
  const response = await fetch('/api/overview');
  if (!response.ok) {
    throw new Error(`Failed to fetch overview: ${response.status}`);
  }
  return response.json();
}
