/**
 * institutionalCovenant.ci.gate.test.ts — W2-PR157A CI Gate
 *
 * Blocks CI if the Covenant Finalization Board metrics fall below the
 * production threshold (80%). Every check must be evidence-derived;
 * no operator assertion may satisfy a gate.
 *
 * This file runs in the covenant-finalization-gate.yml workflow as
 * the final merge blocker for wave W2-PR157A and all subsequent waves
 * that touch the covenant runtime.
 *
 * Threshold: 80% across all five board metrics.
 * Rationale: 80% is the minimum that demonstrates all six covenants are
 * locked, at least four of six pass a real runtime signal, and the maturity
 * floor is above the pilot-launch acceptance bar.
 */

import {
  evaluateAllCovenantCompliance,
  evaluateCovenantGate,
  lockAllCovenants,
  buildCovenantLineage,
  runCovenantChaosSimulations,
  CANONICAL_COVENANTS,
  type CovenantRuntimeSignal,
} from '../institutionalCovenant';
import {
  deriveCovenantBoardMetrics,
  buildCovenantObservabilityReport,
  assertCovenantMaturityThreshold,
} from '../covenantObservability';

const CI_THRESHOLD_PCT = 80;

const CANONICAL_SIGNAL: CovenantRuntimeSignal = {
  replayFaithful: true,
  ambiguityPreserved: true,
  failClosedUnderUncertainty: true,
  tenantIsolationHeld: true,
  lineageReconstructable: true,
  survivabilityFloorHeld: true,
};

