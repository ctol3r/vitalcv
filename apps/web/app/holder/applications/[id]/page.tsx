import type { Metadata } from 'next';
import ClinicianApplicationDetailSurface from '@/components/mobile/ClinicianApplicationDetailSurface';

type Props = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: 'Application Detail',
  description: 'Live clinician application detail, readiness snapshot, and next steps.',
};

export default async function ApplicationDetailPage({ params }: Props) {
  const { id } = await params;

  return <ClinicianApplicationDetailSurface applicationId={id} />;
}
