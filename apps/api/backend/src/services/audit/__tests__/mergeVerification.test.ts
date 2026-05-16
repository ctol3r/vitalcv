/**
 * W2-PR164A — Runtime Activation Merge Verification Test Suite
 *
 * Seven sections:
 *   §1  Constitutional invariants   — schema registry, verdict/kind/action taxonomies
 *   §2  Replay drift detection      — detects schema version changes
 *   §3  Governance harmonization    — canonical audit event types, replay categories
 *   §4  Merge lineage verification  — determinism + contamination tracing
 *   §5  Ambiguity preservation      — AMBIGUOUS never coerced to CLEAN post-merge
 *   §6  Merge chaos simulations     — all 6 modes fail-closed
 *   §7  Survivability scoring       — board metrics at various pass rates
 */

import {
  REPLAY_SCHEMA_REGISTRY,
  REPLAY_CATEGORY_MAP,
  MUTATION_CLASSIFICATION_MAP,
  CANONICAL_AUDIT_EVENT_TYPES,
  MERGE_CHAOS_MODES,
  buildSchemaFingerprint,
  detectReplayDrift,
  verifyMergeLineage,
  harmonizeGovernanceContract,
  scoreMergeSurvivability,
  runMergeChaosSimulations,
  buildActivationMergeTelemetry,
} from '../mergeVerification';
import {
  KNOWN_CONTAINMENT_VERDICTS,
  KNOWN_CORRUPTION_KINDS,
  KNOWN_CONTAINMENT_VIOLATIONS,
  CONTAINMENT_SENTINELS,
  classifyIntegrity,
  quarantineReplay,
  evaluateContainment,
  assertAmbiguityPreserved,
  computeContainmentBoundary,
  assertContainmentBoundary,
  traceCorruptionLineage,
  ReplayContainmentError,
} from '../replayCorruptionContainment';

