import { redirect } from 'next/navigation';
import { buildIntelligenceHref } from '@/lib/intelligence/routes';

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(buildIntelligenceHref('dashboard', {
    findingId: id,
    open: ['finding'],
  }));
}
