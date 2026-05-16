import * as React from 'react';
import type { Metadata } from 'next';
import {
  ActivitySquare,
  AlertTriangle,
  CheckCircle2,
  FileLock2,
  ListTodo,
  Presentation,
  ShieldCheck,
} from 'lucide-react';
import { PilotRequestForm } from './PilotRequestForm';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'For Employers — VitalCV',
  description:
    'See which candidates are ready before day one. Free 30-day pilot with your real clinician roster. No commitment required.',
};

const PILOT_SCOPE = [
  {
    title: 'What this pilot is',
    body:
      'A free 30-day readiness check on 10–30 of your real clinician candidates. You get a clear report on who is ready, who has gaps, and what is missing — before your credentialing team opens a single file.',
    icon: <Presentation className="h-4 w-4" aria-hidden />,
  },
  {
    title: 'What you provide',
    body:
      'A roster of 10–30 clinician NPIs, a named review operator, and your current baseline numbers (time-to-start days, applications per month) — or an honest "we don’t track this yet" so we can capture it from scratch.',
    icon: <ListTodo className="h-4 w-4" aria-hidden />,
  },
  {
    title: 'What VitalCV measures',
    body:
      'Identity against NPPES. Federal exclusion against OIG. Medicare enrollment via PECOS. Each candidate gets a clear status: ready, incomplete, or flagged — with source cited.',
    icon: <ActivitySquare className="h-4 w-4" aria-hidden />,
  },
  {
    title: 'What success looks like',
    body:
      'Your team spends zero time on basic registry lookups. Candidates with issues surface before they show up on day one. Candidates who are clean move faster. That gap is where VitalCV lives.',
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
  },
] as const;

const LIMITATION_HONESTY = [
  'NPPES confirms NPI registration — it does not replace state licensure verification.',
  'OIG covers federal exclusion only — state Medicaid exclusion lists are not yet included.',
  'PECOS reflects public data — not the live real-time enrollment portal.',
  'State board license checks require per-state agreements — coverage varies.',
  'VitalCV surfaces readiness signals. It does not replace your credentialing committee.',
  'Partial data stays partial. We tell you what we can confirm — and what we cannot.',
] as const;

const PILOT_KPI_SAMPLES = [
  {
    label: 'Time to first readiness signal',
    value: '< 2 min',
    note: 'Internal benchmark · not a customer result',
  },
  {
    label: 'Federal registries checked',
    value: '3',
    note: 'NPPES · OIG · PECOS',
  },
  {
    label: 'Candidates per pilot',
    value: '10–30',
    note: 'NPI list is all you provide',
  },
  {
    label: 'Cost to start',
    value: '$0',
    note: 'Free 30-day pilot, no commitment',
  },
] as const;

const PROOF_OBJECT_LIVE = [
  'Identity confirmed against NPPES',
  'Federal exclusion checked against OIG',
  'Medicare enrollment status via PECOS',
  'Per-candidate readiness status: clear, incomplete, or flagged',
] as const;

const PROOF_OBJECT_PARTIAL = [
  'State board license verification (per-state agreements required)',
  'Payer enrollment and organization credentialing checks',
  'Continuous monitoring and re-check alerts',
  'ATS integration and bulk roster upload',
] as const;

const TRUST_CONTAINER_SAFE_COPY = [
  'Records the evidence packet’s credential envelope and artifact status.',
  'OIG covers federal exclusion — not state Medicaid lists.',
  'PECOS reflects public data — not the live portal.',
  'State board coverage varies by state.',
  'VitalCV does not replace your credentialing committee.',
] as const;

