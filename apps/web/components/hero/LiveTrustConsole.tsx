'use client';

/**
 * LiveTrustConsole — Hero
 *
 * State machine: idle → loading → preview → (user clicks Continue) → redirect
 *
 * loading: sequential source checks appear (200ms stagger)
 * preview: ReadinessPreview fades in inline — user sees value before login
 * redirect: /get-ready?npi=... only fires on explicit CTA click
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ReadinessPreview } from './ReadinessPreview';

type Phase = 'idle' | 'loading' | 'preview';

const SOURCES = [
  { label: 'NPPES',   ms: 0   },
  { label: 'License', ms: 220 },
  { label: 'Board',   ms: 440 },
  { label: 'DEA',     ms: 660 },
];

const PREVIEW_DELAY_MS = 1300;

export function LiveTrustConsole() {
  const [npi, setNpi]         = useState('');
  const [phase, setPhase]     = useState<Phase>('idle');
  const [visible, setVisible] = useState<number>(-1); // last revealed source index
  const [previewIn, setPreviewIn] = useState(false);  // controls preview fade-in
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase !== 'idle') return;

    setPhase('loading');
    setVisible(-1);
    setPreviewIn(false);
    clearTimers();

    // Stagger source checks
    SOURCES.forEach((_, i) => {
      timers.current.push(setTimeout(() => setVisible(i), SOURCES[i].ms));
    });

    // Transition to preview after all checks
    timers.current.push(
      setTimeout(() => {
        setPhase('preview');
        // Tiny delay so the state renders first, then opacity transition fires
        setTimeout(() => setPreviewIn(true), 40);
      }, PREVIEW_DELAY_MS),
    );
  }

  function handleContinue() {
    const dest =
      /^\d{10}$/.test(npi.trim())
        ? `/get-ready?npi=${npi.trim()}`
        : '/get-ready';
    router.push(dest);
  }

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), []);

  return (
    <section
      className="relative"
      style={{ background: '#080e1a' }}
    >
      {/* Subtle radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 40% at 50% 45%, rgba(16,185,129,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-xl px-4 sm:px-6 pt-16 sm:pt-20 pb-14 sm:pb-18">

        {/* Headline */}
        <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-white mb-4">
          Get cleared to work
          <br />
          <span className="text-emerald-400">in hours, not months.</span>
        </h1>

        {/* Subline — hide once preview is showing */}
        {phase !== 'preview' && (
          <p className="text-sm sm:text-base text-white/50 mb-8 leading-relaxed">
            Your credentials verified once. Accepted everywhere.
          </p>
        )}

        {/* Form — stays visible during loading, collapses in preview */}
        {phase !== 'preview' && (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={npi}
              disabled={phase === 'loading'}
              onChange={e => { setNpi(e.target.value.replace(/\D/g, '')); }}
              placeholder="Enter your NPI number"
              aria-label="NPI number"
              className="flex-1 min-w-0 rounded-xl border border-white/12 bg-white/5 px-4 py-3.5 text-[16px] text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/40 focus:bg-white/7 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={phase === 'loading'}
              className="shrink-0 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-emerald-600 disabled:to-emerald-700 px-5 py-3.5 font-semibold text-white text-sm shadow-[0_0_28px_rgba(16,185,129,0.2)] transition-all active:scale-95 disabled:scale-100 whitespace-nowrap"
            >
              {phase === 'loading' ? 'Checking\u00a0sources\u2026' : 'Get Verified'}
            </button>
          </form>
        )}

        {/* Source check list — visible during loading only */}
        {phase === 'loading' && (
          <div
            aria-live="polite"
            className="mt-4 space-y-1.5"
          >
            {SOURCES.map((src, i) => (
              <div
                key={src.label}
                className="flex items-center gap-2 transition-opacity duration-300"
                style={{ opacity: visible >= i ? 1 : 0 }}
              >
                <span className="text-emerald-400 text-xs leading-none">✓</span>
                <span className="text-xs text-white/45">{src.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Preview card — visible after loading */}
        {phase === 'preview' && (
          <ReadinessPreview
            npi={npi}
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
