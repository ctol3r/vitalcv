import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES } from '@/lib/features';
import { MatchaHub } from '@/components/matcha/MatchaHub';

export const metadata: Metadata = {
  title: 'MATCHA',
  description: 'The intelligence layer that learns what you want and works in the background for you.',
};

// Gated behind MATCHA_V2 (Wave 187 PILOT flag). All data derives from the clinician's
// own stated preferences and the live match engine — nothing is fabricated.
export default function HolderMatchaPage() {
  if (!FEATURES.MATCHA_V2) notFound();
  return <MatchaHub />;
}
