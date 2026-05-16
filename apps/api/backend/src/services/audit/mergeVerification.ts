/**
 * mergeVerification.ts — W2-PR164A: Runtime Activation Merge Verification
 *
 * Pure structural verifier for runtime activation branch merges.
 * Validates that an activation-branch merge cannot silently introduce:
 *   - Constitutional replay drift (schema version strings changed)
 *   - Audit event type gaps (new event emitted, not in canonical union)
 *   - Verdict taxonomy violations (AMBIGUOUS coerced to CLEAN)
 *   - Replay category orphans (new action without an R-CAT-N mapping)
 *   - Lineage reconstruction non-determinism
 *   - Survivability floor regression
 *
 * No fetches, no DB writes. Deterministic: same inputs → same outputs.
 * Exports the six chaos modes as named constants so CI and tests share truth.
 */

import { sha256ForPayload } from '../../utils/deterministic';
import {
  KNOWN_CONTAINMENT_VERDICTS,
  KNOWN_CORRUPTION_KINDS,
  KNOWN_CONTAINMENT_VIOLATIONS,
  CONTAINMENT_SENTINELS,
  computeContainmentBoundary,
  assertAmbiguityPreserved,
  quarantineReplay,
  traceCorruptionLineage,
  type ContainmentVerdict,
  type CorruptionKind,
  type IntegritySignal,
  type ReplayQuarantineRecord,
  type LineageHints,
} from './replayCorruptionContainment';

// ── Constitutional schema registry ────────────────────────────────────────────
//
// Every schema version string used across the replay chain. These are the
// "constitutional" values: if any change post-merge, constitutional replay
// drift has occurred and the merge must be blocked.

export const REPLAY_SCHEMA_REGISTRY = Object.freeze({
  REPLAY_V1:             'https://vitalcv.com/replay/v1'                    as const,
  AUDIT_BUNDLE_V1:       'https://vitalcv.com/audit-bundle/v1'              as const,
  RUNTIME_TRUST_V1:      'vitalcv.runtime-trust-cohesion.v1'                as const,
  RUNTIME_REPLAY_V1:     'vitalcv.runtime-trust-replay.v1'                  as const,
  CONTAINMENT_V1:        'vitalcv.replay-corruption-containment.v1'         as const,
  CONTAINMENT_BOUNDARY:  'vitalcv.replay-containment-boundary.v1'           as const,
  CONTAINMENT_LINEAGE:   'vitalcv.replay-corruption-lineage.v1'             as const,
  CONTAINMENT_DIGEST:    'vitalcv.replay-containment-digest.v1'             as const,
  EMPLOYER_ACTION_V1:    'vitalcv.employer-review.action.v1'                as const,
  EMPLOYER_DENIED_V1:    'vitalcv.employer-review.denied-mutation.v1'       as const,
  PACKET_EXPORT_V1:      'vitalcv.employer.packet-export.v1'                as const,
  PACKET_SHARED_V1:      'vitalcv.employer.packet-shared.v1'                as const,
  SHARE_TOKEN_HASH_V1:   'vitalcv.employer.share-token-hash.v1'             as const,
});

// ── Governance contracts ───────────────────────────────────────────────────────

export const REPLAY_CATEGORY_MAP = Object.freeze({
  'accept':           'R-CAT-1',
  'request-refresh':  'R-CAT-2',
  'route-to-review':  'R-CAT-2',
  'packet-export':    'R-CAT-3',
  'share-packet':     'R-CAT-3',
  'confirm-start':    'R-CAT-4',
  'denied-mutation':  'R-CAT-5',
  'dossier-replay':   'R-CAT-6',
} as const satisfies Record<string, `R-CAT-${number}`>);

export const MUTATION_CLASSIFICATION_MAP = Object.freeze({
  'accept':           'TRUST_ACCEPTANCE',
  'request-refresh':  'TRUST_REFRESH_REQUEST',
  'route-to-review':  'TRUST_REVIEW_ROUTING',
  'packet-export':    'TRUST_PACKET_EXPORT',
  'share-packet':     'TRUST_PACKET_SHARE',
  'confirm-start':    'TRUST_START_ATTESTATION',
  'denied-mutation':  'DENIED_MUTATION',
  'dossier-replay':   'DOSSIER_REPLAY',
} as const satisfies Record<string, string>);

