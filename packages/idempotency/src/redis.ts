/**
 * Redis Idempotency Store
 *
 * Redis-backed storage for idempotency records with TTL.
 * Used in PROD mode.
 *
 * Uses Redis SETEX for automatic expiry.
 */

import type { IdempotencyStore, IdempotencyRecord } from './types';

// Redis client type (compatible with redis@4)
export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

export class RedisIdempotencyStore implements IdempotencyStore {
  private readonly redis: RedisClientLike;
  private readonly keyPrefix: string;

  constructor(redis: RedisClientLike, keyPrefix: string = 'idempotency') {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    const redisKey = this.buildKey(key);
    const value = await this.redis.get(redisKey);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as IdempotencyRecord;
    } catch {
      // Invalid JSON - delete and return null
      await this.redis.del(redisKey);
      return null;
    }
  }

  async set(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void> {
    const redisKey = this.buildKey(key);
    const now = Date.now();

    const recordWithExpiry = {
      ...record,
      created_at: now,
      expires_at: now + ttlSeconds * 1000,
    };

    const value = JSON.stringify(recordWithExpiry);
    await this.redis.setEx(redisKey, ttlSeconds, value);
  }

  async delete(key: string): Promise<void> {
    const redisKey = this.buildKey(key);
    await this.redis.del(redisKey);
  }

  private buildKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }
}
