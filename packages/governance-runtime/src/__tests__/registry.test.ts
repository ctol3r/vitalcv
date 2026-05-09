/**
 * Tests for @vitalcv/governance-runtime.
 *
 * Per W2-PR18A target 7: tests MUST cover undefined trust states, undefined
 * integrity states, undefined replay states, telemetry absence, invalid
 * trust-class mappings, fallback coercion. CI MUST FAIL on silent healthy
 * defaults / unknown → green mappings / implicit trust escalation.
 */

import { describe, expect, it } from "vitest";
import {
  TRUST_CLASSES,
  INTEGRITY_STATES,
  CONTAINMENT_STATES,
  REPLAY_STATES,
  parseTrustClass,
  parseIntegrityState,
  parseContainmentState,
  parseReplayState,
  failClosedIntegrity,
  failClosedContainment,
  failClosedReplayState,
  failClosedTrustClass,
  handleTelemetryAbsence,
  maxIntegrityState,
  maxContainmentState,
  classifyReplayState,
  validateOverrideEntry,
  detectForbiddenOverridePattern,
  MAX_OVERRIDE_DURATION_MS,
  MAX_RENEWALS,
  validateIntegrityTransition,
  validateContainmentTransition,
  validateReplayTransition,
  FORBIDDEN_LEXICON_PHRASES,
  getTrustClassProfile,
} from "../registry.js";

describe("trust-class registry", () => {
  it("exposes all 5 canonical trust classes", () => {
    expect(TRUST_CLASSES).toEqual(["C-1", "C-2", "T0", "R0", "D0"]);
  });

  it("parses known trust-class strings", () => {
    expect(parseTrustClass("C-1")).toBe("C-1");
    expect(parseTrustClass("T0")).toBe("T0");
    expect(parseTrustClass("R0")).toBe("R0");
  });

  it("returns null for unknown trust class — does NOT silently default to C-1", () => {
    expect(parseTrustClass("X-99")).toBeNull();
    expect(parseTrustClass("c-1")).toBeNull(); // case-sensitive
    expect(parseTrustClass("")).toBeNull();
    expect(parseTrustClass(null)).toBeNull();
    expect(parseTrustClass(undefined)).toBeNull();
    expect(parseTrustClass(42)).toBeNull();
  });

  it("failClosedTrustClass mirrors parseTrustClass — null on unknown", () => {
    expect(failClosedTrustClass("invalid")).toBeNull();
    expect(failClosedTrustClass("C-1")).toBe("C-1");
  });

  it("returns frozen profile per trust class", () => {
    const c1 = getTrustClassProfile("C-1");
    expect(c1.lineageDurability).toBe("STRONG");
    expect(c1.replaySurvivability).toBe("PARTIAL");
    expect(() => {
      // @ts-expect-error frozen
      c1.lineageDurability = "WEAK";
    }).toThrow();
  });

  it("T0 profile is appropriately weak (NOT silently strong)", () => {
    const t0 = getTrustClassProfile("T0");
    expect(t0.lineageDurability).toBe("WEAK");
    expect(t0.replaySurvivability).toBe("FRAGILE");
  });
});

describe("integrity-state registry", () => {
  it("includes CI-UNKNOWN explicitly", () => {
    expect(INTEGRITY_STATES).toContain("CI-UNKNOWN");
    expect(INTEGRITY_STATES).toContain("CI-GREEN");
  });

  it("parseIntegrityState returns CI-UNKNOWN for unknown input — NOT CI-GREEN", () => {
    expect(parseIntegrityState("anything")).toBe("CI-UNKNOWN");
    expect(parseIntegrityState(null)).toBe("CI-UNKNOWN");
    expect(parseIntegrityState(undefined)).toBe("CI-UNKNOWN");
    expect(parseIntegrityState({})).toBe("CI-UNKNOWN");
    expect(parseIntegrityState(0)).toBe("CI-UNKNOWN");
    expect(parseIntegrityState("ci-green")).toBe("CI-UNKNOWN"); // case-sensitive
  });

  it("failClosedIntegrity NEVER returns CI-GREEN for unknown input", () => {
    const samples = ["unknown", null, undefined, {}, 42, "ci-green", ""];
    for (const sample of samples) {
      expect(failClosedIntegrity(sample)).not.toBe("CI-GREEN");
    }
  });

  it("maxIntegrityState returns CI-UNKNOWN for empty input — NOT CI-GREEN", () => {
    expect(maxIntegrityState([])).toBe("CI-UNKNOWN");
  });

  it("maxIntegrityState picks CI-VIOLATION over CI-GREEN", () => {
    expect(maxIntegrityState(["CI-GREEN", "CI-VIOLATION", "CI-DEGRADED"])).toBe("CI-VIOLATION");
  });

  it("CI-UNKNOWN is treated as MORE severe than CI-GREEN (fail-closed)", () => {
    expect(maxIntegrityState(["CI-GREEN", "CI-UNKNOWN"])).toBe("CI-UNKNOWN");
  });
});

describe("containment-state registry", () => {
  it("includes CT-UNKNOWN explicitly", () => {
    expect(CONTAINMENT_STATES).toContain("CT-UNKNOWN");
  });

  it("parseContainmentState returns CT-UNKNOWN for unknown input", () => {
    expect(parseContainmentState("anything")).toBe("CT-UNKNOWN");
    expect(parseContainmentState(null)).toBe("CT-UNKNOWN");
  });

  it("failClosedContainment NEVER returns CT-GREEN for unknown input", () => {
    expect(failClosedContainment("anything")).not.toBe("CT-GREEN");
  });

  it("maxContainmentState returns CT-UNKNOWN for empty input", () => {
    expect(maxContainmentState([])).toBe("CT-UNKNOWN");
  });
});

