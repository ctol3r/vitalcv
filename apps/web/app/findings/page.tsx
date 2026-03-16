import { Suspense } from 'react';
import type { Metadata } from 'next';
import { FindingsSurface } from '@/components/intelligence-ops/findings-surface';

export const metadata: Metadata = {
  title: 'Findings | VitalCV',
  description: 'Operational investigator findings with filters, pagination, and triage controls.',
};

export default function FindingsPage() {
  return (
    <Suspense fallback={null}>
      <FindingsSurface />
    </Suspense>
  );
}
