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
import { Reveal } from '@/components/motion/Reveal';

export const metadata: Metadata = {
  title: 'Start a Pilot',
  description:
    'Run a 30-day focused employer pilot for credential readiness decisions using VitalCV primary source verification and proof packs.',
};

const PILOT_SCOPE = [
  {
    title: 'What this pilot is',
    body:
      'A 30-day focused employer pilot. We measure startability timeline events against your current workflow on 10–30 real clinician NPIs and hand you a signed scope document before any measurement starts.',
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
      'Submit → first view → first action → advanced → start-ready → started timeline deltas, refresh and missing-info request counts with owner attribution, and proof-tier distribution at submit time.',
    icon: <ActivitySquare className="h-4 w-4" aria-hidden />,
  },
  {
    title: 'What success looks like',
    body:
      'You see documented source coverage, packet status, and limitation notes per clinician before the formal committee process. We do not replace your credentialing committee — we shorten the days-at-risk window before committee review.',
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
  },
] as const;

const LIMITATION_HONESTY = [
  'NPPES identity checks confirm NPI registration only; they do not replace licensure proof.',
  'OIG LEIE covers federal exclusion scope only; state Medicaid exclusion lists are out of scope until they are adapter-connected.',
  'PECOS public data reflects the public release, not the real-time enrollment portal.',
  'State board coverage depends on institutional access agreements; uninstrumented states remain an adapter gap, not a verified claim.',
  'The trust container records packet metadata and artifact status; it does not replace Primary Source Verification (PSV).',
  'A partial proof stays partial. Container issuance never upgrades partial evidence to decision-grade.',
] as const;

const PILOT_KPI_SAMPLES = [
  {
    label: 'Avg time to first signal',
    value: '1.8 min',
    note: 'Internal simulation · not a customer pilot result',
  },
  {
    label: 'Automated source lanes',
    value: '4',
    note: 'NPPES · OIG LEIE · PECOS public · state-board adapter',
  },
  {
    label: 'Proof-pack export formats',
    value: 'JSON · ZIP · PDF',
    note: 'Manifest references in every export',
  },
  {
    label: 'Audit record per export',
    value: 'ARTIFACT_EXPORTED',
    note: 'Records an audit event before the bundle returns',
  },
] as const;

const PROOF_OBJECT_LIVE = [
  'NPPES, OIG LEIE, and PECOS public checks with canonical source coverage',
  'Proof-pack exports (JSON and ZIP) with deterministic artifact hashing',
  'ARTIFACT_EXPORTED audit event every time a packet leaves the platform',
  'Partial-proof limitation notes preserved verbatim through every export',
] as const;

const PROOF_OBJECT_PARTIAL = [
  'Configured state-board PSV adapters for launch-state authority checks',
  'Additional payer and organization source adapters after source agreements',
  'Production credential-container issuance after provider configuration',
  'Continuous monitoring outside the configured pilot lanes',
] as const;

const TRUST_CONTAINER_SAFE_COPY = [
  'Records the evidence packet’s credential envelope and artifact status.',
  'Does not replace primary source verification.',
  'Does not upgrade partial evidence to decision-grade.',
  'Mock/dev containers are not production credentials.',
  'Limitations shown in the packet remain controlling.',
] as const;

