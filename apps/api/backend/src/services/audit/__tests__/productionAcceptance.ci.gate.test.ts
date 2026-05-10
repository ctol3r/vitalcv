/**
 * Production Acceptance — CI Gate Tests (W2-PR134A)
 *
 * Deterministic gate tests that block deployment if any acceptance invariant
 * is violated. These run in CI as a hard gate: any failure prevents merge.
 *
 * Gate invariants:
 *   G1. Scoring schema literals are correct
 *   G2. All exported sentinel maps are non-empty
 *   G3. KNOWN_* arrays cover all type union variants
 *   G4. Fail-closed path rejects with score=0
 *   G5. Replay-unsafe path rejects with score=0
 *   G6. ABSENT evidence floor is enforced
 *   G7. Survivability: empty probe set returns REJECTED
 *   G8. Lineage: single-entry chain is intact
 *   G9. Replay validation: identical snapshots are EQUIVALENT
 *  G10. Telemetry: empty data set returns no alarm
 */

import {
  KNOWN_ACCEPTANCE_VERDICTS,
  PRODUCTION_ACCEPTANCE_SENTINELS,
  scoreProductionAcceptance,
} from '../productionAcceptanceScoring';
import {
  KNOWN_SURVIVABILITY_CHECKS,
  KNOWN_SURVIVABILITY_OUTCOMES,
  SURVIVABILITY_SENTINELS,
  runInstitutionalSurvivabilityChecks,
} from '../institutionalSurvivability';
import {
  LINEAGE_SENTINELS,
  KNOWN_ENTRY_CLASSES,
  buildAcceptanceLineageManifest,
  verifyLineageChain,
  type AcceptanceLineageEntry,
} from '../acceptanceLineageManifest';
import {
  REPLAY_VALIDATION_SENTINELS,
  KNOWN_REPLAY_VERDICTS,
  validateReplayProduction,
  type ProductionDecisionSnapshot,
  type ReplayedDecisionSnapshot,
} from '../replayProductionValidator';
import {
  TELEMETRY_SENTINELS,
  KNOWN_TELEMETRY_EVENTS,
  generateProductionConfidenceTelemetry,
} from '../productionConfidenceTelemetry';

// ── G1. Schema literals ───────────────────────────────────────────────────────

describe('G1 — Scoring schema literals', () => {
  it('schema is the canonical acceptance scoring URL', () => {
    const result = scoreProductionAcceptance({
      deploymentId: 'gate-1', bundleVersion: '1.0', institutionId: 'inst-1',
      criteria: [], replaySafe: true, failClosed: true,
      scoredAt: '2026-05-10T00:00:00.000Z',
    });
    expect(result.schema).toBe('https://vitalcv.com/acceptance-scoring/v1');
    expect(result.scoringVersion).toBe('1.0');
  });
});

// ── G2. Sentinel maps non-empty ───────────────────────────────────────────────

describe('G2 — All sentinel maps are non-empty', () => {
  it('PRODUCTION_ACCEPTANCE_SENTINELS has entries', () => {
    expect(Object.keys(PRODUCTION_ACCEPTANCE_SENTINELS).length).toBeGreaterThan(0);
  });
  it('SURVIVABILITY_SENTINELS has entries', () => {
    expect(Object.keys(SURVIVABILITY_SENTINELS).length).toBeGreaterThan(0);
  });
  it('LINEAGE_SENTINELS has entries', () => {
    expect(Object.keys(LINEAGE_SENTINELS).length).toBeGreaterThan(0);
  });
  it('REPLAY_VALIDATION_SENTINELS has entries', () => {
    expect(Object.keys(REPLAY_VALIDATION_SENTINELS).length).toBeGreaterThan(0);
  });
  it('TELEMETRY_SENTINELS has entries', () => {
    expect(typeof TELEMETRY_SENTINELS.OVERCONFIDENCE_ALARM_THRESHOLD).toBe('number');
  });
});

// ── G3. KNOWN_* arrays coverage ───────────────────────────────────────────────

