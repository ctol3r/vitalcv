/**
 * /trust/attribution — Receipt-document source attribution register.
 *
 * Public SSR page. No auth required.
 *
 * Per-field register: field, source, when we read it, current state,
 * institution-review boundary. Opens with the canonical
 * we-do-not-claim disclaimer.
 *
 * Truth-contract guarantees (enforced by
 * `apps/web/__tests__/trust-attribution-page.test.tsx`):
 *  - Opening disclaimer contains the contracted phrase: "We publish
 *    the source of every field. We do not claim HIPAA, SOC 2, or
 *    NCQA certification."
 *  - No claim of `source-backed` for OIG / PECOS / STATE_BOARD /
 *    FSMB / NURSYS rows.
 *  - No bare "Verified", no "cleared", no "approved", no
 *    "complete credentialing".
 */

import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  TRUST_ATTRIBUTION_DISCLAIMER,
  TrustAttributionRegister,
} from '@/components/trust/TrustAttributionRegister';

export const metadata: Metadata = {
  title: 'Source Attribution · VitalCV',
  description: TRUST_ATTRIBUTION_DISCLAIMER,
};

export default function TrustAttributionPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">
      <header className="border-b border-gray-800 px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">
              VitalCV · Source attribution
            </h1>
            <p className="mt-1 text-[10px] text-gray-500">
              Per-field register; receipt-document style.
            </p>
          </div>
          <Link
            href="/"
            /* 10px type gave a 78x12 target on production — under the 24px
               WCAG 2.5.8 floor. Transparent ::before overlay lifts the hit
               area without changing the type scale or the header layout. */
            className="relative text-[10px] text-gray-500 underline underline-offset-2 hover:text-gray-300 before:absolute before:left-0 before:top-1/2 before:h-6 before:w-full before:-translate-y-1/2 before:content-['']"
          >
            ← vitalcv.com
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <section
          data-trust-attribution-disclaimer=""
          aria-labelledby="trust-attribution-disclaimer-heading"
          className="border border-gray-800"
        >
          <div className="border-b border-gray-800 px-4 py-2">
            <h2
              id="trust-attribution-disclaimer-heading"
              className="text-[10px] font-bold uppercase tracking-widest text-gray-400"
            >
              Disclosure
            </h2>
          </div>
          <div className="px-4 py-3 text-xs leading-relaxed text-gray-300">
            <p>{TRUST_ATTRIBUTION_DISCLAIMER}</p>
            <p className="mt-2 text-[10px] text-gray-500">
              This is a public register. Source, retrieval time, and state are
              recorded per field. Institution review remains the final step for
              credentialing decisions.
            </p>
          </div>
        </section>

        <TrustAttributionRegister />

        <p className="text-center text-[9px] text-gray-700">
          Source of truth for connector states:{' '}
          <Link href="/status" className="underline hover:text-gray-500">
            /status
          </Link>
          {' · '}
          Trust doctrine:{' '}
          <Link href="/trust" className="underline hover:text-gray-500">
            /trust
          </Link>
        </p>
      </main>
    </div>
  );
}