describe('W2-PR157A — Covenant Finalization CI Gate', () => {
  // ── Lock completeness ───────────────────────────────────────────────────────

  it('LOCK-1: all 6 canonical covenants have a permanent lock record', () => {
    const locks = lockAllCovenants();
    expect(locks.size).toBe(6);
    for (const lock of locks.values()) {
      expect(lock.permanent).toBe(true);
      expect(lock.schema).toBe('vitalcv.covenant-lock.v1');
    }
  });

  it('LOCK-2: every lock hash is a 64-char hex string (tamper-evident)', () => {
    const locks = lockAllCovenants();
    for (const lock of locks.values()) {
      expect(lock.lockHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  // ── Covenant record integrity ───────────────────────────────────────────────

  it('RECORD-1: every covenant carries a 64-char lineageSeed', () => {
    for (const record of CANONICAL_COVENANTS.values()) {
      expect(record.lineageSeed).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('RECORD-2: every covenant carries a 64-char covenantHash', () => {
    for (const record of CANONICAL_COVENANTS.values()) {
      expect(record.covenantHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('RECORD-3: every covenant lockedBy references the W2-PR157A finalizer', () => {
    for (const record of CANONICAL_COVENANTS.values()) {
      expect(record.lockedBy).toBe('vitalcv.covenant-finalizer.w2-pr157a');
    }
  });

  // ── Compliance under canonical signal ───────────────────────────────────────

  it('COMPLIANCE-1: all 6 covenants are COMPLIANT under canonical production signal', () => {
    const verdicts = evaluateAllCovenantCompliance(CANONICAL_SIGNAL);
    const nonCompliant = verdicts.filter((v) => v.status !== 'COMPLIANT');
    expect(nonCompliant).toHaveLength(0);
  });

  it('COMPLIANCE-2: gate passes under canonical production signal', () => {
    const verdicts = evaluateAllCovenantCompliance(CANONICAL_SIGNAL);
    const gate = evaluateCovenantGate(verdicts, CANONICAL_SIGNAL);
    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toHaveLength(0);
  });

  // ── Board metrics at threshold ──────────────────────────────────────────────

  it(`METRICS-1: Replay Guarantee Integrity meets ${CI_THRESHOLD_PCT}% threshold`, () => {
    const verdicts = evaluateAllCovenantCompliance(CANONICAL_SIGNAL);
    const metrics = deriveCovenantBoardMetrics(verdicts);
    expect(metrics.replayGuaranteeIntegrityPct).toBeGreaterThanOrEqual(CI_THRESHOLD_PCT);
  });

  it(`METRICS-2: Ambiguity Honesty Permanence meets ${CI_THRESHOLD_PCT}% threshold`, () => {
    const verdicts = evaluateAllCovenantCompliance(CANONICAL_SIGNAL);
    const metrics = deriveCovenantBoardMetrics(verdicts);
    expect(metrics.ambiguityHonestyPermanencePct).toBeGreaterThanOrEqual(CI_THRESHOLD_PCT);
  });

  it(`METRICS-3: Institutional Survivability Guarantees meets ${CI_THRESHOLD_PCT}% threshold`, () => {
    const verdicts = evaluateAllCovenantCompliance(CANONICAL_SIGNAL);
    const metrics = deriveCovenantBoardMetrics(verdicts);
    expect(metrics.institutionalSurvivabilityGuaranteesPct).toBeGreaterThanOrEqual(CI_THRESHOLD_PCT);
  });

  it(`METRICS-4: Covenant Stability meets ${CI_THRESHOLD_PCT}% threshold`, () => {
    const verdicts = evaluateAllCovenantCompliance(CANONICAL_SIGNAL);
    const metrics = deriveCovenantBoardMetrics(verdicts);
    expect(metrics.covenantStabilityPct).toBeGreaterThanOrEqual(CI_THRESHOLD_PCT);
  });

  it(`METRICS-5: Covenant Finalization Maturity meets ${CI_THRESHOLD_PCT}% threshold`, () => {
    const verdicts = evaluateAllCovenantCompliance(CANONICAL_SIGNAL);
    const metrics = deriveCovenantBoardMetrics(verdicts);
    const result = assertCovenantMaturityThreshold(metrics, CI_THRESHOLD_PCT);
    expect(result.pass).toBe(true);
    expect(result.actual).toBeGreaterThanOrEqual(CI_THRESHOLD_PCT);
  });

  // ── Lineage reconstructability ──────────────────────────────────────────────

  it('LINEAGE-1: covenant lineage is reconstructable from stored records', () => {
    const records = Array.from(CANONICAL_COVENANTS.values());
    const lineage = buildCovenantLineage(records);
    expect(lineage.schema).toBe('vitalcv.covenant-lineage.v1');
    expect(lineage.timeline).toHaveLength(6);
    expect(lineage.lineageHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('LINEAGE-2: lineage positions are sequential and zero-based', () => {
    const records = Array.from(CANONICAL_COVENANTS.values());
    const lineage = buildCovenantLineage(records);
    lineage.timeline.forEach((entry, i) => {
      expect(entry.position).toBe(i);
    });
  });

  it('LINEAGE-3: every lineage entry carries a 64-char entryHash', () => {
    const records = Array.from(CANONICAL_COVENANTS.values());
    const lineage = buildCovenantLineage(records);
    for (const entry of lineage.timeline) {
      expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  // ── Observability report ────────────────────────────────────────────────────

  it('OBS-1: observability report carries a tamper-evident hash', () => {
    const verdicts = evaluateAllCovenantCompliance(CANONICAL_SIGNAL);
    const report = buildCovenantObservabilityReport(verdicts, '2026-05-10T00:00:00.000Z');
    expect(report.observabilityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(report.lockedCovenantCount).toBe(6);
    expect(report.totalCovenants).toBe(6);
  });

  it('OBS-2: report verdictSummary shows 6 compliant and 0 violated under canonical signal', () => {
    const verdicts = evaluateAllCovenantCompliance(CANONICAL_SIGNAL);
    const report = buildCovenantObservabilityReport(verdicts, '2026-05-10T00:00:00.000Z');
    expect(report.verdictSummary.compliantCount).toBe(6);
    expect(report.verdictSummary.violatedCount).toBe(0);
    expect(report.verdictSummary.quarantinedCount).toBe(0);
  });

  // ── Chaos simulation coverage ───────────────────────────────────────────────

  it('CHAOS-1: all 5 chaos scenarios surface their signal (silentCount must be 0)', () => {
    const result = runCovenantChaosSimulations();
    expect(result.summary.totalScenarios).toBe(5);
    expect(result.summary.silentCount).toBe(0);
    expect(result.summary.surfacedCount).toBe(5);
  });

  it('CHAOS-2: BASELINE scenario gate passes without blocked gates', () => {
    const result = runCovenantChaosSimulations();
    const baseline = result.verdicts.find((v) => v.scenario === 'BASELINE');
    expect(baseline).toBeDefined();
    expect(baseline?.signalSurfaced).toBe(true);
    expect(baseline?.failedGateIds).toHaveLength(0);
  });

  it('CHAOS-3: every non-BASELINE scenario blocks at least one gate', () => {
    const result = runCovenantChaosSimulations();
    const nonBaseline = result.verdicts.filter((v) => v.scenario !== 'BASELINE');
    for (const v of nonBaseline) {
      expect(v.failedGateIds.length).toBeGreaterThan(0);
    }
  });

  // ── Fail-closed semantics ───────────────────────────────────────────────────

  it('FAILCLOSED-1: a single covenant breach is sufficient to fail the gate', () => {
    const signal = { ...CANONICAL_SIGNAL, replayFaithful: false };
    const verdicts = evaluateAllCovenantCompliance(signal);
    const gate = evaluateCovenantGate(verdicts, signal);
    expect(gate.pass).toBe(false);
  });

  it('FAILCLOSED-2: partial compliance never produces a passing gate', () => {
    const signals: Partial<CovenantRuntimeSignal>[] = [
      { replayFaithful: false },
      { ambiguityPreserved: false },
      { failClosedUnderUncertainty: false },
      { tenantIsolationHeld: false },
      { lineageReconstructable: false },
      { survivabilityFloorHeld: false },
    ];
    for (const override of signals) {
      const signal = { ...CANONICAL_SIGNAL, ...override };
      const verdicts = evaluateAllCovenantCompliance(signal);
      const gate = evaluateCovenantGate(verdicts, signal);
      expect(gate.pass).toBe(false);
    }
  });

  it('FAILCLOSED-3: maturity is 0 whenever any component metric is 0', () => {
    const signal = { ...CANONICAL_SIGNAL, survivabilityFloorHeld: false };
    const verdicts = evaluateAllCovenantCompliance(signal);
    const metrics = deriveCovenantBoardMetrics(verdicts);
    expect(metrics.covenantFinalizationMaturityPct).toBe(0);
  });
});
