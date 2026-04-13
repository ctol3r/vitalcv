'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { PilotFailureSignal } from '@/components/pilot-ops/PilotFailureSignal';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';
import { trackPilotEvent } from '@/lib/pilot-ops/client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    void trackPilotEvent({ eventType: 'dead_end_reached', oncePerSession: false, details: { page: 'error', digest: error.digest ?? null } });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <PilotFailureSignal
        title="Page could not load"
        message={error.digest ?? 'runtime_error'}
        queueItem={{ source: 'route_failure' }}
        details={{
          digest: error.digest ?? null,
        }}
        dedupeKey={`app-error:${error.digest ?? 'unknown'}`}
      />
      <div className="max-w-md animate-fade-in-up px-6 text-center">
        <h1 className="text-2xl font-semibold mb-3 text-foreground">
          Something went wrong
        </h1>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
          This page couldn&apos;t load. Your data is safe — try reloading, or
          return to the homepage and continue from there.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-foreground/85 transition hover:border-border hover:text-foreground"
          >
            Return home
          </Link>
          <SupportActionButton
            label="Contact support"
            title="Page could not load"
            messagePrefill={error.digest ?? 'An error occurred'}
            className="rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-foreground/85 transition hover:border-border hover:text-foreground"
          />
        </div>
      </div>
    </div>
  );
}
