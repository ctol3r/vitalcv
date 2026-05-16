/**
 * Stewardship Continuity — CI Gate (W2-PR160A)
 *
 * Canary suite. Every public primitive must:
 *   - export frozen enum sentinels that match the runtime type unions;
 *   - throw StewardshipHardeningError on boundary breaches (not silently allow);
 *   - carry a known .violation field on every error;
 *   - never coerce AMBIGUOUS or CONTESTED verdicts to healthy states;
 *   - produce deterministic, salted digests (no collision across inputs);
 *   - carry correct schema strings on all output records.
 *
 * If a future refactor accidentally weakens any of these invariants, this
 * suite breaks the build before the regression ships.
 */

import {
  KNOWN_CARETAKER_ROLES,
  KNOWN_CONTINUITY_FRICTION_KINDS,
  KNOWN_CONTINUITY_LOCK_STATES,
  KNOWN_STEWARDSHIP_HARDENING_VIOLATIONS,
  KNOWN_STEWARDSHIP_REPLAY_VERDICTS,
  KNOWN_STEWARDSHIP_SURVIVABILITY_VERDICTS,
  KNOWN_SUCCESSION_VERDICTS,
  STEWARDSHIP_SENTINELS,
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
  type CaretakerRole,
  type ContinuityFrictionKind,
  type ContinuityLockState,
  type StewardshipHardeningViolationKind,
  type StewardshipReplayVerdict,
  type StewardshipSurvivabilityVerdict,
  type SuccessionVerdict,
} from '../stewardshipContinuity';

// ── Expected enums ────────────────────────────────────────────────────────────

const EXPECTED_CARETAKER_ROLES: CaretakerRole[] = [
  'PRIMARY_STEWARD',
  'SECONDARY_STEWARD',
  'INTERIM_STEWARD',
  'AUDITOR_STEWARD',
  'EMERGENCY_STEWARD',
];

const EXPECTED_LOCK_STATES: ContinuityLockState[] = [
  'LOCKED',
  'SUCCESSION_PENDING',
  'CONTESTED',
  'VACANT',
  'VOID',
];

const EXPECTED_SUCCESSION_VERDICTS: SuccessionVerdict[] = [
  'SUCCEEDED',
  'CONTESTED',
  'VACANT',
  'AMBIGUOUS_SUCCESSION',
  'HANDOFF_TIMEOUT',
];

const EXPECTED_REPLAY_VERDICTS: StewardshipReplayVerdict[] = [
  'VERIFIED',
  'CARETAKER_EXPIRED',
  'LINEAGE_GAP',
  'CONTESTED_AUTHORITY',
  'AMBIGUOUS_STEWARDSHIP',
];

const EXPECTED_SURVIVABILITY_VERDICTS: StewardshipSurvivabilityVerdict[] = [
  'STABLE',
  'PARTIAL_STABLE',
  'AMBIGUOUS_STEWARDSHIP',
  'VACANT',
  'CONTINUITY_BREACH',
];

const EXPECTED_FRICTION_KINDS: ContinuityFrictionKind[] = [
  'DUAL_INCUMBENCY',
  'HANDOFF_DIGEST_MISMATCH',
  'SUCCESSION_WINDOW_EXPIRED',
  'CARETAKER_AUTHORITY_LAPSE',
  'LINEAGE_CHAIN_BROKEN',
  'TELEMETRY_GAP',
  'EMERGENCY_ACTIVATION_WITHOUT_GAP',
  'AMBIGUOUS_CONTINUITY_SIGNAL',
];

const EXPECTED_VIOLATIONS: StewardshipHardeningViolationKind[] = [
  'AMBIGUOUS_SUCCESSION_FORCED_SUCCEEDED',
  'VACANT_LOCK_FORCED_ACTIVE',
  'CONTINUITY_BREACH',
  'CONTESTED_LOCK_OPEN_FAILURE',
  'SURVIVABILITY_FLOOR_BREACHED',
];

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCaretaker(id = 'c-test'): CaretakerIdentity {
  return {
    caretakerId: id,
    role: 'PRIMARY_STEWARD',
    authorityStart: '2026-01-01T00:00:00Z',
    authorityEnd: null,
    orgUnitId: 'org-gate',
  };
}

// ── Enum coverage ─────────────────────────────────────────────────────────────

