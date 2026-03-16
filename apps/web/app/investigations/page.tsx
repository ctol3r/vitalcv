import { Suspense } from 'react';
import type { Metadata } from 'next';
import { InvestigationsSurface } from '@/components/intelligence-ops/investigations-surface';

export const metadata: Metadata = {
  title: 'Investigations | VitalCV',
  description: 'Focused provider investigations linked from findings, storylines, actions, and provider detail.',
};

export default function InvestigationsPage() {
  return (
    <Suspense fallback={null}>
      <InvestigationsSurface />
    </Suspense>
  );
}
