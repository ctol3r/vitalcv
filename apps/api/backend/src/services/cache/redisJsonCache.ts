/**
 * redisJsonCache.ts — In-memory JSON cache stub
 *
 * Provides a cache interface for the mobile trust routes.
 * TODO: Replace with actual Redis implementation in production.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface JsonCache {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

// ── In-Memory Implementation ──────────────────────────────────────────────

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

class InMemoryJsonCache implements JsonCache {
  private store = new Map<string, CacheEntry>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

export const redisJsonCache: JsonCache = new InMemoryJsonCache();
