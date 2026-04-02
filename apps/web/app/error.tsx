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
    <div className="flex min-h-screen flex-col items-center justify-center bg-vt-surface-ops-base text-slate-200">
      <PilotFailureSignal
        title="View interrupted"
        message={error.message}
        queueItem={{ source: 'route_failure' }}
        details={{
          digest: error.digest ?? null,
        }}
        dedupeKey={`app-error:${error.digest ?? error.message}`}
      />
      <div className="max-w-md animate-fade-in-up px-6 text-center">
        <div className="text-5xl mb-6 opacity-80">💭</div>
        <h1 className="text-2xl font-semibold mb-3 text-foreground">
          View Interrupted
        </h1>
        <p className="text-slate-400 mb-8 text-sm leading-relaxed">
          The platform encountered a temporary issue loading this view. Your data remains secure.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#080e1a] hover:bg-white/90 transition"
          >
            Reload View
          </button>
          <Link
            href="/"
            className="rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-foreground/85 transition hover:border-border hover:text-foreground"
          >
            Return home
          </Link>
          <SupportActionButton
            label="Contact support"
            title="View interrupted"
            messagePrefill={error.message}
            className="rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-foreground/85 transition hover:border-border hover:text-foreground"
          />
        </div>
      </div>
    </div>
  );
}
