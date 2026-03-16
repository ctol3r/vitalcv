import { FindingDetailClient } from '@/components/intelligence-ops/finding-detail-client';
import { safeLocalHref } from '@/lib/intelligence/time';
import { loadFindingDetail } from '@/lib/intelligence/server';
import { notFound } from 'next/navigation';

export default async function FindingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const detail = await loadFindingDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <FindingDetailClient
      findingId={id}
      initialData={detail}
      backHref={safeLocalHref(typeof resolvedSearchParams.from === 'string' ? resolvedSearchParams.from : null, '/findings')}
    />
  );
}
