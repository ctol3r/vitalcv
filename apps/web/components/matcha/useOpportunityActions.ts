'use client';

/**
 * useOpportunityActions — React state over the clinician's Save/Connect/Decline decisions.
 * Server-persisted (append-only OpportunityAction rows keyed by the authenticated Clerk
 * user) with localStorage as the optimistic cache: every tap updates local state
 * immediately and fires a best-effort POST; on mount the server's decisions are merged
 * over the local cache so they follow the clinician across devices. Toggling a status
 * off returns the opportunity to "new" (recorded server-side as 'cleared').
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type OpportunityActionMap,
  type OpportunityActionValue,
  type OpportunityBucket,
  type OpportunityStatus,
  actionValueForTap,
  bucketFor,
  loadOpportunityActions,
  mergeServerActions,
  persistOpportunityActions,
  statusCounts,
} from '@/lib/matcha/opportunityActions';

function postActionBestEffort(id: string, action: OpportunityActionValue, npi?: string | null): void {
  try {
    void fetch(`/api/matcha/opportunity/${encodeURIComponent(id)}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(npi ? { npi } : {}) }),
      keepalive: true,
    }).catch(() => {
      /* localStorage remains the fallback */
    });
  } catch {
    /* no-op — never let persistence break the interaction */
  }
}

export function useOpportunityActions(npi?: string | null) {
  const [map, setMap] = useState<OpportunityActionMap>({});
  const [loaded, setLoaded] = useState(false);
  const mapRef = useRef<OpportunityActionMap>({});
  // Ids acted on this session — a late server hydrate must not clobber them.
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  useEffect(() => {
    setMap(loadOpportunityActions());
    setLoaded(true);

    let cancelled = false;
    fetch('/api/matcha/opportunity-actions', { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { actions?: Record<string, OpportunityActionValue> } | null) => {
        if (cancelled || !payload?.actions) return;
        const server = Object.fromEntries(
          Object.entries(payload.actions).filter(([id]) => !pendingRef.current.has(id)),
        );
        setMap((prev) => {
          const next = mergeServerActions(prev, server);
          persistOpportunityActions(next);
          return next;
        });
      })
      .catch(() => {
        /* signed-out / offline / table not deployed — local cache stands */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = useCallback(
    (id: string, status: OpportunityStatus) => {
      const requestValue = actionValueForTap(mapRef.current, id, status);
      pendingRef.current.add(id);
      setMap((prev) => {
        const next = { ...prev };
        if (next[id] === status) {
          delete next[id]; // toggle back to "new"
        } else {
          next[id] = status;
        }
        persistOpportunityActions(next);
        return next;
      });
      postActionBestEffort(id, requestValue, npi);
    },
    [npi],
  );

  const bucketOf = useCallback((id: string): OpportunityBucket => bucketFor(map, id), [map]);
  const counts = useCallback((ids: readonly string[]) => statusCounts(map, ids), [map]);

  return { loaded, bucketOf, setStatus, counts };
}
