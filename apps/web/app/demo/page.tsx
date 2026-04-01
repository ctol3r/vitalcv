'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LiveTrustConsole } from '@/components/hero/LiveTrustConsole';

const DEFAULT_DEMO_NPI = '1003000126';

function DemoContent() {
  const searchParams = useSearchParams();
  const npi = searchParams.get('npi') || DEFAULT_DEMO_NPI;
  const employer = searchParams.get('employer');

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="mx-auto max-w-3xl px-4 pt-8 pb-4 sm:pt-12">
        <div className="mb-6 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/80">
            Demo walkthrough
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            This is a live demo of VitalCV&apos;s credentialing pipeline. Enter an NPI
            below (or use the pre-filled example) to see a real-time source check
            against NPPES and OIG/LEIE.
          </p>
          {employer && (
            <p className="mt-2 text-xs text-white/40">
              Employer context: <span className="text-white/60">{employer}</span>
            </p>
          )}
        </div>
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