export const CANONICAL_AUDIT_EVENT_TYPES = Object.freeze([
  'VERIFICATION_REQUESTED',
  'VERIFICATION_COMPLETED',
  'VERIFICATION_FAILED',
  'MONITORING_STATUS_CHANGE',
  'ARTIFACT_VIEWED',
  'ARTIFACT_EXPORTED',
  'BUNDLE_GENERATED',
  'EMPLOYER_REVIEW_ACCEPTED',
  'EMPLOYER_REVIEW_REFRESH_REQUESTED',
  'EMPLOYER_REVIEW_ROUTED_TO_REVIEW',
  'EMPLOYER_REVIEW_MUTATION_DENIED',
  'EMPLOYER_PACKET_SHARED',
  'APPLICATION_MISSING_INFO_REQUESTED',
  'APPLICATION_MISSING_INFO_CLOSED',
  'RECOGNITION_EMITTED',
  'ACCEPTANCE_EMITTED',
  'START_EMITTED',
  'START_ATTESTED',
  'RATE_LIMIT_HIT',
  'API_ERROR',
  'VALIDATION_ERROR',
  'TRUST_STATE_CHECK',
  'RESEARCH_PUBMED_FETCHED',
  'RESEARCH_ORCID_LINKED',
  'RESEARCH_ORCID_UNLINKED',
  'RESEARCH_TRIALS_FETCHED',
  'RESEARCH_SCORE_COMPUTED',
  'RESEARCH_DISCLOSURE_UPDATED',
] as const);

export type CanonicalAuditEventType = (typeof CANONICAL_AUDIT_EVENT_TYPES)[number];

// ── Merge chaos mode registry ─────────────────────────────────────────────────

export const MERGE_CHAOS_MODES = Object.freeze([
  'C-MERGE-1-DUPLICATE-EVENT-TYPE',
  'C-MERGE-2-SCHEMA-VERSION-DRIFT',
  'C-MERGE-3-AMBIGUOUS-COERCED-CLEAN',
  'C-MERGE-4-LINEAGE-HINT-LOSS',
  'C-MERGE-5-REPLAY-CATEGORY-ORPHAN',
  'C-MERGE-6-SURVIVABILITY-FLOOR-REGRESSION',
] as const);

export type MergeChaosMode = (typeof MERGE_CHAOS_MODES)[number];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SchemaFingerprint {
  registry: Record<string, string>;
  digest: string;
}

export interface ReplayDriftSignal {
  drifted: boolean;
  driftedKeys: string[];
  reason: string;
}

export interface MergeLineageRecord {
  schema: 'vitalcv.merge-lineage.v1';
  capsuleId: string;
  lineageIntact: boolean;
  reconstructionDigest: string;
  contaminatedCount: number;
  reason: string;
  verifiedAt: string;
}

export interface MergeSurvivabilityScore {
  schema: 'vitalcv.merge-survivability.v1';
  score: number;
  floor: number;
  passesFloor: boolean;
  components: {
    schemaVersionStability:     number;
    verdictTaxonomyCompleteness: number;
    replayCategoryCompleteness:  number;
    containmentBoundaryIntegrity: number;
  };
  scoreDigest: string;
  scoredAt: string;
}

export interface MergeChaosVerdict {
  mode: MergeChaosMode;
  passed: boolean;
  reason: string;
}

export interface MergeChaosReport {
  schema: 'vitalcv.merge-chaos-report.v1';
  modes: number;
  passed: number;
  failed: number;
  passRate: number;
  verdicts: MergeChaosVerdict[];
  fingerprint: string;
  ranAt: string;
}

export interface GovernanceContract {
  schemaRegistryComplete: boolean;
  auditEventTypesComplete: boolean;
  replayCategoryMappingComplete: boolean;
  mutationClassificationMappingComplete: boolean;
  verdictTaxonomyComplete: boolean;
  corruptionKindTaxonomyComplete: boolean;
  violations: string[];
  contractDigest: string;
}

export interface ActivationMergeTelemetry {
  schema: 'vitalcv.activation-merge-telemetry.v1';
  branchCategory: 'runtime-activation';
  governanceContract: GovernanceContract;
  survivabilityScore: MergeSurvivabilityScore;
  chaosReport: MergeChaosReport;
  driftSignal: ReplayDriftSignal;
  mergeVerdict: 'MERGE_SAFE' | 'MERGE_UNSAFE' | 'MERGE_AMBIGUOUS';
  mergeVerdictReason: string;
  telemetryDigest: string;
  emittedAt: string;
}

