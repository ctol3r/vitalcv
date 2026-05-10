/**
 * Governance runtime registry — single runtime source of truth.
 *
 * Doctrine: docs/ops/constitutional-enforcement-matrix.md
 *           docs/ops/operational-guarantee-matrix.md
 *
 * Per W2-PR19A non-negotiable rule #2: Registry semantics are the single
 * source of truth. Frontend, backend, dashboards, CI all derive ONLY from
 * here.
 *
 * This module exposes:
 *   - All canonical state-set arrays (re-exported from per-axis modules).
 *   - Per-trust-class profile lookup.
 *   - Forbidden lexicon phrases.
 *   - Per-axis severity ordering helpers.
 *   - Transition validators.
 *
 * Downstream consumers MUST NOT define duplicate literals; CI checks for this.
 */

export {
  TRUST_CLASSES,
  type TrustClass,
  type TrustClassProfile,
  type GuaranteeStrength,
  GUARANTEE_STRENGTHS,
  getTrustClassProfile,
  parseTrustClass,
  trustClassDescription,
} from "./trust-class.js";

export {
  INTEGRITY_STATES,
  type IntegrityState,
  integritySeverity,
  maxIntegrityState,
  parseIntegrityState,
  integrityStateDescription,
} from "./integrity-state.js";

export {
  CONTAINMENT_STATES,
  type ContainmentState,
  containmentSeverity,
  maxContainmentState,
  parseContainmentState,
  containmentStateDescription,
} from "./containment-state.js";

export {
  REPLAY_STATES,
  type ReplayState,
  parseReplayState,
  replayStateDescription,
  classifyReplayState,
} from "./replay-state.js";

export {
  failClosedIntegrity,
  failClosedContainment,
  failClosedReplayState,
  failClosedTrustClass,
  handleTelemetryAbsence,
  type TelemetryAbsenceResult,
  assertNever,
} from "./fail-closed.js";

export {
  OVERRIDE_CLASSES,
  type OverrideClass,
  OVERRIDE_STATUS,
  type OverrideStatus,
  RENEWAL_POLICY,
  type RenewalPolicy,
  MAX_RENEWALS,
  MAX_OVERRIDE_DURATION_MS,
  type OverrideAuditEntry,
  type OverrideValidationError,
  validateOverrideEntry,
  detectForbiddenOverridePattern,
} from "./override-audit.js";

export {
  type AllowedTransition,
  INTEGRITY_TRANSITIONS,
  CONTAINMENT_TRANSITIONS,
  REPLAY_TRANSITIONS,
  type TransitionValidationResult,
  validateTransition,
  validateIntegrityTransition,
  validateContainmentTransition,
  validateReplayTransition,
  type TransitionAuditEvent,
  CONTINUITY_CONFIDENCE_LEVELS,
  type ContinuityConfidence,
  CAUSAL_CONFIDENCE_LEVELS,
  type CausalConfidence,
  type CausalLineageRefs,
  type CausalValidationError,
  validateCausalLineage,
  isRecoveryTransition,
} from "./transitions.js";

export {
  SYSTEMIC_STATES,
  type SystemicState,
  type CoherenceContradiction,
  type CrossAxisStateSnapshot,
  detectCoherenceContradictions,
  resolveSystemicState,
  systemicStateDescription,
} from "./coherence.js";

export {
  EXCEPTION_SEVERITY,
  type ExceptionSeverity,
  EXCEPTION_KIND,
  type ExceptionKind,
  type GovernanceException,
  type ExceptionValidationError,
  MAX_EXCEPTION_DURATION_DAYS,
  validateException,
  defaultSeverityForTag,
  remediationGuidance,
} from "./exception-registry.js";

export {
  type SemanticSnapshot,
  EVOLUTION_SEVERITY,
  type EvolutionSeverity,
  type SemanticMutation,
  buildSemanticSnapshot,
  diffSemanticSnapshots,
  maxEvolutionSeverity,
} from "./semantic-snapshot.js";

export {
  type InvariantViolation,
  type VerificationReport,
  verifyFailClosedAxes,
  verifyAmbiguityPreservation,
  verifyContradictionDetection,
  verifyChaosScenarios,
  verifyRegistryConsistency,
  runAllInvariants,
} from "./verification.js";

