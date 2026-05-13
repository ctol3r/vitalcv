// TODO: brutalist refactor
'use client';

import { useRef } from 'react';
import { motion, useInView, type Variants } from 'framer-motion';
import { CalendarClock, CheckCircle2, FileDigit, Orbit } from 'lucide-react';

const CLAIM_FLOW = [
  {
    level: 'L0',
    label: 'Identity + NPI captured',
    status: 'Accepted',
    tone: 'var(--claim-l0)',
  },
  {
    level: 'L1',
    label: 'Primary source checks queued',
    status: 'Verifying',
    tone: 'var(--claim-l1)',
  },
  {
    level: 'L2',
    label: 'Sources cross-correlated',
    status: 'Correlated',
    tone: 'var(--claim-l2)',
  },
  {
    level: 'L3',
    label: 'Final trust artifact ready',
    // "Certified" removed: VitalCV produces source-verified artifacts, not regulatory certifications.
    status: 'Issuer-confirmed',
    tone: 'var(--claim-l3)',
  },
] as const;

const TIMELINE = [
  { label: 'Legacy PSV (90 days)', value: '90 days', width: 100, color: 'var(--claim-l0)' },
  { label: 'VitalCV Network (<2 days)', value: '< 2 days', width: 16, color: 'var(--trust-green)' },
] as const;

const AUDIT_HASH =
  '3f7d2a4f8f91b6d8cfb4e7c8d0b9a21f4e5a8d7c1f4a3b9a20c6d5f1e8b3a4c9d';

const gridVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, staggerChildren: 0.1 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65 } },
};

export function ProductBento() {
  const sectionRef = useRef<HTMLElement>(null);
  const sectionVisible = useInView(sectionRef, { once: true, amount: 0.25 });
  const score = 80;
  const ringRadius = 58;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative px-6 pb-24 pt-4"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.33em] text-[var(--trust-green)]">
            Product grid
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight font-fraunces text-[var(--warm-charcoal)]">
            Built for enterprise credential confidence
          </h2>
          <p className="mt-3 text-base text-[var(--warm-charcoal)]/70">
            A production-grade orchestration of readiness, progression, and auditable evidence.
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
          variants={gridVariants}
          initial="hidden"
          animate={sectionVisible ? 'visible' : 'hidden'}
        >
          {/* Card 1 */}
          <motion.div
            className="rounded-3xl border border-white/35 bg-card backdrop-blur-md p-6 shadow-[var(--glass-shadow)] transition-shadow"
            variants={cardVariants}
            whileHover={{ y: -4, boxShadow: 'var(--shadow-elevated)' }}
          >
            <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-[var(--warm-charcoal)]/75">
              <Orbit className="h-4 w-4 text-[var(--trust-green)]" />
              CRS Ring
            </div>
            <div className="relative mx-auto h-48 w-48">
              <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90 transform" role="img" aria-label="Credential Readiness Score">
                <circle
                  cx="80"
                  cy="80"
                  r={ringRadius}
                  stroke="var(--claim-l0)"
                  strokeWidth="10"
                  fill="none"
                  strokeOpacity="0.24"
                  strokeLinecap="round"
                />
                <motion.circle
                  cx="80"
                  cy="80"
                  r={ringRadius}
                  fill="none"
                  stroke="var(--trust-green)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringCircumference}
                  initial={{ strokeDashoffset: ringCircumference }}
                  animate={{
                    strokeDashoffset: sectionVisible ? ringCircumference - ringCircumference * (score / 100) : ringCircumference,
                  }}
                  transition={{ duration: 1.45, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-semibold text-[var(--trust-green)]">{score}%</span>
                <span className="text-xs uppercase tracking-[0.3em] text-[var(--warm-charcoal)]/65">Creds Readiness</span>
              </div>
            </div>
            <p className="mt-4 text-sm text-[var(--warm-charcoal)]/70">
              Readiness is weighted across source completeness, artifact integrity, and issuer confidence.
            </p>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            className="rounded-3xl border border-white/35 bg-card backdrop-blur-md p-6 shadow-[var(--glass-shadow)] transition-shadow"
            variants={cardVariants}
            whileHover={{ y: -4, boxShadow: 'var(--shadow-elevated)' }}
          >
            <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-[var(--warm-charcoal)]/75">
              <FileDigit className="h-4 w-4 text-[var(--trust-green)]" />
              L0-L3 Claim Progression
            </div>
            <ol className="space-y-3">
              {CLAIM_FLOW.map((stage, index) => (
                <li key={stage.level} className="relative">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--warm-charcoal)]/20 text-[11px] font-bold"
                      style={{ background: `${stage.tone}26`, color: stage.tone }}
                    >
                      {stage.level}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--warm-charcoal)]">{stage.label}</p>
                      <p className="text-xs text-[var(--warm-charcoal)]/60">{stage.status}</p>
                    </div>
                  </div>
                  {index !== CLAIM_FLOW.length - 1 ? (
                    <span
                      className="absolute left-3 top-8 h-4 w-px bg-gradient-to-b from-[var(--warm-charcoal)]/30 to-transparent"
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            className="rounded-3xl border border-white/35 bg-card backdrop-blur-md p-6 shadow-[var(--glass-shadow)] transition-shadow"
            variants={cardVariants}
            whileHover={{ y: -4, boxShadow: 'var(--shadow-elevated)' }}
          >
            <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-[var(--warm-charcoal)]/75">
              <CalendarClock className="h-4 w-4 text-[var(--trust-green)]" />
              Time-to-Start Comparison
            </div>
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--warm-charcoal)]/60">Horizontal bar comparison</p>

            <div className="mt-6 space-y-6">
              {TIMELINE.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--warm-charcoal)]/75">{item.label}</span>
                    <span className="font-semibold text-[var(--warm-charcoal)]">{item.value}</span>
                  </div>
                  <div className="h-3 rounded-full bg-[var(--warm-charcoal)]/10">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: item.color }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${item.width}%` }}
                      transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Card 4 */}
          <motion.div
            className="rounded-3xl border border-white/35 bg-card backdrop-blur-md p-6 shadow-[var(--glass-shadow)] transition-shadow"
            variants={cardVariants}
            whileHover={{ y: -4, boxShadow: 'var(--shadow-elevated)' }}
          >
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--warm-charcoal)]/75">
              <CheckCircle2 className="h-4 w-4 text-[var(--trust-green)]" />
              Audit Confidence
            </div>
            <div className="rounded-2xl border border-dashed border-[var(--warm-charcoal)]/18 bg-[var(--warm-charcoal)]/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--warm-charcoal)]/55">Artifact receipt</p>
              <p className="mt-3 text-sm text-[var(--warm-charcoal)]/70">Signed credential bundle (mock)</p>
              <pre className="mt-3 overflow-hidden rounded-lg bg-[var(--warm-charcoal)]/[0.04] p-3 text-[11px] leading-5 text-[var(--warm-charcoal)]">
                <code className="font-mono">SHA-256: {AUDIT_HASH}</code>
              </pre>
              <p className="mt-3 text-xs text-[var(--warm-charcoal)]/60">
                Mock artifact includes chain of custody, issuance timestamp, and verifier policy tags.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
