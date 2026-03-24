import { LRUCache } from 'lru-cache';
import { log } from '../../obs/logger';
import { stableStringify } from '../../utils/deterministic';

const mapAggregateCache = new LRUCache<string, any>({
  max: 250,
  ttl: 60_000,
});

let geospatialCacheEpoch = 0;

export function getGeospatialDataVersion(): string {
  return `geospatial:v1:${geospatialCacheEpoch}`;
}

function cacheKey(namespace: string, payload: unknown): string {
  return `${namespace}:${getGeospatialDataVersion()}:${stableStringify(payload)}`;
}

export function getCachedGeospatialPayload<T>(namespace: string, payload: unknown): T | undefined {
  return mapAggregateCache.get(cacheKey(namespace, payload)) as T | undefined;
}

export function setCachedGeospatialPayload<T>(namespace: string, payload: unknown, value: T): T {
  mapAggregateCache.set(cacheKey(namespace, payload), value);
  return value;
}

export function invalidateGeospatialCache(reason: string, metadata?: Record<string, unknown>): void {
  geospatialCacheEpoch += 1;
  mapAggregateCache.clear();
  log('info', 'geospatial.cache_invalidated', {
    event: 'geospatial_cache_invalidated',
    reason,
    epoch: geospatialCacheEpoch,
    ...metadata,
  });
}

export function getGeospatialCacheStats(): { epoch: number; size: number; ttlMs: number } {
  return {
    epoch: geospatialCacheEpoch,
    size: mapAggregateCache.size,
    ttlMs: 60_000,
  };
}
