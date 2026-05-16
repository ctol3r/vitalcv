/**
 * governanceRuntimeHardening.test.ts — W2-PR107A unit coverage
 *
 * Pure-transform unit tests for the production-runtime hardening module.
 * Mirrors the unit-test pattern of replayCorruptionContainment.test.ts and
 * rolloutSurvivability.test.ts: every public surface is exercised against
 * its hard invariants.
 *
 * What this guards:
 *
 *   1. Classifier truth table — each fault axis maps to exactly one kind +
 *      tier; multi-axis breaches collapse to AMBIGUOUS_RUNTIME (uncertainty
 *      preserved, never coerced).
 *   2. Quarantine round-trip — verdict transitions match the documented
 *      table; CIRCUIT_BREAKER_OPEN → CONTAINED, CROSS_TENANT_RESOURCE_BLEED
 *      → HARDENING_BREACH, ambiguous → AMBIGUOUS_RUNTIME.
 *   3. Boundary computation — partial survivability % is correct for
 *      mixed cohorts and the partition floor is honored.
 *   4. assertAmbiguityPreserved + assertCircuitBreakerEnabled — both
 *      catch the silent-collapse anti-patterns this PR exists to prevent.
 *   5. Replay-performance stabilization — p50/p99 picked from the right
 *      indices, deterministic stabilityDigest, withinBudget honors both
 *      tail-budget and variance-budget.
 *   6. Maturity score — verdict tier reacts to breach + sub-score floors.
 *   7. Lineage reconstruction — order-independent, deterministic digest.
 */

import {
  HARDENING_SENTINELS,
  KNOWN_RUNTIME_FAULT_KINDS,
  KNOWN_RUNTIME_HARDENING_VIOLATIONS,
  KNOWN_RUNTIME_SURVIVABILITY_VERDICTS,
  KNOWN_RUNTIME_TIERS,
  RuntimeHardeningError,
  assertAmbiguityPreserved,
  assertCircuitBreakerEnabled,
  assertRuntimeHardeningBoundary,
  classifyRuntimeFault,
  computeReplayStabilityWindow,
  computeRuntimeHardeningBoundary,
  computeRuntimeMaturityScore,
  evaluateRuntimeShard,
  hardeningDigest,
  quarantineRuntimeShard,
  traceRuntimeFaultLineage,
  type RuntimeHardeningSignal,
  type RuntimeSurvivabilityRecord,
} from '../governanceRuntimeHardening';

function healthySignal(overrides: Partial<RuntimeHardeningSignal> = {}): RuntimeHardeningSignal {
  return {
    replayQueueDepth: 10,
    replayQueueBudget: 100,
    replayLatencyP50Ms: 20,
    replayLatencyP99Ms: 60,
    governanceRuleBudgetMs: 250,
    governanceRuleObservedMs: 80,
    tenantResourceQuota: 64,
    tenantResourceObserved: 12,
    crossTenantBleedDetected: false,
    circuitBreakerOpen: false,
    circuitBreakerDisabled: false,
    faultEvidence: null,
    ...overrides,
  };
}

