'use client';

import { useEffect } from 'react';
import { SurfaceErrorState } from './primitives';

export function IntelligenceDetailError({
  error,
  reset,
  title,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="ops-shell min-h-screen px-4 py-6 text-[var(--vt-text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <SurfaceErrorState
          title={`${title} unavailable`}
          description={error.message || 'The detail view could not be loaded. Retry the request or return to the list.'}
          onRetry={reset}
        />
      </div>
    </main>
  );
}
