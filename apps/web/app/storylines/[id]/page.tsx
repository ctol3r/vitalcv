import { StorylineDetailClient } from '@/components/intelligence-ops/storyline-detail-client';
import { buildIntelligenceHref } from '@/lib/intelligence/routes';
import { loadStorylineDetail } from '@/lib/intelligence/server';
import { safeLocalHref } from '@/lib/intelligence/time';
import { notFound } from 'next/navigation';

export default async function StorylineDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const detail = await loadStorylineDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <StorylineDetailClient
      storylineId={id}
      initialData={detail}
      backHref={safeLocalHref(typeof resolvedSearchParams.from === 'string' ? resolvedSearchParams.from : null, buildIntelligenceHref('storylines'))}
    />
  );
}
