import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProvidersSurface } from '@/components/intelligence-ops/providers-surface';

export const metadata: Metadata = {
  title: 'Providers | VitalCV',
  description: 'Provider directory with search, trust filtering, and linked detail views.',
};

export default function ProvidersPage() {
  return (
    <Suspense fallback={null}>
      <ProvidersSurface />
    </Suspense>
  );
}
