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
import SystemCapacityBadge from '@/components/capacity/SystemCapacityBadge';

/* ─────────────────────────────────────────────────────────────
   Shared helpers
───────────────────────────────────────────────────────────── */

function FadeIn({
  children,
  delay = 0,
  className = '',
  immediate = false,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  immediate?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const shouldShow = immediate || inView;
  return (
    <motion.div
      ref={ref}
      initial={immediate ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      animate={shouldShow ? { opacity: 1, y: 0 } : {}}
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
    <section className="relative px-6 py-24 overflow-hidden" style={{ background: '#080e1a' }}>
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
          <div className="glue-pill mb-5" style={{borderColor:"rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.08)",color:"#f87171"}}>
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-red-400">
              The Problem
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Every hospital reverifies you{' '}
            <span className="text-red-400">from scratch. Every time.</span>
          </h2>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg leading-relaxed">
            You've already proven your credentials. But every new hospital,
            staffing agency, and locums contract makes you do it again — paper
            packets, fax machines, weeks of waiting. Your career shouldn't
            depend on a committee hoping your documents are real.
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
    title: 'Enter your NPI',
    description: 'Your 10-digit NPI resolves your public identity record from NPPES. No forms, no uploads.',
    accent: 'blue',
    detail: 'NPI-first entry point',
  },
  {
    step: '02',
    icon: ShieldCheck,
    title: 'Primary sources run on your NPI',
    // M1: List only live/configured sources. NPDB and DEA are not integrated.
    description: 'We run NPPES identity and OIG exclusion first. PECOS and state board coverage appear only when those sources are actually available.',
    accent: 'emerald',
    detail: 'Real sources, not document copies',
  },
  {
    step: '03',
    icon: Zap,
    title: 'Portable across employers',
    // M1: Remove "instantly — no committee, no 90-day wait" — conditional on source coverage
    description: 'Your readiness snapshot travels with you. Connected checks stay source-backed, and missing coverage stays visibly pending.',
    accent: 'violet',
    detail: 'Fewer repeated verifications',
  },
] as const;

const STEP_ACCENT: Record<string, { border: string; text: string; bg: string; stepText: string }> = {
  blue: {
    border: 'border-blue-500/20 group-hover:border-blue-500/40',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    stepText: 'text-blue-500',
  },
  emerald: {
    border: 'border-emerald-500/20 group-hover:border-emerald-500/40',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    stepText: 'text-emerald-500',
  },
  violet: {
    border: 'border-violet-500/20 group-hover:border-violet-500/40',
    text: 'text-violet-400',
    bg: 'bg-violet-500/10',
    stepText: 'text-violet-500',
  },
};

export function HowItWorksSection() {
  return (
    <section className="relative px-6 py-24" style={{ background: '#080e1a' }}>
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
        <FadeIn className="text-center mb-14" immediate>
          <div className="glue-pill mb-5" style={{borderColor:"rgba(59,130,246,0.2)",background:"rgba(59,130,246,0.08)",color:"#60a5fa"}}>
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-blue-400">
              How It Works
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Start with one NPI.{' '}
            <span className="text-blue-400">See source-backed readiness.</span>
          </h2>
          <p className="mt-4 text-white/60 max-w-xl mx-auto text-lg leading-relaxed">
            Primary sources first. Signed proof where coverage exists. Explicit gaps where it does not.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const colors = STEP_ACCENT[s.accent];
            return (
              <FadeIn key={s.step} delay={i * 0.14} className="h-full" immediate>
                <div
                  className={`group relative h-full rounded-2xl border bg-white/3 backdrop-blur-sm p-7 transition-all hover:bg-white/5 ${colors.border}`}
                >
                  {/* Connector arrow (not on last) */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 h-7 w-7 items-center justify-center rounded-full bg-zinc-900 border border-white/10">
                      <ArrowRight className="h-3.5 w-3.5 text-white/55" />
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
                  <p className="text-sm text-white/60 leading-relaxed mb-4">{s.description}</p>

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
  { value: '~10s', label: 'to first readiness snapshot from NPI (NPPES + OIG/LEIE + PECOS)', color: 'text-infra-blue' },
  { value: '$4.2B', label: 'US healthcare credentialing market, growing 11% YoY', color: 'text-amber-500' },
] as const;

const BUILD_SIGNALS = [
  { icon: CheckCircle2, text: 'Live NPI verification via NPPES (7M+ provider registry)' },
  { icon: CheckCircle2, text: 'Cryptographic SD-JWT credentials — W3C VC + OID4VCI compliant' },
  { icon: CheckCircle2, text: 'Clinician identity graph: NPI → readiness → portable trust packet' },
  { icon: CheckCircle2, text: 'Employer acceptance flow — review and accept verified packets' },
  { icon: CheckCircle2, text: 'HIPAA-compliant audit ledger with continuous license monitoring' },
] as const;

const COMPLIANCE_BADGES = [
  'HIPAA-aligned',
  'ONC 21st Century Cures',
  'SD-JWT VC (W3C)',
  'OpenID4VCI',
  'CMS NPPES + OIG/LEIE',
  'PECOS enrollment',
] as const;

export function TractionSection() {
  return (
    <section className="relative px-6 py-24" style={{ background: '#080e1a' }}>
      <div className="mx-auto max-w-5xl">
        <FadeIn className="text-center mb-14">
          <div className="glue-pill mb-5" style={{borderColor:"rgba(16,185,129,0.2)",background:"rgba(16,185,129,0.08)",color:"#34d399"}}>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">
              The Opportunity
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            A massive, broken market.{' '}
            <span className="text-emerald-400">We have the fix.</span>
          </h2>
          <p className="mt-4 text-white/60 max-w-xl mx-auto text-lg leading-relaxed">
            Every hospital, clinic, and staffing agency re-verifies the same
            clinician from scratch — by fax, by hand, every time. VitalCV
            makes that process auditable, portable, and interoperable.
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
                <div className="text-xs text-white/60 leading-relaxed">{m.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Wave 240: Live system capacity badge */}
        <SystemCapacityBadge />

        {/* What's built */}
        <FadeIn delay={0.25}>
          <div className="rounded-2xl border border-white/6 bg-white/3 p-6 mb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/50 mb-5">
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
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/50 text-center mb-5">
              Standards &amp; Sources
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {COMPLIANCE_BADGES.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white/30 flex-shrink-0" />
                  <span className="text-xs font-semibold text-white/50">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.4} className="text-center mt-12">
          <p className="glue-body text-sm mb-5">
            See the product working in real time.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/onboarding" className="glue-btn glue-btn-primary">
              Preview my fit <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/employers" className="glue-btn glue-btn-secondary">
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
    body: 'SD-JWT, W3C Verifiable Credentials, and OpenID4VCI are ratified standards. NPI APIs are open. The infrastructure to do this right — portably, verifiably, with source-backed freshness windows — is here today.',
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
          <div className="glue-pill mb-5" style={{borderColor:"rgba(245,158,11,0.3)",background:"rgba(245,158,11,0.08)",color:"#fbbf24"}}>
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

/* ─────────────────────────────────────────────────────────────
   5. MONEYBALL THESIS — The founding scientific hypothesis
   "It's not a talent problem. It's a speed problem."
───────────────────────────────────────────────────────────── */

export function MoneballSection() {
  return (
    <section className="relative px-6 py-28 overflow-hidden" style={{ background: '#070c18' }}>
      {/* Subtle diagonal lines — scientific graph paper feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #a0c4ff 0px, #a0c4ff 1px, transparent 0px, transparent 50%)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 30% 50%, rgba(245,158,11,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-5xl">

        {/* Label */}
        <FadeIn className="mb-14">
          <div className="glue-pill mb-6" style={{borderColor:"rgba(245,158,11,0.2)",background:"rgba(245,158,11,0.08)",color:"#fbbf24"}}>
            <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400">
              The Hypothesis
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight max-w-3xl">
            The 2032 provider shortage isn&apos;t a talent problem.
            <br />
            <span className="text-amber-400">It&apos;s a speed problem.</span>
          </h2>
        </FadeIn>

        {/* Two-column: argument + proof */}
        <div className="grid gap-10 md:grid-cols-[1fr_1fr]">

          {/* Left: The argument */}
          <FadeIn delay={0.1} className="space-y-6">
            <div className="rounded-2xl border border-white/8 bg-white/3 p-7 space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">The Argument</p>

              <p className="text-white/70 leading-relaxed">
                The US is projected to face a shortage of{' '}
                <span className="text-white font-semibold">124,000 physicians by 2032.</span>{' '}
                Every major health system is recruiting harder. More job boards, more
                sourcers, more interviews. The pipeline looks full.
              </p>

              <p className="text-white/70 leading-relaxed">
                But look at what happens after the offer letter. A clinician
                accepts a position in January. She doesn&apos;t start until{' '}
                <span className="text-red-400 font-semibold">May or June.</span>{' '}
                Not because she wasn&apos;t ready. Because the hospital spent
                90 days re-verifying credentials it could have confirmed automatically.
              </p>

              <p className="text-white/70 leading-relaxed">
                Nobody is connecting{' '}
                <span className="text-white font-semibold">credentialing speed</span>{' '}
                to{' '}
                <span className="text-white font-semibold">hiring capacity.</span>{' '}
                If a health system wants to onboard 50 physicians this year, they
                need every single one to clear credentialing — not 35 of them, six months late.
              </p>
            </div>

            {/* The Moneyball quote */}
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-6">
              <p className="text-lg text-white/80 leading-relaxed italic mb-3">
                &ldquo;We&apos;re not buying players. We&apos;re buying runs.
                As long as they get on first base.&rdquo;
              </p>
              <p className="text-xs text-amber-400/70 font-medium">
                — Moneyball (2011) · Applied to healthcare recruiting
              </p>
            </div>
          </FadeIn>

          {/* Right: The proof + funnel */}
          <FadeIn delay={0.2} className="space-y-5">
            <div className="rounded-2xl border border-white/8 bg-white/3 p-7 space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">The Proof</p>

              <p className="text-white/70 leading-relaxed">
                As a clinician sourcing recruiter, I ran this experiment.
                Thousands of leads. Full pipelines. Strong interviewers.
                The ATS data was clear:{' '}
                <span className="text-white font-semibold">
                  talent wasn&apos;t the constraint.
                </span>{' '}
                Recruiters weren&apos;t the constraint. Interviews weren&apos;t
                the constraint.
              </p>

              <p className="text-white/70 leading-relaxed">
                The drop-off was at the very bottom of the funnel —
                after the hire, before the start.{' '}
                <span className="text-amber-400 font-semibold">Credentialing.</span>{' '}
                Every time.
              </p>
            </div>

            {/* Funnel visualization */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-5">
                The recruiting funnel
              </p>
              {[
                { label: 'Sourced leads',     pct: 100, color: 'bg-blue-400',    dim: false },
                { label: 'Applications',      pct: 68,  color: 'bg-blue-400',    dim: false },
                { label: 'Interviews',        pct: 42,  color: 'bg-blue-400',    dim: false },
                { label: 'Offers accepted',   pct: 28,  color: 'bg-amber-400',   dim: false },
                { label: 'Credentialing ← bottleneck', pct: 28, color: 'bg-red-400', dim: false },
                { label: 'Day 1 starts',      pct: 11,  color: 'bg-emerald-400', dim: false },
              ].map((row, i) => (
                <div key={row.label} className="mb-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs ${row.label.includes('bottleneck') ? 'text-red-400 font-semibold' : 'text-white/65'}`}>
                      {row.label}
                    </span>
                    <span className={`text-xs font-mono ${row.label.includes('bottleneck') ? 'text-red-400' : 'text-white/50'}`}>
                      {row.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full ${row.color} ${row.label.includes('bottleneck') ? 'opacity-70' : 'opacity-50'}`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-white/50 mt-4 leading-relaxed">
                The gap between &ldquo;offers accepted&rdquo; and &ldquo;Day 1 starts&rdquo; is
                entirely credentialing delay. VitalCV closes it.
              </p>
            </div>

          </FadeIn>
        </div>

        {/* Conclusion */}
        <FadeIn delay={0.3} className="mt-12">
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-7 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400/70 mb-4">
              The Conclusion
            </p>
            <p className="text-xl sm:text-2xl font-bold text-white leading-tight max-w-3xl mx-auto">
              Fix credentialing speed, and you don&apos;t just hire faster —
              you solve the shortage.
            </p>
            <p className="text-white/65 mt-3 max-w-2xl mx-auto">
              Every week a credentialed physician can&apos;t start is a week of care
              that doesn&apos;t happen. VitalCV compresses that gap from months to hours —
              and in doing so, unlocks the capacity the healthcare system already has.
            </p>
          </div>
        </FadeIn>

      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   6. PLATFORM VISION — The five pillars + novel tech
   "Not just credentialing. The infrastructure layer for
    all of US healthcare."
───────────────────────────────────────────────────────────── */

const PILLARS = [
  {
    number: '01',
    title: 'Universal Clinical Identity',
    // M1: Only tag sources that are actually integrated. NPDB/DEA/ABMS are not live.
    body: 'One verified profile per clinician — NPI, licenses, enrollment status, and career trajectory. Pulled from connected primary sources, not self-reported.',
    tags: ['NPPES', 'OIG / LEIE', 'CMS PECOS', 'State Boards', 'OpenAlex'],
    color: 'blue',
  },
  {
    number: '02',
    title: 'Free Specialty Job Board',
    body: 'Every healthcare job, every specialty, free to post. Physicians, NPs, CRNAs, therapists — one platform for all of medicine. Employers stop paying $5,000 for a single oncology posting.',
    tags: ['All Specialties', 'All Provider Types', 'Free to Post', 'Auto-Aggregated'],
    color: 'emerald',
  },
  {
    number: '03',
    title: 'MATCHA — AI Career Matching',
    body: 'Not keyword matching. Credential-aware AI that knows your exact qualifications, your gaps, your trajectory. Surfaces opportunities you\'re actually eligible for — before you go looking.',
    tags: ['Gap Analysis', 'Career Paths', 'Readiness Score', 'Match Intelligence'],
    color: 'violet',
  },
  {
    number: '04',
    title: 'Clinic Capacity Intelligence',
    body: 'For the first time, health systems can measure hiring capacity — not just headcount. How many physicians can actually start this quarter? VitalCV tells you, and tells you how to increase it.',
    tags: ['Staffing Projections', 'Credentialing Velocity', 'Capacity Model', 'New Metric'],
    color: 'amber',
  },
  {
    number: '05',
    title: 'Cryptographic PSV',
    // M1: No blockchain in production. "Permanent" is overclaim — credentials expire and are re-checked.
    body: 'Primary source verification results signed and portable. Once a source is checked, the signed result travels with the clinician — so employers confirm standing without re-running the same check. Data freshness varies by source (daily to quarterly).',
    tags: ['SD-JWT VC', 'W3C Standards', 'OID4VCI', 'Source-Signed'],
    color: 'rose',
  },
] as const;

const PILLAR_COLORS: Record<string, { border: string; tag: string; num: string }> = {
  blue:    { border: 'border-blue-500/20 hover:border-blue-500/40',    tag: 'bg-blue-500/10 text-blue-400/80',    num: 'text-blue-500/30'    },
  emerald: { border: 'border-emerald-500/20 hover:border-emerald-500/40', tag: 'bg-emerald-500/10 text-emerald-400/80', num: 'text-emerald-500/30' },
  violet:  { border: 'border-violet-500/20 hover:border-violet-500/40',  tag: 'bg-violet-500/10 text-violet-400/80',  num: 'text-violet-500/30'  },
  amber:   { border: 'border-amber-500/20 hover:border-amber-500/40',   tag: 'bg-amber-500/10 text-amber-400/80',   num: 'text-amber-500/30'   },
  rose:    { border: 'border-rose-500/20 hover:border-rose-500/40',     tag: 'bg-rose-500/10 text-rose-400/80',     num: 'text-rose-500/30'    },
};

const NOVEL_CLAIMS = [
  {
    claim: 'The first unified clinical identity graph',
    // M1: "blockchain-anchored" → "cryptographically signed" — no blockchain in prod
    detail: 'NPI → credentials → publications → career history — one traversable, source-backed, cryptographically-signed graph. No one has built this for healthcare.',
  },
  {
    claim: 'Credential-aware job matching',
    detail: 'MATCHA knows what you\'re qualified for today, what you\'re 6 months from qualifying for, and what your peers pivoted to. That\'s not a job board — it\'s a career engine.',
  },
  {
    // M1: "trusted forever" removed — credentials expire and sources have freshness windows
    // M1: "blockchain-anchored" → "cryptographically signed" — no blockchain in prod
    claim: 'PSV that travels with the clinician',
    detail: 'When a credential is verified via primary source and cryptographically signed, that result is portable. The duplicated re-verification loop — the one that costs $9K/day per empty slot — ends.',
  },
  {
    claim: 'Clinic hiring capacity as a measurable metric',
    detail: 'No health system can currently answer "how many physicians can we actually onboard this year?" VitalCV answers it — and improves the number.',
  },
];

export function PlatformVisionSection() {
  return (
    <section className="relative px-6 py-28 overflow-hidden" style={{ background: '#060c16' }}>
      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl">

        {/* Header */}
        <FadeIn className="text-center mb-16">
          <div className="glue-pill mb-6" style={{borderColor:"rgba(139,92,246,0.2)",background:"rgba(139,92,246,0.08)",color:"#a78bfa"}}>
            <Globe className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-400">
              The Platform
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight mb-4">
            Not just credentialing.
            <br />
            <span className="text-violet-400">The infrastructure layer for all of US healthcare.</span>
          </h2>
          <p className="text-white/60 max-w-2xl mx-auto text-lg leading-relaxed">
            VitalCV is building the definitive knowledge base for every clinician, every credential,
            every specialty, and every career path in American medicine — backed by primary source
            verification and cryptographic signing. Free for the people who need it most.
          </p>
        </FadeIn>

        {/* Five Pillars */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-16">
          {PILLARS.map((p, i) => {
            const c = PILLAR_COLORS[p.color];
            return (
              <FadeIn key={p.number} delay={i * 0.08}>
                <div className={`group h-full rounded-2xl border bg-white/3 p-6 transition-all hover:bg-white/5 ${c.border}`}>
                  <div className="flex items-start justify-between mb-4">
                    <span className={`text-4xl font-black ${c.num}`}>{p.number}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{p.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed mb-4">{p.body}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map(tag => (
                      <span key={tag} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </FadeIn>
            );
          })}

          {/* Sixth cell — the integration network */}
          <FadeIn delay={0.4}>
            <div className="group h-full rounded-2xl border border-white/8 bg-white/2 p-6 transition-all hover:bg-white/4">
              <div className="mb-4">
                <span className="text-4xl font-black text-white/10">06</span>
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Source Layer</h3>
              {/* M1: Only show sources that are actually integrated or configured.
                  NPDB and Doximity are not connected. DEA/ABMS have no live provider.
                  CMS/TEFCA/ONC are standards/interop targets, not data sources. */}
              <p className="text-sm text-white/60 leading-relaxed mb-4">
                Connected to primary registries — so clinicians never fill out a form
                that already exists in an official source.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { src: 'NPPES',        live: true  },
                  { src: 'OIG / LEIE',   live: true  },
                  { src: 'CMS PECOS',    live: true  },
                  { src: 'Nursys',       live: false },
                  { src: 'FSMB',         live: false },
                  { src: 'OpenAlex',     live: true  },
                  { src: 'ONC / TEFCA',  live: false },
                ].map(({ src, live }) => (
                  <span
                    key={src}
                    title={live ? 'Connected' : 'Requires institutional access or configuration'}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      live ? 'bg-white/8 text-white/70' : 'bg-white/3 text-white/35'
                    }`}
                  >
                    {src}{!live ? ' ·' : ''}
                  </span>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Novel Tech Claims */}
        <FadeIn delay={0.3}>
          <div className="rounded-2xl border border-white/8 bg-white/3 p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/50 text-center mb-8">
              What&apos;s never been done before
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              {NOVEL_CLAIMS.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-5 w-5 rounded-full border border-violet-500/30 bg-violet-500/10 flex items-center justify-center">
                      <Rocket className="h-2.5 w-2.5 text-violet-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">{item.claim}</p>
                    <p className="text-xs text-white/60 leading-relaxed">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

      </div>
    </section>
  );
}
