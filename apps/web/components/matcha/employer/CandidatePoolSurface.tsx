'use client';

/**
 * CandidatePoolSurface — the employer's MATCHA talent pool. Filter credential-ready clinicians by
 * specialty / state / trust band, then lead into the existing review flow. Honest empty, error,
 * and unauthorized states — no fabricated candidates.
 */

import { useMemo, useState } from 'react';
import { useCandidatePool } from './useCandidatePool';
import { CandidateCard } from './CandidateCard';
import type { TrustBand } from '@/lib/matcha/pool';

const ACCENT = 'var(--vt-accent, #0A7B7F)';
const BANDS: TrustBand[] = ['L1', 'L2', 'L3'];

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  borderRadius: 10,
  border: '1px solid var(--vt-border, #D6DED9)',
  background: 'var(--vt-surface, #fff)',
  color: 'var(--vt-text-primary)',
  outline: 'none',
  minWidth: 0,
};

export function CandidatePoolSurface() {
  const { filters, setFilters, candidates, state } = useCandidatePool();
  const [specialty, setSpecialty] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const now = useMemo(() => Date.now(), [candidates]);

  function applyFilters() {
    setFilters({ ...filters, specialty: specialty || undefined, state: stateFilter || undefined });
  }

  return (
    <div className="mz mz-paper matcha-enter" style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px 96px', display: 'grid', gap: 20, minHeight: '100vh' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: 'var(--vt-text-primary)', letterSpacing: '-0.01em' }}>
          Credential-ready clinicians
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--vt-text-secondary)', lineHeight: 1.55 }}>
          A pool of clinicians with source-backed readiness, ranked by trust band. Start a review to
          see the full proof packet — you begin from a head start, not a blank file.
        </p>
      </header>

      {/* Filters */}
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr)) auto', gap: 10 }}>
          <input style={inputStyle} placeholder="Specialty (e.g. Cardiology)" value={specialty} onChange={(e) => setSpecialty(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
          <input style={inputStyle} placeholder="State (e.g. CA)" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
          <button type="button" onClick={applyFilters} style={{ padding: '10px 18px', borderRadius: 10, border: 0, background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Search
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--vt-text-muted)' }}>Min trust band:</span>
          {BANDS.map((b) => {
            const active = filters.trustBand === b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setFilters({ ...filters, trustBand: active ? undefined : b })}
                aria-pressed={active}
                style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? ACCENT : 'var(--vt-border, #D6DED9)'}`, background: active ? `color-mix(in srgb, ${ACCENT} 12%, transparent)` : 'var(--vt-surface, #fff)', color: active ? ACCENT : 'var(--vt-text-primary)' }}
              >
                {b}
              </button>
            );
          })}
        </div>
      </div>

      {/* States */}
      {state === 'loading' && <Note title="Finding credential-ready clinicians…" body="Checking live trust state for the pool." />}
      {state === 'unauthorized' && <Note title="Employer sign-in required" body="Sign in with your employer workspace to view the candidate pool." />}
      {state === 'error' && <Note title="The pool is temporarily unavailable" body="This is a live query — please try again shortly." />}
      {state === 'ready' && candidates.length === 0 && (
        <Note title="No candidates match yet" body="Broaden your filters, or check back as more clinicians reach credential readiness." />
      )}

      {state === 'ready' && candidates.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {candidates.map((c) => (
            <CandidateCard key={c.npi} candidate={c} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ background: 'var(--vt-surface, #fff)', border: '1px solid var(--vt-border, #E2E8E6)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--vt-text-primary)' }}>{title}</p>
      <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--vt-text-secondary)' }}>{body}</p>
    </div>
  );
}
