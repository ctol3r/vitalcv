import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ActionsSurface } from '@/components/intelligence-ops/actions-surface';

export const metadata: Metadata = {
  title: 'Actions | VitalCV',
  description: 'Recommended action queue with triage mutations, pagination, and detail routes.',
};

export default function ActionsPage() {
  return (
    <Suspense fallback={null}>
      <ActionsSurface />
    </Suspense>
  );
}
