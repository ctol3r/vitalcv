'use client';

export const dynamic = 'force-dynamic';

/**
 * /passport — Wallet entry + live ingest hydration
 *
 * Flow: TYPE → SEE → TRUST → SHARE
 *
 * 1. User enters NPI
 * 2. POST /api/ingest/:npi → runId
 * 3. SSE stream → progressive hydration
 *    - Identity appears first (NPPES, ~1s)
 *    - Sanctions status next (OIG, ~2s)
 *    - Enrollment next (PECOS, ~3s)
 *    - Readiness recalculates on claim_update
 * 4. Done → [View full passport] or [View as employer]
 *
 * No polling. No full-page reload. No fake refresh.
 */

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ReadinessExplanationCard } from '@/components/trust/ReadinessExplanationCard';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { TrustStatusBadge, type TrustBadgeStatus } from '@/components/ui/trust-status-badge';
import { useIngestStream, type StreamPhase } from '@/hooks/useIngestStream';
import { buildReadinessExplanation } from '@/lib/trust/readiness-explainer';
import {
  resolvePublicProviderDisplayName,
  resolvePublicProviderSpecialty,
} from '@/lib/trust/public-provider-identity';
import {
  buildEmployerReviewHref,
  buildPassportEntityHref,
  getPublicWedgeSurfaceBadgeMeta,
  type PublicWedgeSurfaceState,
} from '@/lib/trust/public-wedge-parity';
import { trackPilotEvent } from '@/lib/pilot-ops/client';
import { UX_EVENTS } from '@/lib/analytics/ux-events';

// ── Status label helper ────────────────────────────────────────────────────────

/**
 * Translate internal API error codes into user-readable messages.
 * Raw codes like 'organization_context_required' must never surface to users.
 */
function resolveIngestErrorCopy(raw: string | undefined | null): {
  title: string;
  description: string;
} {
  const degradedCopy = {
    title: "We couldn't load your readiness snapshot right now.",
    description: 'Try this NPI again in a moment.',
  } as const;

  if (!raw) return degradedCopy;
  const normalized = raw.toLowerCase().replace(/[_\s]+/g, '_');

  if (normalized.includes('organization_context') || normalized.includes('org_required')) {
    return degradedCopy;
  }
  if (normalized.includes('npi') && normalized.includes('invalid')) {
    return {
      title: 'That NPI was not found.',
      description: 'Check the 10-digit number and try this NPI again.',
    };
  }
  if (normalized.includes('timeout') || normalized.includes('timed_out')) {
    return degradedCopy;
  }
  if (normalized.includes('unavailable') || normalized.includes('backend')) {
    return degradedCopy;
  }

  return degradedCopy;
}

const PHASE_LABEL: Record<StreamPhase, string> = {
  idle:       '',
  starting:   'Connecting to primary sources…',
  nppes:      'Checking primary sources…',
  sanctions:  'Checking sanctions and exclusions…',
  enrollment: 'Checking Medicare enrollment…',
  done:       'Complete',
  error:      'Error',
};

// ── Source row ─────────────────────────────────────────────────────────────────

type SourceState = 'pending' | 'checking' | 'done' | 'error' | 'access_required';

function resolveSourceBadge(state: SourceState, displayValue: string): {
  status: TrustBadgeStatus;
  label: string;
} {
  if (state === 'checking') {
    return { status: 'pending', label: 'Checking' };
  }

  if (state === 'pending') {
    return { status: 'pending', label: 'Queued' };
  }

  if (state === 'access_required') {
    const meta = getPublicWedgeSurfaceBadgeMeta('access_required');
    return { status: meta.status, label: meta.label };
  }

  if (state === 'error') {
    const meta = getPublicWedgeSurfaceBadgeMeta('unavailable');
    return { status: meta.status, label: meta.label };
  }

  let surfaceState: PublicWedgeSurfaceState = 'checked';

  switch (displayValue) {
    case 'Flag found':
    case 'Possible match':
    case 'Not found':
    case 'Opted out':
    case 'Excluded':
    case 'Needs review':
      surfaceState = 'review_required';
      break;
    case 'No profile yet':
    case 'Missing data':
      surfaceState = 'unavailable';
      break;
    case 'Source-backed':
    case 'Enrolled':
    case 'Checked':
    case 'Done':
    default:
      surfaceState = 'checked';
      break;
  }

  const meta = getPublicWedgeSurfaceBadgeMeta(surfaceState);
  return {
    status: meta.status,
    label: meta.label,
  };
}

