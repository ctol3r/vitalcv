import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildPsvReceiptArtifact,
  canPromoteToPsvReceipt,
  getPsvReceiptPromotionFailureReason,
  promotePsvReceiptCandidate,
  readPsvReceiptAuditEventState,
} from '../lib/issuer-verification/psvReceipt';
import {
  PSV_RECEIPT_COPY,
  psvReceiptCopy,
} from '../lib/issuer-verification/statusCopy';
import type {
  AttributedResponder,
  IssuerResponseStatus,
  PolicyReviewActor,
  PolicyReviewDecision,
  PolicyReviewDecisionStatus,
  PSVReceipt,
  PSVReceiptCandidate,
  PSVReceiptLimitation,
  PSVReceiptScope,
  SourceBasis,
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
  ['final', 'PSV', 'without', 'policy', 'review'].join(' '),
];

const ACTOR: PolicyReviewActor = {
  actorId: 'actor-1',
  displayName: 'Pat Reviewer',
  role: 'policy_reviewer',
};

function makeSourceBasis(overrides: Partial<SourceBasis> = {}): SourceBasis {
  return {
    sourceOrganizationName: 'Demo GME Office',
    isContractedAgent: false,
    basisNote: 'Response provided directly by the source of record.',
    ...overrides,
  };
}

function makeAttributedResponder(
  overrides: Partial<AttributedResponder> = {},
): AttributedResponder {
  return {
    name: 'Jane Doe',
    role: 'Program Coordinator',
    attributedAt: '2026-04-26T01:00:00.000Z',
    attributionMethod: 'self_attested',
    ...overrides,
  };
}

function makeCandidate(
  overrides: Partial<PSVReceiptCandidate> = {},
): PSVReceiptCandidate {
  return {
    psvCandidateId: 'psv-1',
    receiptCandidateId: 'rc-1',
    requestId: 'req-1',
    claimId: 'claim-1',
    claimType: 'residency',
    acceptedAt: '2026-04-26T02:00:00.000Z',
    acceptedBy: ACTOR,
    sourceBasis: makeSourceBasis(),
    attributedResponder: makeAttributedResponder(),
    decisionGrade: false,
    proofTier: 'psv_receipt_candidate',
    ...overrides,
  };
}

function makeDecision(
  overrides: Partial<PolicyReviewDecision> = {},
): PolicyReviewDecision {
  return {
    decisionId: 'dec-1',
    receiptCandidateId: 'rc-1',
    requestId: 'req-1',
    action: 'accept_candidate',
    status: 'accepted_as_psv_candidate',
    decidedAt: '2026-04-26T02:00:00.000Z',
    actor: ACTOR,
    createdPsvReceiptCandidate: true,
    outcome: {
      createdPsvReceiptCandidate: true,
      reason: 'Candidate accepted under policy review.',
    },
    auditMetadata: {
      recordedAt: '2026-04-26T02:00:00.000Z',
      recordedBy: 'demo',
      notes:
        'Demo audit metadata; the policy review surface does not write a real audit-event row.',
    },
    ...overrides,
  };
}

function makeRefusedDecision(
  status: PolicyReviewDecisionStatus,
  action: PolicyReviewDecision['action'],
): PolicyReviewDecision {
  return makeDecision({
    status,
    action,
    createdPsvReceiptCandidate: false,
    outcome: {
      createdPsvReceiptCandidate: false,
      reason: 'demo-refusal',
      refusalGate: 'action_does_not_create_candidate',
    },
  });
}

const SCOPE: PSVReceiptScope = {
  claimType: 'residency',
  covers:
    'Confirms completion of the named residency program with the named source for the stated dates.',
  doesNotCover:
    'Does not confirm board certification, license status, malpractice history, or any other claim.',
  sourceOrganizationName: 'Demo GME Office',
};

