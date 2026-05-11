/**
 * W2-PR162A — Constitutional Institutional Runtime Activation.
 *
 * Verification of runtime activation synthesis primitives:
 *   - pilot-acceleration: ACTIVATION_TIERS, deriveSubjectActivations, buildPilotAccelerationReport
 *   - productionization-convergence: PRODUCTIONIZATION_VERDICTS, buildProductionizationReport
 *   - recovery-drills: DRILL_OUTCOMES, executeRecoveryDrill, buildRecoveryDrillReport
 *
 * Doctrine: W2-PR86A (pilot acceleration), W2-PR112A (productionization convergence),
 *           W2-PR116A (recovery drills), W2-PR103A (production snapshots).
 */

import { describe, expect, it } from "vitest";

import {
  ACTIVATION_TIERS,
  deriveSubjectActivations,
  buildPilotAccelerationReport,
} from "../pilot-acceleration.js";

import {
  PRODUCTIONIZATION_VERDICTS,
  buildProductionizationReport,
} from "../productionization-convergence.js";

import {
  DRILL_OUTCOMES,
  executeRecoveryDrill,
  buildRecoveryDrillReport,
} from "../recovery-drills.js";

import {
  emptySnapshotChain,
  appendProductionSnapshot,
  buildProductionSnapshot,
  ROOT_PRODUCTION_PARENT,
} from "../production-snapshot.js";

import {
  emptySealedLedger,
  captureGovernanceSnapshot,
} from "../tamper-evident-persistence.js";

import type { PilotEvent } from "../pilot-intelligence.js";
import type { DeploymentRealityReport } from "../deployment-reality.js";
import type { PilotAccelerationReport } from "../pilot-acceleration.js";
import type { ProductionSnapshotReport } from "../production-snapshot.js";
import type { DeploymentTelemetryReport } from "../deployment-telemetry.js";
import type { SlaEnforcementReport } from "../sla-enforcement.js";
import type { SnapshotChain } from "../production-snapshot.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEvent(
  subjectId: string,
  observedAt: string,
  step: PilotEvent["step"],
  stepCompleted: boolean,
): PilotEvent {
  return { eventId: `${subjectId}-${step}`, subjectId, observedAt, step, stepCompleted };
}

function buildChainWithOneSnapshot(): { chain: SnapshotChain; snapshotId: string } {
  const sealed = emptySealedLedger();
  const govSnap = captureGovernanceSnapshot(sealed, "2026-05-10T00:00:00Z");
  const snap = buildProductionSnapshot({
    parentSnapshotId: ROOT_PRODUCTION_PARENT,
    capturedAt: "2026-05-10T00:00:00Z",
    productionLabel: "v1.0.0",
    restorationCheckpoint: true,
    governanceSnapshot: govSnap,
    sealed,
  });
  return { chain: appendProductionSnapshot(emptySnapshotChain(), snap), snapshotId: snap.snapshotId };
}

function mockDeploymentReport(overrides: Partial<DeploymentRealityReport> = {}): DeploymentRealityReport {
  return Object.freeze({
    executedAt: "2026-05-10T00:00:00Z",
    verdict: "DEPLOY-READY" as const,
    score: 90,
    violations: Object.freeze([]),
    convergenceHash: "aabb",
    hasCiGatingCondition: false,
    ...overrides,
  }) as DeploymentRealityReport;
}

function mockPilotReport(overrides: Partial<PilotAccelerationReport> = {}): PilotAccelerationReport {
  return Object.freeze({
    executedAt: "2026-05-10T00:00:00Z",
    subjectsEvaluated: 0,
    activations: Object.freeze([]),
    tierDistribution: Object.freeze({}),
    stalledFraction: 0,
    hasCiGatingCondition: false,
    ...overrides,
  }) as PilotAccelerationReport;
}

function mockSnapshotReport(overrides: Partial<ProductionSnapshotReport> = {}): ProductionSnapshotReport {
  return Object.freeze({
    executedAt: "2026-05-10T00:00:00Z",
    chainLength: 1,
    violations: Object.freeze([]),
    mostRecentCheckpointId: "snap-1",
    hasCiGatingCondition: false,
    ...overrides,
  }) as ProductionSnapshotReport;
}

