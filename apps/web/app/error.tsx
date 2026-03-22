'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { PilotFailureSignal } from '@/components/pilot-ops/PilotFailureSignal';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';

export default function Error({
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
    <div
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ background: '#080e1a', color: '#e2e8f0' }}
    >
      <PilotFailureSignal
        title="View interrupted"
        message={error.message}
        queueItem={{ source: 'route_failure' }}
        details={{
          digest: error.digest ?? null,
        }}
        dedupeKey={`app-error:${error.digest ?? error.message}`}
      />
      <div className="text-center max-w-md px-6">
        <div className="text-5xl mb-6 opacity-80">💭</div>
        <h1 className="text-2xl font-semibold mb-3 text-white">
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
            className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:text-white"
          >
            Return home
          </Link>
          <SupportActionButton
            label="Contact support"
            title="View interrupted"
            messagePrefill={error.message}
            className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:text-white"
          />
        </div>
      </div>
    </div>
  );
}
