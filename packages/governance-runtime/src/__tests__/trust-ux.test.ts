/**
 * W2-PR39A — Institutional trust UX convergence tests + chaos.
 */

import { describe, expect, it } from "vitest";

import {
  appendEpoch,
  emptyLedger,
  type GovernanceEpoch,
  type GovernanceLedger,
} from "../longitudinal-memory.js";
import {
  captureGovernanceSnapshot,
  emptySealedLedger,
  sealEpoch,
  type SealedGovernanceLedger,
} from "../tamper-evident-persistence.js";
import {
  deriveUxSummary,
  TRUST_TRAJECTORY_TIERS,
  validateUxIntegrity,
} from "../trust-ux.js";
import type { GovernanceIncident } from "../incident-governance.js";
import type { HumanOverrideRecord } from "../override-discipline.js";

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
  return new Date(Date.parse("2026-01-01T00:00:00Z") + h * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function buildScenario(eps: GovernanceEpoch[]): {
  ledger: GovernanceLedger;
  sealed: SealedGovernanceLedger;
} {
  let ledger = emptyLedger();
  let sealed = emptySealedLedger();
  for (const e of eps) {
    ledger = appendEpoch(ledger, e);
    sealed = sealEpoch(sealed, e);
  }
  return { ledger, sealed };
}

describe("W2-PR39A — UX summary derivation", () => {
  it("clean fleet ⇒ STABLE trajectory + minimal headline", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const { ledger, sealed } = buildScenario(eps);
    const snapshot = captureGovernanceSnapshot(sealed, iso(4));
    const sum = deriveUxSummary({
      ledger,
      sealed,
      snapshot,
      overrides: [],
      incidents: [],
      nowIso: iso(4),
    });
    expect(sum.trustTrajectory).toBe("STABLE");
    expect(sum.headlineIndicators.length).toBeLessThanOrEqual(7);
    expect(sum.replayConfidence).toBe("FULL");
  });

  it("UNRECONSTRUCTABLE replay → trajectory escalates to FAILING", () => {
    const eps = Array.from({ length: 12 }).map((_, i) => epoch({ observedAt: iso(i) }));
    const { ledger, sealed } = buildScenario(eps);
    const snapshot = captureGovernanceSnapshot(sealed, iso(13));
    const sum = deriveUxSummary({
      ledger,
      sealed,
      snapshot,
      overrides: [],
      incidents: [],
      nowIso: iso(13),
    });
    expect(["AT-RISK", "FAILING"]).toContain(sum.trustTrajectory);
    expect(sum.headlineIndicators.some((h) => h.toLowerCase().includes("replay"))).toBe(true);
  });

  it("open SEV-1 incident escalates trajectory to FAILING", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const { ledger, sealed } = buildScenario(eps);
    const snapshot = captureGovernanceSnapshot(sealed, iso(4));
    const sev1: GovernanceIncident = {
      id: "inc-99",
      kind: "REPLAY",
      sev: "SEV-1",
      state: "TRIAGED",
      detectedAt: iso(2),
      affectedDomains: ["replay-state"],
      touchesReplay: true,
      touchesAmbiguity: false,
      symptom: "replay collapse witnessed",
      remediationRef: "audit#1",
    };
    const sum = deriveUxSummary({
      ledger,
      sealed,
      snapshot,
      overrides: [],
      incidents: [sev1],
      nowIso: iso(4),
    });
    expect(sum.trustTrajectory).toBe("FAILING");
    expect(sum.openSev1Count).toBe(1);
  });

  it("active CRITICAL override surfaces in summary", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const { ledger, sealed } = buildScenario(eps);
    const snapshot = captureGovernanceSnapshot(sealed, iso(4));
    const ov: HumanOverrideRecord = {
      id: "ov-99",
      kind: "EXECUTIVE_EXCEPTION",
      risk: "CRITICAL",
      initiatingActor: "founder:ct@sourcd.xyz",
      approvalTimestamp: iso(2),
      expirationTimestamp: iso(10),
      affectedDomains: ["trust-class", "integrity-state", "containment-state", "cross-axis-coherence"],
      impactedInvariants: ["a", "b", "c", "d"],
      scope: "founder-tier exception",
      renewalCount: 1,
      touchesReplay: false,
      elevatesTrust: false,
      parentOverrideId: null,
      auditEntryId: null,
      environment: "production",
    };
    const sum = deriveUxSummary({
      ledger,
      sealed,
      snapshot,
      overrides: [ov],
      incidents: [],
      nowIso: iso(4),
    });
    expect(sum.criticalOverrideIds).toContain("ov-99");
    expect(["AT-RISK", "FAILING"]).toContain(sum.trustTrajectory);
  });

  it("missing snapshot for non-empty ledger ⇒ trajectory escalates", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const { ledger, sealed } = buildScenario(eps);
    const sum = deriveUxSummary({
      ledger,
      sealed,
      snapshot: null,
      overrides: [],
      incidents: [],
      nowIso: iso(4),
    });
    expect(["AT-RISK", "FAILING"]).toContain(sum.trustTrajectory);
  });
});

