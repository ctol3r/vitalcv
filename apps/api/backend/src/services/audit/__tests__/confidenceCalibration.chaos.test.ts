/**
 * Confidence Calibration — Chaos Simulations (W2-PR130A)
 *
 * Adversarial test suite. Each scenario attempts to inflate production
 * confidence beyond what replay evidence supports. Every case must be detected
 * and suppressed — no silent overconfidence may survive this battery.
 *
 * Scenarios:
 *   1. Empty evidence base with high trust score
 *   2. AMBIGUOUS containment + high trust score
 *   3. QUARANTINED replay with forged clean sources
 *   4. CONTAINMENT_BREACH → floor to zero
 *   5. Single-source inflation attempt
 *   6. Evidence spine drift with passing integrity claim
 *   7. Low-quality sources (all LOW confidence) attempt to reach HIGH tier
 *   8. All sources EXPIRED or FAILED → no evidence
 *   9. Contradictory integrity signals (hashMatch=true, tamper present)
 *  10. Longitudinal drift: overconfidence episode accumulation alarm
 */

import {
  CONFIDENCE_CALIBRATION_SENTINELS,
  CONTAINMENT_CONFIDENCE_CEILINGS,
  KNOWN_CALIBRATION_VIOLATIONS,
  KNOWN_CONFIDENCE_TIERS,
  KNOWN_OVERCONFIDENCE_REASONS,
  calibrateConfidence,
  computeConfidenceDrift,
  syncReplayConfidence,
  type CalibrationInput,
  type ConfidenceDriftSnapshot,
} from '../confidenceCalibration';

// ── helpers ───────────────────────────────────────────────────────────────────

function highTrustInput(overrides: Partial<CalibrationInput> = {}): CalibrationInput {
  return {
    capsuleId:          'cap-chaos-1',
    sourcesConsulted: [
      { source: 'NPPES',      outcome: 'VERIFIED', confidence: 'HIGH' },
      { source: 'STATE_BOARD', outcome: 'VERIFIED', confidence: 'HIGH' },
      { source: 'OIG_LEIE',   outcome: 'VERIFIED', confidence: 'HIGH' },
    ],
    trustScore:           95,
    integrityHashMatch:   true,
    tamperEvidence:       null,
    containmentVerdict:   'CLEAN',
    ambiguous:            false,
    ...overrides,
  };
}

function snapshot(
  pointScore: number,
  evidenceCeiling: number,
  overconfidenceDetected: boolean,
  isoOffset: number,
): ConfidenceDriftSnapshot {
  return {
    capsuleId: `cap-drift-${isoOffset}`,
    pointScore,
    evidenceCeiling,
    overconfidenceDetected,
    calibratedAt: new Date(Date.now() + isoOffset * 86_400_000).toISOString(),
  };
}

// ── chaos scenarios ───────────────────────────────────────────────────────────

describe('Chaos scenario 1 — empty evidence base with high trust score', () => {
  it('floors confidence to NONE tier and flags overconfidence', () => {
    const result = calibrateConfidence(highTrustInput({
      sourcesConsulted: [],
      trustScore: 95,
      containmentVerdict: 'CLEAN',
    }));

    expect(result.evidenceBasisCount).toBe(0);
    expect(result.score.point).toBe(0);
    expect(result.tier).toBe('NONE');
    // trust score of 95 with zero evidence is classic overconfidence
    expect(result.overconfidence.detected).toBe(true);
    expect(result.overconfidence.reasons).toContain('SCORE_EXCEEDS_EVIDENCE_CEILING');
  });
});