function basePromotionInput(
  candidate: PSVReceiptCandidate,
  decision: PolicyReviewDecision,
  originResponseStatus: IssuerResponseStatus = 'confirmed',
  limitations?: PSVReceiptLimitation[],
) {
  return {
    psvReceiptCandidate: candidate,
    policyReviewDecision: decision,
    originResponseStatus,
    psvReceiptId: 'psv-receipt-1',
    promotedAt: '2026-04-26T03:00:00.000Z',
    promotedBy: ACTOR,
    ttlDays: 365,
    scope: SCOPE,
    limitations,
  };
}

describe('canPromoteToPsvReceipt', () => {
  it('accepted candidate with confirmed origin can promote', () => {
    expect(
      canPromoteToPsvReceipt(makeCandidate(), makeDecision(), 'confirmed'),
    ).toBe(true);
  });

  it('rejected decision blocks promotion', () => {
    const decision = makeRefusedDecision('rejected', 'reject_candidate');
    expect(canPromoteToPsvReceipt(makeCandidate(), decision, 'confirmed')).toBe(
      false,
    );
    expect(
      getPsvReceiptPromotionFailureReason(
        makeCandidate(),
        decision,
        'confirmed',
      ),
    ).toBe('rejected_cannot_promote');
  });

  it('request_more_info decision blocks promotion', () => {
    const decision = makeRefusedDecision(
      'request_more_info',
      'request_more_info',
    );
    expect(
      getPsvReceiptPromotionFailureReason(
        makeCandidate(),
        decision,
        'confirmed',
      ),
    ).toBe('request_more_info_cannot_promote');
  });

  it('reroute decision blocks promotion', () => {
    const decision = makeRefusedDecision('reroute_required', 'reroute');
    expect(
      getPsvReceiptPromotionFailureReason(
        makeCandidate(),
        decision,
        'confirmed',
      ),
    ).toBe('reroute_cannot_promote');
  });

  it('request_release decision blocks promotion', () => {
    const decision = makeRefusedDecision(
      'requires_release',
      'request_release',
    );
    expect(
      getPsvReceiptPromotionFailureReason(
        makeCandidate(),
        decision,
        'confirmed',
      ),
    ).toBe('release_required_cannot_promote');
  });

  it('mark_conflict_review decision blocks promotion', () => {
    const decision = makeRefusedDecision(
      'conflict_review_required',
      'mark_conflict_review',
    );
    expect(
      getPsvReceiptPromotionFailureReason(
        makeCandidate(),
        decision,
        'confirmed',
      ),
    ).toBe('conflict_review_unresolved');
  });

  it('cancel decision blocks promotion', () => {
    const decision = makeRefusedDecision('canceled', 'cancel');
    expect(
      getPsvReceiptPromotionFailureReason(
        makeCandidate(),
        decision,
        'confirmed',
      ),
    ).toBe('policy_review_not_accepted');
  });

  it('accepted decision but createdPsvReceiptCandidate=false still blocks', () => {
    const decision = makeDecision({
      createdPsvReceiptCandidate: false,
      outcome: {
        createdPsvReceiptCandidate: false,
        reason: 'demo-bypass',
      },
    });
    expect(
      getPsvReceiptPromotionFailureReason(
        makeCandidate(),
        decision,
        'confirmed',
      ),
    ).toBe('policy_review_not_accepted');
  });

  it('wrong_office origin response blocks promotion', () => {
    expect(
      getPsvReceiptPromotionFailureReason(
        makeCandidate(),
        makeDecision(),
        'wrong_office',
      ),
    ).toBe('wrong_office_cannot_promote');
  });

  it('unable_to_verify origin response blocks promotion', () => {
    expect(
      getPsvReceiptPromotionFailureReason(
        makeCandidate(),
        makeDecision(),
        'unable_to_verify',
      ),
    ).toBe('unable_to_verify_cannot_promote');
  });

  it('legally_only origin response without limitation blocks promotion', () => {
    const candidate = makeCandidate({ limitationNote: undefined });
    expect(
      getPsvReceiptPromotionFailureReason(
        candidate,
        makeDecision(),
        'legally_only',
      ),
    ).toBe('legally_only_requires_limitation');
  });

  it('legally_only with limitationNote on candidate can promote', () => {
    const candidate = makeCandidate({
      limitationNote: 'Issuer confirmed dates and identity only.',
    });
    expect(
      canPromoteToPsvReceipt(candidate, makeDecision(), 'legally_only'),
    ).toBe(true);
  });

  it('legally_only with explicit limitations input can promote', () => {
    const candidate = makeCandidate({ limitationNote: undefined });
    const limitations: PSVReceiptLimitation[] = [
      {
        kind: 'legally_only',
        description: 'Issuer confirmed dates and identity only.',
      },
    ];
    expect(
      canPromoteToPsvReceipt(
        candidate,
        makeDecision(),
        'legally_only',
        limitations,
      ),
    ).toBe(true);
  });

  it('candidate with wrong proofTier is not a PSVReceiptCandidate', () => {
    const candidate = {
      ...makeCandidate(),
      // simulating a tampered/incorrectly-typed candidate
      proofTier: 'receipt_candidate',
    } as unknown as PSVReceiptCandidate;
    expect(
      getPsvReceiptPromotionFailureReason(
        candidate,
        makeDecision(),
        'confirmed',
      ),
    ).toBe('not_a_psv_receipt_candidate');
  });

  it('missing source basis blocks promotion', () => {
    const candidate = {
      ...makeCandidate(),
      sourceBasis: undefined,
    } as unknown as PSVReceiptCandidate;
    expect(
      getPsvReceiptPromotionFailureReason(
        candidate,
        makeDecision(),
        'confirmed',
      ),
    ).toBe('missing_source_basis');
  });

  it('missing attributed responder blocks promotion', () => {
    const candidate = {
      ...makeCandidate(),
      attributedResponder: undefined,
    } as unknown as PSVReceiptCandidate;
    expect(
      getPsvReceiptPromotionFailureReason(
        candidate,
        makeDecision(),
        'confirmed',
      ),
    ).toBe('missing_attributed_responder');
  });
});