describe('CI gate — exported enums match runtime sentinels', () => {
  it('KNOWN_CARETAKER_ROLES is frozen and covers all expected roles', () => {
    expect(Object.isFrozen(KNOWN_CARETAKER_ROLES)).toBe(true);
    expect(KNOWN_CARETAKER_ROLES).toHaveLength(EXPECTED_CARETAKER_ROLES.length);
    for (const r of EXPECTED_CARETAKER_ROLES) {
      expect(KNOWN_CARETAKER_ROLES).toContain(r);
    }
  });

  it('KNOWN_CONTINUITY_LOCK_STATES is frozen and covers all expected states', () => {
    expect(Object.isFrozen(KNOWN_CONTINUITY_LOCK_STATES)).toBe(true);
    expect(KNOWN_CONTINUITY_LOCK_STATES).toHaveLength(EXPECTED_LOCK_STATES.length);
    for (const s of EXPECTED_LOCK_STATES) {
      expect(KNOWN_CONTINUITY_LOCK_STATES).toContain(s);
    }
  });

  it('KNOWN_SUCCESSION_VERDICTS is frozen and covers all expected verdicts', () => {
    expect(Object.isFrozen(KNOWN_SUCCESSION_VERDICTS)).toBe(true);
    expect(KNOWN_SUCCESSION_VERDICTS).toHaveLength(EXPECTED_SUCCESSION_VERDICTS.length);
    for (const v of EXPECTED_SUCCESSION_VERDICTS) {
      expect(KNOWN_SUCCESSION_VERDICTS).toContain(v);
    }
  });

  it('KNOWN_STEWARDSHIP_REPLAY_VERDICTS is frozen and covers all expected verdicts', () => {
    expect(Object.isFrozen(KNOWN_STEWARDSHIP_REPLAY_VERDICTS)).toBe(true);
    expect(KNOWN_STEWARDSHIP_REPLAY_VERDICTS).toHaveLength(EXPECTED_REPLAY_VERDICTS.length);
    for (const v of EXPECTED_REPLAY_VERDICTS) {
      expect(KNOWN_STEWARDSHIP_REPLAY_VERDICTS).toContain(v);
    }
  });

  it('KNOWN_STEWARDSHIP_SURVIVABILITY_VERDICTS is frozen and covers all expected verdicts', () => {
    expect(Object.isFrozen(KNOWN_STEWARDSHIP_SURVIVABILITY_VERDICTS)).toBe(true);
    expect(KNOWN_STEWARDSHIP_SURVIVABILITY_VERDICTS).toHaveLength(
      EXPECTED_SURVIVABILITY_VERDICTS.length,
    );
    for (const v of EXPECTED_SURVIVABILITY_VERDICTS) {
      expect(KNOWN_STEWARDSHIP_SURVIVABILITY_VERDICTS).toContain(v);
    }
  });

  it('KNOWN_CONTINUITY_FRICTION_KINDS is frozen and covers all expected kinds', () => {
    expect(Object.isFrozen(KNOWN_CONTINUITY_FRICTION_KINDS)).toBe(true);
    expect(KNOWN_CONTINUITY_FRICTION_KINDS).toHaveLength(EXPECTED_FRICTION_KINDS.length);
    for (const k of EXPECTED_FRICTION_KINDS) {
      expect(KNOWN_CONTINUITY_FRICTION_KINDS).toContain(k);
    }
  });

  it('KNOWN_STEWARDSHIP_HARDENING_VIOLATIONS is frozen and covers all expected violations', () => {
    expect(Object.isFrozen(KNOWN_STEWARDSHIP_HARDENING_VIOLATIONS)).toBe(true);
    expect(KNOWN_STEWARDSHIP_HARDENING_VIOLATIONS).toHaveLength(EXPECTED_VIOLATIONS.length);
    for (const v of EXPECTED_VIOLATIONS) {
      expect(KNOWN_STEWARDSHIP_HARDENING_VIOLATIONS).toContain(v);
    }
  });

  it('STEWARDSHIP_SENTINELS is frozen', () => {
    expect(Object.isFrozen(STEWARDSHIP_SENTINELS)).toBe(true);
  });
});

// ── StewardshipHardeningError contract ───────────────────────────────────────

