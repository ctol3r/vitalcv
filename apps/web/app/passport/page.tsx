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
 * 4. Done → [View full passport]
 *
 * No polling. No full-page reload. No fake refresh.
 */

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { TrustStatusBadge, type TrustBadgeStatus } from '@/components/ui/trust-status-badge';
import { AcceptanceCard } from '@/components/passport/AcceptanceCard';
import { AutopilotPanel } from '@/components/passport/AutopilotPanel';
import { CohortInsights } from '@/components/passport/CohortInsights';
import {
  blockerToCompletionLabel,
  deriveAutopilotDays,
  deriveAutopilotOutcome,
  deriveAutopilotSteps,
  deriveBlockers,
} from '@/components/passport/StartabilityCard';
import { ActionPanel } from '@/components/passport/ActionPanel';
import { DecisionLogSummary } from '@/components/passport/DecisionLogSummary';
import { PassportPreviewCard } from '@/components/passport/PassportPreviewCard';
import { fireCapsule } from '@/lib/capsules';
import { useIngestStream, hydrateFromHomepagePreview, type IngestStreamState, type StreamPhase } from '@/hooks/useIngestStream';
import { buildPassportEntityHref } from '@/lib/trust/public-wedge-parity';
import { parseOpportunityPassportHandoff } from '@/lib/launch/opportunity-ui-contract';
import {
  executePassportAction,
  shouldReleasePassportAction,
} from '@/lib/trust/passport-action-execution';
import {
  resolveBlockerOwnership,
  resolveOmegaRecomputeFailureOwnership,
  resolveStateBoardOwnership,
} from '@/lib/trust/action-owner';
import {
  getLaneLabel,
  resolvePassportContinuation,
  resolveRecoveryPath,
  type SourceLane,
  type SourceLaneState,
} from '@/lib/trust/recovery-path';
import { trackPilotFunnelEvent } from '@/lib/pilot-ops/funnel';
import { UX_EVENTS } from '@/lib/analytics/ux-events';

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

const stateBoardOwnership = resolveStateBoardOwnership();

const SOURCE_EXPLANATIONS = [
  { id: 'nppes', name: 'NPPES', description: 'Identity verification from the National Plan and Provider Enumeration System', locked: false },
  { id: 'oig', name: 'OIG / LEIE', description: 'Exclusion check against the Office of Inspector General\u2019s List of Excluded Individuals', locked: false },
  { id: 'pecos', name: 'CMS PECOS', description: 'Medicare enrollment verification from Provider Enrollment, Chain, and Ownership System', locked: false },
  {
    id: 'fsmb',
    name: 'State board verification',
    description: `${stateBoardOwnership.plainLabel}. ${stateBoardOwnership.ownerPrefix}.`,
    locked: true,
  },
];

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
    title: 'Verification failed — try again',
    description: 'Source unavailable — retry',
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

// Phase copy must stay honest. It can name the failure state, but it may
// never imply background progress or simulated motion.
const PHASE_LABEL: Record<StreamPhase, string> = {
  idle:       '',
  starting:   'Not yet verified',
  nppes:      'Not yet verified',
  sanctions:  'Not yet verified',
  enrollment: 'Not yet verified',
  done:       'Complete',
  error:      'Verification failed — try again',
};

// ── Source row (owner-attributed, recovery-path driven) ───────────────────────

type SourceState = 'pending' | 'checking' | 'done' | 'error';

function resolveStateBoardSourceState(state: IngestStreamState): SourceState {
  return state.isUsable || Boolean(state.completedAt) || Boolean(state.readyAt) || state.phase === 'done'
    ? 'done'
    : 'pending';
}

/** Map the stream's per-source SourceState into a canonical SourceLaneState
 * that the recovery-path contract understands. Per-lane overrides supply
 * the structured result (enrolled vs not_found, exclusion flag, etc.). */