describe('promotePsvReceiptCandidate', () => {
  it('promotes a confirmed accepted candidate to a PSVReceipt', () => {
    const result = promotePsvReceiptCandidate(
      basePromotionInput(makeCandidate(), makeDecision(), 'confirmed'),
    );
    expect(result.promoted).toBe(true);
    expect(result.psvReceipt).toBeDefined();
    expect(result.psvReceipt?.proofTier).toBe('psv_receipt');
    expect(result.psvReceipt?.decisionGrade).toBe(true);
    expect(result.psvReceipt?.globalCredentialTruth).toBe(false);
  });

  it('preserves the candidate verbatim on success and refusal', () => {
    const candidate = makeCandidate();
    const success = promotePsvReceiptCandidate(
      basePromotionInput(candidate, makeDecision(), 'confirmed'),
    );
    expect(success.preservedCandidate).toBe(candidate);

    const refusal = promotePsvReceiptCandidate(
      basePromotionInput(
        candidate,
        makeRefusedDecision('rejected', 'reject_candidate'),
        'confirmed',
      ),
    );
    expect(refusal.promoted).toBe(false);
    expect(refusal.preservedCandidate).toBe(candidate);
  });

  it('preserves source basis verbatim on the receipt', () => {
    const candidate = makeCandidate({
      sourceBasis: makeSourceBasis({
        sourceOrganizationName: 'Demo GME Office',
        isContractedAgent: true,
        agentName: 'Acme Verification Services',
        agentActsFor: 'Demo GME Office',
        basisNote: 'Contracted agent layer.',
      }),
    });
    const result = promotePsvReceiptCandidate(
      basePromotionInput(candidate, makeDecision(), 'confirmed'),
    );
    expect(result.psvReceipt?.sourceBasis).toEqual(candidate.sourceBasis);
    expect(result.psvReceipt?.sourceBasis.isContractedAgent).toBe(true);
    expect(result.psvReceipt?.sourceBasis.agentName).toBe(
      'Acme Verification Services',
    );
  });

  it('preserves attributed responder verbatim', () => {
    const candidate = makeCandidate();
    const result = promotePsvReceiptCandidate(
      basePromotionInput(candidate, makeDecision(), 'confirmed'),
    );
    expect(result.psvReceipt?.attributedResponder).toEqual(
      candidate.attributedResponder,
    );
  });

  it('emits a contracted_agent limitation when the source basis carries one', () => {
    const candidate = makeCandidate({
      sourceBasis: makeSourceBasis({
        isContractedAgent: true,
        agentName: 'Acme Verification Services',
        agentActsFor: 'Demo GME Office',
      }),
    });
    const result = promotePsvReceiptCandidate(
      basePromotionInput(candidate, makeDecision(), 'confirmed'),
    );
    const kinds = result.psvReceipt?.limitations.map((l) => l.kind) ?? [];
    expect(kinds).toContain('contracted_agent');
  });

  it('emits a legally_only limitation when origin response was legally_only', () => {
    const candidate = makeCandidate({
      limitationNote: 'Issuer confirmed dates and identity only.',
    });
    const result = promotePsvReceiptCandidate(
      basePromotionInput(candidate, makeDecision(), 'legally_only'),
    );
    const kinds = result.psvReceipt?.limitations.map((l) => l.kind) ?? [];
    expect(kinds).toContain('legally_only');
  });

  it('emits a partial_confirmation limitation when origin response was partially_confirmed', () => {
    const candidate = makeCandidate();
    const result = promotePsvReceiptCandidate(
      basePromotionInput(candidate, makeDecision(), 'partially_confirmed'),
    );
    const kinds = result.psvReceipt?.limitations.map((l) => l.kind) ?? [];
    expect(kinds).toContain('partial_confirmation');
  });

  it('passes through caller-supplied limitations verbatim when provided', () => {
    const candidate = makeCandidate();
    const limitations: PSVReceiptLimitation[] = [
      {
        kind: 'jurisdictional_scope',
        description: 'Limited to state of NY only.',
      },
    ];
    const result = promotePsvReceiptCandidate(
      basePromotionInput(candidate, makeDecision(), 'confirmed', limitations),
    );
    expect(result.psvReceipt?.limitations).toEqual(limitations);
  });

  it('computes a freshness window based on ttlDays', () => {
    const result = promotePsvReceiptCandidate(
      basePromotionInput(makeCandidate(), makeDecision(), 'confirmed'),
    );
    expect(result.psvReceipt?.freshness.ttlDays).toBe(365);
    expect(result.psvReceipt?.freshness.issuedAt).toBe(
      '2026-04-26T03:00:00.000Z',
    );
    expect(result.psvReceipt?.freshness.staleAfter).toBe(
      '2027-04-26T03:00:00.000Z',
    );
  });

  it('audit event state defaults to pending_not_written on promoted receipts', () => {
    const result = promotePsvReceiptCandidate(
      basePromotionInput(makeCandidate(), makeDecision(), 'confirmed'),
    );
    const receipt = result.psvReceipt as PSVReceipt;
    expect(readPsvReceiptAuditEventState(receipt)).toBe('pending_not_written');
    expect(receipt.auditMetadata.recordedBy).toBe('review_surface');
    expect(receipt.auditMetadata.notes).toMatch(
      /does not write a real audit-event row/i,
    );
    expect(receipt.auditMetadata.notes).not.toMatch(/logged to audit trail/i);
  });

  it('refusal does not produce a psvReceipt', () => {
    const result = promotePsvReceiptCandidate(
      basePromotionInput(
        makeCandidate(),
        makeRefusedDecision('rejected', 'reject_candidate'),
        'confirmed',
      ),
    );
    expect(result.promoted).toBe(false);
    expect(result.psvReceipt).toBeUndefined();
    expect(result.failureReason).toBe('rejected_cannot_promote');
    expect(result.message).toMatch(/rejected/i);
  });
});

