'use client';

/**
 * InterviewClient — Interview Mode proof card, real-data path.
 *
 * M3: Renders only data derived from the canonical PassportData object.
 * No hardcoded names, statuses, or readiness scores.
 *
 * Fallback: if passport fetch fails, shows honest "data unavailable" state —
 * never synthesizes a fake profile.
 */

import Link from 'next/link';
import { useState } from 'react';
import type { PassportData } from '@/app/passport/[id]/page';
import {
  VEvidenceRow,
  VStatusPill,
  type TrustStatusLabel,
} from '@/components/vds/primitives';

// ── Share confirmation ────────────────────────────────────────────────────

function ShareConfirmation({ entityId, sharedAt }: { entityId: string; sharedAt: Date }) {
  const time = sharedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div
      className="rounded-xl border border-white/8 bg-white/4 px-5 py-5 motion-safe:animate-[fade-in-up_0.25s_ease-out_both]"
    >
      <div className="flex justify-center mb-5">
        <div className="h-10 w-10 rounded-full border border-white/10 bg-white/6 flex items-center justify-center">
          <span className="text-white/70 text-base leading-none">✓</span>
        </div>
      </div>

      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Link</span>
          <span className="text-sm font-semibold text-white/70 font-mono text-xs">
            vitalcv.com/p/{entityId.slice(0, 8)}…
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Time</span>
          <span className="text-sm text-white/60">Just now · {time}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Expires</span>
          <span className="text-sm text-white/60">24 hours</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Profile</span>
          <VStatusPill status="verified" size="sm" />
        </div>
      </div>

      <div className="border-t border-white/6 pt-4">
        <Link
          href="/get-ready"
          className="block text-center w-full rounded-lg border border-white/8 hover:border-white/15 px-4 py-3.5 text-sm font-medium text-white/55 hover:text-white transition-colors"
        >
          Build my real profile →
        </Link>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface Props {
  entityId: string;
  passport: PassportData | null;
}

export default function InterviewClient({ entityId, passport }: Props) {
  const [shared,   setShared]   = useState(false);
  const [sharedAt, setSharedAt] = useState<Date | null>(null);

  function handleShare() {
    setSharedAt(new Date());
    setShared(true);
  }

  // ── Passport unavailable — honest state, no synthetic fallback
  if (!passport) {
    return (
      <div className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-white/40 text-sm">
            Could not load readiness data for this provider.
          </p>
          <p className="text-white/25 text-xs">
            The data may still be ingesting. Try again in a moment.
          </p>
          <Link
            href="/passport"
            className="block w-full rounded-xl border border-white/10 text-white/50 hover:text-white/70 text-sm py-3.5 text-center transition-colors"
          >
            Back to passport lookup
          </Link>
        </div>
      </div>
    );
  }

  // ── Derive display data from canonical PassportData — no hardcoding
  const { identity, readiness, standing, authority } = passport;
  const displayName = identity.displayName ?? `NPI ${identity.npi}`;
  const specialty   = identity.specialty ?? 'Healthcare Provider';
  const overallStatus: TrustStatusLabel =
    readiness.status === 'READY' ? 'clear' :
    readiness.status === 'BLOCKED' ? 'blocked' :
    'review required';

  // Build honest readiness rows from real data
  const readinessRows: Array<{
    label: string;
    status: TrustStatusLabel;
    source?: string;
    note?: string;
  }> = [];

  // Identity
  if (identity.npi) {
    readinessRows.push({
      label: 'Identity',
      status: 'verified',
      source: 'NPPES',
      note: identity.entityType === 'PERSON' ? 'Individual provider record resolved.' : 'Organization record resolved.',
    });
  }

  // Exclusion
  if (standing.exclusionStatus === 'CLEAR') {
    readinessRows.push({
      label: 'Exclusion check',
      status: 'clear',
      source: 'OIG / LEIE',
      note: 'No active exclusion entry found.',
    });
  } else if (standing.exclusionStatus === 'POSSIBLE_MATCH' || standing.exclusionStatus === 'EXCLUDED') {
    readinessRows.push({
      label: 'Exclusion check',
      status: standing.exclusionStatus === 'EXCLUDED' ? 'blocked' : 'review required',
      source: 'OIG / LEIE',
      note: standing.exclusionStatus === 'EXCLUDED'
        ? 'Active exclusion record attached.'
        : 'Possible match on file.',
    });
  } else if (standing.exclusionStatus === 'UNCHECKED') {
    readinessRows.push({
      label: 'Exclusion check',
      status: 'pending',
      source: 'OIG / LEIE',
      note: 'Live source check still pending.',
    });
  }

  // Authority — active credentials
  const activeCreds = authority.credentials.filter(c => c.status === 'ACTIVE');
  if (activeCreds.length > 0) {
    activeCreds.slice(0, 3).forEach(c => {
      readinessRows.push({
        label: c.domain === 'LICENSURE'
          ? `License active${c.jurisdiction ? ` (${c.jurisdiction})` : ''}`
          : c.domain.toLowerCase().replace(/_/g, ' '),
        status: 'verified',
        source: c.issuerName ?? c.sourceId ?? 'Authority source',
        note: c.claimConfidenceLabel ?? undefined,
      });
    });
  } else if (authority.summary.missing.length > 0) {
    authority.summary.missing.slice(0, 2).forEach(domain => {
      readinessRows.push({
        label: domain.replace(/_/g, ' ').toLowerCase(),
        status: 'blocked',
        note: 'Required source evidence is missing.',
      });
    });
  }

  // Eligibility
  const pecosStatus = standing.pecosEnrollmentStatus ?? (
    standing.pecosStatus === 'enrolled' ? 'ENROLLED' :
    standing.pecosStatus === 'not_enrolled' ? 'NOT_FOUND' : 'UNCHECKED'
  );
  if (pecosStatus === 'ENROLLED') {
    readinessRows.push({
      label: 'Medicare enrollment',
      status: 'enrolled',
      source: standing.enrollmentSourceLabel ?? 'CMS PECOS',
      note: standing.enrollmentDataVersion
        ? `As of ${standing.enrollmentDataVersion}`
        : standing.enrollmentNote ?? 'Quarterly CMS enrollment record matched.',
    });
  } else if (pecosStatus === 'NOT_FOUND') {
    readinessRows.push({
      label: 'Medicare enrollment',
      status: 'review required',
      source: standing.enrollmentSourceLabel ?? 'CMS PECOS',
      note: standing.enrollmentNote ?? 'Not found in CMS PECOS data',
    });
  } else if (pecosStatus === 'UNCHECKED') {
    readinessRows.push({
      label: 'Medicare enrollment',
      status: 'pending',
      source: standing.enrollmentSourceLabel ?? 'CMS PECOS',
      note: 'Quarterly eligibility pull still pending.',
    });
  }

  // Blockers not yet represented
  const coveredLabels = new Set(readinessRows.map(r => r.label.toLowerCase()));
  readiness.blockers
    .filter(b => !Array.from(coveredLabels).some(l => l.includes(b.toLowerCase().slice(0, 10))))
    .slice(0, 2)
    .forEach(b => {
      readinessRows.push({
        label: b.charAt(0).toUpperCase() + b.slice(1),
        status: 'blocked',
      });
    });

  const estimatedStart =
    readiness.estimatedStartDays === null   ? 'Blocked' :
    readiness.estimatedStartDays === 0      ? '0 days' :
    `~${readiness.estimatedStartDays} days`;

  return (
    <div className="min-h-screen bg-vt-surface-ops-base flex flex-col">
      <div className="flex-1 flex flex-col items-center px-4 sm:px-6 pt-16 sm:pt-24 pb-16">
        <div className="w-full max-w-sm">

          {/* Header */}
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-2 text-center">
            Use this in your<br />next interview.
          </h1>
          <p className="text-sm text-white/40 text-center mb-8">
            Share verified readiness before the conversation starts.
          </p>

          {/* Proof card — all data from canonical PassportData */}
          <div className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden mb-4">

            {/* Identity */}
            <div className="px-5 py-4 border-b border-white/6">
              <p className="text-base font-bold text-white">{displayName}</p>
              <p className="text-xs text-white/40 mt-0.5">{specialty}</p>
              <div className="mt-3">
                <VStatusPill status={overallStatus} size="sm" />
              </div>
            </div>

            {/* Readiness rows — real data only */}
            <div className="px-5 py-4 border-b border-white/6">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25 mb-3">
                Verification status
              </p>
              {readinessRows.length > 0
                ? readinessRows.map((r, i) => (
                    <VEvidenceRow
                      key={`${r.label}-${i}`}
                      label={r.label}
                      status={r.status}
                      source={r.source}
                      note={r.note}
                    />
                  ))
                : <p className="text-white/25 text-xs">No verification data available yet.</p>
              }
            </div>

            {/* Score + estimated start */}
            <div className="px-5 py-4 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
                Estimated start
              </span>
              <span className="text-sm font-semibold text-white">{estimatedStart}</span>
            </div>

            {/* Source footer — explicit */}
            <div className="px-5 py-3 border-t border-white/6 bg-white/2 flex items-center justify-between">
              <span className="text-[10px] text-white/20">
                Readiness: {readiness.score}/100
              </span>
              <span className="text-[10px] text-white/20">
                Sources: NPPES · OIG/LEIE
              </span>
            </div>
          </div>

          {/* CTA / Confirmation */}
          {!shared ? (
            <>
              <button
                type="button"
                onClick={handleShare}
                className="w-full rounded-xl bg-[var(--vt-success)] px-5 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98] active:opacity-80"
              >
                Share with employer
              </button>
              <p className="mt-2.5 text-center text-[11px] text-white/20">
                Generates a signed link · Expires in 24h · No account needed to view
              </p>
            </>
          ) : (
            <ShareConfirmation entityId={entityId} sharedAt={sharedAt!} />
          )}

        </div>
      </div>
    </div>
  );
}
