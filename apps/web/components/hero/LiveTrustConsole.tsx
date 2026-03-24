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
import {
  LIVE_PATH_NPI_RE,
  LIVE_PATH_PREVIEW_NOTICE,
  resolveLivePathAuthState,
  resolveLivePathSourceMode,
} from '@/lib/live-path/contracts';
import { trackUxEvent } from '@/lib/telemetry/ux-tracker';
import { ReadinessPreview, type ClinicianTrustState } from './ReadinessPreview';

type Phase = 'idle' | 'loading' | 'preview';

// ── Source stage display ──────────────────────────────────────

interface SourceStage {
  id: string;
  label: string;
  status: 'waiting' | 'loading' | 'ok' | 'skipped' | 'failed';
}

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
      event_name: 'preview_visible',
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

  function resetPreviewState() {
    setStages(INITIAL_STAGES.map((stage) => ({ ...stage, status: 'waiting' })));
    setPreviewIn(false);
    setRealState(null);
    setIsDemo(false);
    setPreviewNotice(null);
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
    const submitId = activeSubmitIdRef.current + 1;
    let previewName = 'Provider';

    activeSubmitIdRef.current = submitId;
    previewTrackedSubmitIdRef.current = null;
    submitStartedAtRef.current = performance.now();

    trackUxEvent({
      event_name: 'npi_submit',
      component_id: 'homepage_npi_flow',
      metadata: {
        auth_state: authState,
        npi_length: trimmed.length,
        source_mode: 'live',
      },
    });

    setPhase('loading');
    resetPreviewState();
    trackUxEvent({
      event_name: 'loader_started',
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
        }
      } catch {
        if (!isActiveSubmit(submitId)) return;
        setIsDemo(true);
        setPreviewNotice(LIVE_PATH_PREVIEW_NOTICE.partialCoverage);
        setStages(prev => setStageStatus(prev, 'READINESS', 'failed'));
      }
    } else if (!ingestOk) {
      setIsDemo(true);
      setPreviewNotice((prev) => prev ?? LIVE_PATH_PREVIEW_NOTICE.partialCoverage);
      setStages(prev => setStageStatus(prev, 'READINESS', 'skipped'));
    }

    if (!isActiveSubmit(submitId)) return;

    // ── Step 3: Transition to preview ────────────────────────
    setPhase('preview');
    setLoadingPanelFading(true);
    queueTimer(() => {
      if (!isActiveSubmit(submitId)) return;
      setPreviewIn(true);
    }, 70);
    queueTimer(() => {
      if (!isActiveSubmit(submitId)) return;
      setShowLoadingPanel(false);
      onPreviewReady?.(trimmed, previewName);
    }, 240);
  }

  function handleContinue() {
    const trimmed = npi.trim();
    const dest = LIVE_PATH_NPI_RE.test(trimmed)
      ? `/interview?npi=${trimmed}`
      : '/passport';
    router.push(dest);
  }

  const isPreviewPhase = phase === 'preview';
  const loadingCopy = resolveLoadingCopy(stages, isDemo);

  return (
    <section className="relative" style={{ background: '#080e1a' }}>
      {/* Radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 55% 40% at 50% 45%, rgba(16,185,129,0.05) 0%, transparent 70%)' }}
      />

      <div className={`relative z-10 mx-auto w-full max-w-xl px-4 sm:px-6 ${isPreviewPhase ? 'pt-5 sm:pt-10 pb-6 sm:pb-10' : 'pt-12 sm:pt-20 pb-10 sm:pb-18'}`}>

        {!isPreviewPhase ? (
          <>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
              NPI first. Honest coverage.
            </p>
            <h1 className="mb-3 text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-white">
              See your readiness snapshot in <span className="text-emerald-400">about 10 seconds.</span>
            </h1>
            <p className="mb-6 text-sm leading-relaxed text-white/50 sm:text-base">
              VitalCV resolves your public NPI identity first, runs connected sources, and clearly labels anything missing, blocked, or preview-only.
            </p>
          </>
        ) : (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Readiness snapshot
              </p>
              <p className="mt-1 text-xs text-white/40 sm:text-sm">
                Source-backed where available. Explicit when preview-only.
              </p>
            </div>
            {isDemo && (
              <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                Demo preview
              </span>
            )}
          </div>
        )}

        {!isPreviewPhase && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={npi}
              readOnly={phase === 'loading'}
              aria-busy={phase === 'loading'}
              aria-disabled={phase === 'loading'}
              onChange={e => setNpi(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter your 10-digit NPI"
              aria-label="NPI number"
              className={`flex-1 min-w-0 rounded-xl border border-white/12 bg-white/5 px-4 py-3.5 text-[16px] text-white placeholder:text-white/30 transition-[opacity,border-color,background-color] duration-150 focus:border-emerald-500/40 focus:bg-white/7 focus:outline-none ${
                phase === 'loading' ? 'cursor-default bg-white/6 opacity-80' : ''
              }`}
            />
            <button
              type="submit"
              disabled={phase === 'loading'}
              className="w-full shrink-0 whitespace-nowrap rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-5 py-3.5 text-sm font-semibold text-white transition-all hover:from-emerald-400 hover:to-emerald-500 active:scale-95 disabled:scale-100 disabled:from-emerald-700 disabled:to-emerald-800 sm:w-auto"
            >
              <span aria-live="polite">{phase === 'loading' ? loadingCopy : 'See readiness'}</span>
            </button>
          </form>
        )}

        {(showLoadingPanel || phase === 'preview') && (
          <div className={`relative ${showLoadingPanel ? 'min-h-[188px] sm:min-h-[206px]' : ''}`}>
            {showLoadingPanel && (
              <div
                aria-live="polite"
                className={`absolute left-0 right-0 top-0 z-10 mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 transition-[opacity,transform] duration-150 ease-out ${
                  loadingPanelFading ? 'pointer-events-none opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
                }`}
              >
                <p className="text-sm font-semibold text-white">{loadingCopy}</p>
                <p className="mt-1 text-xs text-white/35">
                  {previewNotice ?? 'Connected sources only flip complete when they actually return.'}
                </p>
                <div className="mt-4 space-y-2">
                  {stages.map((stage, index) => {
                    const statusLabel =
                      stage.status === 'loading'
                        ? 'In progress'
                        : stage.status === 'ok'
                          ? 'Complete'
                          : stage.status === 'skipped'
                            ? 'Unavailable'
                            : stage.status === 'failed'
                              ? 'Needs review'
                              : 'Queued';

                    return (
                      <div
                        key={stage.id}
                        className="flex items-center justify-between gap-3"
                        style={{ animation: `vcv-stage-in 150ms ease-out ${index * 140}ms both` }}
                      >
                        <div className="flex items-center gap-2.5">
                          {stage.status === 'loading' ? (
                            <span className="h-3.5 w-3.5 rounded-full border border-sky-300/50 border-t-transparent animate-spin" />
                          ) : (
                            <span className={`w-3 text-center font-mono text-sm leading-none ${STAGE_COLOR[stage.status]}`}>
                              {STAGE_SYMBOL[stage.status]}
                            </span>
                          )}
                          <span className={`text-xs transition-colors duration-150 ${
                            stage.status === 'loading' ? 'text-white/72' : stage.status === 'waiting' ? 'text-white/25' : 'text-white/52'
                          }`}>
                            {stage.label}
                          </span>
                        </div>
                        <span className={`text-[10px] font-medium uppercase tracking-[0.16em] ${
                          stage.status === 'loading' ? 'text-sky-200' : stage.status === 'ok' ? 'text-sky-200' : stage.status === 'failed' ? 'text-rose-200' : stage.status === 'skipped' ? 'text-amber-200' : 'text-white/25'
                        }`}>
                          {statusLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
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
