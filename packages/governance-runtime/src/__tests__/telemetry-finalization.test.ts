/**
 * W2-PR156A — Institutional Runtime Activation Telemetry Finalization.
 *
 * Verification of deployment-telemetry primitives before institutional
 * activation monitoring:
 *   - DEPLOYMENT_EVENT_KINDS vocabulary (7 kinds)
 *   - computeDeploymentEventId determinism + SHA-256 format
 *   - validateDeploymentEvent — all 6 violation types
 *   - buildDeploymentTelemetryReport — anomaly detection, CI gating
 *
 * Doctrine: W2-PR106A (deployment telemetry), docs/ops/runtime-integrity-dashboard.md
 */

import { describe, expect, it } from "vitest";

import {
  DEPLOYMENT_EVENT_KINDS,
  computeDeploymentEventId,
  validateDeploymentEvent,
  buildDeploymentTelemetryReport,
  type DeploymentEvent,
} from "../deployment-telemetry.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<DeploymentEvent> = {}): DeploymentEvent {
  const base: DeploymentEvent = {
    eventId: "placeholder",
    observedAt: "2026-01-01T00:00:00Z",
    kind: "ROLLOUT_COMPLETED",
    productionLabel: "prod-v1",
    latencyMs: null,
    ambiguousCountObserved: null,
    errorReason: null,
  };
  const merged = { ...base, ...overrides };
  // Compute the correct eventId
  const computed = computeDeploymentEventId({
    observedAt: merged.observedAt,
    kind: merged.kind,
    productionLabel: merged.productionLabel,
    latencyMs: merged.latencyMs ?? null,
    ambiguousCountObserved: merged.ambiguousCountObserved ?? null,
    errorReason: merged.errorReason ?? null,
  });
  return { ...merged, eventId: computed };
}

// ─── 1. DEPLOYMENT_EVENT_KINDS vocabulary ────────────────────────────────────

describe("W2-PR156A — DEPLOYMENT_EVENT_KINDS vocabulary", () => {
  it("contains exactly 7 kinds", () => {
    expect(DEPLOYMENT_EVENT_KINDS).toHaveLength(7);
  });

  it("contains ROLLOUT_INITIATED", () => {
    expect(DEPLOYMENT_EVENT_KINDS).toContain("ROLLOUT_INITIATED");
  });

  it("contains ROLLOUT_COMPLETED", () => {
    expect(DEPLOYMENT_EVENT_KINDS).toContain("ROLLOUT_COMPLETED");
  });

  it("contains ROLLOUT_FAILED", () => {
    expect(DEPLOYMENT_EVENT_KINDS).toContain("ROLLOUT_FAILED");
  });

  it("contains ROLLBACK_INITIATED", () => {
    expect(DEPLOYMENT_EVENT_KINDS).toContain("ROLLBACK_INITIATED");
  });

  it("contains ROLLBACK_COMPLETED", () => {
    expect(DEPLOYMENT_EVENT_KINDS).toContain("ROLLBACK_COMPLETED");
  });

  it("contains REPLAY_LATENCY_OBSERVED", () => {
    expect(DEPLOYMENT_EVENT_KINDS).toContain("REPLAY_LATENCY_OBSERVED");
  });

  it("contains AMBIGUITY_SURGE_OBSERVED", () => {
    expect(DEPLOYMENT_EVENT_KINDS).toContain("AMBIGUITY_SURGE_OBSERVED");
  });
});

// ─── 2. computeDeploymentEventId — determinism ───────────────────────────────

