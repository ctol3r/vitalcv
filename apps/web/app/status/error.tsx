'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function StatusError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const maxRetries = 3;

  useEffect(() => {
    console.error('[status] page error', error.message);
  }, [error]);

  // Auto-retry with exponential backoff (up to 3 times)
  useEffect(() => {
    if (retryCount === 0 || retryCount > maxRetries) return;
    const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 8000);
    setIsRetrying(true);
    const timer = setTimeout(() => {
      setIsRetrying(false);
      reset();
    }, delay);
    return () => clearTimeout(timer);
  }, [retryCount, reset]);

  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount((c) => c + 1);
    } else {
      reset();
    }
  };

  return (
    <main className="bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-3">
              <h1 className="text-xl font-semibold">
                Status checks are currently offline
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                VitalCV was unable to load the source status report. This usually
                resolves within a few minutes as backend services reconnect.
              </p>
              {retryCount > 0 && retryCount <= maxRetries && (
                <p className="text-xs text-muted-foreground/70">
                  Auto-retry {retryCount}/{maxRetries}
                  {isRetrying ? ' — retrying…' : ' — waiting…'}
                </p>
              )}
              <p className="text-xs text-muted-foreground/60">
                Last checked: {new Date().toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying…' : 'Retry now'}
            </button>
            <Link
              href="/passport"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground/75 transition hover:text-foreground"
            >
              Check readiness instead
            </Link>
          </div>
        </div>

        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Source health checks run against NPPES, OIG/LEIE, and CMS PECOS. When the
            backend is unavailable, this page cannot display live posture data.
          </p>
          <p>
            If the issue persists, contact{' '}
            <a href="mailto:support@vitalcv.com" className="underline underline-offset-2 hover:text-foreground">
              support@vitalcv.com
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
