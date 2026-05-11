/**
 * Governance Stewardship — Chaos Simulation Suite (W2-PR154A)
 *
 * Eight chaos modes covering the completion-board axes:
 *   1. healthy burst        — large cohort, all signals healthy
 *   2. mixed-friction        — realistic mix of active / degraded / ambiguous shards
 *   3. succession storm      — concurrent succession events across shard population
 *   4. lineage collapse      — cascading lineage breaks across caretaker generations
 *   5. stability cliff       — sudden institutional runtime stability drops
 *   6. ambiguity preservation — injected contradictions never silently collapse
 *   7. replay governance drift — sustained drift exceeding budget across majority
 *   8. stewardship protocol maturity — board metrics derivation from mixed boundary
 *
 * All modes: mock-free, DB-free. Pure-transform calls only.
 */

import {
  assertAmbiguityPreserved,
  assertStewardshipBoundary,
  caretakeStewardshipShard,
  computeStewardshipBoundary,
  StewardshipError,
  stewardshipMaturityScore,
  traceStewardshipLineage,
  type StewardshipSignal,
} from '../governanceStewardship';

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

const COHORT_SIZE = 100;

// ── Mode 1: Healthy burst ─────────────────────────────────────────────────────

describe('chaos mode 1 — healthy burst', () => {
  it(`classifies ${COHORT_SIZE} healthy shards as fully active`, () => {
    const records = Array.from({ length: COHORT_SIZE }, (_, i) =>
      caretakeStewardshipShard({ shardId: `s-${i}`, signal: healthySignal() }),
    );
    expect(records.every((r) => r.verdict === 'ACTIVE')).toBe(true);

    const boundary = computeStewardshipBoundary({ totalShards: COHORT_SIZE, records });
    expect(boundary.partitioned).toBe(true);
    expect(boundary.activeCount).toBe(COHORT_SIZE);
    expect(boundary.stewardshipContinuityRatio).toBe(1);
    expect(() => assertStewardshipBoundary(boundary)).not.toThrow();
    console.log('[stewardship-board]', JSON.stringify({
      mode: 'healthy-burst',
      activeCount: boundary.activeCount,
      continuityRatio: boundary.stewardshipContinuityRatio,
      partialContinuityPct: boundary.partialContinuityPct,
      partitioned: boundary.partitioned,
    }));
  });
});

// ── Mode 2: Mixed-friction cohort ─────────────────────────────────────────────

describe('chaos mode 2 — mixed-friction cohort', () => {
  it('correctly aggregates a realistic mix of active/degraded/ambiguous shards', () => {
    const records = Array.from({ length: COHORT_SIZE }, (_, i) => {
      const bucket = i % 10;
      let sig: StewardshipSignal;
      if (bucket < 6) {
        sig = healthySignal();
      } else if (bucket < 8) {
        sig = healthySignal({ caretakerContinuityScore: 0.60, caretakerContinuityThreshold: 0.80 });
      } else if (bucket === 8) {
        sig = healthySignal({ caretakerAmbiguityDetected: true });
      } else {
        sig = healthySignal({ institutionalRuntimeStability: 0.40, institutionalStabilityFloor: 0.70 });
      }
      return caretakeStewardshipShard({ shardId: `s-${i}`, signal: sig });
    });

    const activeCount = records.filter((r) => r.verdict === 'ACTIVE').length;
    const breachCount = records.filter((r) => r.verdict === 'CARETAKER_CONTINUITY_BREACH').length;
    const ambiguousCount = records.filter((r) => r.verdict === 'AMBIGUOUS_STEWARDSHIP').length;
    const stabilityBreachCount = records.filter((r) => r.verdict === 'INSTITUTIONAL_STABILITY_BREACH').length;

    expect(activeCount).toBeGreaterThan(0);
    expect(breachCount).toBeGreaterThan(0);
    expect(ambiguousCount).toBeGreaterThan(0);
    expect(stabilityBreachCount).toBeGreaterThan(0);

    const boundary = computeStewardshipBoundary({ totalShards: COHORT_SIZE, records });
    expect(boundary.continuityBreachCount).toBe(breachCount);
    expect(boundary.ambiguousCount).toBe(ambiguousCount);
    expect(boundary.stabilityBreachCount).toBe(stabilityBreachCount);

    console.log('[stewardship-board]', JSON.stringify({
      mode: 'mixed-friction',
      activeCount: boundary.activeCount,
      continuityBreachCount: boundary.continuityBreachCount,
      ambiguousCount: boundary.ambiguousCount,
      stabilityBreachCount: boundary.stabilityBreachCount,
      partialContinuityPct: Math.round(boundary.partialContinuityPct),
      partitioned: boundary.partitioned,
    }));
  });
});

// ── Mode 3: Succession storm ──────────────────────────────────────────────────

