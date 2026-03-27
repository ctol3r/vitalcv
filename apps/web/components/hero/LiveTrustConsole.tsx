'use client';

/**
 * LiveTrustConsole — Hero
 *
 * State machine:  idle → loading → preview → (Continue) → /interview?npi=
 *
 * loading:
 *   1. POST /api/identity/[npi]/ingest  — real NPPES + OIG/LEIE query
 *   2. GET  /api/trust-state/[npi]      — real readiness state from ingested claims
 *   Both are real backend calls. If the backend is unreachable, the component
 *   falls back to demo data and labels it clearly.
 *
 * preview:
 *   ReadinessPreview receives either:
 *     realState: ClinicianTrustState  (from trust-state endpoint)
 *     null                            (backend unavailable — demo fallback)
 *
 * Color rule: green is used ONLY on the CTA button.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useRoleContext } from '@/components/auth/RoleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getTrustStatusDescriptor,
  TrustStatusBadge,
} from '@/components/ui/trust-status-badge';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import {
  LIVE_PATH_NPI_RE,
  LIVE_PATH_PREVIEW_NOTICE,
  resolveLivePathAuthState,
  resolveLivePathSourceMode,
} from '@/lib/live-path/contracts';
import { trackUxEvent } from '@/lib/telemetry/ux-tracker';
import {
  getStatusDisplayLabel,
  getTrustStatusLabel,
} from '@/lib/trust/status-language';
import { ReadinessPreview, type ClinicianTrustState } from './ReadinessPreview';

type Phase = 'idle' | 'loading' | 'preview';

// ── Source stage display ──────────────────────────────────────

interface SourceStage {
  id: string;
  label: string;
  status: 'waiting' | 'loading' | 'ok' | 'skipped' | 'failed';
}

const INVALID_NPI_MESSAGE = 'Enter a valid 10-digit NPI to build a live or demo snapshot.';

const INITIAL_STAGES: SourceStage[] = [
  { id: 'NPPES_API', label: 'Primary identity (NPPES)', status: 'waiting' },
  { id: 'OIG_LEIE', label: 'Sanctions (OIG / LEIE)', status: 'waiting' },
  { id: 'READINESS', label: 'Readiness snapshot', status: 'waiting' },
];

// Map ingest result status → display status
function mapStatus(s: string | undefined): SourceStage['status'] {
  if (s === 'SUCCESS') return 'ok';
  if (s === 'SKIPPED') return 'skipped';
  if (s === 'FAILED')  return 'failed';
  return 'waiting';
}

const STAGE_SYMBOL: Record<SourceStage['status'], string> = {
  waiting: '·',
  loading: '◌',
  ok:      '✓',
  skipped: '–',
  failed:  '✗',
};

const STAGE_COLOR: Record<SourceStage['status'], string> = {
  waiting: 'text-white/20',
  loading: 'text-sky-200',
  ok:      'text-sky-200',
  skipped: 'text-amber-200',
  failed:  'text-rose-200',
};

function stageBadge(stage: SourceStage): {
  status: 'pending' | 'checked' | 'review_required' | 'unavailable';
  label: string;
} {
  switch (stage.status) {
    case 'loading':
      return { status: 'pending', label: 'Checking' };
    case 'ok':
      return { status: 'checked', label: 'Checked' };
    case 'failed':
      return { status: 'review_required', label: 'Needs review' };
    case 'skipped':
      return { status: 'unavailable', label: 'Unavailable' };
    case 'waiting':
    default:
      return { status: 'pending', label: 'Queued' };
  }
}

function setStageStatus(
  stages: SourceStage[],
  stageId: string,
  status: SourceStage['status'],
): SourceStage[] {
  return stages.map((stage) => (
    stage.id === stageId
      ? { ...stage, status }
      : stage
  ));
}

function setStageStatuses(
  stages: SourceStage[],
  updates: Partial<Record<SourceStage['id'], SourceStage['status']>>,
): SourceStage[] {
  return stages.map((stage) => (
    updates[stage.id]
      ? { ...stage, status: updates[stage.id] as SourceStage['status'] }
      : stage
  ));
}

function resolveLoadingCopy(stages: SourceStage[], isDemo: boolean): string {
  if (isDemo) return 'Preparing demo preview…';
  if (stages.find((stage) => stage.id === 'READINESS')?.status === 'loading') {
    return 'Building your snapshot…';
  }
  if (stages.some((stage) => stage.id !== 'READINESS' && stage.status === 'loading')) {
    return 'Checking primary sources…';
  }
  return 'Resolving readiness…';
}

const FLOW_STEPS = [
  'Enter NPI',
  'Review readiness',
  'Share intent',
] as const;

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
      return 'border-white/8 bg-white/[0.03] text-white/58';
    case 'active':
      return 'border-white/12 bg-white/[0.06] text-white/78';
    case 'upcoming':
    default:
      return 'border-white/6 bg-black/10 text-white/34';
  }
}

// ── Ingest response shape (subset) ───────────────────────────

interface IngestSourceResult {
  source:       string;
  status:       'SUCCESS' | 'SKIPPED' | 'FAILED';
  claimsEmitted: number;
  latencyMs:    number;
  error?:       string;
}

interface IngestResponse {
  npi:      string;
  results:  IngestSourceResult[];
  fallback?: boolean;       // set by our proxy when backend is down
  error?:   string;
}

// ── LiveTrustConsole ─────────────────────────────────────────

interface LiveTrustConsoleProps {
  /** Called when the readiness preview becomes visible — receives resolved NPI + display name */
  onPreviewReady?: (npi: string, displayName: string) => void;
}

