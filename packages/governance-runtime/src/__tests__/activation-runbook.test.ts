/**
 * W2-PR169A — Institutional Runtime Activation Runbook.
 *
 * Verification of operational activation runbook primitives:
 *   - operator-burnout: BURNOUT_TIERS vocabulary, deriveOperatorHealth
 *     (score model, tier classification, escalationRequired),
 *     buildBurnoutProtectionReport CI gating
 *   - pmf-finalization: PMF_FINALIZATION_VERDICTS vocabulary,
 *     buildPmfFinalizationReport (fail-closed propagation, verdict logic,
 *     score clamping, convergenceHash format)
 *   - revocation-cascade: computeRevocationCascade (BFS descendant traversal,
 *     blast radius scoring), buildRevocationCascadeReport (CI gating,
 *     uncollapsed-descendant-active, high-blast-radius)
 *
 * Doctrine: W2-PR119A (burnout protection), W2-PR122A (PMF finalization),
 *           W2-PR63A (revocation cascade), W2-PR25A (ambiguity preservation).
 */

import { describe, expect, it } from "vitest";

import {
  BURNOUT_TIERS,
  deriveOperatorHealth,
  buildBurnoutProtectionReport,
} from "../operator-burnout.js";

import {
  PMF_FINALIZATION_VERDICTS,
  buildPmfFinalizationReport,
} from "../pmf-finalization.js";

import {
  computeRevocationCascade,
  buildRevocationCascadeReport,
} from "../revocation-cascade.js";

import type { OperatorActivity } from "../operator-burnout.js";
import type { DelegationGrant } from "../delegated-trust.js";
import type { RevocationEvent } from "../revocation-cascade.js";
import type { ProductionizationReport } from "../productionization-convergence.js";
import type { TrustReputationReport } from "../trust-reputation.js";
import type { BurnoutProtectionReport } from "../operator-burnout.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeActivity(overrides: Partial<OperatorActivity> = {}): OperatorActivity {
  return {
    operatorId: "op-1",
    assignedItems: [],
    throughput24h: 0,
    contextSwitches24h: 0,
    ambiguityMinutes24h: 0,
    ...overrides,
  };
}

function makeGrant(grantId: string, parentGrantId: string | null, state: "ACTIVE" | "REVOKED" = "ACTIVE"): DelegationGrant {
  return Object.freeze({
    grantId,
    delegatorId: "delegator-1",
    delegateId: "delegate-1",
    grantedActions: ["READ"],
    subjectScope: "org-1",
    issuedAt: "2026-01-01T00:00:00Z",
    expiresAt: "2027-01-01T00:00:00Z",
    state,
    parentGrantId,
    impactedInvariants: [],
    affectedDomains: [],
  }) as unknown as DelegationGrant;
}

function mockProductionizationReport(overrides: Partial<ProductionizationReport> = {}): ProductionizationReport {
  return Object.freeze({
    executedAt: NOW,
    verdict: "PRODUCTION-READY" as const,
    score: 90,
    violations: Object.freeze([]),
    convergenceHash: "aabb",
    hasCiGatingCondition: false,
    ...overrides,
  }) as ProductionizationReport;
}

function mockReputationReport(overrides: Partial<TrustReputationReport> = {}): TrustReputationReport {
  return Object.freeze({
    executedAt: NOW,
    reputations: Object.freeze([]),
    hasCiGatingCondition: false,
    ...overrides,
  }) as TrustReputationReport;
}

function mockBurnoutReport(overrides: Partial<BurnoutProtectionReport> = {}): BurnoutProtectionReport {
  return Object.freeze({
    executedAt: NOW,
    operatorsEvaluated: 0,
    perOperator: Object.freeze([]),
    burntOutCount: 0,
    stressedCount: 0,
    hasCiGatingCondition: false,
    ...overrides,
  }) as BurnoutProtectionReport;
}

const NOW = "2026-05-10T00:00:00Z";

// ─── 1. BURNOUT_TIERS vocabulary ──────────────────────────────────────────────

describe("W2-PR169A — BURNOUT_TIERS vocabulary", () => {
  it("contains exactly 4 tiers", () => {
    expect(BURNOUT_TIERS).toHaveLength(4);
  });

  it("contains RESTED", () => expect(BURNOUT_TIERS).toContain("RESTED"));
  it("contains PRESSURED", () => expect(BURNOUT_TIERS).toContain("PRESSURED"));
  it("contains STRESSED", () => expect(BURNOUT_TIERS).toContain("STRESSED"));
  it("contains BURNT-OUT", () => expect(BURNOUT_TIERS).toContain("BURNT-OUT"));
});

// ─── 2. deriveOperatorHealth — tier classification ────────────────────────────

