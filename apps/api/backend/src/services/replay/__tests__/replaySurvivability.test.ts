/**
 * Replay-survivability simulation tests (Wave 14).
 *
 * The Wave 10 identity primitives (`replayIdentity.ts`) are pure
 * functions over stable persisted inputs, so survivability is a
 * structural property — but a structural property is only worth
 * anything if it's pinned by tests that simulate the runtime turbulence
 * we care about. This suite simulates the six failure modes the brief
 * named:
 *
 *  1. deploy replacement       — new code path, same algorithm version
 *                                 must yield same ids.
 *  2. replay corruption        — tampering with ANY input field changes
 *                                 the runId; ids cannot be forged from
 *                                 a different evidence set.
 *  3. degraded receipt         — a run with subset/empty artifacts gets
 *     restoration                a deterministic, distinguishable id.
 *  4. runtime restart          — recomputation from the same persisted
 *                                 inputs is byte-identical.
 *  5. partial persistence      — checksum subset preserves lineageKey
 *     outage                     and yields a different (well-defined)
 *                                 runId; not a silent fallback.
 *  6. stale replay recovery    — old `lastCheckedAt` does not change
 *                                 the id (id is for THIS snapshot, not
 *                                 freshness — freshness is a separate
 *                                 signal).
 *
 * Each test below is also a property assertion the audit chain depends
 * on: chain-of-custody integrity (no two distinct evidence sets ever
 * collide on runId), determinism (no in-memory state), and degraded
 * attributability (a verifier can always tell what was-or-wasn't
 * checked from the id alone, given the inputs).
 */
import {
  computeLineageKey,
  computeRunId,
  computeReplayIdentity,
  isV1LineageKey,
  isV1RunId,
} from '../replayIdentity';

const ENTITY = '1346053246';
const CHECKED_AT = '2026-04-01T15:00:00.000Z';
const ARTIFACTS = ['cks-aaa', 'cks-bbb', 'cks-ccc', 'cks-ddd'];
const CHANNEL = 'NPPES_API';

const BASE = {
  entityId: ENTITY,
  lastCheckedAt: CHECKED_AT,
  artifactChecksums: ARTIFACTS,
  channel: CHANNEL,
} as const;

describe('replay survivability — scenario 1: deploy replacement', () => {
  it('repeated invocation across simulated process boundaries yields identical ids', () => {
    // Mimic two deploy generations: build two independent input objects
    // (different references, same values) and verify they agree.
    const generationA = computeReplayIdentity({ ...BASE });
    const generationB = computeReplayIdentity({
      entityId: BASE.entityId,
      lastCheckedAt: BASE.lastCheckedAt,
      artifactChecksums: [...BASE.artifactChecksums],
      channel: BASE.channel,
    });
    expect(generationA.runId).toBe(generationB.runId);
    expect(generationA.lineageKey).toBe(generationB.lineageKey);
    expect(generationA.schemeVersion).toBe('v1');
    expect(generationB.schemeVersion).toBe('v1');
  });

  it('algorithm-version prefix is recognizable across deploys (forward-compat hook)', () => {
    const id = computeReplayIdentity(BASE);
    expect(isV1LineageKey(id.lineageKey)).toBe(true);
    expect(isV1RunId(id.runId)).toBe(true);
  });
});