describe('chaos mode 3 — succession storm', () => {
  it('handles concurrent succession events without silent hand-off to unready caretakers', () => {
    const records = Array.from({ length: 20 }, (_, i) => {
      const readinessScore = i % 2 === 0 ? 0.90 : 0.40;
      return caretakeStewardshipShard({
        shardId: `s-${i}`,
        signal: healthySignal({
          successionPendingConfirmation: true,
          successionReadinessScore: readinessScore,
          successionActivationThreshold: 0.75,
        }),
      });
    });

    const triggered = records.filter((r) => r.verdict === 'SUCCESSION_TRIGGERED');
    const pending = records.filter((r) => r.verdict === 'SUCCESSION_PENDING');
    expect(triggered).toHaveLength(10);
    expect(pending).toHaveLength(10);

    // SUCCESSION_PENDING records carry the breach kind
    for (const r of pending) {
      expect(r.kind).toBe('SUCCESSION_PROTOCOL_BREACH');
    }

    const boundary = computeStewardshipBoundary({ totalShards: 20, records });
    // Succession pending causes boundary breach
    expect(boundary.partitioned).toBe(false);
    expect(boundary.successionCount).toBe(20);

    console.log('[stewardship-board]', JSON.stringify({
      mode: 'succession-storm',
      successionTriggered: triggered.length,
      successionPending: pending.length,
      partitioned: boundary.partitioned,
    }));
  });
});

// ── Mode 4: Lineage collapse ──────────────────────────────────────────────────

describe('chaos mode 4 — lineage collapse', () => {
  it('cascading lineage breaks are detected and fail the boundary', () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      caretakeStewardshipShard({
        shardId: `s-${i}`,
        signal: healthySignal({
          governanceLineageDepth: i < 5 ? 0 : 5,
          governanceLineageTarget: 3,
        }),
      }),
    );

    const lineageBreaks = records.filter((r) => r.verdict === 'GOVERNANCE_LINEAGE_BREAK');
    expect(lineageBreaks).toHaveLength(5);

    const boundary = computeStewardshipBoundary({ totalShards: 10, records });
    expect(boundary.lineageBreakCount).toBe(5);
    expect(boundary.partitioned).toBe(false);

    expect(() => assertStewardshipBoundary(boundary)).toThrow(StewardshipError);

    // Lineage reconstruction for one breach
    const lineage = traceStewardshipLineage({
      rootShardId: 's-0',
      rootHints: { caretakerPoolId: 'pool-A', replayGovernanceShardId: null, successionScopeId: null },
      candidates: lineageBreaks.map((r) => ({
        shardId: r.shardId,
        hints: { caretakerPoolId: 'pool-A' },
      })),
    });
    expect(lineage.affectedShardIds.length).toBeGreaterThan(0);
    expect(lineage.reconstructionDigest).toHaveLength(64);

    console.log('[stewardship-board]', JSON.stringify({
      mode: 'lineage-collapse',
      lineageBreakCount: boundary.lineageBreakCount,
      affectedByRootLineage: lineage.affectedShardIds.length,
      partitioned: boundary.partitioned,
    }));
  });
});

// ── Mode 5: Stability cliff ───────────────────────────────────────────────────

describe('chaos mode 5 — stability cliff', () => {
  it('sudden stability drops are visible as INSTITUTIONAL_STABILITY_BREACH', () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      caretakeStewardshipShard({
        shardId: `s-${i}`,
        signal: healthySignal({
          institutionalRuntimeStability: i < 10 ? 0.25 : 0.92,
          institutionalStabilityFloor: 0.70,
        }),
      }),
    );

    const stabilityBreaches = records.filter((r) => r.verdict === 'INSTITUTIONAL_STABILITY_BREACH');
    expect(stabilityBreaches).toHaveLength(10);

    const boundary = computeStewardshipBoundary({ totalShards: 20, records });
    expect(boundary.stabilityBreachCount).toBe(10);
    expect(boundary.meanInstitutionalStability).toBeLessThan(0.70);
    expect(boundary.partitioned).toBe(false);

    console.log('[stewardship-board]', JSON.stringify({
      mode: 'stability-cliff',
      stabilityBreachCount: boundary.stabilityBreachCount,
      meanInstitutionalStabilityPct: Math.round(boundary.meanInstitutionalStability * 100),
      partitioned: boundary.partitioned,
    }));
  });
});

// ── Mode 6: Ambiguity preservation ───────────────────────────────────────────

