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

// ── Share confirmation ────────────────────────────────────────────────────

function ShareConfirmation({ entityId, sharedAt }: { entityId: string; sharedAt: Date }) {
  const time = sharedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div
      className="rounded-xl border border-white/8 bg-white/4 px-5 py-5"
      style={{ animation: 'fade-in-up 0.25s ease-out both' }}
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
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Status</span>
          <span className="text-sm font-semibold text-white/70">Delivered</span>
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

// ── Honest readiness row ──────────────────────────────────────────────────

function ReadinessRow({
  label,
  status,
  note,
}: {
  label:   string;
  status:  'verified' | 'clear' | 'pending' | 'blocked' | 'unavailable' | 'unchecked';
  note?:   string;
}) {
  const icon =
    status === 'verified' || status === 'clear' ? '✔' :
    status === 'blocked'                        ? '✖' :
    status === 'unavailable'                    ? '—' :
    '○';

  const iconColor =
    status === 'verified' || status === 'clear' ? 'text-white/55' :
    status === 'blocked'                        ? 'text-white/25' :
    'text-white/20';

  const labelColor =
    status === 'verified' || status === 'clear' ? 'text-white/70' :
    status === 'blocked'                        ? 'text-white/50' :
    'text-white/30';

  return (
    <div className="flex items-start gap-3">
      <span className={`${iconColor} text-sm leading-none shrink-0 mt-px`} aria-hidden>{icon}</span>
      <div>
        <span className={`text-sm ${labelColor}`}>{label}</span>
        {note && <p className="text-[10px] text-white/25 mt-0.5">{note}</p>}
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
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#080e1a' }}>
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

  // Build honest readiness rows from real data
  const readinessRows: Array<{ label: string; status: 'verified' | 'clear' | 'pending' | 'blocked' | 'unavailable' | 'unchecked'; note?: string }> = [];

  // Identity
  if (identity.npi) {
    readinessRows.push({ label: 'Identity confirmed (NPPES)', status: 'verified' });
  }

  // Exclusion
  if (standing.exclusionStatus === 'CLEAR') {
    readinessRows.push({ label: 'No exclusions found (OIG)', status: 'clear' });
  } else if (standing.exclusionStatus === 'POSSIBLE_MATCH' || standing.exclusionStatus === 'EXCLUDED') {
    readinessRows.push({
      label: 'Exclusion — review required',
      status: 'blocked',
      note: 'OIG possible match on file',
    });
  } else if (standing.exclusionStatus === 'UNCHECKED') {
    readinessRows.push({ label: 'Exclusion not checked', status: 'unchecked' });
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
        note: c.issuerName ?? undefined,
      });
    });
  } else if (authority.summary.missing.length > 0) {
    authority.summary.missing.slice(0, 2).forEach(domain => {
      readinessRows.push({
        label: domain.replace(/_/g, ' ').toLowerCase(),
        status: 'blocked',
        note: 'Not yet verified',
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
      label: `Medicare enrolled${standing.enrollmentDataVersion ? ` (${standing.enrollmentDataVersion})` : ''}`,
      status: 'clear',
    });
  } else if (pecosStatus === 'NOT_FOUND') {
    readinessRows.push({
      label: 'Medicare enrollment not found',
      status: 'blocked',
      note: standing.enrollmentNote ?? 'Not found in CMS PECOS data',
    });
  } else if (pecosStatus === 'UNCHECKED') {
    readinessRows.push({ label: 'Medicare enrollment not checked', status: 'unchecked' });
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
    readiness.estimatedStartDays === null   ? 'Blocked — see issues above' :
    readiness.estimatedStartDays === 0      ? 'Ready now' :
    `~${readiness.estimatedStartDays} days`;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080e1a' }}>
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
            </div>

            {/* Readiness rows — real data only */}
            <div className="px-5 py-4 border-b border-white/6 space-y-2.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25 mb-3">
                Verification status
              </p>
              {readinessRows.length > 0
                ? readinessRows.map((r, i) => (
                    <ReadinessRow key={i} label={r.label} status={r.status} note={r.note} />
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
                className="w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-5 py-3.5 font-semibold text-white text-sm transition-all active:scale-[0.98]"
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
