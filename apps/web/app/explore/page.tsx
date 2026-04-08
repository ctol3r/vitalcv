import type { Metadata } from 'next';
import { Suspense } from 'react';
import ExploreClient from '@/components/explore/ExploreClient';

export const metadata: Metadata = {
  title: 'Explore Clinical Roles',
  description:
    'Browse clinical opportunities and see where your readiness snapshot may apply.',
  openGraph: {
    title: 'Explore Clinical Roles',
    description:
      'Browse clinical opportunities and see where your readiness snapshot may apply.',
    url: 'https://vitalcv.com/explore',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore Clinical Roles',
    description:
      'Browse clinical opportunities and see where your readiness snapshot may apply.',
  },
};

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreClient />
    </Suspense>
  );
}
