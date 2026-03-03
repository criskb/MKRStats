import { PLATFORM_CONFIG } from '../../config/platforms.js';
import { buildMockPlatformSnapshot } from './baseConnector.js';

/**
 * In production, each platform would have a dedicated client that supports:
 * - OAuth token exchange + refresh
 * - Native API calls when available
 * - fallback scraper jobs (queue based) for public pages
 * - per-platform rate limiting + backoff + retries
 */
export async function fetchAllPlatformStats() {
  return Promise.all(
    PLATFORM_CONFIG.map(async (platform) => ({
      ...platform,
      snapshot: buildMockPlatformSnapshot(platform.id)
    }))
  );
}
