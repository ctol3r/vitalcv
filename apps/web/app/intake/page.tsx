/**
 * /intake -- Institutional intake momentum route.
 *
 * Single first-30-seconds surface that translates the pilot
 * infrastructure into an institutional onboarding story:
 *
 *   1. IntakeEntryHeader              -- who VitalCV is, in 30 seconds
 *   2. ThirtySecondComprehension      -- five questions, five answers
 *   3. OperationalReadinessSummary    -- cohort overview (ready for review)
 *   4. EvidenceContinuitySummary      -- per-lane continuity rollup
 *   5. DuplicateOutreachReduction     -- what's reused, what you retain
 *   6. EvidenceReuseSummary           -- before/after metrics + binding claims
 *   7. InstitutionalIntakeProgress    -- 5 operational stages
 *   8. InstitutionReviewNarrative     -- 4 surfaces institution owns
 *   9. ContinuityGapNarrative         -- what happens when continuity breaks
 *
 * Read-only. No backend writes, no external API calls. Reuses the
 * Cedar Q2-2026 demo fixture from PR #400; no duplicate fixture
 * system.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDemoFixture } from '@/lib/demo/demoFixtures';
import { IntakeEntryHeader } from '@/components/intake/IntakeEntryHeader';
import { ThirtySecondComprehension } from '@/components/intake/ThirtySecondComprehension';
import { OperationalReadinessSummary } from '@/components/intake/OperationalReadinessSummary';
import { EvidenceContinuitySummary } from '@/components/intake/EvidenceContinuitySummary';
import { DuplicateOutreachReduction } from '@/components/intake/DuplicateOutreachReduction';
import { EvidenceReuseSummary } from '@/components/intake/EvidenceReuseSummary';
import { InstitutionalIntakeProgress } from '@/components/intake/InstitutionalIntakeProgress';
import { InstitutionReviewNarrative } from '@/components/intake/InstitutionReviewNarrative';
import { ContinuityGapNarrative } from '@/components/intake/ContinuityGapNarrative';

export const metadata: Metadata = {
  title: 'Institutional intake · VitalCV',
  description:
    'First-30-seconds institutional view of a VitalCV pilot cohort. Federal-source resolution, evidence reuse, institution review preserved.',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams?: Promise<{ cohort?: string }>;
}

export default async function InstitutionalIntakePage({ searchParams }: PageProps) {
  const { cohort = 'cedar' } = (await searchParams) ?? {};
  const fixture = getDemoFixture(cohort);
  if (!fixture) notFound();

  return (
    <main className="min-h-screen bg-slate-50">
      <IntakeEntryHeader
        cohortLabel={fixture.cohortLabel}
        pilotWindow={fixture.pilotWindow}
      />

      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-6">
        <ThirtySecondComprehension />

        <OperationalReadinessSummary clinicians={fixture.clinicians} />

        <EvidenceContinuitySummary lanes={fixture.evidenceContinuity} />

        <DuplicateOutreachReduction />

        <EvidenceReuseSummary metrics={fixture.deploymentReadiness} />

        <InstitutionalIntakeProgress />

        <InstitutionReviewNarrative />

        <ContinuityGapNarrative interruptions={fixture.interruptions} />

        <footer className="border-t border-dashed border-slate-400 pt-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Read-only intake · federal-source resolution only ·
          state-board, committee, and privileging review remain institution-owned ·
          no credential acceptance occurs on this page
        </footer>
      </div>
    </main>
  );
}