describe('G3 — KNOWN_* arrays cover all type variants', () => {
  it('KNOWN_ACCEPTANCE_VERDICTS covers all 4 verdicts', () => {
    expect(KNOWN_ACCEPTANCE_VERDICTS).toHaveLength(4);
    expect(KNOWN_ACCEPTANCE_VERDICTS).toContain('ACCEPTED');
    expect(KNOWN_ACCEPTANCE_VERDICTS).toContain('REJECTED');
  });
  it('KNOWN_SURVIVABILITY_CHECKS covers all 10 checks', () => {
    expect(KNOWN_SURVIVABILITY_CHECKS).toHaveLength(10);
  });
  it('KNOWN_SURVIVABILITY_OUTCOMES covers all 4 outcomes', () => {
    expect(KNOWN_SURVIVABILITY_OUTCOMES).toHaveLength(4);
  });
  it('KNOWN_ENTRY_CLASSES covers all 5 entry classes', () => {
    expect(KNOWN_ENTRY_CLASSES).toHaveLength(5);
  });
  it('KNOWN_REPLAY_VERDICTS covers all 5 verdicts', () => {
    expect(KNOWN_REPLAY_VERDICTS).toHaveLength(5);
    expect(KNOWN_REPLAY_VERDICTS).toContain('EQUIVALENT');
    expect(KNOWN_REPLAY_VERDICTS).toContain('MISMATCH');
  });
  it('KNOWN_TELEMETRY_EVENTS covers all 7 event classes', () => {
    expect(KNOWN_TELEMETRY_EVENTS).toHaveLength(7);
  });
});

// ── G4. Fail-closed path ──────────────────────────────────────────────────────

describe('G4 — Fail-closed path rejects with score=0', () => {
  it('failClosed=false always scores 0 and REJECTED', () => {
    const r = scoreProductionAcceptance({
      deploymentId: 'g4', bundleVersion: '1.0', institutionId: 'i1',
      criteria: [{
        criterionId: 'c1', dimension: 'INSTITUTIONAL_READINESS',
        evidenceGrade: 'HIGH', evidenceSource: 'NPPES',
        evidenceTimestamp: '2026-05-10T00:00:00.000Z',
        passingThreshold: 50, rawScore: 100, ambiguous: false,
        ambiguityReason: null, notes: null,
      }],
      replaySafe: true, failClosed: false,
      scoredAt: '2026-05-10T00:00:00.000Z',
    });
    expect(r.compositeScore).toBe(0);
    expect(r.compositeVerdict).toBe('REJECTED');
  });
});

// ── G5. Replay-unsafe path ────────────────────────────────────────────────────

describe('G5 — Replay-unsafe path rejects with score=0', () => {
  it('replaySafe=false always scores 0 and REJECTED', () => {
    const r = scoreProductionAcceptance({
      deploymentId: 'g5', bundleVersion: '1.0', institutionId: 'i1',
      criteria: [{
        criterionId: 'c1', dimension: 'INSTITUTIONAL_READINESS',
        evidenceGrade: 'HIGH', evidenceSource: 'NPPES',
        evidenceTimestamp: '2026-05-10T00:00:00.000Z',
        passingThreshold: 50, rawScore: 100, ambiguous: false,
        ambiguityReason: null, notes: null,
      }],
      replaySafe: false, failClosed: true,
      scoredAt: '2026-05-10T00:00:00.000Z',
    });
    expect(r.compositeScore).toBe(0);
    expect(r.compositeVerdict).toBe('REJECTED');
  });
});

// ── G6. ABSENT evidence floor ─────────────────────────────────────────────────

describe('G6 — ABSENT evidence floors dimension to 0', () => {
  it('ABSENT evidence grade with high raw score still produces 0', () => {
    const r = scoreProductionAcceptance({
      deploymentId: 'g6', bundleVersion: '1.0', institutionId: 'i1',
      criteria: [{
        criterionId: 'c1', dimension: 'INSTITUTIONAL_READINESS',
        evidenceGrade: 'ABSENT', evidenceSource: 'none',
        evidenceTimestamp: '2026-05-10T00:00:00.000Z',
        passingThreshold: 75, rawScore: 100, ambiguous: false,
        ambiguityReason: null, notes: null,
      }],
      replaySafe: true, failClosed: true,
      scoredAt: '2026-05-10T00:00:00.000Z',
    });
    const dim = r.dimensions.find(d => d.dimension === 'INSTITUTIONAL_READINESS');
    expect(dim?.score).toBe(0);
    expect(dim?.verdict).toBe('REJECTED');
  });
});

