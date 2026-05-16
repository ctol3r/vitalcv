/**
 * replayCorruptionContainment — unit tests (W2-PR64A)
 *
 * Pure-transform module — no mocks needed. Verifies:
 *   - classifier table is exhaustive (CLEAN / AMBIGUOUS / HASH_MISMATCH /
 *     EVIDENCE_SPINE_DRIFT / STRUCTURAL_CORRUPTION)
 *   - quarantineReplay never coerces ambiguity to clean
 *   - containment digests are deterministic and unique per (verdict, kind, integrity)
 *   - boundary computation tracks survivability + flips partitioned correctly
 *   - lineage tracing emits one edge per shared hint reason
 */

import {
  CONTAINMENT_SENTINELS,
  KNOWN_CONTAINMENT_VERDICTS,
  KNOWN_CORRUPTION_KINDS,
  ReplayContainmentError,
  assertAmbiguityPreserved,
  assertContainmentBoundary,
  classifyIntegrity,
  computeContainmentBoundary,
  containmentDigest,
  evaluateContainment,
  quarantineReplay,
  traceCorruptionLineage,
  type IntegritySignal,
  type ReplayQuarantineRecord,
} from '../replayCorruptionContainment';

const cleanIntegrity = (): IntegritySignal => ({
  hashMatch: true,
  storedHash: 'a'.repeat(64),
  recomputedHash: 'a'.repeat(64),
  tamperEvidence: null,
});

const tamperedIntegrity = (): IntegritySignal => ({
  hashMatch: false,
  storedHash: 'a'.repeat(64),
  recomputedHash: 'b'.repeat(64),
  tamperEvidence: 'Hash mismatch — stored: aaaa… computed: bbbb…',
});

const spineDriftIntegrity = (): IntegritySignal => ({
  hashMatch: false,
  storedHash: 'a'.repeat(64),
  recomputedHash: 'a'.repeat(64),
  tamperEvidence: 'Evidence spine digest mismatch — referenced verification artifacts no longer replay to the stored trust-critical spine.',
  evidenceSpineExpected: 'spine-expected',
  evidenceSpineActual: 'spine-actual',
});

describe('classifyIntegrity', () => {
  it('returns null kind on clean integrity', () => {
    const r = classifyIntegrity(cleanIntegrity());
    expect(r.kind).toBeNull();
    expect(r.ambiguous).toBe(false);
  });

  it('flags AMBIGUOUS_INTEGRITY when hashMatch=true but tamperEvidence is set', () => {
    const r = classifyIntegrity({
      hashMatch: true,
      storedHash: 'a'.repeat(64),
      recomputedHash: 'a'.repeat(64),
      tamperEvidence: 'spurious tamper note',
    });
    expect(r.kind).toBe('AMBIGUOUS_INTEGRITY');
    expect(r.ambiguous).toBe(true);
  });

  it('flags AMBIGUOUS_INTEGRITY when hashMatch=false but tamperEvidence is null', () => {
    const r = classifyIntegrity({
      hashMatch: false,
      storedHash: 'a'.repeat(64),
      recomputedHash: 'b'.repeat(64),
      tamperEvidence: null,
    });
    expect(r.kind).toBe('AMBIGUOUS_INTEGRITY');
    expect(r.ambiguous).toBe(true);
  });

  it('classifies HASH_MISMATCH when artifact hashes differ', () => {
    const r = classifyIntegrity(tamperedIntegrity());
    expect(r.kind).toBe('HASH_MISMATCH');
    expect(r.ambiguous).toBe(false);
  });

  it('classifies EVIDENCE_SPINE_DRIFT when only the spine digest differs', () => {
    const r = classifyIntegrity(spineDriftIntegrity());
    expect(r.kind).toBe('EVIDENCE_SPINE_DRIFT');
    expect(r.ambiguous).toBe(false);
  });

  it('classifies STRUCTURAL_CORRUPTION when no specific signal is present but valid=false', () => {
    const r = classifyIntegrity({
      hashMatch: false,
      storedHash: 'a'.repeat(64),
      recomputedHash: 'a'.repeat(64),
      tamperEvidence: 'Decision capsule replay validation failed.',
    });
    expect(r.kind).toBe('STRUCTURAL_CORRUPTION');
    expect(r.ambiguous).toBe(false);
  });
});

