import type { Metadata } from 'next';
import Link from 'next/link';

import { PilotRequestForm } from './PilotRequestForm';
import { Icon, type IconName } from '@/components/Icon';
import { PageFrame } from '@/components/layout/PageFrame';
import { ActivationPath } from '@/components/onboarding/ActivationPath';
import { VisualScene } from '@/components/visual-scene/VisualScene';
import { SOURCE_LANE_OPS, getLaneDisplayName } from '@/lib/trust/sourceLanes';

export const metadata: Metadata = {
  title: 'Start a Pilot',
  description:
    'Measure the real path from clinician NPI to CV Wallet, opportunity, exact packet, employer response, and actual start without replacing institution review.',
};

const AUTOMATED_LANES = SOURCE_LANE_OPS.filter(
  (lane) => lane.statusApiStatus === 'operational',
);
const AUTOMATED_LANE_NAMES = AUTOMATED_LANES.map((lane) =>
  getLaneDisplayName(lane.laneId),
).join(' · ');

const EXPORT_FORMATS = ['JSON', 'ZIP', 'PDF'] as const;
const EXPORT_FORMATS_LABEL = EXPORT_FORMATS.join(' · ');
const EXPORT_FORMATS_PROSE = `${EXPORT_FORMATS.slice(0, -1).join(', ')} and ${EXPORT_FORMATS.at(-1)}`;

const PILOT_INPUTS = [
  {
    title: 'A bounded cohort',
    body: 'Bring 10–30 real clinician NPIs. We agree on which applications and roles belong in the measurement window before it begins.',
    icon: 'list-checks',
  },
  {
    title: 'A named human operator',
    body: 'One reviewer owns the employer response for every application submitted in the cohort. The pilot does not substitute an automated employment decision.',
    icon: 'building',
  },
  {
    title: 'The baseline you actually have',
    body: 'Share your current timeline and request counts—or say “we do not track this yet” so the pilot records a clean starting point.',
    icon: 'clock',
  },
] as const satisfies readonly { title: string; body: string; icon: IconName }[];

const MEASUREMENT_MOMENTS = [
  ['Packet submitted', 'The clinician-selected version and consent become the measurement anchor.', 'send'],
  ['Packet opened', 'The first employer view is recorded separately from submission.', 'file-search'],
  ['Clarification requested', 'Every missing-information request keeps its owner and time.', 'message-question'],
  ['Employer response', 'Clarify, accept as a head start, or do not proceed—never an inferred decision.', 'building'],
  ['Credentialing started', 'Institution review beginning is not the same event as an offer or start.', 'list-checks'],
  ['Actual start attested', 'The first day is measured only when the relevant party records it.', 'waypoints'],
] as const satisfies readonly (readonly [string, string, IconName])[];

const LIMITATION_HONESTY = [
  'NPPES confirms a public registry record only; it does not prove identity possession or licensure.',
  'OIG/LEIE covers the federal exclusion list. It does not stand in for state Medicaid exclusion sources.',
  'PECOS uses the public quarterly release, not the real-time enrollment portal.',
  'Licensure remains access-gated until an authorized production source returns a result.',
  'An employer accepting one exact packet as a head start is not credentialing, privileging, employment, or start.',
  'If the measured workflow avoids zero employer requests, the report says zero instead of manufacturing a success story.',
] as const;

function laneStanding(lifecycle: string, cadence: string): string {
  if (lifecycle === 'active') return `Read · ${cadence}`;
  if (lifecycle === 'planned') return `Not read · ${cadence}`;
  if (lifecycle === 'demo_only') return 'Demonstration only';
  return 'Not integrated';
}

