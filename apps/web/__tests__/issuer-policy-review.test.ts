import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildReceiptCandidateFromIssuerResponse } from '../lib/issuer-verification/receiptCandidate';
import {
  applyPolicyReviewDecision,
  buildPolicyReviewDecision,
  buildPsvReceiptCandidate,
  canCreatePsvReceiptCandidate,
  policyReviewStatusForAction,
} from '../lib/issuer-verification/policyReview';
import { recommendPartnerRoute } from '../lib/issuer-verification/partnerRouter';
import {
  POLICY_REVIEW_COPY,
  policyReviewCopy,
} from '../lib/issuer-verification/statusCopy';
import type {
  IssuerResponse,
  IssuerResponseStatus,
  IssuerVerificationRequest,
  PolicyReviewAction,
  PolicyReviewActor,
  ReceiptCandidate,
} from '../lib/issuer-verification/types';

// Banned tokens are split + joined so a naive grep over this test
// file does not flag the file itself; runtime assertions still prove
// they are absent from real output.
const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

const ACTOR: PolicyReviewActor = {
  actorId: 'actor-1',
  displayName: 'Pat Reviewer',
  role: 'policy_reviewer',
};

function makeRequest(
  overrides: Partial<IssuerVerificationRequest> = {},
): IssuerVerificationRequest {
  const claimType = overrides.claimType ?? 'residency';
  return {
    requestId: 'req-1',
    claimType,
    claimSummary: 'Residency: Internal Medicine',
    issuerCandidate: {
      candidateId: 'cand-1',
      organizationName: 'Demo GME Office',
      source: 'clinician_provided',
    },
    route: recommendPartnerRoute(claimType),
    consent: {
      consentId: 'consent-1',
      scope: 'verify_residency',
      status: 'granted',
    },
    status: 'sent',
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
    history: [],
    ...overrides,
  };
}

function makeResponse(
  overrides: Partial<IssuerResponse> = {},
): IssuerResponse {
  return {
    responseId: 'resp-1',
    status: 'confirmed',
    respondedAt: '2026-04-26T01:00:00.000Z',
    responderName: 'Jane Doe',
    responderRole: 'Program Coordinator',
    reviewRequired: true,
    ...overrides,
  };
}

function buildCandidate(
  status: IssuerResponseStatus,
  reqOverrides: Partial<IssuerVerificationRequest> = {},
): ReceiptCandidate {
  return buildReceiptCandidateFromIssuerResponse(
    makeRequest(reqOverrides),
    makeResponse({ status }),
    { receiptCandidateId: 'rc-1', claimId: 'claim-1' },
  );
}

function decisionOptions(action: PolicyReviewAction) {
  return {
    decisionId: `dec-${action}`,
    decidedAt: '2026-04-26T02:00:00.000Z',
    actor: ACTOR,
    recordedBy: 'demo' as const,
    psvCandidateId: `psv-${action}`,
  };
}

describe('Policy review action -> status mapping', () => {
  it('accept_candidate -> accepted_as_psv_candidate', () => {
    expect(policyReviewStatusForAction('accept_candidate')).toBe(
      'accepted_as_psv_candidate',
    );
  });
  it('reject_candidate -> rejected', () => {
    expect(policyReviewStatusForAction('reject_candidate')).toBe('rejected');
  });
  it('request_more_info -> request_more_info', () => {
    expect(policyReviewStatusForAction('request_more_info')).toBe(
      'request_more_info',
    );
  });
  it('request_release -> requires_release', () => {
    expect(policyReviewStatusForAction('request_release')).toBe(
      'requires_release',
    );
  });
  it('reroute -> reroute_required', () => {
    expect(policyReviewStatusForAction('reroute')).toBe('reroute_required');
  });
  it('mark_conflict_review -> conflict_review_required', () => {
    expect(policyReviewStatusForAction('mark_conflict_review')).toBe(
      'conflict_review_required',
    );
  });
  it('cancel -> canceled', () => {
    expect(policyReviewStatusForAction('cancel')).toBe('canceled');
  });
});