export {
  GOVERNANCE_DOMAINS,
  type GovernanceDomain,
  type DomainCoverage,
  DOMAIN_COVERAGE,
  VERIFICATION_CONFIDENCE,
  type VerificationConfidence,
  type DomainConfidenceSummary,
  type MetaVerificationReport,
  buildMetaVerificationReport,
  type InvariantInteractionViolation,
  verifyInvariantInteractions,
} from "./meta-verification.js";

export {
  HUMAN_OVERRIDE_KINDS,
  type HumanOverrideKind,
  OVERRIDE_RISK_LEVELS,
  type OverrideRiskLevel,
  overrideRiskSeverity,
  type OverrideKindProfile,
  getOverrideKindProfile,
  parseHumanOverrideKind,
  type HumanOverrideRecord,
  type OverrideIntegrityError,
  MAX_HUMAN_OVERRIDE_RENEWALS,
  validateHumanOverride,
  detectRecursiveOverrideChains,
  type OverrideBlastRadius,
  computeOverrideBlastRadius,
  OVERRIDE_DECAY_STATES,
  type OverrideDecayState,
  type OverrideDecayResult,
  computeOverrideDecay,
  type OverrideDisciplineFinding,
  type OverrideDisciplineReport,
  buildOverrideDisciplineReport,
} from "./override-discipline.js";

export {
  type GovernanceEpoch,
  type GovernanceLedger,
  appendEpoch,
  emptyLedger,
  DRIFT_TRAJECTORY_TAGS,
  type DriftTrajectoryTag,
  type DriftTrajectoryFinding,
  detectDriftTrajectories,
  FATIGUE_SEVERITY,
  type FatigueSeverity,
  type FatigueMetrics,
  deriveFatigueMetrics,
  type HistoricalTrustModifier,
  deriveHistoricalTrustModifier,
  type InstitutionalDriftReport,
  type DriftReportOptions,
  buildInstitutionalDriftReport,
} from "./longitudinal-memory.js";

export {
  GENESIS_HASH,
  canonicalize,
  type SealedGovernanceEpoch,
  type SealedGovernanceLedger,
  emptySealedLedger,
  computeEpochHash,
  sealEpoch,
  sealLedger,
  unsealLedger,
  type TamperFinding,
  verifySealedChain,
  type GovernanceSnapshot,
  captureGovernanceSnapshot,
  verifySnapshot,
  type ReplayVerificationResult,
  replayVerifyLedger,
  type PersistenceIntegrityReport,
  buildPersistenceIntegrityReport,
} from "./tamper-evident-persistence.js";

export {
  type ReplayObservationNode,
  type ContinuityEdgeKind,
  type ReplayContinuityEdge,
  type ReplayReconstructionGraph,
  buildReplayReconstructionGraph,
  RECONSTRUCTION_CONFIDENCE,
  type ReconstructionConfidence,
  type ReplaySurvivabilityScore,
  scoreReplaySurvivability,
  type ReconstructionLineage,
  deriveReconstructionLineage,
  type ReplaySurvivabilityFinding,
  type ReplaySurvivabilityReport,
  buildReplaySurvivabilityReport,
} from "./replay-survivability.js";

export {
  SEV_LEVELS,
  type SevLevel,
  sevSeverity,
  maxSev,
  INCIDENT_KINDS,
  type IncidentKind,
  kindSevFloor,
  INCIDENT_LIFECYCLE_STATES,
  type IncidentLifecycleState,
  INCIDENT_TRANSITIONS,
  isAllowedIncidentTransition,
  type GovernanceIncident,
  type IncidentValidationError,
  validateIncident,
  type IncidentBlastRadius,
  computeIncidentBlastRadius,
  type IncidentFinding,
  type IncidentGovernanceReport,
  buildIncidentGovernanceReport,
} from "./incident-governance.js";

export {
  EXTERNAL_TRUST_API_VERSION,
  type ExternalTrustApiVersion,
  type ExternalResponseEnvelope,
  wrapResponse,
  type GovernanceStateExport,
  exportGovernanceState,
  type ReplayVerificationExport,
  exportReplayVerification,
  type AuditReceiptInput,
  type AuditReceipt,
  buildAuditReceipt,
  type ExternalLineageManifest,
  buildExternalLineageManifest,
  verifyExternalLineageManifest,
  type ApiContractError,
  validateExternalEnvelope,
  type ExternalApiAuditReport,
  runExternalApiSelfAudit,
} from "./external-trust-api.js";

