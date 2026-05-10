/**
 * Institutional deployment reality convergence (W2-PR92A).
 *
 * Composes the highest-level reports the runtime can produce into a
 * single deployment-readiness verdict. Pure: identical input ⇒
 * identical verdict.
 *
 * Lexicon-aligned: deployment-readiness is "operationally ready under
 * audit-traceable conditions"; not a substrate guarantee, not a
 * marketing claim.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";
import type { ConstitutionalConvergenceReport } from "./constitutional-convergence.js";
import type { PmfReadinessReport } from "./pmf-compression.js";
import type { PilotAccelerationReport } from "./pilot-acceleration.js";
import type { UxConsistencyReport } from "./ux-consistency.js";
import type { VerifierCognitiveSafetyReport } from "./verifier-cognitive-safety.js";

export const DEPLOYMENT_VERDICTS = [
  "DEPLOY-READY",
  "DEPLOY-READY-CONDITIONAL",
  "DEPLOY-NOT-READY",
  "DEPLOY-FAILED-CLOSED",
] as const;
export type DeploymentVerdict = (typeof DEPLOYMENT_VERDICTS)[number];

export type DeploymentRealityViolation =
  | { readonly tag: "constitutional-block" }
  | { readonly tag: "pmf-not-ready"; readonly tier: string }
  | { readonly tag: "ux-inconsistency"; readonly count: number }
  | { readonly tag: "verifier-cognition-unsafe"; readonly count: number }
  | { readonly tag: "pilot-stalled"; readonly fraction: number };

export interface DeploymentRealityReport {
  readonly executedAt: string;
  readonly verdict: DeploymentVerdict;
  readonly score: number; // 0..100
  readonly violations: readonly DeploymentRealityViolation[];
  readonly convergenceHash: string;
  readonly hasCiGatingCondition: boolean;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function buildDeploymentRealityReport(input: {
  readonly nowIso: string;
  readonly convergence: ConstitutionalConvergenceReport;
  readonly pmf: PmfReadinessReport;
  readonly pilot: PilotAccelerationReport;
  readonly uxConsistency: UxConsistencyReport;
  readonly cognitiveSafety: VerifierCognitiveSafetyReport;
}): DeploymentRealityReport {
  const violations: DeploymentRealityViolation[] = [];

  if (input.convergence.verdict === "FAILED-CLOSED") {
    violations.push({ tag: "constitutional-block" });
  }
  if (input.pmf.tier === "NOT-READY") {
    violations.push({ tag: "pmf-not-ready", tier: input.pmf.tier });
  }
  if (input.uxConsistency.violations.length > 0) {
    violations.push({ tag: "ux-inconsistency", count: input.uxConsistency.violations.length });
  }
  if (input.cognitiveSafety.violations.length > 0) {
    violations.push({ tag: "verifier-cognition-unsafe", count: input.cognitiveSafety.violations.length });
  }
  if (input.pilot.stalledFraction > 0.5) {
    violations.push({ tag: "pilot-stalled", fraction: input.pilot.stalledFraction });
  }

  // Score = pmf.score baseline, modified by other signals
  let score = input.pmf.score;
  if (input.uxConsistency.violations.length > 0) score -= 10;
  if (input.cognitiveSafety.violations.length > 0) score -= 15;
  if (input.pilot.stalledFraction > 0.5) score -= 10;
  if (input.convergence.verdict !== "CONSTITUTIONALLY-COHERENT") score -= 10;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let verdict: DeploymentVerdict;
  if (input.convergence.verdict === "FAILED-CLOSED") {
    verdict = "DEPLOY-FAILED-CLOSED";
  } else if (violations.length === 0 && score >= 80) {
    verdict = "DEPLOY-READY";
  } else if (violations.length <= 1 && score >= 50) {
    verdict = "DEPLOY-READY-CONDITIONAL";
  } else {
    verdict = "DEPLOY-NOT-READY";
  }

  const convergenceHash = sha256Hex(canonicalize({
    convergenceHash: input.convergence.convergenceHash,
    pmfTier: input.pmf.tier,
    pmfScore: input.pmf.score,
    pilotStalledFraction: input.pilot.stalledFraction,
    uxConsistencyHash: input.uxConsistency.consistencyHash,
    cognitiveSafetyViolations: input.cognitiveSafety.violations.length,
    verdict,
    score,
  }));

  return Object.freeze({
    executedAt: input.nowIso,
    verdict,
    score,
    violations: Object.freeze(violations),
    convergenceHash,
    hasCiGatingCondition:
      verdict === "DEPLOY-FAILED-CLOSED" || verdict === "DEPLOY-NOT-READY",
  });
}
