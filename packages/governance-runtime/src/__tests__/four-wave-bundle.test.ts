/**
 * Combined tests for W2-PR79A / 82A / 83A / 86A / 89A.
 * Each wave gets its own describe block; bundled here to keep the
 * test-file count manageable.
 */

import { describe, expect, it } from "vitest";
import {
  buildPmfReadinessReport,
  PMF_TIERS,
} from "../pmf-compression.js";
import {
  validateUxConsistency,
  type SurfaceObservation,
} from "../ux-consistency.js";
import {
  validateVerifierCognitiveSafety,
  SURFACE_MESSAGE_KINDS,
  type SurfaceMessage,
} from "../verifier-cognitive-safety.js";
import {
  ACTIVATION_TIERS,
  buildPilotAccelerationReport,
  deriveSubjectActivations,
} from "../pilot-acceleration.js";
import {
  buildExceptionGovernanceReport,
  computeExceptionReceiptId,
  EXCEPTION_LIFECYCLE,
  validateExceptionApplication,
  type ExceptionApplication,
} from "../exception-governance.js";
import type { PilotEvent } from "../pilot-intelligence.js";
import type { ConstitutionalConvergenceReport } from "../constitutional-convergence.js";
import type { PilotIntelligenceReport } from "../pilot-intelligence.js";
import type { VerifierWorkspaceReport } from "../verifier-workspace.js";

const NOW = "2026-05-09T00:00:00Z";

// ───────────────────────────────────────────────────────────────────────────
// W2-PR79A — UX consistency
// ───────────────────────────────────────────────────────────────────────────

