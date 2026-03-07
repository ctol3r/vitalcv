'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, FileCheck, Server, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DEMO_EDGES, DEMO_NODES, TrustGraphPrimary } from '../graph/TrustGraphPrimary';
import { ParticleNetwork } from '../motion/ParticleNetwork';
import { MagneticButton } from '../ui/MagneticButton';

/* ── Animated counter ─────────────────────────────────────── */

function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.floor(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return <span>{value.toLocaleString()}</span>;
}

/* ── Typing effect ────────────────────────────────────────── */

const BOOT_LINES = [
  '> Initializing VitalCV Trust Engine v4.2.1…',
  '  ✓ Cryptographic subsystem online',
  '  ✓ Primary source verification channels active',
  '  ✓ Knowledge graph loaded (1,247 authority nodes)',
  '  ✓ Trust daemon monitoring 3 active watchers',
  '> System OPERATIONAL — ready for credentialing',
] as const;

function BootSequence() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const delays = [0, 400, 800, 1200, 1700, 2200];
    const timers = delays.map((delay, i) =>
      setTimeout(() => setVisibleLines(i + 1), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="font-mono text-xs leading-relaxed space-y-0.5">
      <AnimatePresence>
        {BOOT_LINES.slice(0, visibleLines).map((line, i) => {
          const isCheck = line.includes('✓');
          const isOperational = line.includes('OPERATIONAL');
          return (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className={
                isOperational
                  ? 'text-infra-green font-semibold'
                  : isCheck
                    ? 'text-infra-blue-light'
                    : 'text-muted-foreground'
              }
            >
              {line}
            </motion.p>
          );
        })}
      </AnimatePresence>
      {visibleLines < BOOT_LINES.length && (
        <span className="inline-block h-3.5 w-1 animate-pulse bg-infra-blue" />
      )}
    </div>
  );
}

/* ── Pipeline Display ─────────────────────────────────────── */

const PIPELINE_STAGES = [
  { id: 'ingest', label: 'Ingestion', icon: Server },
  { id: 'psv', label: 'Verification', icon: Shield },
  { id: 'ledger', label: 'Audit Trail', icon: FileCheck },
  { id: 'clear', label: 'Cleared', icon: CheckCircle2 },
];

function VerificationPipeline() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % PIPELINE_STAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-xl border border-infra-border bg-white/80 backdrop-blur-sm p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Live Verification Pipeline
        </span>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-infra-blue opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-infra-blue"></span>
        </span>
      </div>

      <div className="flex items-center justify-between relative px-2">
        {/* Connection line */}
        <div className="absolute left-[8%] right-[8%] top-4 -translate-y-1/2 h-0.5 bg-infra-grid/50 z-0" />

        {PIPELINE_STAGES.map((stage, i) => {
          const isActive = i === activeStage;
          const isPassed = i < activeStage;
          const Icon = stage.icon;

          return (
            <div key={stage.id} className="relative z-10 flex flex-col items-center gap-2">
              <motion.div
                animate={{
                  backgroundColor: isActive ? 'var(--infra-blue)' : isPassed ? 'var(--infra-green)' : 'var(--infra-surface-alt)',
                  color: isActive || isPassed ? '#fff' : 'var(--muted-foreground)',
                  borderColor: isActive ? 'var(--infra-blue)' : isPassed ? 'var(--infra-green)' : 'var(--infra-border)',
                  scale: isActive ? 1.1 : 1,
                }}
                className="h-8 w-8 rounded-full border flex items-center justify-center shadow-sm"
              >
                <Icon className="h-4 w-4" />
              </motion.div>
              <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-center">
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── LiveTrustConsole Hero ───────────────────────────────────── */

export function LiveTrustConsole() {
  return (
    <section className="relative px-6 pt-24 pb-16 sm:pt-32 sm:pb-24">
      <ParticleNetwork />
      <div className="mx-auto max-w-7xl relative z-10">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          {/* Left: Copy */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-infra-border bg-infra-blue-muted px-4 py-1.5">
              <Shield className="h-3.5 w-3.5 text-infra-blue" />
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-infra-blue">
                Trust Infrastructure
              </span>
            </div>

            <h1 className="text-[clamp(2.2rem,4.5vw,4.2rem)] font-bold leading-[1.08] tracking-tight text-foreground font-heading">
              Credentialing infrastructure{' '}
              <span className="text-infra-blue">you can trust.</span>
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              VitalCV automates primary source verification, anchors it to a
              cryptographic ledger, and continuously monitors compliance — so
              clinicians start 3–6 weeks faster.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <MagneticButton>
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 rounded-xl bg-infra-blue px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-infra-blue focus:ring-offset-2"
                >
                  Try VitalCV
                  <Zap className="h-4 w-4" />
                </Link>
              </MagneticButton>
              <MagneticButton>
                <Link
                  href="/developers"
                  className="inline-flex items-center gap-2 rounded-xl border border-infra-border bg-white px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-infra-surface-alt"
                >
                  API Docs
                </Link>
              </MagneticButton>
            </div>

            {/* Compliance badges */}
            <div className="flex flex-wrap items-center gap-5 pt-2">
              {['SOC 2', 'HIPAA', 'NCQA', 'ES256'].map((badge) => (
                <span
                  key={badge}
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50"
                >
                  <Shield className="h-3 w-3" />
                  {badge}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right: Live Trust Console */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="space-y-4"
          >
            {/* Terminal */}
            <div className="rounded-2xl border border-infra-border bg-white/90 backdrop-blur-sm p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-infra-green" />
                <span className="h-2 w-2 rounded-full bg-infra-amber" />
                <span className="h-2 w-2 rounded-full bg-infra-red" />
                <span className="ml-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/40">
                  trust-engine
                </span>
              </div>
              <BootSequence />
            </div>

            {/* Pipeline Display */}
            <VerificationPipeline />

            {/* Mini Trust Graph Preview */}
            <div className="rounded-xl border border-infra-border bg-white/80 shadow-sm relative overflow-hidden h-[220px]">
               <div className="absolute top-3 left-3 z-10">
                 <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 bg-white/80 px-2 py-1 rounded backdrop-blur-sm">
                   Network Graph
                 </span>
               </div>
               <TrustGraphPrimary
                 nodes={DEMO_NODES.slice(0, 6)} // Fewer nodes for mini preview
                 edges={DEMO_EDGES.slice(0, 6)}
                 width={500}
                 height={240}
                 className="h-full border-none !shadow-none !bg-transparent"
               />
            </div>

          </motion.div>
        </div>
      </div>
    </section>
  );
}
