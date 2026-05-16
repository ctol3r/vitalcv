/**
 * Replay Corruption Containment — CI Gate (W2-PR64A)
 *
 * Canary suite. Every public primitive must:
 *   - throw ReplayContainmentError on boundary breaches (not silently allow);
 *   - export an enumerated `violation` field;
 *   - never coerce AMBIGUOUS verdicts to CLEAN (the silent-collapse anti-pattern);
 *   - produce a deterministic, salted containmentDigest (not collide across inputs);
 *
 * If a future refactor accidentally weakens any of these invariants, this
 * suite breaks the build before the regression ships.
 */

import {
  CONTAINMENT_SENTINELS,
  KNOWN_CONTAINMENT_VERDICTS,
  KNOWN_CONTAINMENT_VIOLATIONS,
  KNOWN_CORRUPTION_KINDS,
  ReplayContainmentError,
  assertAmbiguityPreserved,
  assertContainmentBoundary,
  computeContainmentBoundary,
  containmentDigest,
  quarantineReplay,
  traceCorruptionLineage,
  type ContainmentVerdict,
  type CorruptionKind,
  type IntegritySignal,
} from '../replayCorruptionContainment';

const KNOWN_VIOLATIONS = [
  'AMBIGUOUS_QUARANTINE_FORCED_CLEAN',
  'BOUNDARY_BREACH',
  'PARTIAL_SURVIVABILITY_FLOOR_BREACHED',
  'QUARANTINE_OPEN_FAILURE',
] as const;

const KNOWN_VERDICTS: ContainmentVerdict[] = [
  'CLEAN',
  'QUARANTINED',
  'AMBIGUOUS',
  'CONTAMINATED',
  'CONTAINMENT_BREACH',
];

const KNOWN_KINDS: CorruptionKind[] = [
  'HASH_MISMATCH',
  'EVIDENCE_SPINE_DRIFT',
  'METADATA_CORRUPTION',
  'STRUCTURAL_CORRUPTION',
  'DEPENDENCY_CORRUPTION',
  'AMBIGUOUS_INTEGRITY',
];

describe('CI gate — exported enums match runtime sentinels', () => {
  it('every exported verdict is in the runtime KNOWN_CONTAINMENT_VERDICTS list', () => {
    for (const v of KNOWN_VERDICTS) {
      expect(KNOWN_CONTAINMENT_VERDICTS).toContain(v);
    }
    expect(KNOWN_CONTAINMENT_VERDICTS).toHaveLength(KNOWN_VERDICTS.length);
  });

  it('every exported kind is in the runtime KNOWN_CORRUPTION_KINDS list', () => {
    for (const k of KNOWN_KINDS) {
      expect(KNOWN_CORRUPTION_KINDS).toContain(k);
    }
    expect(KNOWN_CORRUPTION_KINDS).toHaveLength(KNOWN_KINDS.length);
  });

  it('every exported violation is in the runtime KNOWN_CONTAINMENT_VIOLATIONS list', () => {
    for (const v of KNOWN_VIOLATIONS) {
      expect(KNOWN_CONTAINMENT_VIOLATIONS).toContain(v);
    }
    expect(KNOWN_CONTAINMENT_VIOLATIONS).toHaveLength(KNOWN_VIOLATIONS.length);
  });

  it('verdict / kind / violation enums are frozen', () => {
    expect(Object.isFrozen(KNOWN_CONTAINMENT_VERDICTS)).toBe(true);
    expect(Object.isFrozen(KNOWN_CORRUPTION_KINDS)).toBe(true);
    expect(Object.isFrozen(KNOWN_CONTAINMENT_VIOLATIONS)).toBe(true);
    expect(Object.isFrozen(CONTAINMENT_SENTINELS)).toBe(true);
  });
});

describe('CI gate — ReplayContainmentError contract', () => {
  it('every breach primitive throws a ReplayContainmentError with a known violation', () => {
    const cases: Array<{ name: string; run: () => void; expected: string }> = [
      {
        name: 'assertAmbiguityPreserved discards ambiguity',
        expected: 'AMBIGUOUS_QUARANTINE_FORCED_CLEAN',
        run: () => assertAmbiguityPreserved({
          schema: 'vitalcv.replay-corruption-containment.v1',
          capsuleId: 'cap-x',
          verdict: 'CLEAN',
          kind: 'HASH_MISMATCH',  // contradiction
          ambiguous: false,
          reason: 'forced',
          containmentDigest: '0'.repeat(64),
          isolatedAt: '2026-05-09T00:00:00.000Z',
          lineageHints: { subjectNpi: null, credentialIds: [], sourceReferenceId: null },
        }),
      },
      {
        name: 'assertContainmentBoundary partial survivability floor breach',
        expected: 'PARTIAL_SURVIVABILITY_FLOOR_BREACHED',
        run: () => {
          const boundary = computeContainmentBoundary({
            totalReplayed: 10,
            quarantines: [
              quarantineReplay({
                capsuleId: 'only-survivor',
                integrity: cleanIntegrity(),
              }),
            ],
          });
          assertContainmentBoundary(boundary);
        },
      },
    ];

    for (const c of cases) {
      let caught: unknown = null;
      try { c.run(); } catch (e) { caught = e; }
      expect(caught).toBeInstanceOf(ReplayContainmentError);
      const err = caught as ReplayContainmentError;
      expect(err.code).toBe('REPLAY_CONTAINMENT_VIOLATION');
      expect(KNOWN_VIOLATIONS).toContain(err.violation);
      expect(err.violation).toBe(c.expected);
    }
  });
});

