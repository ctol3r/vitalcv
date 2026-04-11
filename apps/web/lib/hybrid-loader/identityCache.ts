/**
 * identityCache.ts — Synchronous localStorage cache for provider identity.
 *
 * Part of the Hybrid Loader (see docs/superpowers/specs/2026-04-10-hybrid-loader-design.md).
 * This module provides a zero-dependency, sync-read cache so that surfaces
 * consuming provider identity can render instantly on first paint — even
 * on a hard reload — and then progressively upgrade via SSE.
 *
 * Design rules:
 *   - Sync read (no Promise) so `useState` lazy init can consume it without
 *     an intermediate render.
 *   - 24h TTL. Expired entries read as a cache miss (null), not as "stale".
 *     Trust state "stale" has its own meaning (decision-grade but aging).
 *   - Version field `v: 1`. Any breaking change bumps this and silently
 *     invalidates old entries.
 *   - SSR-safe: all methods return undefined/null when `window` is missing.
 *   - Best-effort writes: localStorage can throw (private mode, quota).
 *     We swallow those errors — the cache is a hint, not an invariant.
 *
 * Scope: only caches identity + standing + readiness (the "instant-render"
 * triple). Credentials, proof panels, and full PassportData blobs are
 * server-owned and intentionally not cached here.
 */

import type {
  StreamIdentity,
  StreamReadiness,
  StreamStanding,
} from '@/hooks/ingestStreamState';

const KEY_PREFIX = 'vcv:identity:v1:';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedIdentity {
  /** Schema version. Breaking changes bump this and silently invalidate old entries. */
  v: 1;
  /** Epoch ms when the entry was last written. Used for TTL. */
  savedAt: number;
  /** Canonical cache key (NPI for public surfaces, entityId for authenticated ones). */
  key: string;
  /** Authoritative identity snapshot. */
  identity: StreamIdentity;
  /** Standing snapshot (exclusion + enrollment). Optional — may not be known yet. */
  standing?: StreamStanding;
  /** Readiness snapshot. Optional — may not be known yet. */
  readiness?: StreamReadiness;
}

function storageKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

/**
 * Read a cached identity entry synchronously.
 *
 * Returns `null` on any of:
 *   - SSR (no window)
 *   - Missing entry
 *   - Malformed JSON
 *   - Version mismatch
 *   - TTL expired
 *
 * The caller cannot distinguish between these cases — all of them mean
 * "no usable cache, render empty or wait for SSE".
 */
export function readIdentity(key: string): CachedIdentity | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedIdentity;
    if (!parsed || parsed.v !== 1) {
      return null;
    }

    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > TTL_MS) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export interface WriteIdentityInput {
  identity: StreamIdentity;
  standing?: StreamStanding;
  readiness?: StreamReadiness;
}

/**
 * Write an identity entry to cache. Merges with any existing entry so that
 * partial updates (e.g. identity-only) don't clobber previously-cached
 * standing or readiness.
 *
 * This is a best-effort write. localStorage.setItem can throw in private
 * browsing mode or when the quota is exceeded; we swallow those errors
 * silently since the cache is a hint, not an invariant.
 */
export function writeIdentity(key: string, input: WriteIdentityInput): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const prev = readIdentity(key);
    const next: CachedIdentity = {
      v: 1,
      savedAt: Date.now(),
      key,
      identity: input.identity ?? prev?.identity ?? { authoritative: false },
      standing: input.standing ?? prev?.standing,
      readiness: input.readiness ?? prev?.readiness,
    };

    window.localStorage.setItem(storageKey(key), JSON.stringify(next));
  } catch {
    // quota exceeded, private mode, blocked by extension — best-effort
  }
}

/**
 * Remove a cache entry. Used by explicit invalidation flows (e.g. admin
 * re-runs ingest, or a surface wants to force-refresh).
 */
export function clearIdentity(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    // best-effort
  }
}