describe('CI gate — StewardshipHardeningError contract', () => {
  it('every breach primitive throws a StewardshipHardeningError with a known violation', () => {
    const cases: Array<{ name: string; run: () => void; expectedViolation: StewardshipHardeningViolationKind }> = [
      {
        name: 'lockContinuity CONTESTED without frictionKind',
        expectedViolation: 'CONTESTED_LOCK_OPEN_FAILURE',
        run: () =>
          lockContinuity({ unitId: 'u-1', state: 'CONTESTED', incumbent: makeCaretaker(), frictionKind: null }),
      },
      {
        name: 'lockContinuity VACANT with incumbent',
        expectedViolation: 'VACANT_LOCK_FORCED_ACTIVE',
        run: () =>
          lockContinuity({ unitId: 'u-2', state: 'VACANT', incumbent: makeCaretaker() }),
      },
      {
        name: 'lockContinuity VOID with incumbent',
        expectedViolation: 'VACANT_LOCK_FORCED_ACTIVE',
        run: () =>
          lockContinuity({ unitId: 'u-3', state: 'VOID', incumbent: makeCaretaker() }),
      },
      {
        name: 'buildSuccessionChain AMBIGUOUS_SUCCESSION without frictionKind',
        expectedViolation: 'AMBIGUOUS_SUCCESSION_FORCED_SUCCEEDED',
        run: () =>
          buildSuccessionChain({
            unitId: 'u-4',
            entries: [{
              entryId: 'e-1',
              predecessor: null,
              successor: makeCaretaker(),
              handoffDigest: 'hd',
              handoffAt: '2026-05-01T00:00:00Z',
              verdict: 'AMBIGUOUS_SUCCESSION',
              frictionKind: null,
            }],
          }),
      },
      {
        name: 'scoreContinuitySurvivability with CONTINUITY_BREACH unit',
        expectedViolation: 'CONTINUITY_BREACH',
        run: () =>
          scoreContinuitySurvivability([
            {
              schema: 'vitalcv.stewardship-survivability-record.v1',
              unitId: 'u-breach',
              verdict: 'CONTINUITY_BREACH',
              frictionKind: 'AMBIGUOUS_CONTINUITY_SIGNAL',
              survivabilityDigest: 'dig',
              lineageHints: { governanceScopeId: null, tenantPoolId: null, replayShardId: null },
              scoredAt: '2026-05-10T00:00:00Z',
            },
          ]),
      },
      {
        name: 'assertContinuityOperational VACANT lock',
        expectedViolation: 'VACANT_LOCK_FORCED_ACTIVE',
        run: () => {
          const lock = lockContinuity({
            unitId: 'u-op',
            state: 'VACANT',
            incumbent: null,
            frictionKind: 'CARETAKER_AUTHORITY_LAPSE',
          });
          assertContinuityOperational(lock);
        },
      },
    ];

    for (const { name, run, expectedViolation } of cases) {
      try {
        run();
        throw new Error(`Expected StewardshipHardeningError for case: ${name}`);
      } catch (err) {
        expect(err).toBeInstanceOf(StewardshipHardeningError);
        expect((err as StewardshipHardeningError).code).toBe('STEWARDSHIP_HARDENING_VIOLATION');
        expect((err as StewardshipHardeningError).violation).toBe(expectedViolation);
        expect(KNOWN_STEWARDSHIP_HARDENING_VIOLATIONS).toContain(
          (err as StewardshipHardeningError).violation,
        );
      }
    }
  });
});

// ── Schema string contract ────────────────────────────────────────────────────

