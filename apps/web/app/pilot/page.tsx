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
import { ArtifactStage } from '@/components/motion/ArtifactStage';
import { MeasureArtifact } from '@/components/artifacts/PageArtifacts';
import { SOURCE_LANE_OPS, getLaneDisplayName } from '@/lib/trust/sourceLanes';

/**
 * Automated lanes, counted from the canonical registry rather than typed by
 * hand.
 *
 * This page published `Automated source lanes: 4` with the note
 * "NPPES · OIG LEIE · PECOS public · state-board adapter" while, forty lines
 * lower, listing "Configured state-board PSV adapters" under what remains
 * PARTIAL — and while /api/status, /status and /status/technical all published
 * state_license as `pending_integration`. The buyer-facing headline counted a
 * lane the rest of the product calls unavailable.
 *
 * Counting `operational` lanes from SOURCE_LANE_OPS makes that overclaim
 * unrepresentable: a lane appears here only once the registry says it answers.
 */
const AUTOMATED_LANES = SOURCE_LANE_OPS.filter(
  (lane) => lane.statusApiStatus === 'operational',
);
const AUTOMATED_LANE_NAMES = AUTOMATED_LANES.map((lane) =>
  getLaneDisplayName(lane.laneId),
).join(' · ');

/**
 * Export formats, stated once. The page said `JSON · ZIP · PDF` in the metric
 * strip and "(JSON and ZIP)" in the live-capability list — a self-contradiction
 * in one view. PDF is real (`/api/export/packet` renders one via
 * `renderEmployerProofPacketPdf` and returns `application/pdf`), so the
 * capability list was the stale half. One constant now feeds both.
 */
const EXPORT_FORMATS = ['JSON', 'ZIP', 'PDF'] as const;
const EXPORT_FORMATS_LABEL = EXPORT_FORMATS.join(' · ');
const EXPORT_FORMATS_PROSE = `${EXPORT_FORMATS.slice(0, -1).join(', ')} and ${EXPORT_FORMATS.at(-1)}`;

export const metadata: Metadata = {
  title: 'Clinician Hire-to-Start Pilot',
  description:
    'Run a scoped clinician hire-to-start pilot from clinician-controlled application to employer-confirmed first day while your ATS and credentialing authority remain in place.',
};

const PILOT_SCOPE = [
  {
    title: 'What this pilot is',
    body:
      'A free, signed-scope health-system pilot for real employed-physician or APP cases in no more than two service lines. Scope, data access, operators, and measurement are agreed before work starts.',
    icon: <Presentation className="h-4 w-4" aria-hidden />,
  },
  {
    title: 'What you provide',
    body:
      'Real opportunities, authorized employer operators, the clinicians’ knowing participation, and your current ATS and credentialing workflow — plus baseline data when it exists or an explicit "not tracked" when it does not.',
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
      'An authorized employer records the actual first day, with the exact application packet, decisions, remaining requirements, blocker owners, and milestone history still inspectable. VitalCV does not replace your credentialing committee or institutional authority.',
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
    value: String(AUTOMATED_LANES.length),
    note: AUTOMATED_LANE_NAMES,
  },
  {
    label: 'Proof-pack export formats',
    value: EXPORT_FORMATS_LABEL,
    note: 'Manifest references in every export',
    token: true,
  },
  {
    label: 'Audit record per export',
    value: 'ARTIFACT_EXPORTED',
    note: 'Records an audit event before the bundle returns',
    token: true,
  },
] as const;

const PROOF_OBJECT_LIVE = [
  'NPPES, OIG LEIE, and PECOS public checks with canonical source coverage',
  `Proof-pack exports (${EXPORT_FORMATS_PROSE}) with deterministic artifact hashing`,
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
  'The pilot does not issue production credentials.',
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
              Pilot the clinician hire-to-start case,{' '}
              <span className="mz-accent">through the confirmed first day.</span>
            </h1>
            <p className="mz-lede max-w-3xl" data-testid="pilot-value-prop">
              {/* Was the literal word "four" — the same overclaim as the metric
                  strip, in the first sentence a buyer reads. Counted from the
                  registry so the lede can never outrun the lanes.

                  "deterministic proof pack" and "auditable trust container" were
                  also here. Both are accurate and both are OUR words, not the
                  buyer's: a credentialing lead does not arrive looking for a
                  container. The mechanism is unchanged and still stated below —
                  it just no longer occupies the first sentence. */}
              VitalCV is the Clinician Hire-to-Start Platform. It joins a
              clinician-controlled application, employer decisions, remaining
              requirements, and the employer-confirmed first day. Keep your ATS,
              credentialing platform, and institutional authority; this pilot
              connects the case between them.
            </p>
          </Reveal>
        </header>

        {/* The page's animated artifact: the span the pilot exists to measure —
            offer to first day, at-risk days bracketed, and deliberately no
            numbers anywhere (projection-vs-measurement rule: the drawing must
            not pre-announce a result nothing has measured). */}
        <section aria-label="What the pilot measures" data-testid="pilot-measure-artifact">
          <ArtifactStage glass>
            <MeasureArtifact />
          </ArtifactStage>
        </section>

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
              {/* System tokens (event names, format lists) render as mono at a
                  size that stays inside the tile; numbers keep the big stat cut. */}
              <div
                className={
                  'token' in kpi && kpi.token
                    ? 'mz-mono text-[1.05rem] font-semibold leading-snug tracking-[0.01em] text-[var(--vt-text-primary)] [overflow-wrap:anywhere]'
                    : 'text-[1.7rem] font-semibold leading-none tracking-tight text-[var(--vt-text-primary)] [font-variant-numeric:tabular-nums]'
                }
              >
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
              className="mz-glass mz-glass-interactive rounded-[12px] p-5"
            >
              <div className="mz-pop mb-4 inline-flex rounded-[3px] border border-[var(--rule)] bg-[var(--paper-2)] p-2.5 text-[var(--accent)]">
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
            {/* Was: "provider-pluggable — a deterministic mock today and a
                production-provider scaffold ready for future wiring." That is
                implementation vocabulary on a buyer page, and "mock" reads to a
                credentialing lead as "the evidence is fake" rather than what it
                means (issuance is not wired). The limitation is unchanged and
                stated more plainly. */}
            The trust container is a backend record that binds the credential
            envelope id, artifact status, and issuer metadata to the proof pack.
            During the pilot it records and references evidence; it does not
            issue production credentials.
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
