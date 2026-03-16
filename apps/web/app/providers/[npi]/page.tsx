import { ProviderDetailView } from '@/components/intelligence-ops/provider-detail-view';
import { loadProviderDetail } from '@/lib/intelligence/server';
import { safeLocalHref } from '@/lib/intelligence/time';
import { notFound } from 'next/navigation';

const NPI_RE = /^\d{10}$/;

export default async function ProviderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ npi: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const [{ npi }, resolvedSearchParams] = await Promise.all([params, searchParams]);

  if (!NPI_RE.test(npi)) {
    notFound();
  }

  const detail = await loadProviderDetail(npi);

  if (!detail) {
    notFound();
  }

  return (
    <ProviderDetailView
      detail={detail}
      backHref={safeLocalHref(typeof resolvedSearchParams.from === 'string' ? resolvedSearchParams.from : null, '/providers')}
    />
  );
}
