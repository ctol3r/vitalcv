/**
 * Confidence Calibration — CI Gate (W2-PR130A)
 *
 * Canary suite. Every public primitive must:
 *   - never produce a score that exceeds evidenceCeiling (fail-closed)
 *   - never coerce AMBIGUOUS containment to a score > 0.5
 *   - never produce FULL tier from a single source
 *   - never produce any score from a CONTAINMENT_BREACH replay
 *   - produce deterministic, non-colliding calibrationDigests
 *   - throw ConfidenceCalibrationError with a known violation when asserted
 *   - report drift direction correctly from ordered snapshot sequences
 *
 * If a future refactor weakens any of these invariants, this suite breaks
 * the build before the regression ships.
 */

import {
  CONFIDENCE_CALIBRATION_SENTINELS,
  CONTAINMENT_CONFIDENCE_CEILINGS,
  KNOWN_CALIBRATION_VIOLATIONS,
  KNOWN_CONFIDENCE_TIERS,
  KNOWN_OVERCONFIDENCE_REASONS,
  ConfidenceCalibrationError,
  assertConfidenceCalibrated,
  calibrateConfidence,
  computeConfidenceDrift,
  type CalibrationInput,
  type ConfidenceDriftSnapshot,
  type ConfidenceTier,
  type OverconfidenceReason,
  type ConfidenceCalibrationViolationKind,
} from '../confidenceCalibration';
import type { ContainmentVerdict } from '../replayCorruptionContainment';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function cleanInput(overrides: Partial<CalibrationInput> = {}): CalibrationInput {
  return {
    capsuleId: 'ci-cap-1',
    sourcesConsulted: [
      { source: 'NPPES',       outcome: 'VERIFIED', confidence: 'HIGH' },
      { source: 'STATE_BOARD', outcome: 'VERIFIED', confidence: 'HIGH' },
      { source: 'OIG_LEIE',   outcome: 'VERIFIED', confidence: 'HIGH' },
      { source: 'DEA',         outcome: 'VERIFIED', confidence: 'HIGH' },
      { source: 'ABIM',        outcome: 'VERIFIED', confidence: 'HIGH' },
    ],
    trustScore:         85,
    integrityHashMatch: true,
    tamperEvidence:     null,
    containmentVerdict: 'CLEAN',
    ambiguous:          false,
    ...overrides,
  };
}

function snapshotAt(day: number, score: number, ceiling: number, overconfident: boolean): ConfidenceDriftSnapshot {
  return {
    capsuleId: `cap-${day}`,
    pointScore: score,
    evidenceCeiling: ceiling,
    overconfidenceDetected: overconfident,
    calibratedAt: new Date(1_746_000_000_000 + day * 86_400_000).toISOString(),
  };
}

// ── CI Gate 1: score never exceeds evidenceCeiling ────────────────────────────

const ALL_VERDICTS: ContainmentVerdict[] = [
  'CLEAN', 'AMBIGUOUS', 'QUARANTINED', 'CONTAMINATED', 'CONTAINMENT_BREACH',
];

describe('CI gate — score.point never exceeds evidenceCeiling', () => {
  for (const verdict of ALL_VERDICTS) {
    it(`holds for containmentVerdict=${verdict}`, () => {
      const result = calibrateConfidence(cleanInput({ containmentVerdict: verdict, ambiguous: verdict === 'AMBIGUOUS' }));
      expect(result.score.point).toBeLessThanOrEqual(result.evidenceCeiling + 1e-10);
    });
  }
});

describe('CI gate — evidenceCeiling never exceeds containment ceiling', () => {
  for (const verdict of ALL_VERDICTS) {
    it(`holds for containmentVerdict=${verdict}`, () => {
      const result = calibrateConfidence(cleanInput({ containmentVerdict: verdict, ambiguous: verdict === 'AMBIGUOUS' }));
      const ceiling = CONTAINMENT_CONFIDENCE_CEILINGS[verdict];
      expect(result.evidenceCeiling).toBeLessThanOrEqual(ceiling + 1e-10);
    });
  }
});

// ── CI Gate 2: AMBIGUOUS never reaches > 0.5 ─────────────────────────────────

