import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { ProofPacketInspector } from '@/components/proof/ProofPacketInspector';
import { ScrollScrubHeading } from '@/components/motion/ScrollScrubHeading';

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
      /* ScrollScrubHeading renders its own `aria-label` (one accessible name
         for the whole heading, with the characters aria-hidden), and takes no
         `id`, so the section names itself directly — the same pattern
         EvidenceTruthPanel used. No other file referenced the old id. */
      aria-label="Inspect the proof, claim by claim"
      data-home-proof-moment=""
      className="mz pt-14"
    >
      <div className="mx-auto w-full max-w-[1320px]">
        <p className="mz-eyebrow">Why this is credible</p>
        {/* The scrub heading moved here (2026-07-21 rebuild). Its only two
            consumers — ProductCarousel and EvidenceTruthPanel — were both
            retired from the composition, which would have left the homepage
            with no scrubbed heading at all and ~14 e2e tests covering a
            treatment that no longer rendered anywhere. Re-pointed rather than
            deleted: the page keeps the animation, and the coverage keeps a
            live target.

            `ink` scrubs in place as the heading enters and reserves NO scroll
            of its own. The pinned variant is banned — its 124vh of blank paper
            was the homepage's "too much empty space" and must not return. */}
        <ScrollScrubHeading
          as="h2"
          /* No `max-w-*` here. `.evidence-cinematic-heading` already sets
             `width: 100%` and `text-wrap: balance`, and at this clamp the
             display font renders ~118px, so a 20ch cap lands within a few
             pixels of the container — parking the text on a wrapping boundary
             where the browser rebalances lines as the spring settles. That
             showed up as a 7x2px box change between unresolved and resolved,
             which the layout-shift guard correctly rejected. */
          className="evidence-cinematic-heading mt-3"
          text={'Inspect the proof, claim by claim.'}
          accentWords={['claim by claim.']}
          variant="ink"
        />
        <p className="mz-body evidence-truth-lede mt-3 max-w-2xl text-[var(--vt-text-secondary)]">
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