describe('buildPsvReceiptArtifact', () => {
  it('throws when source basis is missing', () => {
    const candidate = {
      ...makeCandidate(),
      sourceBasis: undefined,
    } as unknown as PSVReceiptCandidate;
    expect(() =>
      buildPsvReceiptArtifact({
        psvReceiptId: 'psv-receipt-1',
        candidate,
        scope: SCOPE,
        limitations: [],
        freshness: {
          ttlDays: 365,
          issuedAt: '2026-04-26T03:00:00.000Z',
          staleAfter: '2027-04-26T03:00:00.000Z',
        },
        promotedAt: '2026-04-26T03:00:00.000Z',
        promotedBy: ACTOR,
      }),
    ).toThrow(/sourceBasis/);
  });

  it('produces a receipt with proofTier=psv_receipt and decisionGrade=true', () => {
    const receipt = buildPsvReceiptArtifact({
      psvReceiptId: 'psv-receipt-1',
      candidate: makeCandidate(),
      scope: SCOPE,
      limitations: [],
      freshness: {
        ttlDays: 365,
        issuedAt: '2026-04-26T03:00:00.000Z',
        staleAfter: '2027-04-26T03:00:00.000Z',
      },
      promotedAt: '2026-04-26T03:00:00.000Z',
      promotedBy: ACTOR,
    });
    expect(receipt.proofTier).toBe('psv_receipt');
    expect(receipt.decisionGrade).toBe(true);
    expect(receipt.globalCredentialTruth).toBe(false);
    expect(receipt.auditMetadata.eventState).toBe('pending_not_written');
  });
});

