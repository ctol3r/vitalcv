'use client';

/**
 * CandidateCard — one credential-ready clinician in the employer pool.
 *
 * PHI-free: shows NPI, specialty, locations, trust band (source coverage), readiness score, and
 * availability only. "Request review" wires into the real monetization flow: it POSTs to
 * /api/request-review and navigates to the returned review surface. Honest errors (e.g. an
 * employer workspace isn't set up yet) surface inline rather than failing silently.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, FileText, ArrowRight } from 'lucide-react';
import {
  bandDescriptor,
  formatAvailability,
  readinessLabel,
  type PoolCandidate,
} from '@/lib/matcha/pool';

const ACCENT = 'var(--vt-accent, #0A7B7F)';

export function CandidateCard({ candidate, now }: { candidate: PoolCandidate; now: number }) {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const band = bandDescriptor(candidate.trustBand);
  const locations = (candidate.locations ?? []).filter(Boolean);
  const passportHref = candidate.passportUrl ?? `/p/${candidate.npi}`;

  async function requestReview() {
    setRequesting(true);
    setError(null);
    try {
      const res = await fetch('/api/request-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi: candidate.npi }),
      });
      const data = (await res.json().catch(() => ({}))) as { reviewUrl?: string; error?: string };
      if (!res.ok || !data.reviewUrl) {
        setError(data.error ?? 'Set up your employer workspace to request a review.');
        return;
      }
      if (data.reviewUrl.startsWith('/')) router.push(data.reviewUrl);
      else window.location.href = data.reviewUrl;
    } catch {
      setError('Could not start a review just now. Please try again.');
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="matcha-lift" style={{ background: 'var(--vt-surface, #fff)', border: '1px solid var(--vt-border, #E2E8E6)', borderRadius: 16, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--vt-text-primary)' }}>
            {candidate.specialty || 'Clinician'}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--vt-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            NPI {candidate.npi}
          </p>
        </div>
        <span
          title={band.blurb}
          style={{
            flex: '0 0 auto',
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '6px 12px',
            borderRadius: 12,
            border: `1px solid color-mix(in srgb, ${ACCENT} 30%, transparent)`,
            background: `color-mix(in srgb, ${ACCENT} 10%, transparent)`,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: ACCENT }}>{band.label}</span>
          <span style={{ fontSize: 10, color: 'var(--vt-text-muted)' }}>{band.blurb}</span>
        </span>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, color: 'var(--vt-text-secondary)' }}>
        <span style={{ fontWeight: 600, color: 'var(--vt-text-primary)' }}>{readinessLabel(candidate.readinessScore)}</span>
        <span>{formatAvailability(candidate.availableFrom, now)}</span>
        {locations.length ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={13} aria-hidden="true" /> {locations.join(', ')}
          </span>
        ) : null}
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <a
          href={passportHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid var(--vt-border, #D6DED9)', color: 'var(--vt-text-primary)' }}
        >
          <FileText size={14} aria-hidden="true" /> View record
        </a>
        <button
          type="button"
          onClick={requestReview}
          disabled={requesting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: requesting ? 'default' : 'pointer', border: 0, background: ACCENT, color: '#fff', opacity: requesting ? 0.7 : 1 }}
        >
          {requesting ? 'Starting…' : 'Request review'} <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--vt-risk-high, #8C2A2A)', lineHeight: 1.5 }}>{error}</p>
      ) : null}

      <p style={{ margin: '14px 0 0', fontSize: 11, color: 'var(--vt-text-muted)', lineHeight: 1.5 }}>
        PHI-free — identity, specialty, and source-backed readiness only. Trust band reflects source
        coverage, not a hiring decision.
      </p>
    </div>
  );
}