describe('chaos mode 6 — ambiguity preservation under injection', () => {
  it('every ambiguous record preserves AMBIGUOUS_STEWARDSHIP — no silent collapse', () => {
    const records = Array.from({ length: 30 }, (_, i) => {
      const inject = i % 3 === 0;
      return caretakeStewardshipShard({
        shardId: `s-${i}`,
        signal: healthySignal({ caretakerAmbiguityDetected: inject }),
      });
    });

    for (const r of records) {
      // Must not throw on correctly-ambiguous records
      expect(() => assertAmbiguityPreserved(r)).not.toThrow();
      if (r.ambiguous) {
        expect(r.verdict).toBe('AMBIGUOUS_STEWARDSHIP');
      } else {
        expect(r.verdict).toBe('ACTIVE');
      }
    }

    const ambiguousCount = records.filter((r) => r.ambiguous).length;
    expect(ambiguousCount).toBe(10);

    console.log('[stewardship-board]', JSON.stringify({
      mode: 'ambiguity-preservation',
      ambiguousPreserved: ambiguousCount,
      activeCount: records.filter((r) => r.verdict === 'ACTIVE').length,
    }));
  });
});

// ── Mode 7: Replay governance drift ──────────────────────────────────────────

describe('chaos mode 7 — sustained replay governance drift', () => {
  it('drift exceeding budget surfaces as CARETAKER_CONTINUITY_BREACH on replay axis', () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      caretakeStewardshipShard({
        shardId: `s-${i}`,
        signal: healthySignal({
          replayGovernanceDrift: i < 12 ? 15.0 : 1.0,
          replayGovernanceDriftBudget: 5.0,
        }),
      }),
    );

    const driftBreaches = records.filter((r) => r.kind === 'REPLAY_GOVERNANCE_DRIFT');
    expect(driftBreaches.length).toBeGreaterThanOrEqual(12);

    for (const r of driftBreaches) {
      expect(r.verdict).toBe('CARETAKER_CONTINUITY_BREACH');
      expect(r.tier).toBe('CARETAKER');
    }

    console.log('[stewardship-board]', JSON.stringify({
      mode: 'replay-governance-drift',
      driftBreachCount: driftBreaches.length,
      activeCount: records.filter((r) => r.verdict === 'ACTIVE').length,
    }));
  });
});

// ── Mode 8: Stewardship protocol maturity ─────────────────────────────────────

describe('chaos mode 8 — stewardship protocol maturity score', () => {
  it('derives all five board metrics from a realistic mixed boundary', () => {
    const records = Array.from({ length: 20 }, (_, i) => {
      const bucket = i % 10;
      return caretakeStewardshipShard({
        shardId: `s-${i}`,
        signal: healthySignal(
          bucket < 7
            ? {}
            : bucket < 9
              ? { caretakerContinuityScore: 0.50, caretakerContinuityThreshold: 0.80 }
              : { successionReadinessScore: 0.60 },
        ),
      });
    });

    const boundary = computeStewardshipBoundary({ totalShards: 20, records });
    const metrics = stewardshipMaturityScore(boundary);

    expect(metrics.maturityScore).toBeGreaterThanOrEqual(0);
    expect(metrics.maturityScore).toBeLessThanOrEqual(100);
    expect(metrics.governanceContinuityPct).toBeGreaterThanOrEqual(0);
    expect(metrics.replayFidelityPct).toBeGreaterThanOrEqual(0);
    expect(metrics.successionSurvivabilityPct).toBeGreaterThanOrEqual(0);
    expect(metrics.institutionalStabilityPct).toBeGreaterThanOrEqual(0);

    console.log('[stewardship-board]', JSON.stringify({
      mode: 'maturity-score',
      maturityScore: metrics.maturityScore,
      governanceContinuityPct: metrics.governanceContinuityPct,
      replayFidelityPct: metrics.replayFidelityPct,
      successionSurvivabilityPct: metrics.successionSurvivabilityPct,
      institutionalStabilityPct: metrics.institutionalStabilityPct,
    }));
  });

  it('maturity score is strictly lower for fully-degraded boundary than healthy boundary', () => {
    const healthyRecords = Array.from({ length: 10 }, (_, i) =>
      caretakeStewardshipShard({ shardId: `h-${i}`, signal: healthySignal() }),
    );
    const degradedRecords = Array.from({ length: 10 }, (_, i) =>
      caretakeStewardshipShard({
        shardId: `d-${i}`,
        signal: healthySignal({
          caretakerContinuityScore: 0.30,
          caretakerContinuityThreshold: 0.80,
          institutionalRuntimeStability: 0.20,
          institutionalStabilityFloor: 0.70,
          successionReadinessScore: 0.10,
        }),
      }),
    );

    const healthyBoundary = computeStewardshipBoundary({ totalShards: 10, records: healthyRecords });
    const degradedBoundary = computeStewardshipBoundary({ totalShards: 10, records: degradedRecords });

    const healthyScore = stewardshipMaturityScore(healthyBoundary).maturityScore;
    const degradedScore = stewardshipMaturityScore(degradedBoundary).maturityScore;

    expect(healthyScore).toBeGreaterThan(degradedScore);
  });
});
