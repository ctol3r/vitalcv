#!/usr/bin/env -S node --import=tsx/esm
/**
 * reconcile-lineage.ts
 *
 * Reconciles two candidate evidence sets and reports whether they
 * belong to the SAME subject (same `lineageKey`) and, if so, whether
 * they represent the SAME snapshot (same `runId`) or two distinct
 * snapshots in the lineage.
 *
 * Operationally: when a verifier sees two candidate receipts (e.g.
 * one downloaded from a clinician's email and one fetched fresh from
 * the issuer), they need to know:
 *
 *   - Are these the same person? → same `lineageKey`
 *   - Are these the same check?  → same `runId`
 *   - If different `runId`: is it explained by an evidence change?
 *
 * The output is a structured reconciliation that a human reviewer
 * can read in <30 seconds.
 *
 * Usage:
 *   pnpm exec tsx scripts/replay/reconcile-lineage.ts \
 *     --left  path/to/left.json \
 *     --right path/to/right.json
 *
 * Exit codes:
 *   0  same lineage AND same snapshot — perfectly reconciled
 *   2  bad input
 *   5  same lineage, different snapshot (lineage continuous; new evidence)
 *   6  different lineage (DIFFERENT SUBJECTS — verifier should investigate)
 */
import {
  computeLineageKey,
  computeRunId,
} from '../../apps/api/backend/src/services/replay/replayIdentity';
import {
  emitHumanLine,
  emitJsonLine,
  loadEvidenceFromFile,
  parseArgs,
  type ReplayEvidence,
} from './_lib';

export type ReconcileOutcome =
  | 'same-lineage-same-snapshot'
  | 'same-lineage-different-snapshot'
  | 'different-lineage';

export interface ReconcileResult {
  outcome: ReconcileOutcome;
  left: { entityId: string; lineageKey: string; runId: string };
  right: { entityId: string; lineageKey: string; runId: string };
  evidenceDelta: {
    lastCheckedAtChanged: boolean;
    artifactsAdded: string[];
    artifactsRemoved: string[];
    channelChanged: boolean;
  };
}

export function reconcileLineage(
  left: ReplayEvidence,
  right: ReplayEvidence,
): ReconcileResult {
  const leftIdentity = {
    entityId: left.entityId,
    lineageKey: computeLineageKey(left.entityId),
    runId: computeRunId(left),
  };
  const rightIdentity = {
    entityId: right.entityId,
    lineageKey: computeLineageKey(right.entityId),
    runId: computeRunId(right),
  };

  let outcome: ReconcileOutcome;
  if (leftIdentity.lineageKey !== rightIdentity.lineageKey) {
    outcome = 'different-lineage';
  } else if (leftIdentity.runId === rightIdentity.runId) {
    outcome = 'same-lineage-same-snapshot';
  } else {
    outcome = 'same-lineage-different-snapshot';
  }

  const leftCksSet = new Set(left.artifactChecksums);
  const rightCksSet = new Set(right.artifactChecksums);
  const artifactsAdded = right.artifactChecksums.filter((c) => !leftCksSet.has(c));
  const artifactsRemoved = left.artifactChecksums.filter((c) => !rightCksSet.has(c));

  return {
    outcome,
    left: leftIdentity,
    right: rightIdentity,
    evidenceDelta: {
      lastCheckedAtChanged: left.lastCheckedAt !== right.lastCheckedAt,
      artifactsAdded,
      artifactsRemoved,
      channelChanged: (left.channel ?? '') !== (right.channel ?? ''),
    },
  };
}

function main(): void {
  const { flags } = parseArgs(process.argv.slice(2));
  const leftPath = flags.get('left');
  const rightPath = flags.get('right');

  if (!leftPath || !rightPath) {
    emitHumanLine('usage: reconcile-lineage --left <path.json> --right <path.json>');
    process.exit(2);
  }

  let left: ReplayEvidence;
  let right: ReplayEvidence;
  try {
    left = loadEvidenceFromFile(leftPath);
    right = loadEvidenceFromFile(rightPath);
  } catch (err) {
    emitHumanLine(`error: ${String(err)}`);
    process.exit(2);
  }

  const result = reconcileLineage(left, right);
  emitJsonLine({
    finding: 'reconciliation',
    ok: result.outcome !== 'different-lineage',
    detail: result,
  });

  switch (result.outcome) {
    case 'same-lineage-same-snapshot':
      emitHumanLine('reconcile-lineage: SAME SUBJECT, SAME SNAPSHOT (perfectly reconciled)');
      process.exit(0);
    case 'same-lineage-different-snapshot':
      emitHumanLine('reconcile-lineage: SAME SUBJECT, DIFFERENT SNAPSHOT (lineage continuous; evidence changed)');
      process.exit(5);
    case 'different-lineage':
      emitHumanLine('reconcile-lineage: DIFFERENT LINEAGES (verifier action required — these are NOT the same subject)');
      process.exit(6);
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  main();
}
