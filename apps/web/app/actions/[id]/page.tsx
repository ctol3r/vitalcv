import { ActionDetailClient } from '@/components/intelligence-ops/action-detail-client';
import { loadActionDetail } from '@/lib/intelligence/server';
import { safeLocalHref } from '@/lib/intelligence/time';
import { notFound } from 'next/navigation';

export default async function ActionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const detail = await loadActionDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <ActionDetailClient
      actionId={id}
      initialData={detail}
      backHref={safeLocalHref(typeof resolvedSearchParams.from === 'string' ? resolvedSearchParams.from : null, '/actions')}
    />
  );
}
