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
 * `apps/web/__tests__/status-attribution-receipts.test.tsx`):
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

// Shared caches must converge quickly after a release. Railway busts its edge on
// deploy, but external caches do not; five minutes bounds stale public copy.
//
// This is the source ATTRIBUTION register — the page whose entire job is to say
// which source said what, and under what limitation. Those claims are compiled
// into the build rather than fetched, so with no bound a shared cache serves a
// year-old attribution answer after the register has changed. Of every public
// route, this is the one where stale is least acceptable. It was serving
// `s-maxage=31536000` because it never declared a revalidate at all.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Source Attribution · VitalCV',
  description: TRUST_ATTRIBUTION_DISCLAIMER,
};

export default function TrustAttributionPage() {
  return (
    // Light theme on purpose: CD-14 fixes the public tier as paper, light
    // only. This page shipped as the site's one hardcoded-dark surface
    // (bg-gray-950) with its own second header stacked under the global
    // chrome; both are gone. font-mono stays — receipt-document typography
    // is the register's style, not a theme.
    <div className="min-h-screen bg-[var(--vt-bg)] font-mono text-[var(--vt-text-primary)]">
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-sm font-bold uppercase tracking-tight">Source attribution</h1>
          <p className="mt-1 text-[11px] text-[var(--vt-text-muted)]">
            Per-field register; receipt-document style.
          </p>
        </div>

        <section
          data-trust-attribution-disclaimer=""
          aria-labelledby="trust-attribution-disclaimer-heading"
          className="border border-[var(--vt-border)]"
        >
          <div className="border-b border-[var(--vt-border)] px-4 py-2">
            <h2
              id="trust-attribution-disclaimer-heading"
              className="text-[10px] font-bold uppercase tracking-widest text-[var(--vt-text-secondary)]"
            >
              Disclosure
            </h2>
          </div>
          <div className="px-4 py-3 text-xs leading-relaxed text-[var(--vt-text-secondary)]">
            <p>{TRUST_ATTRIBUTION_DISCLAIMER}</p>
            <p className="mt-2 text-[10px] text-[var(--vt-text-muted)]">
              This is a public register. Source, retrieval time, and state are
              recorded per field. Institution review remains the final step for
              credentialing decisions.
            </p>
          </div>
        </section>

        <TrustAttributionRegister />

        <p className="text-center text-[10px] text-[var(--vt-text-muted)]">
          Source of truth for connector states:{' '}
          <Link href="/status" className="underline hover:text-[var(--vt-text-secondary)]">
            /status
          </Link>
          {' · '}
          Trust doctrine:{' '}
          <Link href="/trust" className="underline hover:text-[var(--vt-text-secondary)]">
            /trust
          </Link>
        </p>
      </main>
    </div>
  );
}
