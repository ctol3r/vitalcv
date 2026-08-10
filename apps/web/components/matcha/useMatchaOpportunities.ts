'use client';

/**
 * useMatchaOpportunities — fetches live matches from the MATCHA engine for an NPI.
 * Shared by the opportunities surface and the dashboard so the fetch lives in one place.
 */

import { useEffect, useState } from 'react';
import type {
  IntelligenceExplanation,
  IntelligenceOpportunity,
} from './OpportunityIntelligenceCard';
import type { FitOpportunity } from '@/lib/matcha/opportunityFit';

export interface RawMatch {
  opportunity?: Record<string, unknown> & IntelligenceOpportunity & FitOpportunity;
  explanation?: IntelligenceExplanation;
}

export type MatchLoadState = 'loading' | 'ready' | 'error' | 'no-npi';

export function useMatchaOpportunities(npi: string | null | undefined) {
  const [matches, setMatches] = useState<RawMatch[]>([]);
  const [state, setState] = useState<MatchLoadState>('loading');

  useEffect(() => {
    if (!npi) {
      setState('no-npi');
      setMatches([]);
      return;
    }
    let cancelled = false;
    setState('loading');
    fetch(`/api/matcha/opportunities/${encodeURIComponent(npi)}`, { signal: AbortSignal.timeout(16_000) })
      .then((r) => {
        // A backend failure (e.g. 502 with { matches: [] }) must NOT read as an
        // honest "no matches" empty state — surface it as an error instead.
        if (!r.ok) throw new Error(`opportunities ${r.status}`);
        return r.json();
      })
      .then((payload: { matches?: RawMatch[] }) => {
        if (cancelled) return;
        setMatches(Array.isArray(payload.matches) ? payload.matches : []);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [npi]);

  return { matches, state };
}
