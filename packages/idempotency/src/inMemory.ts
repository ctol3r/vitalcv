/**
 * In-Memory Idempotency Store
 *
 * Map-based storage for idempotency records.
 * Used in TEST and DEV modes (no network calls).
 *
 * Automatically expires records after TTL.
 */

import type { IdempotencyStore, IdempotencyRecord } from './types';

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly storage = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | null> {
    const record = this.storage.get(key);

    if (!record) {
      return null;
    }

    // Check if expired
    if (Date.now() > record.expires_at) {
      this.storage.delete(key);
      return null;
    }

    return record;
  }

  async set(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    const recordWithExpiry = {
      ...record,
      created_at: now,
      expires_at: now + ttlSeconds * 1000,
    };

    this.storage.set(key, recordWithExpiry);

    // Schedule automatic cleanup
    setTimeout(() => {
      this.storage.delete(key);
    }, ttlSeconds * 1000);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  /**
   * Clear all idempotency records (for testing)
   */
  clear(): void {
    this.storage.clear();
  }

  /**
   * Get current storage size (for debugging/testing)
   */
  size(): number {
    return this.storage.size;
  }
}
