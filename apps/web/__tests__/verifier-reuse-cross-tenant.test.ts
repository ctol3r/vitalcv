import { describe, expect, it } from 'vitest';
import {
  buildPsvReceiptReuseDecision,
  checkCrossTenantReuseBlock,
} from '../lib/issuer-verification/psvReceiptReuse';
import type {
  PSVReceiptReuseRequest,
  PSVReceiptReuseScope,
} from '../lib/issuer-verification/psvReceiptReuse';
import type { PSVReceipt, PSVReceiptScope } from '../lib/issuer-verification/types';

const SCOPE: PSVReceiptScope = {
  claimType: 'residency',
  covers: 'Confirms completion of the residency program.',
  doesNotCover: 'Does not confirm board certification or license status.',
  sourceOrganizationName: 'Demo GME Office',
};

function makeReceipt(overrides: Partial<PSVReceipt> = {}): PSVReceipt {
  return {
    psvReceiptId: 'psv-cross-1',
    psvCandidateId: 'psv-1',
    receiptCandidateId: 'rc-1',
    requestId: 'req-1',
    claimId: 'claim-1',
    claimType: 'residency',
    promotedAt: '2026-04-01T00:00:00.000Z',
    promotedBy: { actorId: 'actor-1', displayName: 'Pat Reviewer', role: 'policy_reviewer' },
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

const REUSE_SCOPE: PSVReceiptReuseScope = {
  claimType: 'residency',
  sourceOrganizationName: 'Demo GME Office',
  purpose: 'Reuse for a new pilot enrollment.',
};

function decisionOptions(id = 'reuse-cross-1') {
  return { decisionId: id, decidedAt: '2026-05-01T00:00:00.000Z', recordedBy: 'demo' as const };
}

// Case 1 — cross-tenant reuse without consent is blocked
describe('cross-tenant reuse without consent receipt', () => {
  it('returns reuseStatus blocked_cross_tenant when tenants differ and no consent id', () => {
    const request: PSVReceiptReuseRequest = {
      receipt: makeReceipt(),
      reuseScope: REUSE_SCOPE,
      nowIso: '2026-05-01T00:00:00.000Z',
      requestingTenantId: 'tenant-employer-abc',
      issuingTenantId: 'tenant-hospital-xyz',
    };
    const decision = buildPsvReceiptReuseDecision(request, decisionOptions());
    expect(decision.status).toBe('blocked_cross_tenant');
    expect(decision.reusable).toBe(false);
    expect(decision.failureReason).toBe('cross_tenant_no_consent');
    // Truth contract: reuse never returns a PSVReceipt or upgrades truth tier
    expect(decision.globalCredentialTruth).toBe(false);
  });

  it('standalone guard also returns blocked=true without consent', () => {
    const result = checkCrossTenantReuseBlock('tenant-employer-abc', 'tenant-hospital-xyz');
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.reason).toBe('cross_tenant_no_consent');
  });
});

// Case 2 — cross-tenant reuse with explicit consent receipt is permitted
describe('cross-tenant reuse with explicit consent receipt', () => {
  it('permits reuse when crossTenantConsentReceiptId is present', () => {
    const request: PSVReceiptReuseRequest = {
      receipt: makeReceipt(),
      reuseScope: REUSE_SCOPE,
      nowIso: '2026-05-01T00:00:00.000Z',
      requestingTenantId: 'tenant-employer-abc',
      issuingTenantId: 'tenant-hospital-xyz',
      crossTenantConsentReceiptId: 'consent-receipt-99',
    };
    const decision = buildPsvReceiptReuseDecision(request, decisionOptions('reuse-cross-2'));
    expect(decision.status).toBe('reusable');
    expect(decision.reusable).toBe(true);
    expect(decision.failureReason).toBeUndefined();
    // Truth contract: reuse never returns PSVReceipt or promotes truth tier
    expect(decision.globalCredentialTruth).toBe(false);
  });

  it('standalone guard returns blocked=false when consent id is present', () => {
    const result = checkCrossTenantReuseBlock(
      'tenant-employer-abc',
      'tenant-hospital-xyz',
      'consent-receipt-99',
    );
    expect(result.blocked).toBe(false);
  });
});
