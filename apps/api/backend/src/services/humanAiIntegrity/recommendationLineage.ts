/**
 * W2-PR57A — AI recommendation lineage.
 *
 * Truth contract:
 *   - An AiRecommendation is NEVER decision-grade. `decisionGrade: false` and
 *     `proofTier: 'ai_recommendation'` are literal-typed; no caller can upgrade
 *     a recommendation without a type error.
 *   - Every recommendation is tenant-bound. A recommendation produced under
 *     tenant A cannot be reused under tenant B; the type forces tenantId.
 *   - Every recommendation is replay-safe: inputHash + outputHash + modelHash
 *     are deterministic, so a recorded recommendation can be reconstructed
 *     from the same inputs and verified.
 *   - Every interaction with a recommendation (display, override, accept,
 *     defer) emits a LineageEvent. There is no "silent" path: a recommendation
 *     that influenced a human decision MUST have a corresponding event chain.
 *   - Ambiguity is surfaced, not hidden. `ambiguityFlags` and the optional
 *     `rationaleTokens` survive the lineage so reviewers see the same
 *     uncertainty the AI saw.
 *
 * This module is a pure transform — no fetches, no DB writes, no audit-event
 * writes, no model calls. Callers compose it with their own persistence.
 */

export type AiAssistTier =
  | 'suggestion_only'
  | 'pre_filled'
  | 'auto_classified'
  | 'pre_screened';

export type RecommendationSubjectType =
  | 'employer_review'
  | 'issuer_review'
  | 'policy_review'
  | 'passport_action'
  | 'verifier_decision';

export type AmbiguityFlag =
  | 'evidence_conflict'
  | 'low_confidence'
  | 'novel_scenario'
  | 'stale_input'
  | 'cross_tenant_lookalike'
  | 'banned_phrase_risk';

export interface AiRecommendation {
  readonly recommendationId: string;
  readonly tenantId: string;
  readonly subjectId: string;
  readonly subjectType: RecommendationSubjectType;
  readonly emittedAt: string;
  readonly modelId: string;
  readonly modelHash: string;
  readonly inputHash: string;
  readonly outputHash: string;
  readonly tier: AiAssistTier;
  readonly recommendedAction: string;
  readonly confidence: number;
  readonly rationaleSummary: string;
  readonly rationaleTokens: readonly string[];
  readonly ambiguityFlags: readonly AmbiguityFlag[];
  readonly decisionGrade: false;
  readonly proofTier: 'ai_recommendation';
}

export type LineageEventType =
  | 'AI_RECOMMENDATION_EMITTED'
  | 'AI_RECOMMENDATION_DISPLAYED'
  | 'AI_RECOMMENDATION_OVERRIDDEN'
  | 'AI_RECOMMENDATION_ACCEPTED'
  | 'AI_RECOMMENDATION_DEFERRED';

export type ReviewerRole =
  | 'employer_reviewer'
  | 'issuer_reviewer'
  | 'policy_reviewer'
  | 'verifier_admin'
  | 'system_audit';

export interface ReviewerActor {
  readonly id: string;
  readonly role: ReviewerRole;
  readonly tenantId: string;
}

export interface LineageEvent {
  readonly eventId: string;
  readonly eventType: LineageEventType;
  readonly recommendationId: string;
  readonly tenantId: string;
  readonly subjectId: string;
  readonly occurredAt: string;
  readonly reviewerActor?: ReviewerActor;
  readonly humanDecisionAction?: string;
  readonly humanDecisionReason?: string;
  readonly displaySurface?: string;
  readonly displayPresentation?: 'visible' | 'collapsed' | 'tooltip';
  readonly dwellMs?: number;
  readonly ambiguityAcknowledged?: boolean;
}

export interface BuildRecommendationInput {
  recommendationId: string;
  tenantId: string;
  subjectId: string;
  subjectType: RecommendationSubjectType;
  emittedAt: string;
  modelId: string;
  modelHash: string;
  inputHash: string;
  outputHash: string;
  tier: AiAssistTier;
  recommendedAction: string;
  confidence: number;
  rationaleSummary: string;
  rationaleTokens?: readonly string[];
  ambiguityFlags?: readonly AmbiguityFlag[];
}

export function buildAiRecommendation(
  input: BuildRecommendationInput,
): AiRecommendation {
  if (!input.tenantId.trim()) {
    throw new Error(
      'buildAiRecommendation refused: tenantId is required for replay-safe lineage.',
    );
  }
  if (input.confidence < 0 || input.confidence > 1) {
    throw new Error(
      `buildAiRecommendation refused: confidence ${input.confidence} outside [0,1].`,
    );
  }
  if (!input.modelHash.trim() || !input.inputHash.trim() || !input.outputHash.trim()) {
    throw new Error(
      'buildAiRecommendation refused: modelHash, inputHash, outputHash are required for replay.',
    );
  }

  return {
    recommendationId: input.recommendationId,
    tenantId: input.tenantId,
    subjectId: input.subjectId,
    subjectType: input.subjectType,
    emittedAt: input.emittedAt,
    modelId: input.modelId,
    modelHash: input.modelHash,
    inputHash: input.inputHash,
    outputHash: input.outputHash,
    tier: input.tier,
    recommendedAction: input.recommendedAction,
    confidence: input.confidence,
    rationaleSummary: input.rationaleSummary,
    rationaleTokens: input.rationaleTokens ?? [],
    ambiguityFlags: input.ambiguityFlags ?? [],
    decisionGrade: false,
    proofTier: 'ai_recommendation',
  };
}