export function LiveTrustConsole({ onPreviewReady }: LiveTrustConsoleProps = {}) {
  const [npi,       setNpi]       = useState('');
  const [phase,     setPhase]     = useState<Phase>('idle');
  const [stages,    setStages]    = useState<SourceStage[]>(INITIAL_STAGES);
  const [previewIn, setPreviewIn] = useState(false);
  const [realState, setRealState] = useState<ClinicianTrustState | null>(null);
  const [isDemo,    setIsDemo]    = useState(false);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [showLoadingPanel, setShowLoadingPanel] = useState(false);
  const [loadingPanelFading, setLoadingPanelFading] = useState(false);
  const { isLoaded, isSignedIn } = useRoleContext();
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pageLoadTrackedRef = useRef(false);
  const mountedRef = useRef(true);
  const activeSubmitIdRef = useRef(0);
  const previewTrackedSubmitIdRef = useRef<number | null>(null);
  const submitStartedAtRef = useRef<number | null>(null);

  const authState = resolveLivePathAuthState({ isLoaded, isSignedIn });
  const sourceMode = resolveLivePathSourceMode({
    isDemo,
    hasLiveState: Boolean(realState),
  });

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
    if (!previewIn) return;
    const submitId = activeSubmitIdRef.current;
    if (previewTrackedSubmitIdRef.current === submitId) return;

    trackUxEvent({
      event_name: UX_EVENTS.READINESS_REVEALED,
      component_id: 'homepage_npi_flow',
      duration_ms: submitStartedAtRef.current === null
        ? null
        : performance.now() - submitStartedAtRef.current,
      metadata: {
        auth_state: authState,
        interaction_result: sourceMode === 'live' ? 'success' : 'fallback',
        npi_length: npi.trim().length,
        source_mode: sourceMode,
      },
    });

    previewTrackedSubmitIdRef.current = submitId;
  }, [authState, npi, previewIn, sourceMode]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function isActiveSubmit(submitId: number): boolean {
    return mountedRef.current && activeSubmitIdRef.current === submitId;
  }

  function queueTimer(callback: () => void, delayMs: number) {
    timers.current.push(setTimeout(() => {
      if (!mountedRef.current) return;
      callback();
    }, delayMs));
  }

  function trackPreviewError(errorType: 'invalid_npi' | 'backend_unavailable' | 'partial_coverage') {
    trackUxEvent({
      event_name: 'preview_error',
      component_id: 'homepage_npi_flow',
      duration_ms: submitStartedAtRef.current === null
        ? null
        : performance.now() - submitStartedAtRef.current,
      metadata: {
        auth_state: authState,
        error_type: errorType,
        interaction_result: errorType === 'invalid_npi' ? 'cancel' : 'error',
        npi_length: npi.trim().length,
        source_mode: errorType === 'invalid_npi' ? 'live' : 'demo',
      },
    });
  }

  function resetPreviewState() {
    setStages(INITIAL_STAGES.map((stage) => ({ ...stage, status: 'waiting' })));
    setPreviewIn(false);
    setRealState(null);
    setIsDemo(false);
    setPreviewNotice(null);
    setFormMessage(null);
  }

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      activeSubmitIdRef.current += 1;
      clearTimers();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase !== 'idle') return;

    const trimmed = npi.trim();
    const isValidNpi = LIVE_PATH_NPI_RE.test(trimmed);

    trackUxEvent({
      event_name: UX_EVENTS.NPI_SUBMIT_ATTEMPT,
      component_id: 'homepage_npi_flow',
      metadata: {
        auth_state: authState,
        npi_length: trimmed.length,
        source_mode: 'live',
        validation_state: isValidNpi ? 'valid' : 'invalid',
      },
    });

    if (!isValidNpi) {
      setFormMessage(INVALID_NPI_MESSAGE);
      inputRef.current?.focus({ preventScroll: true });
      trackUxEvent({
        event_name: UX_EVENTS.NPI_INVALID,
        component_id: 'homepage_npi_flow',
        metadata: {
          auth_state: authState,
          interaction_result: 'cancel',
          npi_length: trimmed.length,
          source_mode: 'live',
        },
      });
      return;
    }

    const submitId = activeSubmitIdRef.current + 1;
    let previewName = 'Provider';
    let previewErrorType: 'backend_unavailable' | 'partial_coverage' | null = null;

    function recordPreviewError(errorType: 'backend_unavailable' | 'partial_coverage') {
      if (previewErrorType === null) {
        previewErrorType = errorType;
      }
    }

    activeSubmitIdRef.current = submitId;
    previewTrackedSubmitIdRef.current = null;
    submitStartedAtRef.current = performance.now();
    setFormMessage(null);

    setPhase('loading');
    resetPreviewState();
    trackUxEvent({
      event_name: UX_EVENTS.SOURCE_CHECK_STARTED,
      component_id: 'homepage_npi_flow',
      metadata: {
        auth_state: authState,
        npi_length: trimmed.length,
        source_mode: 'live',
      },
    });
    setShowLoadingPanel(true);
    setLoadingPanelFading(false);
    clearTimers();
    setNpi(trimmed);

    queueTimer(() => {
      if (!isActiveSubmit(submitId)) return;
      setStages(prev => setStageStatus(prev, 'NPPES_API', 'loading'));
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
    queueTimer(() => {
      if (!isActiveSubmit(submitId)) return;
      setStages(prev => setStageStatus(prev, 'OIG_LEIE', 'loading'));
    }, 140);

    // ── Step 1: Ingest (real sources) ────────────────────────
    let ingestOk = false;
    try {
      const ingestRes = await fetch(`/api/identity/${encodeURIComponent(trimmed)}/ingest`, {
        method: 'POST',
      });

      const ingestData = await ingestRes.json() as IngestResponse;
      if (!isActiveSubmit(submitId)) return;

      if (ingestData.fallback) {
        setStages(prev => setStageStatuses(prev, {
          NPPES_API: 'skipped',
          OIG_LEIE: 'skipped',
          READINESS: 'skipped',
        }));
        setIsDemo(true);
        setPreviewNotice(LIVE_PATH_PREVIEW_NOTICE.backendUnavailable);
        recordPreviewError('backend_unavailable');
      } else {
        const resultMap: Record<string, string> = {};
        (ingestData.results ?? []).forEach(r => { resultMap[r.source] = r.status; });

        setStages(prev => setStageStatuses(prev, {
          NPPES_API: mapStatus(resultMap.NPPES_API),
          OIG_LEIE: mapStatus(resultMap.OIG_LEIE),
        }));

        ingestOk = (ingestData.results ?? []).some(r => r.status === 'SUCCESS');
      }
    } catch {
      if (!isActiveSubmit(submitId)) return;
      setStages(prev => setStageStatuses(prev, {
        NPPES_API: 'skipped',
        OIG_LEIE: 'skipped',
        READINESS: 'skipped',
      }));
      setIsDemo(true);
      setPreviewNotice(LIVE_PATH_PREVIEW_NOTICE.backendUnavailable);
      recordPreviewError('backend_unavailable');
    }

    // ── Step 2: Fetch real trust state ───────────────────────
    if (ingestOk && LIVE_PATH_NPI_RE.test(trimmed)) {
      setStages(prev => setStageStatus(prev, 'READINESS', 'loading'));
      try {
        const tsRes  = await fetch(`/api/trust-state/${encodeURIComponent(trimmed)}`);
        const tsData = await tsRes.json() as ClinicianTrustState;
        if (!isActiveSubmit(submitId)) return;

        if (tsRes.ok && tsData.npi) {
          const identityFact = tsData.facts?.find(f => f.factType?.toLowerCase().includes('identity'));
          previewName = identityFact?.details ?? previewName;
          setRealState(tsData);
          setIsDemo(false);
          setPreviewNotice(null);
          setStages(prev => setStageStatus(prev, 'READINESS', 'ok'));
        } else {
          setIsDemo(true);
          setPreviewNotice(LIVE_PATH_PREVIEW_NOTICE.partialCoverage);
          setStages(prev => setStageStatus(prev, 'READINESS', 'failed'));
          recordPreviewError('partial_coverage');
        }
      } catch {
        if (!isActiveSubmit(submitId)) return;
        setIsDemo(true);
        setPreviewNotice(LIVE_PATH_PREVIEW_NOTICE.partialCoverage);
        setStages(prev => setStageStatus(prev, 'READINESS', 'failed'));
        recordPreviewError('partial_coverage');
      }
    } else if (!ingestOk) {
      setIsDemo(true);
      setPreviewNotice((prev) => prev ?? LIVE_PATH_PREVIEW_NOTICE.partialCoverage);
      setStages(prev => setStageStatus(prev, 'READINESS', 'skipped'));
      recordPreviewError('partial_coverage');
    }

    if (!isActiveSubmit(submitId)) return;

    if (previewErrorType) {
      trackPreviewError(previewErrorType);
    }

    // ── Step 3: Transition to preview ────────────────────────
    setPhase('preview');
    setLoadingPanelFading(true);
    queueTimer(() => {
      if (!isActiveSubmit(submitId)) return;
      setPreviewIn(true);
    }, 120);
    queueTimer(() => {
      if (!isActiveSubmit(submitId)) return;
      setShowLoadingPanel(false);
      onPreviewReady?.(trimmed, previewName);
    }, 180);
  }

  function handleContinue() {
    const trimmed = npi.trim();
    const dest = LIVE_PATH_NPI_RE.test(trimmed)
      ? `/interview?npi=${trimmed}`
      : '/passport';

    trackUxEvent({
      event_name: UX_EVENTS.SHARE_INTENT,
      component_id: 'homepage_npi_flow',
      metadata: {
        auth_state: authState,
        npi_length: trimmed.length,
        source_mode: sourceMode,
      },
    });

    router.push(dest);
  }

  const isPreviewPhase = phase === 'preview';
  const loadingCopy = resolveLoadingCopy(stages, isDemo);
  const checkedLabel = getTrustStatusLabel('checked');
  const pendingLabel = getTrustStatusLabel('pending');
  const accessRequiredLabel = getTrustStatusLabel('access_required');
  const unavailableLabel = getTrustStatusLabel('unavailable');
  const previewOnlyLabel = getStatusDisplayLabel('demo', 'Preview only');

  return (
    <section className="relative" style={{ background: '#080e1a' }}>
      {/* Radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 55% 40% at 50% 45%, rgba(16,185,129,0.05) 0%, transparent 70%)' }}
      />

      <div className={`relative z-10 mx-auto w-full max-w-xl px-4 sm:px-6 ${isPreviewPhase ? 'pt-5 sm:pt-10 pb-6 sm:pb-10' : 'pt-12 sm:pt-20 pb-10 sm:pb-18'}`}>
        <div className="mb-5 grid gap-2 sm:grid-cols-3">
          {FLOW_STEPS.map((step, index) => {
            const stepState = resolveFlowStepState(phase, index);

            return (
              <div
                key={step}
                className={`rounded-2xl border px-4 py-3 transition-colors ${flowStepClassName(stepState)}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">
                  Step {index + 1}
                </p>
                <p className="mt-1 text-xs font-medium">{step}</p>
              </div>
            );
          })}
        </div>

        {!isPreviewPhase ? (
          <>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
              NPI first. Honest coverage.
            </p>
            <h1 className="mb-3 text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-white">
              See your readiness snapshot in <span className="text-emerald-400">about 10 seconds.</span>
            </h1>
            <p className="mb-6 text-sm leading-relaxed text-white/50 sm:text-base">
              VitalCV starts with your NPI, then labels each lane as {checkedLabel}, {pendingLabel}, {accessRequiredLabel}, {unavailableLabel}, or {previewOnlyLabel} before you move forward.
            </p>
          </>
        ) : (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Readiness snapshot
              </p>
              <p className="mt-1 text-xs text-white/40 sm:text-sm">
                Step 2 is visible. Step 3 keeps this snapshot honest in interview mode.
              </p>
            </div>
            {isDemo && (
              <TrustStatusBadge status="demo" label="Preview only" size="sm" />
            )}
          </div>
        )}

        {!isPreviewPhase && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={npi}
              readOnly={phase === 'loading'}
              aria-busy={phase === 'loading'}
              aria-disabled={phase === 'loading'}
              onChange={(e) => {
                if (formMessage) {
                  setFormMessage(null);
                }
                setNpi(e.target.value.replace(/\D/g, ''));
              }}
              placeholder="Enter your 10-digit NPI"
              aria-label="NPI number"
              className={`h-14 flex-1 min-w-0 rounded-xl border-white/12 bg-white/5 px-4 text-[16px] text-white placeholder:text-white/30 shadow-none transition-[opacity,border-color,background-color] duration-150 focus-visible:border-emerald-500/40 focus-visible:bg-white/7 focus-visible:ring-white/10 ${
                phase === 'loading' ? 'cursor-default bg-white/6 opacity-80' : ''
              } ${
                formMessage ? 'border-amber-400/30' : ''
              }`}
            />
            <Button
              type="submit"
              variant="success"
              disabled={phase === 'loading'}
              className="h-14 w-full shrink-0 whitespace-nowrap rounded-xl px-5 text-sm font-semibold sm:w-auto"
            >
              <span aria-live="polite">{phase === 'loading' ? loadingCopy : 'Start with NPI lookup'}</span>
            </Button>
          </form>
        )}

        {!isPreviewPhase && formMessage && (
          <p className="mt-3 text-xs leading-relaxed text-amber-200/80">
            {formMessage}
          </p>
        )}

        {(showLoadingPanel || phase === 'preview') && (
          <div className={`relative ${showLoadingPanel ? 'min-h-[188px] sm:min-h-[206px]' : ''}`}>
            {showLoadingPanel && (
              <TrustStateCard
                aria-live="polite"
                title={loadingCopy}
                description={previewNotice ?? 'Connected sources only flip complete when they actually return.'}
                className={`absolute left-0 right-0 top-0 z-10 mt-5 transition-[opacity,transform] duration-150 ease-out ${
                  loadingPanelFading ? 'pointer-events-none opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
                }`}
              >
                <div className="space-y-2">
                  {stages.map((stage, index) => {
                    const badge = stageBadge(stage);
                    const statusDescriptor = getTrustStatusDescriptor(badge.status, badge.label);

                    return (
                      <div
                        key={stage.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-2.5"
                        style={{ animation: `vcv-stage-in 150ms ease-out ${index * 140}ms both` }}
                      >
                        <div className="flex items-start gap-2.5">
                          {stage.status === 'loading' ? (
                            <span className="h-3.5 w-3.5 rounded-full border border-sky-300/50 border-t-transparent animate-spin" />
                          ) : (
                            <span className={`w-3 text-center font-mono text-sm leading-none ${STAGE_COLOR[stage.status]}`}>
                              {STAGE_SYMBOL[stage.status]}
                            </span>
                          )}
                          <div>
                            <span className={`text-xs transition-colors duration-150 ${
                              stage.status === 'loading' ? 'text-white/72' : stage.status === 'waiting' ? 'text-white/25' : 'text-white/52'
                            }`}>
                              {stage.label}
                            </span>
                            {statusDescriptor ? (
                              <p className="mt-1 text-[10px] leading-relaxed text-white/24">
                                {statusDescriptor}
                              </p>
                            ) : null}
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
            )}

            {phase === 'preview' && (
              <div className="relative z-0">
                {previewNotice && isDemo && (
                  <p className="pt-3 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-200/80">
                    {previewNotice}
                  </p>
                )}
                <ReadinessPreview
                  npi={npi.trim()}
                  realState={realState}
                  isDemo={isDemo}
                  visible={previewIn}
                  onContinue={handleContinue}
                />
              </div>
            )}
          </div>
        )}

        {/* Footer hint — idle only */}
        {phase === 'idle' && (
          <p className="mt-3 text-[11px] text-white/25">
            No signup required to preview. Other checks appear only when that source has actually run.
          </p>
        )}

      </div>
    </section>
  );
}
