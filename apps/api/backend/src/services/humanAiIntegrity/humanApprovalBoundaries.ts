/**
 * W2-PR57A — Human approval boundaries.
 *
 * Fail-closed taxonomy: every decision domain in VitalCV maps to exactly one
 * approval boundary. Domains that are not in the table are rejected by default,
 * so adding a new AI-assisted surface MUST go through this file.
 *
 * Boundary semantics:
 *   - human_only: AI MUST NOT emit a recommendation. Even displaying one is
 *     a violation. Used for irreversible / high-stakes decisions (PSV
 *     promotion, exclusion overrides, conflict resolution).
 *   - human_approves_ai_suggestion: AI may suggest, but the human must
 *     explicitly accept. Default-deny: silence/timeout = no decision.
 *   - ai_suggests_human_overrides: AI suggests, the surface defaults to the
 *     suggestion only if a reviewer has explicitly seen-and-acknowledged.
 *     Override is always one click away with a reason field.
 *   - ai_acts_human_can_veto: AI may act on a low-stakes default (e.g. queue
 *     prioritization), but every action emits a lineage event the reviewer
 *     can revert. Never used for credentialing decisions.
 */

import type { AiRecommendation } from './recommendationLineage';

export type DecisionDomain =
  | 'employer_review_acceptance'
  | 'employer_review_routing'
  | 'employer_review_refresh_request'
  | 'issuer_response_intake'
  | 'policy_review_decision'
  | 'psv_candidate_promotion'
  | 'exclusion_override'
  | 'conflict_resolution'
  | 'queue_prioritization'
  | 'review_packet_assembly';

export type ApprovalBoundary =
  | 'human_only'
  | 'human_approves_ai_suggestion'
  | 'ai_suggests_human_overrides'
  | 'ai_acts_human_can_veto';

export const APPROVAL_BOUNDARY_BY_DOMAIN: Record<DecisionDomain, ApprovalBoundary> = {
  policy_review_decision: 'human_only',
  psv_candidate_promotion: 'human_only',
  exclusion_override: 'human_only',
  conflict_resolution: 'human_only',
  employer_review_acceptance: 'human_approves_ai_suggestion',
  issuer_response_intake: 'human_approves_ai_suggestion',
  employer_review_routing: 'ai_suggests_human_overrides',
  employer_review_refresh_request: 'ai_suggests_human_overrides',
  review_packet_assembly: 'ai_suggests_human_overrides',
  queue_prioritization: 'ai_acts_human_can_veto',
};

export type GateRefusalReason =
  | 'ai_emission_forbidden_human_only_domain'
  | 'tier_exceeds_boundary'
  | 'unknown_domain';

export interface GateOutcome {
  readonly admitted: boolean;
  readonly boundary?: ApprovalBoundary;
  readonly refusalReason?: GateRefusalReason;
  readonly reason: string;
}

const TIER_RANK: Record<AiRecommendation['tier'], number> = {
  suggestion_only: 1,
  pre_filled: 2,
  auto_classified: 3,
  pre_screened: 4,
};

const BOUNDARY_MAX_TIER: Record<ApprovalBoundary, number> = {
  human_only: 0,
  human_approves_ai_suggestion: 1,
  ai_suggests_human_overrides: 3,
  ai_acts_human_can_veto: 4,
};

export function gateRecommendation(
  domain: DecisionDomain | string,
  recommendation: AiRecommendation,
): GateOutcome {
  const boundary = APPROVAL_BOUNDARY_BY_DOMAIN[domain as DecisionDomain];
  if (!boundary) {
    return {
      admitted: false,
      refusalReason: 'unknown_domain',
      reason: `Domain ${domain} is not registered in APPROVAL_BOUNDARY_BY_DOMAIN. Fail-closed: AI may not emit a recommendation here until the domain is added.`,
    };
  }

  if (boundary === 'human_only') {
    return {
      admitted: false,
      boundary,
      refusalReason: 'ai_emission_forbidden_human_only_domain',
      reason: `Domain ${domain} is human_only. AI may not emit a recommendation; the surface must show a clean human-decision form.`,
    };
  }

  const tierRank = TIER_RANK[recommendation.tier];
  const maxTier = BOUNDARY_MAX_TIER[boundary];
  if (tierRank > maxTier) {
    return {
      admitted: false,
      boundary,
      refusalReason: 'tier_exceeds_boundary',
      reason: `Recommendation tier ${recommendation.tier} (rank ${tierRank}) exceeds max tier rank ${maxTier} for boundary ${boundary}.`,
    };
  }

  return {
    admitted: true,
    boundary,
    reason: `Recommendation admitted under boundary ${boundary} for domain ${domain}.`,
  };
}

export function isHumanOnly(domain: DecisionDomain): boolean {
  return APPROVAL_BOUNDARY_BY_DOMAIN[domain] === 'human_only';
}