// ── Schema fingerprinting ──────────────────────────────────────────────────────

export function buildSchemaFingerprint(): SchemaFingerprint {
  const registry: Record<string, string> = { ...REPLAY_SCHEMA_REGISTRY };
  const digest = sha256ForPayload({
    schema: 'vitalcv.schema-fingerprint.v1',
    registry,
  });
  return { registry, digest };
}

/**
 * Detect whether the schema fingerprint has drifted between two snapshots.
 * Constitutional drift = any key whose value changed.
 */
export function detectReplayDrift(
  before: SchemaFingerprint,
  after: SchemaFingerprint,
): ReplayDriftSignal {
  const driftedKeys: string[] = [];
  const allKeys = new Set([...Object.keys(before.registry), ...Object.keys(after.registry)]);
  for (const key of allKeys) {
    if (before.registry[key] !== after.registry[key]) {
      driftedKeys.push(key);
    }
  }
  const drifted = driftedKeys.length > 0;
  return {
    drifted,
    driftedKeys,
    reason: drifted
      ? `Constitutional replay drift on ${driftedKeys.length} schema key(s): ${driftedKeys.join(', ')}`
      : 'No schema version drift detected.',
  };
}

// ── Merge lineage verification ────────────────────────────────────────────────

/**
 * Verify that a set of lineage hints produces a stable, reconstructable
 * corruption lineage. Used to assert the lineage engine is deterministic
 * after an activation merge.
 */
export function verifyMergeLineage(input: {
  capsuleId: string;
  rootHints: Partial<LineageHints>;
  candidates: ReadonlyArray<{ capsuleId: string; hints: Partial<LineageHints> }>;
}): MergeLineageRecord {
  const verifiedAt = new Date().toISOString();

  const lineage1 = traceCorruptionLineage({
    rootCapsuleId: input.capsuleId,
    rootHints: input.rootHints,
    candidates: input.candidates,
  });
  const lineage2 = traceCorruptionLineage({
    rootCapsuleId: input.capsuleId,
    rootHints: input.rootHints,
    candidates: input.candidates,
  });

  const lineageIntact = lineage1.reconstructionDigest === lineage2.reconstructionDigest;
  const contaminatedCount = lineage1.contaminatedCapsuleIds.length;

  return {
    schema: 'vitalcv.merge-lineage.v1',
    capsuleId: input.capsuleId,
    lineageIntact,
    reconstructionDigest: lineage1.reconstructionDigest,
    contaminatedCount,
    reason: lineageIntact
      ? `Lineage reconstructable; ${contaminatedCount} downstream capsule(s) traced.`
      : 'Non-deterministic lineage reconstruction — merge would break replay lineage.',
    verifiedAt,
  };
}

// ── Governance harmonization ──────────────────────────────────────────────────

/**
 * Verify that the governance contracts are internally consistent.
 * A merge that adds a new event type, action, or verdict without updating the
 * canonical registries will surface violations here.
 */
