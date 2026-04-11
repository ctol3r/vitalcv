'use client';

/**
 * useHybridProviderData — Instant-render provider identity with progressive SSE upgrade.
 *
 * Composes three primitives into a single consumer-facing hook:
 *
 *   1. An SSR seed (from PassportData passed by a server component), if available
 *   2. A synchronous localStorage cache (identityCache.ts), read at lazy-init time
 *   3. The canonical streaming hook (useIngestStream), which owns the SSE loop
 *
 * Precedence on first paint:
 *   SSR seed  >  cache  >  empty initial state
 *
 * Once the hook mounts, useIngestStream owns the state transitions via its
 * reducer (applyIngestEvent). We subscribe as a side-effect and write through
 * to cache whenever `state.isUsable === true`.
 *
 * The underlying useIngestStream is NEVER modified — /passport can continue
 * to call it directly without adopting this wrapper.
 *
 * See: docs/superpowers/specs/2026-04-10-hybrid-loader-design.md
 */

import { useEffect, useRef } from 'react';

import {
  readIdentity,
  writeIdentity,
  type CachedIdentity,
} from '@/lib/hybrid-loader/identityCache';
import { useIngestStream } from '@/hooks/useIngestStream';
import {
  createInitialIngestStreamState,
  type IngestStreamState,
} from '@/hooks/ingestStreamState';

const NPI_PATTERN = /^\d{10}$/;

export interface HybridProviderDataInput {
  /** Canonical cache key. NPI for public surfaces, entityId for authenticated ones. */
  key: string | null | undefined;
  /** Server-rendered seed (e.g. from ReviewPageClient). Wins over cache on first paint. */
  ssrSeed?: IngestStreamState | null;
  /**
   * Whether to automatically start an SSE ingest on mount.
   * Only fires when `key` matches the 10-digit NPI shape. Defaults to `true`.
   */
  autoStart?: boolean;
}

/**
 * Reconstitute an IngestStreamState from a cached identity entry. Marks the
 * state as usable (`isUsable: true`) iff the cached identity is authoritative,
 * matching the invariant that the cache only persists authoritative data.
 */
function hydrateFromCache(cached: CachedIdentity): IngestStreamState {
  const base = createInitialIngestStreamState();

  return {
    ...base,
    phase: 'done',
    npi: cached.key.length === 10 && NPI_PATTERN.test(cached.key) ? cached.key : undefined,
    identity: cached.identity,
    standing: cached.standing ?? base.standing,
    readiness: cached.readiness ?? base.readiness,
    anchorEntityId: cached.identity.authoritative ? cached.identity.entityId : undefined,
    isUsable: cached.identity.authoritative,
    readyAt: cached.identity.authoritative
      ? new Date(cached.savedAt).toISOString()
      : undefined,
    sources: {
      nppes: cached.identity.authoritative ? 'done' : 'pending',
      oig: cached.standing?.exclusionChecked ? 'done' : 'pending',
      pecos: cached.standing?.enrollmentChecked ? 'done' : 'pending',
    },
  };
}

/**
 * Compute the initial state once, synchronously.
 *
 * Called from a `useRef` lazy init so it runs exactly once per mount.
 * Returning `undefined` means "let useIngestStream use its own default".
 */
function computeInitialState(
  key: string | null | undefined,
  ssrSeed: IngestStreamState | null | undefined,
): IngestStreamState | undefined {
  if (ssrSeed) {
    return ssrSeed;
  }

  if (!key) {
    return undefined;
  }

  const cached = readIdentity(key);
  if (!cached) {
    return undefined;
  }

  return hydrateFromCache(cached);
}

/**
 * Public API — a thin wrapper around `useIngestStream` that adds a cache
 * layer and an SSR seed bridge. Returns the same shape as `useIngestStream`
 * (state + imperative functions), so consumers can swap between them freely.
 */
export function useHybridProviderData({
  key,
  ssrSeed,
  autoStart = true,
}: HybridProviderDataInput) {
  // Lazy-compute the initial state exactly once. A ref (not useState) because
  // useIngestStream owns the authoritative state; we only feed it a seed.
  const seedRef = useRef<IngestStreamState | undefined | null>(null);
  if (seedRef.current === null) {
    seedRef.current = computeInitialState(key, ssrSeed);
  }

  const hook = useIngestStream(seedRef.current);

  // Write-through cache — persist only authoritative state. The dependency
  // intentionally targets the fields we actually cache, so unrelated state
  // churn (events log, disconnected flag) doesn't re-trigger the effect.
  const { state } = hook;
  useEffect(() => {
    if (!key) {
      return;
    }
    if (!state.isUsable) {
      return;
    }
    writeIdentity(key, {
      identity: state.identity,
      standing: state.standing,
      readiness: state.readiness,
    });
  }, [
    key,
    state.isUsable,
    state.identity,
    state.standing,
    state.readiness,
  ]);

  // Auto-start the SSE ingest run when we have an NPI-shaped key. EntityId-
  // keyed surfaces don't trigger the public ingest run; they rely on the seed
  // or cache and a server-initiated refresh.
  const startIngest = hook.startIngest;
  useEffect(() => {
    if (!autoStart) {
      return;
    }
    if (!key || !NPI_PATTERN.test(key)) {
      return;
    }
    void startIngest(key);
  }, [autoStart, key, startIngest]);

  return hook;
}
