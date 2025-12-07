import { LocalDataStoreService } from '../models/LocalDataStore';

export interface CacheEntry {
  url: string;
  data: any;
  timestamp: number;
  headers?: Record<string, string>;
}

export interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
}

/**
 * OfflineCacheService manages caching of API responses and static assets
 * Uses least-recently-used (LRU) policy for eviction
 */
export class OfflineCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // For LRU tracking
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(
    private localDataStore: LocalDataStoreService,
    options: CacheOptions = {}
  ) {
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 24 * 60 * 60 * 1000; // Default 24 hours
  }

  /**
   * Cache a resource (API response or static asset)
   */
  async cacheResource(url: string, data: any, headers?: Record<string, string>): Promise<void> {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      await this.evictLRU();
    }

    const entry: CacheEntry = {
      url,
      data,
      timestamp: Date.now(),
      headers,
    };

    this.cache.set(url, entry);
    this.updateAccessOrder(url);

    // Persist to local data store
    await this.localDataStore.save({
      key: url,
      value: JSON.stringify(entry),
      entityType: 'cache',
    });
  }

  /**
   * Retrieve a cached resource
   */
  async getCached(url: string): Promise<any | null> {
    // Check in-memory cache first
    let entry = this.cache.get(url);

    // If not in memory, try loading from local data store
    if (!entry) {
      const stored = await this.localDataStore.get(url, 'cache');
      if (stored) {
        try {
          entry = JSON.parse(stored.value);
          this.cache.set(url, entry);
        } catch (e) {
          // Invalid cache entry, remove it
          await this.localDataStore.delete(url, 'cache');
          return null;
        }
      }
    }

    if (!entry) {
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > this.ttl) {
      await this.uncacheResource(url);
      return null;
    }

    this.updateAccessOrder(url);
    return entry.data;
  }

  /**
   * Remove a resource from cache
   */
  async uncacheResource(url: string): Promise<void> {
    this.cache.delete(url);
    const index = this.accessOrder.indexOf(url);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    await this.localDataStore.delete(url, 'cache');
  }

  /**
   * Clear all cached resources
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
    await this.localDataStore.clear(undefined, 'cache');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    entries: string[];
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Evict least recently used entry
   */
  private async evictLRU(): Promise<void> {
    if (this.accessOrder.length === 0) {
      return;
    }

    const lruUrl = this.accessOrder[0];
    await this.uncacheResource(lruUrl);
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(url: string): void {
    const index = this.accessOrder.indexOf(url);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(url);
  }

  /**
   * Load cache from local data store on initialization
   */
  async loadFromStore(): Promise<void> {
    const entries = await this.localDataStore.query({ entityType: 'cache' });
    const now = Date.now();

    for (const stored of entries) {
      try {
        const entry: CacheEntry = JSON.parse(stored.value);
        const age = now - entry.timestamp;

        // Only load non-expired entries
        if (age <= this.ttl) {
          this.cache.set(stored.key, entry);
          this.updateAccessOrder(stored.key);
        } else {
          // Remove expired entries
          await this.localDataStore.delete(stored.key, 'cache');
        }
      } catch (e) {
        // Invalid entry, remove it
        await this.localDataStore.delete(stored.key, 'cache');
      }
    }
  }
}

