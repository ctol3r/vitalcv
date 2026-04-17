'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { PilotFailureSignal } from '@/components/pilot-ops/PilotFailureSignal';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';

export default function IntelligenceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-vt-surface-ops-base px-6 py-16 text-foreground">
      <PilotFailureSignal
        title="Intelligence workspace interrupted"
        message={error.message}
        queueItem={{ source: 'route_failure' }}
        details={{ digest: error.digest ?? null }}
        dedupeKey={`intelligence-error:${error.digest ?? error.message}`}
      />

      <main className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-border bg-white/[0.04] p-8">
          <div className="flex items-center gap-3 text-foreground">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
            <h1 className="text-2xl font-semibold">Intelligence unavailable</h1>
          </div>

          <p className="mt-4 text-sm leading-6 text-foreground/70">
            VitalCV could not load the intelligence workspace right now. No data was changed. Refresh the view or return to the monitor surface.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-vt-surface-ops-base transition hover:bg-white/90"
            >
              <RefreshCw className="h-4 w-4" />
              Reload workspace
            </button>
            <Link
              href="/intelligence"
              className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground/80 transition hover:border-border hover:text-foreground"
            >
              Return to monitor
            </Link>
            <SupportActionButton
              label="Contact support"
              title="Intelligence workspace interrupted"
              messagePrefill={error.message}
              className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground/80 transition hover:border-border hover:text-foreground"
            />
          </div>

          {error.digest ? (
            <p className="mt-5 text-xs text-foreground">
              Reference: <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
