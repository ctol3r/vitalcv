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
import { Reveal } from '@/components/motion/Reveal';

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

  // Build the candidate first as a demo-recorded shape so the page
  // always renders even when the persistence writer is off or fails.
  const candidate = buildReceiptCandidateFromIssuerResponse(request, response, {
    receiptCandidateId: `rc-${requestId}`,
    claimId: `claim-${requestId}`,
    auditChannel: 'issuer_response_form',
    recordedBy: 'demo',
  });

  // Attempt to persist the underlying ReceiptCandidate. This page is
  // a dry-run for what each policy-review action WOULD do; nothing is
  // submitted on render. But the candidate itself is the same one
  // the /issuer/review surface (Phase 3a) already persists when the
  // flag is on, so we surface the same persistence-state banner here.
  // PolicyReviewDecision rows are NOT written by this page — those
  // need a real POST submit handler, scheduled for Phase 3d.
  //
  // Strict no-crash: dynamic import + try/catch with a default
  // outcome of transient_error/demo means any failure path renders
  // a degraded banner rather than 500-ing the page.
  type WriteOutcome =
    | { status: 'persisted'; recordedBy: 'system' }
    | { status: 'disabled'; recordedBy: 'demo' }
    | { status: 'tamper_detected'; recordedBy: 'demo' }
    | { status: 'transient_error'; recordedBy: 'demo' };
  let writeOutcome: WriteOutcome = { status: 'transient_error', recordedBy: 'demo' };
  try {
    const mod = await import('@/lib/issuer-verification/issuerPersistenceWriter');
    writeOutcome = await mod.writeReceiptCandidateRow({
      candidate,
      surface: 'review_surface',
    });
  } catch {
    // already initialized to transient_error/demo above
  }
  const persistedRecordedBy = writeOutcome.recordedBy;

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
      className="mz mz-paper mz-persona-issuer relative min-h-screen overflow-x-hidden"
      data-testid="policy-review-page"
      data-receipt-candidate-id={candidate.receiptCandidateId}
      data-review-state={candidate.reviewState}
      data-proof-tier={candidate.proofTier}
      data-decision-grade={String(candidate.decisionGrade)}
      data-can-accept={String(acceptOutcome.createdPsvReceiptCandidate)}
      data-persistence-status={writeOutcome.status}
      data-recorded-by={persistedRecordedBy}
    >
      {/* Hero — ambient wash + a clean, deliberate policy-desk header.
          Glass is reserved for the single decision-moment panel below. */}
      <section className="mz-ambient relative isolate">
        <div className="mx-auto max-w-2xl px-4 pt-14 pb-2">
          <Reveal as="header" variant="fade" className="space-y-3">
            <p className="mz-eyebrow">Policy review</p>
            <h1 className="mz-h1">
              Receipt <span className="mz-accent">candidate</span>{' '}
              <span className="mz-mono align-middle text-[0.5em] font-normal tracking-[0.06em] text-[var(--vt-text-secondary)]">
                {candidate.receiptCandidateId}
              </span>
            </h1>
            <p
              className="mz-body text-[var(--vt-text-secondary)]"
              data-testid="policy-review-warning"
            >
              Policy review controls whether this candidate can become a PSV
              receipt. The original issuer response remains evidence, even if the
              candidate is rejected.
            </p>
            {writeOutcome.status === 'persisted' && (
              <p
                className="mt-2 inline-block rounded-[4px] border px-2.5 py-1 mz-mono text-[10px] font-medium uppercase tracking-[0.08em]"
                style={{ background: 'var(--ok-bg)', color: 'var(--ok)', borderColor: 'var(--ok-rule)' }}
                data-testid="persistence-banner"
                data-banner-state="persisted"
              >
                Candidate row recorded (recordedBy: system)
              </p>
            )}
            {writeOutcome.status === 'tamper_detected' && (
              <p
                className="mt-2 inline-block rounded-[4px] border px-2.5 py-1 mz-mono text-[10px] font-medium uppercase tracking-[0.08em]"
                style={{ background: 'var(--watch-bg)', color: 'var(--watch)', borderColor: 'var(--watch-rule)' }}
                data-testid="persistence-banner"
                data-banner-state="tamper_detected"
              >
                Candidate row CHECK violation — render only (recordedBy: demo)
              </p>
            )}
            {writeOutcome.status === 'transient_error' && (
              <p
                className="mt-2 inline-block rounded-[4px] border px-2.5 py-1 mz-mono text-[10px] font-medium uppercase tracking-[0.08em]"
                style={{ background: 'var(--unknown-bg)', color: 'var(--unknown)', borderColor: 'var(--unknown-rule)' }}
                data-testid="persistence-banner"
                data-banner-state="transient_error"
              >
                Persistence unavailable — render only (recordedBy: demo)
              </p>
            )}
            {writeOutcome.status === 'disabled' && (
              <p
                className="mt-2 inline-block rounded-[4px] border px-2.5 py-1 mz-mono text-[10px] font-medium uppercase tracking-[0.08em]"
                style={{ background: 'var(--unknown-bg)', color: 'var(--unknown)', borderColor: 'var(--unknown-rule)' }}
                data-testid="persistence-banner"
                data-banner-state="disabled"
              >
                Persistence disabled — render only (recordedBy: demo)
              </p>
            )}
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 space-y-5">
        <Reveal
          as="section"
          className="mz-card p-6 space-y-5"
          aria-label="Receipt candidate summary"
        >
          <div>
            <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              Claim
            </p>
            <p className="mz-body mt-1 text-[var(--vt-text-primary)]">{request.claimSummary}</p>
            <p className="mz-small mt-1 text-[var(--vt-text-secondary)]">
              Recommended route: {PARTNER_CATEGORY_LABEL[request.route.partnerCategory]}
            </p>
          </div>
          <div>
            <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              Issuer response status
            </p>
            <p className="mz-body mt-1 capitalize text-[var(--vt-text-primary)]">
              {candidate.responseStatus?.replace(/_/g, ' ')}
            </p>
            {candidate.responseSummary && (
              <p className="mz-small mt-1 text-[var(--vt-text-secondary)]">
                {candidate.responseSummary}
              </p>
            )}
          </div>
          <div>
            <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              Review state
            </p>
            <p className="mz-body mt-1 text-[var(--vt-text-primary)]">{reviewCopy.label}</p>
            <p className="mz-small mt-1 text-[var(--vt-text-secondary)]">{reviewCopy.description}</p>
          </div>
          <div>
            <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              Responder attribution
            </p>
            <p className="mz-body mt-1 text-[var(--vt-text-primary)]">
              {candidate.attributedResponder?.name ?? '(unattributed)'}
            </p>
            {candidate.attributedResponder?.role && (
              <p className="mz-small mt-1 text-[var(--vt-text-secondary)]">
                {candidate.attributedResponder.role}
              </p>
            )}
          </div>
          <div>
            <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
              Source basis
            </p>
            <p className="mz-body mt-1 text-[var(--vt-text-primary)]">
              {candidate.sourceBasis?.sourceOrganizationName}
            </p>
            {candidate.sourceBasis?.isContractedAgent && (
              <p className="mz-small mt-1 text-[var(--vt-text-secondary)]">
                Responding agent: {candidate.sourceBasis.agentName}
              </p>
            )}
            {candidate.sourceBasis?.basisNote && (
              <p className="mz-small mt-1 italic text-[var(--vt-text-secondary)]">
                {candidate.sourceBasis.basisNote}
              </p>
            )}
          </div>
          {candidate.limitationNote && (
            <div className="space-y-2">
              <span className="mz-chip mz-chip-watch">
                <span className="mz-gl" aria-hidden="true" />
                Limitation
              </span>
              <p className="mz-small italic text-[var(--vt-text-secondary)]">
                {candidate.limitationNote}
              </p>
            </div>
          )}
        </Reveal>

        {/* Decision moment — the single elevated glass panel. */}
        <Reveal
          as="section"
          delay={80}
          className="mz-glass rounded-[12px] p-6"
          aria-label="Available policy review actions"
        >
          <h2 className="mz-h2">Available actions</h2>
          <ul className="mt-4 space-y-2.5" data-testid="policy-review-actions">
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
                  className="mz-glass-inset rounded-[10px] p-4"
                  data-action={entry.action}
                  data-creates-psv-candidate={String(
                    decision.createdPsvReceiptCandidate,
                  )}
                  data-decision-status={decision.status}
                >
                  <p className="mz-body font-medium text-[var(--vt-text-primary)]">
                    {entry.label}
                  </p>
                  <p className="mz-small mt-0.5 text-[var(--vt-text-secondary)]">
                    {entry.description}
                  </p>
                  <p className="mz-small mt-1 text-[var(--vt-text-muted)]">
                    Status: {copy.label} — {copy.description}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 mz-small italic text-[var(--vt-text-muted)]">
            Submitting on this page does not write an audit event and does not
            finalize verification. A PSV receipt candidate is not a global PSV
            receipt; promotion is gated by a separate review.
          </p>
        </Reveal>

        <Reveal
          as="section"
          delay={120}
          className="mz-card p-6"
          aria-label="Dry-run outcome"
        >
          <p className="mz-mono text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
            Dry-run accept outcome
          </p>
          <p
            className="mz-small mt-1 text-[var(--vt-text-secondary)]"
            data-testid="dry-run-outcome"
            data-creates-psv-candidate={String(
              dryRunAccept.decision.createdPsvReceiptCandidate,
            )}
          >
            {dryRunAccept.decision.outcome.reason}
          </p>
          {dryRunAccept.psvReceiptCandidate && (
            <p
              className="mz-small mt-1 text-[var(--vt-text-muted)]"
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
        </Reveal>

        <Reveal
          as="section"
          delay={160}
          className="border-t border-[var(--vt-border-subtle)] pt-6"
        >
          <p
            data-testid="policy-review-copy"
            className="mz-small text-[var(--vt-text-muted)]"
          >
            Policy review states keep the candidate distinct from finalized
            verification: {Object.values(POLICY_REVIEW_COPY)
              .map((s) => s.label)
              .join(' · ')}
          </p>
        </Reveal>
      </div>
    </main>
  );
}
