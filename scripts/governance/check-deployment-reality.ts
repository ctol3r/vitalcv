#!/usr/bin/env tsx
/**
 * check-deployment-reality.ts — W2-PR92A CI gate.
 *
 * Hermetic check: builds a clean synthetic input across all sub-reports
 * and asserts DEPLOY-READY verdict + deterministic convergenceHash.
 */
import {
  buildDeploymentRealityReport,
  buildPilotAccelerationReport,
  validateUxConsistency,
  validateVerifierCognitiveSafety,
  type ConstitutionalConvergenceReport,
  type PmfReadinessReport,
  type SurfaceObservation,
  type SurfaceMessage,
} from "../../packages/governance-runtime/src/registry.js";

function main(): void {
  const json = process.argv.includes("--json");
  const NOW = "2026-05-09T00:00:00Z";
  const convergence: ConstitutionalConvergenceReport = {
    executedAt: NOW,
    verdict: "CONSTITUTIONALLY-COHERENT",
    perWaveGating: {
      drift: false,
      replaySurvivability: false,
      persistence: false,
      durability: false,
      compression: false,
      kernel: false,
    },
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
  const r1 = buildDeploymentRealityReport({ nowIso: NOW, convergence, pmf, pilot, uxConsistency: ux, cognitiveSafety: cog });
  const r2 = buildDeploymentRealityReport({ nowIso: NOW, convergence, pmf, pilot, uxConsistency: ux, cognitiveSafety: cog });
  const determinismOk = r1.convergenceHash === r2.convergenceHash;
  const verdictOk = r1.verdict === "DEPLOY-READY";
  if (json) {
    process.stdout.write(JSON.stringify({ verdict: r1.verdict, score: r1.score, convergenceHash: r1.convergenceHash, determinismOk, verdictOk, hasCiGatingCondition: !determinismOk || !verdictOk }, null, 2) + "\n");
  } else {
    console.log(`[check-deployment-reality] verdict=${r1.verdict} score=${r1.score}`);
    console.log(`[check-deployment-reality] convergenceHash=${r1.convergenceHash}`);
    console.log(`[check-deployment-reality] determinism=${determinismOk} verdictOk=${verdictOk}`);
  }
  process.exit(!determinismOk || !verdictOk ? 1 : 0);
}
main();
