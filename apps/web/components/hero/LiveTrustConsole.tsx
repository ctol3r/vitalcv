'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoleContext } from '@/components/auth/RoleContext';
import { ReadinessPreview } from '@/components/hero/ReadinessPreview';
import { TimeToStartCard } from '@/components/hero/TimeToStartCard';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { Button } from '@/components/ui/button';
import {
  getTrustStatusDescriptor,
  TrustStatusBadge,
} from '@/components/ui/trust-status-badge';
import { useIngestStream, type IngestStreamState } from '@/hooks/useIngestStream';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import {
  LIVE_PATH_NPI_RE,
  LIVE_PATH_PREVIEW_NOTICE,
  resolveLivePathAuthState,
  resolveLivePathSourceMode,
} from '@/lib/live-path/contracts';
import { trackUxEvent } from '@/lib/telemetry/ux-tracker';
import {
  buildPassportLookupHref,
  getPublicWedgeSurfaceBadgeMeta,
  resolvePublicWedgeSurfaceStateFromPreviewStageStatus,
} from '@/lib/trust/public-wedge-parity';
import {
  getStatusDisplayLabel,
  getTrustStatusLabel,
} from '@/lib/trust/status-language';
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

const FLOW_STEPS = [
  'Enter NPI',
  'Review readiness',
  'Open passport',
] as const;

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

function resolveFlowStepState(
  phase: Phase,
  stepIndex: number,
): 'complete' | 'active' | 'upcoming' {
  if (phase === 'idle') {
    return stepIndex === 0 ? 'active' : 'upcoming';
  }

  if (phase === 'loading') {
    if (stepIndex === 0) return 'complete';
    return stepIndex === 1 ? 'active' : 'upcoming';
  }

  if (stepIndex <= 1) return 'complete';
  return stepIndex === 2 ? 'active' : 'upcoming';
}

function flowStepClassName(state: 'complete' | 'active' | 'upcoming'): string {
  switch (state) {
    case 'complete':
      return 'border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] text-[var(--vt-text-muted)] shadow-[var(--vt-shadow-pill)]';
    case 'active':
      return 'border-[var(--vt-accent)]/12 bg-[var(--vt-badge-preview-bg)] text-[var(--vt-text-primary)] shadow-[var(--vt-shadow-pill)]';
    case 'upcoming':
    default:
      return 'border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]';
  }
}

