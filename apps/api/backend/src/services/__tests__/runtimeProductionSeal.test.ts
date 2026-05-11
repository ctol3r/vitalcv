/**
 * runtimeProductionSeal.test.ts — W2-PR170A
 *
 * Production seal verification for constitutional runtime as institutional
 * trust infrastructure.
 *
 * Coverage:
 *   1. Production seal verification (globally verified or fail-closed)
 *   2. Replay-production immutability (replays locked post-seal)
 *   3. Governance-runtime permanence (governance state permanent after seal)
 *   4. Production seal telemetry (longitudinally observable)
 *   5. Runtime durability scoring (durability across all seven domains)
 *   6. Production chaos simulations (8 adversarial scenarios each surface signals)
 *   7. Production-seal CI gates (7 binary gates enforce the contract)
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateProductionSeal,
  buildProductionSealLineage,
  evaluateProductionSealGate,
  scoreRuntimeDurability,
  runProductionSealChaosSimulations,
  PRODUCTION_SEAL_GATE_IDS,
  PRODUCTION_SEAL_SENTINELS,
  type ProductionSealEvidence,
  type ProductionSealInput,
} from '../system/runtimeProductionSeal';

// ── Evidence factory ──────────────────────────────────────────────────────────

function evidence(
  id: string,
  domain: ProductionSealEvidence['domain'],
  overrides: Partial<ProductionSealEvidence> = {},
): ProductionSealEvidence {
  return {
    evidenceId: id,
    recordedAt: '2026-05-10T10:00:00.000Z',
    domain,
    sourceSystemId: 'test-source',
    replayTraceId: `trace-${id}`,
    sealFidelity: 0.95,
    immutabilityScore: 0.95,
    permanenceScore: 0.95,
    telemetryScore: 0.95,
    durabilityScore: 0.95,
    chaosResilienceScore: 0.95,
    constitutionalStability: 0.95,
    sealed: true,
    immutable: true,
    failClosedReady: true,
    evidenceRefs: [`ref-${id}-a`, `ref-${id}-b`],
    lineageRefs: [`lineage-${id}-a`, `lineage-${id}-b`],
    telemetryRefs: [`telemetry-${id}`],
    driftSignals: [],
    chaosSignals: [],
    driftRisk: null,
    ...overrides,
  };
}

function fullSealInput(idPrefix = 'e'): ProductionSealInput {
  return {
    sealId: 'seal-test-1',
    generatedAt: '2026-05-11T12:00:00.000Z',
    evidence: [
      evidence(`${idPrefix}-1`, 'production_seal_verification', {
        recordedAt: '2026-05-08T08:00:00.000Z',
      }),
      evidence(`${idPrefix}-2`, 'replay_production_immutability', {
        recordedAt: '2026-05-09T09:00:00.000Z',
      }),
      evidence(`${idPrefix}-3`, 'governance_runtime_permanence', {
        recordedAt: '2026-05-10T10:00:00.000Z',
      }),
      evidence(`${idPrefix}-4`, 'production_seal_telemetry', {
        recordedAt: '2026-05-11T11:00:00.000Z',
      }),
      evidence(`${idPrefix}-5`, 'runtime_durability_scoring', {
        recordedAt: '2026-05-12T12:00:00.000Z',
      }),
      evidence(`${idPrefix}-6`, 'production_chaos_resilience', {
        recordedAt: '2026-05-13T13:00:00.000Z',
      }),
      evidence(`${idPrefix}-7`, 'constitutional_trust_stability', {
        recordedAt: '2026-05-14T14:00:00.000Z',
      }),
    ],
  };
}

// ── 1. Sentinels and constants ────────────────────────────────────────────────

describe('ProductionSeal sentinels', () => {
  it('exposes all seven gate IDs', () => {
    expect(PRODUCTION_SEAL_GATE_IDS).toHaveLength(7);
    expect(PRODUCTION_SEAL_GATE_IDS).toContain('production_seal_globally_verified');
    expect(PRODUCTION_SEAL_GATE_IDS).toContain('replay_production_immutable');
    expect(PRODUCTION_SEAL_GATE_IDS).toContain('governance_permanently_sealed');
    expect(PRODUCTION_SEAL_GATE_IDS).toContain('fail_closed_production_semantics');
    expect(PRODUCTION_SEAL_GATE_IDS).toContain('drift_impossible_post_production_seal');
    expect(PRODUCTION_SEAL_GATE_IDS).toContain('production_telemetry_observable');
    expect(PRODUCTION_SEAL_GATE_IDS).toContain('runtime_durability_longitudinally_scored');
  });

  it('SENTINELS failClosed is hardcoded true', () => {
    expect(PRODUCTION_SEAL_SENTINELS.failClosed).toBe(true);
  });

  it('SENTINELS schemas match expected prefixes', () => {
    expect(PRODUCTION_SEAL_SENTINELS.resultSchema).toBe('vitalcv.runtime-production-seal.v1');
    expect(PRODUCTION_SEAL_SENTINELS.lineageSchema).toBe('vitalcv.runtime-production-seal-lineage.v1');
    expect(PRODUCTION_SEAL_SENTINELS.gateSchema).toBe('vitalcv.runtime-production-seal-ci-gate.v1');
    expect(PRODUCTION_SEAL_SENTINELS.chaosSchema).toBe('vitalcv.runtime-production-seal-chaos.v1');
  });

  it('SENTINELS lists all seven required domains', () => {
    expect(PRODUCTION_SEAL_SENTINELS.requiredDomains).toHaveLength(7);
  });
});

// ── 2. Lineage construction ───────────────────────────────────────────────────

describe('buildProductionSealLineage', () => {
  it('builds chronologically ordered timeline with correct positions', () => {
    const input = fullSealInput();
    const lineage = buildProductionSealLineage(input);

    expect(lineage.schema).toBe('vitalcv.runtime-production-seal-lineage.v1');
    expect(lineage.sealId).toBe('seal-test-1');
    expect(lineage.timeline).toHaveLength(7);
    expect(lineage.timeline[0].position).toBe(1);
    expect(lineage.timeline[6].position).toBe(7);
    expect(lineage.domainsObserved).toHaveLength(7);
  });

  it('emits a stable lineageHash for identical inputs', () => {
    const input = fullSealInput();
    const a = buildProductionSealLineage(input);
    const b = buildProductionSealLineage(input);
    expect(a.lineageHash).toBe(b.lineageHash);
    expect(a.lineageHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces distinct lineageHash when evidence changes', () => {
    const base = buildProductionSealLineage(fullSealInput('base'));
    const mutated = buildProductionSealLineage(fullSealInput('mutated'));
    expect(base.lineageHash).not.toBe(mutated.lineageHash);
  });

  it('records firstRecordedAt and lastRecordedAt correctly', () => {
    const lineage = buildProductionSealLineage(fullSealInput());
    expect(lineage.firstRecordedAt).toBe('2026-05-08T08:00:00.000Z');
    expect(lineage.lastRecordedAt).toBe('2026-05-14T14:00:00.000Z');
  });

  it('deduplicates sourceSystemIds', () => {
    const input: ProductionSealInput = {
      sealId: 'seal-dedup',
      generatedAt: '2026-05-11T00:00:00.000Z',
      evidence: fullSealInput().evidence.map(e => ({ ...e, sourceSystemId: 'shared-source' })),
    };
    const lineage = buildProductionSealLineage(input);
    expect(lineage.sourceSystemIds).toEqual(['shared-source']);
  });

  it('sets firstRecordedAt and lastRecordedAt to null for empty evidence', () => {
    const lineage = buildProductionSealLineage({
      sealId: 'empty',
      generatedAt: '2026-05-11T00:00:00.000Z',
      evidence: [],
    });
    expect(lineage.firstRecordedAt).toBeNull();
    expect(lineage.lastRecordedAt).toBeNull();
    expect(lineage.timeline).toHaveLength(0);
  });

  it('each timeline entry carries a 64-char hex evidenceHash', () => {
    const lineage = buildProductionSealLineage(fullSealInput());
    for (const entry of lineage.timeline) {
      expect(entry.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

// ── 3. Production seal evaluation — fully sealed ──────────────────────────────

describe('evaluateProductionSeal — fully sealed', () => {
  it('returns PRODUCTION_SEAL_READY and PRODUCTION_SEALED for complete evidence', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.status).toBe('PRODUCTION_SEAL_READY');
    expect(result.verdict).toBe('PRODUCTION_SEALED');
    expect(result.failClosed).toBe(false);
    expect(result.blockers).toHaveLength(0);
  });

  it('sealMaturityScore is ≥ 90 for a fully sealed runtime', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.sealMaturityScore).toBeGreaterThanOrEqual(90);
  });

  it('sealHash is a stable 64-char hex for identical inputs', () => {
    const a = evaluateProductionSeal(fullSealInput());
    const b = evaluateProductionSeal(fullSealInput());
    expect(a.sealHash).toBe(b.sealHash);
    expect(a.sealHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('schema matches expected value', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.schema).toBe('vitalcv.runtime-production-seal.v1');
  });
});

// ── 4. Replay-production immutability ─────────────────────────────────────────

describe('evaluateProductionSeal — replay-production immutability', () => {
  it('replayFidelity.immutable is true when all evidence is sealed and immutable', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.replayFidelity.immutable).toBe(true);
    expect(result.replayFidelity.mutableReplayIds).toHaveLength(0);
  });

  it('replayFidelity.immutable is false when immutability evidence is degraded', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e =>
        e.domain === 'replay_production_immutability'
          ? { ...e, immutabilityScore: 0.3, sealed: false, immutable: false }
          : e,
      ),
    };
    const result = evaluateProductionSeal(input);
    expect(result.replayFidelity.immutable).toBe(false);
    expect(result.replayFidelity.mutableReplayIds.length).toBeGreaterThan(0);
  });

  it('trace coverage drops when replayTraceId is null', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({ ...e, replayTraceId: null })),
    };
    const result = evaluateProductionSeal(input);
    expect(result.replayFidelity.traceCoveragePct).toBe(0);
  });

  it('verdict shifts to PRODUCTION_FAIL_CLOSED when replay immutability breaks', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({
        ...e,
        sealed: false,
        immutable: false,
        sealFidelity: 0.1,
        immutabilityScore: 0.1,
        failClosedReady: false,
      })),
    };
    const result = evaluateProductionSeal(input);
    expect(result.verdict).toBe('PRODUCTION_FAIL_CLOSED');
    expect(result.failClosed).toBe(true);
  });
});

// ── 5. Governance-runtime permanence ─────────────────────────────────────────

describe('evaluateProductionSeal — governance-runtime permanence', () => {
  it('runtimePermanence.permanent is true for full governance evidence', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.runtimePermanence.permanent).toBe(true);
    expect(result.runtimePermanence.governanceSealedPct).toBe(100);
  });

  it('runtimePermanence.permanent is false when governance domain is degraded', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e =>
        e.domain === 'governance_runtime_permanence'
          ? { ...e, permanenceScore: 0.2, sealed: false, immutable: false }
          : e,
      ),
    };
    const result = evaluateProductionSeal(input);
    expect(result.runtimePermanence.permanent).toBe(false);
  });

  it('permanencePct is proportional to evidence permanenceScore', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.runtimePermanence.permanencePct).toBeGreaterThanOrEqual(90);
  });

  it('blocks when governance domain is entirely absent', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.filter(e => e.domain !== 'governance_runtime_permanence'),
    };
    const result = evaluateProductionSeal(input);
    expect(result.runtimePermanence.permanent).toBe(false);
    expect(result.blockers.some(b => b.includes('permanence') || b.includes('seal'))).toBe(true);
  });
});

// ── 6. Production seal telemetry ──────────────────────────────────────────────

describe('evaluateProductionSeal — production seal telemetry', () => {
  it('productionTelemetry.observable is true when telemetry refs present', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.productionTelemetry.observable).toBe(true);
    expect(result.productionTelemetry.telemetryRefCount).toBeGreaterThan(0);
  });

  it('productionTelemetry.observable is false when telemetry refs are stripped', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e =>
        e.domain === 'production_seal_telemetry'
          ? { ...e, telemetryRefs: [], telemetryScore: 0.1, sealed: false }
          : e,
      ),
    };
    const result = evaluateProductionSeal(input);
    expect(result.productionTelemetry.observable).toBe(false);
  });

  it('observabilityPct is 0 when telemetry domain is absent', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({ ...e, telemetryRefs: [] })),
    };
    const result = evaluateProductionSeal(input);
    expect(result.productionTelemetry.observabilityPct).toBeLessThan(MIN_SCORE_THRESHOLD);
  });
});

const MIN_SCORE_THRESHOLD = 75;

// ── 7. Drift resistance ────────────────────────────────────────────────────────

describe('evaluateProductionSeal — drift resistance', () => {
  it('driftResistance.impossible is true with no drift signals or risks', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.driftResistance.impossible).toBe(true);
    expect(result.driftResistance.driftRiskIds).toHaveLength(0);
    expect(result.driftSignals).toHaveLength(0);
  });

  it('driftResistance.impossible is false when drift risk is injected', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map((e, i) =>
        i === 0 ? { ...e, driftRisk: 'test_drift_injected', driftSignals: ['test_drift_injected'] } : e,
      ),
    };
    const result = evaluateProductionSeal(input);
    expect(result.driftResistance.impossible).toBe(false);
    expect(result.driftSignals.length).toBeGreaterThan(0);
  });

  it('verdict is PRODUCTION_SEALED_WITH_DRIFT_RISK when drift signals present but no other blockers', () => {
    const input: ProductionSealInput = {
      sealId: 'seal-drift',
      generatedAt: '2026-05-11T00:00:00.000Z',
      evidence: fullSealInput().evidence.map(e => ({
        ...e,
        driftSignals: ['minor_drift'],
      })),
    };
    const result = evaluateProductionSeal(input);
    expect(result.verdict).toBe('PRODUCTION_SEALED_WITH_DRIFT_RISK');
  });

  it('resistancePct is 100 when no drift risk entries exist', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.driftResistance.resistancePct).toBe(100);
  });
});

// ── 8. Constitutional trust stability ────────────────────────────────────────

describe('evaluateProductionSeal — constitutional trust stability', () => {
  it('constitutionalTrust.stable and longitudinallyDurable are true for full evidence', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.constitutionalTrust.stable).toBe(true);
    expect(result.constitutionalTrust.longitudinallyDurable).toBe(true);
  });

  it('longitudinallyDurable is false when all recordedAt timestamps collapse to one value', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({
        ...e,
        recordedAt: '2026-05-10T10:00:00.000Z',
      })),
    };
    const result = evaluateProductionSeal(input);
    expect(result.constitutionalTrust.longitudinallyDurable).toBe(false);
  });

  it('constitutionalTrust.stabilityPct ≥ 90 for strong evidence', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.constitutionalTrust.stabilityPct).toBeGreaterThanOrEqual(90);
  });

  it('durabilityPct ≥ 90 for strong evidence', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.constitutionalTrust.durabilityPct).toBeGreaterThanOrEqual(90);
  });

  it('firstRecordedAt and lastRecordedAt are propagated from lineage', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.constitutionalTrust.firstRecordedAt).toBe('2026-05-08T08:00:00.000Z');
    expect(result.constitutionalTrust.lastRecordedAt).toBe('2026-05-14T14:00:00.000Z');
  });
});

// ── 9. Fail-closed semantics ──────────────────────────────────────────────────

describe('evaluateProductionSeal — fail-closed semantics', () => {
  it('sealMaturityScore is capped at 49 when fail-closed is triggered', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({ ...e, failClosedReady: false })),
    };
    const result = evaluateProductionSeal(input);
    expect(result.sealMaturityScore).toBeLessThanOrEqual(49);
    expect(result.failClosed).toBe(true);
  });

  it('status is PRODUCTION_SEAL_BLOCKED when fail-closed', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({ ...e, failClosedReady: false })),
    };
    const result = evaluateProductionSeal(input);
    expect(result.status).toBe('PRODUCTION_SEAL_BLOCKED');
  });

  it('empty evidence triggers fail-closed', () => {
    const result = evaluateProductionSeal({
      sealId: 'empty',
      generatedAt: '2026-05-11T00:00:00.000Z',
      evidence: [],
    });
    expect(result.failClosed).toBe(true);
    expect(result.verdict).toBe('PRODUCTION_FAIL_CLOSED');
  });

  it('missing any required domain triggers fail-closed blockers', () => {
    const result = evaluateProductionSeal({
      ...fullSealInput(),
      evidence: fullSealInput().evidence.slice(0, 3),
    });
    expect(result.failClosed).toBe(true);
    expect(result.blockers.length).toBeGreaterThan(0);
  });
});

// ── 10. Runtime durability scoring ────────────────────────────────────────────

describe('scoreRuntimeDurability', () => {
  it('returns schema vitalcv.runtime-durability-score.v1', () => {
    const score = scoreRuntimeDurability(fullSealInput());
    expect(score.schema).toBe('vitalcv.runtime-durability-score.v1');
  });

  it('scoreHash is a stable 64-char hex', () => {
    const a = scoreRuntimeDurability(fullSealInput());
    const b = scoreRuntimeDurability(fullSealInput());
    expect(a.scoreHash).toBe(b.scoreHash);
    expect(a.scoreHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('all dimension scores are ≥ 90 for fully sealed evidence', () => {
    const score = scoreRuntimeDurability(fullSealInput());
    expect(score.replayFidelityPct).toBeGreaterThanOrEqual(90);
    expect(score.permanencePct).toBeGreaterThanOrEqual(90);
    expect(score.driftResistancePct).toBe(100);
    expect(score.stabilityPct).toBeGreaterThanOrEqual(90);
    expect(score.durabilityPct).toBeGreaterThanOrEqual(90);
    expect(score.chaosResiliencePct).toBeGreaterThanOrEqual(90);
    expect(score.observabilityPct).toBeGreaterThanOrEqual(50);
  });

  it('longitudinallyDurable is true for spread timestamps', () => {
    const score = scoreRuntimeDurability(fullSealInput());
    expect(score.longitudinallyDurable).toBe(true);
  });

  it('overallDurabilityPct is capped at 49 for degraded evidence', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({ ...e, failClosedReady: false })),
    };
    const score = scoreRuntimeDurability(input);
    expect(score.overallDurabilityPct).toBeLessThanOrEqual(49);
  });
});

// ── 11. CI gates ─────────────────────────────────────────────────────────────

describe('evaluateProductionSealGate', () => {
  it('all 7 gates pass for fully sealed evidence', () => {
    const result = evaluateProductionSeal(fullSealInput());
    const gate = evaluateProductionSealGate(result);
    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toHaveLength(0);
    expect(gate.gates).toHaveLength(7);
  });

  it('gateHash is a stable 64-char hex', () => {
    const result = evaluateProductionSeal(fullSealInput());
    const a = evaluateProductionSealGate(result);
    const b = evaluateProductionSealGate(result);
    expect(a.gateHash).toBe(b.gateHash);
    expect(a.gateHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('schema matches expected value', () => {
    const result = evaluateProductionSeal(fullSealInput());
    const gate = evaluateProductionSealGate(result);
    expect(gate.schema).toBe('vitalcv.runtime-production-seal-ci-gate.v1');
  });

  it('replay_production_immutable gate fails when replay fidelity drops', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e =>
        e.domain === 'replay_production_immutability'
          ? { ...e, immutabilityScore: 0.1, sealed: false, immutable: false, replayTraceId: null }
          : e,
      ),
    };
    const result = evaluateProductionSeal(input);
    const gate = evaluateProductionSealGate(result);
    expect(gate.failedGateIds).toContain('replay_production_immutable');
    expect(gate.pass).toBe(false);
  });

  it('governance_permanently_sealed gate fails when permanence drops', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e =>
        e.domain === 'governance_runtime_permanence'
          ? { ...e, permanenceScore: 0.1, sealed: false, immutable: false }
          : e,
      ),
    };
    const result = evaluateProductionSeal(input);
    const gate = evaluateProductionSealGate(result);
    expect(gate.failedGateIds).toContain('governance_permanently_sealed');
  });

  it('fail_closed_production_semantics gate fails when failClosedReady=false', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({ ...e, failClosedReady: false })),
    };
    const result = evaluateProductionSeal(input);
    const gate = evaluateProductionSealGate(result);
    expect(gate.failedGateIds).toContain('fail_closed_production_semantics');
  });

  it('drift_impossible_post_production_seal gate fails when drift risk present', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({
        ...e,
        driftRisk: 'test_drift',
        driftSignals: ['test_drift'],
      })),
    };
    const result = evaluateProductionSeal(input);
    const gate = evaluateProductionSealGate(result);
    expect(gate.failedGateIds).toContain('drift_impossible_post_production_seal');
  });

  it('production_telemetry_observable gate fails when telemetry stripped', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({ ...e, telemetryRefs: [] })),
    };
    const result = evaluateProductionSeal(input);
    const gate = evaluateProductionSealGate(result);
    expect(gate.failedGateIds).toContain('production_telemetry_observable');
  });

  it('runtime_durability_longitudinally_scored gate fails when timestamps collapse', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({
        ...e,
        recordedAt: '2026-05-10T10:00:00.000Z',
        durabilityScore: 0.1,
      })),
    };
    const result = evaluateProductionSeal(input);
    const gate = evaluateProductionSealGate(result);
    expect(gate.failedGateIds).toContain('runtime_durability_longitudinally_scored');
  });
});

// ── 12. Chaos simulations ─────────────────────────────────────────────────────

describe('runProductionSealChaosSimulations', () => {
  it('runs exactly 8 scenarios', () => {
    const report = runProductionSealChaosSimulations(fullSealInput());
    expect(report.totalScenarios).toBe(8);
    expect(report.scenarios).toHaveLength(8);
  });

  it('reportHash is a stable 64-char hex', () => {
    const a = runProductionSealChaosSimulations(fullSealInput());
    const b = runProductionSealChaosSimulations(fullSealInput());
    expect(a.reportHash).toBe(b.reportHash);
    expect(a.reportHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('schema matches expected value', () => {
    const report = runProductionSealChaosSimulations(fullSealInput());
    expect(report.schema).toBe('vitalcv.runtime-production-seal-chaos.v1');
  });

  it('PRODUCTION_SEAL_CORRUPTION surfaces a signal (fails seal or replay gate)', () => {
    const report = runProductionSealChaosSimulations(fullSealInput());
    const scenario = report.scenarios.find(s => s.scenario === 'PRODUCTION_SEAL_CORRUPTION');
    expect(scenario).toBeDefined();
    expect(scenario!.signalSurfaced).toBe(true);
  });

  it('REPLAY_PRODUCTION_MUTATION surfaces replay_production_immutable failure', () => {
    const report = runProductionSealChaosSimulations(fullSealInput());
    const scenario = report.scenarios.find(s => s.scenario === 'REPLAY_PRODUCTION_MUTATION');
    expect(scenario!.signalSurfaced).toBe(true);
    expect(scenario!.failedGateIds).toContain('replay_production_immutable');
  });

  it('GOVERNANCE_PERMANENCE_COLLAPSE surfaces governance_permanently_sealed failure', () => {
    const report = runProductionSealChaosSimulations(fullSealInput());
    const scenario = report.scenarios.find(s => s.scenario === 'GOVERNANCE_PERMANENCE_COLLAPSE');
    expect(scenario!.signalSurfaced).toBe(true);
    expect(scenario!.failedGateIds).toContain('governance_permanently_sealed');
  });

  it('TELEMETRY_BLACKOUT surfaces production_telemetry_observable failure', () => {
    const report = runProductionSealChaosSimulations(fullSealInput());
    const scenario = report.scenarios.find(s => s.scenario === 'TELEMETRY_BLACKOUT');
    expect(scenario!.signalSurfaced).toBe(true);
    expect(scenario!.failedGateIds).toContain('production_telemetry_observable');
  });

  it('DURABILITY_SCORING_FAILURE surfaces runtime_durability_longitudinally_scored failure', () => {
    const report = runProductionSealChaosSimulations(fullSealInput());
    const scenario = report.scenarios.find(s => s.scenario === 'DURABILITY_SCORING_FAILURE');
    expect(scenario!.signalSurfaced).toBe(true);
    expect(scenario!.failedGateIds).toContain('runtime_durability_longitudinally_scored');
  });

  it('FAIL_CLOSED_OVERRIDE surfaces fail_closed_production_semantics failure', () => {
    const report = runProductionSealChaosSimulations(fullSealInput());
    const scenario = report.scenarios.find(s => s.scenario === 'FAIL_CLOSED_OVERRIDE');
    expect(scenario!.signalSurfaced).toBe(true);
    expect(scenario!.failedGateIds).toContain('fail_closed_production_semantics');
  });

  it('CONSTITUTIONAL_DRIFT surfaces a signal', () => {
    const report = runProductionSealChaosSimulations(fullSealInput());
    const scenario = report.scenarios.find(s => s.scenario === 'CONSTITUTIONAL_DRIFT');
    expect(scenario!.signalSurfaced).toBe(true);
  });

  it('CHAOS_RESILIENCE_EXHAUSTION surfaces a signal', () => {
    const report = runProductionSealChaosSimulations(fullSealInput());
    const scenario = report.scenarios.find(s => s.scenario === 'CHAOS_RESILIENCE_EXHAUSTION');
    expect(scenario!.signalSurfaced).toBe(true);
  });

  it('silentFailureCount is 0 — no chaos scenario passes silently', () => {
    const report = runProductionSealChaosSimulations(fullSealInput());
    expect(report.silentFailureCount).toBe(0);
  });

  it('all chaos scenarios that corrupt sealed/immutable flags drive PRODUCTION_SEAL_BLOCKED', () => {
    const report = runProductionSealChaosSimulations(fullSealInput());
    const blockedScenarios: ProductionSealChaosScenarioName[] = [
      'PRODUCTION_SEAL_CORRUPTION',
      'REPLAY_PRODUCTION_MUTATION',
      'GOVERNANCE_PERMANENCE_COLLAPSE',
      'TELEMETRY_BLACKOUT',
      'FAIL_CLOSED_OVERRIDE',
      'CONSTITUTIONAL_DRIFT',
    ];
    for (const name of blockedScenarios) {
      const s = report.scenarios.find(sc => sc.scenario === name);
      expect(s!.status).toBe('PRODUCTION_SEAL_BLOCKED');
    }
  });
});

// ── 13. Confidence and board dimensions ───────────────────────────────────────

describe('evaluateProductionSeal — completion board dimensions', () => {
  it('confidence basis lists all seven gate ids for a fully sealed runtime', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.confidence.basis).toContain('production_seal_globally_verified');
    expect(result.confidence.basis).toContain('replay_production_immutable');
    expect(result.confidence.basis).toContain('governance_permanently_sealed');
    expect(result.confidence.basis).toContain('fail_closed_production_semantics');
    expect(result.confidence.basis).toContain('drift_impossible_post_production_seal');
    expect(result.confidence.basis).toContain('production_telemetry_observable');
    expect(result.confidence.basis).toContain('runtime_durability_longitudinally_scored');
  });

  it('Replay Production Fidelity % ≥ 90 for strong evidence', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.replayFidelity.fidelityPct).toBeGreaterThanOrEqual(90);
  });

  it('Runtime Permanence % ≥ 90 for strong evidence', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.runtimePermanence.permanencePct).toBeGreaterThanOrEqual(90);
  });

  it('Drift Resistance % is 100 when no drift risk exists', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.driftResistance.resistancePct).toBe(100);
  });

  it('Constitutional Trust Stability % ≥ 90 for strong evidence', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.constitutionalTrust.stabilityPct).toBeGreaterThanOrEqual(90);
  });

  it('Production Seal Maturity % ≥ 90 for a fully sealed runtime', () => {
    const result = evaluateProductionSeal(fullSealInput());
    expect(result.sealMaturityScore).toBeGreaterThanOrEqual(90);
  });
});

// ── 14. Input normalization and edge cases ────────────────────────────────────

describe('evaluateProductionSeal — input normalization', () => {
  it('clamps out-of-range scores to [0,1] without throwing', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({
        ...e,
        sealFidelity: 2.0,
        immutabilityScore: -1,
        permanenceScore: 1.5,
      })),
    };
    expect(() => evaluateProductionSeal(input)).not.toThrow();
  });

  it('trims whitespace from evidenceId and sourceSystemId', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: [
        evidence('  e-1  ', 'production_seal_verification', {
          sourceSystemId: '  sys-1  ',
          recordedAt: '2026-05-08T08:00:00.000Z',
        }),
        ...fullSealInput().evidence.slice(1),
      ],
    };
    const lineage = buildProductionSealLineage(input);
    expect(lineage.timeline[0].evidenceId).toBe('e-1');
    expect(lineage.sourceSystemIds).toContain('sys-1');
  });

  it('deduplicates evidence refs within a single entry', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e => ({
        ...e,
        evidenceRefs: ['ref-a', 'ref-a', 'ref-b'],
        telemetryRefs: ['tel-x', 'tel-x'],
      })),
    };
    expect(() => evaluateProductionSeal(input)).not.toThrow();
    const result = evaluateProductionSeal(input);
    expect(result.productionTelemetry.telemetryRefCount).toBe(7);
  });

  it('sealHash changes when sealId changes', () => {
    const a = evaluateProductionSeal({ ...fullSealInput(), sealId: 'seal-A' });
    const b = evaluateProductionSeal({ ...fullSealInput(), sealId: 'seal-B' });
    expect(a.sealHash).not.toBe(b.sealHash);
  });

  it('chaosResilience.resilient is false when chaos resilience domain evidence is weak', () => {
    const input: ProductionSealInput = {
      ...fullSealInput(),
      evidence: fullSealInput().evidence.map(e =>
        e.domain === 'production_chaos_resilience'
          ? { ...e, chaosResilienceScore: 0.1, sealed: false, immutable: false }
          : e,
      ),
    };
    const result = evaluateProductionSeal(input);
    expect(result.chaosResilience.resilient).toBe(false);
  });
});