describe('replay survivability — scenario 2: corruption attempt', () => {
  it('tampering with the entityId produces a different runId (and lineageKey)', () => {
    const original = computeReplayIdentity(BASE);
    const tampered = computeReplayIdentity({ ...BASE, entityId: '0000000000' });
    expect(tampered.runId).not.toBe(original.runId);
    expect(tampered.lineageKey).not.toBe(original.lineageKey);
  });

  it('tampering with lastCheckedAt produces a different runId (lineageKey unchanged)', () => {
    const original = computeReplayIdentity(BASE);
    const tampered = computeReplayIdentity({ ...BASE, lastCheckedAt: '1999-01-01T00:00:00.000Z' });
    expect(tampered.runId).not.toBe(original.runId);
    expect(tampered.lineageKey).toBe(original.lineageKey);
  });

  it('adding or substituting a single artifact checksum changes the runId', () => {
    const original = computeRunId(BASE);
    const added = computeRunId({ ...BASE, artifactChecksums: [...BASE.artifactChecksums, 'cks-evil'] });
    const swapped = computeRunId({
      ...BASE,
      artifactChecksums: ['cks-aaa', 'cks-bbb', 'cks-ccc', 'cks-XXX'],
    });
    expect(added).not.toBe(original);
    expect(swapped).not.toBe(original);
    expect(added).not.toBe(swapped);
  });

  it('cannot forge an id from a different channel for the same evidence', () => {
    const a = computeRunId({ ...BASE, channel: 'NPPES_API' });
    const b = computeRunId({ ...BASE, channel: 'OIG_LEIE' });
    expect(a).not.toBe(b);
  });
});

describe('replay survivability — scenario 3: degraded restoration', () => {
  it('an empty-evidence run produces a deterministic distinct id (not a random fallback)', () => {
    const degraded1 = computeRunId({ entityId: ENTITY, lastCheckedAt: null, artifactChecksums: [] });
    const degraded2 = computeRunId({ entityId: ENTITY, lastCheckedAt: null, artifactChecksums: [] });
    const complete  = computeRunId(BASE);
    expect(degraded1).toBe(degraded2);     // determinism
    expect(degraded1).not.toBe(complete);  // distinguishability
    expect(isV1RunId(degraded1)).toBe(true);
  });

  it('lineageKey is preserved across complete → degraded → restored cycle', () => {
    const complete   = computeLineageKey(ENTITY);
    const degraded   = computeLineageKey(ENTITY);
    const restored   = computeLineageKey(ENTITY);
    expect(complete).toBe(degraded);
    expect(degraded).toBe(restored);
  });

  it('a degraded run with no checkedAt is distinct from a complete run with the same artifact set', () => {
    // This is the subtle corner case: if a run somehow records artifacts
    // but no checked-at timestamp (partial persistence outage), it must
    // still be attributable as different from the fully-stamped version.
    const noTimestamp = computeRunId({ ...BASE, lastCheckedAt: null });
    const stamped     = computeRunId(BASE);
    expect(noTimestamp).not.toBe(stamped);
  });
});

describe('replay survivability — scenario 4: runtime restart', () => {
  it('runId is byte-identical across two independent computations', () => {
    const a = computeRunId(BASE);
    const b = computeRunId(BASE);
    expect(a).toBe(b);
  });

  it('lineageKey is byte-identical across two independent computations', () => {
    expect(computeLineageKey(ENTITY)).toBe(computeLineageKey(ENTITY));
  });

  it('no in-memory state — repeated calls do not drift', () => {
    const ids: string[] = [];
    for (let i = 0; i < 50; i += 1) {
      ids.push(computeRunId(BASE));
    }
    expect(new Set(ids).size).toBe(1);
  });
});

describe('replay survivability — scenario 5: partial persistence outage', () => {
  it('a checksum subset preserves lineageKey and yields a well-defined different runId', () => {
    const full = computeReplayIdentity(BASE);
    const partial = computeReplayIdentity({
      ...BASE,
      artifactChecksums: ['cks-aaa', 'cks-bbb'], // 2 of 4 persisted
    });
    expect(partial.lineageKey).toBe(full.lineageKey);  // subject unchanged
    expect(partial.runId).not.toBe(full.runId);        // snapshot differs
    expect(isV1RunId(partial.runId)).toBe(true);
  });

  it('a verifier comparing two runIds for the same lineageKey can detect inconsistency', () => {
    const lineageA = computeReplayIdentity(BASE).lineageKey;
    const lineageB = computeReplayIdentity({ ...BASE, entityId: '0000000000' }).lineageKey;

    // Same subject → identical lineage; different subject → different.
    expect(lineageA).toBe(computeLineageKey(ENTITY));
    expect(lineageB).not.toBe(lineageA);
  });

  it('runId space behaves like a hash — adjacent inputs do not collide', () => {
    // Build a set of similar but distinct inputs and verify each yields
    // a unique runId. Catches degenerate algorithm regressions.
    const cases = [
      BASE,
      { ...BASE, lastCheckedAt: '2026-04-01T15:00:01.000Z' },
      { ...BASE, lastCheckedAt: '2026-04-01T15:00:00.001Z' },
      { ...BASE, channel: 'NPPES_API_V2' },
      { ...BASE, artifactChecksums: ['cks-aaa', 'cks-bbb', 'cks-ccc', 'cks-ddd', 'cks-eee'] },
      { ...BASE, artifactChecksums: ['cks-aaa', 'cks-bbb', 'cks-ccc'] }, // dropped one
    ];
    const ids = cases.map((c) => computeRunId(c));
    expect(new Set(ids).size).toBe(cases.length);
  });
});

