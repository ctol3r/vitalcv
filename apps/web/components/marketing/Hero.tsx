'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Shield, Terminal } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/* ── Simulated verification terminal ───────────────────────── */

// M1 — Sources shown here must match what is actually live.
// Live: NPPES (always), OIG/LEIE (always). Gated: Nursys (institutional access).
// NOT INTEGRATED: NPDB, DEA, ABMS. Do not add them back without live adapters.
const TERMINAL_LINES = [
  { text: '> Resolving NPI 1003000126…', delay: 0 },
  { text: '  ✓ NPPES identity confirmed', delay: 600 },
  { text: '> Querying OIG/LEIE exclusion registry…', delay: 1200 },
  { text: '  ✓ Not excluded', delay: 1800 },
  { text: '> Checking state board (Nursys)…', delay: 2400, gated: true },
  { text: '  ⚠ Institutional access required', delay: 3000, gated: true },
  { text: '> Signing credential bundle (ES256)…', delay: 3600 },
  { text: '  ✓ Bundle signed — ready to share', delay: 4200 },
  { text: '> Running ReadinessEvaluator…', delay: 4800 },
  { text: '  ✓ PARTIAL — 2 of 3 sources checked', delay: 5400 },
] as const;

function VerificationTerminal() {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    setVisibleLines(0);
    const timers: ReturnType<typeof setTimeout>[] = [];

    TERMINAL_LINES.forEach((line, i) => {
      timers.push(
        setTimeout(() => setVisibleLines(i + 1), line.delay),
      );
    });

    // Reset after full cycle
    timers.push(
      setTimeout(() => {
        setCycle((c) => c + 1);
      }, 9000),
    );

    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  return (
    <div className="relative rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 font-mono text-[13px] leading-relaxed">
      {/* Terminal chrome */}
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm bg-[var(--vt-text-muted)]" />
        <span className="h-2.5 w-2.5 rounded-sm bg-[var(--vt-text-muted)]" />
        <span className="h-2.5 w-2.5 rounded-sm bg-[var(--vt-text-muted)]" />
        <span className="ml-3 text-[10px] font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
          vitalcv trust-engine
        </span>
      </div>

      <div className="space-y-1 min-h-[280px]">
        <AnimatePresence mode="popLayout">
          {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => {
            const isSuccess = line.text.includes('✓');
            const isCleared = line.text.includes('CLEARED');
            return (
              <motion.p
                key={`${cycle}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className={
                  line.text.includes('PARTIAL')
                    ? 'text-[var(--vt-severity-high)] font-bold'
                    : 'gated' in line && line.gated
                      ? 'text-[var(--vt-severity-high)]/70'
                      : isSuccess
                        ? 'text-[var(--vt-status-resolved)]/90'
                        : 'text-[var(--vt-text-secondary)]'
                }
              >
                {line.text}
              </motion.p>
            );
          })}
        </AnimatePresence>

        {/* Blinking cursor */}
        {visibleLines < TERMINAL_LINES.length && (
          <span className="inline-block h-4 w-1.5 animate-pulse bg-[var(--vt-text-primary)]" />
        )}
      </div>
    </div>
  );
}

/* ── Hero ───────────────────────────────────────────────────── */

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-20 sm:pt-36 sm:pb-28">

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          {/* Left: Copy */}
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-1.5">
              <Shield className="h-3.5 w-3.5 text-[var(--vt-text-primary)]" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40">
                Source-Backed Credentialing
              </span>
            </div>

            <h1 className="text-[clamp(2.4rem,5vw,4.8rem)] font-bold leading-[1.05] tracking-tight text-[var(--vt-text-primary)]">
              Start clinicians{' '}
              <span className="text-[var(--vt-text-primary)]">
                faster.
              </span>
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-[var(--vt-text-secondary)]">
              VitalCV automates primary source verification and generates
              audit-ready credential packets — so you can start clinicians
              in days, not months.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/demo"
                className="group inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-text-primary)] px-7 py-3 text-sm font-semibold text-[var(--vt-bg)] transition hover:bg-[var(--vt-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--vt-border)] focus:ring-offset-2 focus:ring-offset-[var(--vt-bg)]"
              >
                Request a Demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/developers"
                className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-7 py-3 text-sm font-semibold text-[var(--vt-text-primary)] transition hover:bg-[var(--vt-surface-subtle)] hover:text-[var(--vt-text-primary)]"
              >
                <Terminal className="h-4 w-4" />
                API Docs
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-5 pt-4">
              {['HIPAA-aligned', 'W3C VC'].map((badge) => (
                <span
                  key={badge}
                  className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]"
                >
                  <Shield className="h-3 w-3" />
                  {badge}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right: Terminal */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15 }}
          >
            <VerificationTerminal />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