function mockTelemetryReport(overrides: Partial<DeploymentTelemetryReport> = {}): DeploymentTelemetryReport {
  return Object.freeze({
    executedAt: "2026-05-10T00:00:00Z",
    eventsEvaluated: 0,
    violations: Object.freeze([]),
    anomalies: Object.freeze([]),
    hasCiGatingCondition: false,
    ...overrides,
  }) as DeploymentTelemetryReport;
}

function mockSlaReport(overrides: Partial<SlaEnforcementReport> = {}): SlaEnforcementReport {
  return Object.freeze({
    executedAt: "2026-05-10T00:00:00Z",
    windowEpochs: 0,
    thresholds: Object.freeze({
      maxReplayCollapsedFraction: 0.1,
      maxConsecutiveAmbiguousEpochs: 6,
      minConfidenceScore: 50,
      maxContradictionsPerWindow: 2,
    }),
    breaches: Object.freeze([]),
    escalationRequired: false,
    hasCiGatingCondition: false,
    ...overrides,
  }) as SlaEnforcementReport;
}

const NOW = "2026-05-10T00:00:00Z";

// ─── 1. ACTIVATION_TIERS vocabulary ──────────────────────────────────────────

describe("W2-PR162A — ACTIVATION_TIERS vocabulary", () => {
  it("contains exactly 5 tiers", () => {
    expect(ACTIVATION_TIERS).toHaveLength(5);
  });

  it("contains INSTANT", () => expect(ACTIVATION_TIERS).toContain("INSTANT"));
  it("contains FAST", () => expect(ACTIVATION_TIERS).toContain("FAST"));
  it("contains STANDARD", () => expect(ACTIVATION_TIERS).toContain("STANDARD"));
  it("contains SLOW", () => expect(ACTIVATION_TIERS).toContain("SLOW"));
  it("contains STALLED", () => expect(ACTIVATION_TIERS).toContain("STALLED"));
});

// ─── 2. deriveSubjectActivations — tier classification ────────────────────────

describe("W2-PR162A — deriveSubjectActivations: tier classification", () => {
  it("30s to activation → INSTANT tier", () => {
    const events: PilotEvent[] = [
      makeEvent("s1", "2026-01-01T00:00:00Z", "LANDING", true),
      makeEvent("s1", "2026-01-01T00:00:30Z", "PASSPORT_ACTIVATED", true),
    ];
    const activations = deriveSubjectActivations(events);
    expect(activations).toHaveLength(1);
    expect(activations[0]?.tier).toBe("INSTANT");
  });

  it("12 minutes to activation → FAST tier", () => {
    const base = new Date("2026-01-01T00:00:00Z").getTime();
    const events: PilotEvent[] = [
      makeEvent("s2", new Date(base).toISOString(), "LANDING", true),
      makeEvent("s2", new Date(base + 12 * 60 * 1000).toISOString(), "PASSPORT_ACTIVATED", true),
    ];
    const activations = deriveSubjectActivations(events);
    expect(activations[0]?.tier).toBe("FAST");
  });

  it("8 days to activation → STALLED tier (beyond 7-day threshold)", () => {
    const base = new Date("2026-01-01T00:00:00Z").getTime();
    const events: PilotEvent[] = [
      makeEvent("s3", new Date(base).toISOString(), "LANDING", true),
      makeEvent("s3", new Date(base + 8 * 24 * 60 * 60 * 1000).toISOString(), "PASSPORT_ACTIVATED", true),
    ];
    const activations = deriveSubjectActivations(events);
    expect(activations[0]?.tier).toBe("STALLED");
  });

  it("no PASSPORT_ACTIVATED event → STALLED tier with null timeToActivationMs", () => {
    const events: PilotEvent[] = [
      makeEvent("s4", "2026-01-01T00:00:00Z", "LANDING", true),
      makeEvent("s4", "2026-01-01T01:00:00Z", "SIGNUP_INITIATED", false),
    ];
    const activations = deriveSubjectActivations(events);
    expect(activations[0]?.tier).toBe("STALLED");
    expect(activations[0]?.timeToActivationMs).toBeNull();
  });

  it("stalledAtStep is set for first incomplete step", () => {
    const events: PilotEvent[] = [
      makeEvent("s5", "2026-01-01T00:00:00Z", "LANDING", true),
      makeEvent("s5", "2026-01-01T00:01:00Z", "SIGNUP_INITIATED", false),
    ];
    const activations = deriveSubjectActivations(events);
    expect(activations[0]?.stalledAtStep).toBe("SIGNUP_INITIATED");
  });

  it("returns frozen array", () => {
    const activations = deriveSubjectActivations([]);
    expect(Object.isFrozen(activations)).toBe(true);
  });

  it("returns empty array for no events", () => {
    expect(deriveSubjectActivations([])).toHaveLength(0);
  });
});

