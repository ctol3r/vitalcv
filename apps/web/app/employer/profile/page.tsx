import type { Metadata } from 'next';
import { EmployerProfileSurface } from '@/components/employer/EmployerProfileSurface';

// The surface reads Clerk + the org profile at request time, so this page can't
// be statically prerendered. Mirrors the clinician profile page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Company Profile · VitalCV',
  description:
    "Your organization's company profile. Legal name and Type 2 NPI are confirmed against NPPES; other details are self-reported until source-backed.",
};

export default function EmployerProfilePage() {
  // Thin sync wrapper (a render test mounts this synchronously). All identity +
  // org data is loaded inside EmployerProfileSurface, client-side, so signed-out
  // viewers and tests get a calm, deterministic placeholder.
  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:py-10">
      <EmployerProfileSurface />
    </main>
  );
}
