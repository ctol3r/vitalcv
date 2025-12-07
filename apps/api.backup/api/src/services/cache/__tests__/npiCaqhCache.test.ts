/**
 * Tests for NPI/CAQH LRU Cache (B144A-PERF-005)
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import {
  LRUCache,
  NPICache,
  CAQHCache,
  getNPICache,
  getCAQHCache,
  initializeLookupCaches,
  shutdownLookupCaches,
  getCacheStats,
  type NPIData,
  type CAQHData,
} from '../npiCaqhCache';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>({
      maxSize: 5,
      ttl: 1000, // 1 second for testing
      enableMetrics: false,
    });
  });

  afterAll(() => {
    cache.stopCleanupTimer();
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('non-existent')).toBeNull();
    });

    it('should check if key exists', () => {
      cache.set('exists', 'value');
      expect(cache.has('exists')).toBe(true);
      expect(cache.has('not-exists')).toBe(false);
    });

    it('should delete keys', () => {
      cache.set('delete-me', 'value');
      expect(cache.has('delete-me')).toBe(true);

      cache.delete('delete-me');
      expect(cache.has('delete-me')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
    });

    it('should report correct size', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entry when cache is full', () => {
      // Fill cache to max size
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      expect(cache.size()).toBe(5);

      // Add one more - should evict key1 (least recently used)
      cache.set('key6', 'value6');

      expect(cache.size()).toBe(5);
      expect(cache.get('key1')).toBeNull(); // Evicted
      expect(cache.get('key6')).toBe('value6'); // New entry
    });

    it('should update LRU order on access', () => {
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Access key1 to make it most recently used
      cache.get('key1');

      // Add new entry - should evict key2 (now least recently used)
      cache.set('key6', 'value6');

      expect(cache.get('key1')).toBe('value1'); // Still present
      expect(cache.get('key2')).toBeNull(); // Evicted
    });

    it('should not count updates as evictions', () => {
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Update existing key
      cache.set('key1', 'updated-value1');

      expect(cache.size()).toBe(5);
      expect(cache.get('key1')).toBe('updated-value1');
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      cache.set('expire-key', 'value');
      expect(cache.get('expire-key')).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(cache.get('expire-key')).toBeNull();
    });

    it('should not return expired entries via has()', async () => {
      cache.set('expire-key', 'value');
      expect(cache.has('expire-key')).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(cache.has('expire-key')).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
      expect(stats.oldestEntry).toBeGreaterThan(0);
      expect(stats.newestEntry).toBeGreaterThan(0);
    });

    it('should update statistics correctly', () => {
      const stats1 = cache.getStats();
      expect(stats1.size).toBe(0);
      expect(stats1.oldestEntry).toBeNull();

      cache.set('key1', 'value1');

      const stats2 = cache.getStats();
      expect(stats2.size).toBe(1);
      expect(stats2.oldestEntry).not.toBeNull();
    });
  });
});

describe('NPICache', () => {
  let npiCache: NPICache;

  beforeEach(() => {
    npiCache = new NPICache({
      maxSize: 10,
      ttl: 5000,
      enableMetrics: false,
    });
  });

  afterAll(() => {
    npiCache.stopCleanupTimer();
  });

  const mockNPIData: NPIData = {
    npi: '1234567890',
    firstName: 'John',
    lastName: 'Doe',
    specialty: 'Internal Medicine',
    taxonomyCode: '207R00000X',
    state: 'CA',
    city: 'Los Angeles',
  };

  describe('NPI Operations', () => {
    it('should cache NPI data', async () => {
      const result = await npiCache.getNPI('1234567890', async () => mockNPIData);

      expect(result).toEqual(mockNPIData);
    });

    it('should return cached NPI on subsequent calls', async () => {
      let fetchCount = 0;
      const fetchFn = async () => {
        fetchCount++;
        return mockNPIData;
      };

      // First call - should fetch
      await npiCache.getNPI('1234567890', fetchFn);
      expect(fetchCount).toBe(1);

      // Second call - should use cache
      await npiCache.getNPI('1234567890', fetchFn);
      expect(fetchCount).toBe(1); // Still 1, not called again
    });

    it('should fetch if not in cache and no fetch function', async () => {
      const result = await npiCache.getNPI('9999999999');
      expect(result).toBeNull();
    });

    it('should handle batch get operations', async () => {
      npiCache.set('1111111111', { ...mockNPIData, npi: '1111111111' });
      npiCache.set('2222222222', { ...mockNPIData, npi: '2222222222' });

      const results = await npiCache.getBatch(['1111111111', '2222222222', '3333333333']);

      expect(results.get('1111111111')).not.toBeNull();
      expect(results.get('2222222222')).not.toBeNull();
      expect(results.get('3333333333')).toBeNull();
    });

    it('should invalidate NPI entries', async () => {
      await npiCache.getNPI('1234567890', async () => mockNPIData);
      expect(npiCache.get('1234567890')).not.toBeNull();

      npiCache.invalidate('1234567890');
      expect(npiCache.get('1234567890')).toBeNull();
    });
  });
});

describe('CAQHCache', () => {
  let caqhCache: CAQHCache;

  beforeEach(() => {
    caqhCache = new CAQHCache({
      maxSize: 10,
      ttl: 5000,
      enableMetrics: false,
    });
  });

  afterAll(() => {
    caqhCache.stopCleanupTimer();
  });

  const mockCAQHData: CAQHData = {
    caqhId: 'CAQH123456',
    npi: '1234567890',
    status: 'active',
    attestationDate: '2024-01-01',
    expirationDate: '2025-01-01',
    practiceLocations: [
      { address: '123 Main St', city: 'Los Angeles', state: 'CA' },
    ],
  };

  describe('CAQH Operations', () => {
    it('should cache CAQH data', async () => {
      const result = await caqhCache.getCAQH('CAQH123456', async () => mockCAQHData);

      expect(result).toEqual(mockCAQHData);
    });

    it('should return cached CAQH on subsequent calls', async () => {
      let fetchCount = 0;
      const fetchFn = async () => {
        fetchCount++;
        return mockCAQHData;
      };

      await caqhCache.getCAQH('CAQH123456', fetchFn);
      expect(fetchCount).toBe(1);

      await caqhCache.getCAQH('CAQH123456', fetchFn);
      expect(fetchCount).toBe(1);
    });

    it('should support reverse lookup by NPI', () => {
      caqhCache.set('CAQH123456', mockCAQHData);

      const result = caqhCache.getByNPI('1234567890');
      expect(result).toEqual(mockCAQHData);
    });

    it('should return null for NPI not in cache', () => {
      const result = caqhCache.getByNPI('9999999999');
      expect(result).toBeNull();
    });

    it('should invalidate CAQH entries', async () => {
      await caqhCache.getCAQH('CAQH123456', async () => mockCAQHData);
      expect(caqhCache.get('CAQH123456')).not.toBeNull();

      caqhCache.invalidate('CAQH123456');
      expect(caqhCache.get('CAQH123456')).toBeNull();
    });
  });
});

describe('Singleton Instances', () => {
  afterAll(() => {
    shutdownLookupCaches();
  });

  it('should return same instance for getNPICache', () => {
    const cache1 = getNPICache();
    const cache2 = getNPICache();

    expect(cache1).toBe(cache2);
  });

  it('should return same instance for getCAQHCache', () => {
    const cache1 = getCAQHCache();
    const cache2 = getCAQHCache();

    expect(cache1).toBe(cache2);
  });

  it('should initialize lookup caches', () => {
    initializeLookupCaches();

    const npiCache = getNPICache();
    const caqhCache = getCAQHCache();

    expect(npiCache).toBeDefined();
    expect(caqhCache).toBeDefined();
  });

  it('should return combined cache statistics', () => {
    initializeLookupCaches();

    const npiCache = getNPICache();
    npiCache.set('1234567890', {
      npi: '1234567890',
      firstName: 'Test',
      lastName: 'User',
    });

    const stats = getCacheStats();

    expect(stats.npi).toBeDefined();
    expect(stats.caqh).toBeDefined();
    expect(stats.npi.size).toBeGreaterThan(0);
  });

  it('should shutdown caches cleanly', () => {
    initializeLookupCaches();
    expect(() => shutdownLookupCaches()).not.toThrow();
  });
});

describe('Performance and Edge Cases', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>({
      maxSize: 1000,
      ttl: 60000,
      enableMetrics: false,
    });
  });

  afterAll(() => {
    cache.stopCleanupTimer();
  });

  it('should handle large number of entries', () => {
    for (let i = 0; i < 1000; i++) {
      cache.set(`key${i}`, `value${i}`);
    }

    expect(cache.size()).toBe(1000);

    // Add one more - should evict oldest
    cache.set('key1000', 'value1000');
    expect(cache.size()).toBe(1000);
  });

  it('should handle rapid sequential access', () => {
    cache.set('hot-key', 'hot-value');

    for (let i = 0; i < 1000; i++) {
      expect(cache.get('hot-key')).toBe('hot-value');
    }
  });

  it('should handle concurrent operations', async () => {
    const operations = [];

    for (let i = 0; i < 100; i++) {
      operations.push(
        (async () => {
          cache.set(`concurrent-${i}`, `value-${i}`);
          return cache.get(`concurrent-${i}`);
        })()
      );
    }

    const results = await Promise.all(operations);
    expect(results.every((r, i) => r === `value-${i}`)).toBe(true);
  });

  it('should handle mixed read/write patterns', () => {
    // Write phase
    for (let i = 0; i < 100; i++) {
      cache.set(`key${i}`, `value${i}`);
    }

    // Mixed phase
    for (let i = 0; i < 200; i++) {
      if (i % 2 === 0) {
        cache.get(`key${i % 100}`);
      } else {
        cache.set(`key${i}`, `value${i}`);
      }
    }

    expect(cache.size()).toBeGreaterThan(0);
  });
});

