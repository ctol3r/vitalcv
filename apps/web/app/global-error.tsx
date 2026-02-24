'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <main className="max-w-xl w-full mx-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-5">
            <div className="flex items-center gap-2 text-slate-900">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h1 className="text-2xl font-semibold">Something went wrong</h1>
            </div>
            <p className="text-sm text-slate-600">
              We couldn&apos;t complete this request. Use the retry button below to
              reload and continue.
            </p>
            <p className="text-sm text-slate-500">
              Our team has been notified automatically, and the error has been logged.
            </p>

            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry now
            </button>

            {error.digest && (
              <details className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <summary className="font-medium text-slate-700">
                  Error reference for support
                </summary>
                <p className="mt-2 break-all font-mono">digest: {error.digest}</p>
              </details>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
