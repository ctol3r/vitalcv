/**
 * Stewardship Continuity — Chaos Simulations (W2-PR160A)
 *
 * Adversarial test suite. Each scenario attempts to inflate stewardship
 * health beyond what the governance evidence supports. Every case must be
 * detected and suppressed — no silent stewardship decay may survive this
 * battery.
 *
 * Scenarios:
 *   1.  CONTESTED lock with frictionKind omitted → throws
 *   2.  VACANT lock with incumbent present → throws
 *   3.  VOID lock with incumbent → throws
 *   4.  Succession chain: AMBIGUOUS_SUCCESSION without frictionKind → throws
 *   5.  Succession chain: all entries CONTESTED → chainIntact=false
 *   6.  Replay: contested + expired → AMBIGUOUS_STEWARDSHIP preserved
 *   7.  Replay: VACANT lock at replay time → LINEAGE_GAP
 *   8.  Replay: no succession path → LINEAGE_GAP
 *   9.  Telemetry: deduplication of repeated eventIds
 *  10.  Telemetry: VACANCY_DETECTED event sets vacancySignalPresent
 *  11.  Unit classification: stale heartbeat without emergency → AMBIGUOUS
 *  12.  Unit classification: VOID state → CONTINUITY_BREACH verdict
 *  13.  Boundary: any CONTINUITY_BREACH unit → throws
 *  14.  Boundary: stable pct below floor → throws
 *  15.  Maturity: breach in boundary → STEWARDSHIP_BLOCKED verdict
 *  16.  Lineage: shared-org contamination propagates
 *  17.  Emergency activation without vacancy → frictionKind preserved
 *  18.  Dual-incumbency signal with non-CONTESTED lock state → AMBIGUOUS preserved
 *  19.  Empty succession chain → chainIntact=true, no errors
 *  20.  assertContinuityOperational rejects VACANT and VOID locks
 */

import {
  StewardshipHardeningError,
  assertContinuityOperational,
  buildSuccessionChain,
  classifyContinuityUnit,
  computeStewardshipMaturityScore,
  harmonizeStewardshipTelemetry,
  lockContinuity,
  scoreContinuitySurvivability,
  traceCaretakerLineage,
  verifyReplayStewardship,
  type CaretakerIdentity,
  type ContinuitySignal,
  type StewardshipContinuityBoundary,
  type StewardshipSurvivabilityRecord,
} from '../stewardshipContinuity';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCaretaker(id: string): CaretakerIdentity {
  return {
    caretakerId: id,
    role: 'PRIMARY_STEWARD',
    authorityStart: '2026-01-01T00:00:00Z',
    authorityEnd: null,
    orgUnitId: 'org-1',
  };
}

function stableUnit(unitId: string): ContinuitySignal {
  return {
    unitId,
    lockState: 'LOCKED',
    successionChainIntact: true,
    lastHeartbeatAt: '2026-05-10T12:00:00Z',
    observationWindowStart: '2026-05-10T00:00:00Z',
    vacancySignalPresent: false,
    contestedSignalPresent: false,
    emergencyActivated: false,
    operationalNote: null,
  };
}

function stableRecord(unitId: string): StewardshipSurvivabilityRecord {
  return classifyContinuityUnit(stableUnit(unitId));
}

// ── Scenario 1 — CONTESTED lock missing frictionKind ─────────────────────────