export interface BuildLineageEventInput {
  eventId: string;
  eventType: LineageEventType;
  recommendation: AiRecommendation;
  occurredAt: string;
  reviewerActor?: ReviewerActor;
  humanDecisionAction?: string;
  humanDecisionReason?: string;
  displaySurface?: string;
  displayPresentation?: 'visible' | 'collapsed' | 'tooltip';
  dwellMs?: number;
  ambiguityAcknowledged?: boolean;
}

export function emitLineageEvent(input: BuildLineageEventInput): LineageEvent {
  if (
    input.reviewerActor &&
    input.reviewerActor.tenantId !== input.recommendation.tenantId
  ) {
    throw new Error(
      `emitLineageEvent refused: reviewer tenant ${input.reviewerActor.tenantId} does not match recommendation tenant ${input.recommendation.tenantId}.`,
    );
  }
  if (
    input.eventType === 'AI_RECOMMENDATION_OVERRIDDEN' &&
    (!input.humanDecisionAction || !input.humanDecisionReason)
  ) {
    throw new Error(
      'emitLineageEvent refused: OVERRIDDEN requires humanDecisionAction and humanDecisionReason.',
    );
  }
  if (input.dwellMs !== undefined && input.dwellMs < 0) {
    throw new Error(
      'emitLineageEvent refused: dwellMs cannot be negative.',
    );
  }

  return {
    eventId: input.eventId,
    eventType: input.eventType,
    recommendationId: input.recommendation.recommendationId,
    tenantId: input.recommendation.tenantId,
    subjectId: input.recommendation.subjectId,
    occurredAt: input.occurredAt,
    reviewerActor: input.reviewerActor,
    humanDecisionAction: input.humanDecisionAction,
    humanDecisionReason: input.humanDecisionReason,
    displaySurface: input.displaySurface,
    displayPresentation: input.displayPresentation,
    dwellMs: input.dwellMs,
    ambiguityAcknowledged: input.ambiguityAcknowledged,
  };
}

export interface LineageReconstruction {
  readonly recommendationId: string;
  readonly tenantId: string;
  readonly subjectId: string;
  readonly events: readonly LineageEvent[];
  readonly emittedAt?: string;
  readonly displayedAt?: string;
  readonly resolvedAt?: string;
  readonly resolution: 'accepted' | 'overridden' | 'deferred' | 'unresolved';
  readonly humanInTheLoop: boolean;
  readonly tenantBoundaryConsistent: boolean;
  readonly missingPriorEmission: boolean;
}

export function reconstructLineage(
  events: readonly LineageEvent[],
): LineageReconstruction {
  if (events.length === 0) {
    throw new Error('reconstructLineage refused: empty event list.');
  }

  const recommendationIds = new Set(events.map((e) => e.recommendationId));
  if (recommendationIds.size !== 1) {
    throw new Error(
      `reconstructLineage refused: events must share one recommendationId; saw ${recommendationIds.size}.`,
    );
  }

  const tenantIds = new Set(events.map((e) => e.tenantId));
  const tenantBoundaryConsistent = tenantIds.size === 1;

  const sorted = [...events].sort((a, b) =>
    a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0,
  );

  const firstEvent = sorted[0]!;
  const recommendationId = firstEvent.recommendationId;
  const tenantId = firstEvent.tenantId;
  const subjectId = firstEvent.subjectId;

  const emitted = sorted.find((e) => e.eventType === 'AI_RECOMMENDATION_EMITTED');
  const displayed = sorted.find((e) => e.eventType === 'AI_RECOMMENDATION_DISPLAYED');
  const accepted = sorted.find((e) => e.eventType === 'AI_RECOMMENDATION_ACCEPTED');
  const overridden = sorted.find((e) => e.eventType === 'AI_RECOMMENDATION_OVERRIDDEN');
  const deferred = sorted.find((e) => e.eventType === 'AI_RECOMMENDATION_DEFERRED');

  const resolutionEvent = accepted ?? overridden ?? deferred;
  const resolution: LineageReconstruction['resolution'] = accepted
    ? 'accepted'
    : overridden
      ? 'overridden'
      : deferred
        ? 'deferred'
        : 'unresolved';

  const humanInTheLoop = sorted.some(
    (e) =>
      e.reviewerActor !== undefined &&
      (e.eventType === 'AI_RECOMMENDATION_DISPLAYED' ||
        e.eventType === 'AI_RECOMMENDATION_OVERRIDDEN' ||
        e.eventType === 'AI_RECOMMENDATION_ACCEPTED' ||
        e.eventType === 'AI_RECOMMENDATION_DEFERRED'),
  );

  return {
    recommendationId,
    tenantId,
    subjectId,
    events: sorted,
    emittedAt: emitted?.occurredAt,
    displayedAt: displayed?.occurredAt,
    resolvedAt: resolutionEvent?.occurredAt,
    resolution,
    humanInTheLoop,
    tenantBoundaryConsistent,
    missingPriorEmission: !emitted,
  };
}
