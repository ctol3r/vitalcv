'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoleContext } from '@/components/auth/RoleContext';
import { FunnelLoadingSequence } from '@/components/hero/FunnelLoadingSequence';
import { ReadinessPreview } from '@/components/hero/ReadinessPreview';
import { Button } from '@/components/ui/button';
import {
  getTrustStatusDescriptor,
  TrustStatusBadge,
} from '@/components/ui/trust-status-badge';
import { useIngestStream, type IngestStreamState } from '@/hooks/useIngestStream';
import { FUNNEL_EVENTS, hashNpi, trackFunnelEvent } from '@/lib/analytics/funnel';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import {
  LIVE_PATH_NPI_RE,
  resolveLivePathAuthState,
  resolveLivePathSourceMode,
} from '@/lib/live-path/contracts';
import { trackUxEvent } from '@/lib/telemetry/ux-tracker';
import { buildPassportLookupHref } from '@/lib/trust/public-wedge-parity';
import { Input } from '@/components/ui/input';

type Phase = 'idle' | 'loading' | 'preview';

type ConsoleStageStatus =
  | 'pending'
  | 'loading'
  | 'checked'
  | 'access_required'
  | 'unavailable'
  | 'review_required';

interface ConsoleStage {
  id: 'nppes' | 'oig' | 'pecos' | 'license';
  label: string;
  status: ConsoleStageStatus;
  detail: string;
}

const INVALID_NPI_DIGITS_MESSAGE = 'NPI must contain only digits.';
const INVALID_NPI_LENGTH_MESSAGE = 'NPI must be exactly 10 digits.';

/* Flow steps removed — hero now uses a single headline + NPI input */

const STAGE_SYMBOL: Record<ConsoleStageStatus, string> = {
  pending: '·',
  loading: '◌',
  checked: '✓',
  access_required: '!',
  unavailable: '✗',
  review_required: '?',
};

const STAGE_COLOR: Record<ConsoleStageStatus, string> = {
  pending: 'text-[var(--vt-text-muted)]',
  loading: 'text-[var(--vt-accent)]',
  checked: 'text-[var(--vt-status-resolved)]',
  access_required: 'text-[var(--vt-risk-medium)]',
  unavailable: 'text-[var(--vt-severity-critical)]',
  review_required: 'text-[var(--vt-risk-medium)]',
};

function resolveLicenseStage(streamState: IngestStreamState): ConsoleStage {
  if (streamState.phase === 'error' && !streamState.isUsable) {
    return {
      id: 'license',
      label: 'Configured state board lane',
      status: 'unavailable',
      detail: 'Live retry required before authority can be checked.',
    };
  }

  if (streamState.completedAt || streamState.readyAt || streamState.isUsable) {
    return {
      id: 'license',
      label: 'Configured state board lane',
      status: 'access_required',
      detail: 'Institutional source access is still required for source-backed licensure.',
    };
  }

  return {
    id: 'license',
    label: 'Configured state board lane',
    status: streamState.runId ? 'loading' : 'pending',
    detail: 'Waiting to determine whether source-backed authority is available.',
  };
}