describe('quarantineReplay', () => {
  it('returns CLEAN verdict with null kind on clean integrity', () => {
    const q = quarantineReplay({
      capsuleId: 'cap-1',
      integrity: cleanIntegrity(),
    });
    expect(q.verdict).toBe('CLEAN');
    expect(q.kind).toBeNull();
    expect(q.ambiguous).toBe(false);
    expect(q.containmentDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns QUARANTINED verdict with concrete kind on hash mismatch', () => {
    const q = quarantineReplay({
      capsuleId: 'cap-1',
      integrity: tamperedIntegrity(),
    });
    expect(q.verdict).toBe('QUARANTINED');
    expect(q.kind).toBe('HASH_MISMATCH');
    expect(q.ambiguous).toBe(false);
  });

  it('returns AMBIGUOUS verdict — never coerces ambiguity to CLEAN', () => {
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
    expect(q.kind).toBe('AMBIGUOUS_INTEGRITY');
    expect(q.ambiguous).toBe(true);
  });

  it('forcedKind=DEPENDENCY_CORRUPTION marks CONTAMINATED via lineage', () => {
    const q = quarantineReplay({
      capsuleId: 'cap-child',
      integrity: cleanIntegrity(),
      forcedKind: 'DEPENDENCY_CORRUPTION',
      lineageHints: { subjectNpi: '1234567890', credentialIds: ['art-1'], sourceReferenceId: null },
    });
    expect(q.verdict).toBe('CONTAMINATED');
    expect(q.kind).toBe('DEPENDENCY_CORRUPTION');
  });

  it('normalizes lineage hints — drops empty-string entries, dedupes credentialIds, sorts', () => {
    const q = quarantineReplay({
      capsuleId: 'cap-1',
      integrity: cleanIntegrity(),
      lineageHints: {
        subjectNpi: '   ',
        credentialIds: ['b', 'a', 'b', '', '  '],
        sourceReferenceId: '',
      },
    });
    expect(q.lineageHints.subjectNpi).toBeNull();
    expect(q.lineageHints.credentialIds).toEqual(['a', 'b']);
    expect(q.lineageHints.sourceReferenceId).toBeNull();
  });
});

describe('containmentDigest', () => {
  it('produces unique digests per (verdict, kind, integrity) tuple', () => {
    const inputs = [
      { capsuleId: 'cap-1', verdict: 'CLEAN' as const,        kind: null,            integrity: cleanIntegrity() },
      { capsuleId: 'cap-1', verdict: 'QUARANTINED' as const,  kind: 'HASH_MISMATCH' as const, integrity: tamperedIntegrity() },
      { capsuleId: 'cap-1', verdict: 'AMBIGUOUS' as const,    kind: 'AMBIGUOUS_INTEGRITY' as const, integrity: cleanIntegrity() },
      { capsuleId: 'cap-2', verdict: 'CLEAN' as const,        kind: null,            integrity: cleanIntegrity() },
    ];
    const digests = inputs.map(containmentDigest);
    expect(new Set(digests).size).toBe(inputs.length);
  });

  it('is deterministic — same input twice yields same digest', () => {
    const a = containmentDigest({ capsuleId: 'cap-1', verdict: 'CLEAN', kind: null, integrity: cleanIntegrity() });
    const b = containmentDigest({ capsuleId: 'cap-1', verdict: 'CLEAN', kind: null, integrity: cleanIntegrity() });
    expect(a).toBe(b);
  });
});

describe('evaluateContainment', () => {
  it('matches quarantineReplay output on normal inputs', () => {
    const evaluated = evaluateContainment({
      capsuleId: 'cap-1',
      integrity: tamperedIntegrity(),
    });
    const built = quarantineReplay({
      capsuleId: 'cap-1',
      integrity: tamperedIntegrity(),
    });
    expect(evaluated.verdict).toBe(built.verdict);
    expect(evaluated.kind).toBe(built.kind);
    expect(evaluated.containmentDigest).toBe(built.containmentDigest);
  });
});

describe('computeContainmentBoundary', () => {
  function record(
    capsuleId: string,
    verdict: ReplayQuarantineRecord['verdict'],
    kind: ReplayQuarantineRecord['kind'],
  ): ReplayQuarantineRecord {
    const integrity = verdict === 'CLEAN' ? cleanIntegrity() : tamperedIntegrity();
    return quarantineReplay({
      capsuleId,
      integrity: kind === 'AMBIGUOUS_INTEGRITY'
        ? { ...cleanIntegrity(), tamperEvidence: 'forced ambiguity' }
        : integrity,
      forcedKind: verdict === 'CONTAMINATED' ? 'DEPENDENCY_CORRUPTION' : undefined,
    });
  }

  it('reports 100% partial survivability when every replay is clean', () => {
    const records = ['a', 'b', 'c'].map(id => record(id, 'CLEAN', null));
    const b = computeContainmentBoundary({ totalReplayed: 3, quarantines: records });
    expect(b.cleanCount).toBe(3);
    expect(b.partialSurvivabilityPct).toBe(100);
    expect(b.partitioned).toBe(true);
    expect(b.boundaryDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('flags partitioned=false when partialSurvivabilityPct floor is breached', () => {
    // 3 replays in input, but only 1 surfaced as a quarantine record — 2 silently
    // dropped. partialSurvivabilityPct = 1/3 ≈ 33.33% < 50% floor.
    const b = computeContainmentBoundary({
      totalReplayed: 3,
      quarantines: [record('a', 'CLEAN', null)],
    });
    expect(b.partialSurvivabilityPct).toBeCloseTo(33.33, 1);
    expect(b.partitioned).toBe(false);
  });

  it('counts QUARANTINED + AMBIGUOUS toward partial survivability', () => {
    const records = [
      record('cap-1', 'CLEAN', null),
      record('cap-2', 'QUARANTINED', 'HASH_MISMATCH'),
      record('cap-3', 'AMBIGUOUS', 'AMBIGUOUS_INTEGRITY'),
    ];
    const b = computeContainmentBoundary({ totalReplayed: 3, quarantines: records });
    expect(b.cleanCount).toBe(1);
    expect(b.quarantinedCount).toBe(1);
    expect(b.ambiguousCount).toBe(1);
    expect(b.partialSurvivabilityPct).toBe(100);
    expect(b.partitioned).toBe(true);
  });

  it('records CONTAMINATED entries separately from QUARANTINED', () => {
    const records = [
      record('cap-1', 'CLEAN', null),
      record('cap-2', 'QUARANTINED', 'HASH_MISMATCH'),
      record('cap-3', 'CONTAMINATED', 'DEPENDENCY_CORRUPTION'),
    ];
    const b = computeContainmentBoundary({ totalReplayed: 3, quarantines: records });
    expect(b.contaminatedCount).toBe(1);
    expect(b.containmentRatio).toBeCloseTo(1 / 3, 5);
  });

  it('boundary digest is deterministic regardless of quarantine input order', () => {
    const a = record('a', 'CLEAN', null);
    const b = record('b', 'QUARANTINED', 'HASH_MISMATCH');
    const c = record('c', 'CLEAN', null);
    const ordered = computeContainmentBoundary({ totalReplayed: 3, quarantines: [a, b, c] });
    const reordered = computeContainmentBoundary({ totalReplayed: 3, quarantines: [c, b, a] });
    expect(ordered.boundaryDigest).toBe(reordered.boundaryDigest);
  });
});

describe('assertContainmentBoundary', () => {
  it('does not throw when boundary is partitioned', () => {
    const b = computeContainmentBoundary({
      totalReplayed: 1,
      quarantines: [quarantineReplay({ capsuleId: 'cap-1', integrity: cleanIntegrity() })],
    });
    expect(() => assertContainmentBoundary(b)).not.toThrow();
  });

  it('throws PARTIAL_SURVIVABILITY_FLOOR_BREACHED when survivability is below floor', () => {
    const b = computeContainmentBoundary({
      totalReplayed: 10,
      quarantines: [quarantineReplay({ capsuleId: 'cap-1', integrity: cleanIntegrity() })],
    });
    expect(() => assertContainmentBoundary(b))
      .toThrow(ReplayContainmentError);
    try { assertContainmentBoundary(b); }
    catch (e) {
      expect((e as ReplayContainmentError).violation).toBe('PARTIAL_SURVIVABILITY_FLOOR_BREACHED');
    }
  });
});

describe('assertAmbiguityPreserved (regression guard)', () => {
  it('throws if a record is flagged ambiguous but verdict is not AMBIGUOUS', () => {
    const malformed: ReplayQuarantineRecord = {
      schema: 'vitalcv.replay-corruption-containment.v1',
      capsuleId: 'cap-1',
      verdict: 'CLEAN',
      kind: null,
      ambiguous: true, // contradiction
      reason: 'forced',
      containmentDigest: 'x'.repeat(64),
      isolatedAt: '2026-05-09T00:00:00.000Z',
      lineageHints: { subjectNpi: null, credentialIds: [], sourceReferenceId: null },
    };
    expect(() => assertAmbiguityPreserved(malformed)).toThrow(ReplayContainmentError);
    try { assertAmbiguityPreserved(malformed); }
    catch (e) {
      expect((e as ReplayContainmentError).violation).toBe('AMBIGUOUS_QUARANTINE_FORCED_CLEAN');
    }
  });

  it('throws if verdict=CLEAN but kind is non-null', () => {
    const malformed: ReplayQuarantineRecord = {
      schema: 'vitalcv.replay-corruption-containment.v1',
      capsuleId: 'cap-1',
      verdict: 'CLEAN',
      kind: 'HASH_MISMATCH',
      ambiguous: false,
      reason: 'forced',
      containmentDigest: 'x'.repeat(64),
      isolatedAt: '2026-05-09T00:00:00.000Z',
      lineageHints: { subjectNpi: null, credentialIds: [], sourceReferenceId: null },
    };
    expect(() => assertAmbiguityPreserved(malformed)).toThrow(ReplayContainmentError);
  });

  it('does not throw on a well-formed clean record', () => {
    const clean = quarantineReplay({ capsuleId: 'cap-1', integrity: cleanIntegrity() });
    expect(() => assertAmbiguityPreserved(clean)).not.toThrow();
  });
});

describe('traceCorruptionLineage', () => {
  it('emits SHARED_SUBJECT edges to peers with the same NPI', () => {
    const lin = traceCorruptionLineage({
      rootCapsuleId: 'root-1',
      rootHints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null },
      candidates: [
        { capsuleId: 'cand-A', hints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null } },
        { capsuleId: 'cand-B', hints: { subjectNpi: 'other', credentialIds: [], sourceReferenceId: null } },
      ],
    });
    expect(lin.contaminatedCapsuleIds).toEqual(['cand-A']);
    expect(lin.edges).toEqual([
      { fromCapsuleId: 'root-1', toCapsuleId: 'cand-A', reason: 'SHARED_SUBJECT' },
    ]);
    expect(lin.reconstructionDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('emits one SHARED_CREDENTIAL edge when credentialIds overlap', () => {
    const lin = traceCorruptionLineage({
      rootCapsuleId: 'root-1',
      rootHints: { subjectNpi: null, credentialIds: ['art-1', 'art-2'], sourceReferenceId: null },
      candidates: [
        { capsuleId: 'cand-A', hints: { subjectNpi: null, credentialIds: ['art-2', 'art-3'], sourceReferenceId: null } },
        { capsuleId: 'cand-B', hints: { subjectNpi: null, credentialIds: ['art-9'], sourceReferenceId: null } },
      ],
    });
    expect(lin.contaminatedCapsuleIds).toEqual(['cand-A']);
    expect(lin.edges.find(e => e.toCapsuleId === 'cand-A')?.reason).toBe('SHARED_CREDENTIAL');
  });

  it('emits multiple edges per candidate when several hints overlap', () => {
    const lin = traceCorruptionLineage({
      rootCapsuleId: 'root-1',
      rootHints: { subjectNpi: '1234567890', credentialIds: ['art-1'], sourceReferenceId: 'ref-X' },
      candidates: [
        { capsuleId: 'cand-A', hints: { subjectNpi: '1234567890', credentialIds: ['art-1'], sourceReferenceId: 'ref-X' } },
      ],
    });
    expect(lin.contaminatedCapsuleIds).toEqual(['cand-A']);
    expect(lin.edges).toHaveLength(3);
    const reasons = lin.edges.map(e => e.reason).sort();
    expect(reasons).toEqual(['SHARED_CREDENTIAL', 'SHARED_SOURCE_REFERENCE', 'SHARED_SUBJECT']);
  });

  it('skips the root capsule itself even if hints would match', () => {
    const lin = traceCorruptionLineage({
      rootCapsuleId: 'root-1',
      rootHints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null },
      candidates: [
        { capsuleId: 'root-1', hints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null } },
        { capsuleId: 'cand-A', hints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null } },
      ],
    });
    expect(lin.contaminatedCapsuleIds).toEqual(['cand-A']);
  });

  it('reconstructionDigest is order-independent', () => {
    const a = traceCorruptionLineage({
      rootCapsuleId: 'root-1',
      rootHints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null },
      candidates: [
        { capsuleId: 'cand-A', hints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null } },
        { capsuleId: 'cand-B', hints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null } },
      ],
    });
    const b = traceCorruptionLineage({
      rootCapsuleId: 'root-1',
      rootHints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null },
      candidates: [
        { capsuleId: 'cand-B', hints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null } },
        { capsuleId: 'cand-A', hints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null } },
      ],
    });
    expect(a.reconstructionDigest).toBe(b.reconstructionDigest);
  });
});

describe('exported sentinels', () => {
  it('verdict + kind enums are frozen and complete', () => {
    expect(Object.isFrozen(KNOWN_CONTAINMENT_VERDICTS)).toBe(true);
    expect(Object.isFrozen(KNOWN_CORRUPTION_KINDS)).toBe(true);
    expect(KNOWN_CONTAINMENT_VERDICTS).toContain('CONTAINMENT_BREACH');
    expect(KNOWN_CORRUPTION_KINDS).toContain('AMBIGUOUS_INTEGRITY');
    expect(CONTAINMENT_SENTINELS.DEFAULT_MIN_PARTIAL_SURVIVABILITY_PCT).toBe(50);
  });
});
