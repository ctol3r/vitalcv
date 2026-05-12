/**
 * Unit tests for the three replay-integrity CLI scripts.
 *
 * Each script exports a pure function (verifyReplayIntegrity,
 * findReplayGaps, reconcileLineage) that the `main()` wrapper drives.
 * Tests exercise the pure function directly — fast, deterministic,
 * no process spawning, no filesystem fixtures beyond _lib parsing.
 */
import { findReplayGaps } from '../../../scripts/replay/find-replay-gaps';
import { reconcileLineage } from '../../../scripts/replay/reconcile-lineage';
import { verifyReplayIntegrity } from '../../../scripts/replay/verify-replay-integrity';
import {
  normalizeEvidence,
  parseArgs,
  hoursBetween,
  chronologyKey,
  type ReplayEvidence,
} from '../../../scripts/replay/_lib';

const BASE_EVIDENCE: ReplayEvidence = {
  entityId: '1346053246',
  lastCheckedAt: '2026-04-01T15:00:00.000Z',
  artifactChecksums: ['cks-aaa', 'cks-bbb', 'cks-ccc'],
  channel: 'NPPES_API',
};

describe('_lib parseArgs', () => {
  it('parses --key=value form', () => {
    const { flags } = parseArgs(['--evidence=/tmp/x.json', '--expected-run-id=run_v1_a']);
    expect(flags.get('evidence')).toBe('/tmp/x.json');
    expect(flags.get('expected-run-id')).toBe('run_v1_a');
  });
  it('parses --key value form', () => {
    const { flags } = parseArgs(['--evidence', '/tmp/x.json', '--max-gap-hours', '720']);
    expect(flags.get('evidence')).toBe('/tmp/x.json');
    expect(flags.get('max-gap-hours')).toBe('720');
  });
  it('treats a flag without a value as "1"', () => {
    const { flags } = parseArgs(['--verbose']);
    expect(flags.get('verbose')).toBe('1');
  });
  it('separates positional args', () => {
    const { flags, positional } = parseArgs(['cmd', '--flag', 'value', 'arg']);
    expect(positional).toEqual(['cmd', 'arg']);
    expect(flags.get('flag')).toBe('value');
  });
});

describe('_lib normalizeEvidence', () => {
  it('coerces a permissive shape into strict ReplayEvidence', () => {
    const result = normalizeEvidence({
      entityId: '  1346053246  ',
      lastCheckedAt: '2026-04-01T15:00:00.000Z',
      artifactChecksums: ['cks-aaa', '', '  cks-bbb', 42, 'cks-ccc'],
      channel: ' NPPES_API ',
    });
    expect(result.entityId).toBe('1346053246');
    expect(result.artifactChecksums).toEqual(['cks-aaa', 'cks-bbb', 'cks-ccc']);
    expect(result.channel).toBe('NPPES_API');
  });
  it('throws on missing entityId', () => {
    expect(() => normalizeEvidence({})).toThrow(/entityId is required/);
  });
  it('accepts null lastCheckedAt for degraded runs', () => {
    const result = normalizeEvidence({
      entityId: '1346053246',
      lastCheckedAt: null,
    });
    expect(result.lastCheckedAt).toBeNull();
  });
});

describe('_lib chronologyKey + hoursBetween', () => {
  it('chronologyKey returns a sortable lexicographic key', () => {
    const a = chronologyKey('2026-04-01T00:00:00Z');
    const b = chronologyKey('2026-04-02T00:00:00Z');
    expect(a < b).toBe(true);
  });
  it('chronologyKey returns sentinel for null', () => {
    const k = chronologyKey(null);
    expect(k.startsWith('0000')).toBe(true);
  });
  it('hoursBetween computes positive hours forward', () => {
    expect(hoursBetween('2026-04-01T00:00:00Z', '2026-04-01T12:00:00Z')).toBe(12);
  });
  it('hoursBetween returns null when either side is null/invalid', () => {
    expect(hoursBetween(null, '2026-04-01T00:00:00Z')).toBeNull();
    expect(hoursBetween('not-a-date', '2026-04-01T00:00:00Z')).toBeNull();
  });
});

// ─── verifyReplayIntegrity ─────────────────────────────────────────────────

