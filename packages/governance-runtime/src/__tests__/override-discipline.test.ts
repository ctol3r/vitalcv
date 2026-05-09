/**
 * W2-PR29A — Human override integrity tests + human-stress chaos simulations.
 */

import { describe, expect, it } from "vitest";

import {
  HUMAN_OVERRIDE_KINDS,
  OVERRIDE_RISK_LEVELS,
  buildOverrideDisciplineReport,
  computeOverrideBlastRadius,
  computeOverrideDecay,
  detectRecursiveOverrideChains,
  getOverrideKindProfile,
  MAX_HUMAN_OVERRIDE_RENEWALS,
  OVERRIDE_DECAY_STATES,
  parseHumanOverrideKind,
  type HumanOverrideRecord,
  validateHumanOverride,
} from "../override-discipline.js";

const ISO = (s: string) => s;

function baseRecord(overrides: Partial<HumanOverrideRecord> = {}): HumanOverrideRecord {
  return {
    id: "ov-001",
    kind: "INCIDENT_RESPONSE",
    risk: "HIGH",
    initiatingActor: "founder:ct@sourcd.xyz",
    approvalTimestamp: "2026-05-09T00:00:00Z",
    expirationTimestamp: "2026-05-09T12:00:00Z",
    affectedDomains: ["containment-state"],
    impactedInvariants: ["containment-degraded-allowed-recovery"],
    scope: "incident#42 — narrow path",
    renewalCount: 0,
    touchesReplay: false,
    elevatesTrust: false,
    parentOverrideId: null,
    auditEntryId: null,
    environment: "production",
    ...overrides,
  };
}

describe("W2-PR29A taxonomy + parsing", () => {
  it("exposes all 7 canonical kinds with frozen profiles", () => {
    expect(HUMAN_OVERRIDE_KINDS.length).toBe(7);
    for (const k of HUMAN_OVERRIDE_KINDS) {
      const p = getOverrideKindProfile(k);
      expect(p.kind).toBe(k);
      expect(p.maxDurationMs).toBeGreaterThan(0);
      expect(p.halfLifeMs).toBeGreaterThan(0);
      expect((OVERRIDE_RISK_LEVELS as readonly string[]).includes(p.defaultRisk)).toBe(true);
    }
  });

  it("rejects unknown override kinds via parser (fail-closed null)", () => {
    expect(parseHumanOverrideKind("EMERGENCY")).toBe("EMERGENCY");
    expect(parseHumanOverrideKind("VERIFIED")).toBeNull();
    expect(parseHumanOverrideKind("")).toBeNull();
    expect(parseHumanOverrideKind(undefined)).toBeNull();
    expect(parseHumanOverrideKind(42)).toBeNull();
  });

  it("declares no kind permitted to touch the replay axis", () => {
    for (const k of HUMAN_OVERRIDE_KINDS) {
      expect(getOverrideKindProfile(k).mayTouchReplay).toBe(false);
    }
  });

  it("requires founder approval for high-risk kinds", () => {
    for (const k of ["EMERGENCY", "INCIDENT_RESPONSE", "EXECUTIVE_EXCEPTION", "RECOVERY_OVERRIDE"] as const) {
      expect(getOverrideKindProfile(k).requiresFounderApproval).toBe(true);
    }
  });
});

