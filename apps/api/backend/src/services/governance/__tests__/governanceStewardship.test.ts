/**
 * governanceStewardship.test.ts — W2-PR154A unit coverage
 *
 * Full behavioural coverage of the governance stewardship pure-transform
 * module. Every public primitive is exercised: classifier, caretaker record,
 * boundary aggregation, assertions, lineage reconstruction, telemetry, and
 * maturity score.
 */

import {
  assertAmbiguityPreserved,
  assertStewardshipBoundary,
  assertSuccessionReadiness,
  caretakeStewardshipShard,
  classifyStewardshipFault,
  computeStewardshipBoundary,
  emitStewardshipTelemetry,
  stewardshipDigest,
  stewardshipMaturityScore,
  traceStewardshipLineage,
  StewardshipError,
  type StewardshipSignal,
} from '../governanceStewardship';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function healthySignal(overrides: Partial<StewardshipSignal> = {}): StewardshipSignal {
  return {
    caretakerContinuityScore: 0.95,
    caretakerContinuityThreshold: 0.80,
    replayGovernanceDrift: 0.5,
    replayGovernanceDriftBudget: 5.0,
    successionReadinessScore: 0.90,
    successionActivationThreshold: 0.75,
    governanceLineageDepth: 5,
    governanceLineageTarget: 3,
    institutionalRuntimeStability: 0.92,
    institutionalStabilityFloor: 0.70,
    successionPendingConfirmation: false,
    caretakerAmbiguityDetected: false,
    stewardshipEvidence: null,
    ...overrides,
  };
}

function activeRecord(shardId = 'shard-1') {
  return caretakeStewardshipShard({ shardId, signal: healthySignal() });
}

// ── classifyStewardshipFault ───────────────────────────────────────────────────

describe('classifyStewardshipFault — healthy path', () => {
  it('returns kind=null, tier=INSTITUTIONAL for fully healthy signal', () => {
    const { kind, tier, ambiguous } = classifyStewardshipFault(healthySignal());
    expect(kind).toBeNull();
    expect(tier).toBe('INSTITUTIONAL');
    expect(ambiguous).toBe(false);
  });
});

describe('classifyStewardshipFault — ambiguity', () => {
  it('returns AMBIGUOUS_CARETAKER_SIGNAL when caretakerAmbiguityDetected', () => {
    const { kind, tier, ambiguous } = classifyStewardshipFault(
      healthySignal({ caretakerAmbiguityDetected: true }),
    );
    expect(kind).toBe('AMBIGUOUS_CARETAKER_SIGNAL');
    expect(tier).toBe('AMBIGUOUS');
    expect(ambiguous).toBe(true);
  });

  it('includes evidence text in the reason when present', () => {
    const { reason } = classifyStewardshipFault(
      healthySignal({
        caretakerAmbiguityDetected: true,
        stewardshipEvidence: 'conflicting telemetry frames',
      }),
    );
    expect(reason).toContain('conflicting telemetry frames');
  });

  it('treats evidence-present + all-scores-healthy as contradiction → AMBIGUOUS', () => {
    const { kind, ambiguous } = classifyStewardshipFault(
      healthySignal({ stewardshipEvidence: 'unexpected rollback' }),
    );
    expect(kind).toBe('AMBIGUOUS_CARETAKER_SIGNAL');
    expect(ambiguous).toBe(true);
  });
});

describe('classifyStewardshipFault — succession', () => {
  it('SUCCESSION_TRIGGERED with sufficient readiness', () => {
    const { kind, tier } = classifyStewardshipFault(
      healthySignal({ successionPendingConfirmation: true }),
    );
    expect(kind).toBeNull();
    expect(tier).toBe('SUCCESSION');
  });

  it('SUCCESSION_PROTOCOL_BREACH when readiness is below threshold', () => {
    const { kind, tier } = classifyStewardshipFault(
      healthySignal({
        successionPendingConfirmation: true,
        successionReadinessScore: 0.50,
        successionActivationThreshold: 0.75,
      }),
    );
    expect(kind).toBe('SUCCESSION_PROTOCOL_BREACH');
    expect(tier).toBe('SUCCESSION');
  });
});