export {
  TRUST_TRAJECTORY_TIERS,
  type TrustTrajectoryTier,
  type UxSummary,
  type UxSummaryInputs,
  deriveUxSummary,
  type UxIntegrityViolation,
  validateUxIntegrity,
} from "./trust-ux.js";

export {
  GOVERNANCE_KERNEL_VERSION,
  type GovernanceKernelVersion,
  type FrozenKernelSurface,
  captureLiveKernel,
  type KernelStabilityFinding,
  validateKernelStability,
  type CompatibilityContract,
  type CompatibilityViolation,
  validateCompatibilityContract,
  type KernelFreezeReport,
  buildKernelFreezeReport,
} from "./kernel-freeze.js";

export {
  IDENTITY_LIFECYCLE,
  type IdentityLifecycle,
  IDENTITY_TRANSITIONS,
  isAllowedIdentityTransition,
  type IdentityClaim,
  type IdentityValidationError,
  computeClaimReceiptId,
  validateIdentityClaim,
  hasReclaimCycle,
  type IdentityClaimReport,
  buildIdentityClaimReport,
} from "./identity-claim.js";

export {
  REVIEW_ITEM_KINDS,
  type ReviewItemKind,
  REVIEW_PRIORITY,
  type ReviewPriority,
  REVIEW_LIFECYCLE,
  type ReviewLifecycle,
  type ReviewItem,
  type ReviewValidationError,
  validateReviewItem,
  type QueueSummary,
  summarizeQueue,
  type VerifierWorkspaceReport,
  buildVerifierWorkspaceReport,
} from "./verifier-workspace.js";

export {
  ENTERPRISE_ROLES,
  type EnterpriseRole,
  ADMIN_ACTIONS,
  type AdminAction,
  parseEnterpriseRole,
  type AuthorizationDecision,
  decideAuthorization,
  type OrgGovernancePolicy,
  type PolicyValidationError,
  validateOrgPolicy,
  type EnterpriseGovernanceReport,
  buildEnterpriseGovernanceReport,
} from "./enterprise-admin.js";

export {
  FUNNEL_STEPS,
  type FunnelStep,
  ABANDONMENT_REASONS,
  type AbandonmentReason,
  type PilotEvent,
  type EventValidationError,
  computeEventId,
  validatePilotEvent,
  type FunnelStepStats,
  type PilotIntelligenceReport,
  buildPilotIntelligenceReport,
} from "./pilot-intelligence.js";

export {
  DELEGATION_LIFECYCLE,
  type DelegationLifecycle,
  type DelegationGrant,
  type DelegationValidationError,
  MAX_DELEGATION_DURATION_MS,
  MAX_DELEGATION_DEPTH,
  computeGrantId,
  validateDelegationGrant,
  type SubGrantViolation,
  validateSubGrant,
  type DelegationDecision,
  decideDelegationAccess,
  type DelegatedTrustReport,
  buildDelegatedTrustReport,
} from "./delegated-trust.js";

export {
  WORKFLOW_STEP_KINDS,
  type WorkflowStepKind,
  WORKFLOW_OUTCOMES,
  type WorkflowOutcome,
  type WorkflowStepReceipt,
  type WorkflowValidationError,
  computeStepReceiptId,
  validateStepReceipt,
  computeRunHash,
  type WorkflowAutomationReport,
  buildWorkflowAutomationReport,
} from "./workflow-automation.js";

export {
  NODE_HEALTH,
  type NodeHealth,
  type NodeObservation,
  type QuorumConfig,
  RESILIENCE_TIERS,
  type ResilienceTier,
  type ResilienceScore,
  scoreDistributedResilience,
  type DistributedResilienceReport,
  buildDistributedResilienceReport,
} from "./distributed-resilience.js";

export {
  ENTITY_KINDS,
  type EntityKind,
  type NetworkNode,
  type TrustEdge,
  type PropagatedTrust,
  propagateNetworkTrust,
  type EcosystemReport,
  buildEcosystemReport,
} from "./ecosystem-network.js";

