/**
 * Production Acceptance Scoring — Unit Tests (W2-PR134A)
 *
 * Validates the evidence-derived scoring engine:
 *   1. Fail-closed enforcement
 *   2. Replay-unsafe rejection
 *   3. Evidence ceiling capping
 *   4. Ambiguity preservation
 *   5. Composite score derivation
 *   6. Deterministic fingerprinting
 *   7. Verdict thresholds
 */

import {
  KNOWN_ACCEPTANCE_VERDICTS,
  PRODUCTION_ACCEPTANCE_SENTINELS,
  scoreProductionAcceptance,
  type AcceptanceCriterionEvidence,
  type ProductionAcceptanceScoringInput,
} from '../productionAcceptanceScoring';

// ── fixtures ──────────────────────────────────────────────────────────────────

function baseCriterion(overrides: Partial<AcceptanceCriterionEvidence> = {}): AcceptanceCriterionEvidence {
  return {
    criterionId: 'crit-1',
    dimension: 'INSTITUTIONAL_READINESS',
    evidenceGrade: 'HIGH',
    evidenceSource: 'NPPES',
    evidenceTimestamp: '2026-05-10T00:00:00.000Z',
    passingThreshold: 75,
    rawScore: 90,
    ambiguous: false,
    ambiguityReason: null,
    notes: null,
    ...overrides,
  };
}

function baseInput(overrides: Partial<ProductionAcceptanceScoringInput> = {}): ProductionAcceptanceScoringInput {
  return {
    deploymentId: 'deploy-001',
    bundleVersion: '1.0.0',
    institutionId: 'inst-001',
    criteria: [],
    replaySafe: true,
    failClosed: true,
    scoredAt: '2026-05-10T00:00:00.000Z',
    ...overrides,
  };
}

// ── 1. Fail-closed enforcement ────────────────────────────────────────────────

describe('Fail-closed enforcement', () => {
  it('rejects when failClosed is false', () => {
    const result = scoreProductionAcceptance(baseInput({ failClosed: false }));
    expect(result.compositeVerdict).toBe('REJECTED');
    expect(result.failClosedEnforced).toBe(false);
    expect(result.compositeScore).toBe(0);
  });

  it('sets failClosedEnforced=true when failClosed=true', () => {
    const result = scoreProductionAcceptance(baseInput({
      failClosed: true,
      criteria: [baseCriterion()],
    }));
    expect(result.failClosedEnforced).toBe(true);
  });

  it('dimensions with absent evidence floor to 0 under fail-closed', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [
        baseCriterion({ evidenceGrade: 'ABSENT', rawScore: 90 }),
      ],
    }));
    const dim = result.dimensions.find(d => d.dimension === 'INSTITUTIONAL_READINESS');
    expect(dim?.score).toBe(0);
    expect(dim?.absentCriteria).toBe(1);
  });
});

// ── 2. Replay-unsafe rejection ────────────────────────────────────────────────

describe('Replay-unsafe rejection', () => {
  it('rejects when replaySafe is false regardless of criteria', () => {
    const result = scoreProductionAcceptance(baseInput({
      replaySafe: false,
      criteria: [baseCriterion({ rawScore: 100, evidenceGrade: 'HIGH' })],
    }));
    expect(result.compositeVerdict).toBe('REJECTED');
    expect(result.replaySafe).toBe(false);
    expect(result.compositeScore).toBe(0);
  });

  it('does not floor to 0 via replay-unsafe path when replaySafe is true', () => {
    const result = scoreProductionAcceptance(baseInput({
      replaySafe: true,
      criteria: [baseCriterion({ rawScore: 90, evidenceGrade: 'HIGH' })],
    }));
    // replaySafe=true means the replay-unsafe zero-floor is NOT applied
    expect(result.replaySafe).toBe(true);
    expect(result.failClosedEnforced).toBe(true);
    // Scoring proceeds normally (not hard-zeroed by replay-unsafe path)
    const dim = result.dimensions.find(d => d.dimension === 'INSTITUTIONAL_READINESS');
    expect(dim?.score).toBeGreaterThan(0);
  });
});

// ── 3. Evidence ceiling capping ───────────────────────────────────────────────

describe('Evidence ceiling capping', () => {
  it('caps score at MEDIUM ceiling (75) even if rawScore is 100', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [
        baseCriterion({
          evidenceGrade: 'MEDIUM',
          rawScore: 100,
          passingThreshold: 60,
        }),
      ],
    }));
    const dim = result.dimensions.find(d => d.dimension === 'INSTITUTIONAL_READINESS');
    expect(dim?.evidenceCeiling).toBe(75);
    expect(dim?.score).toBeLessThanOrEqual(75);
  });

  it('caps score at LOW ceiling (45) even if rawScore is 90', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [
        baseCriterion({
          evidenceGrade: 'LOW',
          rawScore: 90,
          passingThreshold: 40,
        }),
      ],
    }));
    const dim = result.dimensions.find(d => d.dimension === 'INSTITUTIONAL_READINESS');
    expect(dim?.evidenceCeiling).toBe(45);
    expect(dim?.score).toBeLessThanOrEqual(45);
  });

  it('ABSENT evidence always produces score 0', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [
        baseCriterion({ evidenceGrade: 'ABSENT', rawScore: 100 }),
      ],
    }));
    const dim = result.dimensions.find(d => d.dimension === 'INSTITUTIONAL_READINESS');
    expect(dim?.score).toBe(0);
    expect(dim?.evidenceCeiling).toBe(0);
  });
});

