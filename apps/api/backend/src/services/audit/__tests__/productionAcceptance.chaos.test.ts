/**
 * Production Acceptance — Chaos Simulations (W2-PR134A)
 *
 * Adversarial acceptance scenarios. Each scenario attempts to push a
 * production bundle through acceptance via forged evidence, inflated scores,
 * or ambiguity suppression. Every case must be detected and suppressed.
 *
 * Scenarios:
 *   1. All evidence ABSENT — no score inflation allowed
 *   2. failClosed=false bypass attempt
 *   3. replaySafe=false bypass attempt
 *   4. Score exceeds evidence ceiling for each grade
 *   5. Ambiguous criteria inflate composite
 *   6. Mixed-grade inflation attempt
 *   7. Survivability FAIL still produces REJECTED
 *   8. Lineage chain break detection
 *   9. Replay hash mismatch produces MISMATCH verdict
 *  10. Telemetry overconfidence alarm fires at threshold
 */

import {
  scoreProductionAcceptance,
  type AcceptanceCriterionEvidence,
  type ProductionAcceptanceScoringInput,
} from '../productionAcceptanceScoring';
import {
  runInstitutionalSurvivabilityChecks,
  type SurvivabilityProbe,
} from '../institutionalSurvivability';
import {
  buildAcceptanceLineageManifest,
  verifyLineageChain,
  type AcceptanceLineageEntry,
} from '../acceptanceLineageManifest';
import {
  validateReplayProduction,
  type ProductionDecisionSnapshot,
  type ReplayedDecisionSnapshot,
} from '../replayProductionValidator';
import {
  generateProductionConfidenceTelemetry,
  TELEMETRY_SENTINELS,
  type ConfidenceDataPoint,
} from '../productionConfidenceTelemetry';

// ── helpers ───────────────────────────────────────────────────────────────────

function absentCriterion(id: string): AcceptanceCriterionEvidence {
  return {
    criterionId: id,
    dimension: 'INSTITUTIONAL_READINESS',
    evidenceGrade: 'ABSENT',
    evidenceSource: 'none',
    evidenceTimestamp: '2026-05-10T00:00:00.000Z',
    passingThreshold: 75,
    rawScore: 100,
    ambiguous: false,
    ambiguityReason: null,
    notes: null,
  };
}

function baseInput(overrides: Partial<ProductionAcceptanceScoringInput> = {}): ProductionAcceptanceScoringInput {
  return {
    deploymentId: 'deploy-chaos',
    bundleVersion: '0.0.1',
    institutionId: 'inst-chaos',
    criteria: [],
    replaySafe: true,
    failClosed: true,
    scoredAt: '2026-05-10T00:00:00.000Z',
    ...overrides,
  };
}

function probeFor(checkId: SurvivabilityProbe['checkId'], pass: boolean): SurvivabilityProbe {
  return {
    checkId,
    category: 'AUTH',
    simulatedCondition: 'degraded-auth',
    observedBehavior: pass ? 'deny-all' : 'allow-all',
    expectedBehavior: 'deny-all',
    failClosedVerified: pass,
    ambiguous: false,
    ambiguityReason: null,
    evidenceRef: null,
  };
}

// ── Chaos scenario 1 — all evidence ABSENT ────────────────────────────────────

describe('Chaos scenario 1 — all evidence ABSENT produces zero score', () => {
  it('composite score is 0 and verdict is REJECTED', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [
        absentCriterion('c1'),
        absentCriterion('c2'),
        absentCriterion('c3'),
      ],
    }));
    expect(result.compositeScore).toBe(0);
    expect(result.compositeVerdict).toBe('REJECTED');
  });
});

// ── Chaos scenario 2 — failClosed=false bypass ────────────────────────────────

