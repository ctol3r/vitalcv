import type { Metadata } from 'next';
import { MatchaExperienceShowcase } from '@/components/matcha/MatchaExperienceShowcase';

export const metadata: Metadata = {
  title: 'Matching — a preview of your signed-in experience',
  // Was "your career constellation" — the mechanism CD-13 retired, and removed
  // from this page in #1020. The description outlived the thing it described,
  // so the public meta tag went on advertising a canvas that no longer exists.
  description:
    'See how matching works: your career end to end, a daily brief, and explained opportunity matches. Sample data.',
};

export default function MatchaExperiencePage() {
  return <MatchaExperienceShowcase />;
}
