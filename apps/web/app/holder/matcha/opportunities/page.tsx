import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES } from '@/lib/features';
import { MatchaOpportunitiesSurface } from '@/components/matcha/MatchaOpportunitiesSurface';

export const metadata: Metadata = {
  title: 'Matched opportunities',
  description: 'Live roles scored on your credential eligibility and explained with your preferences.',
};

export default function HolderMatchaOpportunitiesPage() {
  if (!FEATURES.MATCHA_V2) notFound();
  return <MatchaOpportunitiesSurface />;
}
