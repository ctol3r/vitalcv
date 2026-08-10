import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES } from '@/lib/features';
import { MatchaOnboardingSurface } from '@/components/matcha/MatchaOnboardingSurface';

export const metadata: Metadata = {
  title: 'Set up matching',
  description: 'A short conversation about what you want next in your career.',
};

export default function HolderMatchaOnboardingPage() {
  if (!FEATURES.MATCHA_V2) notFound();
  return <MatchaOnboardingSurface />;
}
