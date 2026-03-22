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
  ok:      'text-white/60',
  skipped: 'text-white/30',
  failed:  'text-white/30',
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

export function LiveTrustConsole() {
  const [npi,       setNpi]       = useState('');
  const [phase,     setPhase]     = useState<Phase>('idle');
  const [stages,    setStages]    = useState<SourceStage[]>(INITIAL_STAGES);
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

    setPhase('loading');
    setStages(INITIAL_STAGES.map(s => ({ ...s, status: 'waiting' })));
    setRealState(null);
    setIsDemo(false);
    clearTimers();

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

    // ── Step 2: Fetch real trust state ───────────────────────
    if (ingestOk && /^\d{10}$/.test(trimmed)) {
      try {
        const tsRes  = await fetch(`/api/trust-state/${encodeURIComponent(trimmed)}`);
        const tsData = await tsRes.json() as ClinicianTrustState;

        if (tsRes.ok && tsData.npi) {
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

      <div className="relative z-10 mx-auto w-full max-w-xl px-4 sm:px-6 pt-16 sm:pt-20 pb-14 sm:pb-18">

        {/* Headline */}
        <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-white mb-4">
          Get cleared to work
          <br />
          <span className="text-emerald-400">in hours, not months.</span>
        </h1>

        {/* Subline — hide in preview */}
        {phase !== 'preview' && (
          <p className="text-sm sm:text-base text-white/50 mb-8 leading-relaxed">
            Your credentials verified once. Accepted everywhere.
          </p>
        )}

        {/* Form — visible during idle and loading */}
        {phase !== 'preview' && (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={npi}
              disabled={phase === 'loading'}
              onChange={e => setNpi(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter your NPI number"
              aria-label="NPI number"
              className="flex-1 min-w-0 rounded-xl border border-white/12 bg-white/5 px-4 py-3.5 text-[16px] text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/40 focus:bg-white/7 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={phase === 'loading'}
              className="shrink-0 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-emerald-700 disabled:to-emerald-800 px-5 py-3.5 font-semibold text-white text-sm transition-all active:scale-95 disabled:scale-100 whitespace-nowrap"
            >
              {phase === 'loading' ? 'Checking…' : 'Get Verified'}
            </button>
          </form>
        )}

        {/* Source stages — visible during loading */}
        {phase === 'loading' && (
          <div aria-live="polite" className="mt-4 space-y-1.5">
            {stages.map(s => (
              <div key={s.id} className="flex items-center gap-2.5 transition-opacity duration-300">
                <span className={`text-sm font-mono w-3 text-center leading-none ${STAGE_COLOR[s.status]}`}>
                  {STAGE_SYMBOL[s.status]}
                </span>
                <span className={`text-xs transition-colors duration-200 ${
                  s.status === 'waiting' ? 'text-white/20' : 'text-white/45'
                }`}>
                  {s.label}
                </span>
                {s.status === 'waiting' && (
                  <span className="text-[10px] text-white/15 animate-pulse">querying…</span>
                )}
              </div>
            ))}
            {isDemo && (
              <p className="text-[10px] text-white/20 pt-1">
                Backend unavailable — showing demo preview
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
            No login required to preview · Under 24 hours
          </p>
        )}

      </div>
    </section>
  );
}
