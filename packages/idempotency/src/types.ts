/**
 * Idempotency Store Types and Interfaces
 *
 * Defines the contract for idempotency implementations.
 */

/**
 * Stored idempotency record
 */
export interface IdempotencyRecord {
  /**
   * Original request ID that created this record
   */
  request_id: string;

  /**
   * HTTP status code of the original response
   */
  status_code: number;

  /**
   * Response headers from the original response
   */
  headers: Record<string, string | string[]>;

  /**
   * Response body from the original response (JSON)
   */
  response_body: any;

  /**
   * Timestamp when this record was created (Unix time in milliseconds)
   */
  created_at: number;

  /**
   * Timestamp when this record expires (Unix time in milliseconds)
   */
  expires_at: number;
}

/**
 * Idempotency store interface
 *
 * MODE-AWARE:
 * - TEST/DEV: Use InMemoryIdempotencyStore
 * - PROD: Use RedisIdempotencyStore
 */
export interface IdempotencyStore {
  /**
   * Get idempotency record for a given key
   *
   * @param key - Idempotency key (UUID)
   * @returns Record if found, null otherwise
   */
  get(key: string): Promise<IdempotencyRecord | null>;

  /**
   * Store idempotency record
   *
   * @param key - Idempotency key (UUID)
   * @param record - Record to store
   * @param ttlSeconds - Time to live in seconds
   */
  set(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void>;

  /**
   * Delete idempotency record (admin operation)
   *
   * @param key - Idempotency key to delete
   */
  delete(key: string): Promise<void>;
}