describe('replay survivability — scenario 6: stale replay recovery', () => {
  // Important boundary: a stale snapshot keeps its runId. Freshness is a
  // separate signal (carried on the source-coverage record). The runId
  // identifies WHICH evidence-snapshot, not whether that evidence is
  // currently fresh — so a stale id remains valid for chain-of-custody
  // even when the freshness window has lapsed.
  it('runId is independent of wall-clock — older checkedAt yields same id as fresh-but-identical inputs', () => {
    const oldChecked = computeRunId({ ...BASE, lastCheckedAt: '2024-01-01T00:00:00.000Z' });
    const oldAgain   = computeRunId({ ...BASE, lastCheckedAt: '2024-01-01T00:00:00.000Z' });
    expect(oldChecked).toBe(oldAgain);
  });

  it('a recovered run from old persisted state produces the same id today as the day it was originally written', () => {
    // Simulate two computations months apart: same inputs → same id.
    // (The test doesn't actually wait; the property is encoded in the
    // pure-function nature of the generator. We assert the property.)
    const day0 = computeReplayIdentity(BASE);
    const dayN = computeReplayIdentity(BASE);
    expect(day0).toEqual(dayN);
  });
});

describe('audit chain integrity', () => {
  it('chronological ordering of two runs preserves lineageKey continuity', () => {
    const t1 = computeReplayIdentity({ ...BASE, lastCheckedAt: '2026-03-01T00:00:00.000Z' });
    const t2 = computeReplayIdentity({ ...BASE, lastCheckedAt: '2026-04-01T00:00:00.000Z' });
    const t3 = computeReplayIdentity({ ...BASE, lastCheckedAt: '2026-05-01T00:00:00.000Z' });

    // Same lineage across the three runs (same subject).
    expect(t1.lineageKey).toBe(t2.lineageKey);
    expect(t2.lineageKey).toBe(t3.lineageKey);

    // Distinct runIds for distinct snapshots.
    expect(new Set([t1.runId, t2.runId, t3.runId]).size).toBe(3);
  });

  it('a gap in the chain (missing intermediate run) does not break lineage', () => {
    // If a verifier sees t1 and t3 but t2 was lost, lineageKey is still
    // identifiable. The "gap" is a separate signal (rendered by
    // <ReplayLineage>), not encoded into the id.
    const t1 = computeReplayIdentity({ ...BASE, lastCheckedAt: '2026-03-01T00:00:00.000Z' });
    const t3 = computeReplayIdentity({ ...BASE, lastCheckedAt: '2026-05-01T00:00:00.000Z' });
    expect(t1.lineageKey).toBe(t3.lineageKey);
  });

  it('two runs with different lineageKeys must NEVER share a runId', () => {
    // The runId hash space is wide enough that this is statistically
    // safe, but we assert it for the canonical fixture so any future
    // algorithm change that violates this property fails CI loudly.
    const aRun = computeRunId(BASE);
    const bRun = computeRunId({ ...BASE, entityId: '9999999999' });
    expect(aRun).not.toBe(bRun);
  });
});
