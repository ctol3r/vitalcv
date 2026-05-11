/**
 * Governance Stewardship — CI Gate (W2-PR154A)
 *
 * Canary suite. Every public primitive must:
 *   - throw StewardshipError on boundary breaches (not silently allow);
 *   - export an enumerated `violation` field;
 *   - never coerce AMBIGUOUS_STEWARDSHIP verdicts to ACTIVE (silent collapse);
 *   - produce a deterministic, salted stewardshipDigest (not collide across inputs);
 *   - keep SUCCESSION_THRESHOLD_BREACH a hard violation (fail-closed semantics);
 *   - keep CARETAKER_CONTINUITY_FLOOR_BREACH a hard violation.
 *
 * If a future refactor accidentally weakens any of these invariants, this
 * suite breaks the build before the regression ships.
 */

import {
  KNOWN_STEWARDSHIP_KINDS,
  KNOWN_STEWARDSHIP_TIERS,
  KNOWN_STEWARDSHIP_VERDICTS,
  KNOWN_STEWARDSHIP_VIOLATIONS,
  STEWARDSHIP_SENTINELS,
  StewardshipError,
  assertAmbiguityPreserved,
  assertStewardshipBoundary,
  assertSuccessionReadiness,
  caretakeStewardshipShard,
  computeStewardshipBoundary,
  stewardshipDigest,
  type StewardshipKind,
  type StewardshipSignal,
  type StewardshipTier,
  type StewardshipVerdict,
  type StewardshipViolationKind,
} from '../governanceStewardship';

const KNOWN_VERDICTS: StewardshipVerdict[] = [
  'ACTIVE',
  'CARETAKER_CONTINUITY_BREACH',
  'SUCCESSION_TRIGGERED',
  'SUCCESSION_PENDING',
  'AMBIGUOUS_STEWARDSHIP',
  'GOVERNANCE_LINEAGE_BREAK',
  'INSTITUTIONAL_STABILITY_BREACH',
];

const KNOWN_KINDS: StewardshipKind[] = [
  'CARETAKER_CONTINUITY_DRIFT',
  'REPLAY_GOVERNANCE_DRIFT',
  'SUCCESSION_PROTOCOL_BREACH',
  'GOVERNANCE_LINEAGE_BREAK',
  'INSTITUTIONAL_STABILITY_COLLAPSE',
  'AMBIGUOUS_CARETAKER_SIGNAL',
];

const KNOWN_TIERS: StewardshipTier[] = [
  'INSTITUTIONAL',
  'CARETAKER',
  'DEGRADED',
  'SUCCESSION',
  'AMBIGUOUS',
];

const KNOWN_VIOLATIONS: StewardshipViolationKind[] = [
  'AMBIGUOUS_STEWARDSHIP_FORCED_ACTIVE',
  'SUCCESSION_THRESHOLD_BREACH',
  'CARETAKER_CONTINUITY_FLOOR_BREACH',
  'REPLAY_GOVERNANCE_CARETAKER_OPEN_FAILURE',
];

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

// ── Enum contract ─────────────────────────────────────────────────────────────

describe('CI gate — exported enums match runtime sentinels', () => {
  it('every exported verdict is in KNOWN_STEWARDSHIP_VERDICTS', () => {
    for (const v of KNOWN_VERDICTS) {
      expect(KNOWN_STEWARDSHIP_VERDICTS).toContain(v);
    }
    expect(KNOWN_STEWARDSHIP_VERDICTS).toHaveLength(KNOWN_VERDICTS.length);
  });

  it('every exported kind is in KNOWN_STEWARDSHIP_KINDS', () => {
    for (const k of KNOWN_KINDS) {
      expect(KNOWN_STEWARDSHIP_KINDS).toContain(k);
    }
    expect(KNOWN_STEWARDSHIP_KINDS).toHaveLength(KNOWN_KINDS.length);
  });

  it('every exported tier is in KNOWN_STEWARDSHIP_TIERS', () => {
    for (const t of KNOWN_TIERS) {
      expect(KNOWN_STEWARDSHIP_TIERS).toContain(t);
    }
    expect(KNOWN_STEWARDSHIP_TIERS).toHaveLength(KNOWN_TIERS.length);
  });

  it('every exported violation is in KNOWN_STEWARDSHIP_VIOLATIONS', () => {
    for (const v of KNOWN_VIOLATIONS) {
      expect(KNOWN_STEWARDSHIP_VIOLATIONS).toContain(v);
    }
    expect(KNOWN_STEWARDSHIP_VIOLATIONS).toHaveLength(KNOWN_VIOLATIONS.length);
  });

  it('all sentinel arrays are frozen', () => {
    expect(Object.isFrozen(KNOWN_STEWARDSHIP_VERDICTS)).toBe(true);
    expect(Object.isFrozen(KNOWN_STEWARDSHIP_KINDS)).toBe(true);
    expect(Object.isFrozen(KNOWN_STEWARDSHIP_TIERS)).toBe(true);
    expect(Object.isFrozen(KNOWN_STEWARDSHIP_VIOLATIONS)).toBe(true);
    expect(Object.isFrozen(STEWARDSHIP_SENTINELS)).toBe(true);
  });
});

