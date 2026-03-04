import { getOverviewPayload } from '../_lib/overview.js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const overview = await getOverviewPayload(searchParams);
  if (overview.status !== 200) {
    return new Response(JSON.stringify(overview.payload), { status: overview.status, headers: { 'content-type': 'application/json' } });
  }

  const { payload } = overview;
  const header = 'date,views,downloads,sales,revenue\n';
  const rows = payload.aggregated.timeline
    .map((row) => `${row.date},${row.views},${row.downloads},${row.sales},${row.revenue}`)
    .join('\n');

  return new Response(`${header}${rows}\n`, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="mkrstats-${payload.selectedPlatform}-${payload.generatedAt.slice(0, 10)}.csv"`
    }
  });
}