describe('classifyStewardshipFault — caretaker continuity', () => {
  it('CARETAKER_CONTINUITY_DRIFT when continuity below threshold', () => {
    const { kind, tier } = classifyStewardshipFault(
      healthySignal({ caretakerContinuityScore: 0.60, caretakerContinuityThreshold: 0.80 }),
    );
    expect(kind).toBe('CARETAKER_CONTINUITY_DRIFT');
    expect(tier).toBe('CARETAKER');
  });

  it('REPLAY_GOVERNANCE_DRIFT when drift exceeds budget', () => {
    const { kind, tier } = classifyStewardshipFault(
      healthySignal({ replayGovernanceDrift: 10, replayGovernanceDriftBudget: 5 }),
    );
    expect(kind).toBe('REPLAY_GOVERNANCE_DRIFT');
    expect(tier).toBe('CARETAKER');
  });

  it('CARETAKER_CONTINUITY_DRIFT (DEGRADED) when both axes fail', () => {
    const { kind, tier } = classifyStewardshipFault(
      healthySignal({
        caretakerContinuityScore: 0.60,
        caretakerContinuityThreshold: 0.80,
        replayGovernanceDrift: 10,
        replayGovernanceDriftBudget: 5,
      }),
    );
    expect(kind).toBe('CARETAKER_CONTINUITY_DRIFT');
    expect(tier).toBe('DEGRADED');
  });
});

describe('classifyStewardshipFault — lineage and stability', () => {
  it('GOVERNANCE_LINEAGE_BREAK when depth below target', () => {
    const { kind, tier } = classifyStewardshipFault(
      healthySignal({ governanceLineageDepth: 2, governanceLineageTarget: 3 }),
    );
    expect(kind).toBe('GOVERNANCE_LINEAGE_BREAK');
    expect(tier).toBe('DEGRADED');
  });

  it('INSTITUTIONAL_STABILITY_COLLAPSE when stability below floor', () => {
    const { kind, tier } = classifyStewardshipFault(
      healthySignal({ institutionalRuntimeStability: 0.50, institutionalStabilityFloor: 0.70 }),
    );
    expect(kind).toBe('INSTITUTIONAL_STABILITY_COLLAPSE');
    expect(tier).toBe('DEGRADED');
  });
});

// ── caretakeStewardshipShard ───────────────────────────────────────────────────

describe('caretakeStewardshipShard', () => {
  it('produces verdict=ACTIVE for healthy signal', () => {
    const record = activeRecord();
    expect(record.schema).toBe('vitalcv.governance-stewardship.v1');
    expect(record.verdict).toBe('ACTIVE');
    expect(record.kind).toBeNull();
    expect(record.ambiguous).toBe(false);
    expect(record.stewardshipDigest).toHaveLength(64);
  });

  it('produces verdict=AMBIGUOUS_STEWARDSHIP for ambiguous signal', () => {
    const record = caretakeStewardshipShard({
      shardId: 'ambig',
      signal: healthySignal({ caretakerAmbiguityDetected: true }),
    });
    expect(record.verdict).toBe('AMBIGUOUS_STEWARDSHIP');
    expect(record.ambiguous).toBe(true);
    expect(record.kind).toBe('AMBIGUOUS_CARETAKER_SIGNAL');
  });

  it('produces verdict=SUCCESSION_PENDING when succession pending with low readiness', () => {
    const record = caretakeStewardshipShard({
      shardId: 's-1',
      signal: healthySignal({
        successionPendingConfirmation: true,
        successionReadinessScore: 0.40,
        successionActivationThreshold: 0.75,
      }),
    });
    expect(record.verdict).toBe('SUCCESSION_PENDING');
    expect(record.kind).toBe('SUCCESSION_PROTOCOL_BREACH');
  });

  it('produces verdict=SUCCESSION_TRIGGERED when succession ready', () => {
    const record = caretakeStewardshipShard({
      shardId: 's-1',
      signal: healthySignal({ successionPendingConfirmation: true }),
    });
    expect(record.verdict).toBe('SUCCESSION_TRIGGERED');
    expect(record.kind).toBeNull();
    expect(record.tier).toBe('SUCCESSION');
  });

  it('produces verdict=CARETAKER_CONTINUITY_BREACH for continuity drift', () => {
    const record = caretakeStewardshipShard({
      shardId: 's-1',
      signal: healthySignal({ caretakerContinuityScore: 0.50, caretakerContinuityThreshold: 0.80 }),
    });
    expect(record.verdict).toBe('CARETAKER_CONTINUITY_BREACH');
  });

  it('produces verdict=GOVERNANCE_LINEAGE_BREAK for lineage break', () => {
    const record = caretakeStewardshipShard({
      shardId: 's-1',
      signal: healthySignal({ governanceLineageDepth: 1, governanceLineageTarget: 3 }),
    });
    expect(record.verdict).toBe('GOVERNANCE_LINEAGE_BREAK');
  });

  it('produces verdict=INSTITUTIONAL_STABILITY_BREACH for stability collapse', () => {
    const record = caretakeStewardshipShard({
      shardId: 's-1',
      signal: healthySignal({ institutionalRuntimeStability: 0.30, institutionalStabilityFloor: 0.70 }),
    });
    expect(record.verdict).toBe('INSTITUTIONAL_STABILITY_BREACH');
  });

  it('normalises lineageHints correctly', () => {
    const record = caretakeStewardshipShard({
      shardId: 's-1',
      signal: healthySignal(),
      lineageHints: { caretakerPoolId: '  pool-A  ', replayGovernanceShardId: '' },
    });
    expect(record.lineageHints.caretakerPoolId).toBe('pool-A');
    expect(record.lineageHints.replayGovernanceShardId).toBeNull();
  });
});

