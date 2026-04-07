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
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { TrustStatusBadge, type TrustBadgeStatus } from '@/components/ui/trust-status-badge';
import { useIngestStream, hydrateFromHomepagePreview, type IngestStreamState, type StreamPhase } from '@/hooks/useIngestStream';
import {
  buildEmployerReviewHref,
  buildPassportEntityHref,
  getPublicWedgeSurfaceBadgeMeta,
  type PublicWedgeSurfaceState,
} from '@/lib/trust/public-wedge-parity';
import { trackPilotEvent } from '@/lib/pilot-ops/client';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import { resolveLivePathReadinessStatus } from '@/lib/live-path/contracts';

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

type SourceState = 'pending' | 'checking' | 'done' | 'error';

function resolveSourceBadge(state: SourceState, displayValue: string): {
  status: TrustBadgeStatus;
  label: string;
} {
  if (state === 'checking') {
    return { status: 'pending', label: 'Pending' };
  }

  if (state === 'pending') {
    return { status: 'pending', label: 'Pending' };
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
      surfaceState = 'review_required';
      break;
    case 'Access required':
      surfaceState = 'access_required';
      break;
    case 'No profile yet':
      surfaceState = 'unavailable';
      break;
    case 'Verified':
    case 'Clear':
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

function SourceRow({ label, state, value }: { label: string; state: SourceState; value?: string }) {
  const displayValue =
    state === 'checking' ? 'Checking…'
    : state === 'done' ? (value ?? 'Done')
    : state === 'error' ? 'Unavailable'
    : '—';
  const badge = resolveSourceBadge(state, displayValue);

  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            backgroundColor:
              state === 'done'     ? 'rgba(255,255,255,0.45)' :
              state === 'checking' ? 'rgba(255,255,255,0.20)' :
              state === 'error'    ? 'rgba(255,255,255,0.15)' :
                                     'rgba(255,255,255,0.08)',
          }}
          aria-hidden
        />
        <span className="text-muted-foreground text-sm">{label}</span>
      </div>
      <TrustStatusBadge status={badge.status} label={badge.label} size="sm" />
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
    return 'Checked';
  }

  if (exclusionClear === false) {
    return 'Flag found';
  }

  if (exclusionStatus === 'POSSIBLE_MATCH') {
    return 'Possible match';
  }

  if (exclusionStatus === 'EXCLUDED') {
    return 'Excluded';
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
    return 'Enrolled';
  }

  if (enrollmentStatus === 'NOT_FOUND') {
    return 'Not found';
  }

  if (enrollmentStatus === 'OPTED_OUT') {
    return 'Opted out';
  }

  return enrollmentStatus ?? 'Checked';
}

function resolveLicenseState(streamState: IngestStreamState): SourceState {
  if (streamState.phase === 'error' && !streamState.isUsable) {
    return 'error';
  }

  if (streamState.completedAt || streamState.readyAt || streamState.isUsable) {
    return 'done';
  }

  return streamState.runId ? 'checking' : 'pending';
}

function formatLicenseLabel(
  streamState: IngestStreamState,
  state: SourceState,
): string | undefined {
  if (state === 'error') {
    return undefined;
  }

  if (state === 'done') {
    return 'Access required';
  }

  return state === 'checking' ? 'Pending' : undefined;
}

// ── SessionStorage handoff ─────────────────────────────────────────────────────

const PREVIEW_TTL_MS = 5 * 60 * 1000; // 5 minutes