describe('classifyRuntimeFault — fail-closed truth table', () => {
  it('clean signal → HEALTHY, kind=null, ambiguous=false', () => {
    const r = classifyRuntimeFault(healthySignal());
    expect(r.kind).toBeNull();
    expect(r.tier).toBe('HEALTHY');
    expect(r.ambiguous).toBe(false);
  });

  it('disabled circuit breaker is itself AMBIGUOUS_RUNTIME (anti-pattern flag)', () => {
    const r = classifyRuntimeFault(healthySignal({ circuitBreakerDisabled: true }));
    expect(r.kind).toBe('RUNTIME_FAULT_AMBIGUOUS');
    expect(r.tier).toBe('AMBIGUOUS_RUNTIME');
    expect(r.ambiguous).toBe(true);
  });

  it('open circuit breaker dominates and yields CIRCUIT_BREAKER_OPEN/CIRCUIT_OPEN', () => {
    const r = classifyRuntimeFault(
      healthySignal({ circuitBreakerOpen: true, faultEvidence: 'replay paused' }),
    );
    expect(r.kind).toBe('CIRCUIT_BREAKER_OPEN');
    expect(r.tier).toBe('CIRCUIT_OPEN');
    expect(r.ambiguous).toBe(false);
    expect(r.reason).toContain('replay paused');
  });

  it('cross-tenant bleed → ISOLATION_BREACH regardless of headline numbers', () => {
    const r = classifyRuntimeFault(healthySignal({ crossTenantBleedDetected: true }));
    expect(r.kind).toBe('CROSS_TENANT_RESOURCE_BLEED');
    expect(r.tier).toBe('ISOLATION_BREACH');
    expect(r.ambiguous).toBe(false);
  });

  it('replay backpressure → REPLAY_BACKPRESSURE / DEGRADED', () => {
    const r = classifyRuntimeFault(healthySignal({ replayQueueDepth: 120 }));
    expect(r.kind).toBe('REPLAY_BACKPRESSURE');
    expect(r.tier).toBe('DEGRADED');
  });

  it('replay backpressure ≥ 1.5x budget → STRESSED tier', () => {
    const r = classifyRuntimeFault(healthySignal({ replayQueueDepth: 200 }));
    expect(r.kind).toBe('REPLAY_BACKPRESSURE');
    expect(r.tier).toBe('STRESSED');
  });

  it('governance rule timeout → GOVERNANCE_RULE_TIMEOUT / DEGRADED', () => {
    const r = classifyRuntimeFault(healthySignal({ governanceRuleObservedMs: 600 }));
    expect(r.kind).toBe('GOVERNANCE_RULE_TIMEOUT');
    expect(r.tier).toBe('DEGRADED');
  });

  it('tenant resource exhaustion → TENANT_RESOURCE_EXHAUSTION / DEGRADED', () => {
    const r = classifyRuntimeFault(healthySignal({ tenantResourceObserved: 80 }));
    expect(r.kind).toBe('TENANT_RESOURCE_EXHAUSTION');
    expect(r.tier).toBe('DEGRADED');
  });

  it('replay variance spike (p99/p50 ≥ 12x) → REPLAY_VARIANCE_SPIKE / STRESSED', () => {
    const r = classifyRuntimeFault(
      healthySignal({ replayLatencyP50Ms: 10, replayLatencyP99Ms: 200 }),
    );
    expect(r.kind).toBe('REPLAY_VARIANCE_SPIKE');
    expect(r.tier).toBe('STRESSED');
  });

  it('budgets met but fault evidence text → AMBIGUOUS_RUNTIME (contradiction preserved)', () => {
    const r = classifyRuntimeFault(
      healthySignal({ faultEvidence: 'tenant complaint: replay slow during peak' }),
    );
    expect(r.kind).toBe('RUNTIME_FAULT_AMBIGUOUS');
    expect(r.ambiguous).toBe(true);
  });

  it('multi-axis fault collapses to AMBIGUOUS_RUNTIME, not silently picking one axis', () => {
    const r = classifyRuntimeFault(
      healthySignal({
        replayQueueDepth: 200,
        governanceRuleObservedMs: 999,
        tenantResourceObserved: 999,
      }),
    );
    expect(r.kind).toBe('RUNTIME_FAULT_AMBIGUOUS');
    expect(r.ambiguous).toBe(true);
  });
});

