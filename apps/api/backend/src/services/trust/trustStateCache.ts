import { LRUCache } from 'lru-cache';
import type { ClinicianTrustState } from './trustStateEngine';

const TRUST_STATE_LRU_MAX = 1000;
const TRUST_STATE_LRU_TTL_MS = 60 * 1000; // 60s hot-path TTL

export const trustStateLRU = new LRUCache<string, ClinicianTrustState>({
  max: TRUST_STATE_LRU_MAX,
  ttl: TRUST_STATE_LRU_TTL_MS,
});

// ── Hit/miss counters (in-process, resets on restart) ──────────────────────

const counters = {
  memoryHits: 0,
  dbHits: 0,
  misses: 0,
};

export function recordMemoryHit(): void { counters.memoryHits++; }
export function recordDbHit(): void     { counters.dbHits++; }
export function recordCacheMiss(): void { counters.misses++; }

export function getCacheCounters() {
  const total = counters.memoryHits + counters.dbHits + counters.misses;
  return {
    memory_hits: counters.memoryHits,
    db_hits: counters.dbHits,
    misses: counters.misses,
    total_requests: total,
    memory_hit_ratio: total > 0 ? +(counters.memoryHits / total).toFixed(4) : 0,
    db_hit_ratio: total > 0 ? +(counters.dbHits / total).toFixed(4) : 0,
    overall_hit_ratio: total > 0 ? +((counters.memoryHits + counters.dbHits) / total).toFixed(4) : 0,
    lru_size: trustStateLRU.size,
    lru_max: TRUST_STATE_LRU_MAX,
    lru_ttl_ms: TRUST_STATE_LRU_TTL_MS,
  };
}

export function resetCacheCounters(): void {
  counters.memoryHits = 0;
  counters.dbHits = 0;
  counters.misses = 0;
}

// ── Cache accessors ────────────────────────────────────────────────────────

export function getTrustStateMemoryCache(npi: string): ClinicianTrustState | null {
  return trustStateLRU.get(npi) ?? null;
}

export function setTrustStateMemoryCache(
  npi: string,
  state: ClinicianTrustState,
): ClinicianTrustState {
  trustStateLRU.set(npi, state);
  return state;
}

export function invalidateTrustStateCache(npi: string): void {
  trustStateLRU.delete(npi);
}

export function resetTrustStateMemoryCache(): void {
  trustStateLRU.clear();
  resetCacheCounters();
}
