const DEFAULT_POLICY = {
  maxConcurrency: Number(process.env.MKRSTATS_COLLECTION_MAX_CONCURRENCY ?? 2),
  minDelayMs: Number(process.env.MKRSTATS_COLLECTION_MIN_DELAY_MS ?? 250),
  maxRetries: Number(process.env.MKRSTATS_COLLECTION_MAX_RETRIES ?? 3)
};

const PLATFORM_POLICIES = {
  cults3d: {
    maxConcurrency: Number(process.env.MKRSTATS_CULTS3D_MAX_CONCURRENCY ?? 1),
    minDelayMs: Number(process.env.MKRSTATS_CULTS3D_MIN_DELAY_MS ?? 350),
    maxRetries: Number(process.env.MKRSTATS_CULTS3D_MAX_RETRIES ?? DEFAULT_POLICY.maxRetries)
  },
  makerworld: {
    maxConcurrency: Number(process.env.MKRSTATS_MAKERWORLD_MAX_CONCURRENCY ?? 2),
    minDelayMs: Number(process.env.MKRSTATS_MAKERWORLD_MIN_DELAY_MS ?? 250),
    maxRetries: Number(process.env.MKRSTATS_MAKERWORLD_MAX_RETRIES ?? DEFAULT_POLICY.maxRetries)
  },
  thangs: {
    maxConcurrency: Number(process.env.MKRSTATS_THANGS_MAX_CONCURRENCY ?? 2),
    minDelayMs: Number(process.env.MKRSTATS_THANGS_MIN_DELAY_MS ?? 250),
    maxRetries: Number(process.env.MKRSTATS_THANGS_MAX_RETRIES ?? DEFAULT_POLICY.maxRetries)
  },
  printables: {
    maxConcurrency: Number(process.env.MKRSTATS_PRINTABLES_MAX_CONCURRENCY ?? 2),
    minDelayMs: Number(process.env.MKRSTATS_PRINTABLES_MIN_DELAY_MS ?? 250),
    maxRetries: Number(process.env.MKRSTATS_PRINTABLES_MAX_RETRIES ?? DEFAULT_POLICY.maxRetries)
  }
};

function sanitizePolicy(policy) {
  return {
    maxConcurrency: Math.max(1, Number(policy.maxConcurrency) || DEFAULT_POLICY.maxConcurrency),
    minDelayMs: Math.max(0, Number(policy.minDelayMs) || DEFAULT_POLICY.minDelayMs),
    maxRetries: Math.max(0, Number(policy.maxRetries) || DEFAULT_POLICY.maxRetries)
  };
}

export function getPlatformPolicy(platformId) {
  return sanitizePolicy(PLATFORM_POLICIES[platformId] ?? DEFAULT_POLICY);
}
