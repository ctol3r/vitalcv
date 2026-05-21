/**
 * /demo/waste -- Operational waste visibility route.
 *
 * Single read-only surface that names where credentialing operations
 * leak today (duplicate outreach, continuity interruption, evidence
 * fragmentation, dead time, manual review loops, deployment delay)
 * and pairs each leak with the institution-owned step that does NOT
 * move. The page demonstrates visibility, not elimination. It does
 * not claim savings, ROI, regulatory substitution, or "AI-powered"
 * anything.
 *
 * Reuses the Cedar Q2-2026 demo fixture from PR #400; no duplicate
 * fixture system.
 *
 * Sequence:
 *   1. WasteEntryHeader                  -- framing, "visibility not elimination"
 *   2. DuplicateOutreachNarrative        -- narrative 01
 *   3. ContinuityInterruptionNarrative   -- narrative 02
 *   4. EvidenceFragmentationNarrative    -- narrative 03
 *   5. OperationalDeadTimeNarrative      -- narrative 04
 *   6. ManualReviewLoopNarrative         -- narrative 05
 *   7. DeploymentDelayNarrative          -- narrative 06
 *   8. OperationalContinuityComparison   -- today vs pilot, 8 steps
 *   9. InstitutionalFrictionTimeline     -- T-0 through T-5 chronology
 *  10. WasteVisibilitySummary            -- six narratives folded together
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDemoFixture } from '@/lib/demo/demoFixtures';
import { WasteEntryHeader } from '@/components/waste/WasteEntryHeader';
import { DuplicateOutreachNarrative } from '@/components/waste/DuplicateOutreachNarrative';
import { ContinuityInterruptionNarrative } from '@/components/waste/ContinuityInterruptionNarrative';
import { EvidenceFragmentationNarrative } from '@/components/waste/EvidenceFragmentationNarrative';
import { OperationalDeadTimeNarrative } from '@/components/waste/OperationalDeadTimeNarrative';
import { ManualReviewLoopNarrative } from '@/components/waste/ManualReviewLoopNarrative';
import { DeploymentDelayNarrative } from '@/components/waste/DeploymentDelayNarrative';
import { OperationalContinuityComparison } from '@/components/waste/OperationalContinuityComparison';
import { InstitutionalFrictionTimeline } from '@/components/waste/InstitutionalFrictionTimeline';
import { WasteVisibilitySummary } from '@/components/waste/WasteVisibilitySummary';

export const metadata: Metadata = {
  title: 'Operational waste visibility · VitalCV',
  description:
    'Receiver-side observation of where credentialing operations leak today. Six narratives, eight-step continuity comparison, six-checkpoint chronology, summary panel. The page demonstrates visibility, not elimination.',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams?: Promise<{ cohort?: string }>;
}

export default async function OperationalWasteVisibilityPage({
  searchParams,
}: PageProps) {
  const { cohort = 'cedar' } = (await searchParams) ?? {};
  const fixture = getDemoFixture(cohort);
  if (!fixture) notFound();

  return (
    <main className="min-h-screen bg-slate-50">
      <WasteEntryHeader
        cohortLabel={fixture.cohortLabel}
        pilotWindow={fixture.pilotWindow}
      />

      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-6">
        <DuplicateOutreachNarrative lanes={fixture.crossCheckLanes} />

        <ContinuityInterruptionNarrative
          interruptions={fixture.interruptions}
        />

        <EvidenceFragmentationNarrative
          evidenceLanes={fixture.evidenceContinuity}
        />

        <OperationalDeadTimeNarrative />

        <ManualReviewLoopNarrative />

        <DeploymentDelayNarrative rows={fixture.deploymentReadiness} />

        <OperationalContinuityComparison />

        <InstitutionalFrictionTimeline />

        <WasteVisibilitySummary />

        <footer className="border-t border-dashed border-slate-400 pt-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Read-only observation · no credential decision occurs on this page ·
          visibility, not elimination
        </footer>
      </div>
    </main>
  );
}