describe('CI gate — schema strings on all record types', () => {
  it('lockContinuity output carries SCHEMA_LOCK', () => {
    const lock = lockContinuity({ unitId: 'u-schema', state: 'LOCKED', incumbent: makeCaretaker() });
    expect(lock.schema).toBe(STEWARDSHIP_SENTINELS.SCHEMA_LOCK);
  });

  it('buildSuccessionChain output carries SCHEMA_SUCCESSION', () => {
    const chain = buildSuccessionChain({ unitId: 'u-schema', entries: [] });
    expect(chain.schema).toBe(STEWARDSHIP_SENTINELS.SCHEMA_SUCCESSION);
  });

  it('verifyReplayStewardship output carries SCHEMA_REPLAY', () => {
    const record = verifyReplayStewardship({
      capsuleId: 'cap-schema',
      replayIssuedAt: '2026-05-10T10:00:00Z',
      assertedCaretaker: makeCaretaker(),
      lockStateAtReplay: 'LOCKED',
      authoritySpansReplay: true,
      successionPathPresent: true,
      authorityContestedAtReplay: false,
    });
    expect(record.schema).toBe(STEWARDSHIP_SENTINELS.SCHEMA_REPLAY);
  });

  it('harmonizeStewardshipTelemetry output carries SCHEMA_TELEMETRY', () => {
    const result = harmonizeStewardshipTelemetry([]);
    expect(result.schema).toBe(STEWARDSHIP_SENTINELS.SCHEMA_TELEMETRY);
  });

  it('classifyContinuityUnit output carries SCHEMA_SURVIVABILITY', () => {
    const record = classifyContinuityUnit({
      unitId: 'u-schema-class',
      lockState: 'LOCKED',
      successionChainIntact: true,
      lastHeartbeatAt: '2026-05-10T12:00:00Z',
      observationWindowStart: '2026-05-10T00:00:00Z',
      vacancySignalPresent: false,
      contestedSignalPresent: false,
      emergencyActivated: false,
      operationalNote: null,
    });
    expect(record.schema).toBe(STEWARDSHIP_SENTINELS.SCHEMA_SURVIVABILITY);
  });

  it('scoreContinuitySurvivability output carries SCHEMA_BOUNDARY', () => {
    const stableRec = classifyContinuityUnit({
      unitId: 'u-bd',
      lockState: 'LOCKED',
      successionChainIntact: true,
      lastHeartbeatAt: '2026-05-10T12:00:00Z',
      observationWindowStart: '2026-05-10T00:00:00Z',
      vacancySignalPresent: false,
      contestedSignalPresent: false,
      emergencyActivated: false,
      operationalNote: null,
    });
    const boundary = scoreContinuitySurvivability([stableRec]);
    expect(boundary.schema).toBe(STEWARDSHIP_SENTINELS.SCHEMA_BOUNDARY);
  });

  it('computeStewardshipMaturityScore output carries SCHEMA_MATURITY', () => {
    const boundary = scoreContinuitySurvivability([
      classifyContinuityUnit({
        unitId: 'u-mat',
        lockState: 'LOCKED',
        successionChainIntact: true,
        lastHeartbeatAt: '2026-05-10T12:00:00Z',
        observationWindowStart: '2026-05-10T00:00:00Z',
        vacancySignalPresent: false,
        contestedSignalPresent: false,
        emergencyActivated: false,
        operationalNote: null,
      }),
    ]);
    const score = computeStewardshipMaturityScore({
      boundary,
      replayRecords: [],
      successionChains: [],
    });
    expect(score.schema).toBe(STEWARDSHIP_SENTINELS.SCHEMA_MATURITY);
  });

  it('traceCaretakerLineage output carries SCHEMA_LINEAGE', () => {
    const lineage = traceCaretakerLineage({
      rootCaretakerId: 'c-root',
      rootHints: {},
      candidates: [],
    });
    expect(lineage.schema).toBe(STEWARDSHIP_SENTINELS.SCHEMA_LINEAGE);
  });
});

// ── Deterministic digest contract ─────────────────────────────────────────────

describe('CI gate — deterministic digests', () => {
  it('lockContinuity produces identical lockDigest for identical inputs', () => {
    const a = lockContinuity({ unitId: 'u-det', state: 'LOCKED', incumbent: makeCaretaker('c-det') });
    const b = lockContinuity({ unitId: 'u-det', state: 'LOCKED', incumbent: makeCaretaker('c-det') });
    expect(a.lockDigest).toBe(b.lockDigest);
  });

  it('lockContinuity produces different lockDigest for different unitIds', () => {
    const a = lockContinuity({ unitId: 'u-det-1', state: 'LOCKED', incumbent: makeCaretaker('c-det') });
    const b = lockContinuity({ unitId: 'u-det-2', state: 'LOCKED', incumbent: makeCaretaker('c-det') });
    expect(a.lockDigest).not.toBe(b.lockDigest);
  });

  it('verifyReplayStewardship produces identical replayDigest for identical inputs', () => {
    const sig = {
      capsuleId: 'cap-det',
      replayIssuedAt: '2026-05-10T10:00:00Z',
      assertedCaretaker: makeCaretaker('c-det'),
      lockStateAtReplay: 'LOCKED' as const,
      authoritySpansReplay: true,
      successionPathPresent: true,
      authorityContestedAtReplay: false,
    };
    const a = verifyReplayStewardship(sig);
    const b = verifyReplayStewardship(sig);
    expect(a.replayDigest).toBe(b.replayDigest);
  });

  it('traceCaretakerLineage produces identical reconstructionDigest for identical inputs', () => {
    const input = {
      rootCaretakerId: 'c-root',
      rootHints: { orgUnitId: 'org-a' },
      candidates: [{ caretakerId: 'c-peer', hints: { orgUnitId: 'org-a' } }],
    };
    const a = traceCaretakerLineage(input);
    const b = traceCaretakerLineage(input);
    expect(a.reconstructionDigest).toBe(b.reconstructionDigest);
  });
});

// ── Ambiguity preservation contract ──────────────────────────────────────────

