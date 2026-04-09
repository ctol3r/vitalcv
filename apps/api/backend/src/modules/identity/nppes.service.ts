import { HttpError } from '../../utils/httpError';
import { log } from '../../obs/logger';
import { sha256ForPayload } from '../../utils/deterministic';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import type { RawNppesResponse, NppesFetchResult } from './types';

const CMS_NPPES_ENDPOINT =
  'https://npiregistry.cms.hhs.gov/api/?version=2.1';

/** In-memory NPPES response cache with TTL */
const NPPES_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const nppesCache = new Map<string, { result: NppesFetchResult; cachedAt: number }>();

/**
 * Fetch provider data from the CMS NPPES Registry by NPI number.
 * Returns the raw payload and its SHA-256 hash for audit integrity.
 *
 * Includes:
 *   - Exponential backoff retry (3 attempts) for transient failures
 *   - In-memory cache with 15-minute TTL to avoid hammering CMS
 */
export async function fetchNpiFromCMS(npi: string): Promise<NppesFetchResult> {
  // Check cache first
  const cached = nppesCache.get(npi);
  if (cached && Date.now() - cached.cachedAt < NPPES_CACHE_TTL_MS) {
    log('info', 'nppes_cache_hit', { npi, ageMs: Date.now() - cached.cachedAt });
    return cached.result;
  }

  const url = `${CMS_NPPES_ENDPOINT}&number=${encodeURIComponent(npi)}`;

  let response: Response;
  try {
    response = await fetchWithRetry(url, undefined, {
      maxRetries: 3,
      baseDelayMs: 500,
      timeoutMs: 10_000,
      label: 'nppes',
    });
  } catch (err) {
    log('error', 'nppes_fetch_failed', {
      npi,
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw new HttpError(502, 'Failed to reach CMS NPPES Registry');
  }

  if (!response.ok) {
    log('error', 'nppes_upstream_error', {
      npi,
      status: response.status,
    });
    throw new HttpError(502, `CMS NPPES returned status ${response.status}`);
  }

  let rawPayload: RawNppesResponse;
  try {
    rawPayload = JSON.parse(await response.text()) as RawNppesResponse;
  } catch {
    throw new HttpError(502, 'Invalid JSON from CMS NPPES Registry');
  }

  if (!Array.isArray(rawPayload.results) || typeof rawPayload.result_count !== 'number') {
    throw new HttpError(502, 'Invalid NPPES response shape from CMS registry');
  }

  const payloadHash = sha256ForPayload(rawPayload);

  if (rawPayload.result_count === 0 || rawPayload.results.length === 0) {
    throw new HttpError(404, `NPI ${npi} not found in CMS NPPES Registry`);
  }

  const result = { rawPayload, payloadHash };

  // Cache successful responses
  nppesCache.set(npi, { result, cachedAt: Date.now() });

  // Evict stale entries (cap at 10k to prevent unbounded growth)
  if (nppesCache.size > 10_000) {
    const now = Date.now();
    for (const [key, entry] of nppesCache) {
      if (now - entry.cachedAt > NPPES_CACHE_TTL_MS) nppesCache.delete(key);
    }
  }

  return result;
}

/** Expose cache stats for health/status endpoints */
export function nppesCacheStats(): { size: number; ttlMs: number } {
  return { size: nppesCache.size, ttlMs: NPPES_CACHE_TTL_MS };
}

/** Clear the NPPES cache — for tests only */
export function resetNppesCacheForTests(): void {
  nppesCache.clear();
}