describe('Chaos scenario 2 — AMBIGUOUS containment + high trust score', () => {
  it('caps score at 0.5 and flags ambiguous ceiling violation', () => {
    const result = calibrateConfidence(highTrustInput({
      containmentVerdict: 'AMBIGUOUS',
      ambiguous: true,
      trustScore: 90,
    }));

    expect(result.score.point).toBeLessThanOrEqual(CONTAINMENT_CONFIDENCE_CEILINGS.AMBIGUOUS);
    expect(result.tier).not.toBe('HIGH');
    expect(result.tier).not.toBe('FULL');
    expect(result.overconfidence.detected).toBe(true);
    expect(result.overconfidence.reasons).toContain('AMBIGUOUS_CONTAINMENT_CEILING_VIOLATED');
    // upper bound must also respect ambiguous ceiling
    expect(result.score.upper).toBeLessThanOrEqual(CONTAINMENT_CONFIDENCE_CEILINGS.AMBIGUOUS + 0.001);
  });
});

describe('Chaos scenario 3 — QUARANTINED replay, all sources forged VERIFIED', () => {
  it('hard-caps score at QUARANTINED ceiling regardless of source verdicts', () => {
    const result = calibrateConfidence(highTrustInput({
      containmentVerdict: 'QUARANTINED',
      ambiguous: false,
      trustScore: 80,
    }));

    const ceiling = CONTAINMENT_CONFIDENCE_CEILINGS.QUARANTINED;
    expect(result.score.point).toBeLessThanOrEqual(ceiling);
    expect(result.evidenceCeiling).toBeLessThanOrEqual(ceiling);
    expect(result.tier).not.toBe('HIGH');
    expect(result.tier).not.toBe('FULL');
    expect(result.tier).not.toBe('MEDIUM');
  });
});

describe('Chaos scenario 4 — CONTAINMENT_BREACH floors to zero', () => {
  it('forces point score to 0 and tier to NONE', () => {
    const result = calibrateConfidence(highTrustInput({
      containmentVerdict: 'CONTAINMENT_BREACH',
      ambiguous: false,
    }));

    expect(result.score.point).toBe(0);
    expect(result.score.upper).toBe(0);
    expect(result.tier).toBe('NONE');
    expect(result.evidenceCeiling).toBe(0);
  });
});

describe('Chaos scenario 5 — single-source breadth inflation attempt', () => {
  it('cannot reach FULL tier with only one verified source', () => {
    const result = calibrateConfidence(highTrustInput({
      sourcesConsulted: [{ source: 'NPPES', outcome: 'VERIFIED', confidence: 'HIGH' }],
      trustScore: 100,
      containmentVerdict: 'CLEAN',
    }));

    // Breadth ceiling for 1 verified source = 0.60 → at most HIGH-boundary
    expect(result.score.point).toBeLessThanOrEqual(0.60 + 0.001);
    expect(result.tier).not.toBe('FULL');
  });
});

describe('Chaos scenario 6 — evidence spine drift with passing hash claim', () => {
  it('degrades confidence to near-floor when evidence spine drifted', () => {
    const result = calibrateConfidence(highTrustInput({
      integrityHashMatch:  true,
      tamperEvidence:      null,
      evidenceSpineDrifted: true,
      containmentVerdict:  'CLEAN',
    }));

    // integrity multiplier for spine drift = 0.20 → drastically deflates score
    expect(result.score.point).toBeLessThan(0.25);
  });
});

describe('Chaos scenario 7 — all sources LOW confidence attempting HIGH tier', () => {
  it('caps maximum achievable score at LOW-source ceiling', () => {
    const result = calibrateConfidence(highTrustInput({
      sourcesConsulted: Array.from({ length: 8 }, (_, i) => ({
        source:     `source-${i}`,
        outcome:    'VERIFIED' as const,
        confidence: 'LOW' as const,
      })),
      trustScore: 100,
      containmentVerdict: 'CLEAN',
    }));

    // All LOW sources → per-source weight = 0.4. Even with 8 sources the
    // normalized score cannot exceed the breadth ceiling (0.95) × LOW weight
    // (0.4) = 0.38 theoretical max contribution. Score stays in LOW tier.
    expect(result.score.point).toBeLessThanOrEqual(0.50);
    expect(result.tier).not.toBe('HIGH');
    expect(result.tier).not.toBe('FULL');
  });
});

