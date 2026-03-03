import { initializeStorage } from '../src/services/storage/index.js';
import { runCollectionCycle } from '../src/services/collection/runCollectionCycle.js';

const requestedDays = Number(process.argv[2] ?? process.env.MKRSTATS_BACKFILL_DAYS ?? 30);
const days = Number.isFinite(requestedDays) ? Math.max(1, Math.floor(requestedDays)) : 30;

async function main() {
  await initializeStorage();
  const result = await runCollectionCycle({ runType: 'backfill', daysBack: days });
  // eslint-disable-next-line no-console
  console.log(`Backfill complete for ${days} day(s):`, result);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Backfill failed:', error);
  process.exitCode = 1;
});