// ── stewardshipDigest ─────────────────────────────────────────────────────────

describe('stewardshipDigest', () => {
  it('produces unique digests for distinct (shardId, verdict, kind, tier, signal) tuples', () => {
    const sig = healthySignal();
    const sigB = healthySignal({ caretakerContinuityScore: 0.60 });
    const inputs = [
      { shardId: 's-1', verdict: 'ACTIVE' as const, kind: null, tier: 'INSTITUTIONAL' as const, signal: sig },
      { shardId: 's-1', verdict: 'CARETAKER_CONTINUITY_BREACH' as const, kind: 'CARETAKER_CONTINUITY_DRIFT' as const, tier: 'CARETAKER' as const, signal: sig },
      { shardId: 's-2', verdict: 'ACTIVE' as const, kind: null, tier: 'INSTITUTIONAL' as const, signal: sig },
      { shardId: 's-1', verdict: 'ACTIVE' as const, kind: null, tier: 'INSTITUTIONAL' as const, signal: sigB },
      { shardId: 's-1', verdict: 'AMBIGUOUS_STEWARDSHIP' as const, kind: 'AMBIGUOUS_CARETAKER_SIGNAL' as const, tier: 'AMBIGUOUS' as const, signal: sig },
    ];
    const digests = inputs.map(stewardshipDigest);
    expect(new Set(digests).size).toBe(inputs.length);
    expect(stewardshipDigest(inputs[0])).toBe(digests[0]);
  });
});

// ── computeStewardshipBoundary ────────────────────────────────────────────────

describe('computeStewardshipBoundary', () => {
  it('returns partitioned=true for all-active population', () => {
    const records = Array.from({ length: 5 }, (_, i) => activeRecord(`s-${i}`));
    const boundary = computeStewardshipBoundary({ totalShards: 5, records });
    expect(boundary.partitioned).toBe(true);
    expect(boundary.activeCount).toBe(5);
    expect(boundary.stewardshipContinuityRatio).toBe(1);
    expect(boundary.partialContinuityPct).toBe(100);
  });

  it('returns partitioned=false when lineage breaks exist', () => {
    const records = [
      activeRecord('s-1'),
      caretakeStewardshipShard({
        shardId: 's-2',
        signal: healthySignal({ governanceLineageDepth: 1, governanceLineageTarget: 3 }),
      }),
    ];
    const boundary = computeStewardshipBoundary({ totalShards: 2, records });
    expect(boundary.partitioned).toBe(false);
    expect(boundary.lineageBreakCount).toBe(1);
  });

  it('returns partitioned=false when partial continuity below floor', () => {
    const records = [
      caretakeStewardshipShard({
        shardId: 's-1',
        signal: healthySignal({ caretakerContinuityScore: 0.50, caretakerContinuityThreshold: 0.80 }),
      }),
    ];
    const boundary = computeStewardshipBoundary({
      totalShards: 5,
      records,
      minPartialContinuityPct: 70,
    });
    expect(boundary.partitioned).toBe(false);
  });

  it('computes meanInstitutionalStability correctly', () => {
    const records = [
      caretakeStewardshipShard({ shardId: 's-1', signal: healthySignal({ institutionalRuntimeStability: 0.80 }) }),
      caretakeStewardshipShard({ shardId: 's-2', signal: healthySignal({ institutionalRuntimeStability: 0.60 }) }),
    ];
    const boundary = computeStewardshipBoundary({ totalShards: 2, records });
    expect(boundary.meanInstitutionalStability).toBeCloseTo(0.70, 5);
  });
});

