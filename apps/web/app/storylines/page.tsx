import { Suspense } from 'react';
import type { Metadata } from 'next';
import { StorylinesSurface } from '@/components/intelligence-ops/storylines-surface';

export const metadata: Metadata = {
  title: 'Storylines | VitalCV',
  description: 'Operational storyline clusters with detail routes, linked findings, and triage controls.',
};

export default function StorylinesPage() {
  return (
    <Suspense fallback={null}>
      <StorylinesSurface />
    </Suspense>
  );
}