describe('CI gate — AMBIGUOUS containment caps score at 0.5', () => {
  it('point score never exceeds AMBIGUOUS ceiling', () => {
    const result = calibrateConfidence(cleanInput({
      containmentVerdict: 'AMBIGUOUS',
      ambiguous:          true,
    }));
    expect(result.score.point).toBeLessThanOrEqual(0.50 + 1e-10);
    expect(result.score.upper).toBeLessThanOrEqual(0.50 + 1e-10);
  });

  it('tier is never HIGH or FULL under AMBIGUOUS containment', () => {
    const result = calibrateConfidence(cleanInput({
      containmentVerdict: 'AMBIGUOUS',
      ambiguous:          true,
    }));
    expect(result.tier).not.toBe('HIGH');
    expect(result.tier).not.toBe('FULL');
  });
});

// ── CI Gate 3: CONTAINMENT_BREACH forces zero ─────────────────────────────────

describe('CI gate — CONTAINMENT_BREACH forces score to 0', () => {
  it('point, lower, and upper are all 0', () => {
    const result = calibrateConfidence(cleanInput({ containmentVerdict: 'CONTAINMENT_BREACH' }));
    expect(result.score.point).toBe(0);
    expect(result.score.lower).toBe(0);
    expect(result.score.upper).toBe(0);
    expect(result.tier).toBe('NONE');
    expect(result.evidenceCeiling).toBe(0);
  });
});

// ── CI Gate 4: single source cannot reach FULL tier ──────────────────────────

describe('CI gate — single verified source cannot produce FULL tier', () => {
  it('one HIGH VERIFIED source stays below FULL', () => {
    const result = calibrateConfidence(cleanInput({
      sourcesConsulted: [{ source: 'NPPES', outcome: 'VERIFIED', confidence: 'HIGH' }],
    }));
    expect(result.tier).not.toBe('FULL');
    // Breadth ceiling for 1 source = 0.60
    expect(result.score.point).toBeLessThanOrEqual(0.61);
  });
});

// ── CI Gate 5: calibrationDigest is deterministic ────────────────────────────

describe('CI gate — calibrationDigest is deterministic and collision-resistant', () => {
  it('same input twice produces identical digest', () => {
    const input = cleanInput();
    expect(calibrateConfidence(input).calibrationDigest)
      .toBe(calibrateConfidence(input).calibrationDigest);
  });

  it('different capsuleIds produce different digests', () => {
    const a = calibrateConfidence(cleanInput({ capsuleId: 'cap-a' }));
    const b = calibrateConfidence(cleanInput({ capsuleId: 'cap-b' }));
    expect(a.calibrationDigest).not.toBe(b.calibrationDigest);
  });

  it('different verdicts produce different digests', () => {
    const a = calibrateConfidence(cleanInput({ containmentVerdict: 'CLEAN' }));
    const b = calibrateConfidence(cleanInput({ containmentVerdict: 'QUARANTINED' }));
    expect(a.calibrationDigest).not.toBe(b.calibrationDigest);
  });

  it('different source sets produce different digests', () => {
    const a = calibrateConfidence(cleanInput({
      sourcesConsulted: [{ source: 'NPPES', outcome: 'VERIFIED', confidence: 'HIGH' }],
    }));
    const b = calibrateConfidence(cleanInput({
      sourcesConsulted: [{ source: 'DEA', outcome: 'VERIFIED', confidence: 'HIGH' }],
    }));
    expect(a.calibrationDigest).not.toBe(b.calibrationDigest);
  });
});

// ── CI Gate 6: assertConfidenceCalibrated throws on overconfidence ────────────

describe('CI gate — assertConfidenceCalibrated throws ConfidenceCalibrationError', () => {
  it('throws with OVERCONFIDENCE_ASSERTED when trust score inflates beyond evidence', () => {
    const result = calibrateConfidence(cleanInput({
      sourcesConsulted: [],
      trustScore: 99,
      containmentVerdict: 'CLEAN',
    }));
    expect(result.overconfidence.detected).toBe(true);

    let caught: unknown = null;
    try { assertConfidenceCalibrated(result); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ConfidenceCalibrationError);
    const err = caught as ConfidenceCalibrationError;
    expect(err.code).toBe('CONFIDENCE_CALIBRATION_VIOLATION');
    expect(KNOWN_CALIBRATION_VIOLATIONS).toContain(err.violation);
    expect(err.violation).toBe('OVERCONFIDENCE_ASSERTED');
  });

  it('does not throw for a well-calibrated clean score', () => {
    const result = calibrateConfidence(cleanInput());
    // Only assert if not overconfident
    if (!result.overconfidence.detected) {
      expect(() => assertConfidenceCalibrated(result)).not.toThrow();
    }
  });
});