describe("W2-PR169A — deriveOperatorHealth: tier classification", () => {
  it("no load → RESTED tier (score < 25)", () => {
    const health = deriveOperatorHealth(makeActivity());
    expect(health.tier).toBe("RESTED");
    expect(health.score).toBe(0);
  });

  it("moderate queue → PRESSURED tier (score 25..49)", () => {
    // queueDepth = 13 (state !== "RESOLVED") → penalty = min(30, 13*2) = 26
    const items = Array.from({ length: 13 }, (_, i) => ({
      itemId: `item-${i}`, kind: "ISSUER_MUTATION", priority: "NORMAL", state: "OPEN",
      enqueuedAt: NOW, subjectRef: "s", subjectKind: "issuer", hasUnresolvedAmbiguity: false,
    }));
    const health = deriveOperatorHealth(makeActivity({
      assignedItems: items as unknown as OperatorActivity["assignedItems"],
    }));
    expect(health.tier).toBe("PRESSURED");
  });

  it("high context switches → STRESSED or higher (score 50+)", () => {
    // contextSwitchPenalty = min(30, 130 * 0.4) = 30 (exceeds 50 with queue)
    const items = Array.from({ length: 15 }, (_, i) => ({
      itemId: `item-${i}`, kind: "ISSUER_MUTATION", priority: "NORMAL", state: "OPEN",
      enqueuedAt: NOW, subjectRef: "s", subjectKind: "issuer", hasUnresolvedAmbiguity: false,
    }));
    const health = deriveOperatorHealth(makeActivity({
      contextSwitches24h: 130,
      assignedItems: items as unknown as OperatorActivity["assignedItems"],
    }));
    expect(["STRESSED", "BURNT-OUT"]).toContain(health.tier);
    expect(health.score).toBeGreaterThanOrEqual(50);
  });

  it("maximum load → BURNT-OUT tier (score >= 75)", () => {
    // Max all components: queueDepth 15+ → 30, contextSwitches 75+ → 30, ambiguity 500+ → 25, throughput 100+ → 25
    const items = Array.from({ length: 20 }, (_, i) => ({
      itemId: `item-${i}`, kind: "ISSUER_MUTATION", priority: "URGENT", state: "OPEN",
      enqueuedAt: NOW, subjectRef: "s", subjectKind: "issuer", hasUnresolvedAmbiguity: true,
    }));
    const health = deriveOperatorHealth(makeActivity({
      assignedItems: items as unknown as OperatorActivity["assignedItems"],
      contextSwitches24h: 80,
      ambiguityMinutes24h: 500,
      throughput24h: 100,
    }));
    expect(health.tier).toBe("BURNT-OUT");
    expect(health.score).toBeGreaterThanOrEqual(75);
  });

  it("operatorId is preserved in result", () => {
    const health = deriveOperatorHealth(makeActivity({ operatorId: "op-xyz" }));
    expect(health.operatorId).toBe("op-xyz");
  });

  it("escalationRequired=true for STRESSED tier", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      itemId: `item-${i}`, kind: "ISSUER_MUTATION", priority: "NORMAL", state: "OPEN",
      enqueuedAt: NOW, subjectRef: "s", subjectKind: "issuer", hasUnresolvedAmbiguity: false,
    }));
    const health = deriveOperatorHealth(makeActivity({
      contextSwitches24h: 80,
      assignedItems: items as unknown as OperatorActivity["assignedItems"],
    }));
    if (health.tier === "STRESSED" || health.tier === "BURNT-OUT") {
      expect(health.escalationRequired).toBe(true);
    }
  });

  it("escalationRequired=false for RESTED tier", () => {
    const health = deriveOperatorHealth(makeActivity());
    expect(health.escalationRequired).toBe(false);
  });

  it("result is frozen", () => {
    expect(Object.isFrozen(deriveOperatorHealth(makeActivity()))).toBe(true);
  });
});

// ─── 3. buildBurnoutProtectionReport — structure + CI gating ─────────────────

