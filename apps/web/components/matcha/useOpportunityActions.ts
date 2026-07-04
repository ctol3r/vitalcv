'use client';

/**
 * useOpportunityActions — React state over the clinician's Save/Connect/Decline decisions,
 * backed by localStorage. Toggling a status off returns the opportunity to "new".
 */

import { useCallback, useEffect, useState } from 'react';
import {
  type OpportunityActionMap,
  type OpportunityBucket,
  type OpportunityStatus,
  bucketFor,
  loadOpportunityActions,
  persistOpportunityActions,
  statusCounts,
} from '@/lib/matcha/opportunityActions';

export function useOpportunityActions() {
  const [map, setMap] = useState<OpportunityActionMap>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMap(loadOpportunityActions());
    setLoaded(true);
  }, []);

  const setStatus = useCallback((id: string, status: OpportunityStatus) => {
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
  }, []);

  const bucketOf = useCallback((id: string): OpportunityBucket => bucketFor(map, id), [map]);
  const counts = useCallback((ids: readonly string[]) => statusCounts(map, ids), [map]);

  return { loaded, bucketOf, setStatus, counts };
}