// ── StewardshipError contract ─────────────────────────────────────────────────

describe('CI gate — StewardshipError contract', () => {
  it('every breach primitive throws a StewardshipError with a known violation', () => {
    const cases: Array<{ name: string; expected: StewardshipViolationKind; run: () => void }> = [
      {
        name: 'assertAmbiguityPreserved when ambiguity forced to ACTIVE',
        expected: 'AMBIGUOUS_STEWARDSHIP_FORCED_ACTIVE',
        run: () =>
          assertAmbiguityPreserved({ ...caretakeStewardshipShard({ shardId: 'x', signal: healthySignal() }), ambiguous: true }),
      },
      {
        name: 'assertSuccessionReadiness when readiness below threshold',
        expected: 'SUCCESSION_THRESHOLD_BREACH',
        run: () => {
          const sig = healthySignal({
            successionPendingConfirmation: true,
            successionReadinessScore: 0.20,
            successionActivationThreshold: 0.75,
          });
          const rec = caretakeStewardshipShard({ shardId: 'x', signal: sig });
          assertSuccessionReadiness(rec, sig);
        },
      },
      {
        name: 'assertStewardshipBoundary when lineage break exists',
        expected: 'REPLAY_GOVERNANCE_CARETAKER_OPEN_FAILURE',
        run: () => {
          const records = [
            caretakeStewardshipShard({
              shardId: 'x',
              signal: healthySignal({ governanceLineageDepth: 0, governanceLineageTarget: 3 }),
            }),
          ];
          const boundary = computeStewardshipBoundary({ totalShards: 1, records });
          assertStewardshipBoundary(boundary);
        },
      },
      {
        name: 'assertStewardshipBoundary when continuity floor breached',
        expected: 'CARETAKER_CONTINUITY_FLOOR_BREACH',
        run: () => {
          const records = [
            caretakeStewardshipShard({
              shardId: 'x',
              signal: healthySignal({ caretakerContinuityScore: 0.30, caretakerContinuityThreshold: 0.80 }),
            }),
          ];
          const boundary = computeStewardshipBoundary({ totalShards: 5, records });
          assertStewardshipBoundary(boundary);
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
      expect(caught).toBeInstanceOf(StewardshipError);
      const err = caught as StewardshipError;
      expect(err.code).toBe('STEWARDSHIP_VIOLATION');
      expect(KNOWN_VIOLATIONS).toContain(err.violation);
      expect(err.violation).toBe(c.expected);
    }
  });
});

// ── stewardshipDigest uniqueness ──────────────────────────────────────────────

describe('CI gate — stewardshipDigest is deterministic and unique', () => {
  it('produces unique digests for distinct inputs and is reproducible', () => {
    const sig = healthySignal();
    const sigB = healthySignal({ caretakerContinuityScore: 0.50 });
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

// ── Ambiguity never collapsed ─────────────────────────────────────────────────

describe('CI gate — ambiguity never silently collapsed', () => {
  it('ambiguous record carries verdict=AMBIGUOUS_STEWARDSHIP and ambiguous=true', () => {
    const r = caretakeStewardshipShard({
      shardId: 's-1',
      signal: healthySignal({ caretakerAmbiguityDetected: true }),
    });
    expect(r.verdict).toBe('AMBIGUOUS_STEWARDSHIP');
    expect(r.ambiguous).toBe(true);
    expect(() => assertAmbiguityPreserved(r)).not.toThrow();
  });

  it('healthy record carries verdict=ACTIVE and ambiguous=false', () => {
    const r = caretakeStewardshipShard({ shardId: 's-1', signal: healthySignal() });
    expect(r.verdict).toBe('ACTIVE');
    expect(r.ambiguous).toBe(false);
  });

  it('lineage break always raises GOVERNANCE_LINEAGE_BREAK (cannot be downgraded)', () => {
    const r = caretakeStewardshipShard({
      shardId: 's-1',
      signal: healthySignal({ governanceLineageDepth: 0, governanceLineageTarget: 3 }),
    });
    expect(r.verdict).toBe('GOVERNANCE_LINEAGE_BREAK');
    expect(r.kind).toBe('GOVERNANCE_LINEAGE_BREAK');
  });
});

// ── Succession fail-closed ────────────────────────────────────────────────────

describe('CI gate — succession protocol is fail-closed', () => {
  it('succession with insufficient readiness yields SUCCESSION_PENDING, not SUCCESSION_TRIGGERED', () => {
    const r = caretakeStewardshipShard({
      shardId: 's-1',
      signal: healthySignal({
        successionPendingConfirmation: true,
        successionReadinessScore: 0.20,
        successionActivationThreshold: 0.75,
      }),
    });
    expect(r.verdict).toBe('SUCCESSION_PENDING');
    expect(r.kind).toBe('SUCCESSION_PROTOCOL_BREACH');
  });

  it('succession with sufficient readiness yields SUCCESSION_TRIGGERED', () => {
    const r = caretakeStewardshipShard({
      shardId: 's-1',
      signal: healthySignal({
        successionPendingConfirmation: true,
        successionReadinessScore: 0.90,
        successionActivationThreshold: 0.75,
      }),
    });
    expect(r.verdict).toBe('SUCCESSION_TRIGGERED');
  });
});
