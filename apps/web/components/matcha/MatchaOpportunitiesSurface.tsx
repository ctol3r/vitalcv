'use client';

/**
 * MatchaOpportunitiesSurface — Wave 4. Fetches live matches from the MATCHA engine and
 * renders them as Opportunity Intelligence Cards. Preference-grounded reasons are layered
 * on from the clinician's own stored answers. Honest empty / loading / error states.
 */

import { useMemo } from 'react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { useMatchaPreferences } from './useMatchaPreferences';
import { OpportunityCard } from './OpportunityCard';
import { useOpportunityActions } from './useOpportunityActions';
import { useMatchaOpportunities } from './useMatchaOpportunities';
import { BUCKET_LABEL, BUCKET_ORDER } from '@/lib/matcha/opportunityActions';
import { preferenceMatchReasons } from '@/lib/matcha/opportunityFit';

export function MatchaOpportunitiesSurface() {
  const { data } = useClinicianMobile();
  const npi = data.workspace?.personProfile?.npi ?? null;
  const { preferences } = useMatchaPreferences(npi ?? undefined);
  const { loaded: actionsLoaded, bucketOf, setStatus, counts } = useOpportunityActions(npi);
  const { matches, state } = useMatchaOpportunities(npi);

  const ids = useMemo(
    () => matches.map((m) => m.opportunity?.id).filter((id): id is string => Boolean(id)),
    [matches],
  );
  const bucketCounts = counts(ids);

  return (
    <div className="mz mz-paper matcha-enter" style={{ maxWidth: 820, margin: '0 auto', padding: '28px 24px 96px', display: 'grid', gap: 16, minHeight: '100vh' }}>
      <header style={{ marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--vt-text-primary)' }}>
          Opportunities we found
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--vt-text-secondary)' }}>
          Scored on your credential eligibility, explained with your own preferences.
        </p>
      </header>

      {/* Status counters — New / Saved / Connected / Declined */}
      {state === 'ready' && matches.length > 0 && actionsLoaded && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {BUCKET_ORDER.map((b) => (
            <div key={b} style={{ background: 'var(--vt-surface, #fff)', border: '1px solid var(--vt-border, #E2E8E6)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--vt-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{bucketCounts[b]}</div>
              <div style={{ fontSize: 11, color: 'var(--vt-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{BUCKET_LABEL[b]}</div>
            </div>
          ))}
        </div>
      )}

      {state === 'no-npi' && (
        <EmptyNote title="Add your NPI to get matches" body="Once your NPI is on file, we can score real opportunities for you." />
      )}
      {state === 'loading' && <EmptyNote title="Checking opportunities…" body="Scoring live roles against your trust state." />}
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
            <OpportunityCard
              key={opp.id ?? i}
              opportunity={opp}
              explanation={m.explanation}
              preferenceReasons={reasons}
              bucket={bucketOf(opp.id)}
              onSetStatus={(status) => setStatus(opp.id, status)}
              npi={npi}
              detailHref={`/holder/opportunities/${encodeURIComponent(opp.id)}`}
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