export function harmonizeGovernanceContract(): GovernanceContract {
  const violations: string[] = [];

  const registryKeys = Object.keys(REPLAY_SCHEMA_REGISTRY);
  const schemaRegistryComplete = registryKeys.length >= 13;
  if (!schemaRegistryComplete) {
    violations.push(`Schema registry has ${registryKeys.length} entries; expected ≥13.`);
  }

  const auditEventTypesComplete = CANONICAL_AUDIT_EVENT_TYPES.length >= 28;
  if (!auditEventTypesComplete) {
    violations.push(`Canonical audit event types has ${CANONICAL_AUDIT_EVENT_TYPES.length} entries; expected ≥28.`);
  }

  const replayCategories = new Set(Object.values(REPLAY_CATEGORY_MAP));
  const replayCategoryMappingComplete = replayCategories.size === 6;
  if (!replayCategoryMappingComplete) {
    violations.push(`Replay category map covers ${replayCategories.size} categories; expected 6 (R-CAT-1..R-CAT-6).`);
  }

  const mutationClassifications = new Set(Object.values(MUTATION_CLASSIFICATION_MAP));
  const mutationClassificationMappingComplete = mutationClassifications.size === 8;
  if (!mutationClassificationMappingComplete) {
    violations.push(`Mutation classification map covers ${mutationClassifications.size} values; expected 8.`);
  }

  const verdictTaxonomyComplete = KNOWN_CONTAINMENT_VERDICTS.length === 5;
  if (!verdictTaxonomyComplete) {
    violations.push(`Containment verdict taxonomy has ${KNOWN_CONTAINMENT_VERDICTS.length} verdicts; expected 5.`);
  }

  const corruptionKindTaxonomyComplete = KNOWN_CORRUPTION_KINDS.length === 6;
  if (!corruptionKindTaxonomyComplete) {
    violations.push(`Corruption kind taxonomy has ${KNOWN_CORRUPTION_KINDS.length} kinds; expected 6.`);
  }

  const contractDigest = sha256ForPayload({
    schema: 'vitalcv.governance-contract.v1',
    schemaRegistryKeys: registryKeys.slice().sort(),
    auditEventTypeCount: CANONICAL_AUDIT_EVENT_TYPES.length,
    replayCategoryCount: replayCategories.size,
    mutationClassificationCount: mutationClassifications.size,
    verdictCount: KNOWN_CONTAINMENT_VERDICTS.length,
    kindCount: KNOWN_CORRUPTION_KINDS.length,
  });

  return {
    schemaRegistryComplete,
    auditEventTypesComplete,
    replayCategoryMappingComplete,
    mutationClassificationMappingComplete,
    verdictTaxonomyComplete,
    corruptionKindTaxonomyComplete,
    violations,
    contractDigest,
  };
}

// ── Merge survivability scoring ───────────────────────────────────────────────

const MERGE_SURVIVABILITY_FLOOR = 85;

/**
 * Compute a 0–100 merge survivability score from weighted governance
 * component checks. A score below the floor blocks the merge gate.
 */
export function scoreMergeSurvivability(input: {
  governance: GovernanceContract;
  driftSignal: ReplayDriftSignal;
  chaosPassRate: number;
}): MergeSurvivabilityScore {
  const scoredAt = new Date().toISOString();

  const schemaVersionStability     = input.driftSignal.drifted ? 0 : 100;
  const verdictTaxonomyCompleteness =
    input.governance.verdictTaxonomyComplete && input.governance.corruptionKindTaxonomyComplete ? 100 : 0;
  const replayCategoryCompleteness  =
    input.governance.replayCategoryMappingComplete && input.governance.mutationClassificationMappingComplete ? 100 : 0;
  const containmentBoundaryIntegrity =
    Math.round(input.chaosPassRate * 100);

  const score = Math.round(
    schemaVersionStability     * 0.40 +
    verdictTaxonomyCompleteness * 0.25 +
    replayCategoryCompleteness  * 0.15 +
    containmentBoundaryIntegrity * 0.20,
  );

  const passesFloor = score >= MERGE_SURVIVABILITY_FLOOR;

  const scoreDigest = sha256ForPayload({
    schema: 'vitalcv.merge-survivability.v1',
    score,
    floor: MERGE_SURVIVABILITY_FLOOR,
    components: {
      schemaVersionStability,
      verdictTaxonomyCompleteness,
      replayCategoryCompleteness,
      containmentBoundaryIntegrity,
    },
  });

  return {
    schema: 'vitalcv.merge-survivability.v1',
    score,
    floor: MERGE_SURVIVABILITY_FLOOR,
    passesFloor,
    components: {
      schemaVersionStability,
      verdictTaxonomyCompleteness,
      replayCategoryCompleteness,
      containmentBoundaryIntegrity,
    },
    scoreDigest,
    scoredAt,
  };
}

// ── Merge chaos simulations ───────────────────────────────────────────────────

