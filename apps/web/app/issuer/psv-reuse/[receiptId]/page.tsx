import * as React from 'react';
import {
  buildPsvReceiptReuseDecision,
  explainPsvReceiptReuseDecision,
  markPsvReceiptRevoked,
  markPsvReceiptSuperseded,
} from '@/lib/issuer-verification/psvReceiptReuse';
import {
  PSV_RECEIPT_REUSE_COPY,
  psvReceiptReuseCopy,
} from '@/lib/issuer-verification/statusCopy';
import type {
  PolicyReviewActor,
  PSVReceipt,
  PSVReceiptScope,
  PSVReceiptLimitation,
} from '@/lib/issuer-verification/types';
import type {
  PSVReceiptReuseScope,
  PSVReceiptRevocationState,
  PSVReceiptSupersession,
} from '@/lib/issuer-verification/psvReceiptReuse';

/**
 * ISSUER-5 — PSV Receipt Reuse + Revocation review surface (demo).
 *
 * The page does not persist a decision, does not call source APIs,
 * does not actively monitor revocation, and does not write a real
 * audit-event row.
 */

const ACTOR: PolicyReviewActor = {
  actorId: 'demo-reviewer',
  displayName: 'Demo Reviewer',
  role: 'demo',
};

const NEXT_ACTIONS: ReadonlyArray<{ key: string; label: string; description: string }> = [
  {
    key: 'reuse_as_scoped_evidence',
    label: 'Reuse as scoped evidence',
    description:
      'Treat this receipt as scoped evidence within its existing scope, limitations, and freshness. Does not guarantee verifier acceptance.',
  },
  {
    key: 'request_refresh',
    label: 'Request refresh',
    description:
      'Open a refresh request for this receipt before relying on it for the new purpose.',
  },
  {
    key: 'route_to_policy_review',
    label: 'Route to policy review',
    description:
      'Route the reuse request through policy review before treating the receipt as scoped evidence for this purpose.',
  },
  {
    key: 'reject_reuse',
    label: 'Reject reuse',
    description:
      'Decline the reuse request. The original receipt and its provenance metadata are preserved.',
  },
  {
    key: 'mark_superseded',
    label: 'Mark superseded',
    description:
      'Record that a newer receipt supersedes this one. Reuse is blocked from this point forward.',
  },
  {
    key: 'mark_revoked',
    label: 'Mark revoked',
    description:
      'Record a revocation against this receipt. VitalCV records revocations when reported; it does not poll sources.',
  },
];

interface PageProps {
  params: Promise<{ receiptId: string }>;
}

