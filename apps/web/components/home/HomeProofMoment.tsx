import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { ProofPacketInspector } from '@/components/proof/ProofPacketInspector';

/**
 * HomeProofMoment (deep-audit W4.2) — the homepage's one tangible proof moment.
 *
 * The audit: "turn 'proof packet' from copy into a concrete, inspectable
 * moment." This mounts the real, tested `ProofPacketInspector` (previously
 * design-route only) as a focused interactive panel — a visitor inspects one
 * claim → source → retrieval/receipt → state → limitation chain without
 * leaving the narrative. It is explicitly illustrative (the inspector labels
 * itself and states the employer-final boundary) and it links the REAL
 * clinician flow, never a dead-end demo.
 *
 * One panel, not a dashboard: it sits after the career journey as the "why
 * this is credible" beat, then hands off to the clinician's own packet.
 */
export function HomeProofMoment() {
  return (
    <section
      aria-labelledby="home-proof-moment-title"
      data-home-proof-moment=""
      className="mz pt-14"
    >
      <div className="mx-auto w-full max-w-[1320px]">
        <p className="mz-eyebrow">Why this is credible</p>
        <h2 id="home-proof-moment-title" className="mz-h1 mt-3 max-w-[20ch]">
          Inspect the proof, claim by claim.
        </h2>
        <p className="mz-body mt-3 max-w-2xl text-[var(--vt-text-secondary)]">
          Every claim carries its source, how it was retrieved, a receipt, its state, and what it
          does not decide. Pick one and follow the whole chain.
        </p>

        <div className="mt-8">
          <ProofPacketInspector />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px]">
          <Link
            href="/onboarding"
            data-home-proof-cta=""
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--vt-text-primary)] px-4 py-2 font-semibold text-[var(--vt-bg)]"
          >
            Build your own proof packet
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <span className="text-[var(--vt-text-muted)]">
            Your real packet is source-backed and consented — this example is not a live result.
          </span>
        </div>
      </div>
    </section>
  );
}

export default HomeProofMoment;