describe('CI gate — containmentDigest is deterministic and unique', () => {
  it('produces unique digests for distinct (capsuleId, verdict, kind, integrity) tuples', () => {
    const inputs = [
      { capsuleId: 'cap-1', verdict: 'CLEAN' as const,        kind: null,                            integrity: cleanIntegrity() },
      { capsuleId: 'cap-1', verdict: 'QUARANTINED' as const,  kind: 'HASH_MISMATCH' as const,        integrity: tamperedIntegrity() },
      { capsuleId: 'cap-2', verdict: 'CLEAN' as const,        kind: null,                            integrity: cleanIntegrity() },
      { capsuleId: 'cap-1', verdict: 'AMBIGUOUS' as const,    kind: 'AMBIGUOUS_INTEGRITY' as const,  integrity: cleanIntegrity() },
      { capsuleId: 'cap-1', verdict: 'CONTAMINATED' as const, kind: 'DEPENDENCY_CORRUPTION' as const, integrity: cleanIntegrity() },
    ];
    const digests = inputs.map(containmentDigest);
    expect(new Set(digests).size).toBe(inputs.length);

    // Reproducibility — same input twice yields same digest.
    expect(containmentDigest(inputs[0])).toBe(digests[0]);
  });
});

describe('CI gate — quarantine record never silently collapses', () => {
  it('an AMBIGUOUS-input quarantine round-trip preserves verdict=AMBIGUOUS', () => {
    const q = quarantineReplay({
      capsuleId: 'cap-1',
      integrity: {
        hashMatch: true,
        storedHash: 'a'.repeat(64),
        recomputedHash: 'a'.repeat(64),
        tamperEvidence: 'unexpected tamper note',
      },
    });
    expect(q.verdict).toBe('AMBIGUOUS');
    expect(q.ambiguous).toBe(true);
    expect(() => assertAmbiguityPreserved(q)).not.toThrow();
  });

  it('a clean quarantine round-trip never carries a non-null kind', () => {
    const q = quarantineReplay({ capsuleId: 'cap-1', integrity: cleanIntegrity() });
    expect(q.verdict).toBe('CLEAN');
    expect(q.kind).toBeNull();
  });
});

describe('CI gate — lineage reconstruction is order-independent and deterministic', () => {
  it('reconstructionDigest matches across reorderings of the same candidate set', () => {
    const a = traceCorruptionLineage({
      rootCapsuleId: 'root-1',
      rootHints: { subjectNpi: '1234567890', credentialIds: ['art-1'], sourceReferenceId: null },
      candidates: [
        { capsuleId: 'cand-A', hints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null } },
        { capsuleId: 'cand-B', hints: { subjectNpi: null, credentialIds: ['art-1'], sourceReferenceId: null } },
      ],
    });
    const b = traceCorruptionLineage({
      rootCapsuleId: 'root-1',
      rootHints: { subjectNpi: '1234567890', credentialIds: ['art-1'], sourceReferenceId: null },
      candidates: [
        { capsuleId: 'cand-B', hints: { subjectNpi: null, credentialIds: ['art-1'], sourceReferenceId: null } },
        { capsuleId: 'cand-A', hints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null } },
      ],
    });
    expect(a.reconstructionDigest).toBe(b.reconstructionDigest);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanIntegrity(): IntegritySignal {
  return {
    hashMatch: true,
    storedHash: 'a'.repeat(64),
    recomputedHash: 'a'.repeat(64),
    tamperEvidence: null,
  };
}

function tamperedIntegrity(): IntegritySignal {
  return {
    hashMatch: false,
    storedHash: 'a'.repeat(64),
    recomputedHash: 'b'.repeat(64),
    tamperEvidence: 'Hash mismatch — stored: aaaa… computed: bbbb…',
  };
}