export default async function PsvReuseReviewPage({ params }: PageProps) {
  const { receiptId } = await params;

  const scope: PSVReceiptScope = {
    claimType: 'residency',
    covers:
      'Confirms completion of the named residency program with the named source for the stated dates.',
    doesNotCover:
      'Does not confirm board certification, license status, malpractice history, or any other claim.',
    sourceOrganizationName: 'Demo GME Office',
  };

  const limitations: PSVReceiptLimitation[] = [];

  const receipt: PSVReceipt = {
    psvReceiptId: receiptId,
    psvCandidateId: `psv-${receiptId}`,
    receiptCandidateId: `rc-${receiptId}`,
    requestId: `req-${receiptId}`,
    claimId: `claim-${receiptId}`,
    claimType: 'residency',
    promotedAt: '2026-04-01T00:00:00.000Z',
    promotedBy: ACTOR,
    sourceBasis: {
      sourceOrganizationName: 'Demo GME Office',
      isContractedAgent: false,
      basisNote: 'Response provided directly by the source of record.',
    },
    attributedResponder: {
      name: 'J. Doe',
      role: 'Program Coordinator',
      attributedAt: '2026-04-01T01:00:00.000Z',
      attributionMethod: 'self_attested',
    },
    scope,
    limitations,
    freshness: {
      ttlDays: 365,
      issuedAt: '2026-04-01T00:00:00.000Z',
      staleAfter: '2027-04-01T00:00:00.000Z',
    },
    proofTier: 'psv_receipt',
    decisionGrade: true,
    globalCredentialTruth: false,
    auditMetadata: {
      recordedAt: '2026-04-01T00:00:00.000Z',
      recordedBy: 'review_surface',
      eventState: 'pending_not_written',
      notes: 'Demo audit metadata; the promotion surface does not write a real audit-event row.',
    },
  };

  const reuseScope: PSVReceiptReuseScope = {
    claimType: 'residency',
    sourceOrganizationName: 'Demo GME Office',
    purpose:
      'Re-use this PSV receipt as scoped evidence for an internal medicine residency claim on a new pilot application.',
  };

  // Demo modeled state — caller-controlled, no live monitoring.
  const revocation: PSVReceiptRevocationState = {
    state: 'not_revoked',
    source: 'demo',
  };
  const supersession: PSVReceiptSupersession = {
    state: 'not_superseded',
    source: 'demo',
  };

  const decision = buildPsvReceiptReuseDecision(
    {
      receipt,
      reuseScope,
      nowIso: '2026-04-26T00:00:00.000Z',
      revocation,
      supersession,
      refreshSoftThresholdDays: 30,
    },
    {
      decisionId: `reuse-${receiptId}`,
      decidedAt: '2026-04-26T00:00:00.000Z',
      recordedBy: 'demo',
    },
  );

  // Dry-run revocation/supersession examples for the page (these are
  // pure helpers; not persisted).
  const dryRunRevocation = markPsvReceiptRevoked({
    revokedAt: '2026-04-26T01:00:00.000Z',
    revokedBy: 'demo-reviewer',
    reason: 'Demo: example of recorded revocation.',
    source: 'demo',
  });
  const dryRunSupersession = markPsvReceiptSuperseded({
    supersedingReceiptId: 'psv-receipt-newer',
    supersededAt: '2026-04-26T02:00:00.000Z',
    source: 'demo',
  });

  const stateCopy = psvReceiptReuseCopy(decision.status);

  return (
    <main
      className="min-h-screen bg-background"
      data-testid="psv-reuse-page"
      data-receipt-id={receipt.psvReceiptId}
      data-reuse-status={decision.status}
      data-reusable={String(decision.reusable)}
      data-global-credential-truth={String(decision.globalCredentialTruth)}
      data-freshness-state={decision.freshness.state}
      data-revocation-state={decision.revocation.state}
      data-supersession-state={decision.supersession.state}
      data-audit-event-state={decision.auditMetadata.eventState}
    >
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-8">
        <header className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            PSV receipt reuse review
          </p>
          <h1 className="text-xl font-semibold text-foreground">
            Reuse review {receipt.psvReceiptId}
          </h1>
          <p
            className="text-sm text-muted-foreground"
            data-testid="psv-reuse-warning"
          >
            Reuse means this receipt may be considered as scoped evidence. It
            does not guarantee verifier acceptance, finalize credentialing
            review, or imply current source truth.
          </p>
        </header>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
          aria-label="Receipt summary"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Source basis
            </p>
            <p className="text-sm text-foreground">
              {receipt.sourceBasis.sourceOrganizationName}
            </p>
            {receipt.sourceBasis.isContractedAgent && (
              <p className="text-xs text-muted-foreground">
                Responding agent: {receipt.sourceBasis.agentName}
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Responder attribution
            </p>
            <p className="text-sm text-foreground">
              {receipt.attributedResponder.name}
            </p>
            {receipt.attributedResponder.role && (
              <p className="text-xs text-muted-foreground">
                {receipt.attributedResponder.role}
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Original limitations
            </p>
            {receipt.limitations.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                None recorded for this receipt.
              </p>
            ) : (
              <ul className="text-xs text-muted-foreground space-y-1">
                {receipt.limitations.map((l, i) => (
                  <li key={i}>
                    <strong>{l.kind}:</strong> {l.description}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5 space-y-3"
          aria-label="Freshness, revocation, supersession"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Freshness window
            </p>
            <p className="text-xs text-muted-foreground">
              State: {decision.freshness.state}; {decision.freshness.daysRemaining} days remaining; stale after {decision.freshness.staleAfter}.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Revocation state (modeled, not actively monitored)
            </p>
            <p className="text-xs text-muted-foreground">
              State: {decision.revocation.state}.
              {decision.revocation.state === 'revoked' && decision.revocation.reason
                ? ` Reason: ${decision.revocation.reason}.`
                : ''}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Supersession state
            </p>
            <p className="text-xs text-muted-foreground">
              State: {decision.supersession.state}.
              {decision.supersession.state === 'superseded'
                ? ` Superseded by: ${decision.supersession.supersedingReceiptId}.`
                : ''}
            </p>
          </div>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5"
          aria-label="Reuse decision"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Reuse decision
          </p>
          <p className="text-sm text-foreground">{stateCopy.label}</p>
          <p
            className="text-xs text-muted-foreground"
            data-testid="psv-reuse-explanation"
          >
            {explainPsvReceiptReuseDecision(decision)}
          </p>
          <p className="mt-2 text-[11px] italic text-muted-foreground/80">
            Requested purpose: {reuseScope.purpose}
          </p>
        </section>

        <section
          className="rounded-2xl border border-border bg-card p-5"
          aria-label="Available next actions"
        >
          <h2 className="text-sm font-semibold mb-3 text-foreground">
            Next actions
          </h2>
          <ul className="space-y-2" data-testid="psv-reuse-actions">
            {NEXT_ACTIONS.map((action) => (
              <li
                key={action.key}
                className="rounded-xl border border-border/60 bg-background/40 p-3"
                data-action-key={action.key}
              >
                <p className="text-sm font-medium text-foreground">
                  {action.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {action.description}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] italic text-muted-foreground/80">
            Submitting on this page does not write an audit event and does not
            finalize verifier acceptance. VitalCV records revocations and
            supersessions when reported; it does not poll source systems.
          </p>
        </section>

        <section className="text-[11px] text-muted-foreground/70">
          <p data-testid="psv-reuse-copy">
            Reuse lifecycle copy:{' '}
            {Object.values(PSV_RECEIPT_REUSE_COPY)
              .map((s) => s.label)
              .join(' · ')}
          </p>
          <p
            className="mt-2"
            data-testid="psv-reuse-dry-run-revocation"
            data-revoked-state={dryRunRevocation.state}
            data-superseded-state={dryRunSupersession.state}
          >
            Dry-run revocation: {dryRunRevocation.state} (recorded, not polled).
            Dry-run supersession: {dryRunSupersession.state} by{' '}
            {dryRunSupersession.supersedingReceiptId}.
          </p>
        </section>
      </div>
    </main>
  );
}
