/**
 * Institutional deployment telemetry (W2-PR106A).
 *
 * Pure observability layer over deployment events: rollouts, replay
 * deployment metrics, anomaly detection. Distinct from
 * pilot-intelligence (W2-PR51A — funnel analytics) and pilot-acceleration
 * (W2-PR86A — TTFV scoring).
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";

export const DEPLOYMENT_EVENT_KINDS = [
  "ROLLOUT_INITIATED",
  "ROLLOUT_COMPLETED",
  "ROLLOUT_FAILED",
  "ROLLBACK_INITIATED",
  "ROLLBACK_COMPLETED",
  "REPLAY_LATENCY_OBSERVED",
  "AMBIGUITY_SURGE_OBSERVED",
] as const;
export type DeploymentEventKind = (typeof DEPLOYMENT_EVENT_KINDS)[number];

export interface DeploymentEvent {
  readonly eventId: string;
  readonly observedAt: string;
  readonly kind: DeploymentEventKind;
  readonly productionLabel: string;
  readonly latencyMs?: number | null;
  readonly ambiguousCountObserved?: number | null;
  readonly errorReason?: string | null;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function computeDeploymentEventId(input: {
  readonly observedAt: string;
  readonly kind: DeploymentEventKind;
  readonly productionLabel: string;
  readonly latencyMs: number | null;
  readonly ambiguousCountObserved: number | null;
  readonly errorReason: string | null;
}): string {
  return sha256Hex(canonicalize(input));
}

export type DeploymentTelemetryViolation =
  | { readonly tag: "missing-field"; readonly field: keyof DeploymentEvent }
  | { readonly tag: "unknown-kind"; readonly value: string }
  | { readonly tag: "rollout-failed-without-reason" }
  | { readonly tag: "replay-latency-without-value" }
  | { readonly tag: "ambiguity-surge-without-count" }
  | { readonly tag: "event-id-mismatch"; readonly recorded: string; readonly recomputed: string };

export function validateDeploymentEvent(
  e: Partial<DeploymentEvent>,
): readonly DeploymentTelemetryViolation[] {
  const violations: DeploymentTelemetryViolation[] = [];
  for (const f of ["eventId", "observedAt", "kind", "productionLabel"] as const) {
    if (e[f] === undefined || e[f] === null || e[f] === "") {
      violations.push({ tag: "missing-field", field: f });
    }
  }
  if (e.kind && !(DEPLOYMENT_EVENT_KINDS as readonly string[]).includes(e.kind)) {
    violations.push({ tag: "unknown-kind", value: String(e.kind) });
  }
  if (e.kind === "ROLLOUT_FAILED" && !e.errorReason) {
    violations.push({ tag: "rollout-failed-without-reason" });
  }
  if (e.kind === "REPLAY_LATENCY_OBSERVED" && (e.latencyMs === null || e.latencyMs === undefined)) {
    violations.push({ tag: "replay-latency-without-value" });
  }
  if (e.kind === "AMBIGUITY_SURGE_OBSERVED" && (e.ambiguousCountObserved === null || e.ambiguousCountObserved === undefined)) {
    violations.push({ tag: "ambiguity-surge-without-count" });
  }
  if (
    typeof e.observedAt === "string" &&
    typeof e.kind === "string" &&
    typeof e.productionLabel === "string" &&
    typeof e.eventId === "string"
  ) {
    const recomputed = computeDeploymentEventId({
      observedAt: e.observedAt,
      kind: e.kind as DeploymentEventKind,
      productionLabel: e.productionLabel,
      latencyMs: e.latencyMs ?? null,
      ambiguousCountObserved: e.ambiguousCountObserved ?? null,
      errorReason: e.errorReason ?? null,
    });
    if (recomputed !== e.eventId) {
      violations.push({ tag: "event-id-mismatch", recorded: e.eventId, recomputed });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

export interface DeploymentAnomaly {
  readonly tag: "rollout-failure-rate-high" | "replay-latency-spike" | "ambiguity-surge" | "rollback-frequency-high";
  readonly severity: number; // 0..100
  readonly description: string;
}

export interface DeploymentTelemetryReport {
  readonly executedAt: string;
  readonly eventsEvaluated: number;
  readonly violations: readonly DeploymentTelemetryViolation[];
  readonly anomalies: readonly DeploymentAnomaly[];
  readonly hasCiGatingCondition: boolean;
}

export function buildDeploymentTelemetryReport(
  events: readonly DeploymentEvent[],
  nowIso: string,
  options: { readonly latencySpikeMs?: number; readonly maxFailureFraction?: number; readonly maxAmbigSurge?: number } = {},
): DeploymentTelemetryReport {
  const latencyThreshold = options.latencySpikeMs ?? 5000;
  const maxFailFrac = options.maxFailureFraction ?? 0.2;
  const maxAmbig = options.maxAmbigSurge ?? 50;

  const violations: DeploymentTelemetryViolation[] = [];
  for (const e of events) {
    for (const v of validateDeploymentEvent(e)) violations.push(v);
  }

  const anomalies: DeploymentAnomaly[] = [];
  // Rollout failure rate
  const rollouts = events.filter((e) => e.kind === "ROLLOUT_INITIATED" || e.kind === "ROLLOUT_COMPLETED" || e.kind === "ROLLOUT_FAILED");
  const failures = events.filter((e) => e.kind === "ROLLOUT_FAILED");
  if (rollouts.length > 0 && failures.length / rollouts.length > maxFailFrac) {
    anomalies.push({
      tag: "rollout-failure-rate-high",
      severity: Math.min(100, Math.round((failures.length / rollouts.length) * 100)),
      description: `rollout failure rate ${((failures.length / rollouts.length) * 100).toFixed(0)}% over ${rollouts.length} rollouts`,
    });
  }
  // Replay latency spikes
  for (const e of events) {
    if (e.kind === "REPLAY_LATENCY_OBSERVED" && (e.latencyMs ?? 0) > latencyThreshold) {
      anomalies.push({
        tag: "replay-latency-spike",
        severity: Math.min(100, Math.round(((e.latencyMs ?? 0) / latencyThreshold) * 50)),
        description: `replay latency ${e.latencyMs}ms exceeds threshold ${latencyThreshold}ms at ${e.observedAt}`,
      });
    }
    if (e.kind === "AMBIGUITY_SURGE_OBSERVED" && (e.ambiguousCountObserved ?? 0) > maxAmbig) {
      anomalies.push({
        tag: "ambiguity-surge",
        severity: Math.min(100, Math.round(((e.ambiguousCountObserved ?? 0) / maxAmbig) * 50)),
        description: `ambiguity surge ${e.ambiguousCountObserved} > ${maxAmbig} at ${e.observedAt}`,
      });
    }
  }
  // Rollback frequency
  const rollbacks = events.filter((e) => e.kind === "ROLLBACK_INITIATED").length;
  if (rollbacks >= 3) {
    anomalies.push({
      tag: "rollback-frequency-high",
      severity: Math.min(100, rollbacks * 15),
      description: `${rollbacks} rollbacks observed`,
    });
  }

  return Object.freeze({
    executedAt: nowIso,
    eventsEvaluated: events.length,
    violations: Object.freeze(violations),
    anomalies: Object.freeze(anomalies),
    hasCiGatingCondition: violations.length > 0 || anomalies.some((a) => a.severity >= 80),
  });
}