describe('canCreatePsvReceiptCandidate', () => {
  it('accept_candidate on ready_for_policy_review returns createdPsvReceiptCandidate=true', () => {
    const candidate = buildCandidate('confirmed');
    expect(candidate.reviewState).toBe('ready_for_policy_review');
    const outcome = canCreatePsvReceiptCandidate(candidate, 'accept_candidate');
    expect(outcome.createdPsvReceiptCandidate).toBe(true);
    expect(outcome.refusalGate).toBeUndefined();
  });

  it('accept_candidate on review_required is refused with review_state_not_ready', () => {
    const candidate = buildCandidate('partially_confirmed');
    expect(candidate.reviewState).toBe('review_required');
    const outcome = canCreatePsvReceiptCandidate(candidate, 'accept_candidate');
    expect(outcome.createdPsvReceiptCandidate).toBe(false);
    expect(outcome.refusalGate).toBe('review_state_not_ready');
  });

  it('accept_candidate on conflict_review_required is refused with conflict_review_unresolved', () => {
    const candidate = buildCandidate('corrected');
    expect(candidate.reviewState).toBe('conflict_review_required');
    const outcome = canCreatePsvReceiptCandidate(candidate, 'accept_candidate');
    expect(outcome.createdPsvReceiptCandidate).toBe(false);
    expect(outcome.refusalGate).toBe('conflict_review_unresolved');
  });

  it('accept_candidate on legally_only is refused (review_state_not_ready) — primary gate', () => {
    const candidate = buildCandidate('legally_only');
    expect(candidate.reviewState).toBe('review_required');
    const outcome = canCreatePsvReceiptCandidate(candidate, 'accept_candidate');
    expect(outcome.createdPsvReceiptCandidate).toBe(false);
    expect(outcome.refusalGate).toBe('review_state_not_ready');
  });

  it('legally_only requires limitation note even if review state is misrouted (defense-in-depth)', () => {
    // Construct a hypothetical misrouted candidate: legally_only with
    // ready_for_policy_review review state and no limitation note.
    const candidate: ReceiptCandidate = {
      ...buildCandidate('legally_only'),
      reviewState: 'ready_for_policy_review',
      limitationNote: undefined,
    };
    const outcome = canCreatePsvReceiptCandidate(candidate, 'accept_candidate');
    expect(outcome.createdPsvReceiptCandidate).toBe(false);
    expect(outcome.refusalGate).toBe('legally_only_requires_limitation_note');
  });

  it('legally_only with a limitation note can proceed when review state is ready_for_policy_review', () => {
    const candidate: ReceiptCandidate = {
      ...buildCandidate('legally_only'),
      reviewState: 'ready_for_policy_review',
      limitationNote: 'Issuer confirmed dates and identity only.',
    };
    const outcome = canCreatePsvReceiptCandidate(candidate, 'accept_candidate');
    expect(outcome.createdPsvReceiptCandidate).toBe(true);
  });

  it('wrong_office cannot create a PSVReceiptCandidate even with ready_for_policy_review', () => {
    const candidate: ReceiptCandidate = {
      ...buildCandidate('wrong_office'),
      reviewState: 'ready_for_policy_review',
    };
    const outcome = canCreatePsvReceiptCandidate(candidate, 'accept_candidate');
    expect(outcome.createdPsvReceiptCandidate).toBe(false);
    expect(outcome.refusalGate).toBe('wrong_office_cannot_create_candidate');
  });

  it('unable_to_verify cannot create a PSVReceiptCandidate even with ready_for_policy_review', () => {
    const candidate: ReceiptCandidate = {
      ...buildCandidate('unable_to_verify'),
      reviewState: 'ready_for_policy_review',
    };
    const outcome = canCreatePsvReceiptCandidate(candidate, 'accept_candidate');
    expect(outcome.createdPsvReceiptCandidate).toBe(false);
    expect(outcome.refusalGate).toBe(
      'unable_to_verify_cannot_create_candidate',
    );
  });

  it.each<PolicyReviewAction>([
    'reject_candidate',
    'request_more_info',
    'request_release',
    'reroute',
    'mark_conflict_review',
    'cancel',
  ])('%s never creates a PSVReceiptCandidate', (action) => {
    const candidate = buildCandidate('confirmed');
    const outcome = canCreatePsvReceiptCandidate(candidate, action);
    expect(outcome.createdPsvReceiptCandidate).toBe(false);
    expect(outcome.refusalGate).toBe('action_does_not_create_candidate');
  });
});