describe('CI gate — ambiguity preservation (no silent collapse)', () => {
  it('CONTESTED lock is never classified as STABLE', () => {
    const record = classifyContinuityUnit({
      unitId: 'u-contested-class',
      lockState: 'CONTESTED',
      successionChainIntact: true,
      lastHeartbeatAt: '2026-05-10T12:00:00Z',
      observationWindowStart: '2026-05-10T00:00:00Z',
      vacancySignalPresent: false,
      contestedSignalPresent: true,
      emergencyActivated: false,
      operationalNote: null,
    });
    expect(record.verdict).not.toBe('STABLE');
    expect(['AMBIGUOUS_STEWARDSHIP', 'CONTINUITY_BREACH']).toContain(record.verdict);
  });

  it('AMBIGUOUS_SUCCESSION chain entry does not make chainIntact=true', () => {
    const chain = buildSuccessionChain({
      unitId: 'u-amb-chain',
      entries: [
        {
          entryId: 'e-1',
          predecessor: null,
          successor: makeCaretaker('c-1'),
          handoffDigest: 'hd1',
          handoffAt: '2026-05-01T00:00:00Z',
          verdict: 'AMBIGUOUS_SUCCESSION',
          frictionKind: 'HANDOFF_DIGEST_MISMATCH',
        },
      ],
    });
    expect(chain.chainIntact).toBe(false);
    expect(chain.ambiguousCount).toBeGreaterThan(0);
  });

  it('CARETAKER_EXPIRED replay verdict is never coerced to VERIFIED', () => {
    const record = verifyReplayStewardship({
      capsuleId: 'cap-expired',
      replayIssuedAt: '2026-05-10T10:00:00Z',
      assertedCaretaker: makeCaretaker('c-expired'),
      lockStateAtReplay: 'LOCKED',
      authoritySpansReplay: false,
      successionPathPresent: true,
      authorityContestedAtReplay: false,
    });
    expect(record.verdict).not.toBe('VERIFIED');
    expect(record.verdict).toBe('CARETAKER_EXPIRED');
  });
});

// ── Fail-closed floor contract ────────────────────────────────────────────────

describe('CI gate — fail-closed floor enforcement', () => {
  it('scoreContinuitySurvivability accepts 100% stable population', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      classifyContinuityUnit({
        unitId: `u-full-${i}`,
        lockState: 'LOCKED',
        successionChainIntact: true,
        lastHeartbeatAt: '2026-05-10T12:00:00Z',
        observationWindowStart: '2026-05-10T00:00:00Z',
        vacancySignalPresent: false,
        contestedSignalPresent: false,
        emergencyActivated: false,
        operationalNote: null,
      }),
    );

    const boundary = scoreContinuitySurvivability(records);
    expect(boundary.partitioned).toBe(true);
    expect(boundary.stablePct).toBe(100);
    expect(boundary.breachCount).toBe(0);
  });

  it('maturity score at 100% stable is STEWARDSHIP_FINALIZED', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      classifyContinuityUnit({
        unitId: `u-fin-${i}`,
        lockState: 'LOCKED',
        successionChainIntact: true,
        lastHeartbeatAt: '2026-05-10T12:00:00Z',
        observationWindowStart: '2026-05-10T00:00:00Z',
        vacancySignalPresent: false,
        contestedSignalPresent: false,
        emergencyActivated: false,
        operationalNote: null,
      }),
    );
    const boundary = scoreContinuitySurvivability(records);

    const replayRecords = Array.from({ length: 5 }, (_, i) =>
      verifyReplayStewardship({
        capsuleId: `cap-fin-${i}`,
        replayIssuedAt: '2026-05-10T10:00:00Z',
        assertedCaretaker: makeCaretaker(`c-fin-${i}`),
        lockStateAtReplay: 'LOCKED',
        authoritySpansReplay: true,
        successionPathPresent: true,
        authorityContestedAtReplay: false,
      }),
    );

    const chains = [
      buildSuccessionChain({
        unitId: 'u-chain-fin',
        entries: [
          {
            entryId: 'e-fin-1',
            predecessor: null,
            successor: makeCaretaker('c-fin-0'),
            handoffDigest: 'hd-fin',
            handoffAt: '2026-01-01T00:00:00Z',
            verdict: 'SUCCEEDED',
          },
        ],
      }),
    ];

    const score = computeStewardshipMaturityScore({ boundary, replayRecords, successionChains: chains });

    expect(score.verdict).toBe('STEWARDSHIP_FINALIZED');
    expect(score.stewardshipFinalizationMaturityPct).toBeGreaterThanOrEqual(90);
    expect(score.governanceContinuityPct).toBe(100);
    expect(score.replayStewardshipFidelityPct).toBe(100);
    expect(score.successionSurvivabilityPct).toBe(100);
    expect(score.institutionalStabilityPct).toBe(100);
  });
});
