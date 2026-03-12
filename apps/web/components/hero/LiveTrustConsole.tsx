'use client';

/**
 * LiveTrustConsole — Wave 230 / Antigravity UI
 *
 * Full-void-black hero. Massive display type. Credential chips
 * floating in zero gravity. The antigravity.google aesthetic
 * applied to healthcare credentialing.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, FileCheck, Server, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FloatingCredentials } from '../motion/FloatingCredentials';
import { MagneticButton } from '../ui/MagneticButton';

/* ── Starfield ───────────────────────────────────────────────── */

function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Generate stars once
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.1 + 0.2,
      o: Math.random() * 0.5 + 0.1,
      twinkle: Math.random() * Math.PI * 2,
      speed: (Math.random() * 0.02 + 0.005),
    }));

    let raf = 0;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const t = Date.now() * 0.001;
      for (const s of stars) {
        const opacity = s.o * (0.6 + 0.4 * Math.sin(t * s.speed * 10 + s.twinkle));
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden
    />
  );
}

/* ── Verification pipeline ──────────────────────────────────── */

const PIPELINE_STAGES = [
  { id: 'ingest', label: 'Ingest NPI', icon: Server },
  { id: 'psv', label: 'Primary Source', icon: Shield },
  { id: 'ledger', label: 'Audit Ledger', icon: FileCheck },
  { id: 'clear', label: 'Cleared', icon: CheckCircle2 },
];

function VerificationPipeline() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % PIPELINE_STAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Live Verification Pipeline
        </span>
        <span className="flex h-1.5 w-1.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
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
                    ? 'rgba(52,211,153,0.9)'
                    : isPassed
                    ? 'rgba(52,211,153,0.3)'
                    : 'rgba(255,255,255,0.06)',
                  scale: isActive ? 1.15 : 1,
                }}
                transition={{ duration: 0.3 }}
                className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center"
              >
                <Icon className={`h-3.5 w-3.5 ${isActive || isPassed ? 'text-emerald-300' : 'text-white/20'}`} />
              </motion.div>
              <span className="text-[9px] font-medium text-white/25 uppercase tracking-wider text-center w-14">
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Typing headline ────────────────────────────────────────── */

const HEADLINES = [
  '24 hours.',
  'cryptographically.',
  'permanently.',
  'at scale.',
] as const;

function RotatingTagline() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % HEADLINES.length), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="h-[1.15em] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="block text-emerald-400"
        >
          {HEADLINES[idx]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/* ── LiveTrustConsole ─────────────────────────────────────────── */

export function LiveTrustConsole() {
  return (
    <section
      className="relative min-h-screen flex flex-col justify-center overflow-hidden"
      style={{ background: '#060609' }}
    >
      {/* Void — deep space background */}
      <Starfield />

      {/* Radial glow — emerald at center */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(16,185,129,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Floating credential chips */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <FloatingCredentials />
      </div>

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="grid gap-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">

          {/* Left — massive copy */}
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-400">
                Trust Infrastructure
              </span>
            </div>

            {/* Display headline */}
            <h1 className="text-[clamp(3rem,7vw,6.5rem)] font-black leading-[0.95] tracking-tight text-white">
              Clinician credentialing.
              <br />
              <RotatingTagline />
            </h1>

            <p className="max-w-lg text-lg text-white/50 leading-relaxed font-light">
              Automated primary source verification, anchored to a
              cryptographic ledger. Hospitals stop losing{' '}
              <span className="text-white/80 font-medium">$9,000 per day</span>{' '}
              to unfilled slots.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <MagneticButton>
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-7 py-3.5 text-sm font-bold text-black transition-colors"
                >
                  See it live
                  <Zap className="h-4 w-4" />
                </Link>
              </MagneticButton>
              <MagneticButton>
                <Link
                  href="/employers"
                  className="inline-flex items-center gap-2.5 rounded-2xl border border-white/12 hover:border-white/25 px-7 py-3.5 text-sm font-semibold text-white/70 hover:text-white transition-all"
                >
                  For Employers →
                </Link>
              </MagneticButton>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-6 pt-1">
              {['HIPAA', 'SOC 2', 'NCQA', 'OID4VCI'].map((badge) => (
                <span
                  key={badge}
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/20"
                >
                  <Shield className="h-2.5 w-2.5" />
                  {badge}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right — pipeline console */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            {/* Live stats strip */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: '< 24h', label: 'time to verified' },
                { value: '6.8M', label: 'US clinicians' },
                { value: '$4.2B', label: 'market size' },
                { value: '100%', label: 'primary source' },
              ].map(s => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/6 bg-white/3 p-4 text-center"
                >
                  <p className="text-xl font-black text-white">{s.value}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Pipeline */}
            <VerificationPipeline />

            {/* Credential confirmed card */}
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/60">
                  Trust Passport
                </span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </span>
              </div>
              <div className="space-y-2">
                {[
                  'Medical License · Active',
                  'Board Certification · Current',
                  'DEA Registration · Valid',
                  'NPDB · No Adverse Actions',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="text-xs text-white/50">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Bottom gradient fade to next section */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent, #060609)',
        }}
      />
    </section>
  );
}