describe('applyPolicyReviewDecision', () => {
  it('accept_candidate on ready_for_policy_review creates a PSVReceiptCandidate', () => {
    const candidate = buildCandidate('confirmed');
    const result = applyPolicyReviewDecision(
      candidate,
      'accept_candidate',
      decisionOptions('accept_candidate'),
    );
    expect(result.decision.createdPsvReceiptCandidate).toBe(true);
    expect(result.psvReceiptCandidate).toBeDefined();
    expect(result.psvReceiptCandidate?.proofTier).toBe('psv_receipt_candidate');
    expect(result.psvReceiptCandidate?.decisionGrade).toBe(false);
  });

  it('accept_candidate on review_required does not create a PSVReceiptCandidate', () => {
    const candidate = buildCandidate('partially_confirmed');
    const result = applyPolicyReviewDecision(
      candidate,
      'accept_candidate',
      decisionOptions('accept_candidate'),
    );
    expect(result.decision.createdPsvReceiptCandidate).toBe(false);
    expect(result.psvReceiptCandidate).toBeUndefined();
    expect(result.decision.outcome.refusalGate).toBe('review_state_not_ready');
  });

  it('accept_candidate on conflict_review_required does not create a PSVReceiptCandidate', () => {
    const candidate = buildCandidate('corrected');
    const result = applyPolicyReviewDecision(
      candidate,
      'accept_candidate',
      decisionOptions('accept_candidate'),
    );
    expect(result.decision.createdPsvReceiptCandidate).toBe(false);
    expect(result.psvReceiptCandidate).toBeUndefined();
    expect(result.decision.outcome.refusalGate).toBe(
      'conflict_review_unresolved',
    );
  });

  it('request_more_info does not verify and does not create a PSVReceiptCandidate', () => {
    const candidate = buildCandidate('confirmed');
    const result = applyPolicyReviewDecision(
      candidate,
      'request_more_info',
      decisionOptions('request_more_info'),
    );
    expect(result.decision.status).toBe('request_more_info');
    expect(result.decision.createdPsvReceiptCandidate).toBe(false);
    expect(result.psvReceiptCandidate).toBeUndefined();
  });

  it('reject_candidate preserves the underlying candidate (evidence preservation)', () => {
    const candidate = buildCandidate('confirmed');
    const result = applyPolicyReviewDecision(
      candidate,
      'reject_candidate',
      decisionOptions('reject_candidate'),
    );
    expect(result.decision.status).toBe('rejected');
    expect(result.preservedCandidate).toBe(candidate);
    expect(result.preservedCandidate.candidateId).toBe(candidate.candidateId);
    expect(result.preservedCandidate.auditMetadata).toEqual(
      candidate.auditMetadata,
    );
    expect(result.preservedCandidate.attributedResponder).toEqual(
      candidate.attributedResponder,
    );
  });

  it('reject does not affect another candidate built from a separate response', () => {
    const candidateA = buildCandidate('confirmed');
    const candidateB = buildCandidate('confirmed', {
      requestId: 'req-2',
    });
    applyPolicyReviewDecision(
      candidateA,
      'reject_candidate',
      decisionOptions('reject_candidate'),
    );
    // candidateB is unrelated — still produces a PSV candidate.
    const resultB = applyPolicyReviewDecision(
      candidateB,
      'accept_candidate',
      decisionOptions('accept_candidate'),
    );
    expect(resultB.decision.createdPsvReceiptCandidate).toBe(true);
    expect(resultB.psvReceiptCandidate).toBeDefined();
  });

  it('only accept_candidate produces a PSVReceiptCandidate; all other actions leave psvReceiptCandidate undefined', () => {
    const candidate = buildCandidate('confirmed');
    const actions: PolicyReviewAction[] = [
      'reject_candidate',
      'request_more_info',
      'request_release',
      'reroute',
      'mark_conflict_review',
      'cancel',
    ];
    for (const action of actions) {
      const result = applyPolicyReviewDecision(
        candidate,
        action,
        decisionOptions(action),
      );
      expect(result.psvReceiptCandidate).toBeUndefined();
      expect(result.decision.createdPsvReceiptCandidate).toBe(false);
    }
  });

  it('audit metadata records demo provenance and explicitly disclaims a real audit-event write', () => {
    const candidate = buildCandidate('confirmed');
    const result = applyPolicyReviewDecision(
      candidate,
      'accept_candidate',
      decisionOptions('accept_candidate'),
    );
    expect(result.decision.auditMetadata.recordedBy).toBe('demo');
    expect(result.decision.auditMetadata.notes?.toLowerCase()).toContain(
      'demo',
    );
    // The note must explicitly disclaim a real audit-event row.
    expect(result.decision.auditMetadata.notes).toMatch(
      /does not write a real audit-event row/i,
    );
    // Defensive: must not falsely claim a real write occurred.
    expect(result.decision.auditMetadata.notes).not.toMatch(
      /logged to audit trail/i,
    );
    expect(result.decision.auditMetadata.notes).not.toMatch(
      /audit event recorded/i,
    );
  });
});

