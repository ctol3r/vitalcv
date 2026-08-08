import { notFound } from 'next/navigation';

import { GardenCursor } from '@/components/career-garden/GardenCursor';
import { GardenShell } from '@/components/career-garden/GardenShell';
import { GardenWorkspaceProvider } from '@/components/career-garden/GardenWorkspaceProvider';
import { GardenHomeSurface } from '@/components/career-garden/surfaces/GardenHomeSurface';
import { LivingCvSurface } from '@/components/career-garden/surfaces/LivingCvSurface';
import { NotesSurface } from '@/components/career-garden/surfaces/NotesSurface';
import { OpportunitiesSurface } from '@/components/career-garden/surfaces/OpportunitiesSurface';
import { PrivacySurface } from '@/components/career-garden/surfaces/PrivacySurface';
import { ResearchSurface } from '@/components/career-garden/surfaces/ResearchSurface';
import { HolderWorkspaceFrame } from '@/components/holder/HolderWorkspaceFrame';
import { fixtureGardenData } from '@/lib/career-garden/gardenViews';
import { isCareerGardenPreviewAllowed } from '@/lib/career-garden/preview';
import type { GardenSection } from '@/lib/career-garden/nav';
import { buildClinicianMobileData } from '@/lib/mobile/clinician-state';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Career Garden harness (dev)',
  robots: { index: false, follow: false },
};

/**
 * Developer-only harness for the Career Garden prototype.
 *
 * The real surface lives at /holder/garden behind the Clerk gate, which
 * local dev and CI browsers cannot cross (production Clerk keys refuse
 * localhost). This page renders the same fixture-backed surfaces inside the
 * real holder chrome so the Cursor, the grow flow, reduced motion, and
 * responsive layout can be exercised in a browser and by Playwright.
 * Canonical production always denies it; see lib/career-garden/preview.ts.
 */
export default async function CareerGardenDevHarness({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; note?: string; grow?: string; op?: string; compose?: string; item?: string; entry?: string }>;
}) {
  if (!isCareerGardenPreviewAllowed(process.env)) notFound();

  const sp = await searchParams;
  const view = (['home', 'cv', 'research', 'notes', 'opportunities', 'privacy'] as GardenSection[]).includes(
    (sp.view ?? 'home') as GardenSection,
  )
    ? ((sp.view ?? 'home') as GardenSection)
    : 'home';

  const initialData = buildClinicianMobileData({
    base: {
      signedIn: true,
      workspace: null,
      trustState: null,
      applications: [],
      opportunities: [],
      missingForHigherMatches: [],
      refreshedAt: '2026-07-27T00:00:00.000Z',
    },
    profileCompleteness: null,
    rawTrustHistory: [],
  });

  const data = fixtureGardenData();

  const surface =
    view === 'home' ? (
      <GardenHomeSurface data={data} mount="harness" />
    ) : view === 'cv' ? (
      <LivingCvSurface data={data} selectedId={sp.entry} mount="harness" />
    ) : view === 'research' ? (
      <ResearchSurface selectedId={sp.item} mount="harness" />
    ) : view === 'notes' ? (
      <NotesSurface data={data} selectedId={sp.note} grow={sp.grow === '1'} mount="harness" />
    ) : view === 'opportunities' ? (
      <OpportunitiesSurface data={data} selectedId={sp.op} compose={sp.compose === '1'} mount="harness" />
    ) : (
      <PrivacySurface mount="harness" />
    );

  return (
    <HolderWorkspaceFrame initialData={initialData} showClerkAccount={false}>
      <GardenWorkspaceProvider initial={data}>
        <GardenShell active={view} mount="harness" mode="fixture">
          {surface}
        </GardenShell>
        <GardenCursor mount="harness" />
      </GardenWorkspaceProvider>
    </HolderWorkspaceFrame>
  );
}
