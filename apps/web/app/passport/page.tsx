'use client';

export const dynamic = 'force-dynamic';

/**
 * /passport — Passport entry + live ingest hydration
 *
 * Flow: TYPE → SEE → TRUST → CONTINUE
 *
 * 1. User enters NPI
 * 2. POST /api/ingest/:npi → runId
 * 3. SSE stream → progressive hydration
 *    - Identity appears first (NPPES, ~1s)
 *    - Sanctions status next (OIG, ~2s)
 *    - Enrollment next (PECOS, ~3s)
 *    - Readiness recalculates on claim_update
 * 4. Done → [View full passport] or [Continue activation]
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
import { LaneHealthMount } from '@/components/source-health/LaneHealthMount';
import { useIngestStream, hydrateFromHomepagePreview, type IngestStreamState, type StreamPhase } from '@/hooks/useIngestStream';
import {
  buildPassportEntityHref,
  getPublicWedgeSurfaceBadgeMeta,
  resolvePublicWedgeSurfaceStateFromDisplayLabel,
  type PublicWedgeSurfaceState,
} from '@/lib/trust/public-wedge-parity';
import { trackPilotEvent } from '@/lib/pilot-ops/client';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import { resolveLivePathReadinessStatus } from '@/lib/live-path/contracts';

// ── NPI Luhn checksum validation (ISO/IEC 7812 with "80840" prefix) ────────────
function isValidNpiChecksum(npi: string): boolean {
  if (npi.length !== 10 || /\D/.test(npi)) return false;
  const digits = ('80840' + npi).split('').map(Number);
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if ((digits.length - 1 - i) % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

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
  starting:   'Opening your passport…',
  nppes:      'Recognizing your NPI…',
  sanctions:  'Checking exclusion status…',
  enrollment: 'Checking Medicare enrollment…',
  done:       'Identity confirmed',
  error:      'Unable to connect',
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
    case 'Source-confirmed':
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
    <div className="flex items-start justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-start gap-2.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 mt-[7px]"
          style={{
            backgroundColor:
              state === 'done'     ? 'rgba(255,255,255,0.45)' :
              state === 'checking' ? 'rgba(255,255,255,0.20)' :
              state === 'error'    ? 'rgba(255,255,255,0.15)' :
                                     'rgba(255,255,255,0.08)',
          }}
          aria-hidden
        />
        <div>
          <span className="text-muted-foreground text-sm">{label}</span>
          {state === 'error' && (
            <p className="text-muted-foreground/40 text-xs mt-0.5">Checking in the background — we&apos;ll update when it arrives.</p>
          )}
        </div>
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

function humanizeContextToken(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type PassportRoleContext = Readonly<{
  roleId: string | null;
  roleTitle: string | null;
  employerSlug: string | null;
  employerName: string | null;
}>;

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

function persistOnboardingNpi(npi: string) {
  if (typeof window === 'undefined' || !/^\d{10}$/.test(npi)) {
    return;
  }

  window.sessionStorage.setItem('onboarding_npi', npi);
  window.localStorage.setItem('onboarding_npi', npi);
}

// ── Main page ─────────────────────────────────────────────────────────────────

function PassportPageContent({
  initialNpi,
  roleContext,
}: {
  initialNpi: string | null;
  roleContext: PassportRoleContext;
}) {
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

  useEffect(() => {
    const currentNpi = state.npi ?? initialNpi ?? '';
    if (/^\d{10}$/.test(currentNpi)) {
      persistOnboardingNpi(currentNpi);
    }
  }, [initialNpi, state.npi]);

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
  const continueToOnboardingHref = /^\d{10}$/.test(retryNpi)
    ? `/onboarding?returnTo=${encodeURIComponent(`/passport?npi=${retryNpi}`)}`
    : '/onboarding';
  const errorCopy = genericError ? resolveIngestErrorCopy(state.error) : null;
  const displayRole = roleContext.roleTitle ?? (roleContext.roleId ? humanizeContextToken(roleContext.roleId) : null);
  const displayEmployer = roleContext.employerName ?? (roleContext.employerSlug ? humanizeContextToken(roleContext.employerSlug) : null);
  const readinessContext = displayRole
    ? `Checking readiness for ${displayRole}${displayEmployer ? ` at ${displayEmployer}` : ''}.`
    : displayEmployer
      ? `Checking readiness for ${displayEmployer}.`
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = npi.trim();
    if (/\D/.test(trimmed)) { setInputError('NPI must contain only digits.'); return; }
    if (trimmed.length !== 10) { setInputError('NPI must be exactly 10 digits.'); return; }
    if (!isValidNpiChecksum(trimmed)) { setInputError('This NPI does not pass the Luhn check. Please verify the number.'); return; }
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

  const npiValid = npi.length === 10 && !/\D/.test(npi);
  const npiChecksumOk = npiValid && isValidNpiChecksum(npi);

  return (
    <main className="bg-background px-4 pt-16 sm:pt-20 pb-24">
      <div className="mx-auto w-full max-w-4xl">

        {/* Role context banner */}
        {readinessContext ? (
          <div className="mb-6 rounded-none border border-border bg-card px-4 py-3 max-w-lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Role context
            </p>
            <p className="mt-2 text-sm text-foreground/80">{readinessContext}</p>
          </div>
        ) : null}

        {/* Idle state — calm single-column layout */}
        {!isActive && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-foreground text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Your passport starts with a single NPI.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Enter it once. VitalCV resolves the source-backed snapshot and shows
                what is already clear, what still needs attention, and what helps you
                keep moving into onboarding.
              </p>
            </div>

            <Card className="gap-0 rounded-2xl border-border bg-card py-0 shadow-none">
              <div className="px-5 py-5 sm:px-6 sm:py-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <label htmlFor="npi-input" className="sr-only">
                    Enter your 10-digit NPI number
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
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
                        onChange={(e) => setNpi(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 10-digit NPI"
                        className="h-14 w-full rounded-2xl border-border bg-[var(--vt-bg)] px-4 text-base font-mono tracking-[0.16em] text-foreground placeholder:text-muted-foreground/30 shadow-none focus-visible:ring-ring"
                      />
                      {npi.length > 0 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground/50">
                          {npi.length}/10
                          {npiValid ? (
                            npiChecksumOk ? (
                              <span className="ml-1.5 text-trust-green">✓</span>
                            ) : (
                              <span className="ml-1.5 text-trust-red">✗</span>
                            )
                          ) : null}
                        </span>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={!npiValid}
                      variant="success"
                      className="h-14 w-full rounded-2xl px-6 text-sm font-semibold sm:w-auto"
                    >
                      Open passport
                    </Button>
                  </div>
                  {inputError && (
                    <p id="npi-error" role="alert" className="text-xs text-destructive">
                      {inputError}
                    </p>
                  )}
                </form>

                <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--vt-text-secondary)]">
                  <span>No account required</span>
                  <span className="text-[var(--vt-border)]" aria-hidden="true">
                    ·
                  </span>
                  <span>Public source checks only</span>
                  <span className="text-[var(--vt-border)]" aria-hidden="true">
                    ·
                  </span>
                  <span>Nothing stored without consent</span>
                </div>
              </div>
            </Card>

            <p className="text-xs leading-relaxed text-muted-foreground">
              The first result is a passport snapshot. The next step is onboarding,
              without re-entering what VitalCV already knows.
            </p>
          </div>
        )}

        {/* Live ingest panel */}
        {isActive && (
          <div className="mx-auto max-w-lg space-y-5 animate-fade-in-up">

            {/* Phase label */}
            {isRunning && (
              <p className="text-muted-foreground text-sm text-center">
                {PHASE_LABEL[state.phase]}
              </p>
            )}

            {/* Identity block — appears when NPPES resolves */}
            {identity.authoritative && identity.displayName && (
              <Card className="gap-2 rounded-none border-border bg-muted px-5 py-4 shadow-none">
                <p className="text-muted-foreground/60 text-xs uppercase tracking-widest mb-1">Identity confirmed</p>
                <h2 className="text-foreground text-xl font-semibold leading-tight">
                  {identity.displayName}
                </h2>
                {identity.specialty && (
                  <p className="text-muted-foreground text-sm mt-0.5">{identity.specialty}</p>
                )}
                <p className="text-muted-foreground/50 text-xs mt-1">NPI {state.npi}</p>
                {/* Value translation — makes identity confirmation feel meaningful */}
                <p className="text-muted-foreground/70 text-xs mt-2 leading-relaxed">
                  Your NPI is active and federally confirmed.
                </p>
              </Card>
            )}

          {/* Source status rows */}
          <Card className="animate-panel-enter gap-0 rounded-none border-border bg-card px-4 py-2 shadow-none">
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
              <Card className="gap-0 rounded-none border-border bg-card px-4 py-3 shadow-none">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground/60 text-xs uppercase tracking-widest">Readiness</span>
                  <TrustStatusBadge
                    status={resolveLivePathReadinessStatus(
                      state.readiness.status === 'DECISION_GRADE' || state.readiness.status === 'BLOCKED' || state.readiness.status === 'PARTIAL' || state.readiness.status === 'CHECKING'
                        ? state.readiness.status
                        : state.readiness.score >= 70
                          ? 'DECISION_GRADE'
                          : state.readiness.score >= 40
                            ? 'PARTIAL'
                            : 'BLOCKED',
                    )}
                    label={
                      state.readiness.status === 'DECISION_GRADE' || state.readiness.status === 'BLOCKED' || state.readiness.status === 'PARTIAL' || state.readiness.status === 'CHECKING'
                        ? state.readiness.status
                        : state.readiness.score >= 70
                          ? 'DECISION_GRADE'
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
                <button
                  type="button"
                  onClick={() => {
                    const retry = state.npi ?? npi.trim();
                    if (/^\d{10}$/.test(retry)) {
                      reset();
                      setTimeout(() => startIngest(retry), 50);
                    }
                  }}
                  className="h-10 w-full rounded-full border border-border text-sm text-muted-foreground transition-colors hover:bg-muted"
                >
                  Re-check sources
                </button>
              </div>
            )}

            {canViewPassport && (
            <TrustStateCard
              eyebrow="Next step"
              title="Continue activation"
              description="The passport is ready. Keep the momentum going into onboarding without starting over."
              tone="success"
              actions={(
                <Button asChild variant="outline" className="h-11 w-full rounded-full border-border bg-card text-sm font-medium text-foreground/80 hover:border-border hover:bg-card hover:text-foreground">
                  <Link href={continueToOnboardingHref}>Continue to onboarding</Link>
                </Button>
              )}
            />
            )}

            {/* Source operational state — provenance-safe; reports lane health only */}
            <LaneHealthMount />

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
                title="Passport is still waiting on sources."
                description="Public NPI identity resolved, but no source-backed anchor was written."
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

      </div>
    </main>
  );
}

function PassportPageSearchParams() {
  const searchParams = useSearchParams();
  return (
    <PassportPageContent
      initialNpi={searchParams?.get('npi') ?? null}
      roleContext={{
        roleId: searchParams?.get('role') ?? null,
        roleTitle: searchParams?.get('roleTitle') ?? null,
        employerSlug: searchParams?.get('employer') ?? null,
        employerName: searchParams?.get('employerName') ?? null,
      }}
    />
  );
}

export default function PassportPage() {
  return (
    <Suspense
      fallback={
        <PassportPageContent
          initialNpi={null}
          roleContext={{ roleId: null, roleTitle: null, employerSlug: null, employerName: null }}
        />
      }
    >
      <PassportPageSearchParams />
    </Suspense>
  );
}