describe('PSV receipt copy', () => {
  it('exposes copy for every PsvReceiptCopyKey', () => {
    const keys = Object.keys(PSV_RECEIPT_COPY) as Array<
      keyof typeof PSV_RECEIPT_COPY
    >;
    for (const k of keys) {
      const c = psvReceiptCopy(k);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  it('keeps banned overclaim strings out of PSV receipt copy', () => {
    const blob = JSON.stringify(PSV_RECEIPT_COPY).toLowerCase();
    for (const phrase of BANNED) {
      expect(blob).not.toContain(phrase.toLowerCase());
    }
  });

  it('no PSV receipt label is the bare word "Verified"', () => {
    for (const c of Object.values(PSV_RECEIPT_COPY)) {
      expect(c.label).not.toBe('Verified');
    }
  });

  it('keeps banned overclaim substrings out of the PSV receipt page source', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const pagePath = resolve(
      here,
      '../app/issuer/psv-receipt/[requestId]/page.tsx',
    );
    const src = readFileSync(pagePath, 'utf8').toLowerCase();
    for (const phrase of BANNED) {
      expect(src).not.toContain(phrase.toLowerCase());
    }
  });
});

describe('Knowledge Trust Graph — ISSUER-4 alignment', () => {
  it('keeps the PSV receipt nodes and rules parseable and aligned', async () => {
    const raw = await import(
      '../../../docs/architecture/vitalcv-knowledge-trust-graph.json'
    );
    const graph = raw.default ?? raw;
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        'PSVReceipt',
        'PSVReceiptPromotion',
        'PSVReceiptScope',
        'PSVReceiptLimitation',
        'AuditMetadata',
        'FreshnessPolicy',
      ]),
    );
    expect(graph.rules).toEqual(
      expect.arrayContaining([
        'A PSVReceipt is scoped evidence, not global credential truth.',
        'Promotion to PSVReceipt requires a policyReviewDecision with status accepted_as_psv_candidate.',
        'wrong_office and unable_to_verify origin responses cannot promote to a PSVReceipt.',
        'rejected, request_more_info, reroute, request_release, conflict_review_required, and pending policy decisions cannot promote.',
        'legally_only origin responses require at least one explicit limitation before promotion.',
        'PSVReceipt limitations and freshness policy remain controlling for any downstream credential claim.',
        'PSVReceipt audit metadata defaults to eventState=\'pending_not_written\'; UI may not claim a real audit-event row was written until a real audit service is wired.',
      ]),
    );
  });
});
