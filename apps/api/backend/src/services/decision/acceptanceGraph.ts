// ── VitalCV Acceptance Graph MVP (Deterministic) ───────────────────
// STRICT RULE: No ML, no probabilistic modeling, no learning layer.
// Maps a clinician's raw Proof Manifest against an Organization's
// hard-coded compliance requirements.

import { SourceStatus } from '../../../../../../packages/trust-contract/src/index';
import { StoredDecisionCapsule } from './decisionCapsuleLearning';

// ── Organization Model ──────────────────────────────────────────

export interface OrgComplianceRule {
  /** e.g. "oig.exclusion" or "identity.state_license" */
  claimType: string;
  /** Maximum acceptable age for this check (in milliseconds) */
  requiredFreshnessMs: number;
  /** Whether this rule is an absolute blocker or just a warning */
  isCritical: boolean;
}

export interface OrganizationRequirements {
  orgId: string;
  name: string;
  rules: OrgComplianceRule[];
}

// ── Graph Matching Engine ───────────────────────────────────────

export type RequirementStatus = 'satisfied' | 'missing' | 'blocked';

export interface EvaluatedRequirement {
  rule: OrgComplianceRule;
  status: RequirementStatus;
  evidenceId?: string;
  detail: string;
}

export interface AcceptanceState {
  orgId: string;
  isReady: boolean;
  historicalAcceptanceRate: number; // 0.0 to 1.0 based on org-matched Decision Capsules
  historicalCapsuleCount: number;  // number of capsules matched to this org
  blockers: EvaluatedRequirement[];
  missingActions: EvaluatedRequirement[];
  satisfied: EvaluatedRequirement[];
}

export interface AcceptancePrediction {
  score: number;
  band: 'UNLIKELY_TO_ACCEPT' | 'LIKELY_TO_ACCEPT';
  explanation: string;
  missingRequirementCount: number;
}

/**
 * Deterministically evaluates a ProofManifest against an Organization's requirements,
 * enriched by historical Decision Capsules.
 */
type ClaimInput = { type: string; id: string; status: SourceStatus; ageMs: number; hardBlockReason?: string };

const HARD_BLOCK_MESSAGES: Record<string, string> = {
  EXPIRED_DEA: 'DEA registration is expired and must be renewed before placement.',
  EXPIRED_LICENSE: 'State license is expired and must be renewed before placement.',
};

export function evaluateAcceptanceGraph(
  org: OrganizationRequirements,
  manifestClaims: ClaimInput[],
  historicalCapsules: StoredDecisionCapsule[] = []
): AcceptanceState {
  const evaluated: EvaluatedRequirement[] = [];

  const orgCapsules = historicalCapsules.filter(c => c.payload.orgId === org.orgId);
  const historicalCapsuleCount = orgCapsules.length;
  let historicalAcceptanceRate = 1.0;
  if (historicalCapsuleCount > 0) {
    const acceptedOrStarted = orgCapsules.filter(c =>
      c.payload.outcome === 'ACCEPTED' || c.payload.outcome === 'STARTED'
    ).length;
    historicalAcceptanceRate = acceptedOrStarted / historicalCapsuleCount;
  }

  for (const rule of org.rules) {
    const claim = manifestClaims.find(c => c.type === rule.claimType);

    if (!claim) {
      evaluated.push({
        rule,
        status: 'missing',
        detail: `Required claim type ${rule.claimType} is entirely missing from the manifest.`,
      });
      continue;
    }

    if (claim.hardBlockReason) {
      evaluated.push({
        rule,
        status: 'blocked',
        evidenceId: claim.id,
        detail: HARD_BLOCK_MESSAGES[claim.hardBlockReason] ?? `Hard block: ${claim.hardBlockReason}`,
      });
      continue;
    }

    if (claim.status !== SourceStatus.CHECKED) {
      evaluated.push({
        rule,
        status: rule.isCritical ? 'blocked' : 'missing',
        evidenceId: claim.id,
        detail: `Claim ${rule.claimType} exists but status is ${claim.status} (requires CHECKED).`,
      });
      continue;
    }

    if (claim.ageMs > rule.requiredFreshnessMs) {
      evaluated.push({
        rule,
        status: rule.isCritical ? 'blocked' : 'missing',
        evidenceId: claim.id,
        detail: `Claim ${rule.claimType} is too old (${Math.round(claim.ageMs / 86400000)} days). Org requires freshness within ${Math.round(rule.requiredFreshnessMs / 86400000)} days.`,
      });
      continue;
    }

    evaluated.push({
      rule,
      status: 'satisfied',
      evidenceId: claim.id,
      detail: 'Meets org requirements for freshness and status.',
    });
  }

  const blockers = evaluated.filter(e => e.status === 'blocked');
  const missingActions = evaluated.filter(e => e.status === 'missing');
  const satisfied = evaluated.filter(e => e.status === 'satisfied');

  return {
    orgId: org.orgId,
    isReady: blockers.length === 0 && missingActions.length === 0,
    historicalAcceptanceRate,
    historicalCapsuleCount,
    blockers,
    missingActions,
    satisfied,
  };
}

export function predictAcceptance(state: AcceptanceState): AcceptancePrediction {
  if (state.blockers.length > 0) {
    return {
      score: 0,
      band: 'UNLIKELY_TO_ACCEPT',
      explanation: `Blocked by adverse signal: ${state.blockers.map(b => b.detail).join('; ')}`,
      missingRequirementCount: state.missingActions.length,
    };
  }

  const missingCount = state.missingActions.length;
  const score = missingCount > 0
    ? Math.min(state.historicalAcceptanceRate, 0.8)
    : state.historicalAcceptanceRate;

  return {
    score,
    band: 'LIKELY_TO_ACCEPT',
    explanation: missingCount > 0
      ? `${missingCount} requirement(s) still missing; score capped at 0.8`
      : `All requirements satisfied; historical acceptance rate ${(state.historicalAcceptanceRate * 100).toFixed(0)}%`,
    missingRequirementCount: missingCount,
  };
}
