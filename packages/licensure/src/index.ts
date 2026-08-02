/**
 * @vitalcv/licensure — national U.S. licensure coverage.
 *
 * Read `authorityRegistry.ts` and `runtimeState.ts` together before making any
 * claim about coverage. The registry says which authorities exist; the runtime
 * state says which can be read. In the current build the second number is zero.
 */

export type {
  AccessRequirement,
  AuthorityProvenance,
  AuthorityRoute,
  BoardType,
  CredentialObjectKind,
  DecisionUseClassification,
  DisciplineAvailability,
  FreshnessAssessment,
  Jurisdiction,
  LicenseStatus,
  LicensureAuthority,
  LicensureClaimKind,
  LicensureObservation,
  LicensureRouteKind,
  LicensureRuntimePhase,
  LicensureRuntimeState,
  LookupIdentifier,
  LookupOutcome,
  Profession,
  TermsReviewState,
} from './types';

export { assessFreshness, classifyDecisionUse, isAdverseFinding, isLive } from './types';

export {
  getAuthority,
  listAuthorities,
  listAuthoritiesFor,
  listAuthoritiesForJurisdiction,
  listInventoriedJurisdictions,
  PA_SCOPE_NOT_INVENTORIED,
  UNINVENTORIED_TARGET_JURISDICTIONS,
} from './authorityRegistry';

export {
  explainUnavailability,
  isNursingProfession,
  isPhysicianProfession,
  resolveDeclaredChain,
  resolveOperationalChain,
} from './sourceRouter';

export { countLiveRoutes, getRuntimeState, listRuntimeStates } from './runtimeState';

export type {
  LicensureAdapter,
  LicensureGap,
  LicensureLookupRequest,
  LicensureLookupResult,
  LicensureRecords,
} from './adapters/adapterContract';
export { gap } from './adapters/adapterContract';

export { FsmbPdcAdapter, fsmbConfigFromEnv } from './adapters/fsmbPdcAdapter';
export type { FsmbPdcConfig } from './adapters/fsmbPdcAdapter';
export { NursysAdapter, nursysConfigFromEnv } from './adapters/nursysAdapter';
export type { NursysConfig } from './adapters/nursysAdapter';

export type {
  LicenseEvidenceProjection,
  LicenseGapProjection,
} from './evidenceProjection';
export { buildObservation, projectGap, projectObservation } from './evidenceProjection';

export type { LicensureCoverageProjection } from './publicCoverageProjection';
export {
  buildCoverageProjection,
  coverageLabel,
  summarizeObservations,
} from './publicCoverageProjection';

export type {
  LicensureDelta,
  LicensureDeltaKind,
  MonitoringTarget,
} from './monitoringJob';
export { diff, isAdverseDelta, plan } from './monitoringJob';

export type { ConflictKind, LicensureConflict } from './conflictReview';
export { detectConflicts, requiresReview } from './conflictReview';