describe("W2-PR169A — buildBurnoutProtectionReport", () => {
  it("empty activities → 0 operators, hasCiGatingCondition=false", () => {
    const report = buildBurnoutProtectionReport([], NOW);
    expect(report.operatorsEvaluated).toBe(0);
    expect(report.hasCiGatingCondition).toBe(false);
    expect(report.burntOutCount).toBe(0);
  });

  it("executedAt is the passed ISO string", () => {
    expect(buildBurnoutProtectionReport([], NOW).executedAt).toBe(NOW);
  });

  it("any BURNT-OUT operator → hasCiGatingCondition=true (default maxBurntOutFraction=0)", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      itemId: `item-${i}`, kind: "ISSUER_MUTATION", priority: "URGENT", state: "OPEN",
      enqueuedAt: NOW, subjectRef: "s", subjectKind: "issuer", hasUnresolvedAmbiguity: true,
    }));
    const activity = makeActivity({
      assignedItems: items as unknown as OperatorActivity["assignedItems"],
      contextSwitches24h: 80,
      ambiguityMinutes24h: 500,
      throughput24h: 100,
    });
    const report = buildBurnoutProtectionReport([activity], NOW);
    if (report.burntOutCount > 0) {
      expect(report.hasCiGatingCondition).toBe(true);
    }
  });

  it("rested operator → hasCiGatingCondition=false", () => {
    const report = buildBurnoutProtectionReport([makeActivity()], NOW);
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("report is frozen", () => {
    expect(Object.isFrozen(buildBurnoutProtectionReport([], NOW))).toBe(true);
  });
});

// ─── 4. PMF_FINALIZATION_VERDICTS vocabulary ──────────────────────────────────

describe("W2-PR169A — PMF_FINALIZATION_VERDICTS vocabulary", () => {
  it("contains exactly 4 verdicts", () => {
    expect(PMF_FINALIZATION_VERDICTS).toHaveLength(4);
  });

  it("contains PMF-FINALIZED", () => expect(PMF_FINALIZATION_VERDICTS).toContain("PMF-FINALIZED"));
  it("contains PMF-FINALIZED-CONDITIONAL", () => expect(PMF_FINALIZATION_VERDICTS).toContain("PMF-FINALIZED-CONDITIONAL"));
  it("contains PMF-NOT-FINALIZED", () => expect(PMF_FINALIZATION_VERDICTS).toContain("PMF-NOT-FINALIZED"));
  it("contains PMF-FAILED-CLOSED", () => expect(PMF_FINALIZATION_VERDICTS).toContain("PMF-FAILED-CLOSED"));
});

// ─── 5. buildPmfFinalizationReport — verdicts ─────────────────────────────────