describe("replay-state registry", () => {
  it("exposes 5 canonical replay states", () => {
    expect(REPLAY_STATES).toEqual([
      "R-OBSERVED",
      "R-DENIED",
      "R-ACCEPTED",
      "R-COLLAPSED",
      "R-AMBIGUOUS",
    ]);
  });

  it("parseReplayState returns null on unknown — does NOT default to R-OBSERVED", () => {
    expect(parseReplayState("anything")).toBeNull();
    expect(parseReplayState(null)).toBeNull();
  });

  it("failClosedReplayState returns R-AMBIGUOUS on unknown — preserves ambiguity", () => {
    expect(failClosedReplayState("anything")).toBe("R-AMBIGUOUS");
    expect(failClosedReplayState(null)).toBe("R-AMBIGUOUS");
  });

  it("classifyReplayState classifies known event types", () => {
    expect(classifyReplayState({ type: "IDEMPOTENT_REPLAY", metadata: {} })).toBe("R-OBSERVED");
    expect(classifyReplayState({ type: "CONCURRENCY_GUARD_TRIGGERED", metadata: {} })).toBe("R-COLLAPSED");
  });

  it("classifyReplayState classifies <base>.duplicate_request as R-DENIED", () => {
    expect(
      classifyReplayState({
        type: "EMPLOYER_REVIEW_ACCEPTED",
        metadata: { action: "employer_review.accept.duplicate_request", outcome: "denied" },
      }),
    ).toBe("R-DENIED");
  });

  it("classifyReplayState classifies unmarkered rows as R-AMBIGUOUS — preserves ambiguity per W2-PR19A rule #4", () => {
    expect(
      classifyReplayState({
        type: "EMPLOYER_REVIEW_ACCEPTED",
        metadata: { outcome: "permitted" },
      }),
    ).toBe("R-AMBIGUOUS");
  });
});

describe("telemetry-absence handling (W2-PR18A target 5)", () => {
  it("returns ALL fail-closed states with reason — never silently healthy", () => {
    const result = handleTelemetryAbsence("test telemetry feed unavailable");
    expect(result.integrity).toBe("CI-UNKNOWN");
    expect(result.containment).toBe("CT-UNKNOWN");
    expect(result.replay).toBe("R-AMBIGUOUS");
    expect(result.reason).toBe("test telemetry feed unavailable");
  });
});