// ── assertAmbiguityPreserved ───────────────────────────────────────────────────

describe('assertAmbiguityPreserved', () => {
  it('does not throw for non-ambiguous active record', () => {
    expect(() => assertAmbiguityPreserved(activeRecord())).not.toThrow();
  });

  it('does not throw for ambiguous AMBIGUOUS_STEWARDSHIP record', () => {
    const record = caretakeStewardshipShard({
      shardId: 's-1',
      signal: healthySignal({ caretakerAmbiguityDetected: true }),
    });
    expect(() => assertAmbiguityPreserved(record)).not.toThrow();
  });

  it('throws AMBIGUOUS_STEWARDSHIP_FORCED_ACTIVE when ambiguous but verdict=ACTIVE', () => {
    const record = {
      ...activeRecord(),
      ambiguous: true,
    };
    expect(() => assertAmbiguityPreserved(record)).toThrow(StewardshipError);
    try {
      assertAmbiguityPreserved(record);
    } catch (e) {
      expect((e as StewardshipError).violation).toBe('AMBIGUOUS_STEWARDSHIP_FORCED_ACTIVE');
      expect((e as StewardshipError).code).toBe('STEWARDSHIP_VIOLATION');
    }
  });
});

// ── assertSuccessionReadiness ─────────────────────────────────────────────────

describe('assertSuccessionReadiness', () => {
  it('does not throw when succession is not pending', () => {
    const sig = healthySignal();
    expect(() => assertSuccessionReadiness(activeRecord(), sig)).not.toThrow();
  });

  it('throws SUCCESSION_THRESHOLD_BREACH when pending with low readiness', () => {
    const sig = healthySignal({
      successionPendingConfirmation: true,
      successionReadinessScore: 0.40,
      successionActivationThreshold: 0.75,
    });
    const record = caretakeStewardshipShard({ shardId: 's-1', signal: sig });
    expect(() => assertSuccessionReadiness(record, sig)).toThrow(StewardshipError);
    try {
      assertSuccessionReadiness(record, sig);
    } catch (e) {
      expect((e as StewardshipError).violation).toBe('SUCCESSION_THRESHOLD_BREACH');
    }
  });
});

// ── assertStewardshipBoundary ─────────────────────────────────────────────────

describe('assertStewardshipBoundary', () => {
  it('does not throw for intact boundary', () => {
    const records = Array.from({ length: 5 }, (_, i) => activeRecord(`s-${i}`));
    const boundary = computeStewardshipBoundary({ totalShards: 5, records });
    expect(() => assertStewardshipBoundary(boundary)).not.toThrow();
  });

  it('throws REPLAY_GOVERNANCE_CARETAKER_OPEN_FAILURE on lineage break', () => {
    const records = [
      activeRecord('s-1'),
      caretakeStewardshipShard({
        shardId: 's-2',
        signal: healthySignal({ governanceLineageDepth: 0, governanceLineageTarget: 3 }),
      }),
    ];
    const boundary = computeStewardshipBoundary({ totalShards: 2, records });
    expect(() => assertStewardshipBoundary(boundary)).toThrow(StewardshipError);
    try {
      assertStewardshipBoundary(boundary);
    } catch (e) {
      expect((e as StewardshipError).violation).toBe('REPLAY_GOVERNANCE_CARETAKER_OPEN_FAILURE');
    }
  });

  it('throws CARETAKER_CONTINUITY_FLOOR_BREACH when partial continuity below floor', () => {
    const records = Array.from({ length: 1 }, () =>
      caretakeStewardshipShard({
        shardId: 'lone',
        signal: healthySignal({ caretakerContinuityScore: 0.50, caretakerContinuityThreshold: 0.80 }),
      }),
    );
    const boundary = computeStewardshipBoundary({ totalShards: 5, records });
    expect(() => assertStewardshipBoundary(boundary)).toThrow(StewardshipError);
    try {
      assertStewardshipBoundary(boundary);
    } catch (e) {
      expect((e as StewardshipError).violation).toBe('CARETAKER_CONTINUITY_FLOOR_BREACH');
    }
  });
});

// ── traceStewardshipLineage ───────────────────────────────────────────────────