function buildConsoleStages(streamState: IngestStreamState): ConsoleStage[] {
  const nppes: ConsoleStage = {
    id: 'nppes',
    label: 'NPPES',
    status:
      streamState.sources.nppes === 'error'
        ? 'unavailable'
        : streamState.identity.authoritative
          ? 'checked'
          : streamState.sources.nppes === 'done'
            ? 'review_required'
            : streamState.sources.nppes === 'checking'
              ? 'loading'
              : 'pending',
    detail: streamState.identity.authoritative
      ? 'Source-backed provider identity is attached to this run.'
      : streamState.sources.nppes === 'done'
        ? 'The provider record needs review before stronger trust claims can rely on it.'
        : 'Waiting for the public NPI registry.',
  };

  const oig: ConsoleStage = {
    id: 'oig',
    label: 'OIG / LEIE',
    status:
      streamState.sources.oig === 'error'
        ? 'unavailable'
        : streamState.standing.exclusionStatus === 'EXCLUDED' || streamState.standing.exclusionStatus === 'POSSIBLE_MATCH'
          ? 'review_required'
          : streamState.standing.exclusionChecked && streamState.standing.exclusionClear
            ? 'checked'
            : streamState.sources.oig === 'checking'
              ? 'loading'
              : streamState.sources.oig === 'done'
                ? 'pending'
                : 'pending',
    detail:
      streamState.standing.exclusionChecked
        ? streamState.standing.exclusionClear
          ? 'No exclusion finding is attached in this live run.'
          : `Current result requires review: ${streamState.standing.exclusionStatus ?? 'unknown'}.`
        : 'Waiting for the OIG / LEIE result.',
  };

  const pecos: ConsoleStage = {
    id: 'pecos',
    label: 'CMS PECOS',
    status:
      streamState.sources.pecos === 'error'
        ? 'unavailable'
        : streamState.standing.enrollmentStatus === 'NOT_FOUND' || streamState.standing.enrollmentStatus === 'OPTED_OUT'
          ? 'review_required'
          : streamState.standing.enrollmentChecked && streamState.standing.enrollmentStatus === 'ENROLLED'
            ? 'checked'
            : streamState.sources.pecos === 'checking'
              ? 'loading'
              : streamState.sources.pecos === 'done'
                ? 'pending'
                : 'pending',
    detail:
      streamState.standing.enrollmentChecked
        ? streamState.standing.enrollmentStatus === 'ENROLLED'
          ? 'CMS PECOS returned an enrolled provider record.'
          : `CMS PECOS returned ${streamState.standing.enrollmentStatus ?? 'an unresolved status'}.`
        : 'Waiting for the CMS PECOS result.',
  };

  return [
    nppes,
    oig,
    pecos,
    resolveLicenseStage(streamState),
  ];
}

function mapStageToFallbackStatus(status: ConsoleStageStatus) {
  switch (status) {
    case 'checked':
      return 'ok' as const;
    case 'loading':
      return 'loading' as const;
    case 'access_required':
      return 'skipped' as const;
    case 'review_required':
    case 'unavailable':
      return 'failed' as const;
    case 'pending':
    default:
      return 'waiting' as const;
  }
}

function resolveStageBadge(stageStatus: ConsoleStageStatus): {
  status: 'pending' | 'checked' | 'access_required' | 'unavailable' | 'review_required';
  label: string;
} {
  switch (stageStatus) {
    case 'checked':
      return { status: 'checked', label: 'Checked' };
    case 'access_required':
      return { status: 'access_required', label: 'Access required' };
    case 'unavailable':
      return { status: 'unavailable', label: 'Unavailable' };
    case 'review_required':
      return { status: 'review_required', label: 'Review required' };
    case 'loading':
    case 'pending':
    default:
      return { status: 'pending', label: 'Pending' };
  }
}

function writeLiveSnapshot(npi: string, state: IngestStreamState) {
  try {
    sessionStorage.setItem(
      `vitalcv:preview:${npi}`,
      JSON.stringify({
        kind: 'ingestStream',
        timestamp: Date.now(),
        state,
      }),
    );
  } catch {
    // sessionStorage is best-effort only.
  }
}

interface LiveTrustConsoleProps {
  onPreviewReady?: (npi: string, displayName: string) => void;
  initialNpi?: string;
}

