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
