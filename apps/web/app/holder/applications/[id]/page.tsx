import type { Metadata } from 'next';
import ClinicianApplicationDetailSurface from '@/components/mobile/ClinicianApplicationDetailSurface';
import { HireToStartCasePanel } from '@/components/applications/HireToStartCasePanel';
import { loadApplicationEvidenceView } from '@/lib/server/applicationEvidence';
import { loadHireToStartCase } from '@/lib/server/hireToStartCase';

export const metadata: Metadata = {
  title: 'Application',
  description: 'Your application status, immutable submitted packet, and current profile evidence.',
};

// Detail page for a single application. ApplyModal redirects here on a
// successful apply (/holder/applications/{id}); the surface reads the
// application from the shared ClinicianMobileProvider and calls notFound()
// when the id is unknown.
export default async function HolderApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [evidenceResult, hireToStartResult] = await Promise.all([
    loadApplicationEvidenceView(id),
    loadHireToStartCase(id),
  ]);
  return (
    <>
      <ClinicianApplicationDetailSurface applicationId={id} evidenceResult={evidenceResult} />
      <div className="mx-auto w-full max-w-[680px] px-4 pb-8">
        <HireToStartCasePanel result={hireToStartResult} />
      </div>
    </>
  );
}
