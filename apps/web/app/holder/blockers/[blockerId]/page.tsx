import type { Metadata } from 'next';
import ClinicianBlockerDetailSurface from '@/components/mobile/ClinicianBlockerDetailSurface';

export const metadata: Metadata = {
  title: 'Resolve Blocker',
  description: 'See the exact blocker holding up readiness or application progress and take the next action.',
};

export default async function HolderBlockerDetailPage({
  params,
}: {
  params: Promise<{ blockerId: string }>;
}) {
  const { blockerId } = await params;

  return <ClinicianBlockerDetailSurface blockerId={blockerId} />;
}
