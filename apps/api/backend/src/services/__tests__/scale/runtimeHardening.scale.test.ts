/**
 * W2-PR107A — Production Governance Runtime Hardening (scale gate)
 *
 * Drives the runtime hardening surface under sustained institutional
 * production loads + chaos injection and asserts that the production
 * runtime boundary survives saturation without silent collapse.
 *
 * Invariants the gate exists to protect:
 *
 *   1. burst hardening — 5 000 shards classified back-to-back complete
 *      within the CI budget AND every record carries a distinct
 *      hardeningDigest (no record lost to hash collision).
 *   2. chaos survivability — a 1 000-shard cohort with 6 mixed C-RUNTIME-*
 *      chaos modes preserves verdict counts exactly. No silent
 *      reclassification.
 *   3. lineage scale survivability — a tenant pool with 1 000 children +
 *      4 000 unrelated shards reconstructs a lineage of exactly 1 000
 *      contaminated edges within the CI budget. No false positives.
 *   4. partial-survivability resilience floor — at the configured 70%
 *      floor, a cohort with 75% surviving + partial + ambiguous + contained
 *      remains partitioned; a cohort with 65% trips the boundary.
 *   5. ambiguity preservation under load — every disabled-breaker signal
 *      across the burst stays AMBIGUOUS_RUNTIME (zero coercion to SURVIVING).
 *   6. replay-performance stabilization — a 10 000-sample replay window
 *      computes p50/p99 in O(n log n) and produces a deterministic
 *      stabilityDigest under load.
 *   7. cross-tenant bleed always raises HARDENING_BREACH — fail-closed.
 *
 * Pure mock-free test — exercises the real production-runtime hardening
 * module. Lives under `__tests__/scale/` so the existing W2-PR38A
 * scale-gate.yml workflow picks it up via its
 * `__tests__/scale/.+\.scale\.test\.ts$` filter — no workflow change required
 * for the scale-gate side. The W2-PR107A trust-runtime gate runs the same
 * suite under its own filter so the two boards are independently auditable.
 */

import {
  RuntimeHardeningError,
  assertRuntimeHardeningBoundary,
  computeReplayStabilityWindow,
  computeRuntimeHardeningBoundary,
  computeRuntimeMaturityScore,
  quarantineRuntimeShard,
  traceRuntimeFaultLineage,
  type RuntimeHardeningSignal,
} from '../../governance/governanceRuntimeHardening';

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