describe('verifyReplayIntegrity', () => {
  it('reports all integrity properties OK for a clean fixture', () => {
    const findings = verifyReplayIntegrity(BASE_EVIDENCE, null);
    expect(findings.every((f) => f.ok)).toBe(true);
    const summary = findings.find((f) => f.finding === 'summary');
    expect(summary?.detail.runId).toMatch(/^run_v1_[0-9a-f]{16}$/);
    expect(summary?.detail.lineageKey).toMatch(/^lin_v1_[0-9a-f]{16}$/);
  });

  it('determinism finding reports a single uniqueRunId across 25 iterations', () => {
    const findings = verifyReplayIntegrity(BASE_EVIDENCE, null);
    const det = findings.find((f) => f.finding === 'determinism');
    expect(det?.ok).toBe(true);
    expect(det?.detail.iterations).toBe(25);
    expect(det?.detail.uniqueRunIds).toBe(1);
  });

  it('cosmetic-invariance finding is OK (reverse + whitespace pad does not change id)', () => {
    const findings = verifyReplayIntegrity(BASE_EVIDENCE, null);
    const cos = findings.find((f) => f.finding === 'cosmetic-invariance');
    expect(cos?.ok).toBe(true);
    expect(cos?.detail.original).toBe(cos?.detail.cosmeticVariant);
  });

  it('sensitivity finding is OK (tampered inputs diverge)', () => {
    const findings = verifyReplayIntegrity(BASE_EVIDENCE, null);
    const sens = findings.find((f) => f.finding === 'sensitivity');
    expect(sens?.ok).toBe(true);
    expect(sens?.detail.tamperedCheckedAt).not.toBe(sens?.detail.runId);
    expect(sens?.detail.tamperedChecksums).not.toBe(sens?.detail.runId);
  });

  it('reports expected-match OK when expectedRunId equals recomputed', () => {
    // Compute the canonical runId first so we can pass it as "expected"
    const probe = verifyReplayIntegrity(BASE_EVIDENCE, null);
    const summary = probe.find((f) => f.finding === 'summary');
    const expected = summary?.detail.runId as string;

    const findings = verifyReplayIntegrity(BASE_EVIDENCE, expected);
    const match = findings.find((f) => f.finding === 'expected-match');
    expect(match?.ok).toBe(true);
  });

  it('reports expected-match FAILED when expectedRunId diverges (audit-corruption signal)', () => {
    const findings = verifyReplayIntegrity(BASE_EVIDENCE, 'run_v1_deadbeefdeadbeef');
    const match = findings.find((f) => f.finding === 'expected-match');
    const summary = findings.find((f) => f.finding === 'summary');
    expect(match?.ok).toBe(false);
    expect(summary?.ok).toBe(false);
  });
});

// ─── findReplayGaps ───────────────────────────────────────────────────────

describe('findReplayGaps', () => {
  it('reports continuous when all snapshots are within threshold', () => {
    const report = findReplayGaps(
      {
        entityId: '1346053246',
        snapshots: [
          { runId: 'run_v1_a', lastCheckedAt: '2026-03-01T00:00:00Z' },
          { runId: 'run_v1_b', lastCheckedAt: '2026-03-15T00:00:00Z' },
          { runId: 'run_v1_c', lastCheckedAt: '2026-03-25T00:00:00Z' },
        ],
      },
      720, // 30 days
    );
    expect(report.continuous).toBe(true);
    expect(report.gaps).toHaveLength(0);
    expect(report.snapshotCount).toBe(3);
  });

  it('detects a single gap above threshold', () => {
    const report = findReplayGaps(
      {
        entityId: '1346053246',
        snapshots: [
          { runId: 'run_v1_a', lastCheckedAt: '2026-01-01T00:00:00Z' },
          { runId: 'run_v1_b', lastCheckedAt: '2026-04-01T00:00:00Z' }, // 90 days later
        ],
      },
      720,
    );
    expect(report.continuous).toBe(false);
    expect(report.gaps).toHaveLength(1);
    expect(report.gaps[0].from).toBe('2026-01-01T00:00:00Z');
    expect(report.gaps[0].to).toBe('2026-04-01T00:00:00Z');
    expect(report.gaps[0].hoursMissing).toBeGreaterThan(720);
    expect(report.gaps[0].priorRunId).toBe('run_v1_a');
    expect(report.gaps[0].nextRunId).toBe('run_v1_b');
  });

  it('sorts unsorted input chronologically before scanning', () => {
    const report = findReplayGaps(
      {
        entityId: '1346053246',
        snapshots: [
          { runId: 'run_v1_b', lastCheckedAt: '2026-04-01T00:00:00Z' },
          { runId: 'run_v1_a', lastCheckedAt: '2026-01-01T00:00:00Z' },
        ],
      },
      720,
    );
    expect(report.gaps[0].priorRunId).toBe('run_v1_a');
    expect(report.gaps[0].nextRunId).toBe('run_v1_b');
  });

  it('drops snapshots with null/missing lastCheckedAt', () => {
    const report = findReplayGaps(
      {
        entityId: '1346053246',
        snapshots: [
          { runId: 'run_v1_a', lastCheckedAt: '2026-03-01T00:00:00Z' },
          { runId: 'run_v1_partial', lastCheckedAt: null },
          { runId: 'run_v1_b', lastCheckedAt: '2026-03-15T00:00:00Z' },
        ],
      },
      720,
    );
    expect(report.snapshotCount).toBe(2);
  });

  it('attaches the canonical lineageKey to every report', () => {
    const report = findReplayGaps(
      { entityId: '1346053246', snapshots: [] },
      720,
    );
    expect(report.lineageKey).toMatch(/^lin_v1_[0-9a-f]{16}$/);
  });
});

