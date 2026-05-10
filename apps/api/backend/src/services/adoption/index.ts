/**
 * index.ts — W2-PR140A barrel
 *
 * Public surface of the institutional ecosystem readiness activation layer.
 */

export {
  buildEcosystemReadinessReport,
  buildActorReadinessRecord,
  reproduceReadinessLineageDigest,
  assertReadinessAmbiguityPreserved,
  assertEcosystemBreach,
  EcosystemReadinessError,
  KNOWN_ACTOR_ROLES,
  KNOWN_READINESS_GATES,
  KNOWN_ACTOR_READINESS_VERDICTS,
  KNOWN_ECOSYSTEM_VERDICTS,
  KNOWN_READINESS_VIOLATIONS,
  ECOSYSTEM_READINESS_SENTINELS,
} from './ecosystemReadinessWorkflow';
export type {
  EcosystemActorRole,
  ReadinessGate,
  ReadinessGateOutcome,
  ReadinessGateResult,
  ActorReadinessSignal,
  ActorReadinessRecord,
  ActorReadinessVerdict,
  EcosystemReadinessVerdict,
  EcosystemReadinessCohort,
  EcosystemReadinessInputs,
  EcosystemReadinessReport,
  ReadinessViolation,
} from './ecosystemReadinessWorkflow';

export {
  evaluateReplayActivation,
  evaluateReplayActivationBatch,
  assertActivationAnchored,
  ActivationError,
  KNOWN_ACTIVATION_OUTCOMES,
  KNOWN_ACTIVATION_VIOLATIONS,
  REPLAY_ACTIVATION_SENTINELS,
} from './replayTrustActivation';
export type {
  ActivationOutcome,
  ReplayActivationInput,
  ReplayActivationRecord,
} from './replayTrustActivation';

export { buildRolloutAccelerationReport } from './rolloutAccelerator';
export type {
  BottleneckSeverity,
  RolloutBottleneck,
  ActorAccelerationOpportunity,
  RolloutAccelerationReport,
} from './rolloutAccelerator';
