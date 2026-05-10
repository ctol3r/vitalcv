#!/usr/bin/env tsx
/**
 * check-final-bundle.ts — combined CI gate for W2-PR116A / 119A / 121A / 122A.
 * Hermetic: clean inputs ⇒ no gating across all four waves.
 */
import {
  appendEpoch,
  appendProductionSnapshot,
  buildBurnoutProtectionReport,
  buildPmfFinalizationReport,
  buildProductionSnapshot,
  buildRecoveryDrillReport,
  buildTrustReputationReport,
  captureGovernanceSnapshot,
  emptyLedger,
  emptySealedLedger,
  emptySnapshotChain,
  executeRecoveryDrill,
  ROOT_PRODUCTION_PARENT,
  sealEpoch,
  type GovernanceEpoch,
  type ProductionizationReport,
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

function main(): void {
  const json = process.argv.includes("--json");
  const NOW = iso(10);

  // Build a chain
  let ledger = emptyLedger();
  let sealed = emptySealedLedger();
  let chain = emptySnapshotChain();
  let parent = ROOT_PRODUCTION_PARENT;
  for (let i = 1; i <= 3; i++) {
    const e = epoch({ observedAt: iso(i), replayAmbiguousCount: 1 });
    ledger = appendEpoch(ledger, e);
    sealed = sealEpoch(sealed, e);
    const gov = captureGovernanceSnapshot(sealed, iso(i + 0.5));
    const snap = buildProductionSnapshot({
      parentSnapshotId: parent,
      capturedAt: iso(i + 0.5),
      productionLabel: `v${i}`,
      restorationCheckpoint: i === 1,
      governanceSnapshot: gov,
      sealed,
    });
    chain = appendProductionSnapshot(chain, snap);
    parent = snap.snapshotId;
  }

  const drill = executeRecoveryDrill({
    drillId: "drill-1",
    executedAt: NOW,
    chain,
    targetSnapshotId: chain.snapshots[chain.snapshots.length - 1]!.snapshotId,
  });
  const drillReport = buildRecoveryDrillReport(chain, [drill], NOW);

  const burnout = buildBurnoutProtectionReport([
    { operatorId: "op1", assignedItems: [], throughput24h: 5, contextSwitches24h: 5, ambiguityMinutes24h: 10 },
  ], NOW);

  const reputation = buildTrustReputationReport([
    { subjectId: "org-a", ledger, overrides: [], incidents: [] },
  ], NOW);

  const productionization: ProductionizationReport = {
    executedAt: NOW,
    verdict: "PRODUCTION-READY",
    score: 90,
    violations: [],
    convergenceHash: "h",
    hasCiGatingCondition: false,
  };
  const pmf = buildPmfFinalizationReport({ nowIso: NOW, productionization, reputation, burnout });

  const ok = !drillReport.hasCiGatingCondition && !burnout.hasCiGatingCondition && !reputation.hasCiGatingCondition && pmf.verdict === "PMF-FINALIZED";
  if (json) {
    process.stdout.write(JSON.stringify({ drillReport, burnout, reputation, pmf, ok }, null, 2) + "\n");
  } else {
    console.log(`[check-final-bundle] drill=${drill.outcome} burntOut=${burnout.burntOutCount} reputation-tier=${reputation.reputations[0]?.tier} pmf-verdict=${pmf.verdict}`);
    console.log(`[check-final-bundle] ok=${ok}`);
  }
  process.exit(ok ? 0 : 1);
}
main();
