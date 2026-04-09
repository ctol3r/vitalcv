'use client';

import { useSystemStatus } from '@/hooks/useSystemStatus';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Globe, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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

/* ── Stat card ────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  delay,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="flex items-center gap-3 rounded-xl border border-infra-border bg-card backdrop-blur-sm px-4 py-3 shadow-sm"
    >
      <div className={`rounded-lg p-2 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="heading-lg font-mono tabular-nums tracking-tight">
          <AnimatedCounter target={value} />
        </p>
      </div>
    </motion.div>
  );
}

/* ── SystemConsole Hero ───────────────────────────────────── */

export function SystemConsole() {
  const { data: status } = useSystemStatus(30_000);

  // Live metrics — fall back to seed values while loading
  const onlineNodes   = status?.artifactIntegrity.total    ?? 1247;
  const meanLatency   = status?.latency.average             ?? 12;
  const verificationsPerHr = status?.verificationHealth.last1h ?? 4821;
  const trustArtifacts     = status?.artifactIntegrity.verified ?? 28493;

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

            <p className="max-w-xl body-lg text-muted-foreground">
              VitalCV automates primary source verification, anchors it to a
              cryptographic audit trail, and continuously monitors compliance — so
              clinicians start faster. Data freshness varies by source (daily to quarterly).
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <MagneticButton>
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 rounded-xl bg-infra-blue px-6 py-3 text-sm font-semibold text-foreground transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-infra-blue focus:ring-offset-2"
                >
                  Try VitalCV
                  <Zap className="h-4 w-4" />
                </Link>
              </MagneticButton>
              <MagneticButton>
                <Link
                  href="/developers"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
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

          {/* Right: System console */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="space-y-4"
          >
            {/* Terminal */}
            <div className="rounded-2xl border border-border bg-card/90 backdrop-blur-sm p-5 shadow-sm">
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

            {/* Live stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={Globe}
                label="Online Nodes"
                value={onlineNodes}
                color="bg-infra-blue-muted text-infra-blue"
                delay={2.4}
              />
              <StatCard
                icon={Activity}
                label="Mean Latency (ms)"
                value={meanLatency}
                color="bg-infra-green-muted text-infra-green"
                delay={2.6}
              />
              <StatCard
                icon={Zap}
                label="Verifications / hr"
                value={verificationsPerHr}
                color="bg-infra-red-muted text-infra-amber"
                delay={2.8}
              />
              <StatCard
                icon={Activity}
                label="Trust Artifacts"
                value={trustArtifacts}
                color="bg-infra-blue-muted text-infra-violet"
                delay={3.0}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