export {
  type RevocationEvent,
  type CascadeResult,
  computeRevocationCascade,
  type RevocationCascadeReport,
  buildRevocationCascadeReport,
} from "./revocation-cascade.js";

export {
  ARCHIVAL_SCHEMA_VERSION,
  type ArchivalSchemaVersion,
  type MigrationStep,
  type ArchivedEpochEnvelope,
  type MigrationRecipe,
  MIGRATION_RECIPES,
  lookupRecipe,
  buildArchivalEnvelope,
  type DurabilityFinding,
  verifyArchivalEnvelope,
  replayMigrationLineage,
  type EvidenceDurabilityReport,
  buildEvidenceDurabilityReport,
} from "./evidence-durability.js";

export {
  COMPRESSION_CONFIDENCE,
  type CompressionConfidence,
  type EvidenceSummary,
  type CompressionInput,
  buildEvidenceSummary,
  type CompressionFinding,
  verifyEvidenceSummary,
  type EvidenceCompressionReport,
  buildEvidenceCompressionReport,
} from "./evidence-compression.js";

export {
  CONSTITUTIONAL_VERDICTS,
  type ConstitutionalVerdict,
  type CrossWaveInvariantViolation,
  type ConstitutionalConvergenceInput,
  type ConstitutionalConvergenceReport,
  synthesizeConstitutionalIntegrity,
} from "./constitutional-convergence.js";

/**
 * Lexicon-forbidden phrases per docs/ops/TRUST_GUARANTEE_LEXICON.md §1.
 *
 * Single source of truth used by the CI lexicon scanner
 * (scripts/governance/check-trust-lexicon.ts) AND any runtime/code-time
 * validation. Modifying this list requires founder + Codex SAFE per the
 * lexicon's update protocol §6.
 */
export const FORBIDDEN_LEXICON_PHRASES: readonly RegExp[] = Object.freeze([
  /\bnon[\s-]?repudiab(le|ility)\b/i,
  /\bnon[\s-]?repudiation\b/i,
  /\bcryptographically[\s-]?guarantee[ds]?\b/i,
  /\breplay[\s-]?protect(ed|ion)\b/i,
  /\breplay[\s-]?resistan(t|ce)\b/i,
  /\bsigned[\s-]?mutation(s)?\b/i,
  /\btamper[\s-]?proof\b/i,
  /\btrustless\b/i,
  /\bprovably[\s-]?secure\b/i,
  // Beyond the canonical 7, additional inflation patterns per W2-PR4B §3.1:
  /\bguaranteed[\s-]?dedup\b/i,
  /\batomic[\s-]?idempoten(cy|t)\b/i,
  /\bcryptographically[\s-]?attest(ed|ation)\b/i,
  /\bMerkle[\s-]?(audit|anchored)\b/,
]);

/**
 * Lexicon-aligned alternative wording for the most common forbidden-phrase
 * inflation patterns. Used by CI scanner output to suggest fixes.
 */
export const LEXICON_SUBSTITUTIONS: Readonly<Record<string, string>> = Object.freeze({
  "non-repudiable": "audit-traceable; tamper-evident given DB integrity",
  "non-repudiation": "audit-traceable",
  "cryptographically guaranteed": "hash-checked OR (issuer-signed only post-TRUST-PERSIST-1)",
  "replay protected": "replay observability + best-effort idempotency check via correlationId",
  "replay-resistant": "replay observability + best-effort idempotency check via correlationId",
  "signed mutation": "audit-coupled mutation; transactional mutation",
  "tamper-proof": "tamper-evident given DB integrity",
  trustless: "verifiable; third-party-verifiable (where substrate)",
  "provably secure": "use the testable property directly (e.g., 'fail-closed under degraded auth')",
  "guaranteed dedup": "best-effort idempotency check via correlationId",
  "atomic idempotency": "correlationId-stamped audit row with application-layer dedup check",
  "cryptographically attested": "hash-checked; tamper-evident given DB integrity",
  "Merkle audit": "audit row with merkleRoot populated when anchoring pipeline live (UNVERIFIED today)",
});
