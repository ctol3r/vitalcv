import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES } from '@/lib/features';
import { MatchaAssessment } from '@/components/matcha/MatchaAssessment';

export const metadata: Metadata = {
  title: 'Match questions — VitalCV',
  description: 'Answer Personal, Professional, and Place match questions to sharpen how MATCHA matches you.',
};

export default function HolderMatchaAssessmentPage() {
  if (!FEATURES.MATCHA_V2) notFound();
  return <MatchaAssessment />;
}