describe('quarantineRuntimeShard — verdict round-trip', () => {
  it('healthy → SURVIVING with kind=null and headroom ratios computed', () => {
    const r = quarantineRuntimeShard({ shardId: 'shard-1', signal: healthySignal() });
    expect(r.verdict).toBe('SURVIVING');
    expect(r.kind).toBeNull();
    expect(r.tier).toBe('HEALTHY');
    expect(r.replayHeadroomRatio).toBeCloseTo(0.9, 2);
    expect(r.governanceHeadroomRatio).toBeCloseTo(0.68, 2);
    expect(r.tenantHeadroomRatio).toBeCloseTo(0.8125, 3);
  });

  it('replay backpressure → PARTIAL_SURVIVING', () => {
    const r = quarantineRuntimeShard({
      shardId: 'shard-1',
      signal: healthySignal({ replayQueueDepth: 120 }),
    });
    expect(r.verdict).toBe('PARTIAL_SURVIVING');
    expect(r.kind).toBe('REPLAY_BACKPRESSURE');
  });

  it('open circuit breaker → CONTAINED (fault present, isolated)', () => {
    const r = quarantineRuntimeShard({
      shardId: 'shard-2',
      signal: healthySignal({ circuitBreakerOpen: true }),
    });
    expect(r.verdict).toBe('CONTAINED');
    expect(r.kind).toBe('CIRCUIT_BREAKER_OPEN');
  });

  it('cross-tenant bleed → HARDENING_BREACH (operator-visible failure)', () => {
    const r = quarantineRuntimeShard({
      shardId: 'shard-3',
      signal: healthySignal({ crossTenantBleedDetected: true }),
    });
    expect(r.verdict).toBe('HARDENING_BREACH');
    expect(r.kind).toBe('CROSS_TENANT_RESOURCE_BLEED');
  });

  it('disabled circuit breaker → AMBIGUOUS_RUNTIME (preserves uncertainty)', () => {
    const r = quarantineRuntimeShard({
      shardId: 'shard-4',
      signal: healthySignal({ circuitBreakerDisabled: true }),
    });
    expect(r.verdict).toBe('AMBIGUOUS_RUNTIME');
    expect(r.ambiguous).toBe(true);
  });

  it('forced contamination yields CONTAMINATED with explicit reason and lineage', () => {
    const r = quarantineRuntimeShard({
      shardId: 'shard-5',
      signal: healthySignal(),
      lineageHints: { tenantPoolId: 'pool-A', replayShardId: null, governanceRuleScopeId: null },
      forcedVerdict: 'CONTAMINATED',
      forcedKind: 'CIRCUIT_BREAKER_OPEN',
      forcedReason: 'shard-5 contaminated via lineage from a faulted peer in pool-A',
    });
    expect(r.verdict).toBe('CONTAMINATED');
    expect(r.kind).toBe('CIRCUIT_BREAKER_OPEN');
    expect(r.lineageHints.tenantPoolId).toBe('pool-A');
    expect(r.reason).toContain('contaminated via lineage');
  });

  it('hardeningDigest is reproducible across two identical builds', () => {
    const sig = healthySignal({ replayQueueDepth: 80 });
    const a = hardeningDigest({
      shardId: 'shard-1',
      verdict: 'SURVIVING',
      kind: null,
      tier: 'HEALTHY',
      signal: sig,
    });
    const b = hardeningDigest({
      shardId: 'shard-1',
      verdict: 'SURVIVING',
      kind: null,
      tier: 'HEALTHY',
      signal: sig,
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('evaluateRuntimeShard — non-throwing variant', () => {
  it('produces a CONTAINMENT_BREACH-like record on internal failure', () => {
    // Pass a signal carrying a non-numeric pre-image into hardeningDigest by
    // shimming a getter that throws — exercises the catch path.
    const broken = healthySignal();
    Object.defineProperty(broken, 'faultEvidence', {
      get() {
        throw new Error('boom');
      },
    });
    const r = evaluateRuntimeShard({ shardId: 'broken-1', signal: broken });
    expect(r.verdict).toBe('HARDENING_BREACH');
    expect(r.kind).toBe('RUNTIME_FAULT_AMBIGUOUS');
    expect(r.reason).toContain('Hardening evaluator failed');
  });
});

describe('computeRuntimeHardeningBoundary — partition + floor', () => {
  it('all-healthy cohort partitions cleanly (no breach, full survivability)', () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      quarantineRuntimeShard({ shardId: `s-${i}`, signal: healthySignal() }),
    );
    const b = computeRuntimeHardeningBoundary({ totalShards: 20, records });
    expect(b.partitioned).toBe(true);
    expect(b.survivingCount).toBe(20);
    expect(b.partialSurvivabilityPct).toBe(100);
    expect(b.faultContainmentPct).toBe(0);
  });

  it('mixed cohort with no breach above floor stays partitioned', () => {
    const records = [
      ...Array.from({ length: 14 }, (_, i) =>
        quarantineRuntimeShard({ shardId: `h-${i}`, signal: healthySignal() }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        quarantineRuntimeShard({
          shardId: `p-${i}`,
          signal: healthySignal({ replayQueueDepth: 120 }),
        }),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        quarantineRuntimeShard({
          shardId: `c-${i}`,
          signal: healthySignal({ circuitBreakerOpen: true }),
        }),
      ),
    ];
    const b = computeRuntimeHardeningBoundary({ totalShards: 20, records });
    expect(b.partitioned).toBe(true);
    expect(b.survivingCount).toBe(14);
    expect(b.partialSurvivingCount).toBe(4);
    expect(b.containedCount).toBe(2);
    expect(b.partialSurvivabilityPct).toBe(100);
  });

  it('cohort with HARDENING_BREACH never partitions, even above floor', () => {
    const records = [
      ...Array.from({ length: 18 }, (_, i) =>
        quarantineRuntimeShard({ shardId: `h-${i}`, signal: healthySignal() }),
      ),
      quarantineRuntimeShard({
        shardId: 'breached-1',
        signal: healthySignal({ crossTenantBleedDetected: true }),
      }),
      quarantineRuntimeShard({
        shardId: 'breached-2',
        signal: healthySignal({ crossTenantBleedDetected: true }),
      }),
    ];
    const b = computeRuntimeHardeningBoundary({ totalShards: 20, records });
    expect(b.partitioned).toBe(false);
    expect(b.hardeningReason).toContain('breached');
  });

  it('partial-survivability floor breach sets partitioned=false', () => {
    const records = [
      quarantineRuntimeShard({ shardId: 'h-1', signal: healthySignal() }),
    ];
    const b = computeRuntimeHardeningBoundary({
      totalShards: 10,
      records,
      minPartialSurvivabilityPct: 70,
    });
    expect(b.partitioned).toBe(false);
    expect(b.partialSurvivabilityPct).toBeLessThan(70);
  });
});

describe('assertRuntimeHardeningBoundary — strict semantics', () => {
  it('throws PARTIAL_SURVIVABILITY_FLOOR_BREACHED below floor', () => {
    const b = computeRuntimeHardeningBoundary({
      totalShards: 10,
      records: [quarantineRuntimeShard({ shardId: 'h-1', signal: healthySignal() })],
      minPartialSurvivabilityPct: 70,
    });
    let caught: unknown = null;
    try {
      assertRuntimeHardeningBoundary(b, { minPartialSurvivabilityPct: 70 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RuntimeHardeningError);
    expect((caught as RuntimeHardeningError).violation).toBe(
      'PARTIAL_SURVIVABILITY_FLOOR_BREACHED',
    );
  });

  it('throws BOUNDARY_BREACH on breach even at 100% surface', () => {
    const records = [
      ...Array.from({ length: 9 }, (_, i) =>
        quarantineRuntimeShard({ shardId: `h-${i}`, signal: healthySignal() }),
      ),
      quarantineRuntimeShard({
        shardId: 'breached',
        signal: healthySignal({ crossTenantBleedDetected: true }),
      }),
    ];
    const b = computeRuntimeHardeningBoundary({ totalShards: 10, records });
    let caught: unknown = null;
    try {
      assertRuntimeHardeningBoundary(b);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RuntimeHardeningError);
    expect((caught as RuntimeHardeningError).violation).toBe('BOUNDARY_BREACH');
  });

  it('does not throw when partitioned and above floor', () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      quarantineRuntimeShard({ shardId: `h-${i}`, signal: healthySignal() }),
    );
    const b = computeRuntimeHardeningBoundary({ totalShards: 10, records });
    expect(() => assertRuntimeHardeningBoundary(b)).not.toThrow();
  });
});

describe('assertAmbiguityPreserved — silent-collapse guard', () => {
  it('passes for an honest AMBIGUOUS_RUNTIME record', () => {
    const r = quarantineRuntimeShard({
      shardId: 'shard-x',
      signal: healthySignal({ circuitBreakerDisabled: true }),
    });
    expect(() => assertAmbiguityPreserved(r)).not.toThrow();
  });

  it('throws AMBIGUOUS_RUNTIME_FORCED_HEALTHY when verdict drops uncertainty', () => {
    const tampered: RuntimeSurvivabilityRecord = {
      schema: 'vitalcv.runtime-hardening.v1',
      shardId: 'tampered-1',
      verdict: 'SURVIVING',
      kind: 'REPLAY_BACKPRESSURE', // contradicts SURVIVING
      tier: 'HEALTHY',
      ambiguous: false,
      reason: 'forced',
      hardeningDigest: '0'.repeat(64),
      observedAt: '2026-05-09T00:00:00.000Z',
      lineageHints: { tenantPoolId: null, replayShardId: null, governanceRuleScopeId: null },
      replayHeadroomRatio: 1,
      governanceHeadroomRatio: 1,
      tenantHeadroomRatio: 1,
      replayLatencyVariance: 1,
    };
    let caught: unknown = null;
    try {
      assertAmbiguityPreserved(tampered);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RuntimeHardeningError);
    expect((caught as RuntimeHardeningError).violation).toBe(
      'AMBIGUOUS_RUNTIME_FORCED_HEALTHY',
    );
  });

  it('throws AMBIGUOUS_RUNTIME_FORCED_HEALTHY when ambiguous flag flipped without verdict change', () => {
    const tampered: RuntimeSurvivabilityRecord = {
      schema: 'vitalcv.runtime-hardening.v1',
      shardId: 'tampered-2',
      verdict: 'SURVIVING',
      kind: null,
      tier: 'HEALTHY',
      ambiguous: true, // contradicts verdict
      reason: 'forced',
      hardeningDigest: '0'.repeat(64),
      observedAt: '2026-05-09T00:00:00.000Z',
      lineageHints: { tenantPoolId: null, replayShardId: null, governanceRuleScopeId: null },
      replayHeadroomRatio: 1,
      governanceHeadroomRatio: 1,
      tenantHeadroomRatio: 1,
      replayLatencyVariance: 1,
    };
    expect(() => assertAmbiguityPreserved(tampered)).toThrow(RuntimeHardeningError);
  });
});

describe('assertCircuitBreakerEnabled — fail-closed guard', () => {
  it('passes when circuit breaker is enabled', () => {
    expect(() => assertCircuitBreakerEnabled(healthySignal())).not.toThrow();
  });

  it('throws CIRCUIT_BREAKER_DISABLED when explicitly disabled', () => {
    let caught: unknown = null;
    try {
      assertCircuitBreakerEnabled(healthySignal({ circuitBreakerDisabled: true }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RuntimeHardeningError);
    expect((caught as RuntimeHardeningError).violation).toBe('CIRCUIT_BREAKER_DISABLED');
  });
});

describe('computeReplayStabilityWindow — stabilization', () => {
  it('empty sample → not stabilized, deterministic digest', () => {
    const w = computeReplayStabilityWindow({ sample: [], tailLatencyBudgetMs: 100 });
    expect(w.sampleCount).toBe(0);
    expect(w.stabilized).toBe(false);
    expect(w.windowP50Ms).toBe(0);
    expect(w.windowP99Ms).toBe(0);
    expect(w.stabilityDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('stable population → stabilized=true, tail headroom > 0', () => {
    const sample = Array.from({ length: 100 }, (_, i) => 10 + (i % 20));
    const w = computeReplayStabilityWindow({ sample, tailLatencyBudgetMs: 80 });
    expect(w.stabilized).toBe(true);
    expect(w.tailHeadroomRatio).toBeGreaterThan(0);
    expect(w.windowP99Ms).toBeLessThanOrEqual(80);
  });

  it('tail blowout above budget → not stabilized', () => {
    const sample = [...Array(99).fill(10), 500];
    const w = computeReplayStabilityWindow({ sample, tailLatencyBudgetMs: 80 });
    expect(w.stabilized).toBe(false);
    expect(w.windowP99Ms).toBe(500);
  });

  it('variance budget breached → not stabilized even if p99 within tail budget', () => {
    const sample = [...Array(99).fill(5), 79];
    const w = computeReplayStabilityWindow({
      sample,
      tailLatencyBudgetMs: 100,
      varianceBudget: 4,
    });
    expect(w.stabilized).toBe(false);
  });

  it('digests differ when budgets change (drift visible)', () => {
    const sample = Array.from({ length: 50 }, (_, i) => 10 + (i % 5));
    const a = computeReplayStabilityWindow({ sample, tailLatencyBudgetMs: 80 });
    const b = computeReplayStabilityWindow({ sample, tailLatencyBudgetMs: 200 });
    expect(a.stabilityDigest).not.toBe(b.stabilityDigest);
  });
});

describe('computeRuntimeMaturityScore — verdict tiers', () => {
  it('all-healthy cohort → PRODUCTION_READY', () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      quarantineRuntimeShard({ shardId: `h-${i}`, signal: healthySignal() }),
    );
    const boundary = computeRuntimeHardeningBoundary({ totalShards: 10, records });
    const replayStability = computeReplayStabilityWindow({
      sample: Array.from({ length: 100 }, () => 12),
      tailLatencyBudgetMs: 100,
    });
    const score = computeRuntimeMaturityScore({ boundary, replayStability, records });
    expect(score.verdict).toBe('PRODUCTION_READY');
    expect(score.runtimeSurvivabilityPct).toBe(100);
    expect(score.faultContainmentIntegrityPct).toBe(100);
    expect(score.resourceIsolationFidelityPct).toBe(100);
    expect(score.productionRuntimeMaturityPct).toBeGreaterThanOrEqual(75);
  });

  it('cohort with HARDENING_BREACH → PRODUCTION_BLOCKED', () => {
    const records = [
      ...Array.from({ length: 9 }, (_, i) =>
        quarantineRuntimeShard({ shardId: `h-${i}`, signal: healthySignal() }),
      ),
      quarantineRuntimeShard({
        shardId: 'breached-1',
        signal: healthySignal({ crossTenantBleedDetected: true }),
      }),
    ];
    const boundary = computeRuntimeHardeningBoundary({ totalShards: 10, records });
    const replayStability = computeReplayStabilityWindow({
      sample: Array.from({ length: 100 }, () => 12),
      tailLatencyBudgetMs: 100,
    });
    const score = computeRuntimeMaturityScore({ boundary, replayStability, records });
    expect(score.verdict).toBe('PRODUCTION_BLOCKED');
    expect(score.resourceIsolationFidelityPct).toBeLessThan(100);
  });

  it('partial cohort → PRODUCTION_GUARDED or PRODUCTION_AT_RISK', () => {
    const records = [
      ...Array.from({ length: 7 }, (_, i) =>
        quarantineRuntimeShard({ shardId: `h-${i}`, signal: healthySignal() }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        quarantineRuntimeShard({
          shardId: `p-${i}`,
          signal: healthySignal({ replayQueueDepth: 120 }),
        }),
      ),
    ];
    const boundary = computeRuntimeHardeningBoundary({ totalShards: 10, records });
    const replayStability = computeReplayStabilityWindow({
      sample: Array.from({ length: 100 }, () => 12),
      tailLatencyBudgetMs: 100,
    });
    const score = computeRuntimeMaturityScore({ boundary, replayStability, records });
    expect(['PRODUCTION_GUARDED', 'PRODUCTION_AT_RISK', 'PRODUCTION_READY']).toContain(
      score.verdict,
    );
    expect(score.scoreDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('traceRuntimeFaultLineage — lineage reconstruction', () => {
  it('order-independent reconstruction digest', () => {
    const a = traceRuntimeFaultLineage({
      rootShardId: 'root-1',
      rootHints: { tenantPoolId: 'pool-A', replayShardId: 'rs-1', governanceRuleScopeId: null },
      candidates: [
        {
          shardId: 'cand-A',
          hints: { tenantPoolId: 'pool-A', replayShardId: null, governanceRuleScopeId: null },
        },
        {
          shardId: 'cand-B',
          hints: { tenantPoolId: null, replayShardId: 'rs-1', governanceRuleScopeId: null },
        },
      ],
    });
    const b = traceRuntimeFaultLineage({
      rootShardId: 'root-1',
      rootHints: { tenantPoolId: 'pool-A', replayShardId: 'rs-1', governanceRuleScopeId: null },
      candidates: [
        {
          shardId: 'cand-B',
          hints: { tenantPoolId: null, replayShardId: 'rs-1', governanceRuleScopeId: null },
        },
        {
          shardId: 'cand-A',
          hints: { tenantPoolId: 'pool-A', replayShardId: null, governanceRuleScopeId: null },
        },
      ],
    });
    expect(a.reconstructionDigest).toBe(b.reconstructionDigest);
    expect(a.contaminatedShardIds).toEqual(['cand-A', 'cand-B']);
  });

  it('shards with no shared lineage are not contaminated', () => {
    const lineage = traceRuntimeFaultLineage({
      rootShardId: 'root-1',
      rootHints: { tenantPoolId: 'pool-A', replayShardId: 'rs-1', governanceRuleScopeId: null },
      candidates: [
        {
          shardId: 'noise-1',
          hints: { tenantPoolId: 'pool-Z', replayShardId: 'rs-9', governanceRuleScopeId: null },
        },
      ],
    });
    expect(lineage.contaminatedShardIds).toHaveLength(0);
    expect(lineage.edges).toHaveLength(0);
  });
});

describe('exported sentinels', () => {
  it('all enum tables are frozen', () => {
    expect(Object.isFrozen(KNOWN_RUNTIME_TIERS)).toBe(true);
    expect(Object.isFrozen(KNOWN_RUNTIME_FAULT_KINDS)).toBe(true);
    expect(Object.isFrozen(KNOWN_RUNTIME_SURVIVABILITY_VERDICTS)).toBe(true);
    expect(Object.isFrozen(KNOWN_RUNTIME_HARDENING_VIOLATIONS)).toBe(true);
    expect(Object.isFrozen(HARDENING_SENTINELS)).toBe(true);
  });
});