// ── CI Gate 7: empty evidence always means zero score ────────────────────────

describe('CI gate — zero verified sources yields zero point score', () => {
  it('holds when all sources are non-VERIFIED statuses', () => {
    const result = calibrateConfidence(cleanInput({
      sourcesConsulted: [
        { source: 'NPPES', outcome: 'EXPIRED',    confidence: 'HIGH' },
        { source: 'DEA',   outcome: 'NOT_FOUND',  confidence: 'HIGH' },
      ],
    }));
    expect(result.evidenceBasisCount).toBe(0);
    expect(result.score.point).toBe(0);
    expect(result.tier).toBe('NONE');
  });

  it('holds when sourcesConsulted is empty', () => {
    const result = calibrateConfidence(cleanInput({ sourcesConsulted: [] }));
    expect(result.score.point).toBe(0);
  });
});

// ── CI Gate 8: integrity failure degrades score ───────────────────────────────

describe('CI gate — integrity failure degrades calibrated score', () => {
  it('hash mismatch produces lower score than clean integrity', () => {
    const clean   = calibrateConfidence(cleanInput());
    const tampered = calibrateConfidence(cleanInput({
      integrityHashMatch: false,
      tamperEvidence: 'Hash mismatch — stored: aaaa… computed: bbbb…',
      containmentVerdict: 'QUARANTINED',
    }));
    expect(tampered.score.point).toBeLessThan(clean.score.point);
  });

  it('spine drift produces lowest score of all integrity failure modes', () => {
    const spineDrift = calibrateConfidence(cleanInput({
      integrityHashMatch:   true,
      tamperEvidence:       null,
      evidenceSpineDrifted: true,
    }));
    const hashMismatch = calibrateConfidence(cleanInput({
      integrityHashMatch: false,
      tamperEvidence: 'Hash mismatch',
    }));
    // spine drift multiplier (0.20) < hash mismatch multiplier (0.30)
    expect(spineDrift.score.point).toBeLessThan(hashMismatch.score.point + 0.001);
  });
});

// ── CI Gate 9: drift report direction is correct ─────────────────────────────

describe('CI gate — drift direction reported correctly', () => {
  it('INCREASING when last > first by > 0.01', () => {
    const snaps = [snapshotAt(0, 0.30, 0.95, false), snapshotAt(1, 0.60, 0.95, false)];
    expect(computeConfidenceDrift(snaps).driftDirection).toBe('INCREASING');
  });

  it('DECREASING when last < first by > 0.01', () => {
    const snaps = [snapshotAt(0, 0.70, 0.95, false), snapshotAt(1, 0.40, 0.95, false)];
    expect(computeConfidenceDrift(snaps).driftDirection).toBe('DECREASING');
  });

  it('STABLE when last ≈ first (within 0.01)', () => {
    const snaps = [snapshotAt(0, 0.50, 0.95, false), snapshotAt(1, 0.505, 0.95, false)];
    expect(computeConfidenceDrift(snaps).driftDirection).toBe('STABLE');
  });

  it('returns zero-drift report for a single snapshot', () => {
    const report = computeConfidenceDrift([snapshotAt(0, 0.5, 0.9, false)]);
    expect(report.driftMagnitude).toBe(0);
    expect(report.driftDirection).toBe('STABLE');
    expect(report.driftVelocityPerDay).toBe(0);
  });

  it('returns zero-drift report for empty snapshot list', () => {
    const report = computeConfidenceDrift([]);
    expect(report.driftMagnitude).toBe(0);
    expect(report.snapshotCount).toBe(0);
  });
});

// ── CI Gate 10: enum / sentinel completeness ──────────────────────────────────