function SourceRow({ label, state, value, note }: { label: string; state: SourceState; value?: string; note?: string }) {
  const displayValue =
    state === 'checking' ? 'Checking…'
    : state === 'access_required' ? 'Not yet integrated'
    : state === 'done' ? (value ?? 'Done')
    : state === 'error' ? 'Missing data'
    : '—';
  const badge = resolveSourceBadge(state, displayValue);

  return (
    <div className="py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            backgroundColor:
              state === 'done'     ? 'rgba(255,255,255,0.45)' :
              state === 'access_required' ? 'rgba(245,158,11,0.30)' :
              state === 'checking' ? 'rgba(255,255,255,0.20)' :
              state === 'error'    ? 'rgba(255,255,255,0.15)' :
                                     'rgba(255,255,255,0.08)',
          }}
          aria-hidden
        />
        <span className="text-white/55 text-sm">{label}</span>
      </div>
      <TrustStatusBadge status={badge.status} label={badge.label} size="sm" />
      </div>
      {(note ?? (state === 'access_required')) && (
        <p className="mt-1 ml-4 text-[11px] text-white/25 leading-snug">
          {note ?? 'State board data is not yet integrated. NPPES, OIG, and PECOS cover primary identity, sanctions, and enrollment.'}
        </p>
      )}
    </div>
  );
}

function formatExclusionLabel(
  checked: boolean,
  exclusionClear: boolean | undefined,
  exclusionStatus: string | undefined,
  state: SourceState,
): string | undefined {
  if (state === 'error') {
    return undefined;
  }

  if (!checked) {
    return state === 'done' ? 'Checked' : undefined;
  }

  if (exclusionClear === true) {
    return 'Source-backed';
  }

  if (exclusionClear === false) {
    return 'Needs review';
  }

  if (exclusionStatus === 'POSSIBLE_MATCH') {
    return 'Needs review';
  }

  if (exclusionStatus === 'EXCLUDED') {
    return 'Needs review';
  }

  return 'Checked';
}

function formatEnrollmentLabel(
  checked: boolean,
  enrollmentStatus: string | undefined,
  state: SourceState,
): string | undefined {
  if (state === 'error') {
    return undefined;
  }

  if (!checked) {
    return state === 'done' ? 'Checked' : undefined;
  }

  if (enrollmentStatus === 'ENROLLED') {
    return 'Source-backed';
  }

  if (enrollmentStatus === 'NOT_FOUND') {
    return 'Needs review';
  }

  if (enrollmentStatus === 'OPTED_OUT') {
    return 'Needs review';
  }

  return enrollmentStatus ?? 'Checked';
}

// ── Main page ─────────────────────────────────────────────────────────────────

