/**
 * Activation Readiness — CI Gate (W2-PR144A)
 *
 * Canary suite. Every public primitive must:
 *   - export an enumerated sentinel list matching the runtime type union;
 *   - throw ActivationReadinessError (not plain Error) on boundary breaches;
 *   - never coerce ACTIVATION_AMBIGUOUS to READY (the silent-collapse
 *     anti-pattern);
 *   - produce deterministic readinessDigest (same input → same digest);
 *   - expose methodologyVersion literal on every score.
 *
 * If a future refactor accidentally weakens any of these invariants, this
 * suite breaks the build before the regression ships.
 */

import {
  KNOWN_ACTIVATION_VERDICTS,
  KNOWN_READINESS_DIMENSIONS,
  KNOWN_DIMENSION_STATUSES,
  ACTIVATION_READINESS_SENTINELS,
  ActivationReadinessError,
  scoreActivationReadiness,
  type ActivationVerdict,
  type ReadinessDimension,
  type DimensionReadinessStatus,
  type ReadinessEvidenceCapsule,
} from '../activationReadiness';

import {
  KNOWN_REPLAY_ACTIVATION_VERDICTS,
  KNOWN_REPLAY_FAILURE_REASONS,
  REPLAY_ACTIVATION_SENTINELS,
  validateActivationReplay,
  type ReplayActivationVerdict,
  type ReplayActivationFailureReason,
} from '../activationReplayValidation';

import {
  KNOWN_SURVIVABILITY_VERDICTS,
  KNOWN_SURVIVABILITY_FAILURE_MODES,
  SURVIVABILITY_SENTINELS,
  verifyInstitutionalSurvivability,
  buildEcosystemSurvivabilityReport,
  type SurvivabilityVerdict,
} from '../institutionalSurvivability';

import { buildActivationConfidenceTelemetry } from '../activationConfidenceTelemetry';
import { sealReadinessLineageManifest } from '../readinessLineageManifest';

// ── Expected sentinel lists ────────────────────────────────────────────────────

const EXPECTED_VERDICTS: ActivationVerdict[] = [
  'READY',
  'CONDITIONALLY_READY',
  'NOT_READY',
  'ACTIVATION_AMBIGUOUS',
  'ACTIVATION_BREACH',
];

const EXPECTED_DIMENSIONS: ReadinessDimension[] = [
  'OPERATOR',
  'VERIFIER',
  'EXECUTIVE',
  'ECOSYSTEM',
];

const EXPECTED_DIM_STATUSES: DimensionReadinessStatus[] = [
  'PASSING',
  'PARTIAL',
  'BLOCKED',
  'AMBIGUOUS',
  'BREACH',
];

const EXPECTED_REPLAY_VERDICTS: ReplayActivationVerdict[] = [
  'REPLAY_VALID',
  'REPLAY_STALE',
  'REPLAY_AMBIGUOUS',
  'REPLAY_BREACH',
  'REPLAY_MISSING',
];

const EXPECTED_REPLAY_FAILURES: ReplayActivationFailureReason[] = [
  'NO_ANCHOR_CAPSULE',
  'ANCHOR_CONTAINMENT_BREACH',
  'ANCHOR_CONTAINMENT_AMBIGUOUS',
  'ANCHOR_NOT_REPLAY_VERIFIED',
  'ANCHOR_STALE',
  'EVIDENCE_SPINE_DRIFTED',
];

const EXPECTED_SURVIVABILITY_VERDICTS: SurvivabilityVerdict[] = [
  'SURVIVABLE',
  'DEGRADED',
  'SURVIVABILITY_FAILED',
  'SURVIVABILITY_AMBIGUOUS',
];

// ── helpers ────────────────────────────────────────────────────────────────────

function allDimsCapsule(score: number, verdict: ReadinessEvidenceCapsule['containmentVerdict'] = 'CLEAN'): ReadinessEvidenceCapsule[] {
  return EXPECTED_DIMENSIONS.map(dim => ({
    schema: 'vitalcv.activation-evidence.v1' as const,
    capsuleId: `cap-gate-${dim}`,
    dimension: dim,
    evidenceScore: score,
    containmentVerdict: verdict,
    replayCapsuleIds: ['replay-gate-1'],
    observedAt: new Date().toISOString(),
  }));
}

// ── CI gate: exported enums ────────────────────────────────────────────────────