describe('Chaos scenario 2 — failClosed=false bypass attempt', () => {
  it('REJECTED regardless of evidence quality', () => {
    const result = scoreProductionAcceptance(baseInput({
      failClosed: false,
      criteria: [{ criterionId: 'c1', dimension: 'INSTITUTIONAL_READINESS', evidenceGrade: 'HIGH',
        evidenceSource: 'NPPES', evidenceTimestamp: '2026-05-10T00:00:00.000Z',
        passingThreshold: 50, rawScore: 100, ambiguous: false, ambiguityReason: null, notes: null }],
    }));
    expect(result.compositeVerdict).toBe('REJECTED');
    expect(result.failClosedEnforced).toBe(false);
  });
});

// ── Chaos scenario 3 — replaySafe=false bypass ────────────────────────────────

describe('Chaos scenario 3 — replaySafe=false bypass attempt', () => {
  it('REJECTED even with perfect criteria', () => {
    const result = scoreProductionAcceptance(baseInput({
      replaySafe: false,
      criteria: [{ criterionId: 'c1', dimension: 'INSTITUTIONAL_READINESS', evidenceGrade: 'HIGH',
        evidenceSource: 'NPPES', evidenceTimestamp: '2026-05-10T00:00:00.000Z',
        passingThreshold: 50, rawScore: 100, ambiguous: false, ambiguityReason: null, notes: null }],
    }));
    expect(result.compositeVerdict).toBe('REJECTED');
    expect(result.compositeScore).toBe(0);
  });
});

// ── Chaos scenario 4 — score exceeds evidence ceiling ────────────────────────

describe('Chaos scenario 4 — rawScore exceeds evidence ceiling', () => {
  it('MEDIUM evidence caps at 75 even when rawScore=100', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [{
        criterionId: 'c1', dimension: 'INSTITUTIONAL_READINESS',
        evidenceGrade: 'MEDIUM', evidenceSource: 'NPPES',
        evidenceTimestamp: '2026-05-10T00:00:00.000Z',
        passingThreshold: 50, rawScore: 100, ambiguous: false,
        ambiguityReason: null, notes: null,
      }],
    }));
    const dim = result.dimensions.find(d => d.dimension === 'INSTITUTIONAL_READINESS');
    expect(dim?.score).toBeLessThanOrEqual(75);
  });

  it('LOW evidence caps at 45 even when rawScore=90', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [{
        criterionId: 'c1', dimension: 'INSTITUTIONAL_READINESS',
        evidenceGrade: 'LOW', evidenceSource: 'NPPES',
        evidenceTimestamp: '2026-05-10T00:00:00.000Z',
        passingThreshold: 40, rawScore: 90, ambiguous: false,
        ambiguityReason: null, notes: null,
      }],
    }));
    const dim = result.dimensions.find(d => d.dimension === 'INSTITUTIONAL_READINESS');
    expect(dim?.score).toBeLessThanOrEqual(45);
  });
});

// ── Chaos scenario 5 — ambiguous criteria inflation ──────────────────────────

describe('Chaos scenario 5 — ambiguous criteria attempt to inflate composite', () => {
  it('ambiguous criteria are capped at 60% of ceiling and counted separately', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [{
        criterionId: 'c1', dimension: 'INSTITUTIONAL_READINESS',
        evidenceGrade: 'HIGH', evidenceSource: 'NPPES',
        evidenceTimestamp: '2026-05-10T00:00:00.000Z',
        passingThreshold: 80, rawScore: 100,
        ambiguous: true, ambiguityReason: 'source unavailable', notes: null,
      }],
    }));
    const dim = result.dimensions.find(d => d.dimension === 'INSTITUTIONAL_READINESS');
    expect(dim?.ambiguousCriteria).toBe(1);
    expect(dim?.passingCriteria).toBe(0);
    // cap: 60% of HIGH (100) = 60
    expect(dim?.score).toBeLessThanOrEqual(60);
    expect(result.ambiguityPreserved).toBe(true);
  });
});

// ── Chaos scenario 6 — mixed-grade inflation attempt ─────────────────────────

