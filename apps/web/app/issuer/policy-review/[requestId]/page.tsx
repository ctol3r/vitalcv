import * as React from 'react';
import {
  PARTNER_CATEGORY_LABEL,
  recommendPartnerRoute,
} from '@/lib/issuer-verification/partnerRouter';
import { buildReceiptCandidateFromIssuerResponse } from '@/lib/issuer-verification/receiptCandidate';
import {
  applyPolicyReviewDecision,
  buildPolicyReviewDecision,
  canCreatePsvReceiptCandidate,
} from '@/lib/issuer-verification/policyReview';
import { POLICY_PERSISTENCE_STATE } from '@/lib/issuer-verification/policyDecisionRepo';
import {
  POLICY_REVIEW_COPY,
  policyReviewCopy,
  reviewStateCopy,
} from '@/lib/issuer-verification/statusCopy';
import type {
  IssuerResponse,
  IssuerVerificationRequest,
  PolicyReviewAction,
  VerificationClaimType,
} from '@/lib/issuer-verification/types';

/**
 * ISSUER-3 — Policy Review Decision Surface (demo render).
 *
 * The page does not persist decisions, does not write audit events,
 * and does not finalize verification. Only an accept_candidate action
 * with a ready_for_policy_review candidate produces a
 * PSVReceiptCandidate — and a PSVReceiptCandidate is itself not a
 * final PSV receipt.
 */