describe('Chaos scenario 8 — all sources EXPIRED or FAILED', () => {
  it('produces zero evidence basis and NONE tier regardless of trust score', () => {
    const result = calibrateConfidence(highTrustInput({
      sourcesConsulted: [
        { source: 'NPPES',      outcome: 'EXPIRED', confidence: 'HIGH' },
        { source: 'STATE_BOARD', outcome: 'FAILED',  confidence: 'HIGH' },
        { source: 'OIG_LEIE',   outcome: 'NOT_FOUND', confidence: 'MEDIUM' },
      ],
      trustScore: 88,
      containmentVerdict: 'CLEAN',
    }));

    expect(result.evidenceBasisCount).toBe(0);
    expect(result.score.point).toBe(0);
    expect(result.tier).toBe('NONE');
  });
});

describe('Chaos scenario 9 — contradictory integrity signals (hashMatch=true, tamper set)', () => {
  it('applies degraded integrity multiplier and preserves ambiguity in interval', () => {
    const result = calibrateConfidence(highTrustInput({
      integrityHashMatch: true,
      tamperEvidence:     'Unexpected tamper annotation despite hash match',
      containmentVerdict: 'CLEAN',
      ambiguous:          false,
    }));

    // Integrity multiplier = 0.60 for contradictory signals
    const baseExpected = 0.95 * 0.60; // breadthCeiling * iMult (approx)
    expect(result.score.point).toBeLessThanOrEqual(baseExpected + 0.05);
    // interval should be wider than a clean signal
    const width = result.score.upper - result.score.lower;
    expect(width).toBeGreaterThan(0.02);
  });
});

describe('Chaos scenario 10 — longitudinal overconfidence episode accumulation', () => {
  it('reports correct overconfidence episode count and drift direction', () => {
    const snapshots: ConfidenceDriftSnapshot[] = [
      snapshot(0.30, 0.60, false, 0),
      snapshot(0.50, 0.60, true,  1),  // overconfident
      snapshot(0.55, 0.60, true,  2),  // overconfident
      snapshot(0.40, 0.60, false, 3),
      snapshot(0.45, 0.60, true,  4),  // overconfident
    ];

    const report = computeConfidenceDrift(snapshots);
    expect(report.overconfidenceEpisodes).toBe(3);
    expect(report.snapshotCount).toBe(5);
    expect(report.driftMagnitude).toBeCloseTo(0.55 - 0.30, 4);
    // net change: 0.45 - 0.30 = +0.15 → INCREASING
    expect(report.driftDirection).toBe('INCREASING');
    // All snapshots are under or at ceiling → positive margin
    expect(report.averageCalibrationMargin).toBeGreaterThanOrEqual(0);
  });

  it('reports DECREASING drift for a declining score series', () => {
    const snapshots = [
      snapshot(0.80, 0.95, false, 0),
      snapshot(0.70, 0.95, false, 1),
      snapshot(0.55, 0.95, false, 2),
      snapshot(0.40, 0.95, false, 3),
    ];
    const report = computeConfidenceDrift(snapshots);
    expect(report.driftDirection).toBe('DECREASING');
  });

  it('stability is lower when scores vary wildly', () => {
    const volatile = [
      snapshot(0.10, 0.95, false, 0),
      snapshot(0.90, 0.95, false, 1),
      snapshot(0.10, 0.95, false, 2),
      snapshot(0.90, 0.95, false, 3),
    ];
    const stable = [
      snapshot(0.50, 0.95, false, 0),
      snapshot(0.51, 0.95, false, 1),
      snapshot(0.50, 0.95, false, 2),
      snapshot(0.51, 0.95, false, 3),
    ];
    const volatileReport = computeConfidenceDrift(volatile);
    const stableReport   = computeConfidenceDrift(stable);
    expect(volatileReport.calibrationStability).toBeLessThan(stableReport.calibrationStability);
  });
});

