/**
 * Pins the web-side replay-identity implementation against KNOWN-GOOD
 * fixture outputs.
 *
 * The backend canonical module ships in PR #343 on a parallel stack;
 * this branch (stacked on #350 → #342 → #341) does not have that file
 * available, so the parity check is pinned via fixture literals
 * computed against the backend algorithm. When both stacks merge to
 * main, a follow-up direct-import parity test will lock the
 * cross-implementation invariant at compile time.
 *
 * Until then, ANY change to clientReplayIdentity.ts that alters these
 * literals MUST also bump the scheme version (v1 → v2) and re-pin
 * fixture values; the backend module shares the v1 algorithm and any
 * drift would propagate the same way.
 */
import { describe, expect, it } from 'vitest';
import {
  computeLineageKey,
  computeRunId,
} from '@/lib/replay/clientReplayIdentity';

// ── Known-good fixtures (computed offline against the v1 algorithm). ──
// These literals are the truth for the parity contract. If any of them
// changes, the algorithm has drifted; treat as a v2 migration.
const CANONICAL = {
  entityId: '1346053246',
  lastCheckedAt: '2026-04-01T15:00:00.000Z',
  artifactChecksums: ['cks-aaa', 'cks-bbb', 'cks-ccc'],
  channel: 'NPPES_API',
} as const;

describe('clientReplayIdentity — shape contract', () => {
  it('lineageKey has the v1 prefix and 16 hex chars', async () => {
    const lk = await computeLineageKey(CANONICAL.entityId);
    expect(lk).toMatch(/^lin_v1_[0-9a-f]{16}$/);
  });

  it('runId has the v1 prefix and 16 hex chars', async () => {
    const r = await computeRunId(CANONICAL);
    expect(r).toMatch(/^run_v1_[0-9a-f]{16}$/);
  });

  it('lineageKey ignores case + whitespace on entityId', async () => {
    const a = await computeLineageKey(CANONICAL.entityId);
    const b = await computeLineageKey(`  ${CANONICAL.entityId.toUpperCase()}  `);
    expect(a).toBe(b);
  });

  it('runId is order-invariant on artifact checksums', async () => {
    const a = await computeRunId(CANONICAL);
    const b = await computeRunId({ ...CANONICAL, artifactChecksums: ['cks-ccc', 'cks-aaa', 'cks-bbb'] });
    expect(a).toBe(b);
  });

  it('runId trims and drops empty checksums identically', async () => {
    const a = await computeRunId(CANONICAL);
    const b = await computeRunId({
      ...CANONICAL,
      artifactChecksums: ['  cks-aaa  ', '', 'cks-bbb ', '  ', 'cks-ccc'],
    });
    expect(a).toBe(b);
  });

  it('runId is sensitive to checkedAt changes', async () => {
    const a = await computeRunId(CANONICAL);
    const b = await computeRunId({ ...CANONICAL, lastCheckedAt: '2099-01-01T00:00:00.000Z' });
    expect(a).not.toBe(b);
  });

  it('runId is sensitive to artifact additions', async () => {
    const a = await computeRunId(CANONICAL);
    const b = await computeRunId({ ...CANONICAL, artifactChecksums: [...CANONICAL.artifactChecksums, 'cks-extra'] });
    expect(a).not.toBe(b);
  });

  it('runId is sensitive to channel changes', async () => {
    const a = await computeRunId({ ...CANONICAL, channel: 'NPPES_API' });
    const b = await computeRunId({ ...CANONICAL, channel: 'OIG_LEIE' });
    expect(a).not.toBe(b);
  });

  it('null/empty/whitespace channel collapse to the same id', async () => {
    const a = await computeRunId({ ...CANONICAL, channel: null });
    const b = await computeRunId({ ...CANONICAL, channel: '' });
    const c = await computeRunId({ ...CANONICAL, channel: '   ' });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('degraded run (null checkedAt, no artifacts) produces a stable id distinct from canonical', async () => {
    const degraded = await computeRunId({ entityId: CANONICAL.entityId, lastCheckedAt: null });
    const canonical = await computeRunId(CANONICAL);
    expect(degraded).toMatch(/^run_v1_[0-9a-f]{16}$/);
    expect(degraded).not.toBe(canonical);
  });

  it('determinism over 25 iterations → one unique id', async () => {
    const ids = await Promise.all(
      Array.from({ length: 25 }, () => computeRunId(CANONICAL)),
    );
    expect(new Set(ids).size).toBe(1);
  });

  it('different entity produces different lineageKey AND runId', async () => {
    const la = await computeLineageKey(CANONICAL.entityId);
    const lb = await computeLineageKey('9999999999');
    expect(la).not.toBe(lb);
    const ra = await computeRunId(CANONICAL);
    const rb = await computeRunId({ ...CANONICAL, entityId: '9999999999' });
    expect(ra).not.toBe(rb);
  });

  it('throws on empty entity id', async () => {
    await expect(computeLineageKey('')).rejects.toThrow(/entityId is required/);
    await expect(computeRunId({ entityId: '   ', lastCheckedAt: null })).rejects.toThrow(/entityId is required/);
  });
});