describe("W2-PR29A validators", () => {
  it("accepts a clean record with zero errors", () => {
    expect(validateHumanOverride(baseRecord())).toEqual([]);
  });

  it("rejects indefinite-override sentinel timestamps", () => {
    const e1 = validateHumanOverride(baseRecord({ expirationTimestamp: "9999-12-31T23:59:59Z" }));
    const e2 = validateHumanOverride(baseRecord({ expirationTimestamp: "infinity" }));
    const e3 = validateHumanOverride(baseRecord({ expirationTimestamp: "never" }));
    expect(e1.some((e) => e.tag === "indefinite-override-forbidden")).toBe(true);
    expect(e2.some((e) => e.tag === "indefinite-override-forbidden")).toBe(true);
    expect(e3.some((e) => e.tag === "indefinite-override-forbidden")).toBe(true);
  });

  it("rejects scope containing forbidden-breadth terms", () => {
    const errs = validateHumanOverride(
      baseRecord({ scope: "global bypass for everything until further notice" }),
    );
    expect(errs.filter((e) => e.tag === "scope-too-broad").length).toBeGreaterThanOrEqual(2);
  });

  it("rejects duration exceeding kind ceiling (EMERGENCY > 4h)", () => {
    const errs = validateHumanOverride(
      baseRecord({
        kind: "EMERGENCY",
        risk: "CRITICAL",
        approvalTimestamp: "2026-05-09T00:00:00Z",
        expirationTimestamp: "2026-05-09T08:00:00Z", // 8h > 4h ceiling
      }),
    );
    expect(errs.some((e) => e.tag === "duration-exceeds-kind-ceiling")).toBe(true);
  });

  it("rejects expiration before approval", () => {
    const errs = validateHumanOverride(
      baseRecord({
        approvalTimestamp: "2026-05-09T12:00:00Z",
        expirationTimestamp: "2026-05-09T00:00:00Z",
      }),
    );
    expect(errs.some((e) => e.tag === "expiration-before-approval")).toBe(true);
  });

  it("rejects replay suppression for every current kind", () => {
    for (const kind of HUMAN_OVERRIDE_KINDS) {
      const errs = validateHumanOverride(
        baseRecord({
          kind,
          risk: getOverrideKindProfile(kind).defaultRisk,
          touchesReplay: true,
          initiatingActor: getOverrideKindProfile(kind).requiresFounderApproval
            ? "founder:ct@sourcd.xyz"
            : "operator:on-call",
          approvalTimestamp: "2026-05-09T00:00:00Z",
          expirationTimestamp: "2026-05-09T00:30:00Z",
          environment: kind === "TEST_OVERRIDE" ? "staging" : "production",
        }),
      );
      expect(errs.some((e) => e.tag === "replay-suppression-forbidden")).toBe(true);
    }
  });

  it("rejects manual trust elevation", () => {
    const errs = validateHumanOverride(baseRecord({ elevatesTrust: true }));
    expect(errs.some((e) => e.tag === "manual-trust-elevation-forbidden")).toBe(true);
  });

  it("rejects test override in production environment", () => {
    const errs = validateHumanOverride(
      baseRecord({
        kind: "TEST_OVERRIDE",
        risk: "LOW",
        initiatingActor: "operator:tester",
        approvalTimestamp: "2026-05-09T00:00:00Z",
        expirationTimestamp: "2026-05-09T00:30:00Z",
        environment: "production",
      }),
    );
    expect(errs.some((e) => e.tag === "test-override-in-production")).toBe(true);
  });

  it("rejects direct self-parent recursion", () => {
    const errs = validateHumanOverride(baseRecord({ parentOverrideId: "ov-001" }));
    expect(errs.some((e) => e.tag === "recursive-override-detected")).toBe(true);
  });

  it("requires founder approval for EMERGENCY (operator-tier rejected)", () => {
    const errs = validateHumanOverride(
      baseRecord({
        kind: "EMERGENCY",
        risk: "CRITICAL",
        initiatingActor: "operator:on-call",
        approvalTimestamp: "2026-05-09T00:00:00Z",
        expirationTimestamp: "2026-05-09T01:00:00Z",
      }),
    );
    expect(errs.some((e) => e.tag === "founder-approval-required")).toBe(true);
  });

  it("rejects renewal counts beyond MAX_HUMAN_OVERRIDE_RENEWALS", () => {
    const errs = validateHumanOverride(
      baseRecord({ renewalCount: MAX_HUMAN_OVERRIDE_RENEWALS + 1 }),
    );
    expect(errs.some((e) => e.tag === "renewal-penalty-exhausted")).toBe(true);
  });

  it("rejects unknown affected-domain entries", () => {
    const errs = validateHumanOverride(
      // @ts-expect-error — adversarial unknown domain
      baseRecord({ affectedDomains: ["bogus-domain"] }),
    );
    expect(errs.some((e) => e.tag === "unknown-affected-domain")).toBe(true);
  });

  it("rejects empty affected domains", () => {
    const errs = validateHumanOverride(baseRecord({ affectedDomains: [] }));
    expect(errs.some((e) => e.tag === "affected-domains-empty")).toBe(true);
  });

  it("rejects declared risk below kind floor", () => {
    const errs = validateHumanOverride(
      baseRecord({
        kind: "EMERGENCY",
        risk: "LOW",
        initiatingActor: "founder:ct@sourcd.xyz",
        approvalTimestamp: "2026-05-09T00:00:00Z",
        expirationTimestamp: "2026-05-09T01:00:00Z",
      }),
    );
    expect(errs.some((e) => e.tag === "risk-below-kind-floor")).toBe(true);
  });
});