describe("override-audit primitives", () => {
  it("rejects override with missing required fields", () => {
    const errors = validateOverrideEntry({});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.tag === "missing-field")).toBe(true);
  });

  it("rejects override with non-UUID overrideId", () => {
    const errors = validateOverrideEntry({
      overrideId: "not-a-uuid",
      overrideClass: "OV-1",
      specificDrift: "L-DR-1",
      scope: "Lock v2 wording",
      approvalRequester: "alice",
      approver: "founder",
      approvalTimestamp: "2026-05-08T00:00:00.000Z",
      expirationTimestamp: "2026-05-15T00:00:00.000Z",
      renewalPolicy: "auto-expire",
      survivabilityRisk: "low",
      forensicRisk: "low",
      constitutionalImpact: "Lock v2 wording inflation",
      closurePlan: "doc fix in next wave",
      status: "ACTIVE",
      renewalCount: 0,
    });
    expect(errors.some((e) => e.tag === "invalid-uuid")).toBe(true);
  });

  it("rejects override with expiration > MAX_OVERRIDE_DURATION_MS (30 days)", () => {
    const errors = validateOverrideEntry({
      overrideId: "11111111-1111-4111-8111-111111111111",
      overrideClass: "OV-1",
      specificDrift: "L-DR-1",
      scope: "test",
      approvalRequester: "alice",
      approver: "founder",
      approvalTimestamp: "2026-05-08T00:00:00.000Z",
      expirationTimestamp: "2026-07-08T00:00:00.000Z", // 60 days
      renewalPolicy: "auto-expire",
      survivabilityRisk: "low",
      forensicRisk: "low",
      constitutionalImpact: "test",
      closurePlan: "test",
      status: "ACTIVE",
      renewalCount: 0,
    });
    expect(errors.some((e) => e.tag === "expiration-exceeds-max-duration")).toBe(true);
  });

  it("rejects override with expiration before approval", () => {
    const errors = validateOverrideEntry({
      overrideId: "11111111-1111-4111-8111-111111111111",
      overrideClass: "OV-1",
      specificDrift: "L-DR-1",
      scope: "test",
      approvalRequester: "alice",
      approver: "founder",
      approvalTimestamp: "2026-05-15T00:00:00.000Z",
      expirationTimestamp: "2026-05-08T00:00:00.000Z", // before approval
      renewalPolicy: "auto-expire",
      survivabilityRisk: "low",
      forensicRisk: "low",
      constitutionalImpact: "test",
      closurePlan: "test",
      status: "ACTIVE",
      renewalCount: 0,
    });
    expect(errors.some((e) => e.tag === "expiration-before-approval")).toBe(true);
  });

  it("rejects renewal count exceeding MAX_RENEWALS", () => {
    const errors = validateOverrideEntry({
      overrideId: "11111111-1111-4111-8111-111111111111",
      overrideClass: "OV-1",
      specificDrift: "L-DR-1",
      scope: "test",
      approvalRequester: "alice",
      approver: "founder",
      approvalTimestamp: "2026-05-08T00:00:00.000Z",
      expirationTimestamp: "2026-05-15T00:00:00.000Z",
      renewalPolicy: "renewal-required",
      survivabilityRisk: "low",
      forensicRisk: "low",
      constitutionalImpact: "test",
      closurePlan: "test",
      status: "RENEWED",
      renewalCount: MAX_RENEWALS + 1,
    });
    expect(errors.some((e) => e.tag === "renewal-count-exceeded")).toBe(true);
  });

  it("accepts a valid override entry — empty errors", () => {
    const errors = validateOverrideEntry({
      overrideId: "11111111-1111-4111-8111-111111111111",
      overrideClass: "OV-1",
      specificDrift: "L-DR-1",
      scope: "Lock v2 wording in §1, §6, §7.4",
      approvalRequester: "alice",
      approver: "founder",
      approvalTimestamp: "2026-05-08T00:00:00.000Z",
      expirationTimestamp: "2026-05-15T00:00:00.000Z",
      renewalPolicy: "auto-expire",
      survivabilityRisk: "low — wording-only",
      forensicRisk: "low",
      constitutionalImpact: "Lock v2 inflation tolerated until wording fix",
      closurePlan: "fix wording in next wave",
      status: "ACTIVE",
      renewalCount: 0,
    });
    expect(errors).toHaveLength(0);
  });

  it("detects forbidden override patterns", () => {
    expect(detectForbiddenOverridePattern("permanent override for X")).not.toBeNull();
    expect(detectForbiddenOverridePattern("until further notice")).not.toBeNull();
    expect(detectForbiddenOverridePattern("verbal approval from founder")).not.toBeNull();
    expect(detectForbiddenOverridePattern("implicit override")).not.toBeNull();
    expect(detectForbiddenOverridePattern("Lock v2 wording in §1")).toBeNull();
  });

  it("MAX_OVERRIDE_DURATION_MS is 30 days", () => {
    expect(MAX_OVERRIDE_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe("transition validation (W2-PR20A)", () => {
  it("allows valid integrity degradation without evidence", () => {
    const result = validateIntegrityTransition("CI-GREEN", "CI-DEGRADED");
    expect(result.tag).toBe("allowed");
  });

  it("requires evidence for integrity recovery", () => {
    const result = validateIntegrityTransition("CI-DEGRADED", "CI-GREEN");
    expect(result.tag).toBe("allowed");
    if (result.tag === "allowed") {
      expect(result.evidenceRequired).not.toBeNull();
    }
  });

  it("rejects impossible integrity jumps", () => {
    // CI-VIOLATION → CI-GREEN is NOT in the graph; must transition through stages
    const result = validateIntegrityTransition("CI-VIOLATION", "CI-GREEN");
    expect(result.tag).toBe("forbidden");
  });

  it("validates no-op (same-state transition) explicitly", () => {
    const result = validateIntegrityTransition("CI-GREEN", "CI-GREEN");
    expect(result.tag).toBe("no-op");
  });

  it("requires evidence for replay R-AMBIGUOUS resolution", () => {
    const result = validateReplayTransition("R-AMBIGUOUS", "R-OBSERVED");
    expect(result.tag).toBe("allowed");
    if (result.tag === "allowed") {
      expect(result.evidenceRequired).not.toBeNull();
    }
  });

  it("rejects impossible containment recovery", () => {
    // CT-VIOLATION → CT-GREEN is NOT in the graph; must transition through CT-ESCALATING
    const result = validateContainmentTransition("CT-VIOLATION", "CT-GREEN");
    expect(result.tag).toBe("forbidden");
  });
});

describe("forbidden lexicon phrases (W2-PR11A enforcement substrate)", () => {
  it("includes the canonical 7 forbidden phrases", () => {
    const phrases = FORBIDDEN_LEXICON_PHRASES;
    // Sanity: each phrase is a RegExp
    for (const p of phrases) {
      expect(p).toBeInstanceOf(RegExp);
    }
    // Spot-check the canonical 7
    expect(phrases.some((r) => r.test("non-repudiable"))).toBe(true);
    expect(phrases.some((r) => r.test("cryptographically guaranteed"))).toBe(true);
    expect(phrases.some((r) => r.test("replay protected"))).toBe(true);
    expect(phrases.some((r) => r.test("signed mutation"))).toBe(true);
    expect(phrases.some((r) => r.test("tamper-proof"))).toBe(true);
    expect(phrases.some((r) => r.test("trustless"))).toBe(true);
    expect(phrases.some((r) => r.test("provably secure"))).toBe(true);
  });

  it("rejects bare 'tamperproof' (no dash)", () => {
    expect(FORBIDDEN_LEXICON_PHRASES.some((r) => r.test("tamperproof"))).toBe(true);
  });

  it("does NOT match unrelated occurrences", () => {
    // "trustless" should match
    expect(FORBIDDEN_LEXICON_PHRASES.some((r) => r.test("trustless system"))).toBe(true);
    // "trust" alone should NOT match
    expect(FORBIDDEN_LEXICON_PHRASES.some((r) => r.test("trust contract"))).toBe(false);
  });
});

describe("causal lineage validation (W2-PR21A)", () => {
  it("rejects recovery transition without evidence", async () => {
    const { validateCausalLineage } = await import("../registry.js");
    const errors = validateCausalLineage(
      {
        axis: "integrity",
        previousState: "CI-DEGRADED",
        nextState: "CI-GREEN",
        timestamp: "2026-05-08T00:00:00.000Z",
        actor: "ops-bot",
        transitionReason: "alarm cleared",
        evidenceReference: null,
        continuityConfidence: "STRONG",
      },
      {
        isRecovery: true,
        isReplayStabilization: false,
        evidenceRequiredByGraph: "remediation-verified",
      },
    );
    expect(errors.some((e) => e.tag === "missing-evidence-ref")).toBe(true);
  });

  it("rejects R-AMBIGUOUS resolution without replayRef", async () => {
    const { validateCausalLineage } = await import("../registry.js");
    const errors = validateCausalLineage(
      {
        axis: "replay",
        previousState: "R-AMBIGUOUS",
        nextState: "R-OBSERVED",
        timestamp: "2026-05-08T00:00:00.000Z",
        actor: "soc-analyst",
        transitionReason: "investigation complete",
        evidenceReference: null,
        continuityConfidence: "PARTIAL",
        lineage: {
          evidenceRef: "ticket-123",
          continuityRef: null,
          replayRef: null, // missing!
          telemetryRef: null,
          confidenceSource: "soc-playbook",
          causalityReason: "found IDEMPOTENT_REPLAY row",
        },
      },
      {
        isRecovery: false,
        isReplayStabilization: true,
        evidenceRequiredByGraph: "IDEMPOTENT_REPLAY audit row found",
      },
    );
    expect(errors.some((e) => e.tag === "missing-replay-ref")).toBe(true);
  });

  it("rejects CONFIRMED confidence without evidenceRef", async () => {
    const { validateCausalLineage } = await import("../registry.js");
    const errors = validateCausalLineage(
      {
        axis: "integrity",
        previousState: "CI-DEGRADED",
        nextState: "CI-GREEN",
        timestamp: "2026-05-08T00:00:00.000Z",
        actor: "ops",
        transitionReason: "manually closed",
        evidenceReference: null,
        continuityConfidence: "STRONG",
        causalConfidence: "CONFIRMED",
        lineage: {
          evidenceRef: null, // missing!
          continuityRef: null,
          replayRef: null,
          telemetryRef: null,
          confidenceSource: "ops-judgment",
          causalityReason: "feels fixed",
        },
      },
      {
        isRecovery: true,
        isReplayStabilization: false,
        evidenceRequiredByGraph: "remediation-verified",
      },
    );
    expect(errors.some((e) => e.tag === "confidence-without-evidence")).toBe(true);
  });

  it("accepts a fully-evidenced recovery transition", async () => {
    const { validateCausalLineage } = await import("../registry.js");
    const errors = validateCausalLineage(
      {
        axis: "integrity",
        previousState: "CI-DEGRADED",
        nextState: "CI-GREEN",
        timestamp: "2026-05-08T00:00:00.000Z",
        actor: "ops",
        transitionReason: "remediation verified",
        evidenceReference: "audit-uuid-456",
        continuityConfidence: "STRONG",
        causalConfidence: "CONFIRMED",
        lineage: {
          evidenceRef: "audit-uuid-456",
          continuityRef: "7-day-window-snapshot",
          replayRef: null,
          telemetryRef: "EX-3-Q-CANON-7",
          confidenceSource: "soc-playbook + Codex re-audit",
          causalityReason: "denial-rate variance returned to baseline AND sustained 7 days",
        },
      },
      {
        isRecovery: true,
        isReplayStabilization: false,
        evidenceRequiredByGraph: "remediation-verified per recovery-confidence tier",
      },
    );
    expect(errors).toHaveLength(0);
  });
});

describe("cross-axis coherence (W2-PR22A)", () => {
  it("detects integrity-vs-replay contradiction (CI-GREEN + R-AMBIGUOUS)", async () => {
    const { detectCoherenceContradictions } = await import("../registry.js");
    const errors = detectCoherenceContradictions({
      integrity: "CI-GREEN",
      containment: "CT-GREEN",
      replay: "R-AMBIGUOUS",
      trustClass: "C-1",
      continuityConfidence: "STRONG",
      causalConfidence: "PROBABLE",
      hasEvidenceRef: true,
    });
    expect(errors.some((e) => e.tag === "integrity-vs-replay")).toBe(true);
  });

  it("detects containment-vs-integrity contradiction (CT-GREEN + CI-FRAGMENTED)", async () => {
    const { detectCoherenceContradictions } = await import("../registry.js");
    const errors = detectCoherenceContradictions({
      integrity: "CI-FRAGMENTED",
      containment: "CT-GREEN",
      replay: "R-OBSERVED",
      trustClass: "C-1",
      continuityConfidence: "PARTIAL",
      causalConfidence: "PARTIAL",
      hasEvidenceRef: true,
    });
    expect(errors.some((e) => e.tag === "containment-vs-integrity")).toBe(true);
  });

  it("detects T0-vs-STRONG-continuity contradiction", async () => {
    const { detectCoherenceContradictions } = await import("../registry.js");
    const errors = detectCoherenceContradictions({
      integrity: "CI-DEGRADED",
      containment: "CT-DEGRADED",
      replay: "R-OBSERVED",
      trustClass: "T0",
      continuityConfidence: "STRONG",
      causalConfidence: "PARTIAL",
      hasEvidenceRef: true,
    });
    expect(errors.some((e) => e.tag === "trust-class-vs-continuity")).toBe(true);
  });

  it("detects CONFIRMED-without-evidence contradiction", async () => {
    const { detectCoherenceContradictions } = await import("../registry.js");
    const errors = detectCoherenceContradictions({
      integrity: "CI-DEGRADED",
      containment: "CT-DEGRADED",
      replay: "R-OBSERVED",
      trustClass: "C-1",
      continuityConfidence: "PARTIAL",
      causalConfidence: "CONFIRMED",
      hasEvidenceRef: false,
    });
    expect(errors.some((e) => e.tag === "confidence-vs-evidence")).toBe(true);
  });

  it("resolveSystemicState: contradictions → SYSTEMIC-AMBIGUOUS", async () => {
    const { resolveSystemicState } = await import("../registry.js");
    const result = resolveSystemicState({
      integrity: "CI-GREEN",
      containment: "CT-GREEN",
      replay: "R-AMBIGUOUS",
      trustClass: "C-1",
      continuityConfidence: "STRONG",
      causalConfidence: "PARTIAL",
      hasEvidenceRef: true,
    });
    expect(result.state).toBe("SYSTEMIC-AMBIGUOUS");
    expect(result.contradictions.length).toBeGreaterThan(0);
  });

  it("resolveSystemicState: CI-UNKNOWN → SYSTEMIC-UNVERIFIED (fail-closed)", async () => {
    const { resolveSystemicState } = await import("../registry.js");
    const result = resolveSystemicState({
      integrity: "CI-UNKNOWN",
      containment: "CT-GREEN",
      replay: "R-OBSERVED",
      trustClass: "C-1",
      continuityConfidence: "STRONG",
      causalConfidence: "PARTIAL",
      hasEvidenceRef: true,
    });
    expect(result.state).toBe("SYSTEMIC-UNVERIFIED");
  });

  it("resolveSystemicState: trustClass null → SYSTEMIC-UNVERIFIED", async () => {
    const { resolveSystemicState } = await import("../registry.js");
    const result = resolveSystemicState({
      integrity: "CI-GREEN",
      containment: "CT-GREEN",
      replay: "R-OBSERVED",
      trustClass: null, // UNCLASSIFIED
      continuityConfidence: "STRONG",
      causalConfidence: "PARTIAL",
      hasEvidenceRef: true,
    });
    expect(result.state).toBe("SYSTEMIC-UNVERIFIED");
  });

  it("resolveSystemicState: CI-FRAGMENTED → SYSTEMIC-FRAGMENTED", async () => {
    const { resolveSystemicState } = await import("../registry.js");
    const result = resolveSystemicState({
      integrity: "CI-FRAGMENTED",
      containment: "CT-FRAGMENTING",
      replay: "R-OBSERVED",
      trustClass: "C-1",
      continuityConfidence: "PARTIAL",
      causalConfidence: "PARTIAL",
      hasEvidenceRef: true,
    });
    expect(result.state).toBe("SYSTEMIC-FRAGMENTED");
  });
});

describe("governance exception registry (W2-PR24A)", () => {
  it("validates a complete exception with empty errors", async () => {
    const { validateException } = await import("../registry.js");
    const errors = validateException(
      {
        id: "EXC-2026-001",
        kind: "lexicon-allowlist",
        severity: "LEGACY",
        scopePath: "packages/audit/AuditEvent.ts",
        scopeLabel: "non-repudiation",
        justification: "Frozen YC MVP — Set literal of audit event types",
        expiresAt: "2026-07-08",
        owner: "audit-team",
        approver: "founder",
        approvedAt: "2026-05-08",
      },
      "2026-05-08T00:00:00.000Z",
    );
    expect(errors).toHaveLength(0);
  });

  it("rejects expired exception", async () => {
    const { validateException } = await import("../registry.js");
    const errors = validateException(
      {
        id: "EXC-2026-002",
        kind: "lexicon-allowlist",
        severity: "LEGACY",
        scopePath: "packages/foo",
        scopeLabel: "*",
        justification: "test",
        expiresAt: "2025-01-01",
        owner: "alice",
        approver: "founder",
        approvedAt: "2024-10-01",
      },
      "2026-05-08T00:00:00.000Z",
    );
    expect(errors.some((e) => e.tag === "expired")).toBe(true);
  });

  it("rejects expiration > 90 days from approval", async () => {
    const { validateException, MAX_EXCEPTION_DURATION_DAYS } = await import("../registry.js");
    const errors = validateException(
      {
        id: "EXC-2026-003",
        kind: "lexicon-allowlist",
        severity: "LEGACY",
        scopePath: "packages/foo",
        scopeLabel: "*",
        justification: "test",
        expiresAt: "2026-12-08", // ~7 months
        owner: "alice",
        approver: "founder",
        approvedAt: "2026-05-08",
      },
      "2026-05-08T00:00:00.000Z",
    );
    expect(errors.some((e) => e.tag === "expiration-too-far-out")).toBe(true);
    expect(MAX_EXCEPTION_DURATION_DAYS).toBe(90);
  });

  it("rejects malformed exception ID", async () => {
    const { validateException } = await import("../registry.js");
    const errors = validateException(
      {
        id: "not-an-id",
        kind: "lexicon-allowlist",
        severity: "LEGACY",
        scopePath: "packages/foo",
        scopeLabel: "*",
        justification: "test",
        expiresAt: "2026-08-08",
        owner: "alice",
        approver: "founder",
        approvedAt: "2026-05-08",
      },
      "2026-05-08T00:00:00.000Z",
    );
    expect(errors.some((e) => e.tag === "invalid-id-format")).toBe(true);
  });

  it("defaultSeverityForTag classifies common tags", async () => {
    const { defaultSeverityForTag } = await import("../registry.js");
    expect(defaultSeverityForTag("missing-registry-import")).toBe("BLOCKING");
    expect(defaultSeverityForTag("ad-hoc-rendering")).toBe("BLOCKING");
    expect(defaultSeverityForTag("lexicon-violation")).toBe("BLOCKING");
    expect(defaultSeverityForTag("migration-surface")).toBe("WARNING");
    expect(defaultSeverityForTag("legacy-grandfathered")).toBe("LEGACY");
    expect(defaultSeverityForTag("experimental")).toBe("EXPERIMENTAL");
    expect(defaultSeverityForTag("unknown-tag")).toBe("WARNING");
  });

  it("remediationGuidance produces actionable suggestions", async () => {
    const { remediationGuidance } = await import("../registry.js");
    const missing = remediationGuidance("missing-registry-import");
    expect(missing).toContain("@vitalcv/governance-runtime");
    const adHoc = remediationGuidance("ad-hoc-rendering");
    expect(adHoc).toContain("IntegrityBadge");
    const lexicon = remediationGuidance("lexicon-violation", { phrase: "replay protected" });
    expect(lexicon).toContain("replay protected");
  });
});

describe("semantic snapshot + mutation detection (W2-PR25A)", () => {
  it("produces a deterministic snapshot", async () => {
    const { buildSemanticSnapshot } = await import("../registry.js");
    const a = buildSemanticSnapshot("2026-05-08T00:00:00.000Z");
    const b = buildSemanticSnapshot("2026-05-08T00:00:00.000Z");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("detects state removal as BREAKING", async () => {
    const { buildSemanticSnapshot, diffSemanticSnapshots, maxEvolutionSeverity } = await import("../registry.js");
    const baseline = buildSemanticSnapshot("2026-05-08T00:00:00.000Z");
    const mutated = JSON.parse(JSON.stringify(baseline)) as typeof baseline;
    // Remove CI-UNKNOWN
    (mutated.stateSets as { integrity: string[] }).integrity = mutated.stateSets.integrity.filter(
      (s) => s !== "CI-UNKNOWN",
    );
    const mutations = diffSemanticSnapshots(baseline, mutated);
    expect(mutations.some((m) => m.tag === "state-removed" && m.state === "CI-UNKNOWN")).toBe(true);
    expect(maxEvolutionSeverity(mutations)).toBe("BREAKING");
  });

  it("detects transition addition as CRITICAL", async () => {
    const { buildSemanticSnapshot, diffSemanticSnapshots, maxEvolutionSeverity } = await import("../registry.js");
    const baseline = buildSemanticSnapshot("2026-05-08T00:00:00.000Z");
    const mutated = JSON.parse(JSON.stringify(baseline)) as typeof baseline;
    // Add an impossible jump: CI-VIOLATION → CI-GREEN (currently NOT in graph)
    (mutated.transitions.integrity as Array<{ from: string; to: string; evidenceRequired: string | null }>).push({
      from: "CI-VIOLATION",
      to: "CI-GREEN",
      evidenceRequired: null,
    });
    const mutations = diffSemanticSnapshots(baseline, mutated);
    expect(
      mutations.some(
        (m) => m.tag === "transition-added" && m.from === "CI-VIOLATION" && m.to === "CI-GREEN",
      ),
    ).toBe(true);
    expect(maxEvolutionSeverity(mutations)).toBe("CRITICAL");
  });

  it("detects evidence relaxation on transitions", async () => {
    const { buildSemanticSnapshot, diffSemanticSnapshots } = await import("../registry.js");
    const baseline = buildSemanticSnapshot("2026-05-08T00:00:00.000Z");
    const mutated = JSON.parse(JSON.stringify(baseline)) as typeof baseline;
    // Relax CI-DEGRADED → CI-GREEN evidence requirement
    const idx = mutated.transitions.integrity.findIndex(
      (t) => t.from === "CI-DEGRADED" && t.to === "CI-GREEN",
    );
    if (idx !== -1) {
      (mutated.transitions.integrity as Array<{ from: string; to: string; evidenceRequired: string | null }>)[idx].evidenceRequired = null;
    }
    const mutations = diffSemanticSnapshots(baseline, mutated);
    expect(
      mutations.some(
        (m) => m.tag === "transition-evidence-relaxed" && m.from === "CI-DEGRADED" && m.to === "CI-GREEN",
      ),
    ).toBe(true);
  });

  it("detects trust-class strength inflation as HIGH-RISK", async () => {
    const { buildSemanticSnapshot, diffSemanticSnapshots, maxEvolutionSeverity } = await import("../registry.js");
    const baseline = buildSemanticSnapshot("2026-05-08T00:00:00.000Z");
    const mutated = JSON.parse(JSON.stringify(baseline)) as typeof baseline;
    // Inflate T0's lineageDurability from WEAK to STRONG
    const t0 = mutated.trustClasses.find((p) => p.cls === "T0");
    if (t0 !== undefined) {
      (t0.profile as { lineageDurability: string }).lineageDurability = "STRONG";
    }
    const mutations = diffSemanticSnapshots(baseline, mutated);
    expect(mutations.some((m) => m.tag === "trust-class-strength-inflated" && m.cls === "T0")).toBe(true);
    expect(maxEvolutionSeverity(mutations)).toBe("HIGH-RISK");
  });

  it("detects max-renewal relaxation as CRITICAL", async () => {
    const { buildSemanticSnapshot, diffSemanticSnapshots, maxEvolutionSeverity } = await import("../registry.js");
    const baseline = buildSemanticSnapshot("2026-05-08T00:00:00.000Z");
    const mutated = JSON.parse(JSON.stringify(baseline)) as typeof baseline;
    (mutated.overrideRules as { maxRenewals: number }).maxRenewals = 10;
    const mutations = diffSemanticSnapshots(baseline, mutated);
    expect(mutations.some((m) => m.tag === "max-renewal-relaxed")).toBe(true);
    expect(maxEvolutionSeverity(mutations)).toBe("CRITICAL");
  });

  it("returns SAFE for identical snapshots", async () => {
    const { buildSemanticSnapshot, diffSemanticSnapshots, maxEvolutionSeverity } = await import("../registry.js");
    const a = buildSemanticSnapshot("2026-05-08T00:00:00.000Z");
    const b = buildSemanticSnapshot("2026-05-08T00:00:00.000Z");
    const mutations = diffSemanticSnapshots(a, b);
    expect(mutations).toHaveLength(0);
    expect(maxEvolutionSeverity(mutations)).toBe("SAFE");
  });
});

describe("governance runtime verification (W2-PR26A)", () => {
  it("runAllInvariants returns VERIFIED for clean registry baseline", async () => {
    const { runAllInvariants } = await import("../registry.js");
    const report = runAllInvariants();
    expect(report.summary.aggregateStatus).toBe("VERIFIED");
    expect(report.violations).toHaveLength(0);
    expect(report.invariantsChecked).toBeGreaterThan(80);
  });

  it("verifyFailClosedAxes catches adversarial inputs without coercing to healthy", async () => {
    const { verifyFailClosedAxes } = await import("../registry.js");
    const violations = verifyFailClosedAxes();
    expect(violations).toHaveLength(0);
  });

  it("verifyAmbiguityPreservation: replay + telemetry absence preserve ambiguity", async () => {
    const { verifyAmbiguityPreservation } = await import("../registry.js");
    const violations = verifyAmbiguityPreservation();
    expect(violations).toHaveLength(0);
  });

  it("verifyContradictionDetection: all 4 contradictory snapshots detected", async () => {
    const { verifyContradictionDetection } = await import("../registry.js");
    const violations = verifyContradictionDetection();
    expect(violations).toHaveLength(0);
  });

  it("verifyChaosScenarios: telemetry absence + missing trust class fail closed", async () => {
    const { verifyChaosScenarios } = await import("../registry.js");
    const violations = verifyChaosScenarios();
    expect(violations).toHaveLength(0);
  });

  it("verifyRegistryConsistency: all canonical states roundtrip", async () => {
    const { verifyRegistryConsistency } = await import("../registry.js");
    const violations = verifyRegistryConsistency();
    expect(violations).toHaveLength(0);
  });

  it("severity ordering invariant: CI-UNKNOWN > CI-GREEN (fail-closed)", async () => {
    const { integritySeverity } = await import("../registry.js");
    expect(integritySeverity("CI-UNKNOWN")).toBeGreaterThan(integritySeverity("CI-GREEN"));
  });

  it("FUZZ: 100 random adversarial inputs across 4 axes never produce healthy state", async () => {
    const { failClosedIntegrity, failClosedContainment, failClosedReplayState, failClosedTrustClass } =
      await import("../registry.js");

    const samples: unknown[] = [];
    for (let i = 0; i < 100; i++) {
      samples.push(
        Math.random() < 0.5 ? Math.random().toString(36) : { malformed: i },
      );
    }
    samples.push(null, undefined, NaN, Infinity, -Infinity, 0n);

    for (const sample of samples) {
      // Skip the rare case where the random string actually IS a valid state
      const intResult = failClosedIntegrity(sample);
      if (intResult === "CI-GREEN") {
        // verify it's actually the literal string
        expect(sample).toBe("CI-GREEN");
      }
      const ctResult = failClosedContainment(sample);
      if (ctResult === "CT-GREEN") {
        expect(sample).toBe("CT-GREEN");
      }
      const replayResult = failClosedReplayState(sample);
      // replay state for unknown is R-AMBIGUOUS — never silently classified
      if (replayResult !== "R-AMBIGUOUS") {
        expect(["R-OBSERVED", "R-DENIED", "R-ACCEPTED", "R-COLLAPSED"]).toContain(replayResult);
        // and the sample must equal the parsed value (round-trip)
        expect(sample).toBe(replayResult);
      }
      const tcResult = failClosedTrustClass(sample);
      if (tcResult !== null) {
        expect(["C-1", "C-2", "T0", "R0", "D0"]).toContain(tcResult);
        expect(sample).toBe(tcResult);
      }
    }
  });

  it("CROSS-AXIS EXPLOSION: contradictions detected across 60 snapshots", async () => {
    const { detectCoherenceContradictions, INTEGRITY_STATES, CONTAINMENT_STATES, REPLAY_STATES } =
      await import("../registry.js");

    let contradictionsTotal = 0;
    let snapshotsTested = 0;
    for (const integrity of INTEGRITY_STATES) {
      for (const replay of REPLAY_STATES) {
        // Test 4 representative containment states with each (integrity, replay)
        for (const containment of (["CT-GREEN", "CT-DEGRADED", "CT-FRAGMENTING", "CT-VIOLATION"] as const)) {
          snapshotsTested++;
          const errors = detectCoherenceContradictions({
            integrity,
            containment,
            replay,
            trustClass: "C-1",
            continuityConfidence: "PARTIAL",
            causalConfidence: "PARTIAL",
            hasEvidenceRef: true,
          });
          contradictionsTotal += errors.length;

          // Specific assertion: CI-GREEN + R-AMBIGUOUS MUST contradict
          if (integrity === "CI-GREEN" && replay === "R-AMBIGUOUS") {
            expect(errors.some((e) => e.tag === "integrity-vs-replay")).toBe(true);
          }
          // CT-GREEN + (CI-FRAGMENTED OR CI-VIOLATION) MUST contradict
          if (containment === "CT-GREEN" && (integrity === "CI-FRAGMENTED" || integrity === "CI-VIOLATION")) {
            expect(errors.some((e) => e.tag === "containment-vs-integrity")).toBe(true);
          }
        }
      }
    }
    expect(snapshotsTested).toBeGreaterThanOrEqual(60);
  });

  it("MUTATION ATTACK: removing CI-UNKNOWN from snapshot is detected as BREAKING", async () => {
    const { buildSemanticSnapshot, diffSemanticSnapshots, maxEvolutionSeverity } = await import("../registry.js");
    const baseline = buildSemanticSnapshot("2026-05-08T00:00:00.000Z");
    const attacked = JSON.parse(JSON.stringify(baseline)) as typeof baseline;
    (attacked.stateSets as { integrity: string[] }).integrity = attacked.stateSets.integrity.filter(
      (s) => s !== "CI-UNKNOWN",
    );
    const mutations = diffSemanticSnapshots(baseline, attacked);
    const severity = maxEvolutionSeverity(mutations);
    expect(severity).toBe("BREAKING");
  });

  it("MUTATION ATTACK: relaxing CI-VIOLATION→CI-GREEN evidence is detected as CRITICAL", async () => {
    const { buildSemanticSnapshot, diffSemanticSnapshots, maxEvolutionSeverity } = await import("../registry.js");
    const baseline = buildSemanticSnapshot("2026-05-08T00:00:00.000Z");
    const attacked = JSON.parse(JSON.stringify(baseline)) as typeof baseline;
    // Add the IMPOSSIBLE jump CI-VIOLATION → CI-GREEN
    (attacked.transitions.integrity as Array<{ from: string; to: string; evidenceRequired: string | null }>).push({
      from: "CI-VIOLATION",
      to: "CI-GREEN",
      evidenceRequired: null,
    });
    const mutations = diffSemanticSnapshots(baseline, attacked);
    const severity = maxEvolutionSeverity(mutations);
    expect(severity).toBe("CRITICAL");
  });

  it("MUTATION ATTACK: inflating MAX_RENEWALS is detected as CRITICAL", async () => {
    const { buildSemanticSnapshot, diffSemanticSnapshots, maxEvolutionSeverity } = await import("../registry.js");
    const baseline = buildSemanticSnapshot("2026-05-08T00:00:00.000Z");
    const attacked = JSON.parse(JSON.stringify(baseline)) as typeof baseline;
    (attacked.overrideRules as { maxRenewals: number }).maxRenewals = 999;
    const mutations = diffSemanticSnapshots(baseline, attacked);
    expect(mutations.some((m) => m.tag === "max-renewal-relaxed")).toBe(true);
    expect(maxEvolutionSeverity(mutations)).toBe("CRITICAL");
  });
});

describe("meta-verification (W2-PR27A)", () => {
  it("buildMetaVerificationReport surfaces per-domain coverage", async () => {
    const { buildMetaVerificationReport, runAllInvariants, GOVERNANCE_DOMAINS } = await import("../registry.js");
    const inv = runAllInvariants();
    const report = buildMetaVerificationReport(inv);
    expect(report.domainSummaries.length).toBe(GOVERNANCE_DOMAINS.length);
    expect(report.totalInvariants).toBeGreaterThan(20);
    expect(report.aggregateConfidence).not.toBe("VERIFIED"); // we have known assumptions
  });

  it("aggregate confidence is PARTIALLY-VERIFIED — completeness inflation forbidden", async () => {
    const { buildMetaVerificationReport, runAllInvariants } = await import("../registry.js");
    const report = buildMetaVerificationReport(runAllInvariants());
    // Per W2-PR27A rule #6: completeness inflation is forbidden. We have explicit
    // blind spots + assumptions, so aggregate cannot be "VERIFIED".
    expect(["PARTIALLY-VERIFIED", "ASSUMED", "UNVERIFIED"]).toContain(report.aggregateConfidence);
  });

  it("every governance domain is represented in DOMAIN_COVERAGE", async () => {
    const { GOVERNANCE_DOMAINS, DOMAIN_COVERAGE } = await import("../registry.js");
    const covered = new Set(DOMAIN_COVERAGE.map((d) => d.domain));
    for (const domain of GOVERNANCE_DOMAINS) {
      expect(covered.has(domain)).toBe(true);
    }
  });

  it("verifyInvariantInteractions returns no collisions on current registry", async () => {
    const { verifyInvariantInteractions } = await import("../registry.js");
    const collisions = verifyInvariantInteractions();
    expect(collisions).toHaveLength(0);
  });

  it("DOMAIN_COVERAGE entries declare blind spots + assumptions explicitly (no hidden trust)", async () => {
    const { DOMAIN_COVERAGE } = await import("../registry.js");
    for (const domain of DOMAIN_COVERAGE) {
      // Every domain must declare invariants AND blind-spots/assumptions explicitly
      // (per W2-PR27A rule #2: unverified assumptions must remain visible).
      expect(domain.invariantsVerified.length).toBeGreaterThan(0);
      // Most domains should have at least 1 blind spot or assumption documented
      // (declaring "0 blind spots / 0 assumptions" would be completeness inflation
      // unless the domain is genuinely simple).
      const declaredAny =
        domain.knownBlindSpots.length > 0 || domain.assumptionsRequired.length > 0;
      expect(declaredAny).toBe(true);
    }
  });
});
