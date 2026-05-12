/**
 * Operator-surface evaluation helpers — turn the deterministic
 * replay-identity primitives into UI-ready findings.
 *
 * The CLI scripts in `scripts/replay/*` exercise the same contract
 * for offline / CI use; this module is the matching server-side
 * helper layer the React surfaces consume.
 *
 * Three findings are surfaced:
 *
 *   1. coherence — does the `replay.runId` the backend declared on
 *      the passport response match the runId locally recomputed from
 *      the same evidence inputs? A mismatch indicates EITHER an
 *      algorithm drift between backend and web mirror (bug — should
 *      never happen given the parity test) OR upstream tampering /
 *      cache contamination (verifier-actionable signal).
 *
 *   2. gap summary — given a set of historical inspections (e.g. the
 *      recent-NPIs list maintained by `useRecentNpis`), report the
 *      number of chronology gaps and the largest one. Operators can
 *      see "no gaps" or "1 gap (45 days)" at a glance.
 *
 *   3. survivability marker — pinning the scheme version the response
 *      carries so a future `v2` rollout is visually distinguishable
 *      from `v1` ("which algorithm signed this snapshot?").
 *
 * All helpers are pure functions over already-fetched data; no IO.
 */
import { computeLineageKey, computeRunId } from './clientReplayIdentity';

export interface CoherenceInput {
  entityId: string;
  lastCheckedAt: string | null;
  artifactChecksums?: readonly string[];
  channel?: string | null;
  /** What the backend declared on the response, if anything. */
  declared?: { lineageKey?: string; runId?: string; schemeVersion?: 'v1' } | null;
}

export type CoherenceFinding =
  | { state: 'no-declaration'; expectedLineageKey: string; expectedRunId: string }
  | { state: 'coherent'; lineageKey: string; runId: string; schemeVersion: 'v1' }
  | {
      state: 'lineage-drift';
      expectedLineageKey: string;
      declaredLineageKey: string;
      expectedRunId: string;
      declaredRunId?: string;
    }
  | {
      state: 'run-drift';
      lineageKey: string;
      expectedRunId: string;
      declaredRunId: string;
    };

export async function evaluateReplayCoherence(input: CoherenceInput): Promise<CoherenceFinding> {
  const expectedLineageKey = await computeLineageKey(input.entityId);
  const expectedRunId = await computeRunId({
    entityId: input.entityId,
    lastCheckedAt: input.lastCheckedAt,
    artifactChecksums: input.artifactChecksums,
    channel: input.channel,
  });

  const declared = input.declared;
  if (!declared || (!declared.lineageKey && !declared.runId)) {
    return { state: 'no-declaration', expectedLineageKey, expectedRunId };
  }

  if (declared.lineageKey && declared.lineageKey !== expectedLineageKey) {
    return {
      state: 'lineage-drift',
      expectedLineageKey,
      declaredLineageKey: declared.lineageKey,
      expectedRunId,
      declaredRunId: declared.runId,
    };
  }

  if (declared.runId && declared.runId !== expectedRunId) {
    return {
      state: 'run-drift',
      lineageKey: expectedLineageKey,
      expectedRunId,
      declaredRunId: declared.runId,
    };
  }

  return {
    state: 'coherent',
    lineageKey: expectedLineageKey,
    runId: expectedRunId,
    schemeVersion: 'v1',
  };
}

// ── Gap summary ───────────────────────────────────────────────────────────

export interface GapInput {
  checkedAt: string | null;
  runId?: string;
}

export interface GapSummary {
  snapshotCount: number;
  gapCount: number;
  largestGapHours: number | null;
  largestGap: { from: string; to: string; hours: number } | null;
  continuous: boolean;
}

const DEFAULT_GAP_THRESHOLD_HOURS = 720; // 30 days — same default as scripts/replay/find-replay-gaps.ts

export function summarizeReplayGaps(
  history: readonly GapInput[],
  thresholdHours: number = DEFAULT_GAP_THRESHOLD_HOURS,
): GapSummary {
  const sorted = [...history]
    .filter((h): h is { checkedAt: string; runId?: string } => typeof h.checkedAt === 'string')
    .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));

  let largestGap: GapSummary['largestGap'] = null;
  let gapCount = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const ms = new Date(cur.checkedAt).getTime() - new Date(prev.checkedAt).getTime();
    if (!Number.isFinite(ms)) continue;
    const hours = ms / (1000 * 60 * 60);
    if (hours > thresholdHours) {
      gapCount += 1;
      if (largestGap === null || hours > largestGap.hours) {
        largestGap = { from: prev.checkedAt, to: cur.checkedAt, hours: Math.round(hours) };
      }
    }
  }

  return {
    snapshotCount: sorted.length,
    gapCount,
    largestGapHours: largestGap?.hours ?? null,
    largestGap,
    continuous: gapCount === 0,
  };
}