const ACTIONS: ReadonlyArray<{
  action: PolicyReviewAction;
  label: string;
  description: string;
}> = [
  {
    action: 'accept_candidate',
    label: 'Accept as PSV receipt candidate',
    description:
      'Mark the candidate as accepted under policy. Produces a PSV receipt candidate; it does not finalize credentialing proof.',
  },
  {
    action: 'reject_candidate',
    label: 'Reject candidate',
    description:
      'Discard the candidate. The original issuer response and evidence metadata are preserved.',
  },
  {
    action: 'request_more_info',
    label: 'Request more information',
    description:
      'Ask the issuer for additional detail. This does not verify or finalize anything.',
  },
  {
    action: 'request_release',
    label: 'Require release',
    description: 'Pause the decision until the required release form is in hand.',
  },
  {
    action: 'reroute',
    label: 'Reroute request',
    description: 'Forward the request to another office named by the issuer.',
  },
  {
    action: 'mark_conflict_review',
    label: 'Mark conflict review',
    description:
      'Open a conflict review when the response disagrees with the existing claim.',
  },
];

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function PolicyReviewPage({ params }: PageProps) {
  const { requestId } = await params;
  const isPersistenceEnabled = Boolean(process.env.ISSUER_PERSISTENCE_ENABLED);

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
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T01:00:00.000Z',
    history: [],
  };

  const response: IssuerResponse = {
    responseId: 'resp-demo',
    status: 'confirmed',
    respondedAt: '2026-04-26T01:00:00.000Z',
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

  // Demo dry-run: show what each action would produce, without
  // persisting anything. The applyPolicyReviewDecision call below is
  // representative output only.
  const dryRunAccept = applyPolicyReviewDecision(candidate, 'accept_candidate', {
    decisionId: `dec-${requestId}`,
    decidedAt: '2026-04-26T02:00:00.000Z',
    actor: {
      actorId: 'demo-reviewer',
      displayName: 'Demo Reviewer',
      role: 'demo',
    },
    rationale: 'Demo accept; not persisted.',
    recordedBy: 'demo',
    psvCandidateId: `psv-${requestId}`,
  });

  const acceptOutcome = canCreatePsvReceiptCandidate(
    candidate,
    'accept_candidate',
  );
  const reviewCopy = reviewStateCopy(
    candidate.reviewState ?? 'ready_for_policy_review',
  );

  return (
    <main
      className="min-h-screen bg-background"
      data-testid="policy-review-page"
      data-receipt-candidate-id={candidate.receiptCandidateId}
      data-review-state={candidate.reviewState}
      data-proof-tier={candidate.proofTier}
      data-decision-grade={String(candidate.decisionGrade)}
      data-can-accept={String(acceptOutcome.createdPsvReceiptCandidate)}
    >
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <header className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Policy review
          </p>
          <h1 className="text-xl font-semibold text-foreground">
            Receipt candidate {candidate.receiptCandidateId}
          </h1>
          <p
            className="text-sm text-muted-foreground"
            data-testid="policy-review-warning"
          >
            Policy review controls whether this candidate can become a PSV
            receipt. The original issuer response remains evidence, even if the
            candidate is rejected.
          </p>
        </header>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
          aria-label="Receipt candidate summary"
        >
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
              Issuer response status
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
              Review state
            </p>
            <p className="text-sm text-foreground">{reviewCopy.label}</p>
            <p className="text-xs text-muted-foreground">{reviewCopy.description}</p>
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
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5"
          aria-label="Available policy review actions"
        >
          <h2 className="text-sm font-semibold mb-3 text-foreground">
            Available actions
          </h2>
          <ul className="space-y-2" data-testid="policy-review-actions">
            {ACTIONS.map((entry) => {
              const decision = buildPolicyReviewDecision(candidate, entry.action, {
                decisionId: `dry-${entry.action}`,
                decidedAt: '2026-04-26T02:00:00.000Z',
                actor: {
                  actorId: 'demo-reviewer',
                  displayName: 'Demo Reviewer',
                  role: 'demo',
                },
                recordedBy: 'demo',
              });
              const copy = policyReviewCopy(decision.status);
              return (
                <li
                  key={entry.action}
                  className="rounded-xl border border-border/60 bg-background/40 p-3"
                  data-action={entry.action}
                  data-creates-psv-candidate={String(
                    decision.createdPsvReceiptCandidate,
                  )}
                  data-decision-status={decision.status}
                >
                  <p className="text-sm font-medium text-foreground">
                    {entry.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.description}
                  </p>
                  <p className="text-[11px] mt-1 text-muted-foreground/80">
                    Status: {copy.label} — {copy.description}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[11px] italic text-muted-foreground/80">
            Submitting on this page does not write an audit event and does not
            finalize verification. A PSV receipt candidate is not a global PSV
            receipt; promotion is gated by a separate review.
          </p>
        </section>

        <section
          className="rounded-2xl border border-border bg-card/60 p-4"
          aria-label="Dry-run outcome"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Dry-run accept outcome
          </p>
          <p
            className="text-xs text-muted-foreground"
            data-testid="dry-run-outcome"
            data-creates-psv-candidate={String(
              dryRunAccept.decision.createdPsvReceiptCandidate,
            )}
          >
            {dryRunAccept.decision.outcome.reason}
          </p>
          {dryRunAccept.psvReceiptCandidate && (
            <p
              className="text-[11px] text-muted-foreground/80 mt-1"
              data-testid="psv-candidate-tier"
              data-proof-tier={dryRunAccept.psvReceiptCandidate.proofTier}
              data-decision-grade={String(
                dryRunAccept.psvReceiptCandidate.decisionGrade,
              )}
            >
              PSV receipt candidate {dryRunAccept.psvReceiptCandidate.psvCandidateId}.
              Not final credentialing proof.
            </p>
          )}
        </section>

        <section
          className="rounded-xl border border-border/50 bg-background/30 px-4 py-3 space-y-1"
          aria-label="Persistence status"
          data-testid="persistence-status"
          data-persistence-enabled={String(isPersistenceEnabled)}
          data-automated-policy-engine={String(POLICY_PERSISTENCE_STATE.automatedPolicyEngine)}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Decision persistence
          </p>
          {isPersistenceEnabled ? (
            <p className="text-xs text-muted-foreground">
              Persistence active — submitted decisions will be written to the
              database via policyDecisionRepo. Every write requires an explicit
              reviewer action; <strong>automatedPolicyEngine: {String(POLICY_PERSISTENCE_STATE.automatedPolicyEngine)}</strong>.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Persistence inactive (ISSUER_PERSISTENCE_ENABLED not set). This
              surface is a demo render; decisions are not written to the database.
              Set ISSUER_PERSISTENCE_ENABLED to enable policyDecisionRepo writes.
            </p>
          )}
        </section>

        <section className="text-[11px] text-muted-foreground/70">
          <p data-testid="policy-review-copy">
            Policy review states keep the candidate distinct from finalized
            verification: {Object.values(POLICY_REVIEW_COPY)
              .map((s) => s.label)
              .join(' · ')}
          </p>
        </section>
      </div>
    </main>
  );
}