describe("W2-PR29A recursive override chain detection", () => {
  it("detects 2-cycle (a → b → a)", () => {
    const a = baseRecord({ id: "a", parentOverrideId: "b" });
    const b = baseRecord({ id: "b", parentOverrideId: "a" });
    const cycles = detectRecursiveOverrideChains([a, b]);
    expect(cycles.sort()).toEqual(["a", "b"]);
  });

  it("does not flag clean linear chain (a ← b ← c)", () => {
    const a = baseRecord({ id: "a", parentOverrideId: null });
    const b = baseRecord({ id: "b", parentOverrideId: "a" });
    const c = baseRecord({ id: "c", parentOverrideId: "b" });
    expect(detectRecursiveOverrideChains([a, b, c])).toEqual([]);
  });
});

describe("W2-PR29A blast radius", () => {
  it("scores low-risk single-domain MANUAL_REVIEW in MEDIUM tier", () => {
    const blast = computeOverrideBlastRadius(
      baseRecord({
        kind: "MANUAL_REVIEW",
        risk: "MEDIUM",
        initiatingActor: "operator:on-call",
        approvalTimestamp: "2026-05-09T00:00:00Z",
        expirationTimestamp: "2026-05-10T00:00:00Z",
        affectedDomains: ["containment-state"],
        impactedInvariants: ["containment-degraded-allowed-recovery"],
      }),
    );
    expect(blast.severityTier).toBe("MEDIUM");
    expect(blast.crossDomainReach).toBe(1);
    expect(blast.hasReplayImplications).toBe(false);
  });

  it("inflates score when scope contains ambiguity-adjacent terms", () => {
    const r = baseRecord({
      kind: "MANUAL_REVIEW",
      risk: "MEDIUM",
      initiatingActor: "operator:on-call",
      approvalTimestamp: "2026-05-09T00:00:00Z",
      expirationTimestamp: "2026-05-10T00:00:00Z",
      scope: "review the unmarkered ambiguous rows",
    });
    const blast = computeOverrideBlastRadius(r);
    expect(blast.hasAmbiguityImplications).toBe(true);
  });

  it("caps score at 100 and reaches CRITICAL for EXECUTIVE_EXCEPTION across 4 domains", () => {
    const r = baseRecord({
      kind: "EXECUTIVE_EXCEPTION",
      risk: "CRITICAL",
      initiatingActor: "founder:ct@sourcd.xyz",
      approvalTimestamp: "2026-05-09T00:00:00Z",
      expirationTimestamp: "2026-05-15T00:00:00Z",
      affectedDomains: [
        "trust-class",
        "integrity-state",
        "containment-state",
        "cross-axis-coherence",
      ],
      impactedInvariants: ["a", "b", "c", "d"],
      renewalCount: 1,
    });
    const blast = computeOverrideBlastRadius(r);
    expect(blast.downstreamRiskScore).toBeLessThanOrEqual(100);
    expect(blast.severityTier).toBe("CRITICAL");
    expect(blast.crossDomainReach).toBe(4);
  });
});

