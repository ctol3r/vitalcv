/**
 * /demo/pilot -- Pilot demonstration compression route.
 *
 * Single institutional demonstration flow. Composes the eight
 * narrative primitives shipped in this wave plus the existing
 * provenance navigation primitives (PR #386) into a coherent
 * receiver-side story.
 *
 * Sequence:
 *   1. DemoSequenceHeader        -- cohort + window + framing
 *   2. DeploymentReadinessNarrative -- cohort overview
 *   3. OperationalContinuityCard (per lane) -- evidence continuity
 *   4. CrossCheckNarrative       -- institution-owned confirmation
 *   5. ReplayImpactNarrative     -- what happens during interruption
 *   6. OperationalAccelerationPanel -- benefit + caveat
 *   7. InstitutionalWalkthrough  -- six questions, six answers
 *
 * The route is deliberately read-only. It does NOT initiate a real
 * exchange, write to any backend, or call any external API. Fixtures
 * live in `apps/web/lib/demo/demoFixtures.ts`.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDemoFixture } from '@/lib/demo/demoFixtures';
import { DemoSequenceHeader } from '@/components/demo/DemoSequenceHeader';
import { DeploymentReadinessNarrative } from '@/components/demo/DeploymentReadinessNarrative';
import { OperationalContinuityCard } from '@/components/demo/OperationalContinuityCard';
import { CrossCheckNarrative } from '@/components/demo/CrossCheckNarrative';
import { ReplayImpactNarrative } from '@/components/demo/ReplayImpactNarrative';
import { OperationalAccelerationPanel } from '@/components/demo/OperationalAccelerationPanel';
import { InstitutionalWalkthrough } from '@/components/demo/InstitutionalWalkthrough';

export const metadata: Metadata = {
  title: 'Pilot demonstration · VitalCV',
  description:
    'Institutional pilot demonstration. Read-only walkthrough of a federal-source resolution cohort, an independent cross-check lane, an operational acceleration panel, and an institutional walkthrough.',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams?: Promise<{ cohort?: string }>;
}

export default async function PilotDemonstrationPage({ searchParams }: PageProps) {
  const { cohort = 'cedar' } = (await searchParams) ?? {};
  const fixture = getDemoFixture(cohort);
  if (!fixture) notFound();

  return (
    <main className="min-h-screen bg-slate-50">
      <DemoSequenceHeader
        cohortLabel={fixture.cohortLabel}
        pilotWindow={fixture.pilotWindow}
        framing="A receiving-institution view of the pilot cohort: federal-source resolution, independent cross-check, replay envelope, operational acceleration. State-board and committee review remain institution-owned."
      />

      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-6">
        <DeploymentReadinessNarrative clinicians={fixture.clinicians} />

        <section
          data-slot="evidence-continuity-section"
          className="space-y-3"
        >
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
            Evidence continuity · per lane
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fixture.evidenceContinuity.map((lane) => (
              <OperationalContinuityCard key={lane.laneId} lane={lane} />
            ))}
          </div>
        </section>

        <CrossCheckNarrative lanes={fixture.crossCheckLanes} />

        <ReplayImpactNarrative interruptions={fixture.interruptions} />

        <OperationalAccelerationPanel
          cohortMetrics={fixture.deploymentReadiness}
        />

        <InstitutionalWalkthrough
          whatHappened="A federal-source resolution cohort completed for three clinicians. Identity, exclusions, and PECOS enrollment lanes were resolved against CMS NPPES, OIG/LEIE, and PECOS within the freshness budget."
          whoReviewed="VitalCV operator captured the lanes; receiving institution (Cedar Health Credentialing) reviews each lane on its own credential. Cedar credentialing committee dispositions on its own cadence."
          whatWasReused="Duplicate primary-source queries for NPPES, OIG/LEIE, and PECOS are replaced by a single replay envelope carrying the lane state, source reference, and operator note."
          whatStillRequiresHumans="State medical board PSV, credentialing committee review, and privileging decisions remain institution-owned. Human review is also required when an evidence lane carries a stale-but-signed flag at the freshness boundary."
          whatAccelerated="Federal-source resolution accelerates from four-to-six business days to under one hour for the pilot cohort. Operator minutes during the pilot window drop to under 90 minutes total."
          whatRemainsInstitutionOwned="State medical board PSV (Cedar CVO channel), credentialing committee review, privileging decisions, and final acceptance of any clinician for deployment."
        />

        <footer className="border-t border-dashed border-slate-400 pt-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Read-only demonstration · institution-owned confirmation ·
          no credential acceptance occurs on this page
        </footer>
      </div>
    </main>
  );
}
