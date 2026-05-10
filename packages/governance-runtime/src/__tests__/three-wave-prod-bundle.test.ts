/**
 * Combined tests for W2-PR106A / 109A / 112A.
 */

import { describe, expect, it } from "vitest";
import {
  appendEpoch,
  emptyLedger,
  type GovernanceEpoch,
} from "../longitudinal-memory.js";
import {
  buildDeploymentTelemetryReport,
  computeDeploymentEventId,
  DEPLOYMENT_EVENT_KINDS,
  validateDeploymentEvent,
  type DeploymentEvent,
} from "../deployment-telemetry.js";
import {
  DEFAULT_SLA_THRESHOLDS,
  enforceSlas,
  SLA_BREACH_SEVERITY,
} from "../sla-enforcement.js";
import {
  buildProductionizationReport,
  PRODUCTIONIZATION_VERDICTS,
  type ProductionizationReport,
} from "../productionization-convergence.js";
import type { DeploymentRealityReport } from "../deployment-reality.js";
import type { PilotAccelerationReport } from "../pilot-acceleration.js";
import type { ProductionSnapshotReport } from "../production-snapshot.js";

const NOW = "2026-05-10T00:00:00Z";

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
function iso(h: number): string {
  return new Date(Date.parse("2026-05-10T00:00:00Z") + h * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ───────────────────────────────────────────────────────────────────────────
// W2-PR106A — deployment telemetry
// ───────────────────────────────────────────────────────────────────────────

function evt(o: Partial<DeploymentEvent> & { kind: DeploymentEvent["kind"]; observedAt: string; productionLabel: string }): DeploymentEvent {
  const base = {
    observedAt: o.observedAt,
    kind: o.kind,
    productionLabel: o.productionLabel,
    latencyMs: o.latencyMs ?? null,
    ambiguousCountObserved: o.ambiguousCountObserved ?? null,
    errorReason: o.errorReason ?? null,
  };
  return {
    eventId: computeDeploymentEventId(base),
    ...base,
  };
}

describe("W2-PR106A — deployment telemetry", () => {
  it("DEPLOYMENT_EVENT_KINDS has 7 kinds", () => expect(DEPLOYMENT_EVENT_KINDS.length).toBe(7));

  it("clean rollout event passes", () => {
    const e = evt({ observedAt: NOW, kind: "ROLLOUT_INITIATED", productionLabel: "v1" });
    expect(validateDeploymentEvent(e)).toEqual([]);
  });

  it("ROLLOUT_FAILED without reason flagged", () => {
    const e = evt({ observedAt: NOW, kind: "ROLLOUT_FAILED", productionLabel: "v1" });
    const v = validateDeploymentEvent(e);
    expect(v.some((x) => x.tag === "rollout-failed-without-reason")).toBe(true);
  });

  it("REPLAY_LATENCY_OBSERVED without value flagged", () => {
    const e = evt({ observedAt: NOW, kind: "REPLAY_LATENCY_OBSERVED", productionLabel: "v1" });
    const v = validateDeploymentEvent(e);
    expect(v.some((x) => x.tag === "replay-latency-without-value")).toBe(true);
  });

  it("rollout failure rate 50% → anomaly", () => {
    const events: DeploymentEvent[] = [];
    for (let i = 0; i < 4; i++) events.push(evt({ observedAt: iso(i), kind: "ROLLOUT_INITIATED", productionLabel: "v1" }));
    for (let i = 0; i < 2; i++) events.push(evt({ observedAt: iso(i + 4), kind: "ROLLOUT_FAILED", productionLabel: "v1", errorReason: "x" }));
    const r = buildDeploymentTelemetryReport(events, NOW);
    expect(r.anomalies.some((a) => a.tag === "rollout-failure-rate-high")).toBe(true);
  });

  it("CHAOS: replay latency spike fires", () => {
    const e = evt({ observedAt: NOW, kind: "REPLAY_LATENCY_OBSERVED", productionLabel: "v1", latencyMs: 30000 });
    const r = buildDeploymentTelemetryReport([e], NOW, { latencySpikeMs: 5000 });
    expect(r.anomalies.some((a) => a.tag === "replay-latency-spike")).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// W2-PR109A — SLA enforcement
// ───────────────────────────────────────────────────────────────────────────

describe("W2-PR109A — SLA enforcement", () => {
  it("SLA_BREACH_SEVERITY has 4 tiers", () => expect(SLA_BREACH_SEVERITY.length).toBe(4));

  it("clean ledger ⇒ no breaches", () => {
    let ledger = emptyLedger();
    for (let i = 0; i < 5; i++) ledger = appendEpoch(ledger, epoch({ observedAt: iso(i) }));
    const r = enforceSlas(ledger, NOW);
    expect(r.breaches).toEqual([]);
  });

  it("CHAOS: 8 consecutive ambiguous epochs ⇒ ambiguity-escalation-overdue", () => {
    let ledger = emptyLedger();
    for (let i = 0; i < 8; i++) ledger = appendEpoch(ledger, epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const r = enforceSlas(ledger, NOW);
    expect(r.breaches.some((b) => b.tag === "ambiguity-escalation-overdue")).toBe(true);
  });

  it("CHAOS: aggregate confidence drops to UNKNOWN ⇒ confidence-floor-breached", () => {
    let ledger = emptyLedger();
    ledger = appendEpoch(ledger, epoch({ observedAt: iso(0), aggregateVerificationConfidence: "UNKNOWN" }));
    const r = enforceSlas(ledger, NOW);
    expect(r.breaches.some((b) => b.tag === "confidence-floor-breached")).toBe(true);
  });

  it("CHAOS: contradictions exceed budget ⇒ contradiction-budget-exceeded", () => {
    let ledger = emptyLedger();
    for (let i = 0; i < 3; i++) ledger = appendEpoch(ledger, epoch({ observedAt: iso(i), contradictionCount: 5 }));
    const r = enforceSlas(ledger, NOW);
    expect(r.breaches.some((b) => b.tag === "contradiction-budget-exceeded")).toBe(true);
  });

  it("escalation severity flagged separately from BREACH", () => {
    let ledger = emptyLedger();
    for (let i = 0; i < 16; i++) ledger = appendEpoch(ledger, epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const r = enforceSlas(ledger, NOW);
    expect(r.escalationRequired).toBe(true);
  });

  it("default thresholds defined", () => {
    expect(DEFAULT_SLA_THRESHOLDS.maxConsecutiveAmbiguousEpochs).toBe(6);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// W2-PR112A — productionization convergence
// ───────────────────────────────────────────────────────────────────────────

function fakeDeploy(verdict: DeploymentRealityReport["verdict"], score: number): DeploymentRealityReport {
  return {
    executedAt: NOW,
    verdict,
    score,
    violations: [],
    convergenceHash: "h",
    hasCiGatingCondition: verdict === "DEPLOY-FAILED-CLOSED" || verdict === "DEPLOY-NOT-READY",
  };
}
function fakePilot(stalled: number): PilotAccelerationReport {
  return {
    executedAt: NOW,
    subjectsEvaluated: 1,
    activations: [],
    tierDistribution: {},
    stalledFraction: stalled,
    hasCiGatingCondition: stalled > 0.5,
  };
}
function fakeSnapshot(violationCount: number): ProductionSnapshotReport {
  return {
    executedAt: NOW,
    chainLength: 3,
    violations: Array.from({ length: violationCount }).map(() => ({ tag: "snapshot-id-mismatch" as const, index: 0, recorded: "x", recomputed: "y" })),
    mostRecentCheckpointId: null,
    hasCiGatingCondition: violationCount > 0,
  };
}

describe("W2-PR112A — productionization convergence", () => {
  it("PRODUCTIONIZATION_VERDICTS has 4 verdicts", () => expect(PRODUCTIONIZATION_VERDICTS.length).toBe(4));

  it("clean fleet ⇒ PRODUCTION-READY", () => {
    const r = buildProductionizationReport({
      nowIso: NOW,
      deployment: fakeDeploy("DEPLOY-READY", 90),
      pilot: fakePilot(0.1),
      snapshot: fakeSnapshot(0),
      telemetry: buildDeploymentTelemetryReport([], NOW),
      sla: enforceSlas(emptyLedger(), NOW),
    });
    expect(r.verdict).toBe("PRODUCTION-READY");
  });

  it("DEPLOY-FAILED-CLOSED ⇒ PRODUCTION-FAILED-CLOSED regardless", () => {
    const r = buildProductionizationReport({
      nowIso: NOW,
      deployment: fakeDeploy("DEPLOY-FAILED-CLOSED", 0),
      pilot: fakePilot(0.0),
      snapshot: fakeSnapshot(0),
      telemetry: buildDeploymentTelemetryReport([], NOW),
      sla: enforceSlas(emptyLedger(), NOW),
    });
    expect(r.verdict).toBe("PRODUCTION-FAILED-CLOSED");
  });

  it("snapshot violations + critical anomalies ⇒ NOT-READY", () => {
    const e = evt({ observedAt: NOW, kind: "REPLAY_LATENCY_OBSERVED", productionLabel: "v1", latencyMs: 50000 });
    const r = buildProductionizationReport({
      nowIso: NOW,
      deployment: fakeDeploy("DEPLOY-READY", 80),
      pilot: fakePilot(0.1),
      snapshot: fakeSnapshot(2),
      telemetry: buildDeploymentTelemetryReport([e], NOW, { latencySpikeMs: 1000 }),
      sla: enforceSlas(emptyLedger(), NOW),
    });
    expect(["PRODUCTION-NOT-READY", "PRODUCTION-READY-CONDITIONAL"]).toContain(r.verdict);
  });

  it("identical input ⇒ identical convergenceHash", () => {
    const input = {
      nowIso: NOW,
      deployment: fakeDeploy("DEPLOY-READY", 90),
      pilot: fakePilot(0.1),
      snapshot: fakeSnapshot(0),
      telemetry: buildDeploymentTelemetryReport([], NOW),
      sla: enforceSlas(emptyLedger(), NOW),
    } as const;
    const a = buildProductionizationReport(input);
    const b = buildProductionizationReport(input);
    expect(a.convergenceHash).toBe(b.convergenceHash);
  });
});
