'use client';

/**
 * MatchaOpportunitiesSurface — Wave 4. Fetches live matches from the MATCHA engine and
 * renders them as Opportunity Intelligence Cards. Preference-grounded reasons are layered
 * on from the clinician's own stored answers. Honest empty / loading / error states.
 */

import { useEffect, useState } from 'react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { useMatchaPreferences } from './useMatchaPreferences';
import {
  OpportunityIntelligenceCard,
  type IntelligenceExplanation,
  type IntelligenceOpportunity,
} from './OpportunityIntelligenceCard';
import { preferenceMatchReasons, type FitOpportunity } from '@/lib/matcha/opportunityFit';

interface RawMatch {
  opportunity?: Record<string, unknown> & IntelligenceOpportunity & FitOpportunity;
  explanation?: IntelligenceExplanation;
}

type LoadState = 'loading' | 'ready' | 'error' | 'no-npi';

export function MatchaOpportunitiesSurface() {
  const { data } = useClinicianMobile();
  const npi = data.workspace?.personProfile?.npi ?? null;
  const { preferences } = useMatchaPreferences(npi ?? undefined);

  const [matches, setMatches] = useState<RawMatch[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    if (!npi) {
      setState('no-npi');
      return;
    }
    let cancelled = false;
    setState('loading');
    fetch(`/api/matcha/opportunities/${encodeURIComponent(npi)}`, { signal: AbortSignal.timeout(16_000) })
      .then((r) => r.json())
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

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 20px 96px', display: 'grid', gap: 16 }}>
      <header style={{ marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--vt-text-primary)' }}>
          Opportunities MATCHA found
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--vt-text-secondary)' }}>
          Scored on your credential eligibility, explained with your own preferences.
        </p>
      </header>

      {state === 'no-npi' && (
        <EmptyNote title="Add your NPI to get matches" body="Once your NPI is on file, MATCHA can score real opportunities for you." />
      )}
      {state === 'loading' && <EmptyNote title="Checking opportunities…" body="MATCHA is scoring live roles against your trust state." />}
      {state === 'error' && (
        <EmptyNote title="Matches are temporarily unavailable" body="This is a live check — please try again shortly. Nothing about your profile changed." />
      )}
      {state === 'ready' && matches.length === 0 && (
        <EmptyNote title="No live matches yet" body="As opportunities are posted that fit your credentials, they'll appear here." />
      )}

      {state === 'ready' &&
        matches.map((m, i) => {
          const opp = m.opportunity;
          if (!opp?.id) return null;
          const reasons = preferenceMatchReasons(preferences, opp);
          return (
            <OpportunityIntelligenceCard
              key={opp.id ?? i}
              opportunity={opp}
              explanation={m.explanation}
              preferenceReasons={reasons}
              href={`/holder/opportunities`}
            />
          );
        })}
    </div>
  );
}

function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        background: 'var(--vt-surface, #fff)',
        border: '1px solid var(--vt-border, #E2E8E6)',
        borderRadius: 16,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--vt-text-primary)' }}>{title}</p>
      <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--vt-text-secondary)' }}>{body}</p>
    </div>
  );
}