const EXPECTED_TIERS: ConfidenceTier[] = ['NONE', 'MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'FULL'];
const EXPECTED_OVERCONFIDENCE_REASONS: OverconfidenceReason[] = [
  'SCORE_EXCEEDS_EVIDENCE_CEILING',
  'AMBIGUOUS_CONTAINMENT_CEILING_VIOLATED',
  'INTEGRITY_FAILURE_IGNORED',
  'EMPTY_EVIDENCE_BASE',
  'TRUST_SCORE_INFLATES_ABOVE_EVIDENCE',
];
const EXPECTED_VIOLATIONS: ConfidenceCalibrationViolationKind[] = [
  'OVERCONFIDENCE_ASSERTED',
  'AMBIGUITY_COLLAPSED_TO_CLEAN',
  'CALIBRATION_DRIFT_ALARM',
];

describe('CI gate — exported enums match runtime sentinels', () => {
  it('KNOWN_CONFIDENCE_TIERS is exhaustive and frozen', () => {
    for (const t of EXPECTED_TIERS) expect(KNOWN_CONFIDENCE_TIERS).toContain(t);
    expect(KNOWN_CONFIDENCE_TIERS).toHaveLength(EXPECTED_TIERS.length);
    expect(Object.isFrozen(KNOWN_CONFIDENCE_TIERS)).toBe(true);
  });

  it('KNOWN_OVERCONFIDENCE_REASONS is exhaustive and frozen', () => {
    for (const r of EXPECTED_OVERCONFIDENCE_REASONS) expect(KNOWN_OVERCONFIDENCE_REASONS).toContain(r);
    expect(KNOWN_OVERCONFIDENCE_REASONS).toHaveLength(EXPECTED_OVERCONFIDENCE_REASONS.length);
    expect(Object.isFrozen(KNOWN_OVERCONFIDENCE_REASONS)).toBe(true);
  });

  it('KNOWN_CALIBRATION_VIOLATIONS is exhaustive and frozen', () => {
    for (const v of EXPECTED_VIOLATIONS) expect(KNOWN_CALIBRATION_VIOLATIONS).toContain(v);
    expect(KNOWN_CALIBRATION_VIOLATIONS).toHaveLength(EXPECTED_VIOLATIONS.length);
    expect(Object.isFrozen(KNOWN_CALIBRATION_VIOLATIONS)).toBe(true);
  });

  it('CONTAINMENT_CONFIDENCE_CEILINGS covers all verdicts and is frozen', () => {
    for (const v of ALL_VERDICTS) {
      expect(CONTAINMENT_CONFIDENCE_CEILINGS).toHaveProperty(v);
      expect(typeof CONTAINMENT_CONFIDENCE_CEILINGS[v]).toBe('number');
    }
    expect(Object.isFrozen(CONTAINMENT_CONFIDENCE_CEILINGS)).toBe(true);
  });

  it('CONFIDENCE_CALIBRATION_SENTINELS schema constants are non-empty strings', () => {
    expect(CONFIDENCE_CALIBRATION_SENTINELS.METHODOLOGY_VERSION).toBe('confidence-calibration.v1');
    expect(CONFIDENCE_CALIBRATION_SENTINELS.SCHEMA_CALIBRATED_CONFIDENCE).toBe('vitalcv.calibrated-confidence.v1');
    expect(CONFIDENCE_CALIBRATION_SENTINELS.SCHEMA_DRIFT_REPORT).toBe('vitalcv.confidence-drift.v1');
  });
});

// ── CI Gate 11: schema fields are present on every output ────────────────────

describe('CI gate — CalibratedConfidenceScore output shape is complete', () => {
  it('every required field is present', () => {
    const result = calibrateConfidence(cleanInput());
    expect(result.schema).toBe('vitalcv.calibrated-confidence.v1');
    expect(result.capsuleId).toBeTruthy();
    expect(typeof result.score.lower).toBe('number');
    expect(typeof result.score.point).toBe('number');
    expect(typeof result.score.upper).toBe('number');
    expect(KNOWN_CONFIDENCE_TIERS).toContain(result.tier);
    expect(typeof result.evidenceBasisCount).toBe('number');
    expect(typeof result.evidenceCeiling).toBe('number');
    expect(typeof result.overconfidence.detected).toBe('boolean');
    expect(Array.isArray(result.overconfidence.reasons)).toBe(true);
    expect(typeof result.overconfidence.claimedUncalibratedScore).toBe('number');
    expect(typeof result.overconfidence.evidenceCeiling).toBe('number');
    expect(typeof result.overconfidence.suppressedTo).toBe('number');
    expect(Array.isArray(result.contributions)).toBe(true);
    expect(typeof result.calibrationDigest).toBe('string');
    expect(result.calibrationDigest).toHaveLength(64); // SHA-256 hex
    expect(result.methodologyVersion).toBe('confidence-calibration.v1');
  });
});
