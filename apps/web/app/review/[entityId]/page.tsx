import type { Metadata } from 'next';
import React from 'react';
import ReviewPageClient from './ReviewPageClient';


export const metadata: Metadata = {
  title: 'Employer Review',
  description: 'Review a shared, source-backed clinician record.',
};

export const dynamic = 'force-dynamic';

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params:       Promise<{ entityId: string }>;
  searchParams: Promise<{ contextId?: string; bundleId?: string; from?: string }>;
}) {
  const { entityId }                    = await params;
  const { contextId, bundleId, from }   = await searchParams;
  return ReviewPageClient({
    entityId,
    contextId,
    bundleId,
    from,
  });
}
