'use client';

import { useParams } from 'next/navigation';
import { TrustStateView } from '@/components/trust-state/TrustStateView';

export default function TrustStatePage() {
  const params = useParams<{ artifactId: string }>();
  const backendUrl =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    '';

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:px-10 sm:py-16">
      <TrustStateView
        artifactId={params.artifactId}
        backendUrl={backendUrl}
      />
    </main>
  );
}
