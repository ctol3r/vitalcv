/**
 * Governance Runtime Hardening — CI Gate (W2-PR107A)
 *
 * Canary suite. Every public primitive must:
 *   - throw RuntimeHardeningError on boundary breaches (not silently allow);
 *   - export an enumerated `violation` field;
 *   - never coerce AMBIGUOUS_RUNTIME verdicts to SURVIVING (silent collapse);
 *   - produce a deterministic, salted hardeningDigest (not collide across inputs);
 *   - keep CIRCUIT_BREAKER_DISABLED a hard violation (fail-closed semantics).
 *
 * If a future refactor accidentally weakens any of these invariants, this
 * suite breaks the build before the regression ships.
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
  computeRuntimeHardeningBoundary,
  hardeningDigest,
  quarantineRuntimeShard,
  traceRuntimeFaultLineage,
  type RuntimeFaultKind,
  type RuntimeHardeningSignal,
  type RuntimeSurvivabilityVerdict,
  type RuntimeTier,
} from '../governanceRuntimeHardening';

const KNOWN_VIOLATIONS = [
  'AMBIGUOUS_RUNTIME_FORCED_HEALTHY',
  'BOUNDARY_BREACH',
  'PARTIAL_SURVIVABILITY_FLOOR_BREACHED',
  'ISOLATION_OPEN_FAILURE',
  'CIRCUIT_BREAKER_DISABLED',
] as const;

const KNOWN_VERDICTS: RuntimeSurvivabilityVerdict[] = [
  'SURVIVING',
  'PARTIAL_SURVIVING',
  'AMBIGUOUS_RUNTIME',
  'CONTAINED',
  'CONTAMINATED',
  'HARDENING_BREACH',
];

const KNOWN_KINDS: RuntimeFaultKind[] = [
  'REPLAY_BACKPRESSURE',
  'GOVERNANCE_RULE_TIMEOUT',
  'TENANT_RESOURCE_EXHAUSTION',
  'CROSS_TENANT_RESOURCE_BLEED',
  'REPLAY_VARIANCE_SPIKE',
  'CIRCUIT_BREAKER_OPEN',
  'RUNTIME_FAULT_AMBIGUOUS',
];

const KNOWN_TIERS: RuntimeTier[] = [
  'HEALTHY',
  'DEGRADED',
  'STRESSED',
  'CIRCUIT_OPEN',
  'ISOLATION_BREACH',
  'AMBIGUOUS_RUNTIME',
];

describe('CI gate — exported enums match runtime sentinels', () => {
  it('every exported verdict is in the runtime KNOWN_RUNTIME_SURVIVABILITY_VERDICTS list', () => {
    for (const v of KNOWN_VERDICTS) {
      expect(KNOWN_RUNTIME_SURVIVABILITY_VERDICTS).toContain(v);
    }
    expect(KNOWN_RUNTIME_SURVIVABILITY_VERDICTS).toHaveLength(KNOWN_VERDICTS.length);
  });

  it('every exported kind is in the runtime KNOWN_RUNTIME_FAULT_KINDS list', () => {
    for (const k of KNOWN_KINDS) {
      expect(KNOWN_RUNTIME_FAULT_KINDS).toContain(k);
    }
    expect(KNOWN_RUNTIME_FAULT_KINDS).toHaveLength(KNOWN_KINDS.length);
  });

  it('every exported tier is in the runtime KNOWN_RUNTIME_TIERS list', () => {
    for (const t of KNOWN_TIERS) {
      expect(KNOWN_RUNTIME_TIERS).toContain(t);
    }
    expect(KNOWN_RUNTIME_TIERS).toHaveLength(KNOWN_TIERS.length);
  });

  it('every exported violation is in KNOWN_RUNTIME_HARDENING_VIOLATIONS', () => {
    for (const v of KNOWN_VIOLATIONS) {
      expect(KNOWN_RUNTIME_HARDENING_VIOLATIONS).toContain(v);
    }
    expect(KNOWN_RUNTIME_HARDENING_VIOLATIONS).toHaveLength(KNOWN_VIOLATIONS.length);
  });

  it('verdict / kind / tier / violation enums are frozen', () => {
    expect(Object.isFrozen(KNOWN_RUNTIME_SURVIVABILITY_VERDICTS)).toBe(true);
    expect(Object.isFrozen(KNOWN_RUNTIME_FAULT_KINDS)).toBe(true);
    expect(Object.isFrozen(KNOWN_RUNTIME_TIERS)).toBe(true);
    expect(Object.isFrozen(KNOWN_RUNTIME_HARDENING_VIOLATIONS)).toBe(true);
    expect(Object.isFrozen(HARDENING_SENTINELS)).toBe(true);
  });
});

describe('CI gate — RuntimeHardeningError contract', () => {
  it('every breach primitive throws a RuntimeHardeningError with a known violation', () => {
    const cases: Array<{ name: string; expected: string; run: () => void }> = [
      {
        name: 'assertAmbiguityPreserved discards ambiguity',
        expected: 'AMBIGUOUS_RUNTIME_FORCED_HEALTHY',
        run: () =>
          assertAmbiguityPreserved({
            schema: 'vitalcv.runtime-hardening.v1',
            shardId: 'cap-x',
            verdict: 'SURVIVING',
            kind: 'REPLAY_BACKPRESSURE', // contradiction
            tier: 'HEALTHY',
            ambiguous: false,
            reason: 'forced',
            hardeningDigest: '0'.repeat(64),
            observedAt: '2026-05-09T00:00:00.000Z',
            lineageHints: {
              tenantPoolId: null,
              replayShardId: null,
              governanceRuleScopeId: null,
            },
            replayHeadroomRatio: 1,
            governanceHeadroomRatio: 1,
            tenantHeadroomRatio: 1,
            replayLatencyVariance: 1,
          }),
      },
      {
        name: 'assertCircuitBreakerEnabled when disabled',
        expected: 'CIRCUIT_BREAKER_DISABLED',
        run: () => assertCircuitBreakerEnabled(disabledBreaker()),
      },
      {
        name: 'assertRuntimeHardeningBoundary partial survivability floor breach',
        expected: 'PARTIAL_SURVIVABILITY_FLOOR_BREACHED',
        run: () => {
          const boundary = computeRuntimeHardeningBoundary({
            totalShards: 10,
            records: [
              quarantineRuntimeShard({ shardId: 'only-survivor', signal: healthySignal() }),
            ],
          });
          assertRuntimeHardeningBoundary(boundary);
        },
      },
      {
        name: 'assertRuntimeHardeningBoundary boundary breach (cross-tenant bleed)',
        expected: 'BOUNDARY_BREACH',
        run: () => {
          const records = [
            ...Array.from({ length: 9 }, (_, i) =>
              quarantineRuntimeShard({ shardId: `h-${i}`, signal: healthySignal() }),
            ),
            quarantineRuntimeShard({
              shardId: 'breached',
              signal: healthySignal({ crossTenantBleedDetected: true }),
            }),
          ];
          const boundary = computeRuntimeHardeningBoundary({ totalShards: 10, records });
          assertRuntimeHardeningBoundary(boundary);
        },
      },
    ];

    for (const c of cases) {
      let caught: unknown = null;
      try {
        c.run();
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(RuntimeHardeningError);
      const err = caught as RuntimeHardeningError;
      expect(err.code).toBe('RUNTIME_HARDENING_VIOLATION');
      expect(KNOWN_VIOLATIONS).toContain(err.violation);
      expect(err.violation).toBe(c.expected);
    }
  });
});

describe('CI gate — hardeningDigest is deterministic and unique', () => {
  it('produces unique digests for distinct (shardId, verdict, kind, tier, signal) tuples', () => {
    const sigA = healthySignal();
    const sigB = healthySignal({ replayQueueDepth: 200 });
    const inputs = [
      { shardId: 's-1', verdict: 'SURVIVING' as const, kind: null, tier: 'HEALTHY' as const, signal: sigA },
      { shardId: 's-1', verdict: 'PARTIAL_SURVIVING' as const, kind: 'REPLAY_BACKPRESSURE' as const, tier: 'STRESSED' as const, signal: sigB },
      { shardId: 's-2', verdict: 'SURVIVING' as const, kind: null, tier: 'HEALTHY' as const, signal: sigA },
      { shardId: 's-1', verdict: 'AMBIGUOUS_RUNTIME' as const, kind: 'RUNTIME_FAULT_AMBIGUOUS' as const, tier: 'AMBIGUOUS_RUNTIME' as const, signal: sigA },
      { shardId: 's-1', verdict: 'CONTAINED' as const, kind: 'CIRCUIT_BREAKER_OPEN' as const, tier: 'CIRCUIT_OPEN' as const, signal: sigA },
    ];
    const digests = inputs.map(hardeningDigest);
    expect(new Set(digests).size).toBe(inputs.length);
    // Reproducibility — same input twice yields same digest.
    expect(hardeningDigest(inputs[0])).toBe(digests[0]);
  });
});

describe('CI gate — quarantine record never silently collapses', () => {
  it('disabled-breaker round-trip preserves verdict=AMBIGUOUS_RUNTIME', () => {
    const r = quarantineRuntimeShard({
      shardId: 's-1',
      signal: disabledBreaker(),
    });
    expect(r.verdict).toBe('AMBIGUOUS_RUNTIME');
    expect(r.ambiguous).toBe(true);
    expect(() => assertAmbiguityPreserved(r)).not.toThrow();
  });

  it('a healthy quarantine round-trip never carries a non-null kind', () => {
    const r = quarantineRuntimeShard({ shardId: 's-1', signal: healthySignal() });
    expect(r.verdict).toBe('SURVIVING');
    expect(r.kind).toBeNull();
  });

  it('cross-tenant bleed always raises HARDENING_BREACH (cannot be downgraded)', () => {
    const r = quarantineRuntimeShard({
      shardId: 's-1',
      signal: healthySignal({ crossTenantBleedDetected: true }),
    });
    expect(r.verdict).toBe('HARDENING_BREACH');
    expect(r.kind).toBe('CROSS_TENANT_RESOURCE_BLEED');
  });
});

describe('CI gate — lineage reconstruction is order-independent and deterministic', () => {
  it('reconstructionDigest matches across reorderings of the same candidate set', () => {
    const a = traceRuntimeFaultLineage({
      rootShardId: 'root-1',
      rootHints: {
        tenantPoolId: 'pool-A',
        replayShardId: 'rs-1',
        governanceRuleScopeId: null,
      },
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
      rootHints: {
        tenantPoolId: 'pool-A',
        replayShardId: 'rs-1',
        governanceRuleScopeId: null,
      },
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
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function disabledBreaker(): RuntimeHardeningSignal {
  return healthySignal({ circuitBreakerDisabled: true });
}
