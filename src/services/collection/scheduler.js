import { isoDay } from '../../utils/date.js';
import { runCollectionCycle } from './runCollectionCycle.js';

const FETCH_INTERVAL_MS = Number(process.env.MKRSTATS_COLLECTION_INTERVAL_MS ?? 5 * 60 * 1000);

export function startCollectionScheduler() {
  let running = false;
  let stopped = false;
  let lastRollupDate = null;
  let timer = null;

  const tick = async () => {
    if (running || stopped) return;
    running = true;

    try {
      await runCollectionCycle({ runType: 'scheduled_fetch', scheduleIntervalMs: FETCH_INTERVAL_MS });

      const today = isoDay(new Date());
      if (lastRollupDate !== today) {
        lastRollupDate = today;
        await runCollectionCycle({ runType: 'daily_rollup', scheduleIntervalMs: FETCH_INTERVAL_MS });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Collection scheduler cycle failed:', error.message);
    } finally {
      running = false;
    }
  };

  const start = () => {
    tick();
    timer = setInterval(tick, FETCH_INTERVAL_MS);
    timer.unref?.();
  };

  const stop = async () => {
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    while (running) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  start();
  return { stop };
}
