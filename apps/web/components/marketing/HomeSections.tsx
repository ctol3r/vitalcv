'use client';

/**
 * HomeSections.tsx
 * Three narrative sections for the VitalCV homepage:
 *   1. ProblemSection  — the credentialing crisis, viscerally stated
 *   2. HowItWorksSection — 3-step solution walkthrough
 *   3. TractionSection — numbers, compliance, and credibility
 */

import { motion, useInView } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  FileX,
  Lock,
  Search,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';

/* ─────────────────────────────────────────────────────────────
   Shared helpers
───────────────────────────────────────────────────────────── */

function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   1. PROBLEM SECTION
───────────────────────────────────────────────────────────── */

const PAIN_STATS = [
  {
    icon: Clock,
    value: '45–90',
    unit: 'days',
    label: 'average credentialing cycle',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: DollarSign,
    value: '$9K',
    unit: '/ day',
    label: 'cost of an unfilled physician slot',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  {
    icon: FileX,
    value: '1 in 5',
    unit: '',
    label: 'applications contain errors that delay hire',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
] as const;

export function ProblemSection() {
  return (
    <section className="relative px-6 py-20 bg-zinc-950 overflow-hidden">
      {/* Subtle grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative mx-auto max-w-5xl">
        <FadeIn className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-900/60 bg-red-950/40 px-4 py-1.5 mb-5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-red-400">
              The Problem
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Healthcare credentialing is{' '}
            <span className="text-red-400">fundamentally broken.</span>
          </h2>
          <p className="mt-4 text-zinc-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Every hospital re-verifies the same clinician from scratch. Paper
            packets. Fax machines. Manual lookups. Committees that{' '}
            <em>think</em> they're verifying credentials — but are really just
            hoping the documents are real.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PAIN_STATS.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <FadeIn key={stat.label} delay={i * 0.12}>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm h-full">
                  <div className={`inline-flex rounded-xl p-2.5 mb-4 ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className={`text-4xl font-bold ${stat.color}`}>{stat.value}</span>
                    {stat.unit && (
                      <span className="text-lg font-medium text-zinc-500">{stat.unit}</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">{stat.label}</p>
                </div>
              </FadeIn>
            );
          })}
        </div>

        <FadeIn delay={0.4} className="mt-10 text-center">
          <p className="text-zinc-500 text-sm">
            The result: clinicians sit idle. Hospitals bleed money. Patients
            wait longer. And everyone repeats this process every 2 years.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   2. HOW IT WORKS
───────────────────────────────────────────────────────────── */

const STEPS = [
  {
    step: '01',
    icon: Search,
    title: 'Clinician submits NPI',
    description:
      'Clinician enters their NPI. VitalCV instantly queries NPPES, pulls verified demographics, and bootstraps their trust passport — zero forms, zero uploads.',
    accent: 'blue',
    detail: 'Takes ~3 seconds',
  },
  {
    step: '02',
    icon: ShieldCheck,
    title: 'Primary sources verified',
    description:
      'We query state medical boards, NPDB, DEA, OIG/LEIE, and board certification bodies directly. Every result is cryptographically signed and anchored to an immutable audit trail.',
    accent: 'emerald',
    detail: 'Direct API, no manual review',
  },
  {
    step: '03',
    icon: Zap,
    title: 'Employer receives trust passport',
    description:
      'The employer sees a real-time verified credential bundle — not a packet of PDFs. Continuous monitoring flags any status change the moment it happens.',
    accent: 'violet',
    detail: '3–6 weeks faster than traditional',
  },
] as const;

const STEP_ACCENT: Record<string, { border: string; text: string; bg: string; stepText: string }> = {
  blue: {
    border: 'border-blue-200 group-hover:border-blue-300',
    text: 'text-blue-600',
    bg: 'bg-blue-50',
    stepText: 'text-blue-300',
  },
  emerald: {
    border: 'border-emerald-200 group-hover:border-emerald-300',
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    stepText: 'text-emerald-300',
  },
  violet: {
    border: 'border-violet-200 group-hover:border-violet-300',
    text: 'text-violet-600',
    bg: 'bg-violet-50',
    stepText: 'text-violet-300',
  },
};

export function HowItWorksSection() {
  return (
    <section className="relative px-6 py-20 bg-white">
      <div className="mx-auto max-w-5xl">
        <FadeIn className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 mb-5">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-blue-600">
              How It Works
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 leading-tight">
            From NPI to verified in{' '}
            <span className="text-blue-600">days, not months.</span>
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-lg leading-relaxed">
            VitalCV replaces inferred trust — the "we hope this document is
            real" model — with cryptographically issued proof from authoritative
            sources.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const colors = STEP_ACCENT[s.accent];
            return (
              <FadeIn key={s.step} delay={i * 0.14} className="h-full">
                <div
                  className={`group relative h-full rounded-2xl border bg-white p-7 shadow-sm transition-all hover:shadow-md ${colors.border}`}
                >
                  {/* Connector arrow (not on last) */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 h-7 w-7 items-center justify-center rounded-full bg-white border border-zinc-200 shadow-sm">
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-5">
                    <div className={`rounded-xl p-2.5 ${colors.bg}`}>
                      <Icon className={`h-5 w-5 ${colors.text}`} />
                    </div>
                    <span className={`text-4xl font-black opacity-20 ${colors.stepText}`}>
                      {s.step}
                    </span>
                  </div>

                  <h3 className="font-semibold text-zinc-900 mb-2 text-base">{s.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed mb-4">{s.description}</p>

                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold ${colors.text}`}>
                    <CheckCircle2 className="h-3 w-3" />
                    {s.detail}
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   3. TRACTION / CREDIBILITY SECTION
───────────────────────────────────────────────────────────── */

const METRICS = [
  { value: '3–6 wks', label: 'faster time-to-start vs. industry average' },
  { value: '100%', label: 'primary source verified — no manual review' },
  { value: '24 / 7', label: 'continuous license monitoring per clinician' },
  { value: '<3 sec', label: 'NPI lookup to trust passport bootstrap' },
] as const;

const COMPLIANCE_BADGES = [
  'NCQA CR1–CR5',
  'HIPAA',
  'CMS CoP §482.12',
  'ONC 21st Century Cures',
  'SD-JWT VC',
  'OpenID4VCI',
] as const;

export function TractionSection() {
  return (
    <section className="relative px-6 py-20 bg-zinc-50 border-t border-zinc-100">
      <div className="mx-auto max-w-5xl">
        <FadeIn className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 mb-5">
            <Lock className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">
              Built to Last
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 leading-tight">
            Infrastructure-grade from{' '}
            <span className="text-emerald-600">day one.</span>
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-lg leading-relaxed">
            VitalCV is built on the same standards governments and health
            systems use — not workarounds. That matters when a clinician's
            career or a patient's safety is on the line.
          </p>
        </FadeIn>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 mb-12">
          {METRICS.map((m, i) => (
            <FadeIn key={m.label} delay={i * 0.1}>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
                <div className="text-2xl sm:text-3xl font-black text-zinc-900 mb-1.5 tracking-tight">
                  {m.value}
                </div>
                <div className="text-xs text-zinc-500 leading-relaxed">{m.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Compliance badges */}
        <FadeIn delay={0.3}>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-400 text-center mb-5">
              Compliance &amp; Standards
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {COMPLIANCE_BADGES.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-1.5"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-zinc-600">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.4} className="text-center mt-12">
          <p className="text-zinc-500 mb-5 text-sm">
            Ready to see it working?
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 px-7 py-3.5 text-sm font-semibold text-white transition-colors"
            >
              See the live demo <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/employers"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white px-7 py-3.5 text-sm font-semibold text-zinc-700 transition-colors"
            >
              For employers
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
