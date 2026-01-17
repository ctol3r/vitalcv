/**
 * Tests for In-Memory Idempotency Store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryIdempotencyStore } from '../inMemory';
import type { IdempotencyRecord } from '../types';

describe('InMemoryIdempotencyStore', () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore();
  });

  it('should store and retrieve idempotency record', async () => {
    const key = 'test-uuid-1';
    const record: IdempotencyRecord = {
      request_id: 'req-123',
      status_code: 200,
      headers: { 'content-type': 'application/json' },
      response_body: { success: true },
      created_at: Date.now(),
      expires_at: Date.now() + 3600000,
    };

    await store.set(key, record, 3600);

    const retrieved = await store.get(key);

    expect(retrieved).toBeTruthy();
    expect(retrieved?.request_id).toBe('req-123');
    expect(retrieved?.status_code).toBe(200);
    expect(retrieved?.response_body).toEqual({ success: true });
  });

  it('should return null for non-existent key', async () => {
    const result = await store.get('non-existent-key');

    expect(result).toBeNull();
  });

  it('should return null for expired record', async () => {
    const key = 'test-uuid-expired';
    const record: IdempotencyRecord = {
      request_id: 'req-expired',
      status_code: 200,
      headers: {},
      response_body: {},
      created_at: Date.now(),
      expires_at: Date.now() + 3600000,
    };

    // Set with very short TTL
    await store.set(key, record, 1);

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const result = await store.get(key);

    expect(result).toBeNull();
  });

  it('should delete record', async () => {
    const key = 'test-uuid-delete';
    const record: IdempotencyRecord = {
      request_id: 'req-delete',
      status_code: 200,
      headers: {},
      response_body: {},
      created_at: Date.now(),
      expires_at: Date.now() + 3600000,
    };

    await store.set(key, record, 3600);

    const before = await store.get(key);
    expect(before).toBeTruthy();

    await store.delete(key);

    const after = await store.get(key);
    expect(after).toBeNull();
  });

  it('should handle multiple keys independently', async () => {
    const record1: IdempotencyRecord = {
      request_id: 'req-1',
      status_code: 200,
      headers: {},
      response_body: { data: 'response1' },
      created_at: Date.now(),
      expires_at: Date.now() + 3600000,
    };

    const record2: IdempotencyRecord = {
      request_id: 'req-2',
      status_code: 201,
      headers: {},
      response_body: { data: 'response2' },
      created_at: Date.now(),
      expires_at: Date.now() + 3600000,
    };

    await store.set('key-1', record1, 3600);
    await store.set('key-2', record2, 3600);

    const result1 = await store.get('key-1');
    const result2 = await store.get('key-2');

    expect(result1?.request_id).toBe('req-1');
    expect(result1?.response_body).toEqual({ data: 'response1' });

    expect(result2?.request_id).toBe('req-2');
    expect(result2?.response_body).toEqual({ data: 'response2' });
    expect(result2?.status_code).toBe(201);
  });

  it('should clear all records', async () => {
    const record: IdempotencyRecord = {
      request_id: 'req-1',
      status_code: 200,
      headers: {},
      response_body: {},
      created_at: Date.now(),
      expires_at: Date.now() + 3600000,
    };

    await store.set('key-1', record, 3600);
    await store.set('key-2', record, 3600);

    expect(store.size()).toBe(2);

    store.clear();

    expect(store.size()).toBe(0);
    expect(await store.get('key-1')).toBeNull();
    expect(await store.get('key-2')).toBeNull();
  });

  it('should store created_at and expires_at timestamps', async () => {
    const key = 'test-timestamps';
    const before = Date.now();

    const record: IdempotencyRecord = {
      request_id: 'req-time',
      status_code: 200,
      headers: {},
      response_body: {},
      created_at: 0, // Will be set by store
      expires_at: 0, // Will be set by store
    };

    await store.set(key, record, 3600);

    const after = Date.now();
    const retrieved = await store.get(key);

    expect(retrieved).toBeTruthy();
    expect(retrieved!.created_at).toBeGreaterThanOrEqual(before);
    expect(retrieved!.created_at).toBeLessThanOrEqual(after);
    expect(retrieved!.expires_at).toBeGreaterThan(retrieved!.created_at);
  });
});