describe('Chaos scenario 1 — CONTESTED lock without frictionKind throws', () => {
  it('raises CONTESTED_LOCK_OPEN_FAILURE', () => {
    expect(() =>
      lockContinuity({
        unitId: 'u-contested',
        state: 'CONTESTED',
        incumbent: makeCaretaker('c-1'),
        frictionKind: null,
      }),
    ).toThrow(StewardshipHardeningError);

    try {
      lockContinuity({
        unitId: 'u-contested',
        state: 'CONTESTED',
        incumbent: makeCaretaker('c-1'),
        frictionKind: null,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(StewardshipHardeningError);
      expect((err as StewardshipHardeningError).violation).toBe('CONTESTED_LOCK_OPEN_FAILURE');
    }
  });
});

// ── Scenario 2 — VACANT lock with incumbent ───────────────────────────────────

describe('Chaos scenario 2 — VACANT lock with incumbent throws', () => {
  it('raises VACANT_LOCK_FORCED_ACTIVE', () => {
    expect(() =>
      lockContinuity({
        unitId: 'u-vacant',
        state: 'VACANT',
        incumbent: makeCaretaker('c-ghost'),
      }),
    ).toThrow(StewardshipHardeningError);

    try {
      lockContinuity({
        unitId: 'u-vacant',
        state: 'VACANT',
        incumbent: makeCaretaker('c-ghost'),
      });
    } catch (err) {
      expect((err as StewardshipHardeningError).violation).toBe('VACANT_LOCK_FORCED_ACTIVE');
    }
  });
});

// ── Scenario 3 — VOID lock with caretaker ────────────────────────────────────

describe('Chaos scenario 3 — VOID lock with incumbent throws', () => {
  it('raises VACANT_LOCK_FORCED_ACTIVE', () => {
    expect(() =>
      lockContinuity({
        unitId: 'u-void',
        state: 'VOID',
        incumbent: makeCaretaker('c-phantom'),
      }),
    ).toThrow(StewardshipHardeningError);
  });
});

// ── Scenario 4 — AMBIGUOUS_SUCCESSION without frictionKind ───────────────────

describe('Chaos scenario 4 — AMBIGUOUS_SUCCESSION entry without frictionKind throws', () => {
  it('raises AMBIGUOUS_SUCCESSION_FORCED_SUCCEEDED', () => {
    expect(() =>
      buildSuccessionChain({
        unitId: 'u-chain',
        entries: [
          {
            entryId: 'e-1',
            predecessor: makeCaretaker('c-old'),
            successor: makeCaretaker('c-new'),
            handoffDigest: 'abc123',
            handoffAt: '2026-05-01T00:00:00Z',
            verdict: 'AMBIGUOUS_SUCCESSION',
            frictionKind: null,
          },
        ],
      }),
    ).toThrow(StewardshipHardeningError);

    try {
      buildSuccessionChain({
        unitId: 'u-chain',
        entries: [
          {
            entryId: 'e-1',
            predecessor: makeCaretaker('c-old'),
            successor: makeCaretaker('c-new'),
            handoffDigest: 'abc123',
            handoffAt: '2026-05-01T00:00:00Z',
            verdict: 'AMBIGUOUS_SUCCESSION',
            frictionKind: null,
          },
        ],
      });
    } catch (err) {
      expect((err as StewardshipHardeningError).violation).toBe(
        'AMBIGUOUS_SUCCESSION_FORCED_SUCCEEDED',
      );
    }
  });
});

// ── Scenario 5 — All-contested succession chain ───────────────────────────────

describe('Chaos scenario 5 — all-contested succession chain marks chainIntact=false', () => {
  it('chainIntact is false and ambiguousCount matches entry count', () => {
    const chain = buildSuccessionChain({
      unitId: 'u-all-contested',
      entries: [
        {
          entryId: 'e-1',
          predecessor: null,
          successor: makeCaretaker('c-1'),
          handoffDigest: 'dd1',
          handoffAt: '2026-05-01T00:00:00Z',
          verdict: 'CONTESTED',
          frictionKind: 'DUAL_INCUMBENCY',
        },
        {
          entryId: 'e-2',
          predecessor: makeCaretaker('c-1'),
          successor: makeCaretaker('c-2'),
          handoffDigest: 'dd2',
          handoffAt: '2026-05-02T00:00:00Z',
          verdict: 'CONTESTED',
          frictionKind: 'DUAL_INCUMBENCY',
        },
      ],
    });

    expect(chain.chainIntact).toBe(false);
    expect(chain.ambiguousCount).toBe(2);
    expect(chain.vacancyCount).toBe(0);
  });
});

// ── Scenario 6 — Replay: contested + expired → AMBIGUOUS preserved ────────────

describe('Chaos scenario 6 — contested + expired replay → AMBIGUOUS_STEWARDSHIP', () => {
  it('preserves ambiguity, does not resolve to VERIFIED or CONTESTED_AUTHORITY', () => {
    const record = verifyReplayStewardship({
      capsuleId: 'cap-amb',
      replayIssuedAt: '2026-05-10T10:00:00Z',
      assertedCaretaker: makeCaretaker('c-past'),
      lockStateAtReplay: 'LOCKED',
      authoritySpansReplay: false,
      successionPathPresent: true,
      authorityContestedAtReplay: true,
    });

    expect(record.verdict).toBe('AMBIGUOUS_STEWARDSHIP');
    expect(record.frictionKind).toBe('AMBIGUOUS_CONTINUITY_SIGNAL');
  });
});

// ── Scenario 7 — Replay: VACANT lock at replay time ──────────────────────────

describe('Chaos scenario 7 — VACANT lock at replay time → LINEAGE_GAP', () => {
  it('returns LINEAGE_GAP verdict', () => {
    const record = verifyReplayStewardship({
      capsuleId: 'cap-vacant-replay',
      replayIssuedAt: '2026-05-10T10:00:00Z',
      assertedCaretaker: makeCaretaker('c-nobody'),
      lockStateAtReplay: 'VACANT',
      authoritySpansReplay: true,
      successionPathPresent: true,
      authorityContestedAtReplay: false,
    });

    expect(record.verdict).toBe('LINEAGE_GAP');
    expect(record.frictionKind).toBe('CARETAKER_AUTHORITY_LAPSE');
  });
});

// ── Scenario 8 — Replay: no succession path → LINEAGE_GAP ────────────────────

describe('Chaos scenario 8 — missing succession path → LINEAGE_GAP', () => {
  it('returns LINEAGE_GAP with LINEAGE_CHAIN_BROKEN', () => {
    const record = verifyReplayStewardship({
      capsuleId: 'cap-no-path',
      replayIssuedAt: '2026-05-10T10:00:00Z',
      assertedCaretaker: makeCaretaker('c-mystery'),
      lockStateAtReplay: 'LOCKED',
      authoritySpansReplay: true,
      successionPathPresent: false,
      authorityContestedAtReplay: false,
    });

    expect(record.verdict).toBe('LINEAGE_GAP');
    expect(record.frictionKind).toBe('LINEAGE_CHAIN_BROKEN');
  });
});

// ── Scenario 9 — Telemetry: duplicate eventId deduplication ──────────────────

describe('Chaos scenario 9 — duplicate eventId is deduplicated', () => {
  it('deduplicatedEventCount < eventCount and duplicateEventIds non-empty', () => {
    const event = {
      eventId: 'evt-dup',
      unitId: 'u-telemetry',
      caretakerId: 'c-1',
      eventType: 'HEARTBEAT' as const,
      emittedAt: '2026-05-10T10:00:00Z',
      payloadDigest: 'pd1',
    };

    const result = harmonizeStewardshipTelemetry([event, event, event]);
    expect(result.eventCount).toBe(3);
    expect(result.deduplicatedEventCount).toBe(1);
    expect(result.duplicateEventIds).toContain('evt-dup');
  });
});

// ── Scenario 10 — Telemetry: VACANCY_DETECTED sets signal ────────────────────

describe('Chaos scenario 10 — VACANCY_DETECTED event surfaces vacancySignalPresent', () => {
  it('vacancySignalPresent=true when VACANCY_DETECTED in stream', () => {
    const result = harmonizeStewardshipTelemetry([
      {
        eventId: 'evt-v',
        unitId: 'u-vac',
        caretakerId: 'c-none',
        eventType: 'VACANCY_DETECTED',
        emittedAt: '2026-05-10T11:00:00Z',
        payloadDigest: 'pd-v',
      },
      {
        eventId: 'evt-hb',
        unitId: 'u-vac',
        caretakerId: 'c-none',
        eventType: 'HEARTBEAT',
        emittedAt: '2026-05-10T11:01:00Z',
        payloadDigest: 'pd-hb',
      },
    ]);

    expect(result.vacancySignalPresent).toBe(true);
    expect(result.contestedSignalPresent).toBe(false);
    expect(result.lastHeartbeatAt).toBe('2026-05-10T11:01:00Z');
  });
});

// ── Scenario 11 — Classification: stale heartbeat → AMBIGUOUS ────────────────

describe('Chaos scenario 11 — stale heartbeat without emergency → AMBIGUOUS_STEWARDSHIP', () => {
  it('preserves telemetry gap ambiguity', () => {
    const record = classifyContinuityUnit({
      unitId: 'u-stale',
      lockState: 'LOCKED',
      successionChainIntact: true,
      lastHeartbeatAt: '2026-04-01T00:00:00Z', // before window
      observationWindowStart: '2026-05-01T00:00:00Z',
      vacancySignalPresent: false,
      contestedSignalPresent: false,
      emergencyActivated: false,
      operationalNote: null,
    });

    expect(record.verdict).toBe('AMBIGUOUS_STEWARDSHIP');
    expect(record.frictionKind).toBe('TELEMETRY_GAP');
  });
});

// ── Scenario 12 — Classification: VOID state → CONTINUITY_BREACH ─────────────

describe('Chaos scenario 12 — VOID lock state → CONTINUITY_BREACH verdict', () => {
  it('returns CONTINUITY_BREACH, never STABLE', () => {
    const record = classifyContinuityUnit({
      unitId: 'u-void-class',
      lockState: 'VOID',
      successionChainIntact: true,
      lastHeartbeatAt: '2026-05-10T12:00:00Z',
      observationWindowStart: '2026-05-10T00:00:00Z',
      vacancySignalPresent: false,
      contestedSignalPresent: false,
      emergencyActivated: false,
      operationalNote: null,
    });

    expect(record.verdict).toBe('CONTINUITY_BREACH');
    expect(record.frictionKind).toBe('AMBIGUOUS_CONTINUITY_SIGNAL');
  });
});

// ── Scenario 13 — Boundary: CONTINUITY_BREACH unit → throws ──────────────────

describe('Chaos scenario 13 — boundary with CONTINUITY_BREACH unit throws', () => {
  it('raises CONTINUITY_BREACH violation', () => {
    const breachRecord: StewardshipSurvivabilityRecord = {
      schema: 'vitalcv.stewardship-survivability-record.v1',
      unitId: 'u-breach',
      verdict: 'CONTINUITY_BREACH',
      frictionKind: 'AMBIGUOUS_CONTINUITY_SIGNAL',
      survivabilityDigest: 'digest-breach',
      lineageHints: { governanceScopeId: null, tenantPoolId: null, replayShardId: null },
      scoredAt: '2026-05-10T12:00:00Z',
    };

    expect(() =>
      scoreContinuitySurvivability([stableRecord('u-ok-1'), stableRecord('u-ok-2'), breachRecord]),
    ).toThrow(StewardshipHardeningError);

    try {
      scoreContinuitySurvivability([stableRecord('u-ok-1'), breachRecord]);
    } catch (err) {
      expect((err as StewardshipHardeningError).violation).toBe('CONTINUITY_BREACH');
    }
  });
});

// ── Scenario 14 — Boundary: stable pct below floor → throws ──────────────────

describe('Chaos scenario 14 — stable pct below floor throws SURVIVABILITY_FLOOR_BREACHED', () => {
  it('raises when stablePct < configured floor', () => {
    const vacantRecord: StewardshipSurvivabilityRecord = {
      schema: 'vitalcv.stewardship-survivability-record.v1',
      unitId: 'u-vacant-b',
      verdict: 'VACANT',
      frictionKind: 'CARETAKER_AUTHORITY_LAPSE',
      survivabilityDigest: 'digest-vacant',
      lineageHints: { governanceScopeId: null, tenantPoolId: null, replayShardId: null },
      scoredAt: '2026-05-10T12:00:00Z',
    };

    // 1 stable / 4 total = 25% — below 70% default floor.
    expect(() =>
      scoreContinuitySurvivability([
        stableRecord('u-ok'),
        vacantRecord,
        vacantRecord,
        vacantRecord,
      ]),
    ).toThrow(StewardshipHardeningError);

    try {
      scoreContinuitySurvivability([stableRecord('u-ok'), vacantRecord, vacantRecord, vacantRecord]);
    } catch (err) {
      expect((err as StewardshipHardeningError).violation).toBe(
        'SURVIVABILITY_FLOOR_BREACHED',
      );
    }
  });
});

// ── Scenario 15 — Maturity: breach boundary → STEWARDSHIP_BLOCKED ────────────

describe('Chaos scenario 15 — maturity score with breach boundary → STEWARDSHIP_BLOCKED', () => {
  it('verdict is STEWARDSHIP_BLOCKED when breachCount > 0', () => {
    const breachBoundary: StewardshipContinuityBoundary = {
      schema: 'vitalcv.stewardship-continuity-boundary.v1',
      totalUnits: 3,
      stableCount: 2,
      partialStableCount: 0,
      ambiguousCount: 0,
      vacantCount: 0,
      breachCount: 1,
      stablePct: 66.7,
      partitioned: false,
      boundaryDigest: 'bd-breach',
      evaluatedAt: '2026-05-10T12:00:00Z',
    };

    const score = computeStewardshipMaturityScore({
      boundary: breachBoundary,
      replayRecords: [],
      successionChains: [],
    });

    expect(score.verdict).toBe('STEWARDSHIP_BLOCKED');
  });
});

// ── Scenario 16 — Lineage: shared-org contamination propagates ───────────────

describe('Chaos scenario 16 — shared org-unit contaminates peer caretakers', () => {
  it('peer with same orgUnitId appears in contaminatedCaretakerIds', () => {
    const lineage = traceCaretakerLineage({
      rootCaretakerId: 'c-root',
      rootHints: { orgUnitId: 'org-shared' },
      candidates: [
        { caretakerId: 'c-peer-1', hints: { orgUnitId: 'org-shared' } },
        { caretakerId: 'c-peer-2', hints: { orgUnitId: 'org-other' } },
        { caretakerId: 'c-peer-3', hints: { orgUnitId: 'org-shared' } },
      ],
    });

    expect(lineage.contaminatedCaretakerIds).toContain('c-peer-1');
    expect(lineage.contaminatedCaretakerIds).toContain('c-peer-3');
    expect(lineage.contaminatedCaretakerIds).not.toContain('c-peer-2');
  });
});

// ── Scenario 17 — Emergency activation without vacancy ───────────────────────

describe('Chaos scenario 17 — emergency steward active while chain intact', () => {
  it('classifies as STABLE (emergency steward covers heartbeat gap)', () => {
    const record = classifyContinuityUnit({
      unitId: 'u-emergency',
      lockState: 'LOCKED',
      successionChainIntact: true,
      lastHeartbeatAt: null, // no heartbeat — would normally be AMBIGUOUS
      observationWindowStart: '2026-05-10T00:00:00Z',
      vacancySignalPresent: false,
      contestedSignalPresent: false,
      emergencyActivated: true, // covers the gap
      operationalNote: 'emergency steward active',
    });

    // emergency activation covers the telemetry gap
    expect(record.verdict).toBe('STABLE');
  });
});

// ── Scenario 18 — Contested signal with non-CONTESTED lock state ─────────────

describe('Chaos scenario 18 — contestedSignal with LOCKED state → AMBIGUOUS preserved', () => {
  it('returns AMBIGUOUS_STEWARDSHIP with AMBIGUOUS_CONTINUITY_SIGNAL', () => {
    const record = classifyContinuityUnit({
      unitId: 'u-signal-mismatch',
      lockState: 'LOCKED', // lock says fine
      successionChainIntact: true,
      lastHeartbeatAt: '2026-05-10T12:00:00Z',
      observationWindowStart: '2026-05-10T00:00:00Z',
      vacancySignalPresent: false,
      contestedSignalPresent: true, // but signal says contested
      emergencyActivated: false,
      operationalNote: null,
    });

    expect(record.verdict).toBe('AMBIGUOUS_STEWARDSHIP');
    expect(record.frictionKind).toBe('AMBIGUOUS_CONTINUITY_SIGNAL');
  });
});

// ── Scenario 19 — Empty succession chain ─────────────────────────────────────

describe('Chaos scenario 19 — empty succession chain is valid', () => {
  it('chainIntact=true, zero ambiguous/vacant counts, no throw', () => {
    const chain = buildSuccessionChain({ unitId: 'u-empty', entries: [] });
    expect(chain.chainIntact).toBe(true);
    expect(chain.ambiguousCount).toBe(0);
    expect(chain.vacancyCount).toBe(0);
    expect(chain.entries).toHaveLength(0);
  });
});

// ── Scenario 20 — assertContinuityOperational rejects non-operational states ──

describe('Chaos scenario 20 — assertContinuityOperational rejects VACANT and VOID', () => {
  it('throws StewardshipHardeningError for VACANT lock', () => {
    const vacantLock = lockContinuity({
      unitId: 'u-assert-vacant',
      state: 'VACANT',
      incumbent: null,
      frictionKind: 'CARETAKER_AUTHORITY_LAPSE',
    });

    expect(() => assertContinuityOperational(vacantLock)).toThrow(StewardshipHardeningError);
  });

  it('throws StewardshipHardeningError for VOID lock', () => {
    const voidLock = lockContinuity({
      unitId: 'u-assert-void',
      state: 'VOID',
      incumbent: null,
    });

    expect(() => assertContinuityOperational(voidLock)).toThrow(StewardshipHardeningError);
  });

  it('does not throw for LOCKED or SUCCESSION_PENDING', () => {
    const locked = lockContinuity({
      unitId: 'u-assert-locked',
      state: 'LOCKED',
      incumbent: makeCaretaker('c-active'),
    });

    const pending = lockContinuity({
      unitId: 'u-assert-pending',
      state: 'SUCCESSION_PENDING',
      incumbent: makeCaretaker('c-outgoing'),
      successorCandidate: makeCaretaker('c-incoming'),
    });

    expect(() => assertContinuityOperational(locked)).not.toThrow();
    expect(() => assertContinuityOperational(pending)).not.toThrow();
  });
});