function readHomepagePreview(npi: string) {
  try {
    const raw = sessionStorage.getItem(`vitalcv:preview:${npi}`);
    if (!raw) return null;
    sessionStorage.removeItem(`vitalcv:preview:${npi}`);
    const parsed = JSON.parse(raw) as {
      kind?: string;
      timestamp?: number;
      state?: IngestStreamState;
      realState?: unknown;
      stages?: unknown;
      isDemo?: unknown;
    };
    if (typeof parsed.timestamp === 'number' && Date.now() - parsed.timestamp > PREVIEW_TTL_MS) {
      return null;
    }
    if (parsed.kind === 'ingestStream' && parsed.state) {
      return parsed.state;
    }
    return hydrateFromHomepagePreview({ npi, ...parsed } as Parameters<typeof hydrateFromHomepagePreview>[0]);
  } catch {
    return null;
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

function PassportPageContent({ initialNpi }: { initialNpi: string | null }) {
  const autoTriggered = useRef(false);
  const [npi,       setNpi]       = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const hydratedRef = useRef<ReturnType<typeof readHomepagePreview>>(
    initialNpi && /^\d{10}$/.test(initialNpi) ? readHomepagePreview(initialNpi) : null,
  );
  const { state, startIngest, resumeIngest, reset } = useIngestStream(hydratedRef.current);

  useEffect(() => {
    if (autoTriggered.current) {
      return;
    }

    if (hydratedRef.current) {
      autoTriggered.current = true;
      setInputError(null);
      setNpi(hydratedRef.current.npi ?? initialNpi ?? '');

      if (
        hydratedRef.current.runId
        && !hydratedRef.current.completedAt
        && hydratedRef.current.phase !== 'done'
        && hydratedRef.current.phase !== 'error'
      ) {
        resumeIngest(hydratedRef.current.runId, hydratedRef.current);
      }

      return;
    }

    if (initialNpi && /^\d{10}$/.test(initialNpi)) {
      autoTriggered.current = true;
      setInputError(null);
      setNpi(initialNpi);
      void startIngest(initialNpi);
    }
  }, [initialNpi, resumeIngest, startIngest]);

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
    if (/\D/.test(trimmed)) { setInputError('NPI must contain only digits.'); return; }
    if (trimmed.length !== 10) { setInputError('NPI must be exactly 10 digits.'); return; }
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
        ? 'No profile yet'
        : state.identity.sourceResult === 'FAILED'
          ? 'Unavailable'
          : undefined;

  return (
    <main className="min-h-screen bg-background flex flex-col items-center px-4 pt-16 sm:pt-28 pb-24">
      <div className="w-full max-w-lg space-y-10">

        {/* Wordmark */}
        <div>
          {!isActive && (
            <>
              <h1 className="text-foreground text-4xl sm:text-5xl font-bold tracking-tighter uppercase leading-none">
                Check your <span className="italic font-serif font-medium">readiness</span>
              </h1>
              <p className="text-muted-foreground/60 text-sm mt-4 font-mono">
                Primary sources check public records. Enter your NPI to start.
              </p>
            </>
          )}
        </div>

        {/* NPI entry — hidden while running */}
        {!isActive && (
          <form onSubmit={handleSubmit} className="space-y-1 relative">
            <label htmlFor="npi-input" className="sr-only">Enter your 10-digit NPI number</label>
            <div className="relative">
              <Input
                id="npi-input"
                name="npi"
                type="text"
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                autoComplete="off"
                aria-label="Enter your 10-digit NPI number"
                aria-invalid={!!inputError}
                aria-describedby={inputError ? 'npi-error' : undefined}
                value={npi}
                onChange={e => setNpi(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 10-digit NPI"
                className="h-16 w-full rounded-none border-0 border-b-2 border-border bg-transparent px-2 text-2xl font-mono tracking-widest text-foreground placeholder:text-muted-foreground/20 shadow-none focus-visible:ring-0 focus-visible:border-foreground uppercase pr-12"
              />
              <Button
                type="submit"
                disabled={npi.length !== 10}
                className="absolute right-0 bottom-2 h-10 w-10 rounded-none bg-transparent text-foreground p-0 shadow-none hover:bg-transparent disabled:opacity-20"
                aria-label="Check readiness"
              >
                →
              </Button>
            </div>
            {inputError && (
              <p id="npi-error" role="alert" className="text-red-500/70 text-xs font-mono mt-1">{inputError}</p>
            )}
          </form>
        )}

        {/* Source strip */}
        {!isActive && (
          <div className="flex gap-6 opacity-30">
            {['NPPES', 'OIG/LEIE', 'PECOS', 'FSMB'].map(s => (
              <span key={s} className="text-[10px] font-bold uppercase tracking-widest">{s}</span>
            ))}
          </div>
        )}

        {/* Live ingest panel */}
        {isActive && (
          <div className="space-y-5 animate-fade-in-up">

            {/* Phase label */}
            {isRunning && (
              <p className="text-muted-foreground text-sm text-center">
                {PHASE_LABEL[state.phase]}
              </p>
            )}

            {/* Identity block — appears when NPPES resolves */}
            {identity.authoritative && identity.displayName && (
              <Card className="gap-2 rounded-2xl border-border bg-muted px-5 py-4 shadow-none">
                <p className="text-muted-foreground/60 text-xs uppercase tracking-widest mb-1">Provider</p>
                <h2 className="text-foreground text-xl font-semibold leading-tight">
                  {identity.displayName}
                </h2>
                {identity.specialty && (
                  <p className="text-muted-foreground text-sm mt-0.5">{identity.specialty}</p>
                )}
                <p className="text-muted-foreground/50 text-xs mt-1">NPI {state.npi}</p>
              </Card>
            )}

          {/* Source status rows */}
          <Card className="animate-panel-enter gap-0 rounded-xl border-border bg-card px-4 py-2 shadow-none">
            <SourceRow
                label="NPPES"
                state={sources.nppes}
                value={identityLabel}
              />
              <SourceRow
                label="OIG / LEIE"
                state={sources.oig}
                value={exclusionLabel}
              />
              <SourceRow
                label="CMS PECOS"
                state={sources.pecos}
                value={enrollmentLabel}
              />
              <SourceRow
                label="Configured state board lane"
                state={resolveLicenseState(state)}
                value={formatLicenseLabel(state, resolveLicenseState(state))}
              />
            </Card>

            {/* Readiness summary — appears when claims update */}
            {state.readiness.score !== undefined && (
              <Card className="gap-0 rounded-xl border-border bg-card px-4 py-3 shadow-none">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground/60 text-xs uppercase tracking-widest">Readiness</span>
                  <TrustStatusBadge
                    status={resolveLivePathReadinessStatus(
                      state.readiness.status === 'READY' || state.readiness.status === 'BLOCKED' || state.readiness.status === 'PARTIAL'
                        ? state.readiness.status
                        : state.readiness.score >= 70
                          ? 'READY'
                          : state.readiness.score >= 40
                            ? 'PARTIAL'
                            : 'BLOCKED',
                    )}
                    label={
                      state.readiness.status === 'READY' || state.readiness.status === 'BLOCKED' || state.readiness.status === 'PARTIAL'
                        ? state.readiness.status
                        : state.readiness.score >= 70
                          ? 'READY'
                          : state.readiness.score >= 40
                            ? 'PARTIAL'
                            : 'BLOCKED'
                    }
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-foreground/80 text-sm tabular-nums">
                    {state.readiness.score}/100
                  </span>
                  {state.readiness.level && (
                    <span className="text-muted-foreground/50 text-xs">
                      {state.readiness.level}
                    </span>
                  )}
                </div>
                {state.readiness.status && (
                  <p className="text-muted-foreground/50 text-xs mt-1">
                    {state.readiness.status}
                  </p>
                )}
              </Card>
            )}

            {/* Usable state — passport anchor is available */}
            {canViewPassport && anchorEntityId && (
              <div className="space-y-3">
                <Button asChild variant="success" className="h-14 w-full rounded-full text-sm font-medium">
                  <Link href={buildPassportEntityHref(anchorEntityId)}>
                    View full passport
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-14 w-full rounded-full border-border bg-card text-sm font-medium text-foreground/70 hover:border-border hover:bg-card hover:text-foreground">
                  <Link href={buildEmployerReviewHref(anchorEntityId)}>
                    View as employer
                  </Link>
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    const retry = state.npi ?? npi.trim();
                    if (/^\d{10}$/.test(retry)) {
                      reset();
                      setTimeout(() => startIngest(retry), 50);
                    }
                  }}
                  className="h-10 w-full rounded-full border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  Re-check sources
                </button>
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
                className="min-h-[44px] px-4 text-xs text-muted-foreground/50 hover:bg-transparent hover:text-muted-foreground"
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
          <p className="text-center text-muted-foreground/40 text-xs">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-muted-foreground underline underline-offset-2 hover:text-foreground/70 transition-colors">
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
