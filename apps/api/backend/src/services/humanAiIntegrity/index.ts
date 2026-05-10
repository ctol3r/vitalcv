/**
 * W2-PR57A — Human-AI integrity barrel.
 *
 * Public surface for human-AI integrity. Importers should use this barrel
 * rather than reaching into individual modules so any future invariant
 * additions remain discoverable.
 */

export type {
  AiRecommendation,
  AiAssistTier,
  AmbiguityFlag,
  BuildLineageEventInput,
  BuildRecommendationInput,
  LineageEvent,
  LineageEventType,
  LineageReconstruction,
  RecommendationSubjectType,
  ReviewerActor,
  ReviewerRole,
} from './recommendationLineage';
export {
  buildAiRecommendation,
  emitLineageEvent,
  reconstructLineage,
} from './recommendationLineage';

export type {
  ApprovalBoundary,
  DecisionDomain,
  GateOutcome,
  GateRefusalReason,
} from './humanApprovalBoundaries';
export {
  APPROVAL_BOUNDARY_BY_DOMAIN,
  gateRecommendation,
  isHumanOnly,
} from './humanApprovalBoundaries';

export type {
  BiasFinding,
  BiasReport,
  BiasSeverity,
  BiasSignal,
  BiasThresholds,
} from './automationBiasDetector';
export {
  DEFAULT_BIAS_THRESHOLDS,
  detectAutomationBias,
} from './automationBiasDetector';

export type {
  BuildReviewerOverrideInput,
  OverrideKind,
  ReviewerConfidence,
  ReviewerConfidenceSummary,
  ReviewerOverrideRecord,
} from './reviewerConfidence';
export {
  buildReviewerOverride,
  summarizeReviewerConfidence,
} from './reviewerConfidence';

export type {
  ContractCheckInput,
  ExplainabilityInvariant,
  InvariantViolation,
  ReplaySample,
  ReviewStateTransition,
} from './explainabilityContract';
export {
  EXPLAINABILITY_INVARIANTS,
  checkExplainabilityContract,
  checkLineageCompleteness,
  checkRecommendationShape,
  checkReplayConsistency,
  checkReviewStateTransitions,
} from './explainabilityContract';
