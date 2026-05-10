#!/usr/bin/env tsx
/**
 * check-prod-bundle.ts — combined CI gate for W2-PR106A / 109A / 112A.
 * Hermetic check: builds clean synthetic inputs and asserts
 * PRODUCTION-READY verdict + deterministic convergenceHash.
 */
import {
  appendEpoch,
  appendProductionSnapshot,
  buildDeploymentRealityReport,
  buildDeploymentTelemetryReport,
  buildPilotAccelerationReport,
  buildProductionizationReport,
  buildProductionSnapshot,
  buildProductionSnapshotReport,
  captureGovernanceSnapshot,
  emptyLedger,
  emptySealedLedger,
  emptySnapshotChain,
  enforceSlas,
  ROOT_PRODUCTION_PARENT,
  sealEpoch,
  validateUxConsistency,
  validateVerifierCognitiveSafety,
  type ConstitutionalConvergenceReport,
  type GovernanceEpoch,
  type PmfReadinessReport,
  type SurfaceMessage,
  type SurfaceObservation,
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

  // Build a clean fleet
  let ledger = emptyLedger();
  let sealed = emptySealedLedger();
  for (let i = 0; i < 3; i++) {
    const e = epoch({ observedAt: iso(i), replayAmbiguousCount: 1 });
    ledger = appendEpoch(ledger, e);
    sealed = sealEpoch(sealed, e);
  }
  const gov = captureGovernanceSnapshot(sealed, NOW);
  let chain = emptySnapshotChain();
  chain = appendProductionSnapshot(chain, buildProductionSnapshot({
    parentSnapshotId: ROOT_PRODUCTION_PARENT,
    capturedAt: iso(1),
    productionLabel: "v1",
    restorationCheckpoint: true,
    governanceSnapshot: gov,
    sealed,
  }));

  const convergence: ConstitutionalConvergenceReport = {
    executedAt: NOW,
    verdict: "CONSTITUTIONALLY-COHERENT",
    perWaveGating: { drift: false, replaySurvivability: false, persistence: false, durability: false, compression: false, kernel: false },
    crossWaveViolations: [],
    convergenceHash: "h",
    hasCiGatingCondition: false,
  };
  const pmf: PmfReadinessReport = {
    executedAt: NOW,
    tier: "PRODUCTION-READY",
    score: 90,
    contributors: { constitutionalCoherence: 40, trustConversion: 25, verifierResponsiveness: 20, replayBottleneckPenalty: 0 },
    constitutionalBlock: false,
    hasCiGatingCondition: false,
  };
  const pilot = buildPilotAccelerationReport([], NOW);
  const ux = validateUxConsistency([
    { surfaceId: "a", trajectory: "STABLE", replayConfidence: "FULL", ambiguityPreserved: true, headlineIndicatorCount: 3 } as SurfaceObservation,
  ], NOW);
  const cog = validateVerifierCognitiveSafety([
    { id: "m", kind: "REPLAY_OBSERVATION", text: "ok", rendersAsDenial: false, rendersAsAmbiguous: false } as SurfaceMessage,
  ], NOW);
  const deployment = buildDeploymentRealityReport({ nowIso: NOW, convergence, pmf, pilot, uxConsistency: ux, cognitiveSafety: cog });
  const snapshot = buildProductionSnapshotReport(chain, NOW);
  const telemetry = buildDeploymentTelemetryReport([], NOW);
  const sla = enforceSlas(ledger, NOW);

  const r1 = buildProductionizationReport({ nowIso: NOW, deployment, pilot, snapshot, telemetry, sla });
  const r2 = buildProductionizationReport({ nowIso: NOW, deployment, pilot, snapshot, telemetry, sla });

  const determinismOk = r1.convergenceHash === r2.convergenceHash;
  const verdictOk = r1.verdict === "PRODUCTION-READY";

  if (json) {
    process.stdout.write(JSON.stringify({ verdict: r1.verdict, score: r1.score, convergenceHash: r1.convergenceHash, determinismOk, verdictOk, hasCiGatingCondition: !determinismOk || !verdictOk }, null, 2) + "\n");
  } else {
    console.log(`[check-prod-bundle] verdict=${r1.verdict} score=${r1.score} hash=${r1.convergenceHash}`);
    console.log(`[check-prod-bundle] determinism=${determinismOk} verdictOk=${verdictOk}`);
  }
  process.exit(!determinismOk || !verdictOk ? 1 : 0);
}
main();
