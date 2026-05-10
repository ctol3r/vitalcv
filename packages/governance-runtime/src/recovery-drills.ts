/**
 * Institutional recovery drill framework (W2-PR116A).
 *
 * Pure orchestration model for disaster-recovery rehearsals using a
 * production snapshot chain (W2-PR103A) as the source of restorable
 * checkpoints. Drills are executed deterministically; identical
 * (chain, drill plan) ⇒ identical drill receipt.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";
import {
  findRestorationCheckpoint,
  planRestoration,
  type RestorationPlan,
  type SnapshotChain,
} from "./production-snapshot.js";

export const DRILL_OUTCOMES = ["PASS", "PASS-WITH-WARNINGS", "FAIL", "ABORTED"] as const;
export type DrillOutcome = (typeof DRILL_OUTCOMES)[number];

export interface RecoveryDrill {
  readonly drillId: string;
  readonly executedAt: string;
  readonly targetSnapshotId: string;
  readonly plan: RestorationPlan;
  readonly outcome: DrillOutcome;
  readonly warnings: readonly string[];
  readonly drillReceiptId: string;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export interface DrillExecutionInput {
  readonly drillId: string;
  readonly executedAt: string;
  readonly chain: SnapshotChain;
  readonly targetSnapshotId: string;
  /** Operator-supplied flag: was the rehearsal aborted mid-flight? */
  readonly aborted?: boolean;
}

export function executeRecoveryDrill(input: DrillExecutionInput): RecoveryDrill {
  if (input.aborted) {
    const receiptId = sha256Hex(canonicalize({ drillId: input.drillId, executedAt: input.executedAt, aborted: true }));
    return Object.freeze({
      drillId: input.drillId,
      executedAt: input.executedAt,
      targetSnapshotId: input.targetSnapshotId,
      plan: {
        fromSnapshotId: "",
        toSnapshotId: input.targetSnapshotId,
        epochsRolledBack: 0,
        replayAmbiguousLost: 0,
        replayCollapsedLost: 0,
        ambiguityErasureRisk: false,
      },
      outcome: "ABORTED",
      warnings: Object.freeze(["drill aborted by operator"]),
      drillReceiptId: receiptId,
    });
  }
  const plan = planRestoration(input.chain, input.targetSnapshotId);
  const warnings: string[] = [];
  if (plan.ambiguityErasureRisk) warnings.push(`rehearsing rollback would erase ${plan.replayAmbiguousLost} ambiguous observations`);
  if (plan.epochsRolledBack > 100) warnings.push(`large rollback: ${plan.epochsRolledBack} epochs`);

  let outcome: DrillOutcome;
  if (plan.ambiguityErasureRisk) {
    outcome = "PASS-WITH-WARNINGS";
  } else if (plan.epochsRolledBack === 0) {
    // No-op rollback (target == current head) — pass trivially
    outcome = "PASS";
  } else {
    outcome = "PASS";
  }

  const receiptId = sha256Hex(canonicalize({
    drillId: input.drillId,
    executedAt: input.executedAt,
    targetSnapshotId: input.targetSnapshotId,
    plan,
    outcome,
    warnings,
  }));

  return Object.freeze({
    drillId: input.drillId,
    executedAt: input.executedAt,
    targetSnapshotId: input.targetSnapshotId,
    plan,
    outcome,
    warnings: Object.freeze(warnings),
    drillReceiptId: receiptId,
  });
}

export interface RecoveryDrillReport {
  readonly executedAt: string;
  readonly drills: readonly RecoveryDrill[];
  readonly outcomeDistribution: Readonly<Partial<Record<DrillOutcome, number>>>;
  readonly mostRecentCheckpointId: string | null;
  readonly hasCiGatingCondition: boolean;
}

export function buildRecoveryDrillReport(
  chain: SnapshotChain,
  drills: readonly RecoveryDrill[],
  nowIso: string,
  options: { readonly maxFailFraction?: number } = {},
): RecoveryDrillReport {
  const maxFail = options.maxFailFraction ?? 0.0;
  const distribution: Partial<Record<DrillOutcome, number>> = {};
  for (const d of drills) distribution[d.outcome] = (distribution[d.outcome] ?? 0) + 1;
  const failCount = (distribution.FAIL ?? 0) + (distribution.ABORTED ?? 0);
  const failFrac = drills.length === 0 ? 0 : failCount / drills.length;
  const mostRecent = findRestorationCheckpoint(chain);
  return Object.freeze({
    executedAt: nowIso,
    drills,
    outcomeDistribution: Object.freeze(distribution),
    mostRecentCheckpointId: mostRecent?.snapshotId ?? null,
    hasCiGatingCondition: failFrac > maxFail,
  });
}
