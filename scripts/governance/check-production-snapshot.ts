#!/usr/bin/env tsx
/**
 * check-production-snapshot.ts — W2-PR103A CI gate.
 * Hermetic check: builds a 3-snapshot synthetic chain with a checkpoint
 * and asserts no violations, plus a deterministic restoration plan.
 */
import {
  appendEpoch,
  appendProductionSnapshot,
  buildProductionSnapshot,
  buildProductionSnapshotReport,
  captureGovernanceSnapshot,
  emptyLedger,
  emptySealedLedger,
  emptySnapshotChain,
  planRestoration,
  ROOT_PRODUCTION_PARENT,
  sealEpoch,
  type GovernanceEpoch,
} from "../../packages/governance-runtime/src/registry.js";

function iso(h: number): string {
  return new Date(Date.parse("2026-05-10T00:00:00Z") + h * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}
function epoch(o: Partial<GovernanceEpoch> & { observedAt: string }): GovernanceEpoch {
  return {
    activeOverrideCount: 0,
    expiredOverrideCount: 0,
    overRenewedOverrideCount: 0,
    replayAmbiguousCount: 0,
    replayCollapsedCount: 0,
    integrityDegradedCount: 0,
    containmentDegradedCount: 0,
    recoveryAttemptCount: 0,
    recoveryFailureCount: 0,
    contradictionCount: 0,
    aggregateVerificationConfidence: "VERIFIED",
    degradedDomainTallies: {},
    ...o,
  };
}

function snapAt(parent: string, n: number, label: string, ts: string, checkpoint: boolean) {
  let ledger = emptyLedger();
  let sealed = emptySealedLedger();
  for (let i = 0; i < n; i++) {
    const e = epoch({ observedAt: iso(i), replayAmbiguousCount: 1 });
    ledger = appendEpoch(ledger, e);
    sealed = sealEpoch(sealed, e);
  }
  const gov = captureGovernanceSnapshot(sealed, ts);
  return buildProductionSnapshot({
    parentSnapshotId: parent,
    capturedAt: ts,
    productionLabel: label,
    restorationCheckpoint: checkpoint,
    governanceSnapshot: gov,
    sealed,
  });
}

function main(): void {
  const json = process.argv.includes("--json");
  let chain = emptySnapshotChain();
  const s1 = snapAt(ROOT_PRODUCTION_PARENT, 1, "v1", iso(1), true);
  chain = appendProductionSnapshot(chain, s1);
  const s2 = snapAt(s1.snapshotId, 2, "v2", iso(2), false);
  chain = appendProductionSnapshot(chain, s2);
  const s3 = snapAt(s2.snapshotId, 3, "v3", iso(3), true);
  chain = appendProductionSnapshot(chain, s3);

  const r = buildProductionSnapshotReport(chain, iso(4), { requireCheckpointEvery: 3 });
  const plan = planRestoration(chain, s1.snapshotId);

  const ok = !r.hasCiGatingCondition && plan.epochsRolledBack === 2 && plan.ambiguityErasureRisk === true;
  if (json) {
    process.stdout.write(JSON.stringify({ chainLength: r.chainLength, violations: r.violations, mostRecentCheckpointId: r.mostRecentCheckpointId, plan, ok }, null, 2) + "\n");
  } else {
    console.log(`[check-production-snapshot] chain=${r.chainLength} violations=${r.violations.length} checkpoint=${r.mostRecentCheckpointId}`);
    console.log(`[check-production-snapshot] rollback plan: epochs=${plan.epochsRolledBack} ambiguityRisk=${plan.ambiguityErasureRisk}`);
    console.log(`[check-production-snapshot] ok=${ok}`);
  }
  process.exit(ok ? 0 : 1);
}
main();
