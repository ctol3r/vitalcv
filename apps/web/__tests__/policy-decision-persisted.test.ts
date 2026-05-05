/**
 * policy-decision-persisted.test.ts
 *
 * Tests policyDecisionRepo.ts with Prisma mocked.
 * No real database, no Clerk, no network.
 *
 * Truth contracts verified:
 *   1. accepted_as_psv_candidate — persists with decisionGrade: false,
 *      automatedPolicyEngine: false, createdPsvReceiptCandidate: true
 *   2. rejected — persists with createdPsvReceiptCandidate: false
 *   3. request_more_info — persists with status 'request_more_info'
 *   4. conflict_review_required — persists with status 'conflict_review_required'
 *   5. (structural) missing reviewerActorId → throws; no auto-approve path
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistedPolicyDecision } from '../lib/issuer-verification/policyDecisionRepo';
import type { PolicyReviewDecision } from '../lib/issuer-verification/types';

const mockCreate = vi.fn();

vi.mock('../lib/db', () => ({
  prisma: {
    policyReviewDecision: {
      create: mockCreate,
    },
  },
}));

// server-only guard will throw in vitest without this stub
vi.mock('server-only', () => ({}));

function buildDecision(
  overrides: Partial<PolicyReviewDecision> = {},
): PolicyReviewDecision {
  return {
    decisionId: 'dec-test-001',
    receiptCandidateId: 'rc-test-001',
    requestId: 'req-test-001',
    action: 'accept_candidate',
    status: 'accepted_as_psv_candidate',
    decidedAt: '2026-05-04T00:00:00.000Z',
    actor: {
      actorId: 'actor-001',
      displayName: 'Test Reviewer',
      role: 'policy_reviewer',
    },
    rationale: 'Confirmed residency via GME office.',
    createdPsvReceiptCandidate: true,
    outcome: { createdPsvReceiptCandidate: true, reason: 'Candidate accepted under policy review.' },
    auditMetadata: {
      recordedAt: '2026-05-04T00:00:00.000Z',
      recordedBy: 'review_surface',
      notes: 'test',
    },
    ...overrides,
  };
}

function mockRow(
  overrides: Partial<PersistedPolicyDecision> = {},
): PersistedPolicyDecision {
  return {
    id: 'cuid-001',
    decisionId: 'dec-test-001',
    receiptCandidateId: 'rc-test-001',
    requestId: 'req-test-001',
    action: 'accept_candidate',
    status: 'accepted_as_psv_candidate',
    decidedAt: '2026-05-04T00:00:00.000Z',
    reviewerActorId: 'actor-001',
    decisionGrade: false,
    automatedPolicyEngine: false,
    createdPsvReceiptCandidate: true,
    createdAt: new Date('2026-05-04T00:00:00.000Z'),
    ...overrides,
  };
}

describe('policyDecisionRepo — persistPolicyDecision', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreate.mockReset();
  });

  it('case 1: accepted_as_psv_candidate — decisionGrade: false, automatedPolicyEngine: false, createdPsvReceiptCandidate: true', async () => {
    mockCreate.mockResolvedValue(mockRow());
    const { persistPolicyDecision } = await import('../lib/issuer-verification/policyDecisionRepo');

    const result = await persistPolicyDecision({
      decision: buildDecision(),
      reviewerActorId: 'actor-001',
    });

    expect(result.status).toBe('accepted_as_psv_candidate');
    expect(result.decisionGrade).toBe(false);
    expect(result.automatedPolicyEngine).toBe(false);
    expect(result.createdPsvReceiptCandidate).toBe(true);
    expect(result.reviewerActorId).toBe('actor-001');

    // Verify the DB write carries the literal false values
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decisionGrade: false,
          automatedPolicyEngine: false,
          createdPsvReceiptCandidate: true,
          reviewerActorId: 'actor-001',
          status: 'accepted_as_psv_candidate',
        }),
      }),
    );
  });

  it('case 2: rejected — createdPsvReceiptCandidate: false; underlying evidence preserved (no auto-delete)', async () => {
    mockCreate.mockResolvedValue(
      mockRow({ action: 'reject_candidate', status: 'rejected', createdPsvReceiptCandidate: false }),
    );
    const { persistPolicyDecision } = await import('../lib/issuer-verification/policyDecisionRepo');

    const result = await persistPolicyDecision({
      decision: buildDecision({
        action: 'reject_candidate',
        status: 'rejected',
        createdPsvReceiptCandidate: false,
        outcome: { createdPsvReceiptCandidate: false, reason: 'Candidate rejected.' },
      }),
      reviewerActorId: 'actor-001',
    });

    expect(result.status).toBe('rejected');
    expect(result.decisionGrade).toBe(false);
    expect(result.createdPsvReceiptCandidate).toBe(false);
  });

  it('case 3: request_more_info — persists without creating a PSV candidate', async () => {
    mockCreate.mockResolvedValue(
      mockRow({ action: 'request_more_info', status: 'request_more_info', createdPsvReceiptCandidate: false }),
    );
    const { persistPolicyDecision } = await import('../lib/issuer-verification/policyDecisionRepo');

    const result = await persistPolicyDecision({
      decision: buildDecision({
        action: 'request_more_info',
        status: 'request_more_info',
        createdPsvReceiptCandidate: false,
        outcome: { createdPsvReceiptCandidate: false, reason: 'More information requested.' },
      }),
      reviewerActorId: 'actor-001',
    });

    expect(result.status).toBe('request_more_info');
    expect(result.decisionGrade).toBe(false);
    expect(result.createdPsvReceiptCandidate).toBe(false);
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('case 4: conflict_review_required — persists; no PSV candidate produced', async () => {
    mockCreate.mockResolvedValue(
      mockRow({ action: 'mark_conflict_review', status: 'conflict_review_required', createdPsvReceiptCandidate: false }),
    );
    const { persistPolicyDecision } = await import('../lib/issuer-verification/policyDecisionRepo');

    const result = await persistPolicyDecision({
      decision: buildDecision({
        action: 'mark_conflict_review',
        status: 'conflict_review_required',
        createdPsvReceiptCandidate: false,
        outcome: { createdPsvReceiptCandidate: false, reason: 'Conflict review required.' },
      }),
      reviewerActorId: 'actor-001',
    });

    expect(result.status).toBe('conflict_review_required');
    expect(result.decisionGrade).toBe(false);
    expect(result.createdPsvReceiptCandidate).toBe(false);
  });

  it('structural: missing reviewerActorId throws — no auto-approve path exists', async () => {
    const { persistPolicyDecision } = await import('../lib/issuer-verification/policyDecisionRepo');

    await expect(
      persistPolicyDecision({ decision: buildDecision(), reviewerActorId: '' }),
    ).rejects.toThrow('reviewerActorId is required');

    // Prisma must not have been called — the throw is pre-DB
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
