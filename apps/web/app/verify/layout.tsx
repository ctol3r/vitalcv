import type { Metadata } from 'next';
import * as React from 'react';

/**
 * Metadata carrier for /verify.
 *
 * `app/verify/page.tsx` is a client component, so it cannot export `metadata`
 * itself — which is why the route inherited the root marketing title
 * ("VitalCV — Your career evidence, ready before your next job") and its
 * description. A verifier arriving with a shared record was told about
 * clinician job-seeking. Recorded as finding F8 of the 2026-08-09 page audit.
 *
 * Scope: this sets the default for the /verify subtree, but /verify/[npi],
 * /verify/guide and /verify/receipt/[receiptId] each export their own metadata
 * and override it. Only the bare /verify entry point is changed.
 *
 * The copy states what the page does — checks a presented proof and shows what
 * it contains — without asserting an outcome. No status word is used as a
 * claim; the result belongs to the record, not the page title.
 */
export const metadata: Metadata = {
  title: 'Check a shared record',
  description:
    'Paste a VitalCV-issued proof to see what it contains: which source answered, when it was read, its signature and its expiry — shown exactly as returned.',
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