describe('Chaos scenario 6 — mixed LOW and HIGH grade inflation', () => {
  it('composite does not exceed average of individual ceilings', () => {
    const result = scoreProductionAcceptance(baseInput({
      criteria: [
        { criterionId: 'c1', dimension: 'INSTITUTIONAL_READINESS', evidenceGrade: 'HIGH',
          evidenceSource: 'NPPES', evidenceTimestamp: '2026-05-10T00:00:00.000Z',
          passingThreshold: 50, rawScore: 100, ambiguous: false, ambiguityReason: null, notes: null },
        { criterionId: 'c2', dimension: 'INSTITUTIONAL_READINESS', evidenceGrade: 'LOW',
          evidenceSource: 'NPPES', evidenceTimestamp: '2026-05-10T00:00:00.000Z',
          passingThreshold: 30, rawScore: 100, ambiguous: false, ambiguityReason: null, notes: null },
      ],
    }));
    const dim = result.dimensions.find(d => d.dimension === 'INSTITUTIONAL_READINESS');
    // Average ceiling = (100 + 45) / 2 = 72.5 → 72
    expect(dim?.score).toBeLessThanOrEqual(73);
  });
});

// ── Chaos scenario 7 — survivability FAIL ────────────────────────────────────

describe('Chaos scenario 7 — all survivability checks FAIL', () => {
  it('overallOutcome is FAIL and all checks show remediationRequired', () => {
    const report = runInstitutionalSurvivabilityChecks({
      deploymentId: 'deploy-chaos',
      institutionId: 'inst-chaos',
      probes: [
        probeFor('AUTH_DEGRADED_FAIL_CLOSED', false),
        probeFor('REPLAY_STORE_UNAVAILABLE', false),
        probeFor('TENANT_ISOLATION_BOUNDARY', false),
      ],
      checkedAt: '2026-05-10T00:00:00.000Z',
    });
    expect(report.overallOutcome).toBe('FAIL');
    expect(report.summary.failing).toBe(3);
    expect(report.summary.deploymentSurvivabilityPercent).toBe(0);
    expect(report.checks.every(c => c.remediationRequired)).toBe(true);
  });
});

// ── Chaos scenario 8 — lineage chain break detection ─────────────────────────

describe('Chaos scenario 8 — lineage chain break is detected', () => {
  it('verifyLineageChain returns intact=false when a stored entry hash is tampered', () => {
    const scoringResult = scoreProductionAcceptance(baseInput({
      criteria: [{ criterionId: 'c1', dimension: 'INSTITUTIONAL_READINESS',
        evidenceGrade: 'HIGH', evidenceSource: 'NPPES',
        evidenceTimestamp: '2026-05-10T00:00:00.000Z',
        passingThreshold: 50, rawScore: 80, ambiguous: false,
        ambiguityReason: null, notes: null }],
    }));
    const entries: AcceptanceLineageEntry[] = [
      {
        entryId: 'e1', deploymentId: 'deploy-chaos', institutionId: 'inst-chaos',
        entryClass: 'INITIAL_ACCEPTANCE', scoringResult,
        signOffRole: 'SYSTEM_AUTO', signOffActorId: 'system',
        priorManifestHash: null, ambiguityFlags: [],
        operationalNotes: null, entryTimestamp: '2026-05-10T00:00:00.000Z',
      },
      {
        entryId: 'e2', deploymentId: 'deploy-chaos', institutionId: 'inst-chaos',
        entryClass: 'RE_ACCEPTANCE', scoringResult,
        signOffRole: 'SYSTEM_AUTO', signOffActorId: 'system',
        priorManifestHash: null,
        ambiguityFlags: [], operationalNotes: null,
        entryTimestamp: '2026-05-10T01:00:00.000Z',
      },
    ];
    const manifest = buildAcceptanceLineageManifest(entries, '2026-05-10T02:00:00.000Z');
    // Simulate post-build tampering: overwrite the first entry's hash
    const tampered = {
      ...manifest,
      entries: [
        { ...manifest.entries[0], thisManifestHash: 'FORGED_HASH' },
        manifest.entries[1],
      ],
    };
    const check = verifyLineageChain(tampered);
    expect(check.intact).toBe(false);
    expect(check.brokenAt).toBe(1);
    // Original manifest is intact
    expect(verifyLineageChain(manifest).intact).toBe(true);
  });
});

