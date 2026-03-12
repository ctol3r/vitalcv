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
  Globe,
  Lock,
  Rocket,
  Search,
  ShieldCheck,
  TrendingUp,
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
    <section className="relative px-6 py-24 overflow-hidden" style={{ background: '#060609' }}>
      {/* Subtle noise texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
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
    <section className="relative px-6 py-24" style={{ background: '#060609' }}>
      {/* Faint grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div className="relative mx-auto max-w-5xl">
        <FadeIn className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/8 px-4 py-1.5 mb-5">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-blue-400">
              How It Works
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            From NPI to verified in{' '}
            <span className="text-blue-400">days, not months.</span>
          </h2>
          <p className="mt-4 text-white/40 max-w-xl mx-auto text-lg leading-relaxed">
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
                  className={`group relative h-full rounded-2xl border bg-white/3 backdrop-blur-sm p-7 transition-all hover:bg-white/5 ${colors.border}`}
                >
                  {/* Connector arrow (not on last) */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 h-7 w-7 items-center justify-center rounded-full bg-zinc-900 border border-white/10">
                      <ArrowRight className="h-3.5 w-3.5 text-white/30" />
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-5">
                    <div className={`rounded-xl p-2.5 ${colors.bg}`}>
                      <Icon className={`h-5 w-5 ${colors.text}`} />
                    </div>
                    <span className={`text-4xl font-black opacity-10 ${colors.stepText}`}>
                      {s.step}
                    </span>
                  </div>

                  <h3 className="font-semibold text-white mb-2 text-base">{s.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed mb-4">{s.description}</p>

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

const TRACTION_STATS = [
  { value: '6.8M', label: 'licensed US healthcare workers — every one needs credentialing', color: 'text-emerald-600' },
  { value: '$9K', label: 'lost per day per unfilled physician slot', color: 'text-red-500' },
  { value: '< 24h', label: 'time-to-verified on VitalCV vs. 45–90 day industry average', color: 'text-infra-blue' },
  { value: '$4.2B', label: 'US healthcare credentialing market, growing 11% YoY', color: 'text-amber-500' },
] as const;

const BUILD_SIGNALS = [
  { icon: CheckCircle2, text: 'Live NPI verification via NPPES (250k+ provider database)' },
  { icon: CheckCircle2, text: 'Cryptographic SD-JWT credentials — W3C VC + OID4VCI compliant' },
  { icon: CheckCircle2, text: 'Two-sided marketplace: clinicians browse & apply, employers post & hire' },
  { icon: CheckCircle2, text: 'Apple/Google Wallet passes for portable credential sharing' },
  { icon: CheckCircle2, text: 'HIPAA-compliant audit ledger with continuous license monitoring' },
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
    <section className="relative px-6 py-24" style={{ background: '#060609' }}>
      <div className="mx-auto max-w-5xl">
        <FadeIn className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-4 py-1.5 mb-5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">
              The Opportunity
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            A massive, broken market.{' '}
            <span className="text-emerald-400">We have the fix.</span>
          </h2>
          <p className="mt-4 text-white/40 max-w-xl mx-auto text-lg leading-relaxed">
            Every hospital, clinic, and staffing agency re-verifies the same
            clinician from scratch — by fax, by hand, every time. VitalCV
            makes that process permanent, portable, and instant.
          </p>
        </FadeIn>

        {/* Market stats */}
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 mb-10">
          {TRACTION_STATS.map((m, i) => (
            <FadeIn key={m.label} delay={i * 0.1}>
              <div className="rounded-2xl border border-white/6 bg-white/3 p-5 text-center h-full">
                <div className={`text-2xl sm:text-3xl font-black mb-1.5 tracking-tight ${m.color}`}>
                  {m.value}
                </div>
                <div className="text-xs text-white/35 leading-relaxed">{m.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* What's built */}
        <FadeIn delay={0.25}>
          <div className="rounded-2xl border border-white/6 bg-white/3 p-6 mb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/25 mb-5">
              What&apos;s already built &amp; working
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {BUILD_SIGNALS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-2.5">
                  <Icon className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-white/50 leading-snug">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Compliance badges */}
        <FadeIn delay={0.3}>
          <div className="rounded-2xl border border-white/6 bg-white/3 p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/25 text-center mb-5">
              Compliance &amp; Standards
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {COMPLIANCE_BADGES.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-white/50">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.4} className="text-center mt-12">
          <p className="text-white/30 mb-5 text-sm">
            See the product working in real time.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-7 py-3.5 text-sm font-bold text-black transition-colors"
            >
              Live demo <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/employers"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 hover:border-white/20 px-7 py-3.5 text-sm font-semibold text-white/60 hover:text-white transition-all"
            >
              For employers
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   4. WHY NOW SECTION
───────────────────────────────────────────────────────────── */

const WHY_NOW_ITEMS = [
  {
    icon: Globe,
    title: 'TEFCA & ONC mandates are live',
    body: 'The 21st Century Cures Act and TEFCA (2024) require health systems to adopt interoperable digital credentialing. Compliance windows are closing — and paper workflows can\'t meet them.',
  },
  {
    icon: TrendingUp,
    title: 'Post-COVID staffing crisis',
    body: '1 in 5 hospitals reported critical physician shortages in 2024. Every week a credentialing committee delays a hire costs a system tens of thousands. Speed is now a patient safety issue.',
  },
  {
    icon: Rocket,
    title: 'The technology finally exists',
    body: 'SD-JWT, W3C Verifiable Credentials, and OpenID4VCI are ratified standards. NPI APIs are open. The infrastructure to do this right — portably, verifiably, permanently — is here today.',
  },
] as const;

export function WhyNowSection() {
  return (
    <section className="relative px-6 py-20 bg-zinc-900 overflow-hidden">
      {/* Subtle dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative mx-auto max-w-5xl">
        <FadeIn className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 mb-5">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400">
              Why Now
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Three forces are converging.{' '}
            <span className="text-amber-400">This is the window.</span>
          </h2>
          <p className="mt-4 text-zinc-400 max-w-xl mx-auto text-lg leading-relaxed">
            The stars haven't aligned for healthcare credentialing reform — they've collided.
            Regulatory mandates, a staffing emergency, and mature open standards
            make this the exact right moment to build VitalCV.
          </p>
        </FadeIn>

        <div className="grid gap-6 sm:grid-cols-3">
          {WHY_NOW_ITEMS.map(({ icon: Icon, title, body }, i) => (
            <FadeIn key={title} delay={i * 0.12}>
              <div className="rounded-2xl border border-zinc-700 bg-zinc-800/60 p-6 h-full">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                  <Icon className="h-5 w-5 text-amber-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
