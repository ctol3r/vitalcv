/**
 * institutionalCovenant.test.ts — W2-PR157A
 *
 * Validates the six canonical covenants, lock records, compliance evaluation,
 * lineage reconstruction, gate logic, observability metrics, and chaos
 * simulation surface coverage.
 *
 * Every test asserts from evidence — no operator-assertion overrides accepted.
 */

import {
  CANONICAL_COVENANTS,
  lockCovenant,
  lockAllCovenants,
  evaluateCovenantCompliance,
  evaluateAllCovenantCompliance,
  evaluateCovenantGate,
  buildCovenantLineage,
  runCovenantChaosSimulations,
  type CovenantId,
  type CovenantRuntimeSignal,
} from '../institutionalCovenant';
import {
  deriveCovenantBoardMetrics,
  buildCovenantObservabilityReport,
  buildCovenantLineageReport,
  assertCovenantMaturityThreshold,
} from '../covenantObservability';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FULL_COMPLIANCE: CovenantRuntimeSignal = {
  replayFaithful: true,
  ambiguityPreserved: true,
  failClosedUnderUncertainty: true,
  tenantIsolationHeld: true,
  lineageReconstructable: true,
  survivabilityFloorHeld: true,
};

const ALL_COVENANT_IDS: CovenantId[] = [
  'REPLAY_GUARANTEE',
  'AMBIGUITY_HONESTY',
  'FAIL_CLOSED_BOUNDARY',
  'TENANT_ISOLATION',
  'LINEAGE_RECONSTRUCTABILITY',
  'INSTITUTIONAL_SURVIVABILITY',
];

// ── Canonical covenants ───────────────────────────────────────────────────────