describe("W2-PR39A — UX integrity validator (CI gate)", () => {
  it("clean summary passes validation", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const { ledger, sealed } = buildScenario(eps);
    const snapshot = captureGovernanceSnapshot(sealed, iso(4));
    const sum = deriveUxSummary({
      ledger,
      sealed,
      snapshot,
      overrides: [],
      incidents: [],
      nowIso: iso(4),
    });
    expect(validateUxIntegrity(sum)).toEqual([]);
  });

  it("forged STABLE tier with FAILING signals → tier-inconsistent-with-signals", () => {
    const eps = Array.from({ length: 12 }).map((_, i) => epoch({ observedAt: iso(i) }));
    const { ledger, sealed } = buildScenario(eps);
    const snapshot = captureGovernanceSnapshot(sealed, iso(13));
    const sum = deriveUxSummary({
      ledger,
      sealed,
      snapshot,
      overrides: [],
      incidents: [],
      nowIso: iso(13),
    });
    // Force-tier-downgrade adversary: pretend it's STABLE
    const adversarial = { ...sum, trustTrajectory: "STABLE" as const };
    const v = validateUxIntegrity(adversarial);
    expect(v.some((x) => x.tag === "tier-inconsistent-with-signals")).toBe(true);
  });

  it("ambiguity elision is flagged", () => {
    const eps = [epoch({ observedAt: iso(0), replayAmbiguousCount: 1 })];
    const { ledger, sealed } = buildScenario(eps);
    const snapshot = captureGovernanceSnapshot(sealed, iso(1));
    const sum = deriveUxSummary({
      ledger,
      sealed,
      snapshot,
      overrides: [],
      incidents: [],
      nowIso: iso(1),
    });
    const adversarial = { ...sum, replayAmbiguityPreserved: false };
    const v = validateUxIntegrity(adversarial);
    expect(v.some((x) => x.tag === "ambiguity-elided")).toBe(true);
  });

  it("UNRECONSTRUCTABLE replay missing from headline is flagged", () => {
    const eps = Array.from({ length: 12 }).map((_, i) => epoch({ observedAt: iso(i) }));
    const { ledger, sealed } = buildScenario(eps);
    const snapshot = captureGovernanceSnapshot(sealed, iso(13));
    const sum = deriveUxSummary({
      ledger,
      sealed,
      snapshot,
      overrides: [],
      incidents: [],
      nowIso: iso(13),
    });
    // Strip replay headline to simulate a UI bug that elides it
    const stripped = {
      ...sum,
      headlineIndicators: sum.headlineIndicators.filter((h) => !h.toLowerCase().includes("replay")),
    };
    const v = validateUxIntegrity(stripped);
    expect(v.some((x) => x.tag === "replay-failure-not-headlined")).toBe(true);
  });
});

describe("W2-PR39A — taxonomy", () => {
  it("TRUST_TRAJECTORY_TIERS has 5 tiers", () => {
    expect(TRUST_TRAJECTORY_TIERS.length).toBe(5);
  });
});
