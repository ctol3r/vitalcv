/**
 * B144A-PERF-004: Redis Cache for Static Reference Data
 * Caches compacts maps, TEFCA configs, and other static reference data
 * With on-disk fallback and metrics tracking
 */

import { createClient, RedisClientType } from 'redis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Counter, Gauge } from 'prom-client';

// Prometheus metrics
const cacheHits = new Counter({
  name: 'reference_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['key_type'],
});

const cacheMisses = new Counter({
  name: 'reference_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['key_type'],
});

const cacheErrors = new Counter({
  name: 'reference_cache_errors_total',
  help: 'Total number of cache errors',
  labelNames: ['operation'],
});

const cacheSize = new Gauge({
  name: 'reference_cache_size_bytes',
  help: 'Approximate size of cached data in bytes',
  labelNames: ['key_type'],
});

export interface ReferenceCacheConfig {
  redisUrl?: string;
  fallbackDir?: string;
  ttl?: number; // Time to live in seconds (default: 1 hour)
  enabled?: boolean;
}

export interface CachedData<T = any> {
  data: T;
  cachedAt: number;
  expiresAt?: number;
  version?: string;
}

/**
 * Reference data cache with Redis primary and filesystem fallback
 */
export class ReferenceCache {
  private client: RedisClientType | null = null;
  private config: Required<ReferenceCacheConfig>;
  private connected: boolean = false;
  private fallbackDir: string;

  constructor(config: ReferenceCacheConfig = {}) {
    this.config = {
      redisUrl: config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      fallbackDir: config.fallbackDir || path.join(process.cwd(), '.cache', 'reference'),
      ttl: config.ttl || 3600, // 1 hour default
      enabled: config.enabled !== false,
    };

    this.fallbackDir = this.config.fallbackDir;
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[ReferenceCache] Cache disabled, using fallback only');
      return;
    }