function resolveLaneState(
  lane: SourceLane,
  sourceState: SourceState,
  streamState: IngestStreamState,
): SourceLaneState {
  if (sourceState === 'error') return 'unavailable';
  if (sourceState === 'pending' || sourceState === 'checking') return 'pending';

  // sourceState === 'done'
  const { identity, standing } = streamState;

  switch (lane) {
    case 'nppes': {
      if (identity.sourceResult === 'SKIPPED') return 'no_record';
      if (identity.authoritative) return 'checked';
      if (identity.status === 'UNKNOWN') return 'no_record';
      return 'checked';
    }
    case 'oig': {
      if (standing.exclusionClear === false) return 'review_required';
      if (standing.exclusionStatus === 'POSSIBLE_MATCH') return 'review_required';
      if (standing.exclusionStatus === 'EXCLUDED') return 'review_required';
      return 'checked';
    }
    case 'pecos': {
      // PECOS refreshes quarterly per the Source Coverage Matrix — the
      // record may be up to 90 days old. `stale` is the honest resting
      // state when the source returns a value but has quarterly cadence.
      if (standing.enrollmentStatus === 'ENROLLED') return 'stale';
      if (standing.enrollmentStatus === 'NOT_FOUND') return 'no_record';
      if (standing.enrollmentStatus === 'OPTED_OUT') return 'review_required';
      return 'stale';
    }
    case 'state_board':
      // State boards are ACCESS_REQUIRED at the platform level per the
      // Source Coverage Matrix. Regardless of how the stream terminates,
      // the authoritative answer is "institutional coverage needed."
      return 'access_required';
  }
}

function laneStateToBadgeStatus(state: SourceLaneState): TrustBadgeStatus {
  switch (state) {
    case 'pending':
      return 'pending';
    case 'checked':
      return 'checked';
    case 'unavailable':
      return 'unavailable';
    case 'access_required':
      return 'access_required';
    case 'stale':
      return 'checked';
    case 'no_record':
      return 'unavailable';
    case 'review_required':
      return 'review_required';
  }
}

function derivePassportLaneStates(state: IngestStreamState): Record<SourceLane, SourceLaneState> {
  return {
    nppes: resolveLaneState('nppes', state.sources.nppes, state),
    oig: resolveLaneState('oig', state.sources.oig, state),
    pecos: resolveLaneState('pecos', state.sources.pecos, state),
    state_board: resolveLaneState('state_board', resolveStateBoardSourceState(state), state),
  };
}

