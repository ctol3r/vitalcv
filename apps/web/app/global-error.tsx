'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { PilotFailureSignal } from '@/components/pilot-ops/PilotFailureSignal';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-zinc-950 font-sans">
        <PilotFailureSignal
          title="System interruption"
          message={error.message}
          queueItem={{ source: 'route_failure' }}
          details={{
            digest: error.digest ?? null,
          }}
          dedupeKey={`global-error:${error.digest ?? error.message}`}
        />
        <main className="max-w-xl w-full mx-4">
          <div className="rounded-2xl border border-border bg-white/[0.04] p-8 space-y-5">
            <div className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
              <h1 className="text-2xl font-semibold">System Interruption</h1>
            </div>
            <p className="text-sm text-foreground/70">
              The platform encountered a temporary issue. Your data is safe. Please refresh to continue.
            </p>
            <p className="text-sm text-foreground/70">
              If this persists, share the reference below in a support request.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-zinc-950 transition-colors hover:bg-zinc-200"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh View
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-foreground/80 transition hover:border-border hover:text-foreground"
              >
                Return home
              </Link>
              <SupportActionButton
                label="Contact support"
                title="System interruption"
                messagePrefill={error.message}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-foreground/80 transition hover:border-border hover:text-foreground"
              />
            </div>

            {error.digest && (
              <details className="rounded-md border border-border bg-white/[0.03] p-3 text-xs text-foreground/70">
                <summary className="font-medium text-foreground cursor-pointer">
                  Technical Reference
                </summary>
                <p className="mt-2 break-all font-mono">Digest: {error.digest}</p>
              </details>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
