import React from 'react';
import ReviewPageClient from './ReviewPageClient';

export const dynamic = 'force-dynamic';

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params:       Promise<{ entityId: string }>;
  searchParams: Promise<{ contextId?: string; bundleId?: string; applicationId?: string; from?: string }>;
}) {
  const { entityId }                               = await params;
  const { contextId, bundleId, applicationId, from } = await searchParams;
  return ReviewPageClient({
    entityId,
    contextId,
    bundleId,
    applicationId,
    from,
  });
}
