/**
 * policyDecisionRepo.ts
 *
 * Persists PolicyReviewDecision rows to the database.
 *
 * Truth contracts (enforced at runtime, not just types):
 *   - automatedPolicyEngine: false — there is no automated approval path.
 *     Every persisted row must have a non-empty reviewerActorId supplied
 *     by an explicit human reviewer action.
 *   - decisionGrade: false literal — a policy review decision produces
 *     only a candidate; it is never decision-grade on its own.
 *   - Missing reviewerActorId throws unconditionally; it does not fall
 *     back to a system actor or an empty string.
 *
 * This module is server-only and performs real DB writes when called.
 * It is intentionally separate from the pure-transform policyReview.ts.
 */
import 'server-only';
import { prisma } from '@/lib/db';
import type { PolicyReviewDecision } from '@/lib/issuer-verification/types';

export type PolicyPersistenceState = {
  automatedPolicyEngine: false;
};

export const POLICY_PERSISTENCE_STATE: PolicyPersistenceState = {
  automatedPolicyEngine: false,
};

export interface PersistPolicyDecisionInput {
  decision: PolicyReviewDecision;
  /** Required. No auto-approve path exists — this must identify the human reviewer. */
  reviewerActorId: string;
}

export interface PersistedPolicyDecision {
  id: string;
  decisionId: string;
  receiptCandidateId: string;
  requestId: string;
  action: string;
  status: string;
  decidedAt: string;
  reviewerActorId: string;
  /** Literal false — preserved through the DB round-trip. */
  decisionGrade: false;
  /** Literal false — no automated policy engine exists. */
  automatedPolicyEngine: false;
  createdPsvReceiptCandidate: boolean;
  createdAt: Date;
}

/**
 * Persist a PolicyReviewDecision row.
 *
 * Throws if `reviewerActorId` is absent or empty — this is the runtime
 * guard for the "no auto-approve path" contract. The type alone is not
 * sufficient because callers could pass an empty string.
 */
export async function persistPolicyDecision(
  input: PersistPolicyDecisionInput,
): Promise<PersistedPolicyDecision> {
  if (!input.reviewerActorId || input.reviewerActorId.trim() === '') {
    throw new Error(
      'persistPolicyDecision: reviewerActorId is required — no auto-approve path exists.',
    );
  }

  const { decision } = input;

  const row = await prisma.policyReviewDecision.create({
    data: {
      decisionId: decision.decisionId,
      receiptCandidateId: decision.receiptCandidateId,
      requestId: decision.requestId,
      action: decision.action,
      status: decision.status,
      decidedAt: decision.decidedAt,
      reviewerActorId: input.reviewerActorId,
      reviewerDisplayName: decision.actor.displayName,
      reviewerRole: decision.actor.role,
      rationale: decision.rationale ?? null,
      decisionGrade: false,
      automatedPolicyEngine: false,
      createdPsvReceiptCandidate: decision.createdPsvReceiptCandidate,
    },
  });

  return {
    id: row.id,
    decisionId: row.decisionId,
    receiptCandidateId: row.receiptCandidateId,
    requestId: row.requestId,
    action: row.action,
    status: row.status,
    decidedAt: row.decidedAt,
    reviewerActorId: row.reviewerActorId,
    decisionGrade: false,
    automatedPolicyEngine: false,
    createdPsvReceiptCandidate: row.createdPsvReceiptCandidate,
    createdAt: row.createdAt,
  };
}
