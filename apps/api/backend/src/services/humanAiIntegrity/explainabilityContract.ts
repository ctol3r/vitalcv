/**
 * W2-PR57A — Explainability contract.
 *
 * Six invariants that every AI-assisted surface in VitalCV MUST uphold.
 * Violations are not warnings — they fail the integrity gate.
 *
 *   I1 no_ai_decisionGrade_upgrade: an AiRecommendation can never carry
 *      decisionGrade=true or upgrade a downstream candidate's decisionGrade.
 *   I2 no_silent_recommendation: every recommendation that influenced a human
 *      decision MUST have at least an EMITTED and a resolution event.
 *   I3 no_ambiguity_collapse: when ambiguityFlags is non-empty, accept events
 *      MUST set ambiguityAcknowledged=true.
 *   I4 no_review_state_jump: an AI recommendation cannot move a candidate
 *      directly from review_required to ready_for_policy_review without an
 *      explicit human override event with a reason.
 *   I5 tenant_isolation: every event in a recommendation's lineage carries
 *      the same tenantId as the recommendation itself.
 *   I6 replay_safe_lineage: same modelHash + same inputHash MUST imply same
 *      outputHash (deterministic; replays produce identical recommendations).
 *
 * This module checks invariants against in-memory data structures. Storage
 * and CI gating are caller responsibilities.
 */

import type { AiRecommendation, LineageEvent } from './recommendationLineage';

export const EXPLAINABILITY_INVARIANTS = [
  'no_ai_decisionGrade_upgrade',
  'no_silent_recommendation',
  'no_ambiguity_collapse',
  'no_review_state_jump',
  'tenant_isolation',
  'replay_safe_lineage',
] as const;

export type ExplainabilityInvariant = (typeof EXPLAINABILITY_INVARIANTS)[number];

export interface InvariantViolation {
  readonly invariant: ExplainabilityInvariant;
  readonly recommendationId: string;
  readonly tenantId?: string;
  readonly detail: string;
}

export interface ReplaySample {
  readonly modelHash: string;
  readonly inputHash: string;
  readonly outputHash: string;
  readonly recommendationId: string;
  readonly tenantId: string;
}

export interface ReviewStateTransition {
  readonly recommendationId: string;
  readonly tenantId: string;
  readonly fromState: string;
  readonly toState: string;
  readonly drivenBy: 'human' | 'ai' | 'system';
  readonly humanReason?: string;
}

export function checkRecommendationShape(
  recommendation: AiRecommendation,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if ((recommendation.decisionGrade as unknown) !== false) {
    violations.push({
      invariant: 'no_ai_decisionGrade_upgrade',
      recommendationId: recommendation.recommendationId,
      tenantId: recommendation.tenantId,
      detail: `Recommendation has decisionGrade=${String(recommendation.decisionGrade)} but the contract requires literal false.`,
    });
  }
  if (recommendation.proofTier !== 'ai_recommendation') {
    violations.push({
      invariant: 'no_ai_decisionGrade_upgrade',
      recommendationId: recommendation.recommendationId,
      tenantId: recommendation.tenantId,
      detail: `Recommendation proofTier is ${String(recommendation.proofTier)} but the contract requires 'ai_recommendation'.`,
    });
  }

  return violations;
}

