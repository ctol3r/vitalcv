/**
 * B144A-PERF-005: NPI+CAQH Lookup Cache (LRU)
 * In-memory LRU cache for recent NPI and CAQH lookups
 * With configurable TTL and automatic eviction
 */

import { Counter, Gauge, Histogram } from 'prom-client';

// Prometheus metrics
const cacheHits = new Counter({
  name: 'npi_caqh_cache_hits_total',
  help: 'Total number of NPI/CAQH cache hits',
  labelNames: ['lookup_type'],
});

const cacheMisses = new Counter({
  name: 'npi_caqh_cache_misses_total',
  help: 'Total number of NPI/CAQH cache misses',
  labelNames: ['lookup_type'],
});

const cacheEvictions = new Counter({
  name: 'npi_caqh_cache_evictions_total',
  help: 'Total number of cache evictions',
});

const cacheSize = new Gauge({
  name: 'npi_caqh_cache_size',
  help: 'Current number of items in cache',
});

const lookupDuration = new Histogram({
  name: 'npi_caqh_lookup_duration_seconds',
  help: 'Duration of NPI/CAQH lookups',
  labelNames: ['source', 'cached'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export interface CacheConfig {
  maxSize?: number; // Maximum cache entries
  ttl?: number; // Time to live in milliseconds (default: 24 hours)
  maxStaleTime?: number; // Maximum time before forced refresh (default: 7 days)
  enableMetrics?: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface NPIData {
  npi: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  specialty?: string;
  taxonomyCode?: string;
  licenseNumber?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  enumerationDate?: string;
  lastUpdated?: string;
}

export interface CAQHData {
  caqhId: string;
  npi?: string;
  status?: string;
  attestationDate?: string;
  expirationDate?: string;
  practiceLocations?: any[];
  educationTraining?: any[];
  workHistory?: any[];
  professionalLiability?: any[];
  lastUpdated?: string;
}

/**
 * LRU Cache implementation with TTL and automatic eviction
 */
export class LRUCache<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private config: Required<CacheConfig>;

  constructor(config: CacheConfig = {}) {
    this.cache = new Map();
    this.config = {
      maxSize: config.maxSize || 10000, // Cache 10k entries by default
      ttl: config.ttl || 24 * 60 * 60 * 1000, // 24 hours
      maxStaleTime: config.maxStaleTime || 7 * 24 * 60 * 60 * 1000, // 7 days
      enableMetrics: config.enableMetrics !== false,
    };

    // Periodic cleanup
    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   */
  get(key: string, lookupType: string = 'generic'): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.config.enableMetrics) {
        cacheMisses.inc({ lookup_type: lookupType });
      }
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if entry is stale
    if (age > this.config.maxStaleTime) {
      this.cache.delete(key);
      if (this.config.enableMetrics) {
        cacheMisses.inc({ lookup_type: lookupType });
        cacheSize.set(this.cache.size);
      }
      return null;
    }

    // Check TTL
    if (age > this.config.ttl) {
      this.cache.delete(key);
      if (this.config.enableMetrics) {
        cacheMisses.inc({ lookup_type: lookupType });
        cacheSize.set(this.cache.size);
      }
      return null;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessed = now;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    if (this.config.enableMetrics) {
      cacheHits.inc({ lookup_type: lookupType });
    }

    return entry.data;
  }

  /**
   * Set value in cache
   */
  set(key: string, data: T): void {
    const now = Date.now();

    // If cache is full, evict LRU entry
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
    };

    this.cache.set(key, entry);

    if (this.config.enableMetrics) {
      cacheSize.set(this.cache.size);
    }
  }

  /**
   * Check if key exists and is not stale
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    if (age > this.config.ttl) {
      this.cache.delete(key);
      if (this.config.enableMetrics) {
        cacheSize.set(this.cache.size);
      }
      return false;
    }

    return true;
  }

  /**
   * Delete key from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted && this.config.enableMetrics) {
      cacheSize.set(this.cache.size);
    }
    return deleted;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    if (this.config.enableMetrics) {
      cacheSize.set(0);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const entry of this.cache.values()) {
      if (oldest === null || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
      if (newest === null || entry.timestamp > newest) {
        newest = entry.timestamp;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    // First entry is least recently used
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      if (this.config.enableMetrics) {
        cacheEvictions.inc();
        cacheSize.set(this.cache.size);
      }
    }
  }

  /**
   * Clean up stale entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > this.config.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0 && this.config.enableMetrics) {
      cacheSize.set(this.cache.size);
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private cleanupTimer: NodeJS.Timeout | null = null;

  private startCleanupTimer(): void {
    // Run cleanup every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // Don't block Node.js exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

/**
 * NPI-specific cache with lookup helpers
 */
export class NPICache extends LRUCache<NPIData> {
  constructor(config?: CacheConfig) {
    super({
      ...config,
      maxSize: config?.maxSize || 5000, // Cache 5k NPIs
      ttl: config?.ttl || 24 * 60 * 60 * 1000, // 24 hours
    });
  }

  /**
   * Get NPI data with metrics tracking
   */
  async getNPI(npi: string, fetchFn?: () => Promise<NPIData>): Promise<NPIData | null> {
    const startTime = Date.now();

    // Try cache first
    const cached = this.get(npi, 'npi');
    if (cached) {
      lookupDuration.observe(
        { source: 'npi', cached: 'true' },
        (Date.now() - startTime) / 1000
      );
      return cached;
    }

    // Fetch if function provided
    if (fetchFn) {
      try {
        const data = await fetchFn();
        this.set(npi, data);
        lookupDuration.observe(
          { source: 'npi', cached: 'false' },
          (Date.now() - startTime) / 1000
        );
        return data;
      } catch (error) {
        console.error(`[NPICache] Error fetching NPI ${npi}:`, error);
        throw error;
      }
    }

    return null;
  }

  /**
   * Batch get NPIs
   */
  async getBatch(npis: string[]): Promise<Map<string, NPIData | null>> {
    const results = new Map<string, NPIData | null>();

    for (const npi of npis) {
      const data = this.get(npi, 'npi');
      results.set(npi, data);
    }

    return results;
  }

  /**
   * Invalidate NPI (force refresh on next lookup)
   */
  invalidate(npi: string): void {
    this.delete(npi);
  }
}

/**
 * CAQH-specific cache with lookup helpers
 */
export class CAQHCache extends LRUCache<CAQHData> {
  constructor(config?: CacheConfig) {
    super({
      ...config,
      maxSize: config?.maxSize || 3000, // Cache 3k CAQH records
      ttl: config?.ttl || 12 * 60 * 60 * 1000, // 12 hours (more frequent updates)
    });
  }

  /**
   * Get CAQH data with metrics tracking
   */
  async getCAQH(caqhId: string, fetchFn?: () => Promise<CAQHData>): Promise<CAQHData | null> {
    const startTime = Date.now();

    // Try cache first
    const cached = this.get(caqhId, 'caqh');
    if (cached) {
      lookupDuration.observe(
        { source: 'caqh', cached: 'true' },
        (Date.now() - startTime) / 1000
      );
      return cached;
    }

    // Fetch if function provided
    if (fetchFn) {
      try {
        const data = await fetchFn();
        this.set(caqhId, data);
        lookupDuration.observe(
          { source: 'caqh', cached: 'false' },
          (Date.now() - startTime) / 1000
        );
        return data;
      } catch (error) {
        console.error(`[CAQHCache] Error fetching CAQH ${caqhId}:`, error);
        throw error;
      }
    }

    return null;
  }

  /**
   * Get by NPI (reverse lookup)
   */
  getByNPI(npi: string): CAQHData | null {
    // Search through cache for matching NPI
    for (const entry of (this as any).cache.values()) {
      if (entry.data.npi === npi) {
        return entry.data;
      }
    }
    return null;
  }

  /**
   * Invalidate CAQH (force refresh on next lookup)
   */
  invalidate(caqhId: string): void {
    this.delete(caqhId);
  }
}

// ==================== Singleton Instances ====================

let npiCache: NPICache | null = null;
let caqhCache: CAQHCache | null = null;

export function getNPICache(): NPICache {
  if (!npiCache) {
    npiCache = new NPICache();
  }
  return npiCache;
}

export function getCAQHCache(): CAQHCache {
  if (!caqhCache) {
    caqhCache = new CAQHCache();
  }
  return caqhCache;
}

/**
 * Initialize all lookup caches
 */
export function initializeLookupCaches(): void {
  console.log('[LookupCache] Initializing NPI and CAQH caches...');
  getNPICache();
  getCAQHCache();
  console.log('[LookupCache] Lookup caches initialized');
}

/**
 * Shutdown caches and cleanup timers
 */
export function shutdownLookupCaches(): void {
  if (npiCache) {
    npiCache.stopCleanupTimer();
    npiCache.clear();
  }
  if (caqhCache) {
    caqhCache.stopCleanupTimer();
    caqhCache.clear();
  }
}

/**
 * Get combined cache statistics
 */
export function getCacheStats(): {
  npi: ReturnType<LRUCache['getStats']>;
  caqh: ReturnType<LRUCache['getStats']>;
} {
  return {
    npi: getNPICache().getStats(),
    caqh: getCAQHCache().getStats(),
  };
}