export function LiveTrustConsole({ onPreviewReady, initialNpi }: LiveTrustConsoleProps = {}) {
  const [npi, setNpi] = useState(initialNpi ?? '');
  const [phase, setPhase] = useState<Phase>('idle');
  const [previewIn, setPreviewIn] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [fallbackReason, setFallbackReason] = useState<'backendUnavailable' | 'partialCoverage' | null>(null);
  const { state, startIngest } = useIngestStream();
  const { isLoaded, isSignedIn } = useRoleContext();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const pageLoadTrackedRef = useRef(false);
  const previewTrackedRef = useRef(false);
  const previewErrorTrackedRef = useRef(false);
  const previewReadyTrackedRef = useRef(false);
  const submitStartedAtRef = useRef<number | null>(null);
  const npiFocusTrackedRef = useRef(false);
  const resultsDisplayedTrackedRef = useRef(false);
  // TTFV: guard the auto-start effect so URL-based deep-links only fire the
  // ingest stream once per mount — otherwise React strict mode / re-renders
  // would spawn duplicate SSE streams for the same NPI.
  const autoStartedRef = useRef(false);

  const authState = resolveLivePathAuthState({ isLoaded, isSignedIn });
  const hasLiveSignal = Boolean(
    state.runId
    || state.identity.displayName
    || state.identity.authoritative
    || state.standing.exclusionChecked
    || state.standing.enrollmentChecked
    || typeof state.readiness.score === 'number',
  );
  const isFallback = phase !== 'idle' && !state.isUsable && (state.phase === 'error' || state.disconnected);
  const sourceMode = resolveLivePathSourceMode({
    isDemo: isFallback,
    hasLiveState: hasLiveSignal,
  });
  const stages = useMemo(() => buildConsoleStages(state), [state]);
  const sourcesCheckedCount = stages.filter((s) => s.status === 'checked').length;
  const readinessScore = typeof state.readiness.score === 'number' ? state.readiness.score : null;
  const readinessLevel = state.readiness.level ?? null;
  const sourceBackedClaimCount = state.readiness.claimCount ?? 0;
  const hasSourceBackedClaims = sourceBackedClaimCount > 0;
  
  const continueDisabled = !state.isUsable && !Boolean(state.completedAt) && state.phase !== 'error';
  const trimmedNpi = npi.trim();

  useEffect(() => {
    if (initialNpi && phase === 'idle' && npi !== initialNpi) {
      setNpi(initialNpi);
    }
  }, [initialNpi, npi, phase]);

  // TTFV: auto-start the ingest stream when the homepage is opened with a
  // valid ?npi=… query param. Matches /passport so deep-links show identity +
  // sanctions + decision immediately instead of stalling on the hero form.
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!initialNpi) return;
    if (!LIVE_PATH_NPI_RE.test(initialNpi)) return;
    if (phase !== 'idle') return;
    if (state.runId || state.startedAt) return;

    autoStartedRef.current = true;
    setFormMessage(null);
    setPhase('preview');
    setPreviewIn(true);
    setFallbackReason(null);
    previewTrackedRef.current = false;
    previewErrorTrackedRef.current = false;
    previewReadyTrackedRef.current = false;
    resultsDisplayedTrackedRef.current = false;
    submitStartedAtRef.current = performance.now();

    trackUxEvent({
      event_name: UX_EVENTS.NPI_SUBMIT_ATTEMPT,
      component_id: 'homepage_npi_flow',
      metadata: {
        auth_state: authState,
        npi_length: initialNpi.length,
        source_mode: 'live',
        validation_state: 'valid',
      },
    });

    hashNpi(initialNpi).then((npiHash) => {
      trackFunnelEvent(FUNNEL_EVENTS.NPI_SUBMITTED, { npi_hash: npiHash });
    });

    trackUxEvent({
      event_name: UX_EVENTS.SOURCE_CHECK_STARTED,
      component_id: 'homepage_npi_flow',
      metadata: {
        auth_state: authState,
        npi_length: initialNpi.length,
        source_mode: 'live',
      },
    });

    void startIngest(initialNpi);
  }, [authState, initialNpi, phase, startIngest, state.runId, state.startedAt]);

  useEffect(() => {
    if (pageLoadTrackedRef.current || !isLoaded) return;

    trackUxEvent({
      event_name: 'page_loaded',
      component_id: 'homepage_npi_flow',
      metadata: {
        auth_state: authState,
        source_mode: 'live',
      },
    });

    trackFunnelEvent(FUNNEL_EVENTS.HOMEPAGE_VIEWED);

    pageLoadTrackedRef.current = true;
  }, [authState, isLoaded]);

  useEffect(() => {
    if (phase === 'idle') return;
    if (!LIVE_PATH_NPI_RE.test(trimmedNpi)) return;
    if (state.startedAt) {
      writeLiveSnapshot(trimmedNpi, state);
    }
  }, [phase, state, trimmedNpi]);

  // TTFV: promote to preview the moment we have *any* live signal, not when
  // the whole run is terminal. The preview panel renders source rows with
  // "loading" / "pending" badges that update progressively — so the user sees
  // identity + sanctions + decision the moment each source resolves.
  useEffect(() => {
    if (phase !== 'loading') return;
    if (hasLiveSignal || state.isUsable || Boolean(state.completedAt) || state.phase === 'error') {
      setPhase('preview');
      setPreviewIn(true);
    }
  }, [hasLiveSignal, phase, state.completedAt, state.isUsable, state.phase]);

  useEffect(() => {
    if (!previewIn || previewTrackedRef.current) return;

    trackUxEvent({
      event_name: UX_EVENTS.READINESS_REVEALED,
      component_id: 'homepage_npi_flow',
      duration_ms: submitStartedAtRef.current === null
        ? null
        : performance.now() - submitStartedAtRef.current,
      metadata: {
        auth_state: authState,
        interaction_result: isFallback ? 'fallback' : 'success',
        npi_length: trimmedNpi.length,
        source_mode: sourceMode,
      },
    });

    if (!resultsDisplayedTrackedRef.current) {
      trackFunnelEvent(FUNNEL_EVENTS.RESULTS_DISPLAYED, {
        sources_checked: sourcesCheckedCount,
        is_fallback: isFallback,
        duration_ms: submitStartedAtRef.current === null
          ? null
          : Math.round(performance.now() - submitStartedAtRef.current),
      });
      resultsDisplayedTrackedRef.current = true;
    }

    previewTrackedRef.current = true;
  }, [authState, isFallback, previewIn, sourceMode, sourcesCheckedCount, trimmedNpi.length]);

  useEffect(() => {
    if (!isFallback || !previewIn || previewErrorTrackedRef.current) return;

    trackUxEvent({
      event_name: 'preview_error',
      component_id: 'homepage_npi_flow',
      duration_ms: submitStartedAtRef.current === null
        ? null
        : performance.now() - submitStartedAtRef.current,
      metadata: {
        auth_state: authState,
        error_type: fallbackReason === 'backendUnavailable' ? 'backend_unavailable' : 'partial_coverage',
        interaction_result: 'error',
        npi_length: trimmedNpi.length,
        source_mode: 'demo',
      },
    });

    previewErrorTrackedRef.current = true;
  }, [authState, fallbackReason, isFallback, previewIn, trimmedNpi.length]);

  useEffect(() => {
    if (!previewIn || previewReadyTrackedRef.current) return;

    const previewName = state.identity.displayName ?? `NPI ${trimmedNpi}`;
    onPreviewReady?.(trimmedNpi, previewName);
    previewReadyTrackedRef.current = true;
  }, [onPreviewReady, previewIn, state.identity.displayName, trimmedNpi]);

  useEffect(() => {
    if (!isFallback) {
      setFallbackReason(null);
      return;
    }

    const message = state.error?.toLowerCase() ?? '';
    setFallbackReason(
      message.includes('failed to start') || message.includes('runid')
        ? 'backendUnavailable'
        : 'partialCoverage',
    );
  }, [isFallback, state.error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === 'loading') return;

    const nextNpi = npi.trim();
    const isValidNpi = LIVE_PATH_NPI_RE.test(nextNpi);

    trackUxEvent({
      event_name: UX_EVENTS.NPI_SUBMIT_ATTEMPT,
      component_id: 'homepage_npi_flow',
      metadata: {
        auth_state: authState,
        npi_length: nextNpi.length,
        source_mode: 'live',
        validation_state: isValidNpi ? 'valid' : 'invalid',
      },
    });

    if (isValidNpi) {
      hashNpi(nextNpi).then((npiHash) => {
        trackFunnelEvent(FUNNEL_EVENTS.NPI_SUBMITTED, { npi_hash: npiHash });
      });
    }

    if (!isValidNpi) {
      setFormMessage(/\D/.test(nextNpi) ? INVALID_NPI_DIGITS_MESSAGE : INVALID_NPI_LENGTH_MESSAGE);
      inputRef.current?.focus({ preventScroll: true });
      trackUxEvent({
        event_name: UX_EVENTS.NPI_INVALID,
        component_id: 'homepage_npi_flow',
        metadata: {
          auth_state: authState,
          interaction_result: 'cancel',
          npi_length: nextNpi.length,
          source_mode: 'live',
        },
      });
      return;
    }

    setFormMessage(null);
    setNpi(nextNpi);
    // TTFV: show the preview panel immediately — no artificial loading phase.
    // The source rows render with live spinner/pending/checked badges that
    // progressively update as each SSE event arrives from the backend.
    setPhase('preview');
    setPreviewIn(true);
    setFallbackReason(null);
    previewTrackedRef.current = false;
    previewErrorTrackedRef.current = false;
    previewReadyTrackedRef.current = false;
    resultsDisplayedTrackedRef.current = false;
    submitStartedAtRef.current = performance.now();

    trackUxEvent({
      event_name: UX_EVENTS.SOURCE_CHECK_STARTED,
      component_id: 'homepage_npi_flow',
      metadata: {
        auth_state: authState,
        npi_length: nextNpi.length,
        source_mode: 'live',
      },
    });

    await startIngest(nextNpi);
  }

  function handleContinue() {
    const dest = buildPassportLookupHref(
      LIVE_PATH_NPI_RE.test(trimmedNpi) ? trimmedNpi : null,
    );

    if (LIVE_PATH_NPI_RE.test(trimmedNpi)) {
      writeLiveSnapshot(trimmedNpi, state);
    }

    trackUxEvent({
      event_name: UX_EVENTS.SHARE_CTA_CLICKED,
      component_id: 'homepage_npi_flow',
      metadata: {
        auth_state: authState,
        npi_length: trimmedNpi.length,
        source_mode: sourceMode,
      },
    });

    router.push(dest);
  }

  return (
    <section className="relative overflow-hidden bg-background">
      {/* Subtle light-mode gradient — disappears in dark mode */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 dark:opacity-0 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary) / 0.06), transparent)',
        }}
      />

      <div
        className={`relative z-10 mx-auto w-full max-w-3xl px-4 sm:px-6 ${
          phase === 'preview'
            ? 'pt-5 sm:pt-10 pb-6 sm:pb-10'
            : 'pt-16 sm:pt-28 pb-14 sm:pb-24'
        }`}
      >
        {/* ── HERO: idle & loading states ── */}
        {phase !== 'preview' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="text-center"
          >
            <h1 className="text-[clamp(2rem,5.5vw,3.75rem)] font-bold leading-[1.08] tracking-[-0.03em] text-foreground">
              Stop starting over.
              <span className="block text-muted-foreground">Start ready.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Enter your NPI to see what&rsquo;s checked, what&rsquo;s missing, and what could delay your next role&nbsp;&mdash; using real federal sources.
            </p>

            <form
              id="npi-entry"
              onSubmit={handleSubmit}
              className="mx-auto mt-8 flex w-full max-w-lg flex-col gap-3 sm:flex-row sm:items-center"
            >
              <label htmlFor="npi-input" className="sr-only">
                Enter your 10-digit NPI number
              </label>
              <Input
                ref={inputRef}
                id="npi-input"
                name="npi"
                type="text"
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                autoComplete="off"
                value={npi}
                readOnly={phase === 'loading'}
                aria-busy={phase === 'loading'}
                aria-disabled={phase === 'loading'}
                aria-label="Enter your 10-digit NPI number"
                aria-invalid={!!formMessage}
                aria-describedby={formMessage ? 'npi-error' : undefined}
                onFocus={() => {
                  if (!npiFocusTrackedRef.current) {
                    trackFunnelEvent(FUNNEL_EVENTS.NPI_INPUT_FOCUSED);
                    npiFocusTrackedRef.current = true;
                  }
                }}
                onChange={(e) => {
                  if (formMessage) setFormMessage(null);
                  setNpi(e.target.value.replace(/\D/g, ''));
                }}
                placeholder="Enter 10-digit NPI"
                style={{ height: '3.5rem', minHeight: '3.5rem' }}
                className={`min-w-0 flex-1 rounded-xl border-border bg-card px-4 py-3 text-center text-[16px] text-foreground placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 focus-visible:border-primary/40 focus-visible:ring-ring sm:text-left ${
                  phase === 'idle' && !npi
                    ? '[animation:vcv-input-pulse_2.5s_ease-in-out_infinite]'
                    : ''
                } ${
                  phase === 'loading'
                    ? 'cursor-default bg-muted opacity-80 [animation:none]'
                    : ''
                } ${formMessage ? 'border-destructive/50' : ''}`}
              />
              <Button
                type="submit"
                variant="default"
                disabled={phase === 'loading'}
                className="h-14 w-full shrink-0 rounded-xl px-6 text-sm font-semibold min-h-[44px] sm:w-auto"
              >
                <span aria-live="polite">
                  {phase === 'loading' ? 'Checking...' : 'Apply with VCV'}
                </span>
              </Button>
            </form>

            {formMessage && (
              <p
                id="npi-error"
                role="alert"
                className="mt-3 text-center text-xs text-destructive"
              >
                {formMessage}
              </p>
            )}

            {/* Trust signals */}
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>No sign-up required</span>
              <span aria-hidden="true" className="hidden text-border sm:inline">·</span>
              <span>Uses real sources: NPPES · OIG · PECOS</span>
              <span aria-hidden="true" className="hidden text-border sm:inline">·</span>
              <span>Under 60 seconds</span>
            </p>

            {/* Deterministic loading sequence */}
            {phase === 'loading' && (
              <FunnelLoadingSequence
                streamState={state}
                visible={phase === 'loading'}
              />
            )}
          </motion.div>
        ) : (
          /* ── RESULTS DISPLAY ── */
          <>
            {/* Readiness score header */}
            <div
              className="mb-6 text-center"
              style={{ animation: 'vcv-score-count 500ms ease-out both' }}
            >
              {readinessScore !== null ? (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Readiness Score
                  </p>
                  <p className="mt-2 text-[clamp(2.5rem,5vw,3.5rem)] font-bold leading-none tracking-tight text-foreground">
                    {readinessScore}<span className="text-muted-foreground">/100</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {sourcesCheckedCount} of {stages.length} sources verified
                    {readinessLevel ? ` — ${readinessLevel}` : ''}
                    {sourcesCheckedCount >= 3
                      ? ' — Ready to present'
                      : sourcesCheckedCount >= 1
                        ? ' — Partially verified'
                        : ' — Needs attention'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Readiness snapshot
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your verification results are below.
                  </p>
                </>
              )}
              {isFallback && (
                <div className="mt-2">
                  <TrustStatusBadge status="preview_only" label="Preview" size="sm" />
                </div>
              )}
            </div>

            {/* Source verification results — staggered reveal */}
            <div className="space-y-2">
              {stages.map((stage, index) => {
                const badge = resolveStageBadge(stage.status);
                const statusDescriptor = getTrustStatusDescriptor(badge.status, badge.label);
                const isVerified = stage.status === 'checked';
                const timestamp = isVerified && state.completedAt
                  ? new Date(state.completedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : null;

                return (
                  <div
                    key={stage.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                    style={{
                      animation: `vcv-stagger-in 350ms ease-out ${index * 100}ms both`,
                    }}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {stage.status === 'loading' ? (
                        <span className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-primary/35 border-t-transparent animate-spin" />
                      ) : (
                        <span
                          className={`mt-0.5 w-4 shrink-0 text-center font-mono text-sm leading-none ${STAGE_COLOR[stage.status]}`}
                        >
                          {STAGE_SYMBOL[stage.status]}
                        </span>
                      )}
                      <div className="min-w-0">
                        <span
                          className={`text-sm font-medium transition-colors duration-150 ${
                            stage.status === 'checked'
                              ? 'text-foreground'
                              : stage.status === 'pending'
                                ? 'text-muted-foreground'
                                : 'text-foreground'
                          }`}
                        >
                          {stage.label}
                        </span>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {statusDescriptor
                            ? `${statusDescriptor} · ${stage.detail}`
                            : stage.detail}
                        </p>
                        {/* Source provenance line */}
                        {timestamp && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                            Verified by {stage.label} on {timestamp}
                          </p>
                        )}
                      </div>
                    </div>
                    <TrustStatusBadge
                      status={badge.status}
                      label={badge.label}
                      size="sm"
                    />
                  </div>
                );
              })}
            </div>

            {/* Download Proof + Continue */}
            <div
              className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              style={{ animation: 'vcv-stagger-in 350ms ease-out 400ms both' }}
            >
              {hasSourceBackedClaims ? (
                <Button
                  variant="default"
                  onClick={handleContinue}
                  disabled={continueDisabled}
                  className="h-12 w-full rounded-xl px-6 text-sm font-semibold min-h-[44px] sm:w-auto"
                >
                  {continueDisabled ? 'Checking readiness...' : 'Download Proof'}
                </Button>
              ) : null}
              <Button
                variant={hasSourceBackedClaims ? "outline" : "default"}
                onClick={handleContinue}
                disabled={continueDisabled}
                className={`h-12 w-full rounded-xl px-6 text-sm font-medium min-h-[44px] sm:w-auto ${
                  !hasSourceBackedClaims ? 'w-full' : ''
                }`}
              >
                Continue to full passport
              </Button>
            </div>

            {/* ReadinessPreview (detailed expandable view) */}
            <div className={`mt-6 ${previewIn ? 'animate-fade-in-up' : ''}`}>
              <ReadinessPreview
                npi={trimmedNpi}
                realState={null}
                isDemo={isFallback}
                visible={previewIn}
                onContinue={handleContinue}
                fallbackReason={fallbackReason}
                fallbackSources={{
                  nppes: mapStageToFallbackStatus(stages[0]?.status ?? 'pending'),
                  oig: mapStageToFallbackStatus(stages[1]?.status ?? 'pending'),
                  readiness: isFallback ? 'failed' : previewIn ? 'ok' : 'loading',
                }}
                streamState={isFallback ? null : state}
                continueDisabled={continueDisabled}
                continueLabel={
                  continueDisabled ? 'Checking readiness' : 'Continue to passport'
                }
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
