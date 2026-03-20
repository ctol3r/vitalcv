'use client';

/**
 * LiveTrustConsole — "Inevitable" Hero
 *
 * Single message. Single CTA. Real flow preview.
 * "Get cleared to work in hours, not months."
 */

import { motion } from 'framer-motion';
import { CheckCircle2, FileCheck, Server, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MagneticButton } from '../ui/MagneticButton';

/* ── Verification pipeline ──────────────────────────────────── */

const PIPELINE_STAGES = [
  { id: 'ingest', label: 'NPI lookup', source: 'via NPPES', icon: Server },
  { id: 'psv', label: 'Primary source', source: 'via State Medical Board', icon: Shield },
  { id: 'ledger', label: 'Audit ledger', source: 'SHA-256 anchored', icon: FileCheck },
  { id: 'clear', label: 'Cleared', source: 'PSV complete', icon: CheckCircle2 },
];

function VerificationPipeline() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % PIPELINE_STAGES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  const allCleared = activeStage === PIPELINE_STAGES.length - 1;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
          Live verification
        </span>
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
                  backgroundColor: isActive
                    ? 'rgba(52,211,153,0.85)'
                    : isPassed
                    ? 'rgba(52,211,153,0.25)'
                    : 'rgba(255,255,255,0.06)',
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ duration: 0.35 }}
                className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center"
              >
                <Icon className={`h-3.5 w-3.5 ${isActive || isPassed ? 'text-emerald-300' : 'text-white/45'}`} />
              </motion.div>
              <span className="text-[9px] font-medium text-white/50 uppercase tracking-wider text-center w-16 leading-tight">
                {stage.label}
              </span>
              {/* Source attribution */}
              <span className={`text-[8px] text-center w-20 leading-tight transition-opacity duration-300 ${isActive || isPassed ? 'text-emerald-400/60' : 'text-white/20'}`}>
                {stage.source}
              </span>
            </div>
          );
        })}
      </div>

      {/* Verification timestamp + confidence */}
      <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between">
        <span className="text-[10px] text-white/40">
          Last verified: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <motion.span
          animate={{ opacity: allCleared ? 1 : 0.4 }}
          className="text-[10px] font-medium text-emerald-400/70"
        >
          {allCleared ? '4 of 4 primary sources confirmed' : `${activeStage} of 4 sources confirmed`}
        </motion.span>
      </div>
    </div>
  );
}

/* ── LiveTrustConsole ─────────────────────────────────────────── */

export function LiveTrustConsole() {
  return (
    <section
      className="relative min-h-screen flex flex-col justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #080e1a 0%, #0b1220 50%, #07101e 100%)',
      }}
    >
      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 35%, rgba(16,185,129,0.07) 0%, transparent 65%)',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="grid gap-8 lg:gap-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">

          {/* Left — singular, authoritative message */}
          <motion.div
            className="space-y-7"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Headline — one message */}
            <h1 className="text-[clamp(2.6rem,5.5vw,5.2rem)] font-bold leading-[1.05] tracking-tight text-white">
              Get cleared to work
              <br />
              <span className="text-emerald-400">in hours, not months.</span>
            </h1>

            <p className="max-w-lg text-lg text-white/70 leading-relaxed">
              Your credentials verified once. Accepted everywhere.
            </p>

            {/* Single CTA */}
            <div className="pt-1">
              <MagneticButton className="w-full sm:w-auto">
                <Link href="/onboarding" className="glue-btn glue-btn-primary w-full sm:w-auto justify-center">
                  Get Verified Now
                  <Zap className="h-4 w-4" />
                </Link>
              </MagneticButton>
            </div>
          </motion.div>

          {/* Right — real flow preview + stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            {/* Verification pipeline — the product in motion */}
            <VerificationPipeline />

            {/* Stats — clean, data-minded */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: '< 24h', label: 'time to verified' },
                { value: '6.8M', label: 'US clinicians' },
                { value: '$9K/day', label: 'vacancy cost' },
              ].map(s => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/6 bg-white/3 p-3.5 text-center"
                >
                  <p className="text-base font-bold text-white leading-none">{s.value}</p>
                  <p className="text-[10px] text-white/55 uppercase tracking-wider mt-1.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Gradient fade */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #080e1a)' }}
      />
    </section>
  );
}
