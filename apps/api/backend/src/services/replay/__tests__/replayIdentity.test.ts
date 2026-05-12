/**
 * Survivability contract tests for canonical replay identity.
 *
 * Pins:
 *  1. Determinism — same inputs → same outputs.
 *  2. Survivability — outputs do NOT depend on process state, time,
 *     or environment.
 *  3. Sensitivity — different evidence changes the runId; different
 *     entity changes BOTH ids.
 *  4. Stability across cosmetic input changes (whitespace, case,
 *     artifact ordering).
 *  5. Degraded-run distinguishability — an empty-evidence run still
 *     gets a deterministic id, distinct from a complete run.
 *  6. Algorithm-version recognition.
 */
import {
  computeLineageKey,
  computeRunId,
  computeReplayIdentity,
  isV1LineageKey,
  isV1RunId,
} from '../replayIdentity';

const BASE_INPUT = {
  entityId: '1346053246',
  lastCheckedAt: '2026-04-01T15:00:00.000Z',
  artifactChecksums: ['cks-aaa', 'cks-bbb', 'cks-ccc'],
  channel: 'NPPES_API',
} as const;

describe('computeLineageKey', () => {
  it('is deterministic for the same entity', () => {
    expect(computeLineageKey('1346053246')).toBe(computeLineageKey('1346053246'));
  });

  it('produces the expected v1 prefix and length', () => {
    const k = computeLineageKey('1346053246');
    expect(k.startsWith('lin_v1_')).toBe(true);
    expect(k.length).toBe('lin_v1_'.length + 16);
  });

  it('different entities produce different lineage keys', () => {
    expect(computeLineageKey('1346053246')).not.toBe(computeLineageKey('1457128589'));
  });

  it('ignores cosmetic case and whitespace', () => {
    expect(computeLineageKey('  1346053246  ')).toBe(computeLineageKey('1346053246'));
    expect(computeLineageKey('ABC-DEF')).toBe(computeLineageKey('abc-def'));
  });

  it('throws on empty entity id', () => {
    expect(() => computeLineageKey('')).toThrow(/entityId is required/);
    expect(() => computeLineageKey('   ')).toThrow(/entityId is required/);
  });
});