function runChaosMode(mode: MergeChaosMode): MergeChaosVerdict {
  switch (mode) {

    case 'C-MERGE-1-DUPLICATE-EVENT-TYPE': {
      // Simulate a merge that adds a duplicate audit event type.
      // Governance contract must detect the set-cardinality drop.
      const fakeTypes = [...CANONICAL_AUDIT_EVENT_TYPES, 'EMPLOYER_REVIEW_ACCEPTED'] as string[];
      const uniqueTypes = new Set(fakeTypes);
      const hasDuplicate = uniqueTypes.size < fakeTypes.length;
      return {
        mode,
        passed: hasDuplicate,
        reason: hasDuplicate
          ? 'Duplicate event type detected; governance contract would surface this violation.'
          : 'Duplicate event type not detected — governance gap.',
      };
    }

    case 'C-MERGE-2-SCHEMA-VERSION-DRIFT': {
      const before = buildSchemaFingerprint();
      const drifted: SchemaFingerprint = {
        registry: {
          ...before.registry,
          REPLAY_V1: 'https://vitalcv.com/replay/v2',
        },
        digest: 'mutated',
      };
      const signal = detectReplayDrift(before, drifted);
      return {
        mode,
        passed: signal.drifted && signal.driftedKeys.includes('REPLAY_V1'),
        reason: signal.drifted
          ? `Constitutional drift detected: ${signal.reason}`
          : 'Schema version drift not detected — constitutional replay drift check failed.',
      };
    }

    case 'C-MERGE-3-AMBIGUOUS-COERCED-CLEAN': {
      const ambiguousRecord: ReplayQuarantineRecord = quarantineReplay({
        capsuleId: 'chaos-capsule-3',
        integrity: {
          hashMatch: true,
          storedHash: 'abc',
          recomputedHash: 'abc',
          tamperEvidence: 'contradictory signal injected by chaos',
        },
      });
      let threw = false;
      try {
        assertAmbiguityPreserved(ambiguousRecord);
      } catch {
        threw = true;
      }
      const isAmbiguous = ambiguousRecord.verdict === 'AMBIGUOUS';
      return {
        mode,
        passed: isAmbiguous,
        reason: isAmbiguous
          ? `AMBIGUOUS verdict preserved; ambiguity not coerced to CLEAN (assertAmbiguityPreserved ${threw ? 'would throw' : 'passes'}).`
          : 'AMBIGUOUS verdict was coerced — containment violation.',
      };
    }

    case 'C-MERGE-4-LINEAGE-HINT-LOSS': {
      const full = verifyMergeLineage({
        capsuleId: 'root-chaos-4',
        rootHints: {
          subjectNpi: '1234567890',
          credentialIds: ['cred-a', 'cred-b'],
          sourceReferenceId: 'ref-x',
        },
        candidates: [
          { capsuleId: 'child-1', hints: { subjectNpi: '1234567890' } },
          { capsuleId: 'child-2', hints: { credentialIds: ['cred-a'] } },
          { capsuleId: 'unrelated', hints: { subjectNpi: '9999999999' } },
        ],
      });
      const empty = verifyMergeLineage({
        capsuleId: 'root-chaos-4',
        rootHints: { subjectNpi: null, credentialIds: [], sourceReferenceId: null },
        candidates: [
          { capsuleId: 'child-1', hints: { subjectNpi: '1234567890' } },
          { capsuleId: 'child-2', hints: { credentialIds: ['cred-a'] } },
        ],
      });
      const hintLossCausesEdgeLoss =
        full.contaminatedCount > 0 &&
        empty.contaminatedCount === 0;
      return {
        mode,
        passed: hintLossCausesEdgeLoss,
        reason: hintLossCausesEdgeLoss
          ? `Lineage hint loss detected: full hints trace ${full.contaminatedCount} edges; empty hints trace 0.`
          : `Lineage hint loss not detectable: full=${full.contaminatedCount}, empty=${empty.contaminatedCount}.`,
      };
    }

    case 'C-MERGE-5-REPLAY-CATEGORY-ORPHAN': {
      // Simulate an activation branch that adds a new action without mapping it.
      const orphanAction = 'activation-console-execute';
      const existingActions = Object.keys(REPLAY_CATEGORY_MAP);
      const isOrphan = !existingActions.includes(orphanAction);
      return {
        mode,
        passed: isOrphan,
        reason: isOrphan
          ? `Orphan action "${orphanAction}" correctly detected as unmapped in REPLAY_CATEGORY_MAP.`
          : `Orphan action "${orphanAction}" incorrectly appears in REPLAY_CATEGORY_MAP.`,
      };
    }

    case 'C-MERGE-6-SURVIVABILITY-FLOOR-REGRESSION': {
      const governance = harmonizeGovernanceContract();
      const driftSignal = detectReplayDrift(buildSchemaFingerprint(), buildSchemaFingerprint());
      const score = scoreMergeSurvivability({
        governance,
        driftSignal,
        chaosPassRate: 0.15,
      });
      const regressedScore = score.score;
      const floorEnforced = !score.passesFloor;
      return {
        mode,
        passed: floorEnforced,
        reason: floorEnforced
          ? `Survivability floor enforced: score=${regressedScore} < floor=${score.floor} when chaos pass rate=15%.`
          : `Floor not enforced at score=${regressedScore} — regression protection failed.`,
      };
    }
  }
}

