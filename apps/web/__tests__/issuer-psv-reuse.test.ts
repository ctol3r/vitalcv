import { describe, expect, it } from 'vitest';
import {
  buildPsvReceiptReuseDecision,
  canReusePsvReceipt,
  explainPsvReceiptReuseDecision,
  getPsvReceiptFreshnessState,
  getPsvReceiptReuseFailureReason,
  markPsvReceiptRevoked,
  markPsvReceiptSuperseded,
} from '../lib/issuer-verification/psvReceiptReuse';
import type {
  PSVReceiptReuseScope,
  PSVReceiptRevocationState,
  PSVReceiptSupersession,
} from '../lib/issuer-verification/psvReceiptReuse';
import {
  PSV_RECEIPT_REUSE_COPY,
  psvReceiptReuseCopy,
} from '../lib/issuer-verification/statusCopy';
import type {
  PolicyReviewActor,
  PSVReceipt,
  PSVReceiptLimitation,
  PSVReceiptScope,
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
  ['accepted', 'everywhere'].join(' '),
  ['real-time', 'monitoring'].join(' '),
];

const ACTOR: PolicyReviewActor = {
  actorId: 'actor-1',
  displayName: 'Pat Reviewer',
  role: 'policy_reviewer',
};

const SCOPE: PSVReceiptScope = {
  claimType: 'residency',
  covers:
    'Confirms completion of the named residency program with the named source for the stated dates.',
  doesNotCover:
    'Does not confirm board certification, license status, malpractice history, or any other claim.',
  sourceOrganizationName: 'Demo GME Office',
};

function makeReceipt(overrides: Partial<PSVReceipt> = {}): PSVReceipt {
  return {
    psvReceiptId: 'psv-receipt-1',
    psvCandidateId: 'psv-1',
    receiptCandidateId: 'rc-1',
    requestId: 'req-1',
    claimId: 'claim-1',
    claimType: 'residency',
    promotedAt: '2026-04-01T00:00:00.000Z',
    promotedBy: ACTOR,
    sourceBasis: {
      sourceOrganizationName: 'Demo GME Office',
      isContractedAgent: false,
      basisNote: 'Direct from source.',
    },
    attributedResponder: {
      name: 'J. Doe',
      role: 'Program Coordinator',
      attributedAt: '2026-04-01T01:00:00.000Z',
      attributionMethod: 'self_attested',
    },
    scope: SCOPE,
    limitations: [],
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
      notes: 'Demo audit metadata; no real audit-event row written.',
    },
    notes: 'PSV receipt. Scoped evidence subject to limitations and freshness; not global credential truth.',
    ...overrides,
  };
}

const REUSE_SCOPE_RESIDENCY: PSVReceiptReuseScope = {
  claimType: 'residency',
  sourceOrganizationName: 'Demo GME Office',
  purpose: 'Reuse for an internal-medicine residency claim on a new pilot.',
};

function decisionOptions(decisionId = 'reuse-1') {
  return {
    decisionId,
    decidedAt: '2026-04-26T00:00:00.000Z',
    recordedBy: 'demo' as const,
  };
}

describe('getPsvReceiptFreshnessState', () => {
  it('returns fresh inside the window with no soft threshold', () => {
    const f = getPsvReceiptFreshnessState(makeReceipt(), '2026-06-01T00:00:00.000Z');
    expect(f.state).toBe('fresh');
    expect(f.daysRemaining).toBeGreaterThan(0);
  });

  it('returns needs_refresh when within soft threshold', () => {
    const f = getPsvReceiptFreshnessState(
      makeReceipt(),
      '2027-03-15T00:00:00.000Z',
      30,
    );
    expect(f.state).toBe('needs_refresh');
  });

  it('returns expired past the staleAfter timestamp', () => {
    const f = getPsvReceiptFreshnessState(makeReceipt(), '2027-05-01T00:00:00.000Z');
    expect(f.state).toBe('expired');
    expect(f.daysRemaining).toBeLessThan(0);
  });

  it('throws on invalid timestamps', () => {
    expect(() =>
      getPsvReceiptFreshnessState(makeReceipt(), 'not-a-date'),
    ).toThrow();
  });
});