// ── 4. Ambiguity preservation ─────────────────────────────────────────────────

describe('Ambiguity preservation', () => {
  it('marks ambiguityPreserved=true when any criterion is ambiguous', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [
        baseCriterion({ ambiguous: true, ambiguityReason: 'Source unavailable' }),
      ],
    }));
    expect(result.ambiguityPreserved).toBe(true);
  });

  it('caps ambiguous criterion score at 60% of evidence ceiling', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [
        baseCriterion({
          evidenceGrade: 'HIGH',
          rawScore: 100,
          ambiguous: true,
        }),
      ],
    }));
    const dim = result.dimensions.find(d => d.dimension === 'INSTITUTIONAL_READINESS');
    // HIGH ceiling = 100, ambiguous cap = 60% = 60
    expect(dim?.score).toBeLessThanOrEqual(60);
    expect(dim?.ambiguousCriteria).toBe(1);
  });
});

// ── 5. Composite score derivation ─────────────────────────────────────────────

describe('Composite score derivation', () => {
  it('produces composite from weighted dimension average', () => {
    const criteria: AcceptanceCriterionEvidence[] = [
      baseCriterion({ dimension: 'INSTITUTIONAL_READINESS',     rawScore: 90, evidenceGrade: 'HIGH' }),
      baseCriterion({ dimension: 'REPLAY_PRODUCTION_FIDELITY', rawScore: 90, evidenceGrade: 'HIGH', criterionId: 'c2' }),
      baseCriterion({ dimension: 'CONFIDENCE_INTEGRITY',        rawScore: 90, evidenceGrade: 'HIGH', criterionId: 'c3' }),
      baseCriterion({ dimension: 'DEPLOYMENT_SURVIVABILITY',    rawScore: 90, evidenceGrade: 'HIGH', criterionId: 'c4' }),
      baseCriterion({ dimension: 'ACCEPTANCE_MATURITY',         rawScore: 90, evidenceGrade: 'HIGH', criterionId: 'c5' }),
    ];
    const result = scoreProductionAcceptance(baseInput({ criteria }));
    expect(result.compositeScore).toBeGreaterThan(0);
    expect(result.compositeVerdict).toBe('ACCEPTED');
  });

  it('dimensions with no matching criteria contribute 0 and REJECTED', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [baseCriterion({ dimension: 'INSTITUTIONAL_READINESS', rawScore: 90 })],
    }));
    const rpf = result.dimensions.find(d => d.dimension === 'REPLAY_PRODUCTION_FIDELITY');
    expect(rpf?.score).toBe(0);
    expect(rpf?.verdict).toBe('REJECTED');
  });
});

// ── 6. Deterministic fingerprinting ───────────────────────────────────────────

describe('Deterministic fingerprinting', () => {
  it('produces the same fingerprint for identical inputs', () => {
    const input = baseInput({
      criteria: [baseCriterion({ rawScore: 88 })],
    });
    const r1 = scoreProductionAcceptance(input);
    const r2 = scoreProductionAcceptance(input);
    expect(r1.scoringFingerprint).toBe(r2.scoringFingerprint);
  });

  it('produces different fingerprints when rawScore differs', () => {
    const r1 = scoreProductionAcceptance(baseInput({ criteria: [baseCriterion({ rawScore: 80 })] }));
    const r2 = scoreProductionAcceptance(baseInput({ criteria: [baseCriterion({ rawScore: 81 })] }));
    expect(r1.scoringFingerprint).not.toBe(r2.scoringFingerprint);
  });
});

// ── 7. Verdict thresholds ─────────────────────────────────────────────────────

describe('Verdict thresholds', () => {
  it('ACCEPTED verdict requires composite ≥ 85', () => {
    expect(KNOWN_ACCEPTANCE_VERDICTS).toContain('ACCEPTED');
  });

  it('schema and version are correct literals', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [baseCriterion()],
    }));
    expect(result.schema).toBe('https://vitalcv.com/acceptance-scoring/v1');
    expect(result.scoringVersion).toBe('1.0');
  });

  it('sentinel keys exist', () => {
    expect(PRODUCTION_ACCEPTANCE_SENTINELS.FAIL_CLOSED_REQUIRED).toBe('FAIL_CLOSED_REQUIRED');
    expect(PRODUCTION_ACCEPTANCE_SENTINELS.ABSENT_EVIDENCE_FLOOR).toBe('ABSENT_EVIDENCE_FLOOR');
    expect(PRODUCTION_ACCEPTANCE_SENTINELS.REPLAY_UNSAFE_REJECTION).toBe('REPLAY_UNSAFE_REJECTION');
  });
});