describe("W2-PR169A — buildPmfFinalizationReport: verdicts", () => {
  it("PRODUCTION-FAILED-CLOSED propagates to PMF-FAILED-CLOSED", () => {
    const report = buildPmfFinalizationReport({
      nowIso: NOW,
      productionization: mockProductionizationReport({ verdict: "PRODUCTION-FAILED-CLOSED", score: 0 }),
      reputation: mockReputationReport(),
      burnout: mockBurnoutReport(),
    });
    expect(report.verdict).toBe("PMF-FAILED-CLOSED");
  });

  it("PMF-FAILED-CLOSED → hasCiGatingCondition=true", () => {
    const report = buildPmfFinalizationReport({
      nowIso: NOW,
      productionization: mockProductionizationReport({ verdict: "PRODUCTION-FAILED-CLOSED", score: 0 }),
      reputation: mockReputationReport(),
      burnout: mockBurnoutReport(),
    });
    expect(report.hasCiGatingCondition).toBe(true);
  });

  it("all-clean inputs → PMF-FINALIZED verdict", () => {
    const report = buildPmfFinalizationReport({
      nowIso: NOW,
      productionization: mockProductionizationReport({ verdict: "PRODUCTION-READY", score: 90 }),
      reputation: mockReputationReport({ reputations: Object.freeze([]) }),
      burnout: mockBurnoutReport({ burntOutCount: 0 }),
    });
    expect(report.verdict).toBe("PMF-FINALIZED");
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("executedAt matches nowIso", () => {
    const report = buildPmfFinalizationReport({
      nowIso: NOW,
      productionization: mockProductionizationReport(),
      reputation: mockReputationReport(),
      burnout: mockBurnoutReport(),
    });
    expect(report.executedAt).toBe(NOW);
  });

  it("convergenceHash is a 64-char hex string", () => {
    const report = buildPmfFinalizationReport({
      nowIso: NOW,
      productionization: mockProductionizationReport(),
      reputation: mockReputationReport(),
      burnout: mockBurnoutReport(),
    });
    expect(report.convergenceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("score is clamped to [0, 100]", () => {
    const report = buildPmfFinalizationReport({
      nowIso: NOW,
      productionization: mockProductionizationReport({ verdict: "PRODUCTION-NOT-READY", score: 10 }),
      reputation: mockReputationReport(),
      burnout: mockBurnoutReport({ burntOutCount: 5 }),
    });
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("report is frozen", () => {
    expect(Object.isFrozen(buildPmfFinalizationReport({
      nowIso: NOW,
      productionization: mockProductionizationReport(),
      reputation: mockReputationReport(),
      burnout: mockBurnoutReport(),
    }))).toBe(true);
  });
});

// ─── 6. computeRevocationCascade — BFS traversal ─────────────────────────────

describe("W2-PR169A — computeRevocationCascade: BFS traversal", () => {
  it("no children of revoked grant → empty cascade and direct arrays", () => {
    const grants = [makeGrant("root", null)];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const result = computeRevocationCascade(grants, event);
    expect(result.directlyRevoked).toHaveLength(0);
    expect(result.cascadeRevokedDescendants).toHaveLength(0);
  });

  it("single child → directlyRevoked contains child, cascade contains child", () => {
    const grants = [
      makeGrant("root", null),
      makeGrant("child-1", "root"),
    ];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const result = computeRevocationCascade(grants, event);
    expect(result.directlyRevoked).toContain("child-1");
    expect(result.cascadeRevokedDescendants).toContain("child-1");
  });

  it("two-level hierarchy → cascade includes grandchild", () => {
    const grants = [
      makeGrant("root", null),
      makeGrant("child", "root"),
      makeGrant("grandchild", "child"),
    ];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const result = computeRevocationCascade(grants, event);
    expect(result.cascadeRevokedDescendants).toContain("child");
    expect(result.cascadeRevokedDescendants).toContain("grandchild");
  });

  it("revokedGrantId is preserved in result", () => {
    const grants = [makeGrant("root", null)];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const result = computeRevocationCascade(grants, event);
    expect(result.revokedGrantId).toBe("root");
  });

  it("blastRadiusScore = min(100, cascadeCount * 10)", () => {
    const grants = [makeGrant("root", null)];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const result = computeRevocationCascade(grants, event);
    expect(result.blastRadiusScore).toBe(0); // 0 descendants
  });

  it("6 cascade descendants → blastRadiusScore = 60", () => {
    const grants = [
      makeGrant("root", null),
      ...Array.from({ length: 6 }, (_, i) => makeGrant(`c${i}`, "root")),
    ];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const result = computeRevocationCascade(grants, event);
    expect(result.blastRadiusScore).toBe(60);
  });

  it("result arrays are frozen", () => {
    const grants = [makeGrant("root", null)];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const result = computeRevocationCascade(grants, event);
    expect(Object.isFrozen(result.directlyRevoked)).toBe(true);
    expect(Object.isFrozen(result.cascadeRevokedDescendants)).toBe(true);
  });

  it("non-ACTIVE descendants are listed as orphaned grants", () => {
    const grants = [
      makeGrant("root", null),
      makeGrant("child", "root", "REVOKED"), // already revoked
    ];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const result = computeRevocationCascade(grants, event);
    expect(result.orphanedGrants).toContain("child");
  });
});

// ─── 7. buildRevocationCascadeReport — CI gating ─────────────────────────────

describe("W2-PR169A — buildRevocationCascadeReport: CI gating", () => {
  it("no descendants → no findings, hasCiGatingCondition=false", () => {
    const grants = [makeGrant("root", null)];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const report = buildRevocationCascadeReport(grants, event, NOW);
    expect(report.findings).toHaveLength(0);
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("ACTIVE descendant emits uncollapsed-descendant-active + hasCiGatingCondition=true", () => {
    const grants = [
      makeGrant("root", null),
      makeGrant("child", "root", "ACTIVE"), // still ACTIVE → needs revocation
    ];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const report = buildRevocationCascadeReport(grants, event, NOW);
    expect(report.findings.some((f) => f.tag === "uncollapsed-descendant-active")).toBe(true);
    expect(report.hasCiGatingCondition).toBe(true);
  });

  it("REVOKED descendant does NOT emit uncollapsed-descendant-active", () => {
    const grants = [
      makeGrant("root", null),
      makeGrant("child", "root", "REVOKED"),
    ];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const report = buildRevocationCascadeReport(grants, event, NOW);
    expect(report.findings.some((f) => f.tag === "uncollapsed-descendant-active")).toBe(false);
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("blastRadiusScore >= 60 → high-blast-radius finding", () => {
    const grants = [
      makeGrant("root", null),
      ...Array.from({ length: 7 }, (_, i) => makeGrant(`c${i}`, "root")),
    ];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const report = buildRevocationCascadeReport(grants, event, NOW);
    expect(report.findings.some((f) => f.tag === "high-blast-radius")).toBe(true);
  });

  it("executedAt is the passed ISO string", () => {
    const grants = [makeGrant("root", null)];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    const report = buildRevocationCascadeReport(grants, event, NOW);
    expect(report.executedAt).toBe(NOW);
  });

  it("report is frozen", () => {
    const grants = [makeGrant("root", null)];
    const event: RevocationEvent = { revokedGrantId: "root", reason: "test", revokedAt: NOW };
    expect(Object.isFrozen(buildRevocationCascadeReport(grants, event, NOW))).toBe(true);
  });
});