describe("W2-PR156A — computeDeploymentEventId determinism", () => {
  const INPUT = {
    observedAt: "2026-01-01T00:00:00Z",
    kind: "ROLLOUT_COMPLETED" as const,
    productionLabel: "prod-v1",
    latencyMs: null,
    ambiguousCountObserved: null,
    errorReason: null,
  };

  it("two calls with identical input produce the same hash", () => {
    expect(computeDeploymentEventId(INPUT)).toBe(computeDeploymentEventId(INPUT));
  });

  it("output is a 64-character hex string (SHA-256)", () => {
    expect(computeDeploymentEventId(INPUT)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different kind produces different hash", () => {
    const id1 = computeDeploymentEventId({ ...INPUT, kind: "ROLLOUT_INITIATED" });
    const id2 = computeDeploymentEventId({ ...INPUT, kind: "ROLLOUT_COMPLETED" });
    expect(id1).not.toBe(id2);
  });

  it("different productionLabel produces different hash", () => {
    const id1 = computeDeploymentEventId({ ...INPUT, productionLabel: "prod-v1" });
    const id2 = computeDeploymentEventId({ ...INPUT, productionLabel: "prod-v2" });
    expect(id1).not.toBe(id2);
  });

  it("latencyMs included in hash (null vs number differ)", () => {
    const id1 = computeDeploymentEventId({ ...INPUT, latencyMs: null });
    const id2 = computeDeploymentEventId({ ...INPUT, latencyMs: 100 });
    expect(id1).not.toBe(id2);
  });
});

// ─── 3. validateDeploymentEvent — all violation types ────────────────────────

describe("W2-PR156A — validateDeploymentEvent violations", () => {
  it("valid event → no violations", () => {
    expect(validateDeploymentEvent(makeEvent())).toHaveLength(0);
  });

  it("missing eventId → missing-field violation", () => {
    const v = validateDeploymentEvent({ ...makeEvent(), eventId: "" });
    expect(v.some((x) => x.tag === "missing-field" && x.field === "eventId")).toBe(true);
  });

  it("missing observedAt → missing-field violation", () => {
    const v = validateDeploymentEvent({ ...makeEvent(), observedAt: "" });
    expect(v.some((x) => x.tag === "missing-field" && x.field === "observedAt")).toBe(true);
  });

  it("missing productionLabel → missing-field violation", () => {
    const v = validateDeploymentEvent({ ...makeEvent(), productionLabel: "" });
    expect(v.some((x) => x.tag === "missing-field" && x.field === "productionLabel")).toBe(true);
  });

  it("unknown kind → unknown-kind violation", () => {
    const e = { ...makeEvent(), kind: "GHOST_EVENT" as never };
    const v = validateDeploymentEvent(e);
    expect(v.some((x) => x.tag === "unknown-kind")).toBe(true);
  });

  it("ROLLOUT_FAILED without errorReason → rollout-failed-without-reason", () => {
    const e: Partial<DeploymentEvent> = {
      ...makeEvent({ kind: "ROLLOUT_FAILED", errorReason: "network timeout" }),
      kind: "ROLLOUT_FAILED",
      errorReason: null,
    };
    // Recompute eventId correctly
    const computed = computeDeploymentEventId({
      observedAt: e.observedAt!,
      kind: e.kind!,
      productionLabel: e.productionLabel!,
      latencyMs: null,
      ambiguousCountObserved: null,
      errorReason: null,
    });
    const v = validateDeploymentEvent({ ...e, eventId: computed });
    expect(v.some((x) => x.tag === "rollout-failed-without-reason")).toBe(true);
  });

  it("ROLLOUT_FAILED with errorReason → no rollout-failed-without-reason", () => {
    const e = makeEvent({ kind: "ROLLOUT_FAILED", errorReason: "timeout" });
    const computed = computeDeploymentEventId({
      observedAt: e.observedAt,
      kind: e.kind,
      productionLabel: e.productionLabel,
      latencyMs: null,
      ambiguousCountObserved: null,
      errorReason: "timeout",
    });
    const v = validateDeploymentEvent({ ...e, eventId: computed });
    expect(v.some((x) => x.tag === "rollout-failed-without-reason")).toBe(false);
  });

  it("REPLAY_LATENCY_OBSERVED without latencyMs → replay-latency-without-value", () => {
    const e = makeEvent({ kind: "REPLAY_LATENCY_OBSERVED", latencyMs: null });
    const computed = computeDeploymentEventId({
      observedAt: e.observedAt,
      kind: "REPLAY_LATENCY_OBSERVED",
      productionLabel: e.productionLabel,
      latencyMs: null,
      ambiguousCountObserved: null,
      errorReason: null,
    });
    const v = validateDeploymentEvent({ ...e, eventId: computed, kind: "REPLAY_LATENCY_OBSERVED", latencyMs: null });
    expect(v.some((x) => x.tag === "replay-latency-without-value")).toBe(true);
  });

  it("REPLAY_LATENCY_OBSERVED with latencyMs → no replay-latency-without-value", () => {
    const computed = computeDeploymentEventId({
      observedAt: "2026-01-01T00:00:00Z",
      kind: "REPLAY_LATENCY_OBSERVED",
      productionLabel: "prod-v1",
      latencyMs: 200,
      ambiguousCountObserved: null,
      errorReason: null,
    });
    const e: DeploymentEvent = {
      eventId: computed,
      observedAt: "2026-01-01T00:00:00Z",
      kind: "REPLAY_LATENCY_OBSERVED",
      productionLabel: "prod-v1",
      latencyMs: 200,
      ambiguousCountObserved: null,
      errorReason: null,
    };
    expect(validateDeploymentEvent(e).some((x) => x.tag === "replay-latency-without-value")).toBe(false);
  });

  it("AMBIGUITY_SURGE_OBSERVED without count → ambiguity-surge-without-count", () => {
    const computed = computeDeploymentEventId({
      observedAt: "2026-01-01T00:00:00Z",
      kind: "AMBIGUITY_SURGE_OBSERVED",
      productionLabel: "prod-v1",
      latencyMs: null,
      ambiguousCountObserved: null,
      errorReason: null,
    });
    const e: DeploymentEvent = {
      eventId: computed,
      observedAt: "2026-01-01T00:00:00Z",
      kind: "AMBIGUITY_SURGE_OBSERVED",
      productionLabel: "prod-v1",
      latencyMs: null,
      ambiguousCountObserved: null,
      errorReason: null,
    };
    expect(validateDeploymentEvent(e).some((x) => x.tag === "ambiguity-surge-without-count")).toBe(true);
  });

  it("event-id-mismatch when eventId tampered", () => {
    const e = makeEvent();
    const tampered: DeploymentEvent = { ...e, eventId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1" };
    const v = validateDeploymentEvent(tampered);
    expect(v.some((x) => x.tag === "event-id-mismatch")).toBe(true);
  });
});

// ─── 4. buildDeploymentTelemetryReport — structure ───────────────────────────

describe("W2-PR156A — buildDeploymentTelemetryReport structure", () => {
  it("empty events → no violations, no anomalies, no CI gate", () => {
    const r = buildDeploymentTelemetryReport([], "2026-01-01T00:00:00Z");
    expect(r.eventsEvaluated).toBe(0);
    expect(r.violations).toHaveLength(0);
    expect(r.anomalies).toHaveLength(0);
    expect(r.hasCiGatingCondition).toBe(false);
  });

  it("one valid event → no violations", () => {
    const e = makeEvent({ kind: "ROLLOUT_COMPLETED" });
    const r = buildDeploymentTelemetryReport([e], "2026-01-01T00:00:00Z");
    expect(r.violations).toHaveLength(0);
  });

  it("executedAt is stored as-is", () => {
    const ts = "2026-05-10T12:00:00Z";
    const r = buildDeploymentTelemetryReport([], ts);
    expect(r.executedAt).toBe(ts);
  });

  it("eventsEvaluated matches input length", () => {
    const events = [makeEvent(), makeEvent({ kind: "ROLLOUT_INITIATED" })];
    const r = buildDeploymentTelemetryReport(events, "2026-01-01T00:00:00Z");
    expect(r.eventsEvaluated).toBe(2);
  });
});

// ─── 5. buildDeploymentTelemetryReport — anomaly detection ───────────────────

describe("W2-PR156A — buildDeploymentTelemetryReport anomaly detection", () => {
  it("replay latency above threshold → replay-latency-spike anomaly", () => {
    const latencyComputed = computeDeploymentEventId({
      observedAt: "2026-01-01T00:00:00Z",
      kind: "REPLAY_LATENCY_OBSERVED",
      productionLabel: "prod-v1",
      latencyMs: 6000,
      ambiguousCountObserved: null,
      errorReason: null,
    });
    const e: DeploymentEvent = {
      eventId: latencyComputed,
      observedAt: "2026-01-01T00:00:00Z",
      kind: "REPLAY_LATENCY_OBSERVED",
      productionLabel: "prod-v1",
      latencyMs: 6000,
      ambiguousCountObserved: null,
      errorReason: null,
    };
    const r = buildDeploymentTelemetryReport([e], "2026-01-01T00:00:00Z", { latencySpikeMs: 5000 });
    expect(r.anomalies.some((a) => a.tag === "replay-latency-spike")).toBe(true);
  });

  it("replay latency below threshold → no spike anomaly", () => {
    const latencyComputed = computeDeploymentEventId({
      observedAt: "2026-01-01T00:00:00Z",
      kind: "REPLAY_LATENCY_OBSERVED",
      productionLabel: "prod-v1",
      latencyMs: 100,
      ambiguousCountObserved: null,
      errorReason: null,
    });
    const e: DeploymentEvent = {
      eventId: latencyComputed,
      observedAt: "2026-01-01T00:00:00Z",
      kind: "REPLAY_LATENCY_OBSERVED",
      productionLabel: "prod-v1",
      latencyMs: 100,
      ambiguousCountObserved: null,
      errorReason: null,
    };
    const r = buildDeploymentTelemetryReport([e], "2026-01-01T00:00:00Z", { latencySpikeMs: 5000 });
    expect(r.anomalies.some((a) => a.tag === "replay-latency-spike")).toBe(false);
  });

  it("ambiguity surge above threshold → ambiguity-surge anomaly", () => {
    const surgeComputed = computeDeploymentEventId({
      observedAt: "2026-01-01T00:00:00Z",
      kind: "AMBIGUITY_SURGE_OBSERVED",
      productionLabel: "prod-v1",
      latencyMs: null,
      ambiguousCountObserved: 100,
      errorReason: null,
    });
    const e: DeploymentEvent = {
      eventId: surgeComputed,
      observedAt: "2026-01-01T00:00:00Z",
      kind: "AMBIGUITY_SURGE_OBSERVED",
      productionLabel: "prod-v1",
      latencyMs: null,
      ambiguousCountObserved: 100,
      errorReason: null,
    };
    const r = buildDeploymentTelemetryReport([e], "2026-01-01T00:00:00Z", { maxAmbigSurge: 50 });
    expect(r.anomalies.some((a) => a.tag === "ambiguity-surge")).toBe(true);
  });

  it("3+ rollback-initiated events → rollback-frequency-high anomaly", () => {
    const rollbacks = [1, 2, 3].map((n) => makeEvent({
      kind: "ROLLBACK_INITIATED",
      observedAt: `2026-01-0${n}T00:00:00Z`,
    }));
    // Recompute eventIds correctly
    const events: DeploymentEvent[] = rollbacks.map((e) => ({
      ...e,
      eventId: computeDeploymentEventId({
        observedAt: e.observedAt,
        kind: e.kind,
        productionLabel: e.productionLabel,
        latencyMs: null,
        ambiguousCountObserved: null,
        errorReason: null,
      }),
    }));
    const r = buildDeploymentTelemetryReport(events, "2026-01-03T01:00:00Z");
    expect(r.anomalies.some((a) => a.tag === "rollback-frequency-high")).toBe(true);
  });

  it("high failure rate → rollout-failure-rate-high anomaly", () => {
    const initiated = makeEvent({ kind: "ROLLOUT_INITIATED" });
    const failed = makeEvent({ kind: "ROLLOUT_FAILED", errorReason: "timeout" });
    const failedId = computeDeploymentEventId({
      observedAt: failed.observedAt,
      kind: "ROLLOUT_FAILED",
      productionLabel: failed.productionLabel,
      latencyMs: null,
      ambiguousCountObserved: null,
      errorReason: "timeout",
    });
    const events: DeploymentEvent[] = [initiated, { ...failed, eventId: failedId }];
    const r = buildDeploymentTelemetryReport(events, "2026-01-01T01:00:00Z", { maxFailureFraction: 0.2 });
    expect(r.anomalies.some((a) => a.tag === "rollout-failure-rate-high")).toBe(true);
  });
});

// ─── 6. CI gating condition ───────────────────────────────────────────────────

describe("W2-PR156A — hasCiGatingCondition", () => {
  it("violations present → CI gate fires", () => {
    const bad: Partial<DeploymentEvent> = { ...makeEvent(), eventId: "" };
    const r = buildDeploymentTelemetryReport([bad as DeploymentEvent], "2026-01-01T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it("clean events → no CI gate", () => {
    const r = buildDeploymentTelemetryReport([makeEvent()], "2026-01-01T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(false);
  });

  it("report is frozen", () => {
    const r = buildDeploymentTelemetryReport([], "2026-01-01T00:00:00Z");
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("violations array is frozen", () => {
    const r = buildDeploymentTelemetryReport([], "2026-01-01T00:00:00Z");
    expect(Object.isFrozen(r.violations)).toBe(true);
  });

  it("anomalies array is frozen", () => {
    const r = buildDeploymentTelemetryReport([], "2026-01-01T00:00:00Z");
    expect(Object.isFrozen(r.anomalies)).toBe(true);
  });
});
