'use client';

/**
 * HomeSections.tsx — Sandbox Brutalist Design
 * Three narrative sections with brutalist styling - no gradients, minimal rounding
 */

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
  Activity,
} from 'lucide-react';
import Link from 'next/link';

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
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
  {
    icon: FileX,
    value: '1 in 5',
    unit: '',
    label: 'applications contain errors that delay hire',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
] as const;

export function ProblemSection() {
  return (
    <section className="px-6 py-24 border-t border-line">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 border border-line bg-[var(--vt-surface)] px-4 py-1.5 mb-5">
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
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PAIN_STATS.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="border border-line p-6 h-full bg-[var(--vt-surface)]">
                <div className={`inline-flex p-2.5 mb-4 ${stat.bg}`}>
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
            );
          })}
        </div>
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
    detail: 'NPI-first entry point',
  },
  {
    step: '02',
    icon: ShieldCheck,
    title: 'Source-backed readiness snapshot',
    description: 'We run NPPES identity and OIG exclusion first. PECOS and state board coverage appear only when those sources are actually available.',
    detail: 'Checked from source runs',
  },
  {
    step: '03',
    icon: Activity,
    title: 'Portable across employers',
    description: 'Your readiness snapshot travels with you. Connected checks stay source-backed, and missing coverage stays visibly pending.',
    detail: 'Fewer repeated verifications',
  },
] as const;

export function HowItWorksSection() {
  return (
    <section className="px-6 py-24">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 border border-line bg-[var(--vt-surface)] px-4 py-1.5 mb-5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--vt-status-resolved)]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
              How It Works
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--vt-text-primary)] leading-tight">
            Start with one NPI.{' '}
            <span className="text-[var(--vt-status-resolved)]">See source-backed readiness.</span>
          </h2>
          <p className="mt-4 text-[var(--vt-text-secondary)] max-w-xl mx-auto text-lg leading-relaxed">
            Primary sources first. Signed proof where coverage exists. Explicit gaps where it does not.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="border border-line p-7 bg-[var(--vt-surface)] h-full">
                <div className="flex items-start justify-between mb-5">
                  <div className="p-2.5 border border-line/10">
                    <Icon className="h-5 w-5 text-[var(--vt-text-primary)]" />
                  </div>
                  <span className="text-4xl font-black opacity-10 text-[var(--vt-text-primary)]">
                    {s.step}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-[var(--vt-text-primary)] mb-2">{s.title}</h3>
                <p className="text-sm text-[var(--vt-text-secondary)] leading-relaxed mb-4">{s.description}</p>

                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--vt-status-resolved)]">
                  <CheckCircle2 className="h-3 w-3" />
                  {s.detail}
                </div>
              </div>
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
  { value: '6.8M', label: 'licensed US healthcare workers — every one needs credentialing' },
  { value: '$9K', label: 'lost per day per unfilled physician slot' },
  { value: '~10s', label: 'to first readiness snapshot from NPI (NPPES + OIG/LEIE + PECOS)' },
  { value: '$4.2B', label: 'US healthcare credentialing market, growing 11% YoY' },
] as const;

export function TractionSection() {
  return (
    <section className="px-6 py-24 border-t border-line">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 border border-line bg-[var(--vt-surface)] px-4 py-1.5 mb-5">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--vt-status-resolved)]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
              The Opportunity
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--vt-text-primary)] leading-tight">
            A massive, broken market.{' '}
            <span className="text-[var(--vt-status-resolved)]">We have a fix.</span>
          </h2>
          <p className="mt-4 text-[var(--vt-text-secondary)] max-w-xl mx-auto text-lg leading-relaxed">
            Every hospital, clinic, and staffing agency re-verifies the same
            clinician from scratch — by fax, by hand, every time. VitalCV
            makes that process auditable, portable, and interoperable.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 mb-10">
          {TRACTION_STATS.map((m, i) => (
            <div key={m.label} className="border border-line p-5 text-center h-full bg-[var(--vt-surface)]">
              <div className="text-2xl sm:text-3xl font-black mb-1.5 tracking-tight text-[var(--vt-text-primary)]">
                {m.value}
              </div>
              <div className="text-xs text-[var(--vt-text-muted)] leading-relaxed">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-[var(--vt-text-muted)] text-sm mb-5">
            See the product working in real time.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/passport" className="border border-line px-7 py-3 text-sm font-semibold text-[var(--vt-text-primary)] uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center gap-2">
              Check my readiness <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/employers" className="border border-line px-7 py-3 text-sm font-semibold text-[var(--vt-text-primary)] uppercase tracking-widest hover:opacity-90 transition-opacity">
              For employers
            </Link>
          </div>
        </div>
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
    <section className="px-6 py-20 border-t border-line bg-[var(--vt-surface-subtle)]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 border border-line bg-[var(--vt-surface)] px-4 py-1.5 mb-5">
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
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {WHY_NOW_ITEMS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="border border-line p-6 bg-[var(--vt-surface)] h-full">
              <div className="flex h-10 w-10 items-center justify-center border border-line/10 mb-4">
                <Icon className="h-5 w-5 text-[var(--vt-severity-high)]" />
              </div>
              <h3 className="text-base font-semibold text-[var(--vt-text-primary)] mb-2">{title}</h3>
              <p className="text-sm text-[var(--vt-text-muted)] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BuyerPilotSection() {
  return (
    <section className="px-6 py-20 border-t border-line">
      <div className="max-w-5xl mx-auto border border-line bg-[var(--vt-surface)] p-8">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-status-resolved)] mb-3">For employers</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--vt-text-primary)]">
          One buyer path: request pilot, then run review.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--vt-text-secondary)]">
          If you run credentialing or recruiting operations, start with employer pilot entry.
          VitalCV stays focused on one workflow: NPI to readiness, passport, and review decision.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pilot" className="border border-line bg-ink text-bg px-7 py-3 text-sm font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center gap-2">
            Request pilot <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/employers" className="border border-line px-7 py-3 text-sm font-semibold text-[var(--vt-text-primary)] uppercase tracking-widest hover:opacity-90 transition-opacity">
            Employer overview
          </Link>
        </div>
      </div>
    </section>
  );
}
