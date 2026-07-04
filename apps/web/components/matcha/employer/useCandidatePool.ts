'use client';

/**
 * useCandidatePool — fetches the credential-ready clinician pool for employers, with filters.
 * Honest states: loading / ready / error / unauthorized (the pool API is Clerk-gated).
 */

import { useCallback, useEffect, useState } from 'react';
import { buildPoolQuery, type PoolCandidate, type PoolFilters } from '@/lib/matcha/pool';

export type PoolLoadState = 'loading' | 'ready' | 'error' | 'unauthorized';

export function useCandidatePool(initial: PoolFilters = {}) {
  const [filters, setFilters] = useState<PoolFilters>(initial);
  const [candidates, setCandidates] = useState<PoolCandidate[]>([]);
  const [state, setState] = useState<PoolLoadState>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    const qs = buildPoolQuery(filters);
    fetch(`/api/marketplace/pool${qs ? `?${qs}` : ''}`, { signal: AbortSignal.timeout(16_000) })
      .then(async (r) => {
        if (r.status === 401) {
          if (!cancelled) setState('unauthorized');
          return null;
        }
        // Any other non-OK is a service failure — never let it read as an
        // honest "no candidates" empty state (a failure masquerading as no supply).
        if (!r.ok) {
          if (!cancelled) setState('error');
          return null;
        }
        const payload = (await r.json().catch(() => ({}))) as { pool?: PoolCandidate[] };
        if (cancelled) return null;
        setCandidates(Array.isArray(payload.pool) ? payload.pool : []);
        setState('ready');
        return null;
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [filters, reloadKey]);

  return { filters, setFilters, candidates, state, reload };
}
