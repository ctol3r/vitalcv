'use client';

/**
 * /demo — Single clean demo flow.
 *
 * One path. No alternate entry points.
 *
 *   Step 1: Enter NPI → "Check your credential readiness"
 *   Step 2: See readiness snapshot
 *   Step 3: "Continue to credential passport" → /passport?npi=
 *   Step 4: "Share with employer" → /interview?entityId=
 *   Step 5: Employer lands on /review
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LiveTrustConsole } from '@/components/hero/LiveTrustConsole';

const DEFAULT_DEMO_NPI = '1003000126';

function DemoContent() {
  const searchParams = useSearchParams();
  const npi = searchParams.get('npi') || DEFAULT_DEMO_NPI;
  const employer = searchParams.get('employer');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full border-b border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2.5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
          Live demo — using real verification sources
        </p>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-6 pb-2">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 uppercase tracking-widest">
          <span className="font-semibold text-foreground/80">Step 1</span>
          <span>·</span>
          <span>Enter NPI</span>
          <span className="text-muted-foreground/30 mx-1">&rarr;</span>
          <span>Step 2 · Readiness</span>
          <span className="text-muted-foreground/30 mx-1">&rarr;</span>
          <span>Step 3 · Passport</span>
        </div>
        {employer && (
          <p className="mt-2 text-xs text-muted-foreground">
            Employer context: <span className="text-foreground/80">{employer}</span>
          </p>
        )}
      </div>

      <LiveTrustConsole initialNpi={npi} />
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense>
      <DemoContent />
    </Suspense>
  );
}
