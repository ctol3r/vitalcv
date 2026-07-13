import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import CareerGraph from '@/components/career-graph/CareerGraph';

export const metadata: Metadata = {
  title: 'Clinician Career Evidence Graph · VitalCV',
  description:
    'The Provider Career Evidence Network as an interactive graph — how claims, sources, issuers, and employers connect. The graph explains provenance and gaps; it does not verify a claim by itself.',
};

// The graph reads window/canvas at mount, so render at request time (matches
// the homepage + /evidence-network mounts).
export const dynamic = 'force-dynamic';

export default function ClinicianGraphPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Career Evidence Network
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          How claims, sources, issuers, and employers connect
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          <strong>The graph explains provenance and gaps. It does not verify a
          claim by itself.</strong> The same interactive network you see on the
          home page — drag any node, filter by group, and follow the backlinks.
          Structure here is illustrative; your real evidence lives in your wallet.
        </p>
      </header>

      {/* Same engine + look as the home page and /evidence-network. */}
      <div
        style={{
          height: 560,
          width: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--vt-border, rgba(0,0,0,0.1))',
        }}
      >
        <CareerGraph initialTheme="dark" initialPanelOpen={false} />
      </div>

      <p className="mt-4 text-sm">
        <Link href="/evidence-network" className="font-semibold text-[var(--vt-accent,#4f46e5)] underline-offset-4 hover:underline">
          Open the full network explorer →
        </Link>
      </p>
    </main>
  );
}