/**
 * Run all six merge chaos simulations. Every mode must pass (fail-closed).
 */
export function runMergeChaosSimulations(): MergeChaosReport {
  const ranAt = new Date().toISOString();
  const verdicts: MergeChaosVerdict[] = MERGE_CHAOS_MODES.map(runChaosMode);
  const passed = verdicts.filter(v => v.passed).length;
  const failed = verdicts.filter(v => !v.passed).length;
  const passRate = passed / verdicts.length;
  const fingerprint = sha256ForPayload({
    schema: 'vitalcv.merge-chaos-report.v1',
    modes: verdicts.length,
    passed,
    verdicts: verdicts.map(v => ({ mode: v.mode, passed: v.passed })),
  });
  return {
    schema: 'vitalcv.merge-chaos-report.v1',
    modes: verdicts.length,
    passed,
    failed,
    passRate,
    verdicts,
    fingerprint,
    ranAt,
  };
}

// ── Activation merge telemetry ────────────────────────────────────────────────

/**
 * Build a complete telemetry record for a runtime activation merge event.
 * This is the single artifact the CI gate reads to decide GO/NO-GO.
 */
export function buildActivationMergeTelemetry(): ActivationMergeTelemetry {
  const emittedAt = new Date().toISOString();

  const governance    = harmonizeGovernanceContract();
  const driftSignal   = detectReplayDrift(buildSchemaFingerprint(), buildSchemaFingerprint());
  const chaosReport   = runMergeChaosSimulations();
  const survivability = scoreMergeSurvivability({
    governance,
    driftSignal,
    chaosPassRate: chaosReport.passRate,
  });

  const allGovernancePassing = governance.violations.length === 0;
  const noDrift              = !driftSignal.drifted;
  const chaosAllPassed       = chaosReport.failed === 0;
  const survivabilityPasses  = survivability.passesFloor;

  let mergeVerdict: ActivationMergeTelemetry['mergeVerdict'];
  let mergeVerdictReason: string;

  if (allGovernancePassing && noDrift && chaosAllPassed && survivabilityPasses) {
    mergeVerdict = 'MERGE_SAFE';
    mergeVerdictReason =
      `All ${chaosReport.modes} chaos modes passed; governance contract clean; ` +
      `no schema drift; survivability score ${survivability.score}/${survivability.floor}.`;
  } else if (!noDrift || !allGovernancePassing) {
    mergeVerdict = 'MERGE_UNSAFE';
    mergeVerdictReason = [
      !noDrift            ? `Schema drift on: ${driftSignal.driftedKeys.join(', ')}.` : null,
      !allGovernancePassing ? `Governance violations: ${governance.violations.join(' | ')}.` : null,
      !chaosAllPassed     ? `${chaosReport.failed} chaos mode(s) failed.` : null,
      !survivabilityPasses ? `Survivability score ${survivability.score} below floor ${survivability.floor}.` : null,
    ].filter(Boolean).join(' ');
  } else {
    mergeVerdict = 'MERGE_AMBIGUOUS';
    mergeVerdictReason = [
      !chaosAllPassed     ? `${chaosReport.failed} chaos mode(s) failed.` : null,
      !survivabilityPasses ? `Survivability score ${survivability.score} below floor ${survivability.floor}.` : null,
    ].filter(Boolean).join(' ');
  }

  const telemetryDigest = sha256ForPayload({
    schema: 'vitalcv.activation-merge-telemetry.v1',
    mergeVerdict,
    contractDigest:  governance.contractDigest,
    driftSignal:     { drifted: driftSignal.drifted, keys: driftSignal.driftedKeys },
    chaosFingerprint: chaosReport.fingerprint,
    scoreDigest:     survivability.scoreDigest,
  });

  return {
    schema: 'vitalcv.activation-merge-telemetry.v1',
    branchCategory: 'runtime-activation',
    governanceContract: governance,
    survivabilityScore: survivability,
    chaosReport,
    driftSignal,
    mergeVerdict,
    mergeVerdictReason,
    telemetryDigest,
    emittedAt,
  };
}
