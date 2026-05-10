/**
 * Institutional productionization convergence (W2-PR112A).
 *
 * Top-level synthesis: composes deployment-reality (W2-PR92A), pilot-
 * acceleration (W2-PR86A), production-snapshot (W2-PR103A), deployment-
 * telemetry (W2-PR106A), and SLA enforcement (W2-PR109A) into one
 * production-readiness verdict for institutional rollout.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";
import type { DeploymentRealityReport } from "./deployment-reality.js";
import type { PilotAccelerationReport } from "./pilot-acceleration.js";
import type { ProductionSnapshotReport } from "./production-snapshot.js";
import type { DeploymentTelemetryReport } from "./deployment-telemetry.js";
import type { SlaEnforcementReport } from "./sla-enforcement.js";

export const PRODUCTIONIZATION_VERDICTS = [
  "PRODUCTION-READY",
  "PRODUCTION-READY-CONDITIONAL",
  "PRODUCTION-NOT-READY",
  "PRODUCTION-FAILED-CLOSED",
] as const;
export type ProductionizationVerdict = (typeof PRODUCTIONIZATION_VERDICTS)[number];

export type ProductionizationViolation =
  | { readonly tag: "deployment-failed-closed" }
  | { readonly tag: "snapshot-chain-broken"; readonly count: number }
  | { readonly tag: "telemetry-anomalies-critical"; readonly count: number }
  | { readonly tag: "sla-escalation-required" }
  | { readonly tag: "pilot-stalled-majority"; readonly fraction: number };

export interface ProductionizationReport {
  readonly executedAt: string;
  readonly verdict: ProductionizationVerdict;
  readonly score: number;
  readonly violations: readonly ProductionizationViolation[];
  readonly convergenceHash: string;
  readonly hasCiGatingCondition: boolean;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function buildProductionizationReport(input: {
  readonly nowIso: string;
  readonly deployment: DeploymentRealityReport;
  readonly pilot: PilotAccelerationReport;
  readonly snapshot: ProductionSnapshotReport;
  readonly telemetry: DeploymentTelemetryReport;
  readonly sla: SlaEnforcementReport;
}): ProductionizationReport {
  const violations: ProductionizationViolation[] = [];

  if (input.deployment.verdict === "DEPLOY-FAILED-CLOSED") {
    violations.push({ tag: "deployment-failed-closed" });
  }
  if (input.snapshot.violations.length > 0) {
    violations.push({ tag: "snapshot-chain-broken", count: input.snapshot.violations.length });
  }
  const criticalAnoms = input.telemetry.anomalies.filter((a) => a.severity >= 80).length;
  if (criticalAnoms > 0) {
    violations.push({ tag: "telemetry-anomalies-critical", count: criticalAnoms });
  }
  if (input.sla.escalationRequired) {
    violations.push({ tag: "sla-escalation-required" });
  }
  if (input.pilot.stalledFraction > 0.5) {
    violations.push({ tag: "pilot-stalled-majority", fraction: input.pilot.stalledFraction });
  }

  // Score: deployment.score baseline, penalize sub-signals
  let score = input.deployment.score;
  if (input.snapshot.violations.length > 0) score -= 15;
  if (criticalAnoms > 0) score -= 15;
  if (input.sla.escalationRequired) score -= 20;
  if (input.pilot.stalledFraction > 0.5) score -= 10;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let verdict: ProductionizationVerdict;
  if (input.deployment.verdict === "DEPLOY-FAILED-CLOSED") {
    verdict = "PRODUCTION-FAILED-CLOSED";
  } else if (violations.length === 0 && score >= 80 && input.deployment.verdict === "DEPLOY-READY") {
    verdict = "PRODUCTION-READY";
  } else if (violations.length <= 1 && score >= 50) {
    verdict = "PRODUCTION-READY-CONDITIONAL";
  } else {
    verdict = "PRODUCTION-NOT-READY";
  }

  const convergenceHash = sha256Hex(canonicalize({
    deploymentVerdict: input.deployment.verdict,
    deploymentHash: input.deployment.convergenceHash,
    pilotStalledFraction: input.pilot.stalledFraction,
    snapshotViolationCount: input.snapshot.violations.length,
    telemetryViolationCount: input.telemetry.violations.length,
    telemetryAnomalyCount: input.telemetry.anomalies.length,
    slaBreachCount: input.sla.breaches.length,
    verdict,
    score,
  }));

  return Object.freeze({
    executedAt: input.nowIso,
    verdict,
    score,
    violations: Object.freeze(violations),
    convergenceHash,
    hasCiGatingCondition: verdict === "PRODUCTION-FAILED-CLOSED" || verdict === "PRODUCTION-NOT-READY",
  });
}
