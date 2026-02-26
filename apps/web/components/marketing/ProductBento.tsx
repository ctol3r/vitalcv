'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import CountUp from 'react-countup';

/* ── Box 1: CRS Ring ───────────────────────────────────────── */

function CrsRing() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const score = 80;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <svg ref={ref} width="140" height="140" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="var(--border)"
          strokeWidth="8"
        />
        <motion.circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="var(--trust-green)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={inView ? { strokeDashoffset: offset } : {}}
          transition={{ duration: 1.8, ease: 'easeOut' }}
          transform="rotate(-90 60 60)"
        />
        <text
          x="60"
          y="56"
          textAnchor="middle"
          className="fill-[var(--foreground)]"
          fontSize="28"
          fontWeight="600"
        >
          {inView ? <CountUp end={score} duration={1.8} /> : '0'}
        </text>
        <text
          x="60"
          y="74"
          textAnchor="middle"
          className="fill-[var(--muted-foreground)]"
          fontSize="11"
        >
          CRS
        </text>
      </svg>
      <p className="text-sm font-medium text-[var(--foreground)]">
        Credential Readiness Score
      </p>
    </div>
  );
}

/* ── Box 2: L1–L3 Timeline (Dark) ─────────────────────────── */

const CLAIM_LEVELS = [
  { level: 'L1', label: 'Identity Linked', color: 'var(--claim-l1, #6B9AC4)' },
  { level: 'L2', label: 'Evidence Uploaded', color: 'var(--claim-l2, #5BA3A3)' },
  { level: 'L3', label: 'PSV Attested', color: 'var(--claim-l3, var(--trust-green))' },
];

function ClaimTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <div
      ref={ref}
      className="flex flex-col justify-center h-full gap-5 bg-[var(--warm-charcoal)] rounded-2xl p-8"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">
        Claim Progression
      </p>
      {CLAIM_LEVELS.map((item, i) => (
        <motion.div
          key={item.level}
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: i * 0.3, duration: 0.5 }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: item.color }}
          >
            {item.level}
          </div>
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-sm text-white/80">{item.label}</span>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Box 3: Time-to-Start Comparison ──────────────────────── */

function TimeComparison() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <div ref={ref} className="flex flex-col justify-center h-full gap-6">
      <p className="text-sm font-semibold text-[var(--foreground)]">
        Time-to-Start Comparison
      </p>

      {/* Legacy */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-[var(--muted-foreground)]">Legacy PSV</span>
          <span className="font-semibold text-red-500">90 days</span>
        </div>
        <div className="h-3 rounded-full bg-[var(--border)] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-red-400"
            initial={{ width: '0%' }}
            animate={inView ? { width: '100%' } : {}}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* VitalCV */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-[var(--muted-foreground)]">VitalCV Network</span>
          <span className="font-semibold text-[var(--trust-green)]">&lt;2 days</span>
        </div>
        <div className="h-3 rounded-full bg-[var(--border)] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: 'var(--trust-green)' }}
            initial={{ width: '0%' }}
            animate={inView ? { width: '2.2%' } : {}}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Bento Grid ───────────────────────────────────────────── */

export default function ProductBento() {
  return (
    <section className="py-20 px-6">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--mist-blue)] mb-3">
          Product
        </p>
        <h2 className="font-fraunces text-3xl md:text-4xl font-semibold tracking-tight text-[var(--warm-charcoal)]">
          Trust, Visualized
        </h2>
      </div>
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border bg-[var(--card)] p-8 shadow-glass">
          <CrsRing />
        </div>
        <div className="rounded-2xl shadow-glass overflow-hidden">
          <ClaimTimeline />
        </div>
        <div className="rounded-2xl border bg-[var(--card)] p-8 shadow-glass">
          <TimeComparison />
        </div>
      </div>
    </section>
  );
}
