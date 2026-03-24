'use client';

/**
 * LiveTrustConsole — Hero
 *
 * State machine:  idle → loading → preview → (Continue) → /get-ready
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
import { ReadinessPreview, type ClinicianTrustState } from './ReadinessPreview';

type Phase = 'idle' | 'loading' | 'preview';

// ── Source stage display ──────────────────────────────────────

interface SourceStage {
  id:     string;
  label:  string;
  status: 'waiting' | 'ok' | 'skipped' | 'failed';
}

const INITIAL_STAGES: SourceStage[] = [
  { id: 'NPPES_API', label: 'NPPES Registry',  status: 'waiting' },
  { id: 'OIG_LEIE',  label: 'OIG / LEIE',      status: 'waiting' },
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
  ok:      '✓',
  skipped: '–',
  failed:  '✗',
};

const STAGE_COLOR: Record<SourceStage['status'], string> = {
  waiting: 'text-white/20',
  ok:      'text-sky-200',
  skipped: 'text-amber-200',
  failed:  'text-rose-200',
};

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
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [previewIn, setPreviewIn] = useState(false);
  const [realState, setRealState] = useState<ClinicianTrustState | null>(null);
  const [isDemo,    setIsDemo]    = useState(false);
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }
  useEffect(() => () => clearTimers(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase !== 'idle') return;

    const trimmed = npi.trim();
    let previewName = 'Provider';

    setPhase('loading');
    setStages(INITIAL_STAGES.map(s => ({ ...s, status: 'waiting' })));
    setActiveStageId(INITIAL_STAGES[0]?.id ?? null);
    setPreviewIn(false);
    setRealState(null);
    setIsDemo(false);
    clearTimers();
    INITIAL_STAGES.forEach((stage, index) => {
      timers.current.push(setTimeout(() => setActiveStageId(stage.id), index * 900));
    });

    // ── Step 1: Ingest (real sources) ────────────────────────
    let ingestOk = false;
    try {
      const ingestRes = await fetch(`/api/identity/${encodeURIComponent(trimmed)}/ingest`, {
        method: 'POST',
      });

      const ingestData = await ingestRes.json() as IngestResponse;

      if (ingestData.fallback) {
        // Backend down — mark all as skipped, use demo
        setStages(INITIAL_STAGES.map(s => ({ ...s, status: 'skipped' })));
        setIsDemo(true);
      } else {
        // Map real source results into stage display
        const resultMap: Record<string, string> = {};
        (ingestData.results ?? []).forEach(r => { resultMap[r.source] = r.status; });

        setStages(INITIAL_STAGES.map(s => ({
          ...s,
          status: mapStatus(resultMap[s.id]),
        })));

        ingestOk = (ingestData.results ?? []).some(r => r.status === 'SUCCESS');
      }
    } catch {
      setStages(INITIAL_STAGES.map(s => ({ ...s, status: 'skipped' })));
      setIsDemo(true);
    }
    setActiveStageId(null);

    // ── Step 2: Fetch real trust state ───────────────────────
    if (ingestOk && /^\d{10}$/.test(trimmed)) {
      try {
        const tsRes  = await fetch(`/api/trust-state/${encodeURIComponent(trimmed)}`);
        const tsData = await tsRes.json() as ClinicianTrustState;

        if (tsRes.ok && tsData.npi) {
          const identityFact = tsData.facts?.find(f => f.factType?.toLowerCase().includes('identity'));
          previewName = identityFact?.details ?? previewName;
          setRealState(tsData);
          setIsDemo(false);
        } else {
          setIsDemo(true);
        }
      } catch {
        setIsDemo(true);
      }
    } else if (!ingestOk) {
      setIsDemo(true);
    }

    // ── Step 3: Transition to preview ────────────────────────
    setPhase('preview');
    timers.current.push(setTimeout(() => setPreviewIn(true), 40));

    // Notify parent so it can prompt for account creation after the preview resolves
    if (onPreviewReady) {
      onPreviewReady(trimmed, previewName);
    }
  }

  function handleContinue() {
    const dest = /^\d{10}$/.test(npi.trim())
      ? `/get-ready?npi=${npi.trim()}`
      : '/get-ready';
    router.push(dest);
  }

  return (
    <section className="relative" style={{ background: '#080e1a' }}>
      {/* Radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 55% 40% at 50% 45%, rgba(16,185,129,0.05) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 mx-auto w-full max-w-xl px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-18">

        {phase !== 'preview' && (
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
            For clinicians ready to work faster
          </p>
        )}

        {/* Headline */}
        <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-white mb-3">
          See your verified readiness in <span className="text-emerald-400">10 seconds.</span>
        </h1>

        {/* Subline — hide in preview */}
        {phase !== 'preview' && (
          <p className="text-sm sm:text-base text-white/50 mb-6 leading-relaxed">
            VitalCV verifies your clinical credentials. Enter your NPI to see your readiness state in about 10 seconds.
          </p>
        )}

        {/* Form — visible during idle and loading */}
        {phase !== 'preview' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={npi}
              disabled={phase === 'loading'}
              onChange={e => setNpi(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter your 10-digit NPI"
              aria-label="NPI number"
              className="flex-1 min-w-0 rounded-xl border border-white/12 bg-white/5 px-4 py-3.5 text-[16px] text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/40 focus:bg-white/7 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={phase === 'loading'}
              className="w-full shrink-0 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-emerald-700 disabled:to-emerald-800 px-5 py-3.5 font-semibold text-white text-sm transition-all active:scale-95 disabled:scale-100 whitespace-nowrap sm:w-auto"
            >
              {phase === 'loading' ? 'Checking…' : 'See readiness'}
            </button>
          </form>
        )}

        {/* Source stages — visible during loading */}
        {phase === 'loading' && (
          <div aria-live="polite" className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <p className="text-sm font-semibold text-white">Verifying your credentials…</p>
            <p className="mt-1 text-xs text-white/35">Checking connected sources now.</p>
            <div className="mt-4 space-y-2">
              {stages.map(s => {
                const isActive = s.status === 'waiting' && s.id === activeStageId;
                const statusLabel = isActive
                  ? 'Checking now'
                  : s.status === 'ok'
                    ? 'Complete'
                    : s.status === 'skipped'
                      ? 'Unavailable'
                      : s.status === 'failed'
                        ? 'Needs review'
                        : null;

                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 transition-opacity duration-300">
                    <div className="flex items-center gap-2.5">
                      {isActive ? (
                        <span className="h-3.5 w-3.5 rounded-full border border-sky-300/50 border-t-transparent animate-spin" />
                      ) : (
                        <span className={`text-sm font-mono w-3 text-center leading-none ${STAGE_COLOR[s.status]}`}>
                          {STAGE_SYMBOL[s.status]}
                        </span>
                      )}
                      <span className={`text-xs transition-colors duration-200 ${
                        isActive ? 'text-white/70' : s.status === 'waiting' ? 'text-white/25' : 'text-white/50'
                      }`}>
                        {s.label}
                      </span>
                    </div>
                    {statusLabel && (
                      <span className={`text-[10px] font-medium uppercase tracking-[0.16em] ${
                        isActive ? 'text-sky-200' : s.status === 'ok' ? 'text-sky-200' : s.status === 'failed' ? 'text-rose-200' : 'text-white/25'
                      }`}>
                        {statusLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {isDemo && (
              <p className="pt-3 text-[10px] text-white/20">
                Backend unavailable — showing demo preview only
              </p>
            )}
          </div>
        )}

        {/* Preview — real data or labeled demo fallback */}
        {phase === 'preview' && (
          <ReadinessPreview
            npi={npi.trim()}
            realState={realState}
            isDemo={isDemo}
            visible={previewIn}
            onContinue={handleContinue}
          />
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