describe('Chaos scenario 11 — syncReplayConfidence matches calibrateConfidence output', () => {
  it('produces identical point score when given the same inputs', () => {
    const baseInput = highTrustInput();
    const direct = calibrateConfidence(baseInput);
    const synced = syncReplayConfidence({
      capsuleId:           baseInput.capsuleId,
      sourcesConsulted:    baseInput.sourcesConsulted,
      trustScore:          baseInput.trustScore,
      integrityHashMatch:  baseInput.integrityHashMatch,
      tamperEvidence:      baseInput.tamperEvidence,
      evidenceSpineDrifted: baseInput.evidenceSpineDrifted,
      containmentVerdict:  baseInput.containmentVerdict,
      ambiguous:           baseInput.ambiguous,
    });
    // Same deterministic calibrationDigest → same score
    expect(synced.calibrationDigest).toBe(direct.calibrationDigest);
    expect(synced.score.point).toBe(direct.score.point);
  });
});

describe('Chaos scenario 12 — CONTAMINATED verdict restricts score', () => {
  it('caps score at CONTAMINATED ceiling (0.2)', () => {
    const result = calibrateConfidence(highTrustInput({
      containmentVerdict: 'CONTAMINATED',
      ambiguous: false,
    }));
    expect(result.score.point).toBeLessThanOrEqual(CONTAINMENT_CONFIDENCE_CEILINGS.CONTAMINATED + 0.001);
    expect(result.evidenceCeiling).toBeLessThanOrEqual(CONTAINMENT_CONFIDENCE_CEILINGS.CONTAMINATED + 0.001);
  });
});

describe('Chaos scenario 13 — calibration digest is deterministic', () => {
  it('identical inputs produce identical digest on repeated calls', () => {
    const input = highTrustInput();
    const a = calibrateConfidence(input);
    const b = calibrateConfidence(input);
    expect(a.calibrationDigest).toBe(b.calibrationDigest);
  });

  it('different containment verdicts produce different digests', () => {
    const a = calibrateConfidence(highTrustInput({ containmentVerdict: 'CLEAN' }));
    const b = calibrateConfidence(highTrustInput({ containmentVerdict: 'QUARANTINED' }));
    expect(a.calibrationDigest).not.toBe(b.calibrationDigest);
  });
});

describe('Chaos scenario 14 — known sentinel / enum completeness', () => {
  it('KNOWN_CONFIDENCE_TIERS covers all ConfidenceTier values', () => {
    const expected = ['NONE', 'MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'FULL'];
    for (const t of expected) expect(KNOWN_CONFIDENCE_TIERS).toContain(t);
    expect(KNOWN_CONFIDENCE_TIERS).toHaveLength(expected.length);
    expect(Object.isFrozen(KNOWN_CONFIDENCE_TIERS)).toBe(true);
  });

  it('KNOWN_OVERCONFIDENCE_REASONS covers all OverconfidenceReason values', () => {
    const expected = [
      'SCORE_EXCEEDS_EVIDENCE_CEILING',
      'AMBIGUOUS_CONTAINMENT_CEILING_VIOLATED',
      'INTEGRITY_FAILURE_IGNORED',
      'EMPTY_EVIDENCE_BASE',
      'TRUST_SCORE_INFLATES_ABOVE_EVIDENCE',
    ];
    for (const r of expected) expect(KNOWN_OVERCONFIDENCE_REASONS).toContain(r);
    expect(KNOWN_OVERCONFIDENCE_REASONS).toHaveLength(expected.length);
  });

  it('KNOWN_CALIBRATION_VIOLATIONS covers all ConfidenceCalibrationViolationKind values', () => {
    const expected = [
      'OVERCONFIDENCE_ASSERTED',
      'AMBIGUITY_COLLAPSED_TO_CLEAN',
      'CALIBRATION_DRIFT_ALARM',
    ];
    for (const v of expected) expect(KNOWN_CALIBRATION_VIOLATIONS).toContain(v);
    expect(KNOWN_CALIBRATION_VIOLATIONS).toHaveLength(expected.length);
  });

  it('CONFIDENCE_CALIBRATION_SENTINELS is frozen', () => {
    expect(Object.isFrozen(CONFIDENCE_CALIBRATION_SENTINELS)).toBe(true);
  });
});