export default function PilotPage() {
  return (
    <main className="bg-background px-6 py-16 text-foreground" data-testid="pilot-proof-page">
      <div className="mx-auto max-w-5xl space-y-12">
        {/* Headline + value prop */}
        <header className="space-y-4">
          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Employer pilot
          </span>
          <h1
            className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground/90"
            data-testid="pilot-headline"
          >
            Know which candidates are ready before day one.
          </h1>
          <p
            className="max-w-3xl text-lg leading-8 text-muted-foreground"
            data-testid="pilot-value-prop"
          >
            VitalCV checks your candidates against federal registries and gives
            you a clear readiness signal — who is clean, who has gaps, what is
            missing — before your credentialing team opens a single file. No
            integration required. Free 30-day pilot.
          </p>
        </header>

        {/* KPI snapshot — honest labels only */}
        <section
          aria-label="Pilot KPI snapshot"
          data-testid="pilot-kpi-snapshot"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {PILOT_KPI_SAMPLES.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-border/60 bg-muted/20 p-5"
              data-testid={`pilot-kpi-${kpi.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {kpi.label}
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {kpi.value}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mt-1 font-mono">
                {kpi.note}
              </div>
            </div>
          ))}
        </section>

        {/* Pilot scope + buyer requirements */}
        <section className="grid gap-4 md:grid-cols-2" aria-label="Pilot scope">
          {PILOT_SCOPE.map((step) => (
            <article
              key={step.title}
              className="rounded-2xl border border-border/70 bg-card p-6"
            >
              <div className="mb-4 inline-flex rounded-full bg-emerald-500/10 p-2.5 text-emerald-400">
                {step.icon}
              </div>
              <h3 className="text-xl font-semibold text-foreground/90">{step.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </article>
          ))}
        </section>

        {/* Proof object explanation */}
        <section
          aria-label="Proof pack explanation"
          data-testid="pilot-proof-object"
          className="rounded-2xl border border-border bg-card p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="h-6 w-6 text-indigo-500" aria-hidden />
            <h2 className="text-2xl font-semibold text-foreground/90">What we check</h2>
          </div>
          <p className="text-muted-foreground text-base leading-relaxed max-w-3xl mb-6">
            For each candidate NPI, VitalCV runs three federal checks: NPPES identity,
            OIG federal exclusion, and PECOS Medicare enrollment. Results are
            clear, sourced, and available in under two minutes.
          </p>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-3" data-testid="pilot-live-now">
              <div className="font-semibold text-foreground">What is live now</div>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                {PROOF_OBJECT_LIVE.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-3" data-testid="pilot-partial-pending">
              <div className="font-semibold text-foreground">
                What remains partial or pending
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                {PROOF_OBJECT_PARTIAL.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Trust container explanation — separate from proof object, overclaim-safe */}
        <section
          aria-label="Trust container explanation"
          data-testid="pilot-trust-container"
          className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <FileLock2 className="h-6 w-6 text-indigo-400" aria-hidden />
            <h2 className="text-2xl font-semibold text-foreground/90">
              The trust container
            </h2>
          </div>
          <p className="text-muted-foreground text-base leading-relaxed max-w-3xl mb-4">
            Each check is source-attributed and timestamped. You see exactly what was checked and when.
          </p>
          <ul
            className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground"
            data-testid="pilot-trust-container-disclaimers"
          >
            {TRUST_CONTAINER_SAFE_COPY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        {/* Limitation honesty */}
        <section
          aria-label="Limitation honesty"
          data-testid="pilot-limitations"
          className="rounded-2xl border border-border bg-muted/30 p-6 md:p-8"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
            Limitation honesty
          </h2>
          <ul className="space-y-3 pl-2">
            {LIMITATION_HONESTY.map((item) => (
              <li
                key={item}
                className="text-base text-muted-foreground leading-relaxed flex gap-3"
              >
                <span className="text-amber-500/50 mt-1" aria-hidden>
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Pilot CTA */}
        <section
          aria-label="Request pilot"
          data-testid="pilot-cta"
          className="rounded-3xl border border-emerald-400/30 bg-emerald-500/5 p-6 md:p-10 shadow-sm"
        >
          <div className="grid lg:grid-cols-2 gap-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-500">
                The next step
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground/90">
                Request a 30-day PSV readiness pilot
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground max-w-md">
                We review every submission within two business days. If the
                scope is a fit, we schedule a scoping call to confirm your
                baseline metrics, the pilot NPIs, and the measurement window.
              </p>
              <p className="mt-4 text-sm text-muted-foreground/80">
                No auto-provisioning. You will see a signed scope document
                before anything is measured.
              </p>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <PilotRequestForm sourceContext="/pilot" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
