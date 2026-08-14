import type { Metadata } from 'next';
import Link from 'next/link';

import { Icon, type IconName } from '@/components/Icon';
import { EmployerAudienceSection } from '@/components/employers/EmployerAudienceSection';
import { EmployerWorkflowPreview } from '@/components/employers/EmployerWorkflowPreview';
import { PageFrame } from '@/components/layout/PageFrame';
import { VisualScene } from '@/components/visual-scene/VisualScene';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

// Bound external shared-cache staleness to five minutes.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'For Employers',
  description:
    'Review the exact clinician-selected submission, ask for clarification, and record a head-start decision while institution authority remains yours.',
};

/** Lane-truth cadences, from the registry — never hand-typed on this page. */
function cadenceSentence(): string {
  const label = (id: string) =>
    SOURCE_LANE_OPS.find((lane) => lane.laneId === id)?.cadenceLabel ?? 'not read';
  return (
    `NPPES is ${label('nppes_identity')} per request; ` +
    `OIG/LEIE is a ${label('oig_exclusions')}; CMS PECOS a ${label('pecos_enrollment')}; ` +
    `state licensure stays ${label('state_license')}.`
  );
}

function laneStanding(lifecycle: string, cadence: string): string {
  if (lifecycle === 'active') return `Read · ${cadence}`;
  if (lifecycle === 'planned') return `Not read · ${cadence}`;
  if (lifecycle === 'demo_only') return 'Demonstration only';
  return 'Not integrated';
}

const REVIEW_TRUTHS = [
  {
    title: 'Inspect the submission',
    body: 'The employer and clinician read the same submitted version. Current evidence stays visibly separate.',
    icon: 'file-search',
  },
  {
    title: 'Ask what remains open',
    body: 'Clarification is a recorded next step, not a hidden rejection or an invented answer.',
    icon: 'message-question',
  },
  {
    title: 'Keep institution authority',
    body: 'A head-start acceptance records scope. Credentialing, privileging, hiring, and start remain your decisions.',
    icon: 'scale',
  },
] as const satisfies readonly { title: string; body: string; icon: IconName }[];

