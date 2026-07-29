import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PublicOpportunityBoard } from '@/components/explore/PublicOpportunityBoard';

export const metadata: Metadata = {
  title: 'Clinical opportunities | VitalCV',
  description: 'Browse current clinical opportunities with visible requirements, source state, and listing freshness.',
  alternates: { canonical: 'https://vitalcv.com/explore' },
  openGraph: {
    title: 'Clinical opportunities | VitalCV',
    description: 'Browse current clinical opportunities with visible requirements, source state, and listing freshness.',
    url: 'https://vitalcv.com/explore',
  },
};

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="mx-auto min-h-[60vh] max-w-7xl px-5 py-16" />}>
      <PublicOpportunityBoard />
    </Suspense>
  );
}
