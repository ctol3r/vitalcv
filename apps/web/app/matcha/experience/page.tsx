import type { Metadata } from 'next';
import { MatchaExperienceShowcase } from '@/components/matcha/MatchaExperienceShowcase';

export const metadata: Metadata = {
  title: 'MATCHA — a preview of your signed-in experience — VitalCV',
  description: 'See the MATCHA intelligence layer: your career constellation, a daily brief, and explained opportunity matches. Sample data.',
};

export default function MatchaExperiencePage() {
  return <MatchaExperienceShowcase />;
}
