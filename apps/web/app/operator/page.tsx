/**
 * /operator -- Pilot operator readiness workspace.
 *
 * Single calm operational surface for the receiving-institution
 * operator running a VitalCV pilot. Answers five questions at the
 * top, lists the attention queue + per-lane continuity + review
 * progress + institution-owned items + per-cohort readiness.
 *
 * Read-only. No backend writes, no external API calls. Fixtures
 * live in apps/web/lib/operator/operatorFixtures.ts.
 *
 * Six normalized visible states (binding):
 *   Ready · Pending review · Attention needed · Interrupted ·
 *   Continuing · Complete
 *
 * Substrate jargon (replay survivability, dedupe key, run-id,
 * issuer kid, etc.) is intentionally absent. If the operator needs
 * to inspect substrate detail, the existing /ops route is the
 * dedicated surface.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOperatorFixture } from '@/lib/operator/operatorFixtures';
import {
  OperatorAttentionQueue,
  ContinuityAttentionCard,
  ReviewProgressPanel,
  OperationalNextStepSummary,
  InstitutionalOwnershipPanel,
  ReadinessProgressStrip,
} from '@/components/operator';

export const metadata: Metadata = {
  title: 'Operator readiness · VitalCV',
  description:
    'Single calm operator workspace for a pilot cohort. Answers what needs attention, what is progressing, what is blocked, what happens next, and who owns the next step.',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams?: Promise<{ cohort?: string }>;
}

export default async function OperatorReadinessPage({ searchParams }: PageProps) {
  const { cohort = 'cedar' } = (await searchParams) ?? {};
  const fixture = getOperatorFixture(cohort);
  if (!fixture) notFound();

  const attentionCount = fixture.attentionQueue.length;
  const continuingCount = fixture.continuity.filter(
    (c) => c.state === 'continuing' || c.state === 'complete',
  ).length;
  const interruptedCount = fixture.continuity.filter(
    (c) => c.state === 'interrupted',
  ).length;
  const reviewsInFlight = fixture.reviews.filter(
    (r) => r.reviewStage === 'in_review' || r.reviewStage === 'queued',
  ).length;
  const operatorOwnedReviews = fixture.reviews.filter(
    (r) => r.reviewOwner === 'operator',
  ).length;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-900 bg-slate-950 px-5 py-5 text-slate-100">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          Operator workspace · receiver-side view
        </div>
        <h1 className="mt-1 text-xl font-semibold">{fixture.cohortLabel}</h1>
        <div className="mt-1 font-mono text-xs text-slate-300">
          {fixture.pilotWindow}
        </div>
        <p className="mt-3 max-w-[62ch] text-sm text-slate-200">
          A calm single-page reading of the pilot cohort. The five
          questions below summarize the workspace; the panels below
          surface the same information at lane / review / cohort
          resolution.
        </p>
      </header>

      <div className="mx-auto max-w-[1200px] space-y-5 px-4 py-6 sm:px-6">
        <OperationalNextStepSummary
          whatNeedsAttention={
            attentionCount === 0
              ? 'Nothing needs operator attention right now.'
              : `${attentionCount} item${attentionCount === 1 ? '' : 's'} in the attention queue, listed below with its next step and owner.`
          }
          whatIsProgressing={
            `${continuingCount} lane${continuingCount === 1 ? '' : 's'} continuing or complete; ${reviewsInFlight} review${reviewsInFlight === 1 ? '' : 's'} in flight with the receiving institution.`
          }
          whatIsBlocked={
            interruptedCount === 0
              ? 'No interrupted lanes; pending committee + state-board reviews remain on the institution\'s cadence (not "blocked", just institution-owned).'
              : `${interruptedCount} interrupted lane${interruptedCount === 1 ? '' : 's'}; the operator note travels with each and the institution still dispositions.`
          }
          whatHappensNext={
            operatorOwnedReviews > 0
              ? `${operatorOwnedReviews} review${operatorOwnedReviews === 1 ? '' : 's'} returned to the operator for follow-up; see the Review progress panel.`
              : 'No operator-owned follow-up; reviews continue on the receiving institution\'s cadence.'
          }
          whoOwnsTheNextStep={
            operatorOwnedReviews > 0 || attentionCount > 0
              ? 'Operator owns the next visible step. Institution-owned items below remain on the institution.'
              : 'Receiving institution owns the next visible step. Operator surfaces visibility, not control.'
          }
        />

        <OperatorAttentionQueue items={fixture.attentionQueue} />

        <section
          data-slot="operator-continuity-section"
          className="space-y-2"
        >
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
            Per-lane continuity
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fixture.continuity.map((lane) => (
              <ContinuityAttentionCard key={lane.id} lane={lane} />
            ))}
          </div>
        </section>

        <ReviewProgressPanel reviews={fixture.reviews} />

        <ReadinessProgressStrip items={fixture.readiness} />

        <InstitutionalOwnershipPanel items={fixture.institutionalOwnership} />

        <details
          data-slot="operator-progressive-disclosure"
          className="rounded-xl border border-slate-300 bg-white"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 hover:bg-slate-50">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Operator detail
              </div>
              <div className="mt-0.5 text-sm font-medium text-slate-900">
                Show substrate detail (replay continuity, signer health, source telemetry)
              </div>
              <div className="mt-0.5 text-xs text-slate-600 group-open:hidden">
                Substrate jargon lives behind this disclosure. Open it
                only when you need to inspect the underlying signals.
              </div>
            </div>
            <div className="font-mono text-xs text-slate-500">show / hide</div>
          </summary>
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p>
              The dedicated operator console lives at{' '}
              <Link href="/ops" className="underline">
                /ops
              </Link>
              . It surfaces signer health, replay continuity, source
              telemetry, doctrine honesty, and the verifier endpoints.
              This calm workspace deliberately does NOT duplicate that
              detail; opening /ops is the disclosure step.
            </p>
          </div>
        </details>

        <footer className="border-t border-dashed border-slate-300 pt-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Read-only workspace · receiving institution owns disposition ·
          no credential decision is issued from this page
        </footer>
      </div>
    </main>
  );
}