describe("W2-PR29A decay semantics", () => {
  it("returns FRESH immediately after approval", () => {
    const r = baseRecord({
      kind: "INCIDENT_RESPONSE",
      approvalTimestamp: "2026-05-09T00:00:00Z",
      expirationTimestamp: "2026-05-09T12:00:00Z",
    });
    const decay = computeOverrideDecay(r, "2026-05-09T00:01:00Z");
    expect(decay.state).toBe("FRESH");
    expect(decay.strength).toBeGreaterThan(0.9);
  });

  it("returns DECAYING / STALE around 1-2 half-lives", () => {
    // INCIDENT_RESPONSE half-life = 6h; expiration ceiling = 24h
    const r = baseRecord({
      kind: "INCIDENT_RESPONSE",
      approvalTimestamp: "2026-05-09T00:00:00Z",
      expirationTimestamp: "2026-05-09T20:00:00Z",
    });
    const oneHalfLife = computeOverrideDecay(r, "2026-05-09T06:00:00Z");
    expect(oneHalfLife.state).toBe("DECAYING");
    const twoHalfLife = computeOverrideDecay(r, "2026-05-09T12:00:00Z");
    expect(twoHalfLife.state === "DECAYING" || twoHalfLife.state === "STALE").toBe(true);
  });

  it("returns EXPIRED past expiration timestamp", () => {
    const r = baseRecord({
      kind: "EMERGENCY",
      risk: "CRITICAL",
      initiatingActor: "founder:ct@sourcd.xyz",
      approvalTimestamp: "2026-05-09T00:00:00Z",
      expirationTimestamp: "2026-05-09T03:00:00Z",
    });
    const decay = computeOverrideDecay(r, "2026-05-09T04:00:00Z");
    expect(decay.state).toBe("EXPIRED");
    expect(decay.requiresReassessment).toBe(true);
  });

  it("returns OVER-RENEWED when renewalCount > MAX", () => {
    const r = baseRecord({ renewalCount: MAX_HUMAN_OVERRIDE_RENEWALS + 1 });
    const decay = computeOverrideDecay(r, "2026-05-09T00:01:00Z");
    expect(decay.state).toBe("OVER-RENEWED");
  });

  it("severity multiplier inflates with staleness AND renewals", () => {
    const r = baseRecord({
      kind: "TEMPORARY_SUPPRESSION",
      risk: "MEDIUM",
      initiatingActor: "operator:on-call",
      approvalTimestamp: "2026-05-01T00:00:00Z",
      expirationTimestamp: "2026-05-08T00:00:00Z",
      renewalCount: 2,
    });
    const decay = computeOverrideDecay(r, "2026-05-07T00:00:00Z");
    expect(decay.severityMultiplier).toBeGreaterThan(1.5);
  });

  it("OVERRIDE_DECAY_STATES has 5 states", () => {
    expect(OVERRIDE_DECAY_STATES.length).toBe(5);
  });
});

