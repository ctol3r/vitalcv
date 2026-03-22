'use client';

/**
 * LiveTrustConsole — Hero
 *
 * Doctrine: headline visible immediately on load, no scroll required.
 * One message. One CTA. One micro-interaction (NPI preview).
 */

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, FileCheck, Server, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/* ── Verification pipeline ───────────────────────────────────── */

const PIPELINE_STAGES = [
  { id: 'ingest', label: 'NPI lookup',      source: 'via NPPES',             icon: Server       },
  { id: 'psv',    label: 'Primary source',  source: 'via State Medical Board', icon: Shield      },
  { id: 'ledger', label: 'Audit ledger',    source: 'SHA-256 anchored',       icon: FileCheck    },
  { id: 'clear',  label: 'Cleared',         source: 'PSV complete',           icon: CheckCircle2 },
];

function VerificationPipeline() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActiveStage(p => (p + 1) % PIPELINE_STAGES.length), 2400);
    return () => clearInterval(id);
  }, []);

  const allCleared = activeStage === PIPELINE_STAGES.length - 1;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">Live verification</span>
        <span className="flex h-1.5 w-1.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
        </span>
      </div>
      <div className="flex items-center justify-between relative px-1">
        <div className="absolute left-[6%] right-[6%] top-4 h-px bg-white/8 z-0" />
        {PIPELINE_STAGES.map((stage, i) => {
          const isActive = i === activeStage;
          const isPassed = i < activeStage;
          const Icon = stage.icon;
          return (
            <div key={stage.id} className="relative z-10 flex flex-col items-center gap-2">
              <motion.div
                animate={{
                  backgroundColor: isActive ? 'rgba(52,211,153,0.85)' : isPassed ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.06)',
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ duration: 0.35 }}
                className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center"
              >
                <Icon className={`h-3.5 w-3.5 ${isActive || isPassed ? 'text-emerald-300' : 'text-white/45'}`} />
              </motion.div>
              <span className="text-[9px] font-medium text-white/50 uppercase tracking-wider text-center w-16 leading-tight">{stage.label}</span>
              <span className={`text-[8px] text-center w-20 leading-tight transition-opacity duration-300 ${isActive || isPassed ? 'text-emerald-400/60' : 'text-white/20'}`}>{stage.source}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between">
        <span className="text-[10px] text-white/40">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <motion.span animate={{ opacity: allCleared ? 1 : 0.4 }} className="text-[10px] font-medium text-emerald-400/70">
          {allCleared ? '4 of 4 primary sources confirmed' : `${activeStage} of 4 sources confirmed`}
        </motion.span>
      </div>
    </div>
  );
}

/* ── NPI Preview micro-interaction ──────────────────────────── */

const NPI_RE = /^\d{10}$/;

// Demo readiness snapshots keyed by NPI or fallback
const DEMO_SNAPSHOTS: Record<string, { name: string; score: number; status: string; level: string }> = {
  '1234567890': { name: 'Dr. Sarah Chen',     score: 84, status: 'Interview Ready',    level: 'L3' },
  '9876543210': { name: 'Dr. Marcus Williams',score: 71, status: 'Partially Verified',  level: 'L2' },
  '1111111111': { name: 'Dr. Priya Nair',     score: 92, status: 'Fully Cleared',       level: 'L4' },
};
const FALLBACK = { name: 'Your Profile',      score: 78, status: 'Verification Ready',  level: 'L3' };

function NpiPreview() {
  const [npi, setNpi] = useState('');
  const [preview, setPreview] = useState<typeof FALLBACK | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handlePreview() {
    if (!npi.trim()) { inputRef.current?.focus(); return; }
    setLoading(true);
    setTimeout(() => {
      const snap = DEMO_SNAPSHOTS[npi.trim()] ?? FALLBACK;
      setPreview(snap);
      setLoading(false);
    }, 900);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handlePreview();
  }

  const scoreColor = (s: number) => s >= 85 ? 'text-emerald-400' : s >= 65 ? 'text-amber-400' : 'text-red-400';
  const barColor   = (s: number) => s >= 85 ? 'from-emerald-500 to-emerald-400' : s >= 65 ? 'from-amber-500 to-amber-400' : 'from-red-500 to-red-400';

  return (
    <div className="mt-5 sm:mt-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 mb-2">
        Preview your readiness — no login required
      </p>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={npi}
          onChange={e => { setNpi(e.target.value.replace(/\D/g, '')); setPreview(null); }}
          onKeyDown={handleKey}
          placeholder="Enter your NPI (10 digits)"
          className="flex-1 min-w-0 rounded-xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all"
        />
        <button
          type="button"
          onClick={handlePreview}
          disabled={loading}
          className="shrink-0 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
        >
          {loading ? '…' : 'Preview'}
        </button>
      </div>

      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-white/10 bg-white/4 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">{preview.name}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{NPI_RE.test(npi) ? `NPI ${npi}` : 'Demo Profile'}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${scoreColor(preview.score)}`}>{preview.score}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-wide">Readiness</p>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${preview.score}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className={`h-full rounded-full bg-gradient-to-r ${barColor(preview.score)}`}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">{preview.status}</span>
                <Link
                  href="/get-ready"
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Get your full profile →
                </Link>
              </div>
              <p className="mt-2 text-[9px] text-white/20">Demo preview — real data available after sign-up</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── LiveTrustConsole ─────────────────────────────────────────── */

export function LiveTrustConsole() {
  return (
    <section
      className="relative flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #080e1a 0%, #0b1220 50%, #07101e 100%)' }}
    >
      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 35%, rgba(16,185,129,0.07) 0%, transparent 65%)' }}
      />

      {/* Content — headline immediately visible, no justify-center dead space */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-24">
        <div className="grid gap-8 lg:gap-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">

          {/* Left — headline + CTA + NPI preview */}
          <motion.div
            className="space-y-5 sm:space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Verified credential infrastructure</span>
            </div>

            {/* Headline — first thing you see */}
            <h1 className="text-[clamp(2.4rem,5.5vw,5rem)] font-bold leading-[1.05] tracking-tight text-white">
              Get cleared to work
              <br />
              <span className="text-emerald-400">in hours, not months.</span>
            </h1>

            <p className="max-w-lg text-base sm:text-lg text-white/60 leading-relaxed">
              Your credentials verified once. Accepted everywhere.
            </p>

            {/* CTA — solid, high contrast, full-width on mobile */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Link
                href="/get-ready"
                className="flex items-center justify-center gap-2 min-h-[52px] rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-7 font-bold text-white text-sm shadow-[0_0_40px_rgba(16,185,129,0.25)] transition-all active:scale-[0.98]"
              >
                Get Verified Now
                <Zap className="h-4 w-4" />
              </Link>
              <Link
                href="/interview"
                className="flex items-center justify-center gap-2 min-h-[52px] rounded-2xl border border-white/15 hover:border-white/30 px-5 font-medium text-white/70 hover:text-white text-sm transition-all"
              >
                Interview Mode →
              </Link>
            </div>

            {/* NPI preview micro-interaction */}
            <NpiPreview />
          </motion.div>

          {/* Right — verification pipeline + stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4 lg:pt-2"
          >
            <VerificationPipeline />

            <div className="grid grid-cols-3 gap-3">
              {[
                { value: '< 24h',  label: 'time to verified' },
                { value: '1,200+', label: 'clinicians verified' },
                { value: '$9K/day', label: 'vacancy cost avoided' },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-white/6 bg-white/3 p-3.5 text-center">
                  <p className="text-base font-bold text-white leading-none">{s.value}</p>
                  <p className="text-[10px] text-white/55 uppercase tracking-wider mt-1.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Gradient fade to next section */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #080e1a)' }}
      />
    </section>
  );
}
