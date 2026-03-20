import { redirect } from 'next/navigation';
import { buildIntelligenceHref } from '@/lib/intelligence/routes';

export default async function ActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(buildIntelligenceHref('actions', {
    actionId: id,
  }));
}