    try {
      this.client = createClient({
        url: this.config.redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('[ReferenceCache] Max reconnection attempts reached');
              return new Error('Max reconnection attempts');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err) => {
        console.error('[ReferenceCache] Redis error:', err);
        cacheErrors.inc({ operation: 'connection' });
      });

      this.client.on('connect', () => {
        console.log('[ReferenceCache] Connected to Redis');
        this.connected = true;
      });

      this.client.on('disconnect', () => {
        console.warn('[ReferenceCache] Disconnected from Redis');
        this.connected = false;
      });

      await this.client.connect();

      // Ensure fallback directory exists
      await fs.mkdir(this.fallbackDir, { recursive: true });
    } catch (error) {
      console.error('[ReferenceCache] Failed to connect to Redis, using fallback only:', error);
      cacheErrors.inc({ operation: 'connect' });
      this.connected = false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.connected = false;
    }
  }

  /**
   * Get data from cache
   */
  async get<T = any>(key: string, keyType: string = 'generic'): Promise<T | null> {
    try {
      // Try Redis first
      if (this.connected && this.client) {
        try {
          const cached = await this.client.get(this.prefixKey(key));
          if (cached) {
            cacheHits.inc({ key_type: keyType });
            const parsed: CachedData<T> = JSON.parse(cached);

            // Check expiration
            if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
              await this.delete(key);
              cacheMisses.inc({ key_type: keyType });
              return null;
            }

            return parsed.data;
          }
        } catch (redisError) {
          console.error(`[ReferenceCache] Redis get error for key ${key}:`, redisError);
          cacheErrors.inc({ operation: 'get' });
        }
      }

      // Fall back to disk
      const fallbackData = await this.getFromDisk<T>(key);
      if (fallbackData) {
        cacheHits.inc({ key_type: keyType });
        // Optionally restore to Redis
        if (this.connected && this.client) {
          await this.set(key, fallbackData, keyType);
        }
        return fallbackData;
      }

      cacheMisses.inc({ key_type: keyType });
      return null;
    } catch (error) {
      console.error(`[ReferenceCache] Error getting key ${key}:`, error);
      cacheErrors.inc({ operation: 'get' });
      return null;
    }
  }

  /**
   * Set data in cache
   */
  async set<T = any>(
    key: string,
    data: T,
    keyType: string = 'generic',
    ttl?: number
  ): Promise<boolean> {
    try {
      const cachedData: CachedData<T> = {
        data,
        cachedAt: Date.now(),
        expiresAt: Date.now() + (ttl || this.config.ttl) * 1000,
      };

      const serialized = JSON.stringify(cachedData);
      const sizeBytes = Buffer.byteLength(serialized, 'utf8');
      cacheSize.set({ key_type: keyType }, sizeBytes);

      // Try Redis first
      if (this.connected && this.client) {
        try {
          await this.client.setEx(
            this.prefixKey(key),
            ttl || this.config.ttl,
            serialized
          );
        } catch (redisError) {
          console.error(`[ReferenceCache] Redis set error for key ${key}:`, redisError);
          cacheErrors.inc({ operation: 'set' });
        }
      }

      // Always write to disk as backup
      await this.setOnDisk(key, cachedData);

      return true;
    } catch (error) {
      console.error(`[ReferenceCache] Error setting key ${key}:`, error);
      cacheErrors.inc({ operation: 'set' });
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (this.connected && this.client) {
        try {
          await this.client.del(this.prefixKey(key));
        } catch (redisError) {
          console.error(`[ReferenceCache] Redis delete error for key ${key}:`, redisError);
          cacheErrors.inc({ operation: 'delete' });
        }
      }

      // Also delete from disk
      await this.deleteFromDisk(key);

      return true;
    } catch (error) {
      console.error(`[ReferenceCache] Error deleting key ${key}:`, error);
      cacheErrors.inc({ operation: 'delete' });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (this.connected && this.client) {
        const exists = await this.client.exists(this.prefixKey(key));
        if (exists) return true;
      }

      // Check disk
      return await this.existsOnDisk(key);
    } catch (error) {
      console.error(`[ReferenceCache] Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries (use with caution)
   */
  async clear(): Promise<void> {
    try {
      if (this.connected && this.client) {
        const keys = await this.client.keys(this.prefixKey('*'));
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      }

      // Clear disk cache
      await fs.rm(this.fallbackDir, { recursive: true, force: true });
      await fs.mkdir(this.fallbackDir, { recursive: true });
    } catch (error) {
      console.error('[ReferenceCache] Error clearing cache:', error);
      cacheErrors.inc({ operation: 'clear' });
    }
  }

  // ==================== Disk Fallback Methods ====================

  private async getFromDisk<T = any>(key: string): Promise<T | null> {
    try {
      const filePath = this.getDiskPath(key);
      const content = await fs.readFile(filePath, 'utf8');
      const parsed: CachedData<T> = JSON.parse(content);

      // Check expiration
      if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
        await this.deleteFromDisk(key);
        return null;
      }

      return parsed.data;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`[ReferenceCache] Disk read error for key ${key}:`, error);
      }
      return null;
    }
  }

  private async setOnDisk<T = any>(key: string, data: CachedData<T>): Promise<void> {
    try {
      const filePath = this.getDiskPath(key);
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data), 'utf8');
    } catch (error) {
      console.error(`[ReferenceCache] Disk write error for key ${key}:`, error);
      cacheErrors.inc({ operation: 'disk_write' });
    }
  }

  private async deleteFromDisk(key: string): Promise<void> {
    try {
      const filePath = this.getDiskPath(key);
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`[ReferenceCache] Disk delete error for key ${key}:`, error);
      }
    }
  }

  private async existsOnDisk(key: string): Promise<boolean> {
    try {
      const filePath = this.getDiskPath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private getDiskPath(key: string): string {
    // Sanitize key for filesystem
    const sanitized = key.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.fallbackDir, `${sanitized}.json`);
  }

  private prefixKey(key: string): string {
    return `ref:${key}`;
  }

  // ==================== Health Check ====================

  /**
   * Check cache health
   */
  async healthCheck(): Promise<{
    redis: boolean;
    disk: boolean;
    status: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    const redisHealthy = this.connected && this.client !== null;

    let diskHealthy = false;
    try {
      await fs.access(this.fallbackDir);
      diskHealthy = true;
    } catch {
      diskHealthy = false;
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (redisHealthy && diskHealthy) {
      status = 'healthy';
    } else if (diskHealthy || redisHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { redis: redisHealthy, disk: diskHealthy, status };
  }
}

// ==================== Specialized Caches ====================

/**
 * Cache for compacts maps (state license compacts)
 */
export class CompactsMapCache extends ReferenceCache {
  async getCompactsMap(): Promise<Record<string, string[]> | null> {
    return this.get('compacts:map', 'compacts');
  }

  async setCompactsMap(map: Record<string, string[]>, ttl: number = 86400): Promise<boolean> {
    // Cache for 24 hours by default
    return this.set('compacts:map', map, 'compacts', ttl);
  }

  async getStateCompact(state: string): Promise<string[] | null> {
    return this.get(`compacts:state:${state}`, 'compacts');
  }

  async setStateCompact(state: string, compacts: string[], ttl: number = 86400): Promise<boolean> {
    return this.set(`compacts:state:${state}`, compacts, 'compacts', ttl);
  }
}

/**
 * Cache for TEFCA configuration
 */
export class TEFCAConfigCache extends ReferenceCache {
  async getTEFCADirectory(): Promise<any | null> {
    return this.get('tefca:directory', 'tefca');
  }

  async setTEFCADirectory(directory: any, ttl: number = 3600): Promise<boolean> {
    return this.set('tefca:directory', directory, 'tefca', ttl);
  }

  async getQHINConfig(qhinId: string): Promise<any | null> {
    return this.get(`tefca:qhin:${qhinId}`, 'tefca');
  }

  async setQHINConfig(qhinId: string, config: any, ttl: number = 3600): Promise<boolean> {
    return this.set(`tefca:qhin:${qhinId}`, config, 'tefca', ttl);
  }
}

// ==================== Singleton Instances ====================

let compactsCache: CompactsMapCache | null = null;
let tefcaCache: TEFCAConfigCache | null = null;

export function getCompactsCache(): CompactsMapCache {
  if (!compactsCache) {
    compactsCache = new CompactsMapCache();
  }
  return compactsCache;
}

export function getTEFCACache(): TEFCAConfigCache {
  if (!tefcaCache) {
    tefcaCache = new TEFCAConfigCache();
  }
  return tefcaCache;
}

export async function initializeReferenceCaches(): Promise<void> {
  console.log('[ReferenceCache] Initializing reference caches...');

  try {
    const compacts = getCompactsCache();
    await compacts.connect();

    const tefca = getTEFCACache();
    await tefca.connect();

    console.log('[ReferenceCache] Reference caches initialized');
  } catch (error) {
    console.error('[ReferenceCache] Failed to initialize caches:', error);
    throw error;
  }
}

export async function shutdownReferenceCaches(): Promise<void> {
  if (compactsCache) {
    await compactsCache.disconnect();
  }
  if (tefcaCache) {
    await tefcaCache.disconnect();
  }
}

