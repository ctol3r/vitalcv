/**
 * Wave 188 — Explore Opportunities Surface
 * /explore — public-first, filter-rich trust-native opportunities board
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Suspense } from 'react';
import ExploreClient from '@/components/explore/ExploreClient';
import PrequalifyTrigger from '@/components/prequalify/PrequalifyTrigger';

export const metadata: Metadata = {
  title: 'Explore Opportunities — VitalCV',
  description:
    'Trust-native clinical opportunities matched to your verified credential state. Know your readiness before you apply.',
};

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      {/* Hero */}
      <section className="border-b border-vt-neutral-800 px-6 py-16 text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-vt-success/10 px-4 py-1.5 tag text-vt-success ring-1 ring-vt-success/20">
          <Sparkles className="h-3 w-3" />
          Trust-Native Matching
        </span>
        <h1 className="heading-xl mt-3 text-white">
          Opportunities You&apos;re<br />
          <span className="text-vt-success">Already Cleared For.</span>
        </h1>
        <p className="body-lg mx-auto mt-4 max-w-xl text-vt-neutral-200">
          Every role shows your readiness instantly. Know exactly what&apos;s
          blocking you — and resolve it before you apply.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <PrequalifyTrigger
            label="Get Verified Free"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[oklch(0.22_0.01_60)] hover:bg-white/90"
          />
          <Link
            href="/ask"
            className="inline-flex items-center gap-2 rounded-full vt-glass px-6 py-3 text-sm font-medium text-white transition hover:bg-vt-surface-ops-raised"
          >
            Ask about a role
          </Link>
        </div>
      </section>

      {/* Opportunities board */}
      <Suspense
        fallback={(
          <div className="flex items-center justify-center px-6 py-16 text-sm text-vt-neutral-300">
            Loading opportunities…
          </div>
        )}
      >
        <ExploreClient />
      </Suspense>
    </div>
  );
}
