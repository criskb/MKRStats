import { isoDay } from '../../utils/date.js';
import { runCollectionCycle } from './runCollectionCycle.js';

const FETCH_INTERVAL_MS = 5 * 60 * 1000;

export function startCollectionScheduler() {
  let running = false;
  let lastRollupDate = null;

  const tick = async () => {
    if (running) return;
    running = true;

    try {
      await runCollectionCycle({ runType: 'scheduled_fetch' });

      const today = isoDay(new Date());
      if (lastRollupDate !== today) {
        lastRollupDate = today;
        await runCollectionCycle({ runType: 'daily_rollup' });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Collection scheduler cycle failed:', error.message);
    } finally {
      running = false;
    }
  };

  tick();
  const timer = setInterval(tick, FETCH_INTERVAL_MS);
  timer.unref?.();
  return timer;
}
