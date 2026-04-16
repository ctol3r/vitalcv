// ── VitalCV Acceptance Graph MVP (Deterministic) ───────────────────
// STRICT RULE: No ML, no probabilistic modeling, no learning layer.
// Maps a clinician's raw Proof Manifest against an Organization's
// hard-coded compliance requirements.

import { SourceStatus } from '../../../../packages/trust-contract/src/index';

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
  blockers: EvaluatedRequirement[];
  missingActions: EvaluatedRequirement[];
  satisfied: EvaluatedRequirement[];
}

/**
 * Deterministically evaluates a ProofManifest against an Organization's requirements.
 */
export function evaluateAcceptanceGraph(
  org: OrganizationRequirements,
  manifestClaims: { type: string; id: string; status: SourceStatus; ageMs: number }[]
): AcceptanceState {
  const evaluated: EvaluatedRequirement[] = [];

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

    // Passed all gates
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
    blockers,
    missingActions,
    satisfied,
  };
}