describe('buildPsvReceiptCandidate', () => {
  it('throws if called for a refused (candidate, action) combination', () => {
    const candidate = buildCandidate('partially_confirmed');
    expect(() =>
      buildPsvReceiptCandidate(candidate, {
        psvCandidateId: 'psv-1',
        acceptedAt: '2026-04-26T02:00:00.000Z',
        acceptedBy: ACTOR,
      }),
    ).toThrow(/refused/);
  });

  it('returns a candidate with literal proofTier and decisionGrade=false', () => {
    const candidate = buildCandidate('confirmed');
    const psv = buildPsvReceiptCandidate(candidate, {
      psvCandidateId: 'psv-1',
      acceptedAt: '2026-04-26T02:00:00.000Z',
      acceptedBy: ACTOR,
    });
    expect(psv.proofTier).toBe('psv_receipt_candidate');
    expect(psv.decisionGrade).toBe(false);
    expect(psv.acceptedBy).toEqual(ACTOR);
    expect(psv.sourceBasis).toEqual(candidate.sourceBasis);
    expect(psv.attributedResponder).toEqual(candidate.attributedResponder);
  });

  it('preserves contracted-agent vs source distinction on the PSV candidate', () => {
    const candidate = buildReceiptCandidateFromIssuerResponse(
      makeRequest({
        issuerCandidate: {
          candidateId: 'cand-agent',
          organizationName: 'Acme Verification Services',
          source: 'partner_directory',
          isContractedAgent: true,
          agentActsFor: 'Demo GME Office',
        },
      }),
      makeResponse({ status: 'confirmed' }),
      { receiptCandidateId: 'rc-agent', claimId: 'claim-1' },
    );
    const psv = buildPsvReceiptCandidate(candidate, {
      psvCandidateId: 'psv-agent',
      acceptedAt: '2026-04-26T02:00:00.000Z',
      acceptedBy: ACTOR,
    });
    expect(psv.sourceBasis.isContractedAgent).toBe(true);
    expect(psv.sourceBasis.agentName).toBe('Acme Verification Services');
    expect(psv.sourceBasis.sourceOrganizationName).toBe('Demo GME Office');
  });
});

describe('Policy review copy', () => {
  it('exposes copy for every PolicyReviewDecisionStatus', () => {
    const statuses = [
      'pending_review',
      'accepted_as_psv_candidate',
      'rejected',
      'request_more_info',
      'requires_release',
      'reroute_required',
      'conflict_review_required',
      'expired',
      'canceled',
    ] as const;
    for (const s of statuses) {
      const copy = policyReviewCopy(s);
      expect(copy.label.length).toBeGreaterThan(0);
      expect(copy.description.length).toBeGreaterThan(0);
    }
  });

  it('keeps banned overclaim strings out of policy review copy', () => {
    const blob = JSON.stringify(POLICY_REVIEW_COPY).toLowerCase();
    for (const phrase of BANNED) {
      expect(blob).not.toContain(phrase.toLowerCase());
    }
  });

  it('no policy review label is the bare word "Verified"', () => {
    for (const copy of Object.values(POLICY_REVIEW_COPY)) {
      expect(copy.label).not.toBe('Verified');
    }
  });
});