function SourceRow({
  lane,
  sourceState,
  streamState,
  onRetry,
}: {
  lane: SourceLane;
  sourceState: SourceState;
  streamState: IngestStreamState;
  onRetry?: () => void;
}) {
  const laneState = resolveLaneState(lane, sourceState, streamState);
  const recovery = resolveRecoveryPath(lane, laneState);
  const badgeStatus = laneStateToBadgeStatus(laneState);

  const showExplanation =
    laneState !== 'checked' && laneState !== 'pending';

  return (
    <div className="py-2 border-b border-border last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              backgroundColor:
                sourceState === 'done'     ? 'rgba(255,255,255,0.45)' :
                sourceState === 'checking' ? 'rgba(255,255,255,0.20)' :
                sourceState === 'error'    ? 'rgba(255,255,255,0.15)' :
                                             'rgba(255,255,255,0.08)',
            }}
            aria-hidden
          />
          <span className="text-muted-foreground text-sm truncate">{recovery.laneLabel}</span>
        </div>
        <TrustStatusBadge
          status={badgeStatus}
          label={recovery.statusLabel}
          size="sm"
        />
      </div>
      {showExplanation && (
        <div className="mt-1.5 pl-4 text-xs text-muted-foreground leading-relaxed">
          {recovery.explanation}
          {recovery.ctaLabel && (
            <>
              {' '}
              {recovery.actionType === 'retry' && onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="underline underline-offset-2 text-foreground/80 hover:text-foreground"
                >
                  {recovery.ctaLabel}
                </button>
              ) : (
                <span className="text-foreground/70">{recovery.nextStep}</span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
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
  canonicalOrgId: string | null;
  canonicalRoleId: string | null;
  readinessPreviewLink: string | null;
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

  // ── Dynamic loop: user takes action → optimistic hide → re-ingest drives real updates
  const [resolvingBlocker, setResolvingBlocker] = useState<string | null>(null);
  const resolvingReadinessBaseline = useRef<number | undefined>(undefined);
  const actionExecutionInFlight = useRef(false);

  // Completion beat — a transient banner ("✔ PECOS enrollment complete")
  // shown at the moment resolving state clears. The rule is "user must
  // feel 'I actually progressed'", so we tie the banner copy to the
  // exact blocker that was resolved. Auto-dismisses after 4.5s so the
  // surface returns to its steady post-progress state.
  const [completedBlocker, setCompletedBlocker] = useState<string | null>(null);
  const completionBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (completionBannerTimer.current) clearTimeout(completionBannerTimer.current);
    },
    [],
  );

  // Omega recompute status. When executePassportAction's Omega POST
  // fails, we surface an honest "action recorded locally, upstream view
  // will retry" banner instead of silently swallowing the failure.
  // Doctrine: "no silent failure" — the user learns when the recompute
  // didn't land, not only when it did.
  type OmegaRecomputeStatus = 'idle' | 'ok' | 'failed';
  const [omegaRecomputeStatus, setOmegaRecomputeStatus] =
    useState<OmegaRecomputeStatus>('idle');
  // Clear optimistic state only after authoritative recompute state lands.
  useEffect(() => {
    if (!shouldReleasePassportAction({
      resolvingBlocker,
      baselineReadinessScore: resolvingReadinessBaseline.current,
      currentReadinessScore: state.readiness.score,
      phase: state.phase,
      isUsable: state.isUsable,
      completedAt: state.completedAt,
      readyAt: state.readyAt,
    })) {
      return;
    }

    // Capture which blocker just resolved so the completion beat can
    // name it specifically. Gate on three conditions simultaneously:
    //   1. A blocker was being resolved (resolvingBlocker non-null)
    //   2. The stream did not land in error (phase !== 'error')
    //   3. The resolved blocker is genuinely gone from the fresh
    //      blocker set — i.e. external state actually changed.
    //
    // Without (3), the banner would fire on every re-ingest even when
    // the authoritative source came back unchanged. That was the Ω108
    // truth leak: the user sees "✔ PECOS enrollment complete" when
    // nothing in PECOS actually changed. Gating on deriveBlockers(state)
    // not containing the resolved blocker turns the banner from a
    // click-response beat into a real-progress signal.
    const authoritativeBlockers = deriveBlockers(state);
    const blockerActuallyResolved =
      resolvingBlocker !== null
      && !authoritativeBlockers.includes(resolvingBlocker);

    if (blockerActuallyResolved && state.phase !== 'error') {
      setCompletedBlocker(resolvingBlocker);
      if (completionBannerTimer.current) clearTimeout(completionBannerTimer.current);
      completionBannerTimer.current = setTimeout(() => {
        setCompletedBlocker(null);
        completionBannerTimer.current = null;
      }, 4500);
    }

    setResolvingBlocker(null);
    resolvingReadinessBaseline.current = undefined;
    setOmegaRecomputeStatus('idle');
  }, [
    resolvingBlocker,
    state.completedAt,
    state.isUsable,
    state.phase,
    state.readiness.score,
    state.readyAt,
  ]);

  // executeAction — the CTA is an execution trigger, not advisory UI.
  // On click we: (1) snapshot the current readiness score so the optimistic
  // blocker-hide knows when "new state" has arrived, (2) mark the blocker
  // as resolving so ActionPanel flips to its progress state, (3) append an
  // intent capsule, (4) re-trigger Omega, and (5) kick a fresh ingest run.
  // Single-flight is load-bearing here: repeated clicks must not enqueue
  // duplicate execution loops or produce conflicting optimistic state.
  const executeAction = useCallback((blocker: string) => {
    if (actionExecutionInFlight.current) return;

    const targetNpi = state.npi ?? npi.trim();
    const allowedBlockers = deriveBlockers(state);
    if (!/^\d{10}$/.test(targetNpi) || !allowedBlockers.includes(blocker)) return;

    actionExecutionInFlight.current = true;
    resolvingReadinessBaseline.current = state.readiness.score;
    setResolvingBlocker(blocker);

    void executePassportAction({
      blocker,
      allowedBlockers,
      subjectNpi: targetNpi,
      readinessScoreBefore: state.readiness.score ?? null,
      })
      .then((result) => {
        setOmegaRecomputeStatus(result.omegaTriggered ? 'ok' : 'failed');
      })
      .catch(() => {
        setOmegaRecomputeStatus('failed');
      })
      .finally(() => {
        actionExecutionInFlight.current = false;
        reset();
        void startIngest(targetNpi);
      });
  }, [npi, reset, startIngest, state]);

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

  const isActive = state.phase !== 'idle';
  const hasTerminalState = Boolean(state.completedAt) || state.phase === 'done' || state.phase === 'error';
  const anchorEntityId = state.anchorEntityId ?? state.identity.entityId;
  const canViewPassport = state.isUsable && Boolean(anchorEntityId);

  useEffect(() => {
    const passportNpi = typeof state.npi === 'string' && /^\d{10}$/.test(state.npi)
      ? state.npi
      : initialNpi ?? null;
    if (!passportNpi) {
      return;
    }

    void trackPilotFunnelEvent({
      eventType: UX_EVENTS.PASSPORT_VIEWED,
      npi: passportNpi,
      route: '/passport',
      oncePerSession: true,
      message: 'Passport page viewed',
      entity: {
        kind: 'passport',
        id: anchorEntityId ?? passportNpi,
        label: passportNpi,
        objectType: 'passport',
      },
      details: {
        anchorEntityId: anchorEntityId ?? null,
      },
    });
  }, [anchorEntityId, initialNpi, state.npi]);

  // Trigger #3 — Start event: fire capsule once per anchor arrival (ingest complete)
  const firedStartCapsuleFor = useRef<string | null>(null);
  useEffect(() => {
    if (!canViewPassport || !anchorEntityId || !state.npi) return;
    if (firedStartCapsuleFor.current === anchorEntityId) return;
    firedStartCapsuleFor.current = anchorEntityId;
    fireCapsule({
      subjectNpi: state.npi,
      decisionType: 'DEPLOYMENT',
      triggerEvent: 'start_attestation',
      sourceReferenceId: anchorEntityId,
      metadata: {
        source: 'passport.start-event',
        readinessScore: state.readiness.score ?? null,
        readinessStatus: state.readiness.status ?? null,
      },
    });
  }, [canViewPassport, anchorEntityId, state.npi, state.readiness.score, state.readiness.status]);
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

  const { identity, sources } = state;

  const npiValid = npi.length === 10 && !/\D/.test(npi);
  const npiChecksumOk = npiValid && isValidNpiChecksum(npi);

  // Retry hook wired through handleSecondaryAction — used by SourceRow
  // when a lane renders as unavailable. The button surfaces a concrete
  // recovery action instead of relabeling failure as motion.
  const retryCurrentNpi = () => {
    const target = state.npi ?? npi.trim();
    if (/^\d{10}$/.test(target)) {
      void startIngest(target);
    }
  };

  const laneStates = derivePassportLaneStates(state);
  const laneStateList = Object.values(laneStates);
  const continuation = resolvePassportContinuation({
    hasAnchor: Boolean(anchorEntityId),
    allRequiredLanesResolved: !laneStateList.includes('pending'),
    hasUnresolvedBlockers: deriveBlockers(state).length > 0,
    anyLanePending: laneStateList.includes('pending'),
    anyLaneReviewRequired: laneStateList.includes('review_required'),
    anyLaneAccessRequired: laneStateList.includes('access_required'),
    anyLaneUnavailable: laneStateList.includes('unavailable'),
    anyLaneStale: laneStateList.includes('stale'),
    anyLaneNoRecord: laneStateList.includes('no_record'),
  });

  return (
    <main className="bg-background px-4 pt-16 sm:pt-20 pb-24">
      <div className="mx-auto w-full max-w-5xl">

        {/* Role context banner */}
        {readinessContext ? (
          <div className="mb-6 rounded-2xl border border-border bg-card px-4 py-3 max-w-lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Role context
            </p>
            <p className="mt-2 text-sm text-foreground/80">{readinessContext}</p>
          </div>
        ) : null}

        {/* Idle state — two-column layout */}
        {!isActive && (
          <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:items-start">
            {/* Left column: heading + form + source explanations */}
            <div className="space-y-8">
              <div>
                <h1 className="text-foreground text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
                  Check Your Readiness
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base mt-3 leading-relaxed max-w-xl">
                  Enter your NPI to instantly verify your credentialing status across NPPES,
                  OIG/LEIE, PECOS, and state medical boards. Results appear in seconds.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <label htmlFor="npi-input" className="sr-only">Enter your 10-digit NPI number</label>
                <div className="flex gap-3 sm:items-center flex-col sm:flex-row">
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
                      onChange={e => setNpi(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 10-digit NPI"
                      className="h-14 w-full rounded-xl border-border bg-card px-4 text-lg font-mono tracking-widest text-foreground placeholder:text-muted-foreground/30 shadow-none focus-visible:ring-ring"
                    />
                    {/* Real-time visual feedback */}
                    {npi.length > 0 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground/50">
                        {npi.length}/10
                        {npiValid && (npiChecksumOk
                          ? <span className="ml-1.5 text-trust-green">✓</span>
                          : <span className="ml-1.5 text-trust-red">✗</span>
                        )}
                      </span>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={!npiValid}
                    className="h-14 rounded-xl bg-foreground px-6 text-sm font-semibold text-background hover:opacity-90 sm:w-auto w-full"
                  >
                    Check readiness
                  </Button>
                </div>
                {inputError && (
                  <p id="npi-error" role="alert" className="text-destructive text-xs mt-1">{inputError}</p>
                )}
              </form>

              {/* Source explanations */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Sources checked
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SOURCE_EXPLANATIONS.map(src => {
                    const SourceIcon = src.locked ? Lock : ShieldCheck;
                    return (
                      <div key={src.id} className="flex gap-3 rounded-xl border border-border bg-card p-3.5">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground"
                        >
                          <SourceIcon className="h-3 w-3" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{src.name}</p>
                            {src.locked && (
                              <span className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground flex items-center gap-1">
                                <Lock aria-hidden="true" className="h-2.5 w-2.5" />
                                Not Yet Supported
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{src.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-muted-foreground/60 leading-relaxed">
                VitalCV only checks publicly available data. No PHI is stored. No signup required to preview.
              </p>
            </div>

            {/* Right column: sample readiness card */}
            <div className="hidden lg:block">
              <PassportPreviewCard demo />
            </div>
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

            {/* Autopilot — hero position. Direction, not suggestion:
                "You are closest to X, to get there do Y". Steps + days
                share the same state derivation as the ActionPanel below,
                so the top-of-surface direction stays in lockstep with the
                Next Best Action the user will actually take. Specialty is
                forwarded to the top-match endpoint so it can promote the
                response from fallback ("Closest available opportunity")
                to primary ("You are closest to") when a real fit exists. */}
            {/* Completion beat — appears the moment a blocker clears.
                Transient (auto-dismiss ~4.5s); named to mirror the
                progress copy so the click-through narrative closes cleanly
                ("Submitting PECOS enrollment…" → "PECOS enrollment
                complete"). Placed above the hero so the user sees the
                celebration paired with the fresh Autopilot state that
                now reflects the resolved blocker. */}
            {completedBlocker && (
              <div
                role="status"
                aria-live="polite"
                data-slot="autopilot-completion"
                className="
                  rounded-xl border px-[var(--vt-space-16)] py-3
                  text-sm font-[var(--vt-font-weight-semibold)]
                  animate-fade-in-up
                "
                style={{
                  // Theme tokens: readable in both light and dark modes.
                  // --vt-status-resolved is dark green in light theme and
                  // light green in dark theme, so the banner always carries
                  // real contrast against its background.
                  color: 'var(--vt-status-resolved)',
                  borderColor: 'color-mix(in oklab, var(--vt-status-resolved) 40%, transparent)',
                  background: 'color-mix(in oklab, var(--vt-status-resolved) 10%, transparent)',
                }}
              >
                <span className="mr-1.5" aria-hidden>
                  ✔
                </span>
                {blockerToCompletionLabel(completedBlocker)}
              </div>
            )}

            {/* Omega recompute failure banner. Owner-attributed via
                resolveOmegaRecomputeFailureOwnership — the clinician sees
                who owns the retry ("VitalCV will retry the recompute") and
                what the ETA is ("automatically on the next navigation"),
                not an internal-jargon "server-side decision view" line.
                Persists until authoritative release or navigation; no
                auto-dismiss timer, because a truth signal with a 10s
                half-life is a half-truth. */}
            {omegaRecomputeStatus === 'failed' && !completedBlocker && (() => {
              const recompute = resolveOmegaRecomputeFailureOwnership();
              return (
                <div
                  role="status"
                  aria-live="polite"
                  data-slot="omega-recompute-failed"
                  className="
                    rounded-xl border border-amber-500/40 bg-amber-500/10
                    px-[var(--vt-space-16)] py-3
                    text-sm text-amber-900 dark:text-amber-200
                    animate-fade-in-up
                  "
                >
                  <p className="font-semibold">{recompute.ownerPrefix}</p>
                  <p className="mt-1 text-amber-800/80 dark:text-amber-100/80">
                    {recompute.rationale}
                    {recompute.etaOrDependency ? ` ${recompute.etaOrDependency}.` : null}
                  </p>
                </div>
              );
            })()}

            {/* Waiting-for-sources placeholder — appears while the stream
                is live but readiness hasn't computed yet. Shows a scale
                hint ("— / 100") so the user knows what will arrive rather
                than staring at nothing. Never renders a fake number. */}
            {state.readiness.score === undefined && isRunning && (
              <div
                data-slot="readiness-placeholder"
                className="
                  rounded-xl border border-[var(--vt-border)]
                  bg-[var(--vt-surface)]
                  px-[var(--vt-space-16)] py-4
                "
                aria-live="polite"
              >
                <p className="text-xs uppercase tracking-widest text-[var(--vt-text-muted)]">
                  Readiness
                </p>
                <p className="mt-1 text-2xl font-[var(--vt-font-weight-semibold)] tabular-nums text-[var(--vt-text-primary)]">
                  — / 100
                </p>
                <p className="mt-0.5 text-xs text-[var(--vt-text-muted)]">
                  Score available after verification
                </p>
              </div>
            )}

            {state.readiness.score !== undefined && (() => {
              // Pin the Autopilot to the exact role the user arrived
              // with (Explore CTA, shared opportunity link). When present
              // this overrides the specialty-based top-match fetch, so
              // the user sees readiness against the role they came for,
              // not a generic closest match.
              const pinnedOpportunity =
                roleContext.roleId && roleContext.roleTitle
                  ? {
                      opportunityId: roleContext.roleId,
                      employer: roleContext.employerName ?? humanizeContextToken(roleContext.employerSlug ?? ''),
                      role: roleContext.roleTitle,
                      organizationSlug: roleContext.employerSlug ?? '',
                    }
                  : null;

              return (
                <AutopilotPanel
                  steps={deriveAutopilotSteps(state, resolvingBlocker)}
                  estimatedDays={deriveAutopilotDays(state, resolvingBlocker)}
                  outcomeLabel={deriveAutopilotOutcome(state, resolvingBlocker)}
                  specialty={identity.specialty ?? null}
                  npi={state.npi ?? null}
                  pinnedOpportunity={pinnedOpportunity}
                />
              );
            })()}

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

          {/* Source status rows — every row reads from the recovery-path
              contract (apps/web/lib/trust/recovery-path.ts). Badges never
              relabel failure as motion; each non-checked row carries the
              owner-attributed explanation + recovery action. */}
          <Card className="animate-panel-enter gap-0 rounded-xl border border-[var(--vt-border)] px-4 py-2">
            <SourceRow
              lane="nppes"
              sourceState={sources.nppes}
              streamState={state}
              onRetry={retryCurrentNpi}
            />
            <SourceRow
              lane="oig"
              sourceState={sources.oig}
              streamState={state}
              onRetry={retryCurrentNpi}
            />
            <SourceRow
              lane="pecos"
              sourceState={sources.pecos}
              streamState={state}
              onRetry={retryCurrentNpi}
            />
            <SourceRow
              lane="state_board"
              sourceState={resolveStateBoardSourceState(state)}
              streamState={state}
            />
          </Card>

            {/* Readiness summary intentionally removed — its score (N/100)
                violates the "no raw numbers" rule and the band/status
                duplicates Autopilot's outcome line. Readiness is still
                available to callers via the ingest state; re-surface it
                only if a new, non-duplicative affordance is needed. */}

            {/* Acceptance — which orgs have accepted this passport */}
            {state.readiness.score !== undefined && (
              <AcceptanceCard state={state} />
            )}

            {/* Cohort insights — supportive historical context, not authoritative */}
            {state.readiness.score !== undefined && <CohortInsights />}

            {/* Minimal audit log — decision capsule count */}
            {state.npi && canViewPassport && <DecisionLogSummary npi={state.npi} />}

            {/* Startability intentionally removed — status + blockers +
                estimated days are now surfaced by the hero Autopilot
                panel. One source of truth for "what's in the way and how
                long it takes". StartabilityCard remains exported from
                its module for other surfaces. */}

            {/* Command surface — one next step, one action.
                The CTA renders the owner-specific verb from the blocker
                ownership contract (apps/web/lib/trust/action-owner.ts),
                never a generic "Take Action". The `nextStep` line carries
                the owner prefix so the clinician sees "You need to…" vs
                "VitalCV is retrying…" vs "Your institution covers this"
                before they click. */}
            {(state.readiness.score !== undefined || resolvingBlocker) && (() => {
              const visibleBlockers = deriveBlockers(state).filter((b) => b !== resolvingBlocker);
              if (resolvingBlocker) {
                const resolvingOwnership = resolveBlockerOwnership(resolvingBlocker);
                return (
                  <ActionPanel
                    nextStep={resolvingOwnership.ownerPrefix}
                    actionLabel={resolvingOwnership.actionLabel}
                    resolving
                  />
                );
              }
              if (visibleBlockers.length > 0) {
                const top = visibleBlockers[0];
                const ownership = resolveBlockerOwnership(top);
                return (
                  <ActionPanel
                    nextStep={ownership.ownerPrefix}
                    actionLabel={ownership.actionLabel}
                    onAction={() => executeAction(top)}
                  />
                );
              }
              if (canViewPassport && anchorEntityId) {
                return (
                  <div className="space-y-2">
                    {continuation.provisionalNotice && (
                      <p
                        role="status"
                        aria-live="polite"
                        className="rounded-lg border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-xs text-[var(--vt-text-muted)] leading-relaxed"
                      >
                        {continuation.provisionalNotice}
                      </p>
                    )}
                    <ActionPanel
                      nextStep={continuation.headline}
                      actionLabel={continuation.ctaLabel}
                      href={buildPassportEntityHref(anchorEntityId)}
                    />
                  </div>
                );
              }
              return null;
            })()}

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
                title={continuation.headline}
                description={`${continuation.description}${continuation.provisionalNotice ? ` ${continuation.provisionalNotice}` : ''}`}
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
  const handoff = parseOpportunityPassportHandoff(searchParams);
  return (
    <PassportPageContent
      initialNpi={searchParams?.get('npi') ?? null}
      roleContext={handoff
        ? {
            roleId: handoff.roleId,
            roleTitle: handoff.roleTitle,
            employerSlug: handoff.employerSlug,
            employerName: handoff.employerName,
            canonicalOrgId: handoff.canonicalOrgId,
            canonicalRoleId: handoff.canonicalRoleId,
            readinessPreviewLink: handoff.readinessPreviewLink,
          }
        : {
            roleId: null,
            roleTitle: null,
            employerSlug: null,
            employerName: null,
            canonicalOrgId: null,
            canonicalRoleId: null,
            readinessPreviewLink: null,
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
          roleContext={{
            roleId: null,
            roleTitle: null,
            employerSlug: null,
            employerName: null,
            canonicalOrgId: null,
            canonicalRoleId: null,
            readinessPreviewLink: null,
          }}
        />
      }
    >
      <PassportPageSearchParams />
    </Suspense>
  );
}
