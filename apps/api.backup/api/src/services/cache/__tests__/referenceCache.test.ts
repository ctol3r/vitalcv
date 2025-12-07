/**
 * Tests for ReferenceCache (B144A-PERF-004)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  ReferenceCache,
  CompactsMapCache,
  TEFCAConfigCache,
  getCompactsCache,
  getTEFCACache,
  initializeReferenceCaches,
  shutdownReferenceCaches,
} from '../referenceCache';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ReferenceCache', () => {
  let cache: ReferenceCache;
  const testCacheDir = path.join(process.cwd(), '.cache', 'test-reference');

  beforeAll(async () => {
    // Clean up test cache directory
    await fs.rm(testCacheDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    cache = new ReferenceCache({
      fallbackDir: testCacheDir,
      ttl: 1, // 1 second for testing
      enabled: false, // Disable Redis for unit tests
    });
    await cache.connect();
  });

  afterAll(async () => {
    await fs.rm(testCacheDir, { recursive: true, force: true });
  });

  describe('Basic Operations', () => {
    it('should set and get values', async () => {
      const testData = { foo: 'bar', baz: 123 };
      await cache.set('test-key', testData, 'test');

      const retrieved = await cache.get('test-key', 'test');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent', 'test');
      expect(result).toBeNull();
    });

    it('should check if key exists', async () => {
      await cache.set('exists-key', { value: 'test' }, 'test');

      const exists = await cache.exists('exists-key');
      expect(exists).toBe(true);

      const notExists = await cache.exists('not-exists-key');
      expect(notExists).toBe(false);
    });

    it('should delete keys', async () => {
      await cache.set('delete-key', { value: 'test' }, 'test');
      expect(await cache.exists('delete-key')).toBe(true);

      await cache.delete('delete-key');
      expect(await cache.exists('delete-key')).toBe(false);
    });

    it('should clear all cache entries', async () => {
      await cache.set('key1', { value: 1 }, 'test');
      await cache.set('key2', { value: 2 }, 'test');

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });
  });

  describe('TTL and Expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortTTLCache = new ReferenceCache({
        fallbackDir: testCacheDir,
        ttl: 1, // 1 second
        enabled: false,
      });
      await shortTTLCache.connect();

      await shortTTLCache.set('expire-key', { value: 'test' }, 'test', 1);

      // Should exist immediately
      expect(await shortTTLCache.get('expire-key')).not.toBeNull();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Should be expired
      expect(await shortTTLCache.get('expire-key')).toBeNull();

      await shortTTLCache.disconnect();
    });

    it('should respect custom TTL per entry', async () => {
      await cache.set('short-ttl', { value: 'test' }, 'test', 1);
      await cache.set('long-ttl', { value: 'test' }, 'test', 3600);

      // Both should exist immediately
      expect(await cache.get('short-ttl')).not.toBeNull();
      expect(await cache.get('long-ttl')).not.toBeNull();

      // Wait for short TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(await cache.get('short-ttl')).toBeNull();
      expect(await cache.get('long-ttl')).not.toBeNull();
    });
  });

  describe('Disk Fallback', () => {
    it('should persist data to disk', async () => {
      const testData = { persistent: 'data' };
      await cache.set('disk-key', testData, 'test');

      // Create new cache instance (simulating restart)
      const newCache = new ReferenceCache({
        fallbackDir: testCacheDir,
        enabled: false,
      });
      await newCache.connect();

      // Should retrieve from disk
      const retrieved = await newCache.get('disk-key', 'test');
      expect(retrieved).toEqual(testData);

      await newCache.disconnect();
    });

    it('should handle disk read errors gracefully', async () => {
      // Try to read from non-existent file
      const result = await cache.get('never-existed', 'test');
      expect(result).toBeNull();
    });
  });

  describe('Health Check', () => {
    it('should report degraded status when Redis disabled', async () => {
      const health = await cache.healthCheck();

      expect(health.redis).toBe(false);
      expect(health.disk).toBe(true);
      expect(health.status).toBe('degraded');
    });
  });

  describe('Edge Cases', () => {
    it('should handle large data objects', async () => {
      const largeData = {
        array: Array(1000).fill({ key: 'value', nested: { data: 'test' } }),
      };

      await cache.set('large-key', largeData, 'test');
      const retrieved = await cache.get('large-key', 'test');

      expect(retrieved).toEqual(largeData);
    });

    it('should handle special characters in keys', async () => {
      const testData = { value: 'test' };
      const specialKey = 'key:with:colons/and/slashes?and=query&params';

      await cache.set(specialKey, testData, 'test');
      const retrieved = await cache.get(specialKey, 'test');

      expect(retrieved).toEqual(testData);
    });

    it('should handle concurrent operations', async () => {
      const operations = [];

      // Concurrent writes
      for (let i = 0; i < 10; i++) {
        operations.push(cache.set(`concurrent-${i}`, { value: i }, 'test'));
      }

      await Promise.all(operations);

      // Verify all writes succeeded
      for (let i = 0; i < 10; i++) {
        const result = await cache.get(`concurrent-${i}`, 'test');
        expect(result).toEqual({ value: i });
      }
    });
  });
});

describe('CompactsMapCache', () => {
  let compactsCache: CompactsMapCache;
  const testCacheDir = path.join(process.cwd(), '.cache', 'test-compacts');

  beforeEach(async () => {
    await fs.rm(testCacheDir, { recursive: true, force: true });
    compactsCache = new CompactsMapCache({
      fallbackDir: testCacheDir,
      enabled: false,
    });
    await compactsCache.connect();
  });

  afterAll(async () => {
    await fs.rm(testCacheDir, { recursive: true, force: true });
  });

  it('should cache compacts map', async () => {
    const compactsMap = {
      CA: ['NLC', 'Psypact'],
      NY: ['NLC'],
      TX: ['NLC', 'Psypact', 'IMLC'],
    };

    await compactsCache.setCompactsMap(compactsMap);
    const retrieved = await compactsCache.getCompactsMap();

    expect(retrieved).toEqual(compactsMap);
  });

  it('should cache individual state compacts', async () => {
    const caCompacts = ['NLC', 'Psypact'];

    await compactsCache.setStateCompact('CA', caCompacts);
    const retrieved = await compactsCache.getStateCompact('CA');

    expect(retrieved).toEqual(caCompacts);
  });

  it('should return null for unknown states', async () => {
    const result = await compactsCache.getStateCompact('XX');
    expect(result).toBeNull();
  });
});

describe('TEFCAConfigCache', () => {
  let tefcaCache: TEFCAConfigCache;
  const testCacheDir = path.join(process.cwd(), '.cache', 'test-tefca');

  beforeEach(async () => {
    await fs.rm(testCacheDir, { recursive: true, force: true });
    tefcaCache = new TEFCAConfigCache({
      fallbackDir: testCacheDir,
      enabled: false,
    });
    await tefcaCache.connect();
  });

  afterAll(async () => {
    await fs.rm(testCacheDir, { recursive: true, force: true });
  });

  it('should cache TEFCA directory', async () => {
    const directory = {
      qhins: [
        { id: 'qhin1', name: 'QHIN One', endpoint: 'https://qhin1.example.com' },
        { id: 'qhin2', name: 'QHIN Two', endpoint: 'https://qhin2.example.com' },
      ],
    };

    await tefcaCache.setTEFCADirectory(directory);
    const retrieved = await tefcaCache.getTEFCADirectory();

    expect(retrieved).toEqual(directory);
  });

  it('should cache QHIN configurations', async () => {
    const qhinConfig = {
      id: 'qhin1',
      name: 'QHIN One',
      endpoint: 'https://qhin1.example.com',
      publicKey: 'mock-public-key',
    };

    await tefcaCache.setQHINConfig('qhin1', qhinConfig);
    const retrieved = await tefcaCache.getQHINConfig('qhin1');

    expect(retrieved).toEqual(qhinConfig);
  });
});

describe('Singleton Instances', () => {
  it('should return same instance for getCompactsCache', () => {
    const cache1 = getCompactsCache();
    const cache2 = getCompactsCache();

    expect(cache1).toBe(cache2);
  });

  it('should return same instance for getTEFCACache', () => {
    const cache1 = getTEFCACache();
    const cache2 = getTEFCACache();

    expect(cache1).toBe(cache2);
  });

  it('should initialize and shutdown all caches', async () => {
    // This will initialize singleton instances
    await initializeReferenceCaches();

    const compacts = getCompactsCache();
    const tefca = getTEFCACache();

    expect(compacts).toBeDefined();
    expect(tefca).toBeDefined();

    // Shutdown should not throw
    await expect(shutdownReferenceCaches()).resolves.not.toThrow();
  });
});