describe('canReusePsvReceipt', () => {
  it('fresh receipt inside scope is reusable', () => {
    expect(
      canReusePsvReceipt({
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('expired receipt cannot be reused', () => {
    expect(
      canReusePsvReceipt({
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2027-05-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('revoked receipt cannot be reused', () => {
    const revocation: PSVReceiptRevocationState = {
      state: 'revoked',
      revokedAt: '2026-05-01T00:00:00.000Z',
      revokedBy: 'demo-reviewer',
      reason: 'Reported by source.',
      source: 'manual_entry',
    };
    expect(
      canReusePsvReceipt({
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
        revocation,
      }),
    ).toBe(false);
  });

  it('superseded receipt cannot be reused', () => {
    const supersession: PSVReceiptSupersession = {
      state: 'superseded',
      supersedingReceiptId: 'psv-receipt-newer',
      supersededAt: '2026-05-01T00:00:00.000Z',
      source: 'manual_entry',
    };
    expect(
      canReusePsvReceipt({
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
        supersession,
      }),
    ).toBe(false);
  });

  it('scope mismatch on claimType blocks reuse', () => {
    expect(
      canReusePsvReceipt({
        receipt: makeReceipt(),
        reuseScope: {
          ...REUSE_SCOPE_RESIDENCY,
          claimType: 'fellowship',
        },
        nowIso: '2026-06-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('scope mismatch on sourceOrganization blocks reuse', () => {
    expect(
      canReusePsvReceipt({
        receipt: makeReceipt(),
        reuseScope: {
          ...REUSE_SCOPE_RESIDENCY,
          sourceOrganizationName: 'Different GME Office',
        },
        nowIso: '2026-06-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('legally_only limitation blocks clinical-scope reuse', () => {
    const limitations: PSVReceiptLimitation[] = [
      { kind: 'legally_only', description: 'Dates / identity only.' },
    ];
    expect(
      canReusePsvReceipt({
        receipt: makeReceipt({ limitations }),
        reuseScope: {
          ...REUSE_SCOPE_RESIDENCY,
          purpose: 'Reuse to confirm clinical scope of practice.',
        },
        nowIso: '2026-06-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('legally_only limitation does not block administrative reuse', () => {
    const limitations: PSVReceiptLimitation[] = [
      { kind: 'legally_only', description: 'Dates / identity only.' },
    ];
    expect(
      canReusePsvReceipt({
        receipt: makeReceipt({ limitations }),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('missing freshness window blocks reuse', () => {
    const receipt = {
      ...makeReceipt(),
      freshness: undefined,
    } as unknown as PSVReceipt;
    expect(
      canReusePsvReceipt({
        receipt,
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('missing source basis blocks reuse', () => {
    const receipt = {
      ...makeReceipt(),
      sourceBasis: undefined,
    } as unknown as PSVReceipt;
    expect(
      canReusePsvReceipt({
        receipt,
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('missing attributed responder blocks reuse', () => {
    const receipt = {
      ...makeReceipt(),
      attributedResponder: undefined,
    } as unknown as PSVReceipt;
    expect(
      canReusePsvReceipt({
        receipt,
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('missing audit metadata blocks reuse', () => {
    const receipt = {
      ...makeReceipt(),
      auditMetadata: undefined,
    } as unknown as PSVReceipt;
    expect(
      canReusePsvReceipt({
        receipt,
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('non-PSVReceipt artifact (wrong proofTier) cannot be reused', () => {
    const receipt = {
      ...makeReceipt(),
      proofTier: 'psv_receipt_candidate',
    } as unknown as PSVReceipt;
    expect(
      canReusePsvReceipt({
        receipt,
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });
});

describe('getPsvReceiptReuseFailureReason', () => {
  it('returns receipt_expired for past-stale receipt', () => {
    const receipt = makeReceipt();
    const freshness = getPsvReceiptFreshnessState(
      receipt,
      '2027-05-01T00:00:00.000Z',
    );
    expect(
      getPsvReceiptReuseFailureReason(
        { receipt, reuseScope: REUSE_SCOPE_RESIDENCY, nowIso: '2027-05-01T00:00:00.000Z' },
        freshness,
      ),
    ).toBe('receipt_expired');
  });

  it('returns receipt_revoked when revocation is recorded', () => {
    const receipt = makeReceipt();
    const freshness = getPsvReceiptFreshnessState(
      receipt,
      '2026-06-01T00:00:00.000Z',
    );
    expect(
      getPsvReceiptReuseFailureReason(
        {
          receipt,
          reuseScope: REUSE_SCOPE_RESIDENCY,
          nowIso: '2026-06-01T00:00:00.000Z',
          revocation: {
            state: 'revoked',
            revokedAt: '2026-05-01T00:00:00.000Z',
            revokedBy: 'demo',
            reason: 'demo',
            source: 'manual_entry',
          },
        },
        freshness,
      ),
    ).toBe('receipt_revoked');
  });

  it('returns scope_mismatch on claimType drift', () => {
    const receipt = makeReceipt();
    const freshness = getPsvReceiptFreshnessState(
      receipt,
      '2026-06-01T00:00:00.000Z',
    );
    expect(
      getPsvReceiptReuseFailureReason(
        {
          receipt,
          reuseScope: { ...REUSE_SCOPE_RESIDENCY, claimType: 'fellowship' },
          nowIso: '2026-06-01T00:00:00.000Z',
        },
        freshness,
      ),
    ).toBe('scope_mismatch');
  });
});

describe('buildPsvReceiptReuseDecision', () => {
  it('reusable status carries reusable=true and globalCredentialTruth=false', () => {
    const decision = buildPsvReceiptReuseDecision(
      {
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
      },
      decisionOptions(),
    );
    expect(decision.status).toBe('reusable');
    expect(decision.reusable).toBe(true);
    expect(decision.globalCredentialTruth).toBe(false);
    expect(decision.failureReason).toBeUndefined();
    expect(decision.auditMetadata.eventState).toBe('pending_not_written');
  });

  it('reusable does not mean automatic acceptance — explanation calls this out', () => {
    const decision = buildPsvReceiptReuseDecision(
      {
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
      },
      decisionOptions(),
    );
    expect(decision.explanation.toLowerCase()).toContain('not automatic');
    expect(decision.explanation.toLowerCase()).toContain('source truth');
  });

  it('expired receipt -> status=expired and failureReason=receipt_expired', () => {
    const decision = buildPsvReceiptReuseDecision(
      {
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2027-05-01T00:00:00.000Z',
      },
      decisionOptions(),
    );
    expect(decision.status).toBe('expired');
    expect(decision.reusable).toBe(false);
    expect(decision.failureReason).toBe('receipt_expired');
    expect(decision.globalCredentialTruth).toBe(false);
  });

  it('revoked receipt -> status=revoked and failureReason=receipt_revoked', () => {
    const decision = buildPsvReceiptReuseDecision(
      {
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
        revocation: markPsvReceiptRevoked({
          revokedAt: '2026-05-01T00:00:00.000Z',
          revokedBy: 'demo',
          reason: 'reported by source',
          source: 'manual_entry',
        }),
      },
      decisionOptions(),
    );
    expect(decision.status).toBe('revoked');
    expect(decision.failureReason).toBe('receipt_revoked');
  });

  it('superseded receipt -> status=superseded and failureReason=receipt_superseded', () => {
    const decision = buildPsvReceiptReuseDecision(
      {
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
        supersession: markPsvReceiptSuperseded({
          supersedingReceiptId: 'psv-receipt-newer',
          supersededAt: '2026-05-01T00:00:00.000Z',
          source: 'manual_entry',
        }),
      },
      decisionOptions(),
    );
    expect(decision.status).toBe('superseded');
    expect(decision.failureReason).toBe('receipt_superseded');
  });

  it('scope mismatch -> status=scope_mismatch', () => {
    const decision = buildPsvReceiptReuseDecision(
      {
        receipt: makeReceipt(),
        reuseScope: { ...REUSE_SCOPE_RESIDENCY, claimType: 'fellowship' },
        nowIso: '2026-06-01T00:00:00.000Z',
      },
      decisionOptions(),
    );
    expect(decision.status).toBe('scope_mismatch');
    expect(decision.failureReason).toBe('scope_mismatch');
  });

  it('limitation_blocks_reuse -> status=limitation_blocks_reuse', () => {
    const limitations: PSVReceiptLimitation[] = [
      { kind: 'legally_only', description: 'Dates / identity only.' },
    ];
    const decision = buildPsvReceiptReuseDecision(
      {
        receipt: makeReceipt({ limitations }),
        reuseScope: {
          ...REUSE_SCOPE_RESIDENCY,
          purpose: 'Confirm clinical scope of practice for privileging.',
        },
        nowIso: '2026-06-01T00:00:00.000Z',
      },
      decisionOptions(),
    );
    expect(decision.status).toBe('limitation_blocks_reuse');
    expect(decision.failureReason).toBe('limitation_blocks_reuse');
  });

  it('needs_refresh maps correctly when soft threshold is met but not expired', () => {
    const decision = buildPsvReceiptReuseDecision(
      {
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2027-03-15T00:00:00.000Z',
        refreshSoftThresholdDays: 30,
      },
      decisionOptions(),
    );
    expect(decision.status).toBe('needs_refresh');
    expect(decision.reusable).toBe(false);
    expect(decision.failureReason).toBeUndefined();
  });

  it('audit metadata defaults to pending_not_written and disclaims real audit-event row', () => {
    const decision = buildPsvReceiptReuseDecision(
      {
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
      },
      decisionOptions(),
    );
    expect(decision.auditMetadata.eventState).toBe('pending_not_written');
    expect(decision.auditMetadata.notes?.toLowerCase()).toMatch(
      /does not write a real audit-event row/i,
    );
    // Defensive: must not falsely claim a write occurred.
    const trailPhrase = ['logged', 'to', 'audit', 'trail'].join(' ');
    const recordedPhrase = ['audit', 'event', 'recorded'].join(' ');
    expect(decision.auditMetadata.notes?.toLowerCase() ?? '').not.toContain(
      trailPhrase,
    );
    expect(decision.auditMetadata.notes?.toLowerCase() ?? '').not.toContain(
      recordedPhrase,
    );
  });
});

describe('explainPsvReceiptReuseDecision', () => {
  it('mentions days remaining for fresh receipts', () => {
    const decision = buildPsvReceiptReuseDecision(
      {
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2026-06-01T00:00:00.000Z',
      },
      decisionOptions(),
    );
    const explanation = explainPsvReceiptReuseDecision(decision);
    expect(explanation.toLowerCase()).toContain('days remaining');
  });

  it('mentions expired for expired receipts', () => {
    const decision = buildPsvReceiptReuseDecision(
      {
        receipt: makeReceipt(),
        reuseScope: REUSE_SCOPE_RESIDENCY,
        nowIso: '2027-05-01T00:00:00.000Z',
      },
      decisionOptions(),
    );
    const explanation = explainPsvReceiptReuseDecision(decision);
    expect(explanation.toLowerCase()).toContain('expired');
  });
});

describe('markPsvReceiptRevoked / markPsvReceiptSuperseded', () => {
  it('markPsvReceiptRevoked returns a revoked state, no live polling claim', () => {
    const revocation = markPsvReceiptRevoked({
      revokedAt: '2026-05-01T00:00:00.000Z',
      revokedBy: 'demo',
      reason: 'Reported by source.',
    });
    expect(revocation.state).toBe('revoked');
    expect(revocation.source).toBe('manual_entry');
    // No fields imply live monitoring — interface is intentionally
    // shape-bound to "recorded when reported."
    expect(JSON.stringify(revocation).toLowerCase()).not.toContain(
      ['real-time', 'monitoring'].join(' '),
    );
  });

  it('markPsvReceiptSuperseded returns superseded state with the newer receipt id', () => {
    const supersession = markPsvReceiptSuperseded({
      supersedingReceiptId: 'psv-receipt-newer',
      supersededAt: '2026-05-01T00:00:00.000Z',
    });
    expect(supersession.state).toBe('superseded');
    expect(supersession.supersedingReceiptId).toBe('psv-receipt-newer');
    expect(supersession.source).toBe('manual_entry');
  });
});

describe('PSV reuse copy', () => {
  it('exposes copy for every reuse copy key', () => {
    const keys = Object.keys(PSV_RECEIPT_REUSE_COPY) as Array<
      keyof typeof PSV_RECEIPT_REUSE_COPY
    >;
    for (const k of keys) {
      const c = psvReceiptReuseCopy(k);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  it('keeps banned overclaim phrases out of reuse copy', () => {
    const blob = JSON.stringify(PSV_RECEIPT_REUSE_COPY).toLowerCase();
    for (const phrase of BANNED) {
      expect(blob).not.toContain(phrase.toLowerCase());
    }
  });

  it('no reuse copy label is the bare word "Verified"', () => {
    for (const c of Object.values(PSV_RECEIPT_REUSE_COPY)) {
      expect(c.label).not.toBe('Verified');
    }
  });

  it('reusable copy explicitly avoids implying automatic acceptance', () => {
    const blob = JSON.stringify(PSV_RECEIPT_REUSE_COPY.reusable).toLowerCase();
    expect(blob).toContain('not automatic verifier acceptance');
    expect(blob).toContain('does not imply current source truth');
  });
});

describe('Knowledge Trust Graph — ISSUER-5 alignment', () => {
  it('keeps the reuse nodes and rules parseable and aligned', async () => {
    const raw = await import(
      '../../../docs/architecture/vitalcv-knowledge-trust-graph.json'
    );
    const graph = raw.default ?? raw;
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        'PSVReceiptReuseDecision',
        'PSVReceiptReuseRequest',
        'PSVReceiptFreshnessWindow',
        'PSVReceiptRevocationState',
        'PSVReceiptSupersession',
        'ReusePolicy',
        'SourceRecheckRequest',
        'ScopedEvidence',
      ]),
    );
    expect(graph.rules).toEqual(
      expect.arrayContaining([
        'Reuse of a PSVReceipt is not automatic verifier acceptance; reusable means may-be-considered as scoped evidence, not finalized verification.',
        'Reuse does not imply current source truth; VitalCV does not actively poll source systems for revocation or change.',
        'Expired, revoked, and superseded receipts cannot be reused.',
        'Scope mismatch (different claim type or different source organization) blocks reuse; a different receipt or a fresh source check is required.',
        'Limitations on a receipt can block reuse for purposes the limitation does not cover (e.g., legally_only receipts cannot back clinical-scope reuse).',
        "A reuse decision keeps PSVReceipt.globalCredentialTruth as the literal false; reuse never upgrades the receipt's truth tier.",
      ]),
    );
  });
});