// ── Chaos scenario 9 — replay hash mismatch ──────────────────────────────────

describe('Chaos scenario 9 — replay integrity hash mismatch produces MISMATCH', () => {
  it('validates as MISMATCH when integrity hashes differ', () => {
    const prod: ProductionDecisionSnapshot = {
      capsuleId: 'cap-1',
      evidenceCount: 3,
      trustScore: 85,
      authorityChainLength: 4,
      integrityHash: 'aabbccdd',
      sourceOutcomes: ['NPPES:VERIFIED', 'STATE_BOARD:VERIFIED'],
      decisionAction: 'accept',
      containmentVerdict: 'CLEAN',
      decisionTimestamp: '2026-05-10T00:00:00.000Z',
    };
    const replay: ReplayedDecisionSnapshot = {
      ...prod,
      integrityHash: 'FORGED_HASH',
      replayTimestamp: '2026-05-10T01:00:00.000Z',
      replayEngineVersion: '1.0',
    };
    const result = validateReplayProduction(prod, replay, '2026-05-10T01:00:00.000Z');
    expect(result.verdict).toBe('MISMATCH');
    expect(result.materialDriftCount).toBeGreaterThan(0);
    expect(result.replayFidelityPercent).toBeLessThan(100);
  });
});

// ── Chaos scenario 10 — telemetry overconfidence alarm ───────────────────────

describe('Chaos scenario 10 — overconfidence alarm fires at threshold', () => {
  it('alarm active after OVERCONFIDENCE_ALARM_THRESHOLD overconfidence episodes', () => {
    const threshold = TELEMETRY_SENTINELS.OVERCONFIDENCE_ALARM_THRESHOLD;

    function makePoint(i: number, overconfident: boolean): ConfidenceDataPoint {
      return {
        deploymentId: 'deploy-chaos',
        snapshotId: `snap-${i}`,
        compositeScore: overconfident ? 110 : 80,
        evidenceCeiling: 100,
        compositeVerdict: 'ACCEPTED',
        replayFidelityPercent: 95,
        survivabilityPercent: 90,
        overconfidenceDetected: overconfident,
        overconfidenceReason: overconfident ? 'Score exceeds ceiling' : null,
        ambiguous: false,
        capturedAt: new Date(2026, 4, 10, i).toISOString(),
      };
    }

    const points = Array.from({ length: threshold }, (_, i) => makePoint(i, true));

    const report = generateProductionConfidenceTelemetry(
      {
        institutionId: 'inst-chaos',
        dataPoints: points,
        windowStart: '2026-05-10T00:00:00.000Z',
        windowEnd:   '2026-05-10T12:00:00.000Z',
      },
      '2026-05-10T12:00:00.000Z',
    );
    expect(report.overconfidenceAlarmActive).toBe(true);
    expect(report.confidenceIntegrityPercent).toBe(0);
  });

  it('alarm NOT active below threshold', () => {
    const threshold = TELEMETRY_SENTINELS.OVERCONFIDENCE_ALARM_THRESHOLD;
    const points: ConfidenceDataPoint[] = Array.from(
      { length: threshold - 1 },
      (_, i) => ({
        deploymentId: 'deploy-ok',
        snapshotId: `snap-${i}`,
        compositeScore: 110,
        evidenceCeiling: 100,
        compositeVerdict: 'ACCEPTED' as const,
        replayFidelityPercent: 95,
        survivabilityPercent: 90,
        overconfidenceDetected: true,
        overconfidenceReason: 'excess',
        ambiguous: false,
        capturedAt: new Date(2026, 4, 10, i).toISOString(),
      }),
    );
    const report = generateProductionConfidenceTelemetry(
      {
        institutionId: 'inst-ok',
        dataPoints: points,
        windowStart: '2026-05-10T00:00:00.000Z',
        windowEnd:   '2026-05-10T12:00:00.000Z',
      },
      '2026-05-10T12:00:00.000Z',
    );
    expect(report.overconfidenceAlarmActive).toBe(false);
  });
});
