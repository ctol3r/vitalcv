import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SystemHealthSurface } from '@/components/intelligence-ops/system-health-surface';

export const metadata: Metadata = {
  title: 'System Health | VitalCV',
  description: 'System health posture for the intelligence layer, including incidents and operator actions.',
};

export default function SystemHealthPage() {
  return (
    <Suspense fallback={null}>
      <SystemHealthSurface />
    </Suspense>
  );
}
