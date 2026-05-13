/**
 * REPLAY-PERSIST-β — Pure-function tests for the ingest replay-writer
 * input builder. No DB, no Prisma, no orchestrator side effects.
 */
import {
  INGEST_REPLAY_CHANNEL,
  buildReplayWriterInputFromIngest,
  formatArtifactChecksum,
} from '../replayWriterIngest';
import { computeReplayIdentity } from '../replayIdentity';

const PASSPORT = {
  entityId: '1346053246',
  lastCheckedAt: '2026-05-13T12:00:00.000Z',
};

const SOURCE_SUMMARY = [
  { sourceId: 'nppes', status: 'DONE',  claimCount: 3, credentialCount: 5 },
  { sourceId: 'oig',   status: 'DONE',  claimCount: 0, credentialCount: 0 },
  { sourceId: 'pecos', status: 'DONE',  claimCount: 1, credentialCount: 0 },
] as const;

describe('formatArtifactChecksum', () => {
  it('encodes the per-source completion shape as a stable colon-delimited string', () => {
    expect(formatArtifactChecksum(SOURCE_SUMMARY[0])).toBe('nppes:DONE:3:5');
    expect(formatArtifactChecksum(SOURCE_SUMMARY[1])).toBe('oig:DONE:0:0');
    expect(formatArtifactChecksum(SOURCE_SUMMARY[2])).toBe('pecos:DONE:1:0');
  });
});

describe('buildReplayWriterInputFromIngest', () => {
  it('produces the canonical input shape recordReplayRun consumes', () => {
    const input = buildReplayWriterInputFromIngest(PASSPORT, SOURCE_SUMMARY);
    expect(input.entityId).toBe(PASSPORT.entityId);
    expect(input.channel).toBe(INGEST_REPLAY_CHANNEL);
    expect(input.checkedAt).toBe(PASSPORT.lastCheckedAt);
    expect(input.recordedBy).toBe(INGEST_REPLAY_CHANNEL);
    expect(input.artifactChecksums).toEqual([
      'nppes:DONE:3:5',
      'oig:DONE:0:0',
      'pecos:DONE:1:0',
    ]);
  });

  it('feeds into computeReplayIdentity with the v1 prefix convention', () => {
    const input = buildReplayWriterInputFromIngest(PASSPORT, SOURCE_SUMMARY);
    const id = computeReplayIdentity(input);
    expect(/^lin_v1_[0-9a-f]{16}$/.test(id.lineageKey)).toBe(true);
    expect(/^run_v1_[0-9a-f]{16}$/.test(id.runId)).toBe(true);
  });

  it('is deterministic across identical inputs', () => {
    const a = buildReplayWriterInputFromIngest(PASSPORT, SOURCE_SUMMARY);
    const b = buildReplayWriterInputFromIngest(PASSPORT, SOURCE_SUMMARY);
    expect(computeReplayIdentity(a).lineageKey).toBe(computeReplayIdentity(b).lineageKey);
    expect(computeReplayIdentity(a).runId).toBe(computeReplayIdentity(b).runId);
  });

  it('produces the same lineageKey when source-summary array order changes (because lineageKey sorts)', () => {
    // Note: buildReplayWriterInputFromIngest itself preserves caller order;
    // the canonical sort happens inside computeReplayIdentity. This test
    // pins the cross-module contract: caller order does not affect the
    // resulting lineageKey.
    const a = buildReplayWriterInputFromIngest(PASSPORT, SOURCE_SUMMARY);
    const b = buildReplayWriterInputFromIngest(PASSPORT, [...SOURCE_SUMMARY].reverse());
    expect(computeReplayIdentity(a).lineageKey).toBe(computeReplayIdentity(b).lineageKey);
  });

  it('detects upstream changes: a single source-count delta yields a different lineageKey', () => {
    const baseline = buildReplayWriterInputFromIngest(PASSPORT, SOURCE_SUMMARY);
    const shifted = buildReplayWriterInputFromIngest(PASSPORT, [
      { sourceId: 'nppes', status: 'DONE', claimCount: 4, credentialCount: 5 }, // claimCount 3 -> 4
      SOURCE_SUMMARY[1],
      SOURCE_SUMMARY[2],
    ]);
    expect(computeReplayIdentity(baseline).lineageKey).not.toBe(
      computeReplayIdentity(shifted).lineageKey,
    );
  });

  it('detects source-status drift: DONE -> ERROR yields a different lineageKey', () => {
    const baseline = buildReplayWriterInputFromIngest(PASSPORT, SOURCE_SUMMARY);
    const errored = buildReplayWriterInputFromIngest(PASSPORT, [
      SOURCE_SUMMARY[0],
      { sourceId: 'oig', status: 'ERROR', claimCount: 0, credentialCount: 0 },
      SOURCE_SUMMARY[2],
    ]);
    expect(computeReplayIdentity(baseline).lineageKey).not.toBe(
      computeReplayIdentity(errored).lineageKey,
    );
  });

  it('produces the same lineageKey across runs that differ only by checkedAt (run identity diverges)', () => {
    const earlier = buildReplayWriterInputFromIngest(
      { ...PASSPORT, lastCheckedAt: '2026-05-13T11:00:00.000Z' },
      SOURCE_SUMMARY,
    );
    const later = buildReplayWriterInputFromIngest(
      { ...PASSPORT, lastCheckedAt: '2026-05-13T13:00:00.000Z' },
      SOURCE_SUMMARY,
    );
    expect(computeReplayIdentity(earlier).lineageKey).toBe(
      computeReplayIdentity(later).lineageKey,
    );
    expect(computeReplayIdentity(earlier).runId).not.toBe(
      computeReplayIdentity(later).runId,
    );
  });

  it('accepts Date instances for lastCheckedAt without losing determinism', () => {
    const a = buildReplayWriterInputFromIngest(
      { ...PASSPORT, lastCheckedAt: '2026-05-13T12:00:00.000Z' },
      SOURCE_SUMMARY,
    );
    const b = buildReplayWriterInputFromIngest(
      { ...PASSPORT, lastCheckedAt: new Date('2026-05-13T12:00:00.000Z') },
      SOURCE_SUMMARY,
    );
    expect(computeReplayIdentity(a).runId).toBe(computeReplayIdentity(b).runId);
  });
});
