/**
 * credentialLifecycle — W2-PR44A
 *
 * Operational primitives for credential artifact lifecycle management:
 * uploads, expirations, renewals, supersession, archival lineage.
 *
 * Pure transforms; no DB writes from this barrel.
 */

export type {
  LifecycleEvent,
  LifecycleEventType,
  LifecycleNode,
  LifecycleGraph,
  RenewalInterpretation,
  SupersessionLink,
  ExpirationDriftReport,
  ContinuityInvariantReport,
  LifecycleIntegrityReport,
  LifecycleReplayFrame,
} from './types';

export {
  buildLifecycleGraph,
  computeEventHash,
  canonicalizeEvent,
  sealEvent,
  sortEvents,
  fingerprintGraph,
} from './lifecycleGraph';

export {
  reconstructLineage,
  findDanglingSupersessionEdges,
} from './supersessionLineage';

export {
  interpretRenewal,
  detectFlattenedAmbiguity,
} from './renewalSemantics';

export {
  detectExpirationDrift,
  summarizeDrift,
} from './expirationDrift';

export {
  checkArtifactContinuity,
  checkAllContinuity,
  INVARIANTS,
} from './artifactContinuity';

export {
  replayLifecycle,
  verifyReplayDeterminism,
} from './lifecycleReplay';

export {
  runLifecycleIntegrityGate,
  formatGateOutput,
} from './integrityGates';