export default function PilotPage() {
  const readinessLanes = SOURCE_LANE_OPS.filter((lane) => lane.readinessDimension !== null);

  return (
    <div className="mz mz-paper mz-persona-employer min-h-screen overflow-x-clip" data-testid="pilot-proof-page">
      <PageFrame as="main" mode="marketing" className="pb-14 sm:pb-20">
        <header className="grid gap-9 border-b border-[var(--vt-border)] pb-10 pt-3 lg:grid-cols-[minmax(0,0.82fr)_minmax(32rem,1.18fr)] lg:items-center lg:gap-12 lg:pb-14">
          <div>
            <p className="mz-eyebrow">Measured employer pilot</p>
            <h1 className="mz-h1 mt-3 max-w-3xl" data-testid="pilot-headline">
              Prove the handoff. <span className="mz-accent">Measure what actually moves.</span>
            </h1>
            <p className="mz-lede mt-5 max-w-2xl" data-testid="pilot-value-prop">
              Follow a real cohort from NPI to CV Wallet, first opportunity, exact packet, employer response, and actual start—without changing who makes the institutional decision.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="#pilot-request" className="mz-btn min-h-12 justify-center">
                Request a measured pilot
              </Link>
              <Link
                href="#pilot-activation-path"
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-[var(--vt-border)] px-5 text-sm font-semibold text-[var(--vt-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--vt-focus-ring)]"
              >
                See the activation path
                <Icon name="arrow-down" className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-5 max-w-2xl border-l-2 border-[var(--vt-border)] pl-3 font-mono text-[11px] leading-relaxed text-[var(--vt-text-muted)]">
              Pilot target—not a published result: every application submitted in the cohort receives a human employer response, and every result includes its cohort, baseline, period, sample size, and lineage.
            </p>
          </div>

          <div className="min-w-0">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
              Illustration — not a live clinician, application, or outcome
            </p>
            <VisualScene
              scene="activation_path"
              kind="process"
              priority="hero"
              className="overflow-hidden border border-[var(--vt-border)] bg-[var(--vt-surface)] [&_figcaption]:border-t [&_figcaption]:border-[var(--vt-border)] [&_figcaption]:px-4 [&_figcaption]:py-3 [&_figcaption]:font-mono [&_figcaption]:text-[10px] [&_figcaption]:leading-relaxed [&_figcaption]:text-[var(--vt-text-muted)]"
            />
          </div>
        </header>

        <div id="pilot-activation-path" className="scroll-mt-28 pt-14 sm:pt-20">
          <ActivationPath audience="pilot" heading="The same record stays visible from entry to response." />
        </div>

        <section aria-label="Source states in the pilot" className="mt-16 sm:mt-20">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.7fr)_minmax(32rem,1.3fr)] lg:items-end">
            <div>
              <p className="mz-eyebrow">Source states in view</p>
              <h2 className="mz-h2 mt-2">
                Start with what sources can <span className="mz-accent">support today.</span>
              </h2>
            </div>
            <p className="mz-small max-w-2xl lg:justify-self-end">
              {AUTOMATED_LANES.length} active source reads: {AUTOMATED_LANE_NAMES}. Access-gated and unavailable sources remain visible rather than being upgraded by the pilot.
            </p>
          </div>
          <ul className="mt-7 grid list-none border-l border-t border-[var(--vt-border)] sm:grid-cols-2 lg:grid-cols-4">
            {readinessLanes.map((lane) => (
              <li key={lane.laneId} className="min-h-32 border-b border-r border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 sm:p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-muted)]">
                  {lane.readinessDimension}
                </p>
                <h3 className="mt-5 text-base font-semibold text-[var(--vt-text-primary)]">
                  {lane.marketingShortName}
                </h3>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--vt-text-secondary)]">
                  {laneStanding(lane.lifecycle, lane.cadenceLabel)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="What the pilot measures" data-testid="pilot-kpi-snapshot" className="mt-16 sm:mt-20">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(32rem,1.28fr)] lg:items-end">
            <div>
              <p className="mz-eyebrow">No proxy metric</p>
              <h2 className="mz-h2 mt-2">
                Measure the moments. <span className="mz-accent">Do not pre-announce the result.</span>
              </h2>
            </div>
            <p className="mz-small max-w-2xl lg:justify-self-end">
              Offer acceptance, credentialing start, intended start, and actual start remain distinct events. A faster-looking intermediate state is never relabelled as a start.
            </p>
          </div>
          <ol className="mt-7 grid list-none border-l border-t border-[var(--vt-border)] md:grid-cols-2 xl:grid-cols-3">
            {MEASUREMENT_MOMENTS.map(([title, body, icon]) => (
              <li key={title} className="grid min-h-36 grid-cols-[2.75rem_1fr] gap-3 border-b border-r border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 sm:p-5">
                <span className="inline-flex size-11 items-center justify-center border border-[var(--vt-border)] font-mono text-xs text-[var(--vt-text-muted)]" aria-hidden="true">
                  <Icon name={icon} className="size-5" strokeWidth={1.5} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--vt-text-primary)]">{title}</h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Pilot inputs and limits" className="mt-16 grid gap-8 border-y border-[var(--vt-border)] py-8 sm:mt-20 lg:grid-cols-2 lg:gap-12 lg:py-10">
          <div data-testid="pilot-proof-object">
            <p className="mz-eyebrow">What you bring</p>
            <h2 className="mz-h2 mt-2">A real cohort and an honest baseline.</h2>
            <div className="mt-6 divide-y divide-[var(--vt-border)] border-y border-[var(--vt-border)]">
              {PILOT_INPUTS.map((item) => (
                <div key={item.title} className="grid grid-cols-[2.5rem_1fr] gap-3 py-4">
                  <span className="inline-flex size-9 items-center justify-center border border-[var(--vt-border)] text-[var(--vt-text-muted)]" aria-hidden="true">
                    <Icon name={item.icon} className="size-4" strokeWidth={1.5} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--vt-text-primary)]">{item.title}</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div data-testid="pilot-trust-container">
            <p className="mz-eyebrow">The limits travel with the report</p>
            <h2 className="mz-h2 mt-2">A partial proof stays partial.</h2>
            <details open className="mt-6 border-y border-[var(--vt-border)] py-4" data-testid="pilot-limitations">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold text-[var(--vt-text-primary)]">
                Read the measurement and source boundaries
              </summary>
              <ul className="mt-3 space-y-3 pl-5 text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
                {LIMITATION_HONESTY.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </details>
            <p className="mt-4 font-mono text-[10px] leading-relaxed text-[var(--vt-text-muted)]">
              Integrity support: {EXPORT_FORMATS_LABEL} exports preserve source coverage, freshness, limitation notes, and the sealed-submission hash. ARTIFACT_EXPORTED is recorded before {EXPORT_FORMATS_PROSE} bytes return. The pilot does not issue production credentials.
            </p>
          </div>
        </section>

        <section id="pilot-request" aria-label="Request pilot" data-testid="pilot-cta" className="scroll-mt-28 mt-16 grid gap-8 border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6 sm:mt-20 sm:p-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:p-10">
          <div>
            <p className="mz-eyebrow">One next action</p>
            <h2 className="mz-h2 mt-3">Scope the cohort before anything is measured.</h2>
            <p className="mz-small mt-4 max-w-md">
              We review the request, confirm the baseline, cohort, employer-response owner, and measurement window, then provide a signed scope. No auto-provisioning and no payment collection on this page.
            </p>
          </div>
          <div className="border-t border-[var(--vt-border)] pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <PilotRequestForm sourceContext="/pilot" />
          </div>
        </section>
      </PageFrame>
    </div>
  );
}
