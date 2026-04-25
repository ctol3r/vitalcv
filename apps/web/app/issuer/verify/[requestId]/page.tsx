import * as React from 'react';
import type {
  IssuerResponseStatus,
  VerificationClaimType,
  VerificationRequestStatus,
} from '@/lib/issuer-verification/types';
import { STATUS_COPY } from '@/lib/issuer-verification/statusCopy';
import {
  PARTNER_CATEGORY_LABEL,
  recommendPartnerRoute,
} from '@/lib/issuer-verification/partnerRouter';

/**
 * ISSUER-1 — Issuer response stub.
 *
 * Demo-only render. No email is sent, no record is written, and
 * nothing on this page can mark a claim verified. Submitting on this
 * page would record an "issuer response candidate" — VitalCV does not
 * treat that as verified until the response is attributed and
 * reviewed according to policy.
 */

const RESPONSE_OPTIONS: ReadonlyArray<{
  value: IssuerResponseStatus;
  label: string;
  description: string;
}> = [
  {
    value: 'confirmed',
    label: 'Confirm',
    description: 'You confirm the claim as stated. VitalCV will record a receipt candidate for review.',
  },
  {
    value: 'partially_confirmed',
    label: 'Partially confirm',
    description: 'You confirm only part of the claim.',
  },
  {
    value: 'corrected',
    label: 'Submit a correction',
    description: 'You confirm a corrected version of the claim.',
  },
  {
    value: 'unable_to_verify',
    label: 'Unable to verify',
    description: 'You cannot verify the claim from your records.',
  },
  {
    value: 'requires_release',
    label: 'Requires a release',
    description: 'A release form is needed before you can respond.',
  },
  {
    value: 'wrong_office',
    label: 'Wrong office',
    description: 'The request should be routed to another office.',
  },
  {
    value: 'legally_only',
    label: 'Dates / identity only',
    description: 'You can confirm dates and identity only, not detail.',
  },
];

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function IssuerVerifyPage({ params }: PageProps) {
  const { requestId } = await params;

  const claimType: VerificationClaimType = 'residency';
  const claimSummary = 'Residency: Internal Medicine, 2018–2021';
  const issuerOrg = 'GME Office of Record (demo)';
  const route = recommendPartnerRoute(claimType);
  const requestStatus: VerificationRequestStatus = 'sent';
  const consentStatus: 'pending' | 'granted' = 'granted';

  return (
    <main className="min-h-screen bg-background" data-testid="issuer-verify-page">
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <header className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Issuer verification
          </p>
          <h1 className="text-xl font-semibold text-foreground">
            Verification request {requestId}
          </h1>
          <p className="text-sm text-muted-foreground">
            Responding here records an issuer response candidate. VitalCV does
            not treat this as verified until the response is attributed and
            reviewed according to policy.
          </p>
        </header>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
          aria-label="Verification request summary"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Claim
            </p>
            <p className="text-sm font-medium text-foreground">{claimSummary}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Issuer
            </p>
            <p className="text-sm text-foreground">{issuerOrg}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Recommended route
            </p>
            <p className="text-sm text-foreground">
              {PARTNER_CATEGORY_LABEL[route.partnerCategory]}
            </p>
            <p className="text-xs text-muted-foreground">{route.rationale}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Routing is a recommendation; it is not an active partner integration.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Consent
            </p>
            <p className="text-sm text-foreground capitalize">{consentStatus}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Status
            </p>
            <p className="text-sm text-foreground">{STATUS_COPY[requestStatus].label}</p>
            <p className="text-xs text-muted-foreground">
              {STATUS_COPY[requestStatus].description}
            </p>
          </div>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5"
          aria-label="Response options"
        >
          <h2 className="text-sm font-semibold mb-3 text-foreground">Choose a response</h2>
          <ul className="space-y-2" data-testid="issuer-response-options">
            {RESPONSE_OPTIONS.map((option) => (
              <li
                key={option.value}
                className="rounded-xl border border-border/60 bg-background/40 p-3"
                data-response-value={option.value}
              >
                <p className="text-sm font-medium text-foreground">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] italic text-muted-foreground/80">
            This view is a demo placeholder. No email is sent and no record is
            written from this page.
          </p>
        </section>
      </div>
    </main>
  );
}