export default function EmployersPage() {
  return (
    <div className="mz mz-paper mz-persona-employer min-h-screen overflow-x-clip">
      <PageFrame as="main" mode="marketing" className="pb-14 sm:pb-20">
        <header className="grid gap-9 border-b border-[var(--vt-border)] pb-10 pt-3 lg:grid-cols-[minmax(0,0.82fr)_minmax(32rem,1.18fr)] lg:items-center lg:gap-12 lg:pb-14">
          <div>
            <p className="mz-eyebrow">For employers &amp; verifiers</p>
            <h1 className="mz-h1 mt-3 max-w-3xl">
              Review the exact packet. <span className="mz-accent">Keep the decision yours.</span>
            </h1>
            <p className="mz-lede mt-5 max-w-2xl">
              See what the clinician chose to share, where each fact came from, and what remains open. Ask for clarification or accept it as a head start.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/employers/request-access" className="mz-btn min-h-12 justify-center">
                Request organization access
              </Link>
              <Link
                href="#employer-review-journey"
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-[var(--vt-border)] px-5 text-sm font-semibold text-[var(--vt-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--vt-focus-ring)]"
              >
                See the review journey
                <Icon name="arrow-down" className="size-4" aria-hidden="true" />
              </Link>
            </div>

            <p className="mt-5 max-w-2xl border-l-2 border-[var(--vt-border)] pl-3 font-mono text-[11px] leading-relaxed text-[var(--vt-text-muted)]">
              Organization access is the doorway in, not the product. A Type 2 NPI identifies an organization; it is not authority to act for it, and access is granted separately.
            </p>
          </div>

          <div className="min-w-0">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
              Illustration — not a live submission or decision
            </p>
            <VisualScene
              scene="employer_desk"
              kind="process"
              priority="hero"
              className="overflow-hidden border border-[var(--vt-border)] bg-[var(--vt-surface)] [&_figcaption]:border-t [&_figcaption]:border-[var(--vt-border)] [&_figcaption]:px-4 [&_figcaption]:py-3 [&_figcaption]:font-mono [&_figcaption]:text-[10px] [&_figcaption]:leading-relaxed [&_figcaption]:text-[var(--vt-text-muted)]"
            />
          </div>
        </header>

        <section
          aria-label="Where human review happens"
          className="mt-12 grid overflow-hidden border border-[var(--vt-border)] bg-[var(--vt-surface)] lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]"
        >
          <VisualScene
            scene="journey_film"
            kind="process"
            routeVariant="employers_documentary"
            priority="inline"
            className="min-w-0 [&_figcaption]:border-t [&_figcaption]:border-[var(--vt-border)] [&_figcaption]:px-4 [&_figcaption]:py-3 [&_figcaption]:font-mono [&_figcaption]:text-[10px] [&_figcaption]:leading-relaxed [&_figcaption]:text-[var(--vt-text-muted)] lg:[&_figcaption]:border-b-0 lg:[&_figcaption]:border-r"
          />

          <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
            <p className="mz-eyebrow">Where review begins</p>
            <h2 className="mz-h2 mt-3 max-w-xl">
              Give every team the same <span className="mz-accent">reviewable record.</span>
            </h2>
            <div className="mt-7 divide-y divide-[var(--vt-border)] border-y border-[var(--vt-border)]">
              {REVIEW_TRUTHS.map(({ title, body, icon }) => (
                <div key={title} className="grid grid-cols-[3rem_1fr] gap-4 py-4">
                  <span className="inline-flex size-11 items-center justify-center border border-[var(--vt-border)] text-[var(--vt-accent-editorial)]">
                    <Icon name={icon} className="size-5" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--vt-text-primary)]">{title}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div
          data-employer-limits=""
          className="mt-6 grid gap-3 border-l-2 border-[var(--vt-border)] pl-4 font-mono text-[11px] leading-relaxed text-[var(--vt-text-muted)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-8"
        >
          <p>
            The limits, stated plainly: VitalCV is not a credentialing service, and the hiring decision stays yours. {cadenceSentence()}
          </p>
          <Link
            href="/trust/attribution"
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--vt-text-primary)] underline underline-offset-2"
          >
            Read the source register
            <Icon name="arrow-right" className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <EmployerWorkflowPreview />

        <section aria-label="What arrives, source by source" className="mt-16 sm:mt-20">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(32rem,1.28fr)] lg:items-end">
            <div>
              <p className="mz-eyebrow">Source posture, in view</p>
              <h2 className="mz-h2 mt-2">
                Every lane says what it can—and <span className="mz-accent">cannot—support.</span>
              </h2>
            </div>
            <p className="mz-small max-w-2xl lg:justify-self-end">
              This register is read from the same source-lane contract that drives status. A missing or access-gated source stays missing or access-gated.
            </p>
          </div>

          <ul className="mt-7 grid list-none border-l border-t border-[var(--vt-border)] sm:grid-cols-2 lg:grid-cols-3">
            {SOURCE_LANE_OPS.map((lane) => (
              <li
                key={lane.laneId}
                className="min-h-32 border-b border-r border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 sm:p-5"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-muted)]">
                  Evidence lane
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

          <p className="mt-5">
            <Link
              href="/employers/how-it-works"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--vt-text-primary)] underline underline-offset-2"
            >
              Inspect every lane and the illustrative record anatomy
              <Icon name="arrow-right" className="size-4" aria-hidden="true" />
            </Link>
          </p>
        </section>

        <EmployerAudienceSection />

        <section
          aria-label="What this costs"
          data-employer-pricing=""
          className="mt-16 grid gap-5 border-y border-[var(--vt-border)] py-7 sm:mt-20 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] sm:py-9"
        >
          <div>
            <p className="mz-eyebrow">Commercial boundary</p>
            <h2 className="mz-h2 mt-2">No checkout theatre.</h2>
          </div>
          <p className="mz-small max-w-2xl">
            Free for clinicians, always. For organizations: no payment is collected on this site—the pilot costs nothing, and commercial terms are set in a signed scope. When VitalCV charges employers, it charges for outcomes—clinicians who start—not seats or lookups.{' '}
            <Link
              href="/pricing"
              className="font-semibold text-[var(--vt-text-primary)] underline underline-offset-2"
            >
              Read the plain terms
            </Link>
          </p>
        </section>

        <section
          className="mt-12 grid gap-7 border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10"
          aria-label="Request organization access"
        >
          <div>
            <p className="mz-eyebrow">Start with governed access</p>
            <h2 className="mz-h2 mt-2">Bring the submitted record to your review team.</h2>
            <p className="mz-small mt-3 max-w-2xl">
              Resolve the organization against the federal registry, then request access. Identity is the beginning of the request—not authority to act.
            </p>
          </div>
          <Link href="/employers/request-access" className="mz-btn min-h-12 justify-center">
            Request organization access
          </Link>
        </section>

        <p className="mt-6 text-center text-xs text-[var(--vt-text-muted)]">
          A network or health system?{' '}
          <Link href="/pilot" className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
            Request a pilot
          </Link>{' '}
          · Already set up?{' '}
          <Link href="/employer/dashboard" className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
            Open your workspace
          </Link>
        </p>
      </PageFrame>
    </div>
  );
}