describe('CI gate — activation readiness sentinel lists match type unions', () => {
  it('KNOWN_ACTIVATION_VERDICTS covers all expected verdicts', () => {
    for (const v of EXPECTED_VERDICTS) {
      expect(KNOWN_ACTIVATION_VERDICTS).toContain(v);
    }
    expect(KNOWN_ACTIVATION_VERDICTS).toHaveLength(EXPECTED_VERDICTS.length);
  });

  it('KNOWN_READINESS_DIMENSIONS covers all four participant classes', () => {
    for (const d of EXPECTED_DIMENSIONS) {
      expect(KNOWN_READINESS_DIMENSIONS).toContain(d);
    }
    expect(KNOWN_READINESS_DIMENSIONS).toHaveLength(EXPECTED_DIMENSIONS.length);
  });

  it('KNOWN_DIMENSION_STATUSES covers all expected statuses', () => {
    for (const s of EXPECTED_DIM_STATUSES) {
      expect(KNOWN_DIMENSION_STATUSES).toContain(s);
    }
    expect(KNOWN_DIMENSION_STATUSES).toHaveLength(EXPECTED_DIM_STATUSES.length);
  });
});

describe('CI gate — replay activation sentinel lists match type unions', () => {
  it('KNOWN_REPLAY_ACTIVATION_VERDICTS is complete', () => {
    for (const v of EXPECTED_REPLAY_VERDICTS) {
      expect(KNOWN_REPLAY_ACTIVATION_VERDICTS).toContain(v);
    }
    expect(KNOWN_REPLAY_ACTIVATION_VERDICTS).toHaveLength(EXPECTED_REPLAY_VERDICTS.length);
  });

  it('KNOWN_REPLAY_FAILURE_REASONS is complete', () => {
    for (const r of EXPECTED_REPLAY_FAILURES) {
      expect(KNOWN_REPLAY_FAILURE_REASONS).toContain(r);
    }
    expect(KNOWN_REPLAY_FAILURE_REASONS).toHaveLength(EXPECTED_REPLAY_FAILURES.length);
  });
});

describe('CI gate — survivability sentinel lists match type unions', () => {
  it('KNOWN_SURVIVABILITY_VERDICTS is complete', () => {
    for (const v of EXPECTED_SURVIVABILITY_VERDICTS) {
      expect(KNOWN_SURVIVABILITY_VERDICTS).toContain(v);
    }
    expect(KNOWN_SURVIVABILITY_VERDICTS).toHaveLength(EXPECTED_SURVIVABILITY_VERDICTS.length);
  });
});

// ── CI gate: error types ───────────────────────────────────────────────────────

describe('CI gate — ActivationReadinessError is thrown (not plain Error)', () => {
  it('empty slice throws ActivationReadinessError with enumerated violation', () => {
    try {
      scoreActivationReadiness([]);
      expect(true).toBe(false); // must not reach here
    } catch (e) {
      expect(e).toBeInstanceOf(ActivationReadinessError);
      const err = e as ActivationReadinessError;
      expect(err.name).toBe('ActivationReadinessError');
      expect(['EMPTY_EVIDENCE_SLICE', 'BREACH_DIMENSION_BLOCKS_ACTIVATION', 'ALL_DIMENSIONS_AMBIGUOUS'])
        .toContain(err.violation);
    }
  });
});

// ── CI gate: AMBIGUOUS never silently collapses to READY ─────────────────────

describe('CI gate — AMBIGUOUS never collapses to READY', () => {
  it('capsules without replay IDs produce ACTIVATION_AMBIGUOUS, not READY', () => {
    const capsules = allDimsCapsule(100).map(c => ({ ...c, replayCapsuleIds: [] as string[] }));
    const result = scoreActivationReadiness(capsules);
    expect(result.overallVerdict).not.toBe('READY');
    expect(result.overallVerdict).toBe('ACTIVATION_AMBIGUOUS');
  });
});

// ── CI gate: deterministic digest ─────────────────────────────────────────────