describe("W2-PR79A — UX consistency layer", () => {
  function obs(o: Partial<SurfaceObservation> & { surfaceId: string }): SurfaceObservation {
    return {
      trajectory: "STABLE",
      replayConfidence: "FULL",
      ambiguityPreserved: true,
      headlineIndicatorCount: 3,
      ...o,
    };
  }

  it("consistent surfaces ⇒ no violations", () => {
    const r = validateUxConsistency([obs({ surfaceId: "a" }), obs({ surfaceId: "b" })], NOW);
    expect(r.violations).toEqual([]);
    expect(r.hasCiGatingCondition).toBe(false);
  });

  it("trajectory divergence is flagged", () => {
    const r = validateUxConsistency([
      obs({ surfaceId: "a", trajectory: "STABLE" }),
      obs({ surfaceId: "b", trajectory: "FAILING" }),
    ], NOW);
    expect(r.violations.some((v) => v.tag === "trajectory-divergence")).toBe(true);
  });

  it("replay-confidence divergence is flagged", () => {
    const r = validateUxConsistency([
      obs({ surfaceId: "a", replayConfidence: "FULL" }),
      obs({ surfaceId: "b", replayConfidence: "UNRECONSTRUCTABLE" }),
    ], NOW);
    expect(r.violations.some((v) => v.tag === "replay-confidence-divergence")).toBe(true);
  });

  it("ambiguity rendering divergence is flagged", () => {
    const r = validateUxConsistency([
      obs({ surfaceId: "a", ambiguityPreserved: true }),
      obs({ surfaceId: "b", ambiguityPreserved: false }),
    ], NOW);
    expect(r.violations.some((v) => v.tag === "ambiguity-rendering-divergence")).toBe(true);
  });

  it("headline overflow per surface flagged", () => {
    const r = validateUxConsistency([obs({ surfaceId: "a", headlineIndicatorCount: 12 })], NOW);
    expect(r.violations.some((v) => v.tag === "headline-overflow")).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// W2-PR82A — PMF compression
// ───────────────────────────────────────────────────────────────────────────

describe("W2-PR82A — PMF compression", () => {
  function fakeConvergence(verdict: ConstitutionalConvergenceReport["verdict"]): ConstitutionalConvergenceReport {
    return {
      executedAt: NOW,
      verdict,
      perWaveGating: {
        drift: false,
        replaySurvivability: false,
        persistence: false,
        durability: false,
        compression: false,
        kernel: false,
      },
      crossWaveViolations: [],
      convergenceHash: "test",
      hasCiGatingCondition: verdict !== "CONSTITUTIONALLY-COHERENT",
    };
  }
  function fakePilot(rate: number): PilotIntelligenceReport {
    return {
      executedAt: NOW,
      eventsEvaluated: 0,
      perStep: [],
      trustConversionRate: rate,
      replayBottleneckPerStep: {},
      findings: [],
      hasCiGatingCondition: false,
    };
  }
  function fakeWorkspace(p0: number): VerifierWorkspaceReport {
    return {
      executedAt: NOW,
      summary: {
        total: 0,
        perKind: {},
        perPriority: {},
        perState: {},
        oldestQueuedItemAt: null,
        p0WaitingCount: 0,
        ambiguityHoldCount: 0,
      },
      findings: Array.from({ length: p0 }).map((_, i) => ({ tag: "p0-aging" as const, itemId: `p0-${i}`, enqueuedAt: NOW })),
      hasCiGatingCondition: p0 > 0,
    };
  }

  it("PMF_TIERS has 4 tiers", () => expect(PMF_TIERS.length).toBe(4));

  it("FAILED-CLOSED constitutional ⇒ NOT-READY", () => {
    const r = buildPmfReadinessReport(fakeConvergence("FAILED-CLOSED"), fakePilot(0.5), fakeWorkspace(0), NOW);
    expect(r.tier).toBe("NOT-READY");
    expect(r.constitutionalBlock).toBe(true);
  });

  it("clean coherent + 60% trust + responsive verifiers ⇒ PILOT-READY or PRODUCTION-READY", () => {
    const r = buildPmfReadinessReport(fakeConvergence("CONSTITUTIONALLY-COHERENT"), fakePilot(0.6), fakeWorkspace(0), NOW);
    expect(["PILOT-READY", "PRODUCTION-READY"]).toContain(r.tier);
  });

  it("aging P0 reduces verifier responsiveness", () => {
    const r1 = buildPmfReadinessReport(fakeConvergence("CONSTITUTIONALLY-COHERENT"), fakePilot(0.5), fakeWorkspace(0), NOW);
    const r2 = buildPmfReadinessReport(fakeConvergence("CONSTITUTIONALLY-COHERENT"), fakePilot(0.5), fakeWorkspace(3), NOW);
    expect(r2.contributors.verifierResponsiveness).toBeLessThan(r1.contributors.verifierResponsiveness);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// W2-PR83A — Verifier cognitive safety
// ───────────────────────────────────────────────────────────────────────────

describe("W2-PR83A — verifier cognitive safety", () => {
  it("SURFACE_MESSAGE_KINDS has 5 kinds", () => expect(SURFACE_MESSAGE_KINDS.length).toBe(5));

  it("REPLAY_OBSERVATION rendered as denial is flagged", () => {
    const msg: SurfaceMessage = { id: "m1", kind: "REPLAY_OBSERVATION", text: "...", rendersAsDenial: true, rendersAsAmbiguous: false };
    const r = validateVerifierCognitiveSafety([msg], NOW);
    expect(r.violations.some((v) => v.tag === "replay-observation-rendered-as-denial")).toBe(true);
  });

  it("AMBIGUITY_NOTICE without ambiguity rendering flagged", () => {
    const msg: SurfaceMessage = { id: "m1", kind: "AMBIGUITY_NOTICE", text: "...", rendersAsDenial: false, rendersAsAmbiguous: false };
    const r = validateVerifierCognitiveSafety([msg], NOW);
    expect(r.violations.some((v) => v.tag === "ambiguity-notice-rendered-non-ambiguous")).toBe(true);
  });

  it("POLICY_DENIAL rendered as ambiguous flagged", () => {
    const msg: SurfaceMessage = { id: "m1", kind: "POLICY_DENIAL", text: "...", rendersAsDenial: true, rendersAsAmbiguous: true };
    const r = validateVerifierCognitiveSafety([msg], NOW);
    expect(r.violations.some((v) => v.tag === "policy-denial-rendered-ambiguous")).toBe(true);
  });

  it("CONFIDENCE_LABEL with overconfident text flagged", () => {
    const msg: SurfaceMessage = { id: "m1", kind: "CONFIDENCE_LABEL", text: "guaranteed", rendersAsDenial: false, rendersAsAmbiguous: false };
    const r = validateVerifierCognitiveSafety([msg], NOW);
    expect(r.violations.some((v) => v.tag === "confidence-label-overconfident")).toBe(true);
  });

  it("clean message set passes", () => {
    const msg: SurfaceMessage = { id: "m1", kind: "REPLAY_OBSERVATION", text: "replay observed", rendersAsDenial: false, rendersAsAmbiguous: false };
    const r = validateVerifierCognitiveSafety([msg], NOW);
    expect(r.hasCiGatingCondition).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// W2-PR86A — Pilot acceleration
// ───────────────────────────────────────────────────────────────────────────

describe("W2-PR86A — pilot acceleration", () => {
  function evt(o: Partial<PilotEvent> & { subjectId: string; observedAt: string; step: PilotEvent["step"] }): PilotEvent {
    return {
      eventId: "x",
      stepCompleted: true,
      abandonmentReason: null,
      ...o,
    };
  }

  it("ACTIVATION_TIERS has 5", () => expect(ACTIVATION_TIERS.length).toBe(5));

  it("activated within 10min ⇒ FAST tier", () => {
    const events: PilotEvent[] = [
      evt({ subjectId: "s", observedAt: "2026-05-09T00:00:00Z", step: "LANDING" }),
      evt({ subjectId: "s", observedAt: "2026-05-09T00:10:00Z", step: "PASSPORT_ACTIVATED" }),
    ];
    const a = deriveSubjectActivations(events);
    expect(a[0]!.tier).toBe("FAST");
  });

  it("never-activated ⇒ STALLED", () => {
    const events: PilotEvent[] = [evt({ subjectId: "s", observedAt: "2026-05-09T00:00:00Z", step: "LANDING" })];
    const a = deriveSubjectActivations(events);
    expect(a[0]!.tier).toBe("STALLED");
  });

  it("CHAOS: 80% stalled ⇒ CI gate fires (default 50% threshold)", () => {
    const events: PilotEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push(evt({ subjectId: `s-${i}`, observedAt: "2026-05-09T00:00:00Z", step: "LANDING" }));
      if (i < 2) events.push(evt({ subjectId: `s-${i}`, observedAt: "2026-05-09T00:10:00Z", step: "PASSPORT_ACTIVATED" }));
    }
    const r = buildPilotAccelerationReport(events, NOW);
    expect(r.stalledFraction).toBeGreaterThan(0.5);
    expect(r.hasCiGatingCondition).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// W2-PR89A — Exception governance
// ───────────────────────────────────────────────────────────────────────────

describe("W2-PR89A — exception governance", () => {
  function exc(o: Partial<ExceptionApplication> = {}): ExceptionApplication {
    const base = {
      proposingActor: "operator:on-call",
      proposedAt: NOW,
      justification: "incident#42 — narrow scope",
      impactedReplayState: false,
      impactedAmbiguityState: false,
    };
    return {
      applicationId: "exc-001",
      reviewingActor: null,
      approvingActor: null,
      state: "PROPOSED",
      closingReason: null,
      applicationReceiptId: computeExceptionReceiptId(base),
      ...base,
      ...o,
    };
  }

  it("EXCEPTION_LIFECYCLE has 6 states", () => expect(EXCEPTION_LIFECYCLE.length).toBe(6));

  it("clean PROPOSED app passes", () => expect(validateExceptionApplication(exc())).toEqual([]));

  it("APPROVED without reviewer is flagged", () => {
    const a = exc({ state: "APPROVED" });
    const v = validateExceptionApplication(a);
    expect(v.some((x) => x.tag === "approved-without-reviewer")).toBe(true);
  });

  it("APPLIED without approver is flagged", () => {
    const a = exc({ state: "APPLIED", reviewingActor: "x" });
    const v = validateExceptionApplication(a);
    expect(v.some((x) => x.tag === "applied-without-approver")).toBe(true);
  });

  it("REJECTED without reason is flagged", () => {
    const a = exc({ state: "REJECTED" });
    const v = validateExceptionApplication(a);
    expect(v.some((x) => x.tag === "closed-without-reason")).toBe(true);
  });

  it("receipt id tampered flagged", () => {
    const a = exc({ applicationReceiptId: "wrong" });
    const v = validateExceptionApplication(a);
    expect(v.some((x) => x.tag === "receipt-id-mismatch")).toBe(true);
  });

  it("CHAOS: bulk report surfaces all violations", () => {
    const apps = [exc({ state: "APPROVED" }), exc({ applicationId: "exc-2", state: "REJECTED" })];
    const r = buildExceptionGovernanceReport(apps, NOW);
    expect(r.hasCiGatingCondition).toBe(true);
    expect(r.violations.length).toBeGreaterThanOrEqual(2);
  });
});