describe('CANONICAL_COVENANTS', () => {
  it('defines exactly 6 covenants', () => {
    expect(CANONICAL_COVENANTS.size).toBe(6);
  });

  it('every covenant has the correct schema version', () => {
    for (const record of CANONICAL_COVENANTS.values()) {
      expect(record.schema).toBe('vitalcv.institutional-covenant.v1');
    }
  });

  it('every covenant carries at least 4 guarantee strings', () => {
    for (const record of CANONICAL_COVENANTS.values()) {
      expect(record.guarantees.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('every covenant carries a non-empty failClosedBehavior', () => {
    for (const record of CANONICAL_COVENANTS.values()) {
      expect(record.failClosedBehavior.length).toBeGreaterThan(20);
    }
  });

  it('every covenant lineageSeed is 64 hex chars', () => {
    for (const record of CANONICAL_COVENANTS.values()) {
      expect(record.lineageSeed).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('every covenant covenantHash is 64 hex chars', () => {
    for (const record of CANONICAL_COVENANTS.values()) {
      expect(record.covenantHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('all six expected covenant IDs are present', () => {
    for (const id of ALL_COVENANT_IDS) {
      expect(CANONICAL_COVENANTS.has(id)).toBe(true);
    }
  });

  it('covenant hashes are stable across calls (deterministic)', () => {
    const first = Array.from(CANONICAL_COVENANTS.values()).map((r) => r.covenantHash);
    const second = Array.from(CANONICAL_COVENANTS.values()).map((r) => r.covenantHash);
    expect(first).toEqual(second);
  });
});

// ── Lock records ──────────────────────────────────────────────────────────────

describe('lockCovenant', () => {
  it('produces a lock record with the correct schema', () => {
    const lock = lockCovenant('REPLAY_GUARANTEE');
    expect(lock.schema).toBe('vitalcv.covenant-lock.v1');
  });

  it('lock record carries permanent: true (literal)', () => {
    const lock = lockCovenant('AMBIGUITY_HONESTY');
    expect(lock.permanent).toBe(true);
  });

  it('lockHash is 64 hex chars and deterministic', () => {
    const a = lockCovenant('FAIL_CLOSED_BOUNDARY');
    const b = lockCovenant('FAIL_CLOSED_BOUNDARY');
    expect(a.lockHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.lockHash).toBe(b.lockHash);
  });

  it('different covenants produce different lock hashes', () => {
    const a = lockCovenant('REPLAY_GUARANTEE');
    const b = lockCovenant('TENANT_ISOLATION');
    expect(a.lockHash).not.toBe(b.lockHash);
  });
});

describe('lockAllCovenants', () => {
  it('locks all 6 covenants', () => {
    const locks = lockAllCovenants();
    expect(locks.size).toBe(6);
  });

  it('every lock record carries permanent: true', () => {
    const locks = lockAllCovenants();
    for (const lock of locks.values()) {
      expect(lock.permanent).toBe(true);
    }
  });
});

// ── Compliance evaluation — all compliant ─────────────────────────────────────

describe('evaluateCovenantCompliance — full compliance signal', () => {
  for (const id of ALL_COVENANT_IDS) {
    it(`${id} is COMPLIANT when all signals pass`, () => {
      const verdict = evaluateCovenantCompliance(id, FULL_COMPLIANCE);
      expect(verdict.status).toBe('COMPLIANT');
      expect(verdict.violations).toHaveLength(0);
      expect(verdict.failClosed).toBe(false);
    });
  }

  it('verdictHash is 64 hex chars', () => {
    const verdict = evaluateCovenantCompliance('REPLAY_GUARANTEE', FULL_COMPLIANCE);
    expect(verdict.verdictHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('same input produces identical verdictHash (deterministic)', () => {
    const a = evaluateCovenantCompliance('AMBIGUITY_HONESTY', FULL_COMPLIANCE);
    const b = evaluateCovenantCompliance('AMBIGUITY_HONESTY', FULL_COMPLIANCE);
    expect(a.verdictHash).toBe(b.verdictHash);
  });
});

// ── Compliance evaluation — single-breach coverage ───────────────────────────

describe('evaluateCovenantCompliance — single breach per covenant', () => {
  const breachMap: Record<CovenantId, Partial<CovenantRuntimeSignal>> = {
    REPLAY_GUARANTEE: { replayFaithful: false },
    AMBIGUITY_HONESTY: { ambiguityPreserved: false },
    FAIL_CLOSED_BOUNDARY: { failClosedUnderUncertainty: false },
    TENANT_ISOLATION: { tenantIsolationHeld: false },
    LINEAGE_RECONSTRUCTABILITY: { lineageReconstructable: false },
    INSTITUTIONAL_SURVIVABILITY: { survivabilityFloorHeld: false },
  };

  for (const [id, override] of Object.entries(breachMap) as [CovenantId, Partial<CovenantRuntimeSignal>][]) {
    it(`${id} becomes VIOLATED when its signal fails`, () => {
      const signal = { ...FULL_COMPLIANCE, ...override };
      const verdict = evaluateCovenantCompliance(id, signal);
      expect(verdict.status).toBe('VIOLATED');
      expect(verdict.violations.length).toBeGreaterThan(0);
      expect(verdict.failClosed).toBe(true);
    });

    it(`${id} verdict carries a FATAL violation on breach`, () => {
      const signal = { ...FULL_COMPLIANCE, ...override };
      const verdict = evaluateCovenantCompliance(id, signal);
      expect(verdict.violations[0]?.severity).toBe('FATAL');
    });
  }
});

// ── evaluateAllCovenantCompliance ─────────────────────────────────────────────

describe('evaluateAllCovenantCompliance', () => {
  it('returns 6 verdicts for a full-compliance signal', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    expect(verdicts).toHaveLength(6);
  });

  it('all verdicts are COMPLIANT for full-compliance signal', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    for (const v of verdicts) {
      expect(v.status).toBe('COMPLIANT');
    }
  });

  it('exactly one VIOLATED verdict when replayFaithful=false', () => {
    const verdicts = evaluateAllCovenantCompliance({ ...FULL_COMPLIANCE, replayFaithful: false });
    const violated = verdicts.filter((v) => v.status === 'VIOLATED');
    expect(violated).toHaveLength(1);
    expect(violated[0]?.covenantId).toBe('REPLAY_GUARANTEE');
  });
});

// ── Operator assertion mismatch detection ─────────────────────────────────────

describe('operator assertion mismatch', () => {
  it('gate fails when operatorAssertedCompliancePct does not match evidence', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const signal: CovenantRuntimeSignal = {
      ...FULL_COMPLIANCE,
      operatorAssertedCompliancePct: 50, // wrong — evidence shows 100%
    };
    const gate = evaluateCovenantGate(verdicts, signal);
    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toContain('verdicts_evidence_derived');
  });

  it('gate passes when operatorAssertedCompliancePct matches evidence exactly', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const signal: CovenantRuntimeSignal = {
      ...FULL_COMPLIANCE,
      operatorAssertedCompliancePct: 100,
    };
    const gate = evaluateCovenantGate(verdicts, signal);
    expect(gate.pass).toBe(true);
  });
});

// ── Gate evaluation ───────────────────────────────────────────────────────────

describe('evaluateCovenantGate', () => {
  it('passes when all covenants are COMPLIANT', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const gate = evaluateCovenantGate(verdicts, FULL_COMPLIANCE);
    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toHaveLength(0);
    expect(gate.compliantCount).toBe(6);
    expect(gate.violatedCount).toBe(0);
  });

  it('fails when any covenant is VIOLATED', () => {
    const verdicts = evaluateAllCovenantCompliance({ ...FULL_COMPLIANCE, replayFaithful: false });
    const gate = evaluateCovenantGate(verdicts, { ...FULL_COMPLIANCE, replayFaithful: false });
    expect(gate.pass).toBe(false);
    expect(gate.violatedCount).toBe(1);
    expect(gate.failedGateIds).toContain('no_compliance_violations');
    expect(gate.failedGateIds).toContain('fail_closed_enforced');
  });

  it('reports correct compliant/violated counts on multi-breach', () => {
    const signal: CovenantRuntimeSignal = {
      ...FULL_COMPLIANCE,
      replayFaithful: false,
      survivabilityFloorHeld: false,
    };
    const verdicts = evaluateAllCovenantCompliance(signal);
    const gate = evaluateCovenantGate(verdicts, signal);
    expect(gate.violatedCount).toBe(2);
    expect(gate.compliantCount).toBe(4);
  });

  it('lineage_reconstructable gate passes (64-char lineageSeed on all records)', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const gate = evaluateCovenantGate(verdicts, FULL_COMPLIANCE);
    expect(gate.failedGateIds).not.toContain('lineage_reconstructable');
  });

  it('all_covenants_locked gate passes when all 6 are in the lock map', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const gate = evaluateCovenantGate(verdicts, FULL_COMPLIANCE);
    expect(gate.failedGateIds).not.toContain('all_covenants_locked');
  });
});

// ── Lineage builder ───────────────────────────────────────────────────────────

describe('buildCovenantLineage', () => {
  it('builds a lineage with 6 entries from all canonical records', () => {
    const records = Array.from(CANONICAL_COVENANTS.values());
    const lineage = buildCovenantLineage(records);
    expect(lineage.schema).toBe('vitalcv.covenant-lineage.v1');
    expect(lineage.timeline).toHaveLength(6);
  });

  it('every timeline entry carries a 64-char entryHash', () => {
    const records = Array.from(CANONICAL_COVENANTS.values());
    const lineage = buildCovenantLineage(records);
    for (const entry of lineage.timeline) {
      expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('lineageHash is deterministic', () => {
    const records = Array.from(CANONICAL_COVENANTS.values());
    const a = buildCovenantLineage(records);
    const b = buildCovenantLineage(records);
    expect(a.lineageHash).toBe(b.lineageHash);
  });

  it('firstLockedAt and lastLockedAt are set', () => {
    const records = Array.from(CANONICAL_COVENANTS.values());
    const lineage = buildCovenantLineage(records);
    expect(lineage.firstLockedAt).not.toBeNull();
    expect(lineage.lastLockedAt).not.toBeNull();
  });

  it('positions are sequential starting at 0', () => {
    const records = Array.from(CANONICAL_COVENANTS.values());
    const lineage = buildCovenantLineage(records);
    lineage.timeline.forEach((entry, i) => {
      expect(entry.position).toBe(i);
    });
  });
});

// ── Observability metrics ─────────────────────────────────────────────────────

describe('deriveCovenantBoardMetrics — full compliance', () => {
  it('all metrics are 100 when all covenants are COMPLIANT', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const metrics = deriveCovenantBoardMetrics(verdicts);
    expect(metrics.replayGuaranteeIntegrityPct).toBe(100);
    expect(metrics.ambiguityHonestyPermanencePct).toBe(100);
    expect(metrics.institutionalSurvivabilityGuaranteesPct).toBe(100);
    expect(metrics.covenantStabilityPct).toBe(100);
    expect(metrics.covenantFinalizationMaturityPct).toBe(100);
  });
});

describe('deriveCovenantBoardMetrics — single breach', () => {
  it('replayGuaranteeIntegrityPct drops to 0 on replay breach', () => {
    const verdicts = evaluateAllCovenantCompliance({ ...FULL_COMPLIANCE, replayFaithful: false });
    const metrics = deriveCovenantBoardMetrics(verdicts);
    expect(metrics.replayGuaranteeIntegrityPct).toBe(0);
  });

  it('ambiguityHonestyPermanencePct drops to 0 on honesty breach', () => {
    const verdicts = evaluateAllCovenantCompliance({ ...FULL_COMPLIANCE, ambiguityPreserved: false });
    const metrics = deriveCovenantBoardMetrics(verdicts);
    expect(metrics.ambiguityHonestyPermanencePct).toBe(0);
  });

  it('institutionalSurvivabilityGuaranteesPct drops to 0 on survivability breach', () => {
    const verdicts = evaluateAllCovenantCompliance({ ...FULL_COMPLIANCE, survivabilityFloorHeld: false });
    const metrics = deriveCovenantBoardMetrics(verdicts);
    expect(metrics.institutionalSurvivabilityGuaranteesPct).toBe(0);
  });

  it('maturity is 0 when any component is 0 (floor semantics)', () => {
    const verdicts = evaluateAllCovenantCompliance({ ...FULL_COMPLIANCE, replayFaithful: false });
    const metrics = deriveCovenantBoardMetrics(verdicts);
    expect(metrics.covenantFinalizationMaturityPct).toBe(0);
  });
});

describe('buildCovenantObservabilityReport', () => {
  it('report schema is correct', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const report = buildCovenantObservabilityReport(verdicts, '2026-05-10T00:00:00.000Z');
    expect(report.schema).toBe('vitalcv.covenant-observability.v1');
  });

  it('observabilityHash is 64 hex chars', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const report = buildCovenantObservabilityReport(verdicts, '2026-05-10T00:00:00.000Z');
    expect(report.observabilityHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('observabilityHash is deterministic for same input', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const a = buildCovenantObservabilityReport(verdicts, '2026-05-10T00:00:00.000Z');
    const b = buildCovenantObservabilityReport(verdicts, '2026-05-10T00:00:00.000Z');
    expect(a.observabilityHash).toBe(b.observabilityHash);
  });

  it('reports all 6 covenants locked', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const report = buildCovenantObservabilityReport(verdicts, '2026-05-10T00:00:00.000Z');
    expect(report.lockedCovenantCount).toBe(6);
  });

  it('verdictSummary counts are correct under full compliance', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const report = buildCovenantObservabilityReport(verdicts, '2026-05-10T00:00:00.000Z');
    expect(report.verdictSummary.compliantCount).toBe(6);
    expect(report.verdictSummary.violatedCount).toBe(0);
    expect(report.verdictSummary.ambiguousCount).toBe(0);
    expect(report.verdictSummary.quarantinedCount).toBe(0);
  });
});

describe('buildCovenantLineageReport', () => {
  it('returns a lineage with 6 entries', () => {
    const lineage = buildCovenantLineageReport();
    expect(lineage.timeline).toHaveLength(6);
  });
});

describe('assertCovenantMaturityThreshold', () => {
  it('passes at threshold=100 when maturity is 100', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const metrics = deriveCovenantBoardMetrics(verdicts);
    const result = assertCovenantMaturityThreshold(metrics, 100);
    expect(result.pass).toBe(true);
  });

  it('fails when maturity is 0 and threshold is 80', () => {
    const verdicts = evaluateAllCovenantCompliance({ ...FULL_COMPLIANCE, replayFaithful: false });
    const metrics = deriveCovenantBoardMetrics(verdicts);
    const result = assertCovenantMaturityThreshold(metrics, 80);
    expect(result.pass).toBe(false);
    expect(result.actual).toBe(0);
  });

  it('reason string is non-empty and references threshold', () => {
    const verdicts = evaluateAllCovenantCompliance(FULL_COMPLIANCE);
    const metrics = deriveCovenantBoardMetrics(verdicts);
    const result = assertCovenantMaturityThreshold(metrics, 80);
    expect(result.reason).toContain('80');
  });
});

// ── Chaos simulations ─────────────────────────────────────────────────────────

describe('runCovenantChaosSimulations', () => {
  it('runs exactly 5 scenarios', () => {
    const result = runCovenantChaosSimulations();
    expect(result.verdicts).toHaveLength(5);
    expect(result.summary.totalScenarios).toBe(5);
  });

  it('BASELINE scenario: gate passes, signalSurfaced=true', () => {
    const result = runCovenantChaosSimulations();
    const baseline = result.verdicts.find((v) => v.scenario === 'BASELINE');
    expect(baseline?.signalSurfaced).toBe(true);
    expect(baseline?.status).toBe('COMPLIANT');
  });

  it('REPLAY_GUARANTEE_BREACH: surfaces breach, gate blocked', () => {
    const result = runCovenantChaosSimulations();
    const v = result.verdicts.find((v) => v.scenario === 'REPLAY_GUARANTEE_BREACH');
    expect(v?.signalSurfaced).toBe(true);
    expect(v?.status).toBe('VIOLATED');
    expect(v?.failedGateIds.length).toBeGreaterThan(0);
  });

  it('AMBIGUITY_HONESTY_VIOLATION: surfaces breach, gate blocked', () => {
    const result = runCovenantChaosSimulations();
    const v = result.verdicts.find((v) => v.scenario === 'AMBIGUITY_HONESTY_VIOLATION');
    expect(v?.signalSurfaced).toBe(true);
    expect(v?.failedGateIds.length).toBeGreaterThan(0);
  });

  it('SURVIVABILITY_COLLAPSE: surfaces breach, gate blocked', () => {
    const result = runCovenantChaosSimulations();
    const v = result.verdicts.find((v) => v.scenario === 'SURVIVABILITY_COLLAPSE');
    expect(v?.signalSurfaced).toBe(true);
    expect(v?.failedGateIds.length).toBeGreaterThan(0);
  });

  it('COVENANT_LINEAGE_CORRUPTION: surfaces breach, gate blocked', () => {
    const result = runCovenantChaosSimulations();
    const v = result.verdicts.find((v) => v.scenario === 'COVENANT_LINEAGE_CORRUPTION');
    expect(v?.signalSurfaced).toBe(true);
    expect(v?.failedGateIds.length).toBeGreaterThan(0);
  });

  it('all 5 scenarios surface their signal (silentCount=0)', () => {
    const result = runCovenantChaosSimulations();
    expect(result.summary.silentCount).toBe(0);
    expect(result.summary.surfacedCount).toBe(5);
  });

  it('each verdict carries a non-empty signal string', () => {
    const result = runCovenantChaosSimulations();
    for (const v of result.verdicts) {
      expect(v.signal.length).toBeGreaterThan(10);
    }
  });
});