// ─── 3. buildPilotAccelerationReport — structure + CI gating ─────────────────

describe("W2-PR162A — buildPilotAccelerationReport", () => {
  it("executedAt is the passed ISO string", () => {
    const report = buildPilotAccelerationReport([], NOW);
    expect(report.executedAt).toBe(NOW);
  });

  it("empty events → 0 subjects, stalledFraction=0, no CI gate", () => {
    const report = buildPilotAccelerationReport([], NOW);
    expect(report.subjectsEvaluated).toBe(0);
    expect(report.stalledFraction).toBe(0);
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("stalledFraction > maxStalledFraction → hasCiGatingCondition=true", () => {
    // Create 2 stalled subjects (no PASSPORT_ACTIVATED) out of 2 total → fraction=1.0 > 0.5
    const events: PilotEvent[] = [
      makeEvent("sub1", "2026-01-01T00:00:00Z", "LANDING", true),
      makeEvent("sub1", "2026-01-01T01:00:00Z", "SIGNUP_INITIATED", false),
      makeEvent("sub2", "2026-01-01T00:00:00Z", "LANDING", true),
      makeEvent("sub2", "2026-01-01T01:00:00Z", "SIGNUP_INITIATED", false),
    ];
    const report = buildPilotAccelerationReport(events, NOW);
    expect(report.stalledFraction).toBe(1);
    expect(report.hasCiGatingCondition).toBe(true);
  });

  it("all INSTANT activations → hasCiGatingCondition=false", () => {
    const events: PilotEvent[] = [
      makeEvent("sub3", "2026-01-01T00:00:00Z", "LANDING", true),
      makeEvent("sub3", "2026-01-01T00:00:30Z", "PASSPORT_ACTIVATED", true),
    ];
    const report = buildPilotAccelerationReport(events, NOW);
    expect(report.hasCiGatingCondition).toBe(false);
    expect(report.tierDistribution["INSTANT"]).toBe(1);
  });

  it("report is frozen", () => {
    expect(Object.isFrozen(buildPilotAccelerationReport([], NOW))).toBe(true);
  });
});

// ─── 4. PRODUCTIONIZATION_VERDICTS vocabulary ─────────────────────────────────

describe("W2-PR162A — PRODUCTIONIZATION_VERDICTS vocabulary", () => {
  it("contains exactly 4 verdicts", () => {
    expect(PRODUCTIONIZATION_VERDICTS).toHaveLength(4);
  });

  it("contains PRODUCTION-READY", () => expect(PRODUCTIONIZATION_VERDICTS).toContain("PRODUCTION-READY"));
  it("contains PRODUCTION-READY-CONDITIONAL", () => expect(PRODUCTIONIZATION_VERDICTS).toContain("PRODUCTION-READY-CONDITIONAL"));
  it("contains PRODUCTION-NOT-READY", () => expect(PRODUCTIONIZATION_VERDICTS).toContain("PRODUCTION-NOT-READY"));
  it("contains PRODUCTION-FAILED-CLOSED", () => expect(PRODUCTIONIZATION_VERDICTS).toContain("PRODUCTION-FAILED-CLOSED"));
});

// ─── 5. buildProductionizationReport — verdicts ───────────────────────────────

describe("W2-PR162A — buildProductionizationReport: verdicts", () => {
  it("DEPLOY-FAILED-CLOSED propagates to PRODUCTION-FAILED-CLOSED", () => {
    const report = buildProductionizationReport({
      nowIso: NOW,
      deployment: mockDeploymentReport({ verdict: "DEPLOY-FAILED-CLOSED", score: 50 }),
      pilot: mockPilotReport(),
      snapshot: mockSnapshotReport(),
      telemetry: mockTelemetryReport(),
      sla: mockSlaReport(),
    });
    expect(report.verdict).toBe("PRODUCTION-FAILED-CLOSED");
  });

  it("DEPLOY-FAILED-CLOSED → hasCiGatingCondition=true", () => {
    const report = buildProductionizationReport({
      nowIso: NOW,
      deployment: mockDeploymentReport({ verdict: "DEPLOY-FAILED-CLOSED", score: 50 }),
      pilot: mockPilotReport(),
      snapshot: mockSnapshotReport(),
      telemetry: mockTelemetryReport(),
      sla: mockSlaReport(),
    });
    expect(report.hasCiGatingCondition).toBe(true);
  });

  it("all-clean inputs → PRODUCTION-READY verdict", () => {
    const report = buildProductionizationReport({
      nowIso: NOW,
      deployment: mockDeploymentReport({ verdict: "DEPLOY-READY", score: 90 }),
      pilot: mockPilotReport({ stalledFraction: 0 }),
      snapshot: mockSnapshotReport({ violations: Object.freeze([]) }),
      telemetry: mockTelemetryReport({ anomalies: Object.freeze([]) }),
      sla: mockSlaReport({ escalationRequired: false }),
    });
    expect(report.verdict).toBe("PRODUCTION-READY");
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("score is clamped to [0, 100]", () => {
    const report = buildProductionizationReport({
      nowIso: NOW,
      deployment: mockDeploymentReport({ verdict: "DEPLOY-NOT-READY", score: 10 }),
      pilot: mockPilotReport({ stalledFraction: 0.9 }),
      snapshot: mockSnapshotReport({ violations: Object.freeze([{ tag: "no-restoration-checkpoint" as const, chainLength: 5 }]) }),
      telemetry: mockTelemetryReport({
        anomalies: Object.freeze([{ tag: "rollout-failure-rate-high" as const, severity: 90, description: "high" }]),
      }),
      sla: mockSlaReport({ escalationRequired: true }),
    });
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("executedAt matches nowIso", () => {
    const report = buildProductionizationReport({
      nowIso: NOW,
      deployment: mockDeploymentReport(),
      pilot: mockPilotReport(),
      snapshot: mockSnapshotReport(),
      telemetry: mockTelemetryReport(),
      sla: mockSlaReport(),
    });
    expect(report.executedAt).toBe(NOW);
  });

  it("convergenceHash is a 64-char hex string", () => {
    const report = buildProductionizationReport({
      nowIso: NOW,
      deployment: mockDeploymentReport(),
      pilot: mockPilotReport(),
      snapshot: mockSnapshotReport(),
      telemetry: mockTelemetryReport(),
      sla: mockSlaReport(),
    });
    expect(report.convergenceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("report is frozen", () => {
    const report = buildProductionizationReport({
      nowIso: NOW,
      deployment: mockDeploymentReport(),
      pilot: mockPilotReport(),
      snapshot: mockSnapshotReport(),
      telemetry: mockTelemetryReport(),
      sla: mockSlaReport(),
    });
    expect(Object.isFrozen(report)).toBe(true);
  });
});

// ─── 6. DRILL_OUTCOMES vocabulary ────────────────────────────────────────────

describe("W2-PR162A — DRILL_OUTCOMES vocabulary", () => {
  it("contains exactly 4 outcomes", () => {
    expect(DRILL_OUTCOMES).toHaveLength(4);
  });

  it("contains PASS", () => expect(DRILL_OUTCOMES).toContain("PASS"));
  it("contains PASS-WITH-WARNINGS", () => expect(DRILL_OUTCOMES).toContain("PASS-WITH-WARNINGS"));
  it("contains FAIL", () => expect(DRILL_OUTCOMES).toContain("FAIL"));
  it("contains ABORTED", () => expect(DRILL_OUTCOMES).toContain("ABORTED"));
});

// ─── 7. executeRecoveryDrill — aborted path ───────────────────────────────────

describe("W2-PR162A — executeRecoveryDrill: aborted path", () => {
  const { chain, snapshotId } = buildChainWithOneSnapshot();

  const drill = executeRecoveryDrill({
    drillId: "drill-abort-1",
    executedAt: NOW,
    chain,
    targetSnapshotId: snapshotId,
    aborted: true,
  });

  it("aborted drill has ABORTED outcome", () => {
    expect(drill.outcome).toBe("ABORTED");
  });

  it("aborted drill emits 'drill aborted by operator' warning", () => {
    expect(drill.warnings).toContain("drill aborted by operator");
  });

  it("drillReceiptId is a 64-char hex string", () => {
    expect(drill.drillReceiptId).toMatch(/^[0-9a-f]{64}$/);
  });

  it("drill is frozen", () => {
    expect(Object.isFrozen(drill)).toBe(true);
  });

  it("warnings array is frozen", () => {
    expect(Object.isFrozen(drill.warnings)).toBe(true);
  });
});

// ─── 8. executeRecoveryDrill — non-aborted path ───────────────────────────────

describe("W2-PR162A — executeRecoveryDrill: non-aborted path", () => {
  const { chain, snapshotId } = buildChainWithOneSnapshot();

  const drill = executeRecoveryDrill({
    drillId: "drill-pass-1",
    executedAt: NOW,
    chain,
    targetSnapshotId: snapshotId,
    aborted: false,
  });

  it("non-aborted drill does not ABORTED outcome", () => {
    expect(drill.outcome).not.toBe("ABORTED");
  });

  it("non-aborted drill with no ambiguity erasure → PASS", () => {
    // Chain has 0 replayAmbiguous; target is the head → no ambiguity lost
    expect(drill.outcome).toBe("PASS");
  });

  it("drillId is preserved in the receipt", () => {
    expect(drill.drillId).toBe("drill-pass-1");
  });

  it("targetSnapshotId is preserved in the receipt", () => {
    expect(drill.targetSnapshotId).toBe(snapshotId);
  });

  it("drillReceiptId is a 64-char hex string", () => {
    expect(drill.drillReceiptId).toMatch(/^[0-9a-f]{64}$/);
  });

  it("drillReceiptId is deterministic for identical inputs", () => {
    const d2 = executeRecoveryDrill({
      drillId: "drill-pass-1",
      executedAt: NOW,
      chain,
      targetSnapshotId: snapshotId,
      aborted: false,
    });
    expect(drill.drillReceiptId).toBe(d2.drillReceiptId);
  });
});

// ─── 9. buildRecoveryDrillReport — structure + CI gating ─────────────────────

describe("W2-PR162A — buildRecoveryDrillReport", () => {
  const { chain, snapshotId } = buildChainWithOneSnapshot();

  it("executedAt is the passed ISO string", () => {
    const report = buildRecoveryDrillReport(chain, [], NOW);
    expect(report.executedAt).toBe(NOW);
  });

  it("empty drills → hasCiGatingCondition=false", () => {
    const report = buildRecoveryDrillReport(chain, [], NOW);
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("mostRecentCheckpointId is set when chain has a restoration checkpoint", () => {
    const report = buildRecoveryDrillReport(chain, [], NOW);
    expect(report.mostRecentCheckpointId).toBe(snapshotId);
  });

  it("mostRecentCheckpointId is null for empty chain", () => {
    const report = buildRecoveryDrillReport(emptySnapshotChain(), [], NOW);
    expect(report.mostRecentCheckpointId).toBeNull();
  });

  it("ABORTED drills count toward fail fraction → hasCiGatingCondition=true (default maxFail=0)", () => {
    const abortedDrill = executeRecoveryDrill({
      drillId: "d-abort",
      executedAt: NOW,
      chain,
      targetSnapshotId: snapshotId,
      aborted: true,
    });
    // Default maxFailFraction=0: any fail/abort triggers gating
    const report = buildRecoveryDrillReport(chain, [abortedDrill], NOW);
    expect(report.hasCiGatingCondition).toBe(true);
  });

  it("all-PASS drills → hasCiGatingCondition=false", () => {
    const passDrill = executeRecoveryDrill({
      drillId: "d-pass",
      executedAt: NOW,
      chain,
      targetSnapshotId: snapshotId,
    });
    const report = buildRecoveryDrillReport(chain, [passDrill], NOW);
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("outcomeDistribution reflects actual drill outcomes", () => {
    const passDrill = executeRecoveryDrill({
      drillId: "d-pass-2",
      executedAt: NOW,
      chain,
      targetSnapshotId: snapshotId,
    });
    const report = buildRecoveryDrillReport(chain, [passDrill], NOW);
    expect(report.outcomeDistribution["PASS"]).toBe(1);
  });

  it("report is frozen", () => {
    expect(Object.isFrozen(buildRecoveryDrillReport(chain, [], NOW))).toBe(true);
  });
});
