/**
 * index.ts — W2-PR120A barrel
 *
 * Public surface of the institutional adoption flywheel layer.
 */
export {
  buildAdoptionFlywheelReport,
  reproduceFlywheelLineageDigest,
  STANDARD_ADOPTION_BASELINES,
} from './adoptionFlywheelModel';
export type {
  AdoptionVerdict,
  AdoptionBaselineId,
  AdoptionBaselineModel,
  AdoptionSignal,
  AdoptionFlywheelInputs,
  AdoptionFlywheelProfile,
  AdoptionFlywheelReport,
  FlywheelComparison,
  FlywheelMetricSlot,
  InstitutionIdentity,
  InstitutionAdoptionCurve,
  InstitutionRole,
} from './adoptionFlywheelModel';

export {
  buildReplayReuseIncentive,
  PSV_CYCLE_DAYS_DEFAULT,
  FRICTION_UNITS_PER_AVOIDED_CYCLE_DEFAULT,
} from './replayReuseIncentives';
export type { ReplayReuseIncentive, ReuseIncentiveOverrides } from './replayReuseIncentives';

export { buildCrossOrgTrustAcceleration } from './crossOrgTrustAcceleration';
export type { CrossOrgTrustAcceleration, CrossOrgEdge } from './crossOrgTrustAcceleration';

export { buildInstitutionalReferralPathways } from './institutionalReferralPathways';
export type {
  InstitutionalReferralPathways,
  ReferralPathway,
} from './institutionalReferralPathways';

export { buildEcosystemGrowthTelemetry } from './ecosystemGrowthTelemetry';
export type {
  EcosystemGrowthTelemetry,
  EcosystemBin,
  EcosystemBinResolution,
} from './ecosystemGrowthTelemetry';

export { runAdoptionFlywheelChaos } from './adoptionFlywheelChaos';
export type { AdoptionChaosMode, AdoptionChaosResult } from './adoptionFlywheelChaos';
