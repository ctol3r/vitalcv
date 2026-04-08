'use client';

/**
 * HomeSections.tsx — Sandbox Brutalist Design
 * Three narrative sections with brutalist styling - no gradients, minimal rounding
 */

import type { ComponentProps } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileX,
  Globe,
  Rocket,
  Search,
  ShieldCheck,
  TrendingUp,
  Zap,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

function StethoscopeIcon(props: ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M8 3v4a4 4 0 0 0 8 0V3" />
      <path d="M12 15v2a4 4 0 0 0 8 0v-1.5a2.5 2.5 0 1 0-5 0V17a1 1 0 0 1-2 0v-2" />
      <path d="M8 3H6" />
      <path d="M18 3h-2" />
      <path d="M8 7a4 4 0 0 1-4 4" />
      <path d="M16 7a4 4 0 0 0 4 4" />
    </svg>
  );
}

function InstitutionIcon(props: ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 10.5 12 5l9 5.5" />
      <path d="M5 10v8.5" />
      <path d="M9.5 10v8.5" />
      <path d="M14.5 10v8.5" />
      <path d="M19 10v8.5" />
      <path d="M3 19h18" />
    </svg>
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
    <section className="bg-[var(--vt-bg)] px-6 py-24">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] px-4 py-2 shadow-[var(--vt-shadow-pill)]">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--vt-status-resolved)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              How It Works
            </span>
          </div>
          <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-[-0.03em] text-[var(--vt-text-primary)] sm:text-4xl">
            Start with one NPI.{' '}
            <span className="text-[var(--vt-status-resolved)]">See source-backed readiness.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--vt-text-muted)] sm:text-lg">
            Primary sources first. Signed proof where coverage exists. Explicit gaps where it does not.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="flex h-full flex-col rounded-[28px] border border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] p-7 shadow-[var(--vt-shadow-card)]"
              >
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--vt-badge-preview-bg)]">
                    <Icon className="h-5 w-5 text-[var(--vt-accent)]" />
                  </div>
                  <span className="text-4xl font-medium tracking-[-0.04em] text-[var(--vt-text-primary)] opacity-10">
                    {s.step}
                  </span>
                </div>

                <h3 className="mb-2 text-lg font-semibold text-[var(--vt-text-primary)]">{s.title}</h3>
                <p className="mb-5 text-sm leading-7 text-[var(--vt-text-muted)]">{s.description}</p>

                <div className="mt-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--vt-badge-checked-bg)] px-3 py-1.5 text-xs font-medium text-[var(--vt-status-resolved)]">
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
   3. AUDIENCE SPLIT
───────────────────────────────────────────────────────────── */

const AUDIENCE_CARDS = [
  {
    title: "You're a clinician.",
    body: 'Carry your readiness profile. Stop re-verifying at every new employer.',
    cta: 'Check my NPI',
    href: '#npi-entry',
    tone: 'primary',
    Icon: StethoscopeIcon,
  },
  {
    title: 'You run credentialing or recruiting.',
    body: 'Start pilot reviews with source-backed snapshots. No vendor integration required to begin.',
    cta: 'Request employer pilot',
    href: '/pilot',
    tone: 'secondary',
    Icon: InstitutionIcon,
  },
] as const;

export function AudienceSplitSection() {
  return (
    <section className="border-t border-line px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--vt-text-primary)] opacity-40">
            Who is VitalCV for?
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--vt-text-primary)] sm:text-4xl">
            Choose the path that matches your role.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--vt-text-secondary)] sm:text-lg">
            Clinicians start with NPI-backed readiness. Employers start with a focused pilot review flow.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {AUDIENCE_CARDS.map(({ title, body, cta, href, tone, Icon }) => (
            <Link
              key={title}
              href={href}
              className="group block rounded-[12px] border border-[rgba(26,34,40,0.10)] bg-[#FFFFFF] p-8 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[rgba(26,34,40,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(26,34,40,0.10)] text-[var(--vt-text-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-[var(--vt-text-secondary)] transition-transform duration-200 group-hover:translate-x-0.5" />
                </div>

                <h3 className="mt-8 text-2xl font-semibold tracking-tight text-[var(--vt-text-primary)]">
                  {title}
                </h3>
                <p className="mt-3 max-w-md text-base leading-relaxed text-[var(--vt-text-secondary)]">
                  {body}
                </p>

                <span
                  className={`mt-8 inline-flex w-fit items-center justify-center rounded-lg border px-5 py-3 text-sm font-semibold transition-colors ${
                    tone === 'primary'
                      ? 'border-transparent bg-[#0F766E] text-white group-hover:bg-[#115E59]'
                      : 'border-[#0F766E] bg-transparent text-[#0F766E] group-hover:bg-[#F0FDFA]'
                  }`}
                >
                  {cta}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   4. TRACTION / CREDIBILITY SECTION
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
   5. WHY NOW SECTION
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
    <section className="border-t border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)] px-6 py-20">
      <div className="mx-auto max-w-5xl rounded-[32px] border border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] p-8 shadow-[var(--vt-shadow-soft)] sm:p-10">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-accent)]">For employers</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-[var(--vt-text-primary)] sm:text-4xl">
          One buyer path: request pilot, then run review.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--vt-text-muted)]">
          If you run credentialing or recruiting operations, start with employer pilot entry.
          VitalCV stays focused on one workflow: NPI to readiness, passport, and review decision.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/pilot"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--vt-accent)] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--vt-accent-hover)]"
          >
            Request pilot <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/employers"
            className="rounded-xl border border-[var(--vt-border)] px-7 py-3 text-sm font-semibold text-[var(--vt-text-primary)] transition-colors hover:border-[var(--vt-accent)]/30 hover:bg-[var(--vt-badge-preview-bg)]"
          >
            Employer overview
          </Link>
        </div>
      </div>
    </section>
  );
}
