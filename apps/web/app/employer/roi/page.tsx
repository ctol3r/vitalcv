import * as React from 'react';
import type { Metadata } from 'next';

import { getRoiV2DemoSnapshot } from '@/lib/roi-v2/fixtures';
import { RoiClient } from './RoiClient';

export const metadata: Metadata = {
  title: 'Pilot ROI Console · VitalCV',
  description:
    'Per-pilot ROI console. Reviewer-hours, decision throughput, and time-to-first-decision against your entered baseline. Demo data until persistence Phase 2.',
};

/**
 * Per-pilot ROI Console v2.
 *
 * Sibling surface to the FY-aggregate executive ROI dashboard at
 * `/roi` (Wave E). Both ship; they answer different questions:
 *   - `/roi` answers "how is the credentialing program doing this fiscal year?"
 *   - `/employer/roi` answers "is THIS pilot delivering on its activation
 *     baseline halfway through the window?"
 *
 * Phase 1: snapshot is fixture-driven and the page is banner-disclosed as a
 * demo. Phase 2 (post-TRUST-PERSIST-1) replaces the fetcher with a real
 * receipt-log query against the org's pilot window.
 */
export default async function EmployerRoiPage() {
  const snapshot = getRoiV2DemoSnapshot();

  return (
    <main
      className="min-h-screen bg-slate-50/40"
      data-testid="employer-roi-page"
      data-pilot-id={snapshot.pilot.pilotId}
    >
      <div className="max-w-[1280px] mx-auto px-6 pt-6">
        <p
          className="inline-block rounded-[2px] bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 ring-1 ring-amber-600/20"
          data-testid="roi-v2-demo-banner"
        >
          Demo cohort &mdash; illustrative only, not a real customer outcome
        </p>
      </div>
      <RoiClient snapshot={snapshot} />
    </main>
  );
}