describe('production runtime hardening scale (W2-PR107A scale gate)', () => {
  it('survives a 5 000-shard hardening burst without hardeningDigest collapse', () => {
    const N = 5_000;
    const digests = new Set<string>();
    const start = process.hrtime.bigint();

    for (let i = 0; i < N; i++) {
      // Rotate through six chaos modes so every shard's signal is distinct
      // → every digest must be distinct.
      const mode = i % 6;
      let signal: RuntimeHardeningSignal;
      switch (mode) {
        case 0: signal = healthySignal(); break;
        case 1: signal = healthySignal({ replayQueueDepth: 110 + (i % 30) }); break;
        case 2: signal = healthySignal({ governanceRuleObservedMs: 260 + (i % 50) }); break;
        case 3: signal = healthySignal({ tenantResourceObserved: 70 + (i % 20) }); break;
        case 4: signal = healthySignal({ circuitBreakerOpen: true, faultEvidence: `paused-${i}` }); break;
        default: signal = healthySignal({
          replayLatencyP50Ms: 5,
          replayLatencyP99Ms: 80 + (i % 50),
        }); break;
      }
      const r = quarantineRuntimeShard({ shardId: `shard-${i}`, signal });
      digests.add(r.hardeningDigest);
    }

    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const eventsPerSec = (N / elapsedMs) * 1000;
    const survivabilityPct = (digests.size / N) * 100;

    expect(digests.size).toBe(N);
    expect(elapsedMs).toBeLessThan(8_000);

    // eslint-disable-next-line no-console
    console.log(
      `[runtime-hardening-board] runtime-hardening-survivability-pct=${survivabilityPct.toFixed(2)} ` +
        `n=${N} shards_per_sec=${eventsPerSec.toFixed(0)} elapsed_ms=${elapsedMs.toFixed(0)}`,
    );
  });

  it('preserves verdict counts under a realistic 1 000-shard chaos cohort', () => {
    // Realistic 5:1:1:1:1:1 mix → surviving:partial:ambiguous:contained:contaminated:other
    const N = 1_000;
    const survivingTarget       = Math.round(N * 0.50);
    const partialTarget         = Math.round(N * 0.20);
    const ambiguousTarget       = Math.round(N * 0.10);
    const containedTarget       = Math.round(N * 0.10);
    const contaminatedTarget    = N - (survivingTarget + partialTarget + ambiguousTarget + containedTarget);

    const records = [];
    let idx = 0;

    for (let i = 0; i < survivingTarget; i++, idx++) {
      records.push(quarantineRuntimeShard({ shardId: `s-${idx}`, signal: healthySignal() }));
    }
    for (let i = 0; i < partialTarget; i++, idx++) {
      records.push(
        quarantineRuntimeShard({
          shardId: `s-${idx}`,
          signal: healthySignal({ replayQueueDepth: 120 }),
        }),
      );
    }
    for (let i = 0; i < ambiguousTarget; i++, idx++) {
      records.push(
        quarantineRuntimeShard({
          shardId: `s-${idx}`,
          signal: healthySignal({ circuitBreakerDisabled: true }),
        }),
      );
    }
    for (let i = 0; i < containedTarget; i++, idx++) {
      records.push(
        quarantineRuntimeShard({
          shardId: `s-${idx}`,
          signal: healthySignal({ circuitBreakerOpen: true }),
        }),
      );
    }
    for (let i = 0; i < contaminatedTarget; i++, idx++) {
      records.push(
        quarantineRuntimeShard({
          shardId: `s-${idx}`,
          signal: healthySignal(),
          forcedVerdict: 'CONTAMINATED',
          forcedKind: 'CIRCUIT_BREAKER_OPEN',
          forcedReason: `s-${idx} contaminated via lineage from a faulted peer.`,
        }),
      );
    }

    const b = computeRuntimeHardeningBoundary({
      totalShards: N,
      records,
      minPartialSurvivabilityPct: 70,
    });

    expect(b.survivingCount).toBe(survivingTarget);
    expect(b.partialSurvivingCount).toBe(partialTarget);
    expect(b.ambiguousCount).toBe(ambiguousTarget);
    expect(b.containedCount).toBe(containedTarget);
    expect(b.contaminatedCount).toBe(contaminatedTarget);

    // (50+20+10+10) / 100 = 90% ≥ 70% floor.
    expect(b.partitioned).toBe(true);
    expect(b.partialSurvivabilityPct).toBeGreaterThanOrEqual(70);

    // eslint-disable-next-line no-console
    console.log(
      `[runtime-hardening-board] runtime-mix-survivability ` +
        `surviving=${b.survivingCount} partial=${b.partialSurvivingCount} ` +
        `ambiguous=${b.ambiguousCount} contained=${b.containedCount} ` +
        `contaminated=${b.contaminatedCount} ` +
        `survivability-pct=${b.partialSurvivabilityPct.toFixed(2)} ` +
        `containment-pct=${b.faultContainmentPct.toFixed(2)} ` +
        `drift-visibility-pct=${b.runtimeDriftVisibilityPct.toFixed(2)}`,
    );
  });

  it('reconstructs a fault lineage of exactly 1 000 contaminated children among 5 000 candidates', () => {
    const ROOT = 'root-shard';
    const POOL = 'tenant-pool-mega';
    const CHILDREN = 1_000;
    const NOISE = 4_000;

    const candidates = [
      ...Array.from({ length: CHILDREN }, (_, i) => ({
        shardId: `child-${i}`,
        hints: { tenantPoolId: POOL, replayShardId: null, governanceRuleScopeId: null },
      })),
      ...Array.from({ length: NOISE }, (_, i) => ({
        shardId: `noise-${i}`,
        hints: {
          tenantPoolId: `noise-pool-${i % 50}`,
          replayShardId: null,
          governanceRuleScopeId: null,
        },
      })),
    ];

    const start = process.hrtime.bigint();
    const lineage = traceRuntimeFaultLineage({
      rootShardId: ROOT,
      rootHints: { tenantPoolId: POOL, replayShardId: null, governanceRuleScopeId: null },
      candidates,
    });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

    expect(lineage.contaminatedShardIds).toHaveLength(CHILDREN);
    expect(lineage.edges).toHaveLength(CHILDREN);
    expect(lineage.contaminatedShardIds).not.toContain(ROOT);
    expect(elapsedMs).toBeLessThan(2_000);

    // eslint-disable-next-line no-console
    console.log(
      `[runtime-hardening-board] runtime-lineage-scale ` +
        `contaminated=${lineage.contaminatedShardIds.length}/${CHILDREN} ` +
        `noise-rejected=${NOISE} ` +
        `elapsed_ms=${elapsedMs.toFixed(0)} ` +
        `digest=${lineage.reconstructionDigest.slice(0, 12)}`,
    );
  });

  it('resilience floor: 75% survives at floor=70, 65% trips it (fail-closed under load)', () => {
    const N = 1_000;

    // High cohort: 75% surviving → 75% > 70% floor → partitioned.
    const cohortHigh = [];
    for (let i = 0; i < N; i++) {
      const isResistant = i >= Math.floor(N * 0.75);
      cohortHigh.push(
        quarantineRuntimeShard({
          shardId: `hi-${i}`,
          signal: isResistant
            ? healthySignal({
                crossTenantBleedDetected: false,
                circuitBreakerOpen: false,
                replayQueueDepth: 999,
                replayQueueBudget: 100,
                governanceRuleObservedMs: 9999,
                tenantResourceObserved: 9999,
              })
            : healthySignal(),
        }),
      );
    }
    const bHigh = computeRuntimeHardeningBoundary({
      totalShards: N,
      records: cohortHigh,
      minPartialSurvivabilityPct: 70,
    });
    expect(bHigh.partitioned).toBe(true);
    expect(() =>
      assertRuntimeHardeningBoundary(bHigh, { minPartialSurvivabilityPct: 70 }),
    ).not.toThrow();

    // Low cohort: 65% surviving → resilience = 65% < 70% floor → boundary trip.
    // The faulted records here are HARDENING_BREACH (cross-tenant bleed) which
    // both fails the floor AND keeps a breach in the boundary — exactly the
    // production scenario the gate exists to catch.
    const cohortLow = [];
    for (let i = 0; i < N; i++) {
      const isFaulted = i >= Math.floor(N * 0.65);
      cohortLow.push(
        quarantineRuntimeShard({
          shardId: `lo-${i}`,
          signal: isFaulted
            ? healthySignal({ crossTenantBleedDetected: true })
            : healthySignal(),
        }),
      );
    }
    const bLow = computeRuntimeHardeningBoundary({
      totalShards: N,
      records: cohortLow,
      minPartialSurvivabilityPct: 70,
    });
    expect(bLow.partitioned).toBe(false);
    let caught: unknown = null;
    try {
      assertRuntimeHardeningBoundary(bLow, { minPartialSurvivabilityPct: 70 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RuntimeHardeningError);
    // The breach floor trips first under this construction (BOUNDARY_BREACH),
    // since cross-tenant bleed records themselves are HARDENING_BREACH.
    expect(['BOUNDARY_BREACH', 'PARTIAL_SURVIVABILITY_FLOOR_BREACHED']).toContain(
      (caught as RuntimeHardeningError).violation,
    );

    // eslint-disable-next-line no-console
    console.log(
      `[runtime-hardening-board] runtime-resilience-floor ` +
        `high-cohort-survivability-pct=${bHigh.partialSurvivabilityPct.toFixed(2)} ` +
        `low-cohort-survivability-pct=${bLow.partialSurvivabilityPct.toFixed(2)} ` +
        `floor=70 high-partitioned=true low-trips=true`,
    );
  });

  it('preserves AMBIGUOUS_RUNTIME across a 2 000-shard disabled-breaker burst (no silent SURVIVING coercion)', () => {
    const N = 2_000;
    let ambiguityIntact = 0;

    for (let i = 0; i < N; i++) {
      const r = quarantineRuntimeShard({
        shardId: `amb-${i}`,
        signal: healthySignal({ circuitBreakerDisabled: true }),
      });
      if (
        r.verdict === 'AMBIGUOUS_RUNTIME' &&
        r.kind === 'RUNTIME_FAULT_AMBIGUOUS' &&
        r.ambiguous === true
      ) {
        ambiguityIntact++;
      }
    }

    expect(ambiguityIntact).toBe(N);

    // eslint-disable-next-line no-console
    console.log(
      `[runtime-hardening-board] runtime-ambiguity-intact-pct=100.00 ` +
        `intact=${ambiguityIntact}/${N}`,
    );
  });

  it('replay-performance stabilization: 10 000-sample window completes within budget', () => {
    const N = 10_000;
    // Realistic shape: low p50, occasional tail bumps. p50 ~ 8ms, p99 ~ 60ms.
    const sample: number[] = [];
    for (let i = 0; i < N; i++) {
      const tail = i % 100 === 0 ? 60 : i % 20 === 0 ? 25 : 8;
      sample.push(tail + (i % 7));
    }

    const start = process.hrtime.bigint();
    const window = computeReplayStabilityWindow({ sample, tailLatencyBudgetMs: 100 });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

    expect(window.sampleCount).toBe(N);
    expect(window.windowP99Ms).toBeLessThanOrEqual(100);
    expect(window.stabilized).toBe(true);
    expect(window.tailHeadroomRatio).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(2_000);
    expect(window.stabilityDigest).toMatch(/^[a-f0-9]{64}$/);

    // eslint-disable-next-line no-console
    console.log(
      `[runtime-hardening-board] replay-stability ` +
        `n=${N} p50=${window.windowP50Ms.toFixed(2)}ms p99=${window.windowP99Ms.toFixed(2)}ms ` +
        `tail-headroom=${(window.tailHeadroomRatio * 100).toFixed(2)}% ` +
        `stabilized=${window.stabilized} ` +
        `elapsed_ms=${elapsedMs.toFixed(0)} ` +
        `digest=${window.stabilityDigest.slice(0, 12)}`,
    );
  });

  it('cross-tenant bleed always raises HARDENING_BREACH at any cohort size (fail-closed)', () => {
    const N = 500;
    let breachCount = 0;
    for (let i = 0; i < N; i++) {
      const r = quarantineRuntimeShard({
        shardId: `bleed-${i}`,
        signal: healthySignal({ crossTenantBleedDetected: true }),
      });
      if (r.verdict === 'HARDENING_BREACH' && r.kind === 'CROSS_TENANT_RESOURCE_BLEED') {
        breachCount++;
      }
    }
    expect(breachCount).toBe(N);

    // eslint-disable-next-line no-console
    console.log(
      `[runtime-hardening-board] cross-tenant-bleed-breach-rate=${((breachCount / N) * 100).toFixed(2)} ` +
        `n=${N}`,
    );
  });

  it('production runtime maturity score holds at PRODUCTION_READY for an all-healthy cohort', () => {
    const N = 100;
    const records = Array.from({ length: N }, (_, i) =>
      quarantineRuntimeShard({ shardId: `h-${i}`, signal: healthySignal() }),
    );
    const boundary = computeRuntimeHardeningBoundary({ totalShards: N, records });
    const replayStability = computeReplayStabilityWindow({
      sample: Array.from({ length: 1_000 }, (_, i) => 8 + (i % 5)),
      tailLatencyBudgetMs: 100,
    });
    const score = computeRuntimeMaturityScore({ boundary, replayStability, records });

    expect(score.verdict).toBe('PRODUCTION_READY');
    expect(score.runtimeSurvivabilityPct).toBe(100);
    expect(score.faultContainmentIntegrityPct).toBe(100);
    expect(score.resourceIsolationFidelityPct).toBe(100);
    expect(score.productionRuntimeMaturityPct).toBeGreaterThanOrEqual(75);

    // eslint-disable-next-line no-console
    console.log(
      `[runtime-hardening-board] production-runtime-maturity ` +
        `survivability-pct=${score.runtimeSurvivabilityPct.toFixed(2)} ` +
        `replay-stability-pct=${score.replayPerformanceStabilityPct.toFixed(2)} ` +
        `containment-pct=${score.faultContainmentIntegrityPct.toFixed(2)} ` +
        `isolation-pct=${score.resourceIsolationFidelityPct.toFixed(2)} ` +
        `maturity-pct=${score.productionRuntimeMaturityPct.toFixed(2)} ` +
        `verdict=${score.verdict} digest=${score.scoreDigest.slice(0, 12)}`,
    );
  });
});