describe('Knowledge Trust Graph — ISSUER-3 alignment', () => {
  it('keeps the policy review nodes and rules parseable and aligned', async () => {
    const raw = await import(
      '../../../docs/architecture/vitalcv-knowledge-trust-graph.json'
    );
    const graph = raw.default ?? raw;
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        'PolicyReviewDecision',
        'PolicyReviewActor',
        'PolicyReviewAction',
        'PSVReceiptCandidate',
        'ConflictReview',
        'ReviewOutcome',
      ]),
    );
    expect(graph.rules).toEqual(
      expect.arrayContaining([
        'Only an accept_candidate policy review action may produce a PSVReceiptCandidate.',
        'accept_candidate requires the receipt candidate to be in ready_for_policy_review.',
        'wrong_office and unable_to_verify responses cannot produce a PSVReceiptCandidate.',
        'conflict_review_required candidates cannot be accepted without conflict resolution.',
        'legally_only acceptances require an explicit limitation note before producing a PSVReceiptCandidate.',
        'A PSVReceiptCandidate is not a global PSV receipt; promotion requires a separate gate.',
        'Audit events are only claimed when a real audit-event row is written; demo metadata is labeled as such.',
      ]),
    );
  });
});

describe('Policy Review Surface — UI render guards', () => {
  it('renders the policy-review warning and machine-readable provenance attributes', () => {
    const candidate = buildCandidate('confirmed');
    const decision = buildPolicyReviewDecision(
      candidate,
      'accept_candidate',
      decisionOptions('accept_candidate'),
    );
    const markup = renderToStaticMarkup(
      React.createElement(
        'main',
        {
          'data-testid': 'policy-review-page',
          'data-receipt-candidate-id': candidate.receiptCandidateId,
          'data-review-state': candidate.reviewState,
          'data-proof-tier': candidate.proofTier,
          'data-decision-grade': String(candidate.decisionGrade),
          'data-can-accept': String(decision.createdPsvReceiptCandidate),
        },
        React.createElement(
          'p',
          { 'data-testid': 'policy-review-warning' },
          'Policy review controls whether this candidate can become a PSV receipt. The original issuer response remains evidence, even if the candidate is rejected.',
        ),
      ),
    );
    expect(markup).toContain(
      'Policy review controls whether this candidate can become a PSV receipt.',
    );
    expect(markup).toContain('original issuer response remains evidence');
    expect(markup).toMatch(/data-proof-tier="receipt_candidate"/);
    expect(markup).toMatch(/data-decision-grade="false"/);
    expect(markup).toMatch(/data-can-accept="true"/);
    const lower = markup.toLowerCase();
    for (const phrase of BANNED) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
  });
});

describe('policyReview.ts — purity guard (no I/O, no DB, no audit writes)', () => {
  it('source contains no fetch / axios / network / db / audit-writer tokens', () => {
    const src = readFileSync(
      new URL(
        '../lib/issuer-verification/policyReview.ts',
        import.meta.url,
      ),
      'utf8',
    );
    const banned = [
      'fetch(',
      'axios',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'prisma.',
      'recordAudit',
      'recordAuditEvent',
      "import('@/",
      'require(',
    ];
    for (const phrase of banned) {
      expect(src).not.toContain(phrase);
    }
  });

  it('does not statically import any backend module', () => {
    const src = readFileSync(
      new URL(
        '../lib/issuer-verification/policyReview.ts',
        import.meta.url,
      ),
      'utf8',
    );
    expect(src).not.toMatch(/from ['"]apps\/api/);
    expect(src).not.toMatch(/from ['"]@vitalcv\/psv['"]/);
    expect(src).not.toMatch(/from ['"][^'"]*prisma_client['"]/);
    expect(src).not.toMatch(/from ['"][^'"]*psvReceipts\.repo['"]/);
  });
});