function PassportPageContent({ initialNpi }: { initialNpi: string | null }) {
  const autoTriggered = useRef(false);
  const [npi,       setNpi]       = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const { state, startIngest, reset } = useIngestStream();

  useEffect(() => {
    if (initialNpi && /^\d{10}$/.test(initialNpi) && !autoTriggered.current) {
      autoTriggered.current = true;
      setInputError(null);
      setNpi(initialNpi);
      void startIngest(initialNpi);
    }
  }, [initialNpi, startIngest]);

  useEffect(() => {
    void trackPilotEvent({
      eventType: UX_EVENTS.PASSPORT_VIEWED,
      route: '/passport',
      oncePerSession: true,
      message: 'Passport page viewed',
    });
  }, []);

  const isActive = state.phase !== 'idle';
  const hasTerminalState = Boolean(state.completedAt) || state.phase === 'done' || state.phase === 'error';
  const anchorEntityId = state.anchorEntityId ?? state.identity.entityId;
  const canViewPassport = state.isUsable && Boolean(anchorEntityId);
  const noProfileYet =
    hasTerminalState
    && !canViewPassport
    && (
      state.identity.sourceResult === 'SKIPPED'
      || (state.sources.nppes === 'done' && state.identity.status === 'UNKNOWN')
    );
  const disconnected = state.disconnected && !canViewPassport;
  const runCompletedWithoutAnchor =
    hasTerminalState
    && !canViewPassport
    && !noProfileYet
    && !disconnected
    && state.identity.authoritative;
  const genericError =
    state.phase === 'error'
    && !canViewPassport
    && !disconnected
    && !noProfileYet;
  const isRunning = isActive && !hasTerminalState && !canViewPassport && !disconnected;
  const retryNpi = state.npi ?? npi.trim();
  const errorCopy = genericError ? resolveIngestErrorCopy(state.error) : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = npi.trim();
    if (!/^\d{10}$/.test(trimmed)) { setInputError('Enter a valid 10-digit NPI.'); return; }
    setInputError(null);
    startIngest(trimmed);
  }

  function handleSecondaryAction() {
    if (genericError && /^\d{10}$/.test(retryNpi)) {
      setInputError(null);
      void startIngest(retryNpi);
      return;
    }

    reset();
  }

  const { identity, standing, sources } = state;

  const exclusionLabel = formatExclusionLabel(
    standing.exclusionChecked,
    standing.exclusionClear,
    standing.exclusionStatus,
    sources.oig,
  );
  const enrollmentLabel = formatEnrollmentLabel(
    standing.enrollmentChecked,
    standing.enrollmentStatus,
    sources.pecos,
  );
  const identityLabel =
    identity.authoritative
      ? 'Source-backed'
      : noProfileYet
        ? 'Missing data'
        : state.identity.sourceResult === 'FAILED'
          ? 'Missing data'
          : undefined;
  const readinessExplanation =
    typeof state.readiness.score === 'number' && state.readiness.breakdown
      ? buildReadinessExplanation({
          score: state.readiness.score,
          status: state.readiness.status,
          breakdown: {
            identityPct: state.readiness.breakdown.identityPct ?? 0,
            exclusionPct: state.readiness.breakdown.exclusionPct ?? 0,
            licensurePct: state.readiness.breakdown.licensurePct ?? 0,
            enrollmentPct: state.readiness.breakdown.enrollmentPct ?? 0,
            whatIsMissing: state.readiness.breakdown.whatIsMissing ?? [],
          },
        })
      : null;
  const displayName = resolvePublicProviderDisplayName({
    displayName: identity.displayName,
    npi: state.npi,
  });
  const displaySpecialty = resolvePublicProviderSpecialty({
    displayName: identity.displayName,
    specialty: identity.specialty,
  });

  return (
    <main className="min-h-screen bg-background flex flex-col items-center px-4 pt-16 sm:pt-24 pb-24">
      <div className="w-full max-w-sm space-y-8">

        {/* Wordmark */}
        <div className="text-center">
          <span className="text-white/30 text-xs tracking-widest uppercase">VitalCV</span>
          <h1 className="text-white text-2xl font-semibold tracking-tight mt-1">
            Check your readiness
          </h1>
          {!isActive && (
            <p className="text-white/35 text-sm mt-2">
              Enter your NPI. No login required.
            </p>
          )}
        </div>

        {/* NPI entry — hidden while running */}
        {!isActive && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="passport-npi" className="sr-only">Your NPI number</label>
            <Input
              id="passport-npi"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              value={npi}
              onChange={e => setNpi(e.target.value.replace(/\D/g, ''))}
              placeholder="1234567890"
              className="h-14 w-full rounded-xl border-white/12 bg-white/6 px-4 text-[16px] tracking-widest text-center text-white placeholder:text-white/20 shadow-none focus-visible:border-white/30 focus-visible:bg-white/10 focus-visible:ring-white/10"
              aria-label="NPI number"
              autoComplete="off"
            />
            {inputError && (
              <p className="text-red-400/70 text-xs text-center">{inputError}</p>
            )}
            <Button
              type="submit"
              variant="success"
              disabled={npi.length !== 10}
              className="h-14 w-full rounded-full text-sm font-medium"
            >
              Check my readiness
            </Button>
          </form>
        )}

        {/* Live ingest panel */}
        {isActive && (
          <div className="space-y-5 animate-fade-in-up">

            {/* Phase label */}
            {isRunning && (
              <p className="text-white/40 text-sm text-center">
                {PHASE_LABEL[state.phase]}
              </p>
            )}

            {/* Identity block — appears when NPPES resolves */}
            {identity.authoritative && identity.displayName && (
              <Card className="gap-2 rounded-2xl border-white/10 bg-white/5 px-5 py-4 shadow-none">
                <p className="text-white/30 text-xs uppercase tracking-widest mb-1">Provider</p>
                <h2 className="text-white text-xl font-semibold leading-tight">
                  {displayName}
                </h2>
                {displaySpecialty && (
                  <p className="text-white/50 text-sm mt-0.5">{displaySpecialty}</p>
                )}
                <p className="text-white/25 text-xs mt-1">NPI {state.npi}</p>
              </Card>
            )}

            {/* Source status rows */}
            <Card className="animate-panel-enter gap-0 rounded-xl border-white/8 bg-white/3 px-4 py-2 shadow-none">
              <SourceRow
                label="NPPES"
                state={sources.nppes}
                value={identityLabel}
              />
              <SourceRow
                label="OIG"
                state={sources.oig}
                value={exclusionLabel}
              />
              <SourceRow
                label="PECOS"
                state={sources.pecos}
                value={enrollmentLabel}
              />
              <SourceRow
                label="State Board"
                state="access_required"
                value="Access required"
              />
            </Card>

            {readinessExplanation && (
              <ReadinessExplanationCard
                explanation={readinessExplanation}
                title="Readiness explanation"
                description="Identity, exclusion, licensure, and enrollment stay separate before you continue into the full passport."
              />
            )}

            {/* Usable state — passport anchor is available */}
            {canViewPassport && anchorEntityId && (
              <div className="space-y-3">
                <Button asChild variant="success" className="h-14 w-full rounded-full text-sm font-medium">
                  <Link href={buildPassportEntityHref(anchorEntityId)}>
                    View full passport
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-14 w-full rounded-full border-white/10 bg-white/4 text-sm font-medium text-white/60 hover:border-white/20 hover:bg-white/7 hover:text-white">
                  <Link href={buildEmployerReviewHref(anchorEntityId)}>
                    View as employer
                  </Link>
                </Button>
              </div>
            )}

            {/* Terminal no-profile state */}
            {noProfileYet && (
              <TrustStateCard
                title="No profile found for this NPI yet."
                description="The ingest run completed, but NPPES did not return an authoritative provider record."
                centered
              />
            )}

            {/* Terminal completion without anchor */}
            {runCompletedWithoutAnchor && (
              <TrustStateCard
                title="Profile resolved but not yet anchored."
                description="The run finished, but no passport anchor was returned for this profile."
                centered
              />
            )}

            {/* Disconnect state */}
            {disconnected && (
              <TrustStateCard
                title="Stream disconnected before your passport finished hydrating."
                description="Start the ingest again to reopen the live stream."
                tone="warning"
                centered
              />
            )}

            {/* Error state */}
            {genericError && (
              <TrustStateCard
                title={errorCopy?.title ?? "We couldn't load your readiness snapshot right now."}
                description={errorCopy?.description ?? 'Try this NPI again in a moment.'}
                tone="critical"
                centered
              />
            )}

            {/* Start over */}
            <div className="text-center">
              <Button
                onClick={handleSecondaryAction}
                variant="ghost"
                className="min-h-[44px] px-4 text-xs text-white/25 hover:bg-transparent hover:text-white/45"
              >
                {genericError && /^\d{10}$/.test(retryNpi)
                  ? 'Try this NPI again'
                  : canViewPassport || hasTerminalState
                    ? 'Check another NPI'
                    : 'Cancel'}
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        {!isActive && (
          <p className="text-center text-white/20 text-xs">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-white/40 underline underline-offset-2 hover:text-white/60 transition-colors">
              Sign in
            </Link>
          </p>
        )}

      </div>
    </main>
  );
}

function PassportPageSearchParams() {
  const searchParams = useSearchParams();
  return <PassportPageContent initialNpi={searchParams?.get('npi') ?? null} />;
}

export default function PassportPage() {
  return (
    <Suspense fallback={<PassportPageContent initialNpi={null} />}>
      <PassportPageSearchParams />
    </Suspense>
  );
}