export default function PilotPage() {
  return (
    <main
      className="mz mz-paper mz-persona-employer px-6 py-16"
      data-testid="pilot-proof-page"
    >
      <div className="mx-auto max-w-5xl space-y-12">
        {/* Headline + value prop */}
        <header className="mz-ambient">
          <Reveal variant="fade" className="space-y-5">
            <span className="mz-eyebrow">Employer pilot</span>
            <h1 className="mz-display" data-testid="pilot-headline">
              Cut credentialing uncertainty{' '}
              <span className="mz-accent">before the start date slips.</span>
            </h1>
            <p className="mz-lede max-w-3xl" data-testid="pilot-value-prop">
              VitalCV turns four source-backed lanes of clinician evidence into a
              deterministic proof pack and an auditable trust container, so your
              reviewers can see what is ready, what is missing, and what must
              wait for primary source verification — without changing your
              existing compliance stack.
            </p>
          </Reveal>
        </header>

        {/* KPI snapshot — honest labels only */}
        <section
          aria-label="Pilot KPI snapshot"
          data-testid="pilot-kpi-snapshot"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {PILOT_KPI_SAMPLES.map((kpi, i) => (
            <Reveal
              as="div"
              key={kpi.label}
              delay={i * 80}
              className="mz-glass mz-glass-interactive rounded-[12px] p-5"
              data-testid={`pilot-kpi-${kpi.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="mz-mono mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">
                {kpi.label}
              </div>
              <div className="text-[1.7rem] font-semibold leading-none tracking-tight text-[var(--vt-text-primary)] [font-variant-numeric:tabular-nums]">
                {kpi.value}
              </div>
              <div className="mz-mono mt-2 text-[10.5px] uppercase tracking-[0.1em] text-[var(--vt-text-muted)]">
                {kpi.note}
              </div>
            </Reveal>
          ))}
        </section>

        {/* Pilot scope + buyer requirements */}
        <section className="grid gap-4 md:grid-cols-2" aria-label="Pilot scope">
          {PILOT_SCOPE.map((step, i) => (
            <Reveal
              as="article"
              key={step.title}
              delay={i * 80}
              className="mz-card mz-card-pad mz-interactive"
            >
              <div className="mb-4 inline-flex rounded-[3px] border border-[var(--rule)] bg-[var(--paper-2)] p-2.5 text-[var(--accent)]">
                {step.icon}
              </div>
              <h3 className="mz-h2">{step.title}</h3>
              <p className="mz-body mt-2">
                {step.body}
              </p>
            </Reveal>
          ))}
        </section>

        {/* Proof object explanation */}
        <Reveal
          as="section"
          aria-label="Proof pack explanation"
          data-testid="pilot-proof-object"
          className="mz-card p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="h-6 w-6 text-[var(--accent)]" aria-hidden />
            <h2 className="mz-h1">
              The <span className="mz-accent">proof pack</span>
            </h2>
          </div>
          <p className="mz-body max-w-3xl mb-6">
            Every clinician review generates a deterministic evidence packet with
            canonical source coverage, per-lane freshness, and a sha256 artifact
            hash. When your reviewer exports the packet, VitalCV writes an
            ARTIFACT_EXPORTED audit event before the bytes leave the platform.
          </p>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-3" data-testid="pilot-live-now">
              <span className="mz-chip mz-chip-ok">
                <span className="mz-gl" aria-hidden />
                What is live now
              </span>
              <ul className="mz-body list-disc pl-5 space-y-1.5">
                {PROOF_OBJECT_LIVE.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-3" data-testid="pilot-partial-pending">
              <span className="mz-chip mz-chip-watch">
                <span className="mz-gl" aria-hidden />
                What remains partial or pending
              </span>
              <ul className="mz-body list-disc pl-5 space-y-1.5">
                {PROOF_OBJECT_PARTIAL.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        {/* Trust container explanation — separate from proof object, overclaim-safe */}
        <Reveal
          as="section"
          aria-label="Trust container explanation"
          data-testid="pilot-trust-container"
          className="mz-card p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <FileLock2 className="h-6 w-6 text-[var(--accent)]" aria-hidden />
            <h2 className="mz-h1">
              The trust container
            </h2>
          </div>
          <p className="mz-body max-w-3xl mb-4">
            The trust container is a hidden backend record that binds the
            credential envelope id, artifact status, and issuer metadata to the
            proof pack. It is provider-pluggable — a deterministic mock today
            and a production-provider scaffold ready for future wiring.
          </p>
          <ul
            className="mz-body list-disc pl-5 space-y-1.5"
            data-testid="pilot-trust-container-disclaimers"
          >
            {TRUST_CONTAINER_SAFE_COPY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Reveal>

        {/* Limitation honesty */}
        <Reveal
          as="section"
          aria-label="Limitation honesty"
          data-testid="pilot-limitations"
          className="mz-inset p-6 md:p-8"
        >
          <h2 className="mz-h2 flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-[var(--watch)]" aria-hidden />
            Limitation honesty
          </h2>
          <ul className="space-y-3 pl-2">
            {LIMITATION_HONESTY.map((item) => (
              <li
                key={item}
                className="mz-body flex gap-3"
              >
                <span className="text-[var(--watch)] mt-1" aria-hidden>
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* Pilot CTA */}
        <Reveal
          as="section"
          aria-label="Request pilot"
          data-testid="pilot-cta"
          className="mz-glass-strong p-6 md:p-10"
        >
          <div className="grid lg:grid-cols-2 gap-10">
            <div>
              <p className="mz-eyebrow">
                The next step
              </p>
              <h2 className="mz-h1 mt-3">
                Request a 30-day PSV{' '}
                <span className="mz-accent">readiness pilot</span>
              </h2>
              <p className="mz-lede mt-4 max-w-md">
                We review every submission within two business days. If the
                scope is a fit, we schedule a scoping call to confirm your
                baseline metrics, the pilot NPIs, and the measurement window.
              </p>
              <p className="mz-small mt-4">
                No auto-provisioning. You will see a signed scope document
                before anything is measured.
              </p>
            </div>

            <div className="mz-card p-6">
              <PilotRequestForm sourceContext="/pilot" />
            </div>
          </div>
        </Reveal>
      </div>
    </main>
  );
}