function resolveLoadingCopy(streamState: IngestStreamState, isFallback: boolean): string {
  if (isFallback) {
    return LIVE_PATH_PREVIEW_NOTICE.partialCoverage;
  }

  if (streamState.phase === 'starting') {
    return 'Connecting to primary sources…';
  }

  if (streamState.phase === 'nppes' || streamState.phase === 'sanctions') {
    return 'Checking primary sources…';
  }

  if (streamState.phase === 'enrollment') {
    return 'Checking CMS PECOS…';
  }

  if (typeof streamState.readiness.score === 'number') {
    return 'Building your readiness snapshot…';
  }

  return 'Resolving readiness…';
}

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
  const loadingCopy = resolveLoadingCopy(state, isFallback);
  const checkedLabel = getTrustStatusLabel('checked');
  const pendingLabel = getTrustStatusLabel('pending');
  const accessRequiredLabel = getTrustStatusLabel('access_required');
  const unavailableLabel = getTrustStatusLabel('unavailable');
  const previewOnlyLabel = getStatusDisplayLabel('preview_only', 'Preview');
  const sourcesCheckedCount = stages.filter((stage) => stage.status === 'checked').length;
  const claimsCount = state.readiness.claimCount ?? state.readiness.credentialCount ?? null;
  const readinessSummary = typeof state.readiness.score === 'number'
    ? `${state.readiness.score}/100 · ${state.readiness.level ?? 'L0'}`
    : '—';
  const continueDisabled = !state.isUsable && !Boolean(state.completedAt) && state.phase !== 'error';
  const trimmedNpi = npi.trim();

  useEffect(() => {
    if (initialNpi && phase === 'idle' && npi !== initialNpi) {
      setNpi(initialNpi);
    }
  }, [initialNpi, npi, phase]);

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

    pageLoadTrackedRef.current = true;
  }, [authState, isLoaded]);

  useEffect(() => {
    if (phase === 'idle') return;
    if (!LIVE_PATH_NPI_RE.test(trimmedNpi)) return;
    if (state.startedAt) {
      writeLiveSnapshot(trimmedNpi, state);
    }
  }, [phase, state, trimmedNpi]);

  useEffect(() => {
    if (phase === 'loading' && hasLiveSignal && !previewIn) {
      setPreviewIn(true);
    }

    if (phase === 'loading' && (state.isUsable || Boolean(state.completedAt) || state.phase === 'error')) {
      setPhase('preview');
      setPreviewIn(true);
    }
  }, [hasLiveSignal, phase, previewIn, state.completedAt, state.isUsable, state.phase]);

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

    previewTrackedRef.current = true;
  }, [authState, isFallback, previewIn, sourceMode, trimmedNpi.length]);

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

    if (isValidNpi && typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('NPI_Submitted', { npi: nextNpi });
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
    setPhase('loading');
    setPreviewIn(false);
    setFallbackReason(null);
    previewTrackedRef.current = false;
    previewErrorTrackedRef.current = false;
    previewReadyTrackedRef.current = false;
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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 dark:opacity-0 transition-opacity duration-300"
        style={{
          background: [
            'radial-gradient(circle at top left, rgba(10,123,127,0.10), transparent 34%)',
            'radial-gradient(circle at 80% 14%, rgba(10,123,127,0.08), transparent 28%)',
            'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(244,246,245,0.96))',
          ].join(', '),
        }}
      />

      <div className={`relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6 ${phase === 'preview' ? 'pt-5 sm:pt-10 pb-6 sm:pb-10' : 'pt-12 sm:pt-20 pb-10 sm:pb-18'}`}>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          {FLOW_STEPS.map((step, index) => {
            const stepState = resolveFlowStepState(phase, index);

            return (
              <div
                key={step}
                className={`rounded-full border px-3 py-2 transition-colors ${flowStepClassName(stepState)}`}
              >
                <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-muted)] sm:block">
                  Step {index + 1}
                </p>
                <p className="text-xs font-medium text-[var(--vt-text-primary)] sm:mt-1">{step}</p>
              </div>
            );
          })}
        </div>

        {phase !== 'idle' && (
          <div
            className="animate-fade-in-up mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] px-4 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vt-text-muted)] shadow-[var(--vt-shadow-pill)]"
            aria-live="polite"
          >
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[var(--vt-accent)]" aria-hidden />
              System active
            </span>
            <span>Sources: {sourcesCheckedCount}/{stages.length} checked</span>
            <span>Claims: {claimsCount ?? '—'}</span>
            <span className="hidden sm:inline">Readiness: {readinessSummary}</span>
          </div>
        )}

        {phase !== 'preview' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="rounded-[32px] border border-[var(--vt-border-subtle)] bg-[var(--vt-surface-hero)] px-6 py-8 shadow-[var(--vt-shadow-soft)] sm:px-10 sm:py-10">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-accent)]">
                NPI first. Honest coverage.
              </p>
              <h1 className="mb-4 text-[clamp(2.8rem,6vw,5rem)] leading-[0.96] tracking-[-0.04em] text-[var(--vt-text-primary)] [font-family:var(--vt-font-display)]">
                Credentialing readiness,
                <span className="mt-2 block text-[var(--vt-accent)]">presented with proof.</span>
              </h1>
              <p className="mb-6 max-w-3xl text-sm leading-7 text-[var(--vt-text-muted)] sm:text-lg">
                VitalCV gives healthcare professionals a source-backed credentialing snapshot from NPPES, OIG / LEIE, CMS PECOS, and configured state board coverage in seconds, then labels each lane as {checkedLabel}, {pendingLabel}, {accessRequiredLabel}, {unavailableLabel}, or {previewOnlyLabel}.
              </p>
              <form id="npi-entry" onSubmit={handleSubmit} className="scroll-mt-24 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label htmlFor="npi-input" className="sr-only">Enter your 10-digit NPI number</label>
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
                  onChange={(e) => {
                    if (formMessage) {
                      setFormMessage(null);
                    }
                    setNpi(e.target.value.replace(/\D/g, ''));
                  }}
                  placeholder="Enter 10-digit NPI"
                  className={`h-14 min-w-0 flex-1 rounded-2xl border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 text-[16px] text-[var(--vt-text-primary)] placeholder:text-[var(--vt-text-muted)] shadow-none transition-[opacity,border-color,background-color,box-shadow] duration-150 focus-visible:border-[var(--vt-accent)]/40 focus-visible:bg-[var(--vt-surface)] focus-visible:ring-[var(--vt-focus-ring)] ${
                    phase === 'loading' ? 'cursor-default bg-[var(--vt-surface-subtle)] opacity-80' : ''
                  } ${
                    formMessage ? 'border-[var(--vt-badge-pending-text)]/40' : ''
                  }`}
                />
                <Button
                  type="submit"
                  variant="default"
                  disabled={phase === 'loading'}
                  className="h-14 w-full shrink-0 rounded-2xl bg-foreground px-5 text-sm font-semibold whitespace-nowrap text-background hover:bg-foreground/90 sm:w-auto"
                >
                  <span aria-live="polite">{phase === 'loading' ? loadingCopy : 'Check readiness'}</span>
                </Button>
              </form>

              {formMessage && (
                <p id="npi-error" role="alert" className="mt-3 text-xs leading-relaxed text-[var(--vt-severity-critical)]">
                  {formMessage}
                </p>
              )}

              <TimeToStartCard className="mt-5" />
            </div>
          </motion.div>
        ) : (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
                Readiness snapshot
              </p>
              <p className="mt-1 text-xs text-[var(--vt-text-muted)] sm:text-sm">
                Step 2 is visible. Step 3 carries this live state into the passport flow.
              </p>
            </div>
            {isFallback && (
              <TrustStatusBadge status="preview_only" label="Preview" size="sm" />
            )}
          </div>
        )}

        {phase !== 'idle' && (
          <div className="relative space-y-4 pt-5">
            <TrustStateCard
              aria-live="polite"
              title={phase === 'preview' ? 'Live system state' : loadingCopy}
              description={isFallback
                ? LIVE_PATH_PREVIEW_NOTICE[fallbackReason ?? 'partialCoverage']
                : 'Connected source lanes only flip complete when they actually return.'}
              className="animate-panel-enter rounded-[28px] border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] shadow-[var(--vt-shadow-card)]"
            >
              <div className="space-y-2">
                {stages.map((stage, index) => {
                  const badge = resolveStageBadge(stage.status);
                  const statusDescriptor = getTrustStatusDescriptor(badge.status, badge.label);

                  return (
                    <div
                      key={stage.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)] px-3 py-3"
                      style={{ animation: `vcv-stage-in 150ms ease-out ${index * 80}ms both` }}
                    >
                      <div className="flex items-start gap-2.5">
                        {stage.status === 'loading' ? (
                          <span className="size-3.5 rounded-full border border-[var(--vt-accent)]/35 border-t-transparent animate-spin" />
                        ) : (
                          <span className={`w-3 text-center font-mono text-sm leading-none ${STAGE_COLOR[stage.status]}`}>
                            {STAGE_SYMBOL[stage.status]}
                          </span>
                        )}
                        <div>
                          <span className={`text-xs transition-colors duration-150 ${
                            stage.status === 'loading'
                              ? 'text-[var(--vt-text-primary)]'
                              : stage.status === 'pending'
                                ? 'text-[var(--vt-text-muted)]'
                                : 'text-[var(--vt-text-primary)]'
                          }`}>
                            {stage.label}
                          </span>
                          <p className="mt-1 text-[10px] leading-relaxed text-[var(--vt-text-muted)]">
                            {statusDescriptor ? `${statusDescriptor} · ${stage.detail}` : stage.detail}
                          </p>
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
            </TrustStateCard>

            <div className={previewIn ? 'animate-fade-in-up' : ''}>
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
                continueLabel={continueDisabled ? 'Checking readiness' : 'Continue to passport'}
              />
            </div>
          </div>
        )}

        {phase === 'idle' && (
          <p className="mt-3 text-[11px] text-[var(--vt-text-muted)]">
            No signup required to preview. Other checks appear only when that source has actually run.
          </p>
        )}
      </div>
    </section>
  );
}
