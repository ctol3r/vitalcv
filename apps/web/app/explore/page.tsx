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
    'Trust-native clinical opportunities matched to your source-backed readiness snapshot. Know what is checked before you apply.',
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
          <span className="text-vt-success">Already Matched For.</span>
        </h1>
        <p className="body-lg mx-auto mt-4 max-w-xl text-vt-neutral-200">
          Every role maps to your readiness state. Know exactly what&apos;s
          blocking you — and resolve it before you apply.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <PrequalifyTrigger
            label="Check Readiness Free"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-vt-surface-ops-base hover:bg-white/90"
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
      <section className="border-b border-amber-500/20 bg-amber-500/5 px-6 py-3">
        <div className="mx-auto max-w-6xl text-center">
          <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
            Demo data
          </span>
          <p className="mt-2 text-xs text-amber-100/80">
            Marketplace results may include seeded launch-cohort employers and opportunities during rollout.
          </p>
        </div>
      </section>

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