// ─── reconcileLineage ─────────────────────────────────────────────────────

describe('reconcileLineage', () => {
  it('same evidence → same-lineage-same-snapshot', () => {
    const result = reconcileLineage(BASE_EVIDENCE, BASE_EVIDENCE);
    expect(result.outcome).toBe('same-lineage-same-snapshot');
    expect(result.left.runId).toBe(result.right.runId);
    expect(result.evidenceDelta.artifactsAdded).toHaveLength(0);
    expect(result.evidenceDelta.artifactsRemoved).toHaveLength(0);
  });

  it('same entity + added artifact → same-lineage-different-snapshot', () => {
    const result = reconcileLineage(BASE_EVIDENCE, {
      ...BASE_EVIDENCE,
      artifactChecksums: [...BASE_EVIDENCE.artifactChecksums, 'cks-ddd'],
    });
    expect(result.outcome).toBe('same-lineage-different-snapshot');
    expect(result.left.lineageKey).toBe(result.right.lineageKey);
    expect(result.left.runId).not.toBe(result.right.runId);
    expect(result.evidenceDelta.artifactsAdded).toEqual(['cks-ddd']);
    expect(result.evidenceDelta.artifactsRemoved).toEqual([]);
  });

  it('same entity + removed artifact → same-lineage-different-snapshot with removal recorded', () => {
    const result = reconcileLineage(BASE_EVIDENCE, {
      ...BASE_EVIDENCE,
      artifactChecksums: ['cks-aaa', 'cks-bbb'],
    });
    expect(result.outcome).toBe('same-lineage-different-snapshot');
    expect(result.evidenceDelta.artifactsRemoved).toEqual(['cks-ccc']);
  });

  it('different entities → different-lineage', () => {
    const result = reconcileLineage(BASE_EVIDENCE, {
      ...BASE_EVIDENCE,
      entityId: '0000000000',
    });
    expect(result.outcome).toBe('different-lineage');
    expect(result.left.lineageKey).not.toBe(result.right.lineageKey);
  });

  it('lastCheckedAt-only delta → same lineage, different snapshot, delta flagged', () => {
    const result = reconcileLineage(BASE_EVIDENCE, {
      ...BASE_EVIDENCE,
      lastCheckedAt: '2026-04-15T00:00:00.000Z',
    });
    expect(result.outcome).toBe('same-lineage-different-snapshot');
    expect(result.evidenceDelta.lastCheckedAtChanged).toBe(true);
    expect(result.evidenceDelta.artifactsAdded).toHaveLength(0);
  });

  it('channel-only delta → same lineage, different snapshot, channelChanged flagged', () => {
    const result = reconcileLineage(BASE_EVIDENCE, {
      ...BASE_EVIDENCE,
      channel: 'OIG_LEIE',
    });
    expect(result.outcome).toBe('same-lineage-different-snapshot');
    expect(result.evidenceDelta.channelChanged).toBe(true);
  });
});