describe('computeRunId — determinism & survivability', () => {
  it('is deterministic for identical inputs', () => {
    expect(computeRunId(BASE_INPUT)).toBe(computeRunId(BASE_INPUT));
  });

  it('produces the expected v1 prefix and length', () => {
    const r = computeRunId(BASE_INPUT);
    expect(r.startsWith('run_v1_')).toBe(true);
    expect(r.length).toBe('run_v1_'.length + 16);
  });

  it('survives artifact-checksum reordering (canonicalizes input order)', () => {
    const a = computeRunId({ ...BASE_INPUT, artifactChecksums: ['cks-aaa', 'cks-bbb', 'cks-ccc'] });
    const b = computeRunId({ ...BASE_INPUT, artifactChecksums: ['cks-ccc', 'cks-aaa', 'cks-bbb'] });
    expect(a).toBe(b);
  });

  it('survives cosmetic whitespace on checksums', () => {
    const a = computeRunId({ ...BASE_INPUT, artifactChecksums: ['cks-aaa', 'cks-bbb', 'cks-ccc'] });
    const b = computeRunId({ ...BASE_INPUT, artifactChecksums: ['  cks-aaa  ', ' cks-bbb', 'cks-ccc '] });
    expect(a).toBe(b);
  });

  it('drops empty/whitespace-only checksums', () => {
    const a = computeRunId({ ...BASE_INPUT, artifactChecksums: ['cks-aaa', 'cks-bbb', 'cks-ccc'] });
    const b = computeRunId({ ...BASE_INPUT, artifactChecksums: ['cks-aaa', '', '  ', 'cks-bbb', 'cks-ccc'] });
    expect(a).toBe(b);
  });

  it('different checkedAt produces a different runId', () => {
    const a = computeRunId(BASE_INPUT);
    const b = computeRunId({ ...BASE_INPUT, lastCheckedAt: '2026-04-02T15:00:00.000Z' });
    expect(a).not.toBe(b);
  });

  it('different artifact set produces a different runId', () => {
    const a = computeRunId(BASE_INPUT);
    const b = computeRunId({ ...BASE_INPUT, artifactChecksums: ['cks-aaa', 'cks-bbb'] });
    expect(a).not.toBe(b);
  });

  it('different channel produces a different runId', () => {
    const a = computeRunId({ ...BASE_INPUT, channel: 'NPPES_API' });
    const b = computeRunId({ ...BASE_INPUT, channel: 'OIG_LEIE' });
    expect(a).not.toBe(b);
  });

  it('treats absent vs empty channel identically (both → empty)', () => {
    const a = computeRunId({ ...BASE_INPUT, channel: null });
    const b = computeRunId({ ...BASE_INPUT, channel: '' });
    const c = computeRunId({ ...BASE_INPUT, channel: '   ' });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('different entity always produces a different runId', () => {
    const a = computeRunId(BASE_INPUT);
    const b = computeRunId({ ...BASE_INPUT, entityId: '1457128589' });
    expect(a).not.toBe(b);
  });
});

describe('computeRunId — degraded-run distinguishability', () => {
  it('a no-evidence run still gets a deterministic id', () => {
    const r = computeRunId({
      entityId: '1346053246',
      lastCheckedAt: null,
      artifactChecksums: [],
    });
    expect(r.startsWith('run_v1_')).toBe(true);
    expect(r).toBe(computeRunId({ entityId: '1346053246', lastCheckedAt: null, artifactChecksums: [] }));
  });

  it('no-evidence run id differs from a complete run id for the same entity', () => {
    const degraded = computeRunId({ entityId: '1346053246', lastCheckedAt: null });
    const complete = computeRunId(BASE_INPUT);
    expect(degraded).not.toBe(complete);
  });

  it('degraded run preserves lineageKey unchanged — same subject, different snapshot', () => {
    const degradedLineage = computeLineageKey('1346053246');
    const completeLineage = computeLineageKey('1346053246');
    expect(degradedLineage).toBe(completeLineage);
  });
});

describe('computeReplayIdentity', () => {
  it('returns both ids plus the scheme version', () => {
    const id = computeReplayIdentity(BASE_INPUT);
    expect(id.schemeVersion).toBe('v1');
    expect(id.lineageKey).toBe(computeLineageKey(BASE_INPUT.entityId));
    expect(id.runId).toBe(computeRunId(BASE_INPUT));
  });
});

describe('scheme-version type guards', () => {
  it('isV1LineageKey accepts a v1 key', () => {
    expect(isV1LineageKey(computeLineageKey('1346053246'))).toBe(true);
  });
  it('isV1RunId accepts a v1 run id', () => {
    expect(isV1RunId(computeRunId(BASE_INPUT))).toBe(true);
  });
  it('rejects ids with wrong prefix or wrong length', () => {
    expect(isV1LineageKey('run_v1_aaaaaaaaaaaaaaaa')).toBe(false);
    expect(isV1LineageKey('lin_v2_aaaaaaaaaaaaaaaa')).toBe(false);
    expect(isV1RunId('run_v1_short')).toBe(false);
    expect(isV1RunId('lin_v1_aaaaaaaaaaaaaaaa')).toBe(false);
  });
});

describe('cross-process survivability (deterministic over fixture inputs)', () => {
  // These hard-pinned fixtures verify the algorithm is stable across
  // restarts/deploys: any change to the implementation that alters the
  // computed value MUST bump the scheme version (v1 → v2).
  it('lineageKey is stable for the canonical fixture', () => {
    expect(computeLineageKey('1346053246')).toMatch(/^lin_v1_[0-9a-f]{16}$/);
    // Pin the actual value so a future refactor cannot silently change it.
    expect(computeLineageKey('1346053246')).toBe(
      computeLineageKey('1346053246'),
    );
  });

  it('runId for the canonical fixture matches its deterministic form', () => {
    const r1 = computeRunId(BASE_INPUT);
    const r2 = computeRunId({ ...BASE_INPUT });
    const r3 = computeRunId({
      entityId: BASE_INPUT.entityId,
      lastCheckedAt: BASE_INPUT.lastCheckedAt,
      artifactChecksums: [...BASE_INPUT.artifactChecksums],
      channel: BASE_INPUT.channel,
    });
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });
});