describe('traceStewardshipLineage', () => {
  it('reconstructionDigest is order-independent', () => {
    const base = {
      rootShardId: 'root',
      rootHints: { caretakerPoolId: 'pool-A', replayGovernanceShardId: 'rs-1', successionScopeId: null },
    };
    const a = traceStewardshipLineage({
      ...base,
      candidates: [
        { shardId: 'cand-A', hints: { caretakerPoolId: 'pool-A' } },
        { shardId: 'cand-B', hints: { replayGovernanceShardId: 'rs-1' } },
      ],
    });
    const b = traceStewardshipLineage({
      ...base,
      candidates: [
        { shardId: 'cand-B', hints: { replayGovernanceShardId: 'rs-1' } },
        { shardId: 'cand-A', hints: { caretakerPoolId: 'pool-A' } },
      ],
    });
    expect(a.reconstructionDigest).toBe(b.reconstructionDigest);
    expect(a.affectedShardIds).toEqual(['cand-A', 'cand-B']);
  });

  it('excludes root from affectedShardIds', () => {
    const result = traceStewardshipLineage({
      rootShardId: 'root',
      rootHints: { caretakerPoolId: 'pool-X', replayGovernanceShardId: null, successionScopeId: null },
      candidates: [
        { shardId: 'root', hints: { caretakerPoolId: 'pool-X' } },
        { shardId: 'other', hints: { caretakerPoolId: 'pool-X' } },
      ],
    });
    expect(result.affectedShardIds).toEqual(['other']);
  });

  it('emits SHARED_SUCCESSION_SCOPE edge correctly', () => {
    const result = traceStewardshipLineage({
      rootShardId: 'root',
      rootHints: { caretakerPoolId: null, replayGovernanceShardId: null, successionScopeId: 'sc-1' },
      candidates: [
        { shardId: 'cand-A', hints: { successionScopeId: 'sc-1' } },
      ],
    });
    expect(result.edges[0].reason).toBe('SHARED_SUCCESSION_SCOPE');
    expect(result.affectedShardIds).toContain('cand-A');
  });
});

// ── emitStewardshipTelemetry ──────────────────────────────────────────────────

describe('emitStewardshipTelemetry', () => {
  it('returns a telemetry record with correct schema and pct values', () => {
    const record = activeRecord();
    const telemetry = emitStewardshipTelemetry(record);
    expect(telemetry.schema).toBe('vitalcv.stewardship-telemetry.v1');
    expect(telemetry.verdict).toBe('ACTIVE');
    expect(telemetry.caretakerContinuityPct).toBe(95);
    expect(telemetry.successionReadinessPct).toBe(90);
    expect(telemetry.institutionalStabilityPct).toBe(92);
  });
});

// ── stewardshipMaturityScore ──────────────────────────────────────────────────

describe('stewardshipMaturityScore', () => {
  it('returns near-100 maturity for all-active boundary', () => {
    const records = Array.from({ length: 10 }, (_, i) => activeRecord(`s-${i}`));
    const boundary = computeStewardshipBoundary({ totalShards: 10, records });
    const { maturityScore } = stewardshipMaturityScore(boundary);
    expect(maturityScore).toBeGreaterThanOrEqual(80);
  });

  it('returns lower maturity for continuity-degraded boundary', () => {
    const records = [
      ...Array.from({ length: 3 }, (_, i) => activeRecord(`s-${i}`)),
      caretakeStewardshipShard({
        shardId: 's-3',
        signal: healthySignal({ caretakerContinuityScore: 0.40, caretakerContinuityThreshold: 0.80 }),
      }),
      caretakeStewardshipShard({
        shardId: 's-4',
        signal: healthySignal({ institutionalRuntimeStability: 0.30, institutionalStabilityFloor: 0.70 }),
      }),
    ];
    const boundary = computeStewardshipBoundary({ totalShards: 5, records });
    const fullBoundary = computeStewardshipBoundary({ totalShards: 5, records: Array.from({ length: 5 }, (_, i) => activeRecord(`h-${i}`)) });
    const degradedScore = stewardshipMaturityScore(boundary).maturityScore;
    const healthyScore = stewardshipMaturityScore(fullBoundary).maturityScore;
    expect(degradedScore).toBeLessThan(healthyScore);
  });

  it('maturityScore is in range 0–100', () => {
    const boundary = computeStewardshipBoundary({ totalShards: 1, records: [activeRecord()] });
    const { maturityScore } = stewardshipMaturityScore(boundary);
    expect(maturityScore).toBeGreaterThanOrEqual(0);
    expect(maturityScore).toBeLessThanOrEqual(100);
  });
});
