#!/usr/bin/env tsx
/**
 * check-five-wave-bundle.ts — combined CI gate for W2-PR79A / 82A / 83A / 86A / 89A.
 *
 * Hermetic checks: builds synthetic inputs for each wave's validator and
 * asserts no violations on the clean baseline.
 */
import {
  ACTIVATION_TIERS,
  buildExceptionGovernanceReport,
  buildPilotAccelerationReport,
  computeExceptionReceiptId,
  EXCEPTION_LIFECYCLE,
  PMF_TIERS,
  SURFACE_MESSAGE_KINDS,
  validateUxConsistency,
  validateVerifierCognitiveSafety,
  type ExceptionApplication,
  type SurfaceMessage,
  type SurfaceObservation,
} from "../../packages/governance-runtime/src/registry.js";

function main(): void {
  const json = process.argv.includes("--json");
  const NOW = "2026-05-09T00:00:00Z";

  const ux = validateUxConsistency([
    { surfaceId: "a", trajectory: "STABLE", replayConfidence: "FULL", ambiguityPreserved: true, headlineIndicatorCount: 3 } as SurfaceObservation,
    { surfaceId: "b", trajectory: "STABLE", replayConfidence: "FULL", ambiguityPreserved: true, headlineIndicatorCount: 4 } as SurfaceObservation,
  ], NOW);

  const cog = validateVerifierCognitiveSafety([
    { id: "m1", kind: "REPLAY_OBSERVATION", text: "ok", rendersAsDenial: false, rendersAsAmbiguous: false } as SurfaceMessage,
  ], NOW);

  const pilot = buildPilotAccelerationReport([], NOW);

  const baseExc = {
    proposingActor: "operator:on-call",
    proposedAt: NOW,
    justification: "demo",
    impactedReplayState: false,
    impactedAmbiguityState: false,
  };
  const exc = buildExceptionGovernanceReport([{
    applicationId: "e1",
    state: "PROPOSED",
    reviewingActor: null,
    approvingActor: null,
    closingReason: null,
    applicationReceiptId: computeExceptionReceiptId(baseExc),
    ...baseExc,
  } as ExceptionApplication], NOW);

  const allClean = !ux.hasCiGatingCondition && !cog.hasCiGatingCondition && !pilot.hasCiGatingCondition && !exc.hasCiGatingCondition;
  const summary = {
    ux: ux.violations.length,
    cog: cog.violations.length,
    pilotStalledFraction: pilot.stalledFraction,
    exc: exc.violations.length,
    pmfTiers: PMF_TIERS.length,
    surfaceMsgKinds: SURFACE_MESSAGE_KINDS.length,
    activationTiers: ACTIVATION_TIERS.length,
    exceptionLifecycle: EXCEPTION_LIFECYCLE.length,
    allClean,
  };
  if (json) process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  else {
    console.log(`[check-five-wave-bundle] ux=${summary.ux} cog=${summary.cog} pilot-stalled=${summary.pilotStalledFraction} exc=${summary.exc}`);
    console.log(`[check-five-wave-bundle] allClean=${allClean}`);
  }
  process.exit(allClean ? 0 : 1);
}
main();
