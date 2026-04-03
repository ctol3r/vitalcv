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
    <section className="relative px-6 py-24 overflow-hidden" >
      {/* Subtle noise texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative mx-auto max-w-5xl">
        <FadeIn className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-1.5 mb-5">
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--vt-severity-critical)]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
              The Problem
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--vt-text-primary)] leading-tight">
            Every hospital reverifies you{' '}
            <span className="text-[var(--vt-severity-critical)]">from scratch. Every time.</span>
          </h2>
          <p className="mt-4 text-[var(--vt-text-secondary)] max-w-2xl mx-auto text-lg leading-relaxed">
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
                <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6 h-full">
                  <div className={`inline-flex rounded-sm p-2.5 mb-4 ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className={`text-4xl font-bold ${stat.color}`}>{stat.value}</span>
                    {stat.unit && (
                      <span className="text-lg font-medium text-[var(--vt-text-muted)]">{stat.unit}</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--vt-text-muted)] leading-relaxed">{stat.label}</p>
                </div>
              </FadeIn>
            );
          })}
        </div>

        <FadeIn delay={0.4} className="mt-10 text-center">
          <p className="text-[var(--vt-text-muted)] text-sm">
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
    title: 'Source-backed readiness snapshot',
    // M1: List only live/configured sources. NPDB and DEA are not integrated.
    description: 'We run NPPES identity and OIG exclusion first. PECOS and state board coverage appear only when those sources are actually available.',
    accent: 'emerald',
    detail: 'Checked from source runs',
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
    border: 'border-[var(--vt-status-new)]/20 group-hover:border-[var(--vt-status-new)]/40',
    text: 'text-[var(--vt-status-new)]',
    bg: 'bg-[var(--vt-status-new)]/10',
    stepText: 'text-[var(--vt-status-new)]',
  },
  emerald: {
    border: 'border-[var(--vt-status-resolved)]/20 group-hover:border-[var(--vt-status-resolved)]/40',
    text: 'text-[var(--vt-status-resolved)]',
    bg: 'bg-[var(--vt-status-resolved)]/10',
    stepText: 'text-[var(--vt-status-resolved)]',
  },
  violet: {
    border: 'border-[var(--vt-status-investigating)]/20 group-hover:border-[var(--vt-status-investigating)]/40',
    text: 'text-[var(--vt-status-investigating)]',
    bg: 'bg-[var(--vt-status-investigating)]/10',
    stepText: 'text-[var(--vt-status-investigating)]',
  },
};

export function HowItWorksSection() {
  return (
    <section className="relative px-6 py-24" >
      {/* Faint grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div className="relative mx-auto max-w-5xl">
        <FadeIn className="text-center mb-14" immediate>
          <div className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-1.5 mb-5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--vt-status-new)]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
              How It Works
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--vt-text-primary)] leading-tight">
            Start with one NPI.{' '}
            <span className="text-[var(--vt-status-new)]">See source-backed readiness.</span>
          </h2>
          <p className="mt-4 text-[var(--vt-text-secondary)] max-w-xl mx-auto text-lg leading-relaxed">
            Primary sources first. Signed proof where coverage exists. Explicit gaps where it does not.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const colors = STEP_ACCENT[s.accent];
            return (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeOut' }}
                className="h-full"
              >
                <div
                  className={`group relative h-full rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] hover:bg-[var(--vt-surface-subtle)] p-7 transition-all  ${colors.border}`}
                >
                  {/* Connector arrow (not on last) */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 h-7 w-7 items-center justify-center rounded-sm bg-[var(--vt-surface)] border border-[var(--vt-border)]">
                      <ArrowRight className="h-3.5 w-3.5 text-[var(--vt-text-muted)]" />
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-5">
                    <div className={`rounded-sm p-2.5 ${colors.bg}`}>
                      <Icon className={`h-5 w-5 ${colors.text}`} />
                    </div>
                    <span className={`text-4xl font-black opacity-10 ${colors.stepText}`}>
                      {s.step}
                    </span>
                  </div>

                  <h3 className="font-semibold text-[var(--vt-text-primary)] mb-2 text-base">{s.title}</h3>
                  <p className="text-sm text-[var(--vt-text-secondary)] leading-relaxed mb-4">{s.description}</p>

                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold ${colors.text}`}>
                    <CheckCircle2 className="h-3 w-3" />
                    {s.detail}
                  </div>
                </div>
              </motion.div>
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
  { icon: CheckCircle2, text: 'Clinician identity chain: NPI → readiness → portable credential packet' },
  { icon: CheckCircle2, text: 'Employer acceptance flow — review and accept verified packets' },
  { icon: CheckCircle2, text: 'HIPAA-aligned audit trail with continuous license monitoring' },
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
    <section className="relative px-6 py-24" >
      <div className="mx-auto max-w-5xl">
        <FadeIn className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-1.5 mb-5">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--vt-status-resolved)]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
              The Opportunity
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--vt-text-primary)] leading-tight">
            A massive, broken market.{' '}
            <span className="text-[var(--vt-status-resolved)]">We have the fix.</span>
          </h2>
          <p className="mt-4 text-[var(--vt-text-secondary)] max-w-xl mx-auto text-lg leading-relaxed">
            Every hospital, clinic, and staffing agency re-verifies the same
            clinician from scratch — by fax, by hand, every time. VitalCV
            makes that process auditable, portable, and interoperable.
          </p>
        </FadeIn>

        {/* Market stats */}
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 mb-10">
          {TRACTION_STATS.map((m, i) => (
            <FadeIn key={m.label} delay={i * 0.1}>
              <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] hover:bg-[var(--vt-surface-subtle)] p-5 text-center h-full">
                <div className={`text-2xl sm:text-3xl font-black mb-1.5 tracking-tight ${m.color}`}>
                  {m.value}
                </div>
                <div className="text-xs text-[var(--vt-text-muted)] leading-relaxed">{m.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Wave 240: Live system capacity badge */}
        <SystemCapacityBadge />

        {/* What's built */}
        <FadeIn delay={0.25}>
          <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] hover:bg-[var(--vt-surface-subtle)] p-6 mb-5">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)] mb-5">
              What&apos;s already built &amp; working
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {BUILD_SIGNALS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-2.5">
                  <Icon className="h-4 w-4 text-[var(--vt-status-resolved)] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[var(--vt-text-muted)] leading-snug">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Compliance badges */}
        <FadeIn delay={0.3}>
          <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] hover:bg-[var(--vt-surface-subtle)] p-6">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)] text-center mb-5">
              Standards &amp; Sources
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {COMPLIANCE_BADGES.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-1.5 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-3.5 py-1.5"
                >
                  <span className="h-1.5 w-1.5 rounded-sm bg-[var(--vt-text-muted)] flex-shrink-0" />
                  <span className="text-xs font-semibold text-[var(--vt-text-muted)]">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.4} className="text-center mt-12">
          <p className="text-[var(--vt-text-muted)] text-sm mb-5">
            See the product working in real time.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/passport" className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-text-primary)] px-7 py-3 text-sm font-semibold text-[var(--vt-bg)] transition hover:bg-[var(--vt-text-secondary)]">
              Check my readiness <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/employers" className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-7 py-3 text-sm font-semibold text-[var(--vt-text-primary)] transition hover:bg-[var(--vt-surface-subtle)]">
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
    <section className="relative px-6 py-20 bg-[var(--vt-surface-subtle)] overflow-hidden">
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
          <div className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-1.5 mb-5">
            <Zap className="h-3.5 w-3.5 text-[var(--vt-severity-high)]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
              Why Now
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--vt-text-primary)] leading-tight">
            Three forces are converging.{' '}
            <span className="text-[var(--vt-severity-high)]">This is the window.</span>
          </h2>
          <p className="mt-4 text-[var(--vt-text-muted)] max-w-xl mx-auto text-lg leading-relaxed">
            The stars haven't aligned for healthcare credentialing reform — they've collided.
            Regulatory mandates, a staffing emergency, and mature open standards
            make this the exact right moment to build VitalCV.
          </p>
        </FadeIn>

        <div className="grid gap-6 sm:grid-cols-3">
          {WHY_NOW_ITEMS.map(({ icon: Icon, title, body }, i) => (
            <FadeIn key={title} delay={i * 0.12}>
              <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6 h-full">
                <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[var(--vt-severity-high)]/10 border border-[var(--vt-severity-high)]/20 mb-4">
                  <Icon className="h-5 w-5 text-[var(--vt-severity-high)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--vt-text-primary)] mb-2">{title}</h3>
                <p className="text-sm text-[var(--vt-text-muted)] leading-relaxed">{body}</p>
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
    <section className="relative px-6 py-28 overflow-hidden" >
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
          <div className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-1.5 mb-6">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--vt-severity-high)]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
              The Hypothesis
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--vt-text-primary)] leading-tight max-w-3xl">
            The 2032 provider shortage isn&apos;t a talent problem.
            <br />
            <span className="text-[var(--vt-severity-high)]">It&apos;s a speed problem.</span>
          </h2>
        </FadeIn>

        {/* Two-column: argument + proof */}
        <div className="grid gap-10 md:grid-cols-[1fr_1fr]">

          {/* Left: The argument */}
          <FadeIn delay={0.1} className="space-y-6">
            <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] hover:bg-[var(--vt-surface-subtle)] p-7 space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">The Argument</p>

              <p className="text-[var(--vt-text-secondary)] leading-relaxed">
                The US is projected to face a shortage of{' '}
                <span className="text-[var(--vt-text-primary)] font-semibold">124,000 physicians by 2032.</span>{' '}
                Every major health system is recruiting harder. More job boards, more
                sourcers, more interviews. The pipeline looks full.
              </p>

              <p className="text-[var(--vt-text-secondary)] leading-relaxed">
                But look at what happens after the offer letter. A clinician
                accepts a position in January. She doesn&apos;t start until{' '}
                <span className="text-[var(--vt-severity-critical)] font-semibold">May or June.</span>{' '}
                Not because she wasn&apos;t ready. Because the hospital spent
                90 days re-verifying credentials it could have confirmed automatically.
              </p>

              <p className="text-[var(--vt-text-secondary)] leading-relaxed">
                Nobody is connecting{' '}
                <span className="text-[var(--vt-text-primary)] font-semibold">credentialing speed</span>{' '}
                to{' '}
                <span className="text-[var(--vt-text-primary)] font-semibold">hiring capacity.</span>{' '}
                If a health system wants to onboard 50 physicians this year, they
                need every single one to clear credentialing — not 35 of them, six months late.
              </p>
            </div>

            {/* The Moneyball quote */}
            <div className="rounded-sm border border-[var(--vt-severity-high)]/15 bg-[var(--vt-severity-high)]/5 p-6">
              <p className="text-lg text-[var(--vt-text-primary)]/80 leading-relaxed italic mb-3">
                &ldquo;We&apos;re not buying players. We&apos;re buying runs.
                As long as they get on first base.&rdquo;
              </p>
              <p className="text-xs text-[var(--vt-severity-high)]/70 font-medium">
                — Moneyball (2011) · Applied to healthcare recruiting
              </p>
            </div>
          </FadeIn>

          {/* Right: The proof + funnel */}
          <FadeIn delay={0.2} className="space-y-5">
            <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] hover:bg-[var(--vt-surface-subtle)] p-7 space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">The Proof</p>

              <p className="text-[var(--vt-text-secondary)] leading-relaxed">
                As a clinician sourcing recruiter, I ran this experiment.
                Thousands of leads. Full pipelines. Strong interviewers.
                The ATS data was clear:{' '}
                <span className="text-[var(--vt-text-primary)] font-semibold">
                  talent wasn&apos;t the constraint.
                </span>{' '}
                Recruiters weren&apos;t the constraint. Interviews weren&apos;t
                the constraint.
              </p>

              <p className="text-[var(--vt-text-secondary)] leading-relaxed">
                The drop-off was at the very bottom of the funnel —
                after the hire, before the start.{' '}
                <span className="text-[var(--vt-severity-high)] font-semibold">Credentialing.</span>{' '}
                Every time.
              </p>
            </div>

            {/* Funnel visualization */}
            <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] hover:bg-[var(--vt-surface-subtle)] p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--vt-text-muted)] mb-5">
                The recruiting funnel
              </p>
              {[
                { label: 'Sourced leads',     pct: 100, color: 'bg-[var(--vt-status-new)]',    dim: false },
                { label: 'Applications',      pct: 68,  color: 'bg-[var(--vt-status-new)]',    dim: false },
                { label: 'Interviews',        pct: 42,  color: 'bg-[var(--vt-status-new)]',    dim: false },
                { label: 'Offers accepted',   pct: 28,  color: 'bg-[var(--vt-severity-high)]',   dim: false },
                { label: 'Credentialing ← bottleneck', pct: 28, color: 'bg-[var(--vt-severity-critical)]', dim: false },
                { label: 'Day 1 starts',      pct: 11,  color: 'bg-[var(--vt-status-resolved)]', dim: false },
              ].map((row, i) => (
                <div key={row.label} className="mb-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs ${row.label.includes('bottleneck') ? 'text-[var(--vt-severity-critical)] font-semibold' : 'text-[var(--vt-text-secondary)]'}`}>
                      {row.label}
                    </span>
                    <span className={`text-xs font-mono ${row.label.includes('bottleneck') ? 'text-[var(--vt-severity-critical)]' : 'text-[var(--vt-text-muted)]'}`}>
                      {row.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-sm bg-[var(--vt-surface-subtle)]">
                    <div
                      className={`h-full rounded-sm ${row.color} ${row.label.includes('bottleneck') ? 'opacity-70' : 'opacity-50'}`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-[var(--vt-text-muted)] mt-4 leading-relaxed">
                The gap between &ldquo;offers accepted&rdquo; and &ldquo;Day 1 starts&rdquo; is
                entirely credentialing delay. VitalCV closes it.
              </p>
            </div>

          </FadeIn>
        </div>

        {/* Conclusion */}
        <FadeIn delay={0.3} className="mt-12">
          <div className="rounded-sm border border-[var(--vt-status-resolved)]/15 bg-[var(--vt-status-resolved)]/5 p-7 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--vt-status-resolved)]/70 mb-4">
              The Conclusion
            </p>
            <p className="text-xl sm:text-2xl font-bold text-[var(--vt-text-primary)] leading-tight max-w-3xl mx-auto">
              Fix credentialing speed, and you don&apos;t just hire faster —
              you solve the shortage.
            </p>
            <p className="text-[var(--vt-text-secondary)] mt-3 max-w-2xl mx-auto">
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
  blue:    { border: 'border-[var(--vt-status-new)]/20 hover:border-[var(--vt-status-new)]/40',    tag: 'bg-[var(--vt-status-new)]/10 text-[var(--vt-status-new)]/80',    num: 'text-[var(--vt-status-new)]/30'    },
  emerald: { border: 'border-[var(--vt-status-resolved)]/20 hover:border-[var(--vt-status-resolved)]/40', tag: 'bg-[var(--vt-status-resolved)]/10 text-[var(--vt-status-resolved)]/80', num: 'text-[var(--vt-status-resolved)]/30' },
  violet:  { border: 'border-[var(--vt-status-investigating)]/20 hover:border-[var(--vt-status-investigating)]/40',  tag: 'bg-[var(--vt-status-investigating)]/10 text-[var(--vt-status-investigating)]/80',  num: 'text-[var(--vt-status-investigating)]/30'  },
  amber:   { border: 'border-[var(--vt-severity-high)]/20 hover:border-[var(--vt-severity-high)]/40',   tag: 'bg-[var(--vt-severity-high)]/10 text-[var(--vt-severity-high)]/80',   num: 'text-[var(--vt-severity-high)]/30'   },
  rose:    { border: 'border-[var(--vt-severity-critical)]/20 hover:border-[var(--vt-severity-critical)]/40',     tag: 'bg-[var(--vt-severity-critical)]/10 text-[var(--vt-severity-critical)]/80',     num: 'text-[var(--vt-severity-critical)]/30'    },
};

const NOVEL_CLAIMS = [
  {
    claim: 'The first unified clinical identity chain',
    // M1: "blockchain-anchored" → "cryptographically signed" — no blockchain in prod
    detail: 'NPI → credentials → publications → career history — one traversable, source-backed, cryptographically-signed chain. No one has built this for healthcare.',
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
    <section className="relative px-6 py-28 overflow-hidden" >
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
          <div className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-1.5 mb-6">
            <Globe className="h-3.5 w-3.5 text-[var(--vt-status-investigating)]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
              The Platform
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--vt-text-primary)] leading-tight mb-4">
            Not just credentialing.
            <br />
            <span className="text-[var(--vt-status-investigating)]">The infrastructure layer for all of US healthcare.</span>
          </h2>
          <p className="text-[var(--vt-text-secondary)] max-w-2xl mx-auto text-lg leading-relaxed">
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
                <div className={`group h-full rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] hover:bg-[var(--vt-surface-subtle)] p-6 transition-all  ${c.border}`}>
                  <div className="flex items-start justify-between mb-4">
                    <span className={`text-4xl font-black ${c.num}`}>{p.number}</span>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--vt-text-primary)] mb-2">{p.title}</h3>
                  <p className="text-sm text-[var(--vt-text-secondary)] leading-relaxed mb-4">{p.body}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map(tag => (
                      <span key={tag} className={`rounded-sm border border-[var(--vt-border)] px-2 py-0.5 text-[10px] font-medium ${c.tag}`}>
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
            <div className="group h-full rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6 transition-all hover:bg-[var(--vt-surface-subtle)]">
              <div className="mb-4">
                <span className="text-4xl font-black text-[var(--vt-text-muted)]/20">06</span>
              </div>
              <h3 className="text-base font-semibold text-[var(--vt-text-primary)] mb-2">Source Layer</h3>
              {/* M1: Only show sources that are actually integrated or configured.
                  NPDB and Doximity are not connected. DEA/ABMS have no live provider.
                  CMS/TEFCA/ONC are standards/interop targets, not data sources. */}
              <p className="text-sm text-[var(--vt-text-secondary)] leading-relaxed mb-4">
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
                    className={`rounded-sm border border-[var(--vt-border)] px-2 py-0.5 text-[10px] font-medium ${
                      live ? 'bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]' : 'bg-[var(--vt-surface)] hover:bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]/35'
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
          <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] hover:bg-[var(--vt-surface-subtle)] p-8">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)] text-center mb-8">
              What&apos;s never been done before
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              {NOVEL_CLAIMS.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-5 w-5 rounded-sm border border-[var(--vt-status-investigating)]/30 bg-[var(--vt-status-investigating)]/10 flex items-center justify-center">
                      <Rocket className="h-2.5 w-2.5 text-[var(--vt-status-investigating)]" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--vt-text-primary)] mb-1">{item.claim}</p>
                    <p className="text-xs text-[var(--vt-text-muted)] leading-relaxed">{item.detail}</p>
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

export function BuyerPilotSection() {
  return (
    <section className="px-6 py-20 border-t border-[var(--vt-border)]">
      <div className="mx-auto max-w-5xl rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-8">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-status-resolved)]">For employers</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--vt-text-primary)]">
          One buyer path: request pilot, then run review.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--vt-text-secondary)]">
          If you run credentialing or recruiting operations, start with the employer pilot entry.
          VitalCV stays focused on one workflow: NPI to readiness, passport, and review decision.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pilot" className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-text-primary)] px-7 py-3 text-sm font-semibold text-[var(--vt-bg)] transition hover:bg-[var(--vt-text-secondary)]">
            Request pilot <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/employers" className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-7 py-3 text-sm font-semibold text-[var(--vt-text-primary)] transition hover:bg-[var(--vt-surface-subtle)]">
            Employer overview
          </Link>
        </div>
      </div>
    </section>
  );
}

