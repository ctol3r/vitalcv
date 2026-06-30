import type { Metadata } from 'next';
import ClinicianApplicationDetailSurface from '@/components/mobile/ClinicianApplicationDetailSurface';

export const metadata: Metadata = {
  title: 'Application',
  description: 'Your application status, timeline, and readiness snapshot.',
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
  return <ClinicianApplicationDetailSurface applicationId={id} />;
}