describe("W2-PR29A — TARGET 6: human-stress chaos simulations", () => {
  it("CHAOS: emergency replay-suppression request is rejected (rule #3)", () => {
    // Operator under pressure tries to mark ambiguous replay rows as denied
    const errs = validateHumanOverride(
      baseRecord({
        kind: "EMERGENCY",
        risk: "CRITICAL",
        initiatingActor: "founder:ct@sourcd.xyz",
        approvalTimestamp: "2026-05-09T00:00:00Z",
        expirationTimestamp: "2026-05-09T01:00:00Z",
        affectedDomains: ["replay-state"],
        impactedInvariants: ["replay-ambiguity-preserved"],
        scope: "incident#99 — collapse R-AMBIGUOUS rows",
        touchesReplay: true,
      }),
    );
    expect(errs.some((e) => e.tag === "replay-suppression-forbidden")).toBe(true);
  });

  it("CHAOS: executive override that elevates trust class is rejected", () => {
    const errs = validateHumanOverride(
      baseRecord({
        kind: "EXECUTIVE_EXCEPTION",
        risk: "CRITICAL",
        initiatingActor: "founder:ct@sourcd.xyz",
        approvalTimestamp: "2026-05-09T00:00:00Z",
        expirationTimestamp: "2026-05-15T00:00:00Z",
        elevatesTrust: true,
        scope: "promote partner-x to C-1 trust class",
      }),
    );
    expect(errs.some((e) => e.tag === "manual-trust-elevation-forbidden")).toBe(true);
  });

  it("CHAOS: cascading temporary suppressions still surface in blast radius (no normalization)", () => {
    const records: HumanOverrideRecord[] = Array.from({ length: 5 }).map((_, i) =>
      baseRecord({
        id: `cascade-${i}`,
        kind: "TEMPORARY_SUPPRESSION",
        risk: "MEDIUM",
        initiatingActor: "operator:on-call",
        approvalTimestamp: "2026-05-09T00:00:00Z",
        expirationTimestamp: "2026-05-12T00:00:00Z",
        affectedDomains: ["containment-state", "integrity-state"],
        impactedInvariants: [`inv-${i}`],
        scope: `noisy alarm ${i}`,
        renewalCount: 1,
      }),
    );
    const report = buildOverrideDisciplineReport(records, "2026-05-09T00:01:00Z");
    expect(report.recordsEvaluated).toBe(5);
    // Each record produces blast-radius + decay finding; none should silently disappear
    const blastFindings = report.findings.filter((f) => f.tag === "blast-radius");
    expect(blastFindings.length).toBe(5);
  });

  it("CHAOS: override-renewal loop (renewalCount = 4) produces OVER-RENEWED + validation error", () => {
    const r = baseRecord({ renewalCount: 4 });
    const decay = computeOverrideDecay(r, "2026-05-09T00:01:00Z");
    const errs = validateHumanOverride(r);
    expect(decay.state).toBe("OVER-RENEWED");
    expect(errs.some((e) => e.tag === "renewal-penalty-exhausted")).toBe(true);
  });

  it("CHAOS: partial cleanup leaves expired override → report flags CI gating", () => {
    // Ops forgot to close out an EMERGENCY override; it persists past expiration
    const r = baseRecord({
      kind: "EMERGENCY",
      risk: "CRITICAL",
      initiatingActor: "founder:ct@sourcd.xyz",
      approvalTimestamp: "2026-05-08T00:00:00Z",
      expirationTimestamp: "2026-05-08T02:00:00Z",
    });
    const report = buildOverrideDisciplineReport([r], "2026-05-09T00:00:00Z");
    expect(report.hasCiGatingCondition).toBe(true);
    expect(report.findings.some((f) => f.tag === "decay-state" && f.state === "EXPIRED")).toBe(true);
  });

  it("CHAOS: indirect 3-cycle (a→b→c→a) is detected, not silently followed", () => {
    const a = baseRecord({ id: "a", parentOverrideId: "c" });
    const b = baseRecord({ id: "b", parentOverrideId: "a" });
    const c = baseRecord({ id: "c", parentOverrideId: "b" });
    const cycles = detectRecursiveOverrideChains([a, b, c]);
    expect(cycles.sort()).toEqual(["a", "b", "c"]);
  });

  it("CHAOS: bulk discipline report on 20 mixed records remains decidable + non-empty", () => {
    const records: HumanOverrideRecord[] = [];
    for (let i = 0; i < 20; i++) {
      const kind = HUMAN_OVERRIDE_KINDS[i % HUMAN_OVERRIDE_KINDS.length];
      const profile = getOverrideKindProfile(kind);
      records.push(
        baseRecord({
          id: `bulk-${i}`,
          kind,
          risk: profile.defaultRisk,
          initiatingActor: profile.requiresFounderApproval
            ? "founder:ct@sourcd.xyz"
            : "operator:on-call",
          approvalTimestamp: "2026-05-09T00:00:00Z",
          expirationTimestamp: new Date(Date.parse("2026-05-09T00:00:00Z") + Math.min(profile.maxDurationMs, 30 * 60 * 1000)).toISOString().replace(/\.\d{3}Z$/, "Z"),
          environment: kind === "TEST_OVERRIDE" ? "staging" : "production",
        }),
      );
    }
    const report = buildOverrideDisciplineReport(records, "2026-05-09T00:01:00Z");
    expect(report.recordsEvaluated).toBe(20);
    // Each record produces 1 decay + 1 blast finding minimum (40+); validation may add more
    expect(report.findings.length).toBeGreaterThanOrEqual(40);
  });
});