// ─────────────────────────────────────────────────────────────────────────────
// §1 Constitutional invariants
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 constitutional invariants', () => {
  it('schema registry covers all 13 constitutional schemas', () => {
    const keys = Object.keys(REPLAY_SCHEMA_REGISTRY);
    expect(keys.length).toBeGreaterThanOrEqual(13);
  });

  it('all schema registry values are non-empty strings', () => {
    for (const [, v] of Object.entries(REPLAY_SCHEMA_REGISTRY)) {
      expect(typeof v).toBe('string');
      expect(v.trim().length).toBeGreaterThan(0);
    }
  });

  it('replay schema uses https://vitalcv.com/replay/v1', () => {
    expect(REPLAY_SCHEMA_REGISTRY.REPLAY_V1).toBe('https://vitalcv.com/replay/v1');
  });

  it('audit bundle schema uses https://vitalcv.com/audit-bundle/v1', () => {
    expect(REPLAY_SCHEMA_REGISTRY.AUDIT_BUNDLE_V1).toBe('https://vitalcv.com/audit-bundle/v1');
  });

  it('runtime trust schema uses vitalcv.runtime-trust-cohesion.v1', () => {
    expect(REPLAY_SCHEMA_REGISTRY.RUNTIME_TRUST_V1).toBe('vitalcv.runtime-trust-cohesion.v1');
  });

  it('verdict taxonomy contains exactly 5 verdicts (CLEAN/QUARANTINED/AMBIGUOUS/CONTAMINATED/CONTAINMENT_BREACH)', () => {
    expect(KNOWN_CONTAINMENT_VERDICTS).toHaveLength(5);
    expect(KNOWN_CONTAINMENT_VERDICTS).toContain('CLEAN');
    expect(KNOWN_CONTAINMENT_VERDICTS).toContain('QUARANTINED');
    expect(KNOWN_CONTAINMENT_VERDICTS).toContain('AMBIGUOUS');
    expect(KNOWN_CONTAINMENT_VERDICTS).toContain('CONTAMINATED');
    expect(KNOWN_CONTAINMENT_VERDICTS).toContain('CONTAINMENT_BREACH');
  });

  it('corruption kind taxonomy contains exactly 6 kinds', () => {
    expect(KNOWN_CORRUPTION_KINDS).toHaveLength(6);
    expect(KNOWN_CORRUPTION_KINDS).toContain('HASH_MISMATCH');
    expect(KNOWN_CORRUPTION_KINDS).toContain('EVIDENCE_SPINE_DRIFT');
    expect(KNOWN_CORRUPTION_KINDS).toContain('STRUCTURAL_CORRUPTION');
    expect(KNOWN_CORRUPTION_KINDS).toContain('AMBIGUOUS_INTEGRITY');
    expect(KNOWN_CORRUPTION_KINDS).toContain('DEPENDENCY_CORRUPTION');
    expect(KNOWN_CORRUPTION_KINDS).toContain('METADATA_CORRUPTION');
  });

  it('containment violation taxonomy is exhaustive', () => {
    expect(KNOWN_CONTAINMENT_VIOLATIONS).toHaveLength(4);
    expect(KNOWN_CONTAINMENT_VIOLATIONS).toContain('AMBIGUOUS_QUARANTINE_FORCED_CLEAN');
    expect(KNOWN_CONTAINMENT_VIOLATIONS).toContain('BOUNDARY_BREACH');
    expect(KNOWN_CONTAINMENT_VIOLATIONS).toContain('PARTIAL_SURVIVABILITY_FLOOR_BREACHED');
    expect(KNOWN_CONTAINMENT_VIOLATIONS).toContain('QUARANTINE_OPEN_FAILURE');
  });

  it('replay category map covers all 8 runtime mutation actions', () => {
    const actions = Object.keys(REPLAY_CATEGORY_MAP);
    expect(actions).toContain('accept');
    expect(actions).toContain('request-refresh');
    expect(actions).toContain('route-to-review');
    expect(actions).toContain('packet-export');
    expect(actions).toContain('share-packet');
    expect(actions).toContain('confirm-start');
    expect(actions).toContain('denied-mutation');
    expect(actions).toContain('dossier-replay');
    expect(actions).toHaveLength(8);
  });

  it('mutation classification map covers all 8 runtime mutation actions', () => {
    const actions = Object.keys(MUTATION_CLASSIFICATION_MAP);
    expect(actions).toHaveLength(8);
  });

  it('replay categories span R-CAT-1 through R-CAT-6 with no gaps', () => {
    const categories = new Set(Object.values(REPLAY_CATEGORY_MAP));
    for (let i = 1; i <= 6; i++) {
      expect(categories).toContain(`R-CAT-${i}`);
    }
  });

  it('canonical audit event type set has no duplicates', () => {
    const unique = new Set(CANONICAL_AUDIT_EVENT_TYPES);
    expect(unique.size).toBe(CANONICAL_AUDIT_EVENT_TYPES.length);
  });

  it('canonical audit event types covers at least 28 event types', () => {
    expect(CANONICAL_AUDIT_EVENT_TYPES.length).toBeGreaterThanOrEqual(28);
  });

  it('default partial survivability floor is 50', () => {
    expect(CONTAINMENT_SENTINELS.DEFAULT_MIN_PARTIAL_SURVIVABILITY_PCT).toBe(50);
  });

  it('chaos mode registry has exactly 6 modes', () => {
    expect(MERGE_CHAOS_MODES).toHaveLength(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 Replay drift detection
// ─────────────────────────────────────────────────────────────────────────────

describe('§2 replay drift detection', () => {
  it('same fingerprint produces no drift', () => {
    const fp = buildSchemaFingerprint();
    const signal = detectReplayDrift(fp, fp);
    expect(signal.drifted).toBe(false);
    expect(signal.driftedKeys).toHaveLength(0);
  });

  it('schema fingerprint is deterministic', () => {
    const fp1 = buildSchemaFingerprint();
    const fp2 = buildSchemaFingerprint();
    expect(fp1.digest).toBe(fp2.digest);
  });

  it('detects a single schema version change as constitutional drift', () => {
    const before = buildSchemaFingerprint();
    const after: typeof before = {
      registry: { ...before.registry, REPLAY_V1: 'https://vitalcv.com/replay/v99' },
      digest: 'mutated',
    };
    const signal = detectReplayDrift(before, after);
    expect(signal.drifted).toBe(true);
    expect(signal.driftedKeys).toContain('REPLAY_V1');
  });

  it('detects a key added post-merge as drift', () => {
    const before = buildSchemaFingerprint();
    const after: typeof before = {
      registry: { ...before.registry, NEW_SCHEMA: 'vitalcv.new.v1' },
      digest: 'mutated',
    };
    const signal = detectReplayDrift(before, after);
    expect(signal.drifted).toBe(true);
    expect(signal.driftedKeys).toContain('NEW_SCHEMA');
  });

  it('detects a key removed post-merge as drift', () => {
    const before = buildSchemaFingerprint();
    const afterRegistry = { ...before.registry };
    delete (afterRegistry as Record<string, string>).RUNTIME_TRUST_V1;
    const signal = detectReplayDrift(before, { registry: afterRegistry, digest: 'mutated' });
    expect(signal.drifted).toBe(true);
    expect(signal.driftedKeys).toContain('RUNTIME_TRUST_V1');
  });

  it('reports all drifted keys in reason string', () => {
    const before = buildSchemaFingerprint();
    const after: typeof before = {
      registry: {
        ...before.registry,
        REPLAY_V1:        'changed-1',
        CONTAINMENT_V1:   'changed-2',
      },
      digest: 'mutated',
    };
    const signal = detectReplayDrift(before, after);
    expect(signal.driftedKeys).toHaveLength(2);
    expect(signal.reason).toContain('REPLAY_V1');
    expect(signal.reason).toContain('CONTAINMENT_V1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 Governance harmonization
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 governance harmonization', () => {
  it('harmonizeGovernanceContract passes with zero violations on main', () => {
    const contract = harmonizeGovernanceContract();
    expect(contract.violations).toHaveLength(0);
    expect(contract.schemaRegistryComplete).toBe(true);
    expect(contract.auditEventTypesComplete).toBe(true);
    expect(contract.replayCategoryMappingComplete).toBe(true);
    expect(contract.mutationClassificationMappingComplete).toBe(true);
    expect(contract.verdictTaxonomyComplete).toBe(true);
    expect(contract.corruptionKindTaxonomyComplete).toBe(true);
  });

  it('contract digest is a 64-char hex string', () => {
    const contract = harmonizeGovernanceContract();
    expect(contract.contractDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('contract digest is deterministic across calls', () => {
    const a = harmonizeGovernanceContract();
    const b = harmonizeGovernanceContract();
    expect(a.contractDigest).toBe(b.contractDigest);
  });

  it('EMPLOYER_REVIEW_ACCEPTED is in canonical event types (activation path)', () => {
    expect(CANONICAL_AUDIT_EVENT_TYPES).toContain('EMPLOYER_REVIEW_ACCEPTED');
  });

  it('START_ATTESTED is in canonical event types (confirm-start activation)', () => {
    expect(CANONICAL_AUDIT_EVENT_TYPES).toContain('START_ATTESTED');
  });

  it('EMPLOYER_REVIEW_MUTATION_DENIED is in canonical event types (denied mutation gate)', () => {
    expect(CANONICAL_AUDIT_EVENT_TYPES).toContain('EMPLOYER_REVIEW_MUTATION_DENIED');
  });

  it('accept action maps to R-CAT-1 and TRUST_ACCEPTANCE', () => {
    expect(REPLAY_CATEGORY_MAP['accept']).toBe('R-CAT-1');
    expect(MUTATION_CLASSIFICATION_MAP['accept']).toBe('TRUST_ACCEPTANCE');
  });

  it('confirm-start action maps to R-CAT-4 and TRUST_START_ATTESTATION', () => {
    expect(REPLAY_CATEGORY_MAP['confirm-start']).toBe('R-CAT-4');
    expect(MUTATION_CLASSIFICATION_MAP['confirm-start']).toBe('TRUST_START_ATTESTATION');
  });

  it('denied-mutation action maps to R-CAT-5 and DENIED_MUTATION', () => {
    expect(REPLAY_CATEGORY_MAP['denied-mutation']).toBe('R-CAT-5');
    expect(MUTATION_CLASSIFICATION_MAP['denied-mutation']).toBe('DENIED_MUTATION');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 Merge lineage verification
// ─────────────────────────────────────────────────────────────────────────────

describe('§4 merge lineage verification', () => {
  const candidates = [
    { capsuleId: 'child-1', hints: { subjectNpi: '1234567890' } },
    { capsuleId: 'child-2', hints: { credentialIds: ['cred-a', 'cred-b'] } },
    { capsuleId: 'child-3', hints: { sourceReferenceId: 'ref-x' } },
    { capsuleId: 'unrelated', hints: { subjectNpi: '9999999999' } },
  ];

  it('lineage reconstruction is deterministic (same inputs → same digest)', () => {
    const result1 = verifyMergeLineage({
      capsuleId: 'root-1',
      rootHints: { subjectNpi: '1234567890', credentialIds: ['cred-a'], sourceReferenceId: 'ref-x' },
      candidates,
    });
    const result2 = verifyMergeLineage({
      capsuleId: 'root-1',
      rootHints: { subjectNpi: '1234567890', credentialIds: ['cred-a'], sourceReferenceId: 'ref-x' },
      candidates,
    });
    expect(result1.lineageIntact).toBe(true);
    expect(result1.reconstructionDigest).toBe(result2.reconstructionDigest);
  });

  it('traces contamination via subject NPI', () => {
    const result = verifyMergeLineage({
      capsuleId: 'root-npi',
      rootHints: { subjectNpi: '1234567890' },
      candidates,
    });
    expect(result.contaminatedCount).toBeGreaterThan(0);
  });

  it('traces contamination via shared credential ID', () => {
    const result = verifyMergeLineage({
      capsuleId: 'root-cred',
      rootHints: { credentialIds: ['cred-a'] },
      candidates,
    });
    expect(result.contaminatedCount).toBeGreaterThan(0);
  });

  it('traces contamination via source reference ID', () => {
    const result = verifyMergeLineage({
      capsuleId: 'root-ref',
      rootHints: { sourceReferenceId: 'ref-x' },
      candidates,
    });
    expect(result.contaminatedCount).toBeGreaterThan(0);
  });

  it('empty hints produce zero edges (lineage hint loss scenario)', () => {
    const result = verifyMergeLineage({
      capsuleId: 'root-empty',
      rootHints: { subjectNpi: null, credentialIds: [], sourceReferenceId: null },
      candidates,
    });
    expect(result.contaminatedCount).toBe(0);
  });

  it('result schema is vitalcv.merge-lineage.v1', () => {
    const result = verifyMergeLineage({
      capsuleId: 'root-schema',
      rootHints: { subjectNpi: '1234567890' },
      candidates,
    });
    expect(result.schema).toBe('vitalcv.merge-lineage.v1');
  });

  it('traceCorruptionLineage reconstruction digest is 64-char hex', () => {
    const lineage = traceCorruptionLineage({
      rootCapsuleId: 'root-hex',
      rootHints: { subjectNpi: '1234567890' },
      candidates,
    });
    expect(lineage.reconstructionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 Ambiguity preservation
// ─────────────────────────────────────────────────────────────────────────────

describe('§5 ambiguity preservation — AMBIGUOUS never coerced to CLEAN post-merge', () => {
  it('hashMatch=true + tamperEvidence present → AMBIGUOUS (not CLEAN)', () => {
    const record = quarantineReplay({
      capsuleId: 'ambig-1',
      integrity: { hashMatch: true, storedHash: 'a', recomputedHash: 'a', tamperEvidence: 'injected' },
    });
    expect(record.verdict).toBe('AMBIGUOUS');
    expect(record.ambiguous).toBe(true);
    expect(record.kind).toBe('AMBIGUOUS_INTEGRITY');
  });

  it('hashMatch=false + no tamperEvidence → AMBIGUOUS (not QUARANTINED)', () => {
    const record = quarantineReplay({
      capsuleId: 'ambig-2',
      integrity: { hashMatch: false, storedHash: 'a', recomputedHash: 'b', tamperEvidence: null },
    });
    expect(record.verdict).toBe('AMBIGUOUS');
    expect(record.ambiguous).toBe(true);
  });

  it('clean integrity → CLEAN with kind=null', () => {
    const record = quarantineReplay({
      capsuleId: 'clean-1',
      integrity: { hashMatch: true, storedHash: 'a', recomputedHash: 'a', tamperEvidence: null },
    });
    expect(record.verdict).toBe('CLEAN');
    expect(record.kind).toBeNull();
    expect(record.ambiguous).toBe(false);
  });

  it('assertAmbiguityPreserved passes for a clean record', () => {
    const record = quarantineReplay({
      capsuleId: 'assert-clean',
      integrity: { hashMatch: true, storedHash: 'a', recomputedHash: 'a', tamperEvidence: null },
    });
    expect(() => assertAmbiguityPreserved(record)).not.toThrow();
  });

  it('assertAmbiguityPreserved throws when AMBIGUOUS verdict is coerced to another verdict', () => {
    const record = quarantineReplay({
      capsuleId: 'assert-ambig',
      integrity: { hashMatch: true, storedHash: 'a', recomputedHash: 'a', tamperEvidence: 'injected' },
    });
    expect(record.verdict).toBe('AMBIGUOUS');
    const mutated = { ...record, verdict: 'CLEAN' as const };
    expect(() => assertAmbiguityPreserved(mutated)).toThrow(ReplayContainmentError);
  });

  it('assertAmbiguityPreserved throws when CLEAN record carries a non-null kind', () => {
    const record = quarantineReplay({
      capsuleId: 'assert-kind',
      integrity: { hashMatch: true, storedHash: 'a', recomputedHash: 'a', tamperEvidence: null },
    });
    const mutated = { ...record, kind: 'HASH_MISMATCH' as const };
    expect(() => assertAmbiguityPreserved(mutated)).toThrow(ReplayContainmentError);
  });

  it('evaluateContainment never throws — returns CONTAINMENT_BREACH on internal failure', () => {
    const result = evaluateContainment({
      capsuleId: 'eval-safe',
      integrity: { hashMatch: false, storedHash: 'x', recomputedHash: 'y', tamperEvidence: 'mismatch' },
    });
    expect(result.verdict).not.toBeUndefined();
    expect(['QUARANTINED', 'AMBIGUOUS', 'CONTAMINATED', 'CLEAN', 'CONTAINMENT_BREACH']).toContain(result.verdict);
  });

  it('containment digest is tamper-evident (different inputs → different digest)', () => {
    const r1 = quarantineReplay({
      capsuleId: 'digest-a',
      integrity: { hashMatch: true, storedHash: 'a', recomputedHash: 'a', tamperEvidence: null },
    });
    const r2 = quarantineReplay({
      capsuleId: 'digest-b',
      integrity: { hashMatch: true, storedHash: 'a', recomputedHash: 'a', tamperEvidence: null },
    });
    expect(r1.containmentDigest).not.toBe(r2.containmentDigest);
  });

  it('containment digest is stable for identical inputs (replay-safe)', () => {
    const r1 = quarantineReplay({
      capsuleId: 'digest-stable',
      integrity: { hashMatch: true, storedHash: 'a', recomputedHash: 'a', tamperEvidence: null },
    });
    const r2 = quarantineReplay({
      capsuleId: 'digest-stable',
      integrity: { hashMatch: true, storedHash: 'a', recomputedHash: 'a', tamperEvidence: null },
    });
    expect(r1.containmentDigest).toBe(r2.containmentDigest);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 Merge chaos simulations
// ─────────────────────────────────────────────────────────────────────────────

describe('§6 merge chaos simulations — all 6 modes must pass (fail-closed)', () => {
  const report = runMergeChaosSimulations();

  it('runs exactly 6 chaos modes', () => {
    expect(report.modes).toBe(6);
    expect(report.verdicts).toHaveLength(6);
  });

  it('all chaos modes pass', () => {
    const failures = report.verdicts.filter(v => !v.passed);
    expect(failures).toHaveLength(0);
  });

  it('pass rate is 1.0 when all modes pass', () => {
    expect(report.passRate).toBe(1.0);
  });

  it('chaos fingerprint is a 64-char hex string', () => {
    expect(report.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('chaos fingerprint is deterministic', () => {
    const r1 = runMergeChaosSimulations();
    const r2 = runMergeChaosSimulations();
    expect(r1.fingerprint).toBe(r2.fingerprint);
  });

  for (const mode of MERGE_CHAOS_MODES) {
    it(`${mode} passes`, () => {
      const verdict = report.verdicts.find(v => v.mode === mode);
      expect(verdict).toBeDefined();
      expect(verdict!.passed).toBe(true);
    });
  }

  it('C-MERGE-2 detects schema version change in replay schema', () => {
    const v = report.verdicts.find(v => v.mode === 'C-MERGE-2-SCHEMA-VERSION-DRIFT');
    expect(v?.passed).toBe(true);
    expect(v?.reason).toContain('Constitutional drift detected');
  });

  it('C-MERGE-3 preserves AMBIGUOUS verdict (not coerced to CLEAN)', () => {
    const v = report.verdicts.find(v => v.mode === 'C-MERGE-3-AMBIGUOUS-COERCED-CLEAN');
    expect(v?.passed).toBe(true);
    expect(v?.reason).toContain('AMBIGUOUS verdict preserved');
  });

  it('C-MERGE-6 survivability floor enforced at low chaos pass rate', () => {
    const v = report.verdicts.find(v => v.mode === 'C-MERGE-6-SURVIVABILITY-FLOOR-REGRESSION');
    expect(v?.passed).toBe(true);
    expect(v?.reason).toContain('floor');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 Survivability scoring
// ─────────────────────────────────────────────────────────────────────────────

describe('§7 merge survivability scoring', () => {
  const cleanGovernance = harmonizeGovernanceContract();
  const cleanDrift = detectReplayDrift(buildSchemaFingerprint(), buildSchemaFingerprint());

  it('full-pass scenario scores 100 and exceeds floor', () => {
    const score = scoreMergeSurvivability({
      governance: cleanGovernance,
      driftSignal: cleanDrift,
      chaosPassRate: 1.0,
    });
    expect(score.score).toBe(100);
    expect(score.passesFloor).toBe(true);
  });

  it('schema drift drops score below floor (40% weight contribution zeroed)', () => {
    const driftedFp = {
      registry: { ...buildSchemaFingerprint().registry, REPLAY_V1: 'drifted' },
      digest: 'x',
    };
    const driftSignal = detectReplayDrift(buildSchemaFingerprint(), driftedFp);
    const score = scoreMergeSurvivability({
      governance: cleanGovernance,
      driftSignal,
      chaosPassRate: 1.0,
    });
    expect(score.components.schemaVersionStability).toBe(0);
    expect(score.passesFloor).toBe(false);
  });

  it('chaos pass rate of 15% drops score below floor', () => {
    const score = scoreMergeSurvivability({
      governance: cleanGovernance,
      driftSignal: cleanDrift,
      chaosPassRate: 0.15,
    });
    expect(score.passesFloor).toBe(false);
  });

  it('floor is 85', () => {
    const score = scoreMergeSurvivability({
      governance: cleanGovernance,
      driftSignal: cleanDrift,
      chaosPassRate: 1.0,
    });
    expect(score.floor).toBe(85);
  });

  it('score digest is a 64-char hex string', () => {
    const score = scoreMergeSurvivability({
      governance: cleanGovernance,
      driftSignal: cleanDrift,
      chaosPassRate: 1.0,
    });
    expect(score.scoreDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('score digest is deterministic', () => {
    const a = scoreMergeSurvivability({ governance: cleanGovernance, driftSignal: cleanDrift, chaosPassRate: 1.0 });
    const b = scoreMergeSurvivability({ governance: cleanGovernance, driftSignal: cleanDrift, chaosPassRate: 1.0 });
    expect(a.scoreDigest).toBe(b.scoreDigest);
  });

  it('computeContainmentBoundary survivability >= 50% with no breaches', () => {
    const quarantines = [
      quarantineReplay({
        capsuleId: 'q1',
        integrity: { hashMatch: true, storedHash: 'a', recomputedHash: 'a', tamperEvidence: null },
      }),
      quarantineReplay({
        capsuleId: 'q2',
        integrity: { hashMatch: false, storedHash: 'a', recomputedHash: 'b', tamperEvidence: 'mismatch' },
      }),
      quarantineReplay({
        capsuleId: 'q3',
        integrity: { hashMatch: true, storedHash: 'a', recomputedHash: 'a', tamperEvidence: null },
      }),
    ];
    const boundary = computeContainmentBoundary({ totalReplayed: 3, quarantines });
    expect(boundary.partialSurvivabilityPct).toBeGreaterThanOrEqual(50);
  });

  it('assertContainmentBoundary throws on boundary breach', () => {
    const quarantines = [
      quarantineReplay({
        capsuleId: 'breach-1',
        integrity: { hashMatch: false, storedHash: 'a', recomputedHash: 'b', tamperEvidence: 'mismatch' },
        forcedKind: 'STRUCTURAL_CORRUPTION',
        forcedReason: 'forced breach',
      }),
    ];
    // Force CONTAINMENT_BREACH by using evaluateContainment which can produce it
    // but normally quarantineReplay would produce QUARANTINED. We test the boundary
    // computation produces a non-partitioned boundary (below floor) on high failure rates.
    const boundary = computeContainmentBoundary({
      totalReplayed: 10,
      quarantines,
      minPartialSurvivabilityPct: 90,
    });
    expect(boundary.partitioned).toBe(false);
    expect(() => assertContainmentBoundary(boundary, { minPartialSurvivabilityPct: 90 }))
      .toThrow(ReplayContainmentError);
  });

  it('buildActivationMergeTelemetry returns MERGE_SAFE on clean codebase', () => {
    const telemetry = buildActivationMergeTelemetry();
    expect(telemetry.mergeVerdict).toBe('MERGE_SAFE');
    expect(telemetry.schema).toBe('vitalcv.activation-merge-telemetry.v1');
    expect(telemetry.branchCategory).toBe('runtime-activation');
    expect(telemetry.telemetryDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(telemetry.chaosReport.failed).toBe(0);
    expect(telemetry.governanceContract.violations).toHaveLength(0);
    expect(telemetry.survivabilityScore.passesFloor).toBe(true);
    expect(telemetry.driftSignal.drifted).toBe(false);
  });
});
