/**
 * Onboarding Finalization — W2-PR167A barrel export.
 */

export {
  buildOnboardingConvergenceReport,
  reproduceConvergenceLineageDigest,
  type ActivationSignal,
  type ConvergenceEntity,
  type ConvergenceRole,
  type ConvergenceVerdict,
  type MilestoneStatus,
  type OnboardingConvergenceInputs,
  type OnboardingConvergenceReport,
  type RoleConvergenceState,
  type ConvergenceAmbiguity,
} from './onboardingConvergence';

export {
  buildReplayActivationRecord,
  buildActivationReplayBatch,
  replayRecordToSignal,
  type ActivationLineageRef,
  type ActivationReplayBatch,
  type LineageVerdict,
  type ReplayActivationInputs,
  type ReplayActivationRecord,
} from './replaySafeActivation';

export {
  buildCrossOrgHarmonizationReport,
  type CrossOrgHarmonizationInputs,
  type CrossOrgHarmonizationReport,
  type EntityHarmonizationState,
  type HarmonizationVerdict,
  type MilestoneAgreement,
  type OrgDisagreement,
  type OrgMilestoneState,
} from './crossOrgHarmonization';

export {
  buildInstitutionalTelemetryReport,
  type ActivationCohort,
  type CohortResolution,
  type InstitutionalTelemetryInputs,
  type InstitutionalTelemetryReport,
  type LongitudinalCurvePoint,
} from './institutionalOnboardingTelemetry';

export {
  buildActivationSimplicityReport,
  type ActivationSimplicityInputs,
  type ActivationSimplicityReport,
  type EntitySimplicityScore,
  type RoleSimplicityState,
} from './activationSimplicityScoring';
