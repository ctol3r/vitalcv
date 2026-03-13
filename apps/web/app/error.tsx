'use client';

import { useEffect } from 'react';

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
      <div className="text-center max-w-md px-6">
        <div className="text-5xl mb-6">⚠️</div>
        <h1 className="text-2xl font-semibold mb-3 text-white">
          Something went wrong
        </h1>
        <p className="text-slate-400 mb-8 text-sm leading-relaxed">
          An unexpected error occurred. Please try again, or contact support if
          the problem persists.
        </p>
        <button
          onClick={reset}
          className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#080e1a] hover:bg-white/90 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
