/**
 * B149A-FF-002: Feature flag evaluation service with cache
 *
 * Provides getFlag(key, {orgId, userId}) that returns resolved value
 * with precedence: org → user → global
 * Results cached per process for N seconds
 */

type FeatureFlagRecord = {
  key: string;
  defaultValue: unknown;
};

type OrgFeatureFlagRecord = {
  value: unknown;
};

type UserFeatureFlagRecord = {
  value: unknown;
};

// Minimal Prisma client shape to avoid hard dependency on generated types.
type PrismaClient = {
  featureFlag: {
    findUnique: (args: { where: { key: string } }) => Promise<FeatureFlagRecord | null>;
    findMany: (args: { orderBy: { key: 'asc' | 'desc' } }) => Promise<FeatureFlagRecord[]>;
  };
  orgFeatureFlag: {
    findUnique: (args: {
      where: { orgId_flagKey: { orgId: string; flagKey: string } };
    }) => Promise<OrgFeatureFlagRecord | null>;
  };
  userFeatureFlag: {
    findUnique: (args: {
      where: { userId_flagKey: { userId: string; flagKey: string } };
    }) => Promise<UserFeatureFlagRecord | null>;
  };
};

export interface FlagContext {
  orgId?: string;
  userId?: string;
}

export interface FlagValue {
  value: any;
  source: 'org' | 'user' | 'global';
  flagKey: string;
}

// In-memory cache with TTL
interface CacheEntry {
  value: any;
  source: 'org' | 'user' | 'global';
  expiresAt: number;
}

const CACHE_TTL_SECONDS = 60; // Cache for 60 seconds
const cache = new Map<string, CacheEntry>();

/**
 * Generate cache key from flag key and context
 */
function getCacheKey(flagKey: string, context: FlagContext): string {
  return `${flagKey}:${context.orgId || 'none'}:${context.userId || 'none'}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() < entry.expiresAt;
}

/**
 * Get feature flag value with precedence: org → user → global
 */
export async function getFlag(
  prisma: PrismaClient,
  flagKey: string,
  context: FlagContext = {},
): Promise<FlagValue> {
  // Check cache first
  const cacheKey = getCacheKey(flagKey, context);
  const cached = cache.get(cacheKey);
  if (cached && isCacheValid(cached)) {
    return {
      value: cached.value,
      source: cached.source,
      flagKey,
    };
  }

  // Fetch flag definition
  const flag = await prisma.featureFlag.findUnique({
    where: { key: flagKey },
  });

  if (!flag) {
    throw new Error(`Feature flag '${flagKey}' not found`);
  }

  let value: any = flag.defaultValue;
  let source: 'org' | 'user' | 'global' = 'global';

  // Check org override (highest precedence)
  if (context.orgId) {
    const orgOverride = await prisma.orgFeatureFlag.findUnique({
      where: {
        orgId_flagKey: {
          orgId: context.orgId,
          flagKey,
        },
      },
    });

    if (orgOverride) {
      value = orgOverride.value;
      source = 'org';
    }
  }

  // Check user override (second precedence, only if no org override)
  if (source === 'global' && context.userId) {
    const userOverride = await prisma.userFeatureFlag.findUnique({
      where: {
        userId_flagKey: {
          userId: context.userId,
          flagKey,
        },
      },
    });

    if (userOverride) {
      value = userOverride.value;
      source = 'user';
    }
  }

  // Store in cache
  cache.set(cacheKey, {
    value,
    source,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  });

  return {
    value,
    source,
    flagKey,
  };
}

/**
 * Clear cache for a specific flag (or all flags if key not provided)
 */
export function clearCache(flagKey?: string): void {
  if (flagKey) {
    // Remove all cache entries for this flag key
    const keysToDelete: string[] = [];
    for (const key of cache.keys()) {
      if (key.startsWith(`${flagKey}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => cache.delete(key));
  } else {
    // Clear entire cache
    cache.clear();
  }
}

/**
 * Get all flags with their current values for a context
 */
export async function getAllFlags(
  prisma: PrismaClient,
  context: FlagContext = {},
): Promise<FlagValue[]> {
  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: 'asc' },
  });

  const results = await Promise.all(flags.map((flag) => getFlag(prisma, flag.key, context)));

  return results;
}
