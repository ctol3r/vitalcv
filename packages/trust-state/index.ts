/** YC MVP — behavior frozen. Do not modify without scope approval. */
/** YC MVP - behavior frozen. Do not modify without scope approval. */
export { TrustStateResolver } from './TrustStateResolver';
export {
  validateCredentialArtifact,
  validateVerificationArtifact,
} from './artifactValidation';
export {
  InMemoryLatencyHistogram,
  trustStateLatencyHistogram,
  type LatencyHistogramSnapshot,
  type LatencyPercentile,
} from './latencyHistogram';
export {
  CANONICAL_SOURCE_COVERAGE_STATES,
  CANONICAL_TRUTH_STATUSES,
  CANONICAL_TRUTH_RENDER_RULES,
  coverageSatisfiesDecisionGradeTruth,
  createCanonicalSourceCoverage,
  isCanonicalSourceCoverageState,
  resolveCanonicalSourceCoverageState,
  resolveCanonicalTruthStatus,
  summarizeCanonicalSourceCoverage,
  type CanonicalSourceCoverage,
  type CanonicalSourceCoverageReport,
  type CanonicalSourceCoverageState,
  type CanonicalSourceCoverageSummary,
  type CanonicalSourceProof,
  type CanonicalTruthKind,
  type CanonicalTruthStatus,
} from './sourceCoverage';

export type {
  BlockingReason,
  AcceptanceScopeRecord,
  EmployerLink,
  CrsResult,
  PsvReceiptRecord,
  StartScopeRecord,
  TrustStateCredentialArtifact,
  TrustStateVerificationArtifact,
  TrustBand,
  TrustStateScope,
  TrustState,
  TrustStateAuditEvent,
  TrustStateResolverDependencies,
} from './contracts';
