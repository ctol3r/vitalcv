#!/usr/bin/env -S node --import=tsx/esm
/**
 * find-replay-gaps.ts
 *
 * Scans a chronological list of evidence snapshots for the same
 * `lineageKey` (i.e. the same entity over time) and reports continuity
 * gaps — windows longer than the configured threshold during which
 * no new check was recorded.
 *
 * Gaps are operationally meaningful: they tell a verifier "between
 * 2026-03-10 and 2026-04-15, this subject was not re-inspected."
 * The Lane B `<ReplayLineage>` primitive renders these gaps visibly;
 * this script is the offline / CI equivalent.
 *
 * Usage:
 *   pnpm exec tsx scripts/replay/find-replay-gaps.ts \
 *     --snapshots path/to/snapshots.json \
 *     [--max-gap-hours 720]
 *
 * Input shape (snapshots.json):
 *   {
 *     "entityId": "1346053246",
 *     "snapshots": [
 *       { "runId": "...", "lastCheckedAt": "2026-03-01T00:00:00Z" },
 *       { "runId": "...", "lastCheckedAt": "2026-04-15T00:00:00Z" }
 *     ]
 *   }
 *
 * Exit codes:
 *   0   no gaps above threshold (or single-snapshot lineage)
 *   2   bad input
 *   4   one or more gaps detected (informational; not a hard failure
 *       because gaps may be legitimate — a verifier decides)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeLineageKey } from '../../apps/api/backend/src/services/replay/replayIdentity';
import {
  chronologyKey,
  emitHumanLine,
  emitJsonLine,
  hoursBetween,
  parseArgs,
} from './_lib';

const DEFAULT_MAX_GAP_HOURS = 720; // 30 days

export interface SnapshotInput {
  entityId: string;
  snapshots: ReadonlyArray<{
    runId?: string;
    lastCheckedAt: string | null;
  }>;
}

export interface ReplayGap {
  from: string;
  to: string;
  hoursMissing: number;
  priorRunId: string | null;
  nextRunId: string | null;
}

export interface GapReport {
  entityId: string;
  lineageKey: string;
  snapshotCount: number;
  maxGapHours: number;
  gaps: ReplayGap[];
  continuous: boolean;
}

export function findReplayGaps(input: SnapshotInput, maxGapHours: number): GapReport {
  const sorted = [...input.snapshots]
    .filter((s) => typeof s.lastCheckedAt === 'string' && s.lastCheckedAt.length > 0)
    .sort((a, b) => chronologyKey(a.lastCheckedAt).localeCompare(chronologyKey(b.lastCheckedAt)));

  const gaps: ReplayGap[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const delta = hoursBetween(prev.lastCheckedAt, cur.lastCheckedAt);
    if (delta !== null && delta > maxGapHours) {
      gaps.push({
        from: prev.lastCheckedAt as string,
        to: cur.lastCheckedAt as string,
        hoursMissing: Math.round(delta),
        priorRunId: prev.runId ?? null,
        nextRunId: cur.runId ?? null,
      });
    }
  }

  return {
    entityId: input.entityId,
    lineageKey: computeLineageKey(input.entityId),
    snapshotCount: sorted.length,
    maxGapHours,
    gaps,
    continuous: gaps.length === 0,
  };
}

function loadSnapshots(path: string): SnapshotInput {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(`snapshots file not found: ${abs}`);
  }
  const parsed = JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>;
  const entityId = typeof parsed.entityId === 'string' ? parsed.entityId.trim() : '';
  if (!entityId) throw new Error('snapshots.entityId is required');
  const snapshots = Array.isArray(parsed.snapshots)
    ? parsed.snapshots.map((s) => ({
        runId: typeof (s as Record<string, unknown>).runId === 'string'
          ? ((s as Record<string, unknown>).runId as string)
          : undefined,
        lastCheckedAt: typeof (s as Record<string, unknown>).lastCheckedAt === 'string'
          ? ((s as Record<string, unknown>).lastCheckedAt as string)
          : null,
      }))
    : [];
  return { entityId, snapshots };
}

function main(): void {
  const { flags } = parseArgs(process.argv.slice(2));
  const snapshotsPath = flags.get('snapshots');
  const maxGap = Number.parseInt(flags.get('max-gap-hours') ?? `${DEFAULT_MAX_GAP_HOURS}`, 10);

  if (!snapshotsPath) {
    emitHumanLine('usage: find-replay-gaps --snapshots <path.json> [--max-gap-hours 720]');
    process.exit(2);
  }
  if (!Number.isFinite(maxGap) || maxGap <= 0) {
    emitHumanLine('error: --max-gap-hours must be a positive number');
    process.exit(2);
  }

  let input: SnapshotInput;
  try {
    input = loadSnapshots(snapshotsPath);
  } catch (err) {
    emitHumanLine(`error: ${String(err)}`);
    process.exit(2);
  }

  const report = findReplayGaps(input, maxGap);

  for (const gap of report.gaps) {
    emitJsonLine({ finding: 'replay-gap', ok: false, detail: gap });
  }
  emitJsonLine({
    finding: 'summary',
    ok: report.continuous,
    detail: {
      entityId: report.entityId,
      lineageKey: report.lineageKey,
      snapshotCount: report.snapshotCount,
      maxGapHours: report.maxGapHours,
      gapCount: report.gaps.length,
      continuous: report.continuous,
    },
  });

  emitHumanLine(
    report.continuous
      ? `find-replay-gaps: continuous (${report.snapshotCount} snapshots, no gaps > ${maxGap}h)`
      : `find-replay-gaps: ${report.gaps.length} gap(s) detected (threshold ${maxGap}h)`,
  );
  process.exit(report.continuous ? 0 : 4);
}

if (typeof require !== 'undefined' && require.main === module) {
  main();
}
