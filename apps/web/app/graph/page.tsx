import { Suspense } from 'react';
import { IntelligenceConsolePage } from '@/components/intelligence/IntelligenceConsolePage';

export const metadata = {
  title: 'Trust Graph Intelligence | VitalCV',
  description: 'Operational intelligence shell for providers, findings, graph context, and system health.',
};

export default function GraphPage() {
  return (
    <Suspense fallback={null}>
      <IntelligenceConsolePage />
    </Suspense>
  );
}
