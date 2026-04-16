/**
 * In-Memory TTL Cache — Wave M
 *
 * Simple Map + timestamp cache with configurable TTL per key.
 * No Redis required. Deterministic expiration.
 */

type CacheEntry<T> = {
  value: T;
  expiresAtMs: number;
};

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() >= entry.expiresAtMs) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const effectiveTtl = ttlMs ?? this.defaultTtlMs;
    this.store.set(key, {
      value,
      expiresAtMs: Date.now() + effectiveTtl,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Remove all expired entries. Call periodically if cache grows large. */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.expiresAtMs) {
        this.store.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  get size(): number {
    return this.store.size;
  }
}

// ── Pre-configured caches for enterprise use ──────────────────

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

/** DID document cache — 5 minute TTL */
export const didDocumentCache = new TtlCache<Record<string, unknown>>(FIVE_MINUTES_MS);

/** OpenID metadata cache — 5 minute TTL */
export const openIdMetadataCache = new TtlCache<Record<string, unknown>>(FIVE_MINUTES_MS);

/** Enterprise capabilities cache — 1 minute TTL */
export const enterpriseCapabilitiesCache = new TtlCache<Record<string, unknown>>(ONE_MINUTE_MS);

/** Employer manifest cache — 1 minute TTL */
export const manifestCache = new TtlCache<string>(ONE_MINUTE_MS);