export function checkLineageCompleteness(
  recommendation: AiRecommendation,
  events: readonly LineageEvent[],
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const matched = events.filter(
    (e) => e.recommendationId === recommendation.recommendationId,
  );
  const hasEmitted = matched.some((e) => e.eventType === 'AI_RECOMMENDATION_EMITTED');
  const hasResolution = matched.some(
    (e) =>
      e.eventType === 'AI_RECOMMENDATION_ACCEPTED' ||
      e.eventType === 'AI_RECOMMENDATION_OVERRIDDEN' ||
      e.eventType === 'AI_RECOMMENDATION_DEFERRED',
  );

  if (!hasEmitted) {
    violations.push({
      invariant: 'no_silent_recommendation',
      recommendationId: recommendation.recommendationId,
      tenantId: recommendation.tenantId,
      detail: 'Recommendation has no EMITTED event in its lineage.',
    });
  }
  if (matched.length > 1 && !hasResolution) {
    violations.push({
      invariant: 'no_silent_recommendation',
      recommendationId: recommendation.recommendationId,
      tenantId: recommendation.tenantId,
      detail: 'Recommendation has display/interaction events but no resolution event.',
    });
  }

  if (recommendation.ambiguityFlags.length > 0) {
    const acceptsWithoutAck = matched.filter(
      (e) =>
        e.eventType === 'AI_RECOMMENDATION_ACCEPTED' &&
        e.ambiguityAcknowledged !== true,
    );
    for (const accept of acceptsWithoutAck) {
      violations.push({
        invariant: 'no_ambiguity_collapse',
        recommendationId: recommendation.recommendationId,
        tenantId: recommendation.tenantId,
        detail: `Accept event ${accept.eventId} did not acknowledge ${recommendation.ambiguityFlags.length} surfaced ambiguity flag(s).`,
      });
    }
  }

  for (const event of matched) {
    if (event.tenantId !== recommendation.tenantId) {
      violations.push({
        invariant: 'tenant_isolation',
        recommendationId: recommendation.recommendationId,
        tenantId: recommendation.tenantId,
        detail: `Event ${event.eventId} carries tenantId=${event.tenantId} which does not match recommendation tenantId=${recommendation.tenantId}.`,
      });
    }
  }

  return violations;
}

export function checkReviewStateTransitions(
  transitions: readonly ReviewStateTransition[],
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const transition of transitions) {
    if (
      transition.drivenBy === 'ai' &&
      transition.fromState === 'review_required' &&
      transition.toState === 'ready_for_policy_review'
    ) {
      violations.push({
        invariant: 'no_review_state_jump',
        recommendationId: transition.recommendationId,
        tenantId: transition.tenantId,
        detail: 'AI cannot move a candidate from review_required to ready_for_policy_review without a human override event.',
      });
    }
    if (
      transition.drivenBy === 'human' &&
      transition.fromState === 'review_required' &&
      transition.toState === 'ready_for_policy_review' &&
      !transition.humanReason?.trim()
    ) {
      violations.push({
        invariant: 'no_review_state_jump',
        recommendationId: transition.recommendationId,
        tenantId: transition.tenantId,
        detail: 'Human-driven jump from review_required to ready_for_policy_review requires a non-empty reason.',
      });
    }
  }

  return violations;
}

export function checkReplayConsistency(
  samples: readonly ReplaySample[],
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const byKey = new Map<string, ReplaySample>();

  for (const sample of samples) {
    const key = `${sample.modelHash}:${sample.inputHash}`;
    const prior = byKey.get(key);
    if (prior && prior.outputHash !== sample.outputHash) {
      violations.push({
        invariant: 'replay_safe_lineage',
        recommendationId: sample.recommendationId,
        tenantId: sample.tenantId,
        detail: `Same modelHash + inputHash produced different outputHash (this=${sample.outputHash}, prior=${prior.outputHash}).`,
      });
    } else if (!prior) {
      byKey.set(key, sample);
    }
  }

  return violations;
}

export interface ContractCheckInput {
  recommendation: AiRecommendation;
  events: readonly LineageEvent[];
  transitions?: readonly ReviewStateTransition[];
  replaySamples?: readonly ReplaySample[];
}

export function checkExplainabilityContract(
  input: ContractCheckInput,
): InvariantViolation[] {
  return [
    ...checkRecommendationShape(input.recommendation),
    ...checkLineageCompleteness(input.recommendation, input.events),
    ...checkReviewStateTransitions(input.transitions ?? []),
    ...checkReplayConsistency(input.replaySamples ?? []),
  ];
}
