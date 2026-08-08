import type { Metadata } from 'next';
import { EmployerProfileSurface } from '@/components/employer/EmployerProfileSurface';
import { PageFrame } from '@/components/layout/PageFrame';

// The surface reads Clerk + the org profile at request time, so this page can't
// be statically prerendered. Mirrors the clinician profile page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Company Profile',
  description:
    "Your organization's company profile. Legal name and Type 2 NPI are confirmed against NPPES; other details are self-reported until source-backed.",
};

export default function EmployerProfilePage() {
  // Thin sync wrapper (a render test mounts this synchronously). All identity +
  // org data is loaded inside EmployerProfileSurface, client-side, so signed-out
  // viewers and tests get a calm, deterministic placeholder.
  return (
    <PageFrame as="main" mode="workflow" className="max-w-3xl space-y-5">
      <EmployerProfileSurface />
    </PageFrame>
  );
}
