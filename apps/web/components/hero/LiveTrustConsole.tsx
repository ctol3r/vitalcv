'use client';

/**
 * LiveTrustConsole — Wave 231 / Medical-Grade Antigravity
 *
 * Design language: Apple Health × Stripe × prestigious medical journal.
 * Deep navy authority. Human copy. Clean credential cards.
 * Modern and unconventional — but trustworthy, not techy.
 */

import { motion } from 'framer-motion';
import { CheckCircle2, FileCheck, Server, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FloatingCredentials } from '../motion/FloatingCredentials';
import { MagneticButton } from '../ui/MagneticButton';

/* ── Verification pipeline ──────────────────────────────────── */

const PIPELINE_STAGES = [
  { id: 'ingest', label: 'NPI lookup', icon: Server },
  { id: 'psv', label: 'Primary source', icon: Shield },
  { id: 'ledger', label: 'Audit ledger', icon: FileCheck },
  { id: 'clear', label: 'Cleared', icon: CheckCircle2 },
];

function VerificationPipeline() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % PIPELINE_STAGES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
          Verification running
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
                <Icon className={`h-3.5 w-3.5 ${isActive || isPassed ? 'text-emerald-300' : 'text-white/20'}`} />
              </motion.div>
              <span className="text-[9px] font-medium text-white/25 uppercase tracking-wider text-center w-16 leading-tight">
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Trust Passport card ─────────────────────────────────────── */

const CREDENTIAL_ITEMS = [
  { label: 'Medical License', detail: 'California · Active through 2026', status: 'verified' },
  { label: 'Board Certification', detail: 'ABIM · Internal Medicine', status: 'verified' },
  { label: 'DEA Registration', detail: 'Schedules II – V · Current', status: 'verified' },
  { label: 'NPDB / OIG', detail: 'No adverse actions on file', status: 'clear' },
];

function TrustPassportCard() {
  return (
    <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-b from-emerald-500/8 to-transparent p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">
            Trust Passport
          </p>
          <p className="text-xs text-white/30 mt-0.5">Dr. Sarah Chen · NPI 1003000126</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          <span className="text-[10px] font-semibold text-emerald-400">Verified</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {CREDENTIAL_ITEMS.map(item => (
          <div key={item.label} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-white/70">{item.label}</p>
              <p className="text-[10px] text-white/30 mt-0.5">{item.detail}</p>
            </div>
            <div className={`flex-shrink-0 h-1.5 w-1.5 rounded-full mt-1.5 ${item.status === 'verified' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
          </div>
        ))}
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
      {/* Precision grid — medical instrument feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #a0c4ff 1px, transparent 1px), linear-gradient(to bottom, #a0c4ff 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      {/* Radial glow — deep teal, like a hospital monitor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 35%, rgba(16,185,129,0.07) 0%, transparent 65%)',
        }}
      />

      {/* Floating credential chips — subtle, on larger screens only */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <FloatingCredentials />
      </div>

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="grid gap-8 lg:gap-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">

          {/* Left — clear, authoritative copy */}
          <motion.div
            className="space-y-7"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Eyebrow — Glue pill */}
            <div className="glue-pill" style={{ borderColor: 'rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.08)', color: '#34d399' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              Clinician Credentialing
            </div>

            {/* Headline — human, outcome-first, no jargon */}
            <h1 className="text-[clamp(2.6rem,5.5vw,5.2rem)] font-bold leading-[1.05] tracking-tight text-white">
              Your credentials.
              <br />
              <span className="text-emerald-400">Verified once.</span>
              <br />
              <span className="text-white/60">Trusted everywhere.</span>
            </h1>

            <p className="max-w-lg text-lg text-white/45 leading-relaxed">
              Stop re-credentialing at every new hospital. VitalCV verifies
              your license, board certification, DEA, and NPDB status — then
              carries that proof wherever your career takes you.
            </p>

            {/* CTAs — Google Glue pill buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-1">
              <MagneticButton className="w-full sm:w-auto">
                <Link href="/demo" className="glue-btn glue-btn-primary w-full justify-center">
                  See how it works
                  <Zap className="h-4 w-4" />
                </Link>
              </MagneticButton>
              <MagneticButton className="w-full sm:w-auto">
                <Link href="/get-ready" className="glue-btn glue-btn-secondary w-full justify-center">
                  Check my readiness →
                </Link>
              </MagneticButton>
            </div>

            {/* Social proof strip — understated */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/6 pt-5">
              <span className="text-xs text-white/25">Designed for:</span>
              {['Physicians', 'Nurse Practitioners', 'Physician Assistants', 'CRNAs', 'Locums'].map(t => (
                <span key={t} className="text-xs text-white/35 font-medium">{t}</span>
              ))}
            </div>
          </motion.div>

          {/* Right — trust passport + pipeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            {/* Trust Passport — the product in one card */}
            <TrustPassportCard />

            {/* Verification pipeline */}
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
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1.5 leading-tight">{s.label}</p>
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
