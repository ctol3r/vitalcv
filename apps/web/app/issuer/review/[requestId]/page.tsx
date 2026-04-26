import * as React from 'react';
import {
  PARTNER_CATEGORY_LABEL,
  recommendPartnerRoute,
} from '@/lib/issuer-verification/partnerRouter';
import {
  buildReceiptCandidateFromIssuerResponse,
} from '@/lib/issuer-verification/receiptCandidate';
import {
  REVIEW_STATE_COPY,
  reviewStateCopy,
} from '@/lib/issuer-verification/statusCopy';
import type {
  IssuerResponse,
  IssuerVerificationRequest,
  VerificationClaimType,
} from '@/lib/issuer-verification/types';

/**
 * ISSUER-2 — Receipt-candidate review surface.
 *
 * Demo render only. The page does not persist final decisions, does
 * not write audit events, and does not mark anything as verified.
 * Submitting on this page would record a policy review action — and
 * even then, only a policy-review decision can convert a candidate
 * into a PSV receipt.
 */

const NEXT_ACTIONS: ReadonlyArray<{ key: string; label: string; description: string }> = [
  {
    key: 'review_policy',
    label: 'Review against policy',
    description:
      'Open the policy checklist for this candidate. Approval here does not finalize verification on its own.',
  },
  {
    key: 'request_corrected_details',
    label: 'Request corrected details',
    description: 'Ask the issuer to clarify or correct the response.',
  },
  {
    key: 'request_release',
    label: 'Request release',
    description:
      'Send the additional release form the issuer requires before continuing.',
  },
  {
    key: 'reroute_request',
    label: 'Reroute the request',
    description:
      'Forward the request to another office named by the issuer.',
  },
  {
    key: 'reject_candidate',
    label: 'Reject candidate',
    description:
      'Discard the candidate. This does not affect any other proof on file.',
  },
];

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function IssuerReviewPage({ params }: PageProps) {
  const { requestId } = await params;

  // Demo data — no DB read. Realistic shape so the surface exercises
  // the builder end to end.
  const claimType: VerificationClaimType = 'residency';
  const request: IssuerVerificationRequest = {
    requestId,
    claimType,
    claimSummary: 'Residency: Internal Medicine, 2018–2021',
    issuerCandidate: {
      candidateId: 'cand-demo',
      organizationName: 'Demo GME Office',
      contactRole: 'GME Coordinator',
      source: 'clinician_provided',
    },
    route: recommendPartnerRoute(claimType),
    consent: {
      consentId: 'consent-demo',
      scope: 'verify_residency',
      status: 'granted',
    },
    status: 'confirmed',
    createdAt: '2026-04-25T00:00:00.000Z',
    updatedAt: '2026-04-25T01:00:00.000Z',
    history: [],
  };

  const response: IssuerResponse = {
    responseId: 'resp-demo',
    status: 'confirmed',
    respondedAt: '2026-04-25T01:00:00.000Z',
    responderName: 'J. Doe',
    responderRole: 'Program Coordinator',
    reviewRequired: true,
    freeText: 'Confirmed completion of Internal Medicine residency 2018–2021.',
  };

  const candidate = buildReceiptCandidateFromIssuerResponse(request, response, {
    receiptCandidateId: `rc-${requestId}`,
    claimId: `claim-${requestId}`,
    auditChannel: 'issuer_response_form',
    recordedBy: 'demo',
  });

  const reviewCopy = reviewStateCopy(
    candidate.reviewState ?? 'ready_for_policy_review',
  );

  return (
    <main
      className="min-h-screen bg-background"
      data-testid="issuer-review-page"
      data-receipt-candidate-id={candidate.receiptCandidateId}
      data-review-state={candidate.reviewState}
      data-proof-tier={candidate.proofTier}
      data-decision-grade={String(candidate.decisionGrade)}
    >
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <header className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Issuer review
          </p>
          <h1 className="text-xl font-semibold text-foreground">
            Receipt candidate {candidate.receiptCandidateId}
          </h1>
          <p
            className="text-sm text-muted-foreground"
            data-testid="receipt-candidate-warning"
          >
            This is a receipt candidate, not final verification.
          </p>
        </header>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
          aria-label="Request and claim summary"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Request
            </p>
            <p className="text-sm text-foreground">{request.requestId}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Claim
            </p>
            <p className="text-sm text-foreground">{request.claimSummary}</p>
            <p className="text-xs text-muted-foreground">
              Recommended route: {PARTNER_CATEGORY_LABEL[request.route.partnerCategory]}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Issuer
            </p>
            <p className="text-sm text-foreground">
              {request.issuerCandidate.organizationName}
            </p>
            {request.issuerCandidate.contactRole && (
              <p className="text-xs text-muted-foreground">
                {request.issuerCandidate.contactRole}
              </p>
            )}
          </div>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
          aria-label="Issuer response"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Response status
            </p>
            <p className="text-sm text-foreground capitalize">
              {candidate.responseStatus?.replace(/_/g, ' ')}
            </p>
            {candidate.responseSummary && (
              <p className="text-xs text-muted-foreground mt-1">
                {candidate.responseSummary}
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Responder attribution
            </p>
            <p className="text-sm text-foreground">
              {candidate.attributedResponder?.name ?? '(unattributed)'}
            </p>
            {candidate.attributedResponder?.role && (
              <p className="text-xs text-muted-foreground">
                {candidate.attributedResponder.role}
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Source basis
            </p>
            <p className="text-sm text-foreground">
              {candidate.sourceBasis?.sourceOrganizationName}
            </p>
            {candidate.sourceBasis?.isContractedAgent && (
              <p className="text-xs text-muted-foreground">
                Responding agent: {candidate.sourceBasis.agentName}
              </p>
            )}
            {candidate.sourceBasis?.basisNote && (
              <p className="text-xs text-muted-foreground italic mt-1">
                {candidate.sourceBasis.basisNote}
              </p>
            )}
          </div>
          {candidate.limitationNote && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80">
                Limitation
              </p>
              <p className="text-xs text-muted-foreground italic">
                {candidate.limitationNote}
              </p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Review state
            </p>
            <p className="text-sm text-foreground">{reviewCopy.label}</p>
            <p className="text-xs text-muted-foreground">{reviewCopy.description}</p>
          </div>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5"
          aria-label="Next actions"
        >
          <h2 className="text-sm font-semibold mb-3 text-foreground">Next actions</h2>
          <ul className="space-y-2" data-testid="receipt-candidate-actions">
            {NEXT_ACTIONS.map((action) => (
              <li
                key={action.key}
                className="rounded-xl border border-border/60 bg-background/40 p-3"
                data-action-key={action.key}
              >
                <p className="text-sm font-medium text-foreground">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] italic text-muted-foreground/80">
            Submitting on this page does not finalize verification. Only a
            policy-review decision can convert a candidate into a PSV receipt.
          </p>
        </section>

        <section className="text-[11px] text-muted-foreground/70">
          <p data-testid="review-state-copy">
            All review states keep the candidate distinct from finalized
            verification: {Object.values(REVIEW_STATE_COPY).map((s) => s.label).join(' · ')}
          </p>
        </section>
      </div>
    </main>
  );
}