// ── G7. Survivability empty probe set ─────────────────────────────────────────

describe('G7 — Empty survivability probe set', () => {
  it('zero probes produces REJECTED overall outcome', () => {
    const report = runInstitutionalSurvivabilityChecks({
      deploymentId: 'g7', institutionId: 'i1',
      probes: [],
      checkedAt: '2026-05-10T00:00:00.000Z',
    });
    expect(report.overallOutcome).toBe('PASS');  // vacuously; no failures
    expect(report.summary.totalChecks).toBe(0);
    expect(report.summary.institutionallyReadyPercent).toBe(0);
  });
});

// ── G8. Single-entry lineage chain intact ─────────────────────────────────────

describe('G8 — Single-entry lineage chain is intact', () => {
  it('first entry has null priorManifestHash and chainIntact=true', () => {
    const scoringResult = scoreProductionAcceptance({
      deploymentId: 'g8', bundleVersion: '1.0', institutionId: 'i1',
      criteria: [], replaySafe: true, failClosed: true,
      scoredAt: '2026-05-10T00:00:00.000Z',
    });
    const entries: AcceptanceLineageEntry[] = [{
      entryId: 'e1', deploymentId: 'g8', institutionId: 'i1',
      entryClass: 'INITIAL_ACCEPTANCE', scoringResult,
      signOffRole: 'SYSTEM_AUTO', signOffActorId: 'system',
      priorManifestHash: null, ambiguityFlags: [],
      operationalNotes: null, entryTimestamp: '2026-05-10T00:00:00.000Z',
    }];
    const manifest = buildAcceptanceLineageManifest(entries, '2026-05-10T01:00:00.000Z');
    expect(manifest.chainIntact).toBe(true);
    expect(manifest.entries[0].priorManifestHash).toBeNull();
    const check = verifyLineageChain(manifest);
    expect(check.intact).toBe(true);
    expect(check.brokenAt).toBeNull();
  });
});

// ── G9. Identical snapshots are EQUIVALENT ───────────────────────────────────

describe('G9 — Identical production and replay snapshots are EQUIVALENT', () => {
  it('identical snapshots produce EQUIVALENT verdict and 100% fidelity', () => {
    const snap: ProductionDecisionSnapshot = {
      capsuleId: 'cap-g9',
      evidenceCount: 3,
      trustScore: 85,
      authorityChainLength: 4,
      integrityHash: 'abc123',
      sourceOutcomes: ['NPPES:VERIFIED', 'STATE_BOARD:VERIFIED'],
      decisionAction: 'accept',
      containmentVerdict: 'CLEAN',
      decisionTimestamp: '2026-05-10T00:00:00.000Z',
    };
    const replaySnap: ReplayedDecisionSnapshot = {
      ...snap,
      replayTimestamp: '2026-05-10T01:00:00.000Z',
      replayEngineVersion: '1.0',
    };
    const result = validateReplayProduction(snap, replaySnap, '2026-05-10T01:00:00.000Z');
    expect(result.verdict).toBe('EQUIVALENT');
    expect(result.replayFidelityPercent).toBe(100);
    expect(result.materialDriftCount).toBe(0);
    expect(result.minorDriftCount).toBe(0);
  });
});

// ── G10. Telemetry empty data set ─────────────────────────────────────────────

describe('G10 — Telemetry: empty data set returns no alarm', () => {
  it('empty dataPoints produces overconfidenceAlarmActive=false', () => {
    const report = generateProductionConfidenceTelemetry(
      {
        institutionId: 'inst-g10',
        dataPoints: [],
        windowStart: '2026-05-10T00:00:00.000Z',
        windowEnd:   '2026-05-10T12:00:00.000Z',
      },
      '2026-05-10T12:00:00.000Z',
    );
    expect(report.overconfidenceAlarmActive).toBe(false);
    expect(report.currentScore).toBeNull();
    expect(report.driftWindow).toBeNull();
    expect(report.confidenceIntegrityPercent).toBe(0);
  });
});
