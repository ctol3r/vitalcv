/**
 * Replay Cache Persistence (Redis-backed) for Nonce+JTI
 *
 * S72-STRETCH-A-005: Replay cache persistence (Redis-backed) for nonce+jti
 * Implementation uses Redis SETEX; supports cluster restarts
 * Tests using test Redis or mock client
 */

import { createClient, RedisClientType } from 'redis';

/**
 * Configuration for nonce service
 */
export interface NonceServiceConfig {
  /**
   * Redis connection URL
   */
  redisUrl?: string;

  /**
   * Nonce TTL in seconds
   */
  nonceTtl: number;

  /**
   * JTI TTL in seconds
   */
  jtiTtl: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: NonceServiceConfig = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  nonceTtl: 60, // 60 seconds
  jtiTtl: 60, // 60 seconds
};

/**
 * Redis client singleton
 */
let redisClient: RedisClientType | null = null;

/**
 * Get or create Redis client
 * S72-STRETCH-A-005: Supports cluster restarts
 */
async function getRedisClient(config: NonceServiceConfig): Promise<RedisClientType | null> {
  if (redisClient) {
    try {
      // Check if connection is still alive
      if (redisClient.isOpen) {
        await redisClient.ping();
        return redisClient;
      }
    } catch {
      // Connection lost, reset
      redisClient = null;
    }
  }

  try {
    redisClient = createClient({ url: config.redisUrl });

    redisClient.on('error', (err) => {
      console.error('[NonceService] Redis Client Error:', err);
      redisClient = null;
    });

    redisClient.on('connect', () => {
      console.info('[NonceService] Redis connected');
    });

    redisClient.on('reconnecting', () => {
      console.info('[NonceService] Redis reconnecting...');
    });

    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.warn('[NonceService] Redis connection failed, continuing without cache:', err);
    redisClient = null;
    return null;
  }
}

/**
 * Nonce Service with Redis-backed replay cache
 * S72-STRETCH-A-005: Implementation uses Redis SETEX
 */
export class NonceServiceRedis {
  private config: NonceServiceConfig;

  constructor(config: Partial<NonceServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if nonce exists and is valid
   * S72-STRETCH-A-005: Uses Redis SETEX for TTL management
   */
  async checkNonce(nonce: string): Promise<{ exists: boolean; isUsed: boolean }> {
    const client = await getRedisClient(this.config);
    if (!client) {
      // Fallback: return false if Redis unavailable (fail open for availability)
      return { exists: false, isUsed: false };
    }

    try {
      const key = `nonce:${nonce}`;
      const value = await client.get(key);

      if (!value) {
        return { exists: false, isUsed: false };
      }

      const data = JSON.parse(value);
      return { exists: true, isUsed: data.used === true };
    } catch (error) {
      console.error('[NonceService] Error checking nonce:', error);
      return { exists: false, isUsed: false };
    }
  }

  /**
   * Store nonce with TTL
   * S72-STRETCH-A-005: Uses Redis SETEX
   */
  async storeNonce(nonce: string, used: boolean = false): Promise<boolean> {
    const client = await getRedisClient(this.config);
    if (!client) {
      return false;
    }

    try {
      const key = `nonce:${nonce}`;
      const value = JSON.stringify({
        used,
        timestamp: Date.now(),
      });

      // S72-STRETCH-A-005: Use SETEX for atomic set with expiration
      await client.setEx(key, this.config.nonceTtl, value);
      return true;
    } catch (error) {
      console.error('[NonceService] Error storing nonce:', error);
      return false;
    }
  }

  /**
   * Mark nonce as used
   */
  async markNonceUsed(nonce: string): Promise<boolean> {
    const client = await getRedisClient(this.config);
    if (!client) {
      return false;
    }

    try {
      const key = `nonce:${nonce}`;
      const existing = await client.get(key);

      if (!existing) {
        return false;
      }

      const data = JSON.parse(existing);
      data.used = true;
      data.usedAt = Date.now();

      // Update with same TTL
      await client.setEx(key, this.config.nonceTtl, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[NonceService] Error marking nonce as used:', error);
      return false;
    }
  }

  /**
   * Check if JTI was already used (replay protection)
   * S72-STRETCH-A-005: Uses Redis SETEX for JTI replay cache
   */
  async checkJti(jti: string): Promise<{ isReplay: boolean }> {
    const client = await getRedisClient(this.config);
    if (!client) {
      // Fallback: return false if Redis unavailable
      return { isReplay: false };
    }

    try {
      const key = `jti:${jti}`;
      const exists = await client.exists(key);

      if (exists) {
        return { isReplay: true };
      }

      // Store JTI with TTL
      await client.setEx(key, this.config.jtiTtl, JSON.stringify({
        timestamp: Date.now(),
      }));

      return { isReplay: false };
    } catch (error) {
      console.error('[NonceService] Error checking JTI:', error);
      return { isReplay: false };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch (error) {
        console.error('[NonceService] Error closing Redis:', error);
      } finally {
        redisClient = null;
      }
    }
  }
}

/**
 * Default nonce service instance
 */
let defaultNonceService: NonceServiceRedis | null = null;

/**
 * Get default nonce service instance
 */
export function getNonceService(config?: Partial<NonceServiceConfig>): NonceServiceRedis {
  if (!defaultNonceService) {
    defaultNonceService = new NonceServiceRedis(config);
  }
  return defaultNonceService;
}

export default NonceServiceRedis;