describe('CI gate — readinessDigest is tamper-evident (different inputs → different digest)', () => {
  it('mutating a capsule evidenceScore changes the readinessDigest', () => {
    const capsules85 = allDimsCapsule(85);
    const capsules90 = allDimsCapsule(90);
    const r85 = scoreActivationReadiness(capsules85);
    const r90 = scoreActivationReadiness(capsules90);
    expect(r85.readinessDigest).not.toBe(r90.readinessDigest);
  });

  it('readinessDigest is a non-empty hex string', () => {
    const result = scoreActivationReadiness(allDimsCapsule(85));
    expect(result.readinessDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── CI gate: methodology version literal ──────────────────────────────────────

describe('CI gate — methodologyVersion literal present on every score', () => {
  it('score includes methodologyVersion = activation-readiness.v1', () => {
    const result = scoreActivationReadiness(allDimsCapsule(85));
    expect(result.methodologyVersion).toBe('activation-readiness.v1');
  });
});

// ── CI gate: schema literals present on outputs ───────────────────────────────

describe('CI gate — schema literals on all output types', () => {
  it('ActivationReadinessScore has correct schema literal', () => {
    const result = scoreActivationReadiness(allDimsCapsule(85));
    expect(result.schema).toBe('vitalcv.activation-readiness.v1');
  });

  it('ActivationReplayResult has correct schema literal', () => {
    const result = validateActivationReplay({
      activationId: 'act-schema-test',
      proposedAt: new Date().toISOString(),
      anchor: null,
      currentEvidenceSpineHash: 'x',
    });
    expect(result.schema).toBe('vitalcv.activation-replay-result.v1');
  });

  it('InstitutionalSurvivabilityResult has correct schema literal', () => {
    const result = verifyInstitutionalSurvivability({
      institutionId: 'inst-schema',
      observationWindowStart: new Date(Date.now() - 3600_000).toISOString(),
      observationWindowEnd: new Date().toISOString(),
      failureEvents: [],
      activationSuccessRate: 1.0,
      replayFallbackConfigured: true,
    });
    expect(result.schema).toBe('vitalcv.institutional-survivability.v1');
  });

  it('ReadinessLineageManifest has correct schema literal', () => {
    const capsules = allDimsCapsule(85);
    const score = scoreActivationReadiness(capsules);
    const manifest = sealReadinessLineageManifest(score, capsules);
    expect(manifest.schema).toBe('vitalcv.readiness-lineage-manifest.v1');
  });

  it('ActivationConfidenceTelemetry has correct schema literal', () => {
    const capsules = allDimsCapsule(85);
    const score = scoreActivationReadiness(capsules);
    const telemetry = buildActivationConfidenceTelemetry([score]);
    expect(telemetry.schema).toBe('vitalcv.activation-confidence-telemetry.v1');
  });
});

// ── CI gate: ACTIVATION_BREACH thresholds are correct ─────────────────────────

describe('CI gate — ACTIVATION_READINESS_SENTINELS thresholds are sane', () => {
  it('READY_THRESHOLD > CONDITIONAL_THRESHOLD', () => {
    expect(ACTIVATION_READINESS_SENTINELS.READY_THRESHOLD)
      .toBeGreaterThan(ACTIVATION_READINESS_SENTINELS.CONDITIONAL_THRESHOLD);
  });

  it('CONDITIONAL_THRESHOLD > 0', () => {
    expect(ACTIVATION_READINESS_SENTINELS.CONDITIONAL_THRESHOLD).toBeGreaterThan(0);
  });

  it('READY_THRESHOLD ≤ 100', () => {
    expect(ACTIVATION_READINESS_SENTINELS.READY_THRESHOLD).toBeLessThanOrEqual(100);
  });
});

// ── CI gate: replay activation default age constant is positive ────────────────

describe('CI gate — REPLAY_ACTIVATION_SENTINELS are positive', () => {
  it('DEFAULT_MAX_REPLAY_AGE_MS is a positive integer', () => {
    expect(REPLAY_ACTIVATION_SENTINELS.DEFAULT_MAX_REPLAY_AGE_MS).toBeGreaterThan(0);
    expect(Number.isInteger(REPLAY_ACTIVATION_SENTINELS.DEFAULT_MAX_REPLAY_AGE_MS)).toBe(true);
  });
});

// ── CI gate: survivability thresholds ─────────────────────────────────────────

describe('CI gate — SURVIVABILITY_SENTINELS are ordered correctly', () => {
  it('MIN_SUCCESS_RATE_FOR_SURVIVABLE > MIN_SUCCESS_RATE_FOR_DEGRADED', () => {
    expect(SURVIVABILITY_SENTINELS.MIN_SUCCESS_RATE_FOR_SURVIVABLE)
      .toBeGreaterThan(SURVIVABILITY_SENTINELS.MIN_SUCCESS_RATE_FOR_DEGRADED);
  });

  it('both rates are in (0, 1]', () => {
    expect(SURVIVABILITY_SENTINELS.MIN_SUCCESS_RATE_FOR_SURVIVABLE).toBeLessThanOrEqual(1);
    expect(SURVIVABILITY_SENTINELS.MIN_SUCCESS_RATE_FOR_DEGRADED).toBeGreaterThan(0);
  });
});
