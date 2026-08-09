import type { Metadata } from 'next';
import Link from 'next/link';
import { EmployerGetStartedClient } from '../EmployerGetStartedClient';
import { PageFrame } from '@/components/layout/PageFrame';

/**
 * /employers/request-access — Step 1, on its own route.
 *
 * Split out of /employers by the 2026-08-06 founder experience audit: the
 * form lived at 96% of a 5,744px page behind a 5,100px anchor scroll, which
 * offered a data-entry task before the page had made its case. The landing
 * page now sells; this route converts.
 *
 * The boundary is unchanged and load-bearing: resolving a Type 2 NPI against
 * NPPES establishes WHICH organization is meant. It is not authority to act
 * for that organization, and the server refuses on exactly that basis
 * (resolveOrganizationAuthority). Access is requested, never claimed —
 * "claim your organization" is a retired phrasing the platform will not
 * honour on an NPI alone (organization-access-copy contract).
 */

// Bound external shared-cache staleness to 5 min (see app/page.tsx note).
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Request organization access',
  description:
    'Resolve your organization against NPPES, the federal source of record, and request access. Resolution identifies the organization — access is granted, never claimed.',
};

export default function RequestOrganizationAccessPage() {
  return (
    <div className="mz mz-paper mz-persona-employer min-h-screen">
      <PageFrame as="main" mode="focused-form">
        <header className="mb-5">
          <p className="mz-eyebrow">Step 1 — Request organization access</p>
          <h1 className="mz-h1" style={{ marginTop: 12, maxWidth: 680 }}>
            Find your organization, then request access
          </h1>
          <p className="mz-small" style={{ marginTop: 8, maxWidth: 620 }}>
            Your organization has a Type 2 NPI in the same federal registry a clinician uses,
            resolved against NPPES, the federal source of record. That resolves <em>which</em>{' '}
            organization you mean — never that you may act for it, so access is a request that has
            to be granted.
          </p>
        </header>

        <section
          id="request-organization-access"
          className="mz-card p-5 sm:p-6"
          aria-label="Request organization access"
        >
          <EmployerGetStartedClient />
        </section>

        <p className="mt-6 text-center text-xs text-[var(--vt-text-muted)]">
          A network or health system?{' '}
          <Link href="/pilot" className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
            Request a pilot
          </Link>{' '}
          · Not ready yet?{' '}
          <Link href="/employers" className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
            Back to the employer overview
          </Link>
        </p>
      </PageFrame>
    </div>
  );
}
