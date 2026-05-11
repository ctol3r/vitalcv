/**
 * W2-PR172A — Constitutional Runtime Operational Activation.
 *
 * Verification of constitutional fail-closed and exception governance primitives:
 *   - fail-closed: failClosedIntegrity/Containment/ReplayState/TrustClass
 *     (unknown ≠ healthy invariant), handleTelemetryAbsence (missing telemetry → degraded)
 *   - exception-registry: EXCEPTION_SEVERITY/KIND vocabularies,
 *     MAX_EXCEPTION_DURATION_DAYS, validateException (missing/expired/too-long/id-format),
 *     defaultSeverityForTag, remediationGuidance
 *   - exception-governance: EXCEPTION_LIFECYCLE vocabulary,
 *     computeExceptionReceiptId (SHA-256 determinism),
 *     validateExceptionApplication (all violation types),
 *     buildExceptionGovernanceReport CI gating
 *
 * Doctrine: W2-PR18A (fail-closed semantics), W2-PR24A (exception governance),
 *           W2-PR89A (exception lifecycle), W2-PR25A (ambiguity preservation).
 */

import { describe, expect, it } from "vitest";

import {
  failClosedIntegrity,
  failClosedContainment,
  failClosedReplayState,
  failClosedTrustClass,
  handleTelemetryAbsence,
} from "../fail-closed.js";

import {
  EXCEPTION_SEVERITY,
  EXCEPTION_KIND,
  MAX_EXCEPTION_DURATION_DAYS,
  validateException,
  defaultSeverityForTag,
  remediationGuidance,
} from "../exception-registry.js";

import {
  EXCEPTION_LIFECYCLE,
  computeExceptionReceiptId,
  validateExceptionApplication,
  buildExceptionGovernanceReport,
} from "../exception-governance.js";

import type { ExceptionApplication } from "../exception-governance.js";
import type { GovernanceException } from "../exception-registry.js";
import { INTEGRITY_STATES } from "../integrity-state.js";
import { CONTAINMENT_STATES } from "../containment-state.js";
import { REPLAY_STATES } from "../replay-state.js";
import { TRUST_CLASSES } from "../trust-class.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = "2026-05-10T00:00:00Z";

function computeReceipt(
  proposingActor: string,
  proposedAt: string,
  justification: string,
  impactedReplayState: boolean,
  impactedAmbiguityState: boolean,
): string {
  return computeExceptionReceiptId({
    proposingActor, proposedAt, justification, impactedReplayState, impactedAmbiguityState,
  });
}

function validApplication(overrides: Partial<ExceptionApplication> = {}): ExceptionApplication {
  const receipt = computeReceipt("op-1", NOW, "Test justification", false, false);
  return {
    applicationId: "APP-001",
    proposingActor: "op-1",
    state: "PROPOSED",
    proposedAt: NOW,
    justification: "Test justification",
    impactedReplayState: false,
    impactedAmbiguityState: false,
    applicationReceiptId: receipt,
    ...overrides,
  };
}

function validException(overrides: Partial<GovernanceException> = {}): GovernanceException {
  return {
    id: "EXC-2026-001",
    kind: "lexicon-allowlist",
    severity: "WARNING",
    scopePath: "apps/web/components/legacy/",
    scopeLabel: "source-confirmed",
    justification: "Legacy component pending migration",
    expiresAt: "2026-08-07", // 89 days after approvedAt
    owner: "Chris",
    approver: "Founder",
    approvedAt: "2026-05-10",
    ...overrides,
  };
}

// ─── 1. failClosedIntegrity ───────────────────────────────────────────────────

describe("W2-PR172A — failClosedIntegrity: unknown ≠ healthy", () => {
  it("valid integrity state is returned as-is", () => {
    for (const state of INTEGRITY_STATES) {
      expect(INTEGRITY_STATES).toContain(failClosedIntegrity(state));
    }
  });

  it("unknown string → fail-closed (CI-UNKNOWN or degraded, never CI-GREEN)", () => {
    const result = failClosedIntegrity("GARBAGE");
    expect(result).not.toBe("CI-GREEN");
  });

  it("null → fail-closed state (never CI-GREEN)", () => {
    expect(failClosedIntegrity(null)).not.toBe("CI-GREEN");
  });

  it("undefined → fail-closed state (never CI-GREEN)", () => {
    expect(failClosedIntegrity(undefined)).not.toBe("CI-GREEN");
  });

  it("numeric input → fail-closed state (never CI-GREEN)", () => {
    expect(failClosedIntegrity(42)).not.toBe("CI-GREEN");
  });

  it("returns a value within the INTEGRITY_STATES vocabulary", () => {
    expect(INTEGRITY_STATES).toContain(failClosedIntegrity("GARBAGE"));
  });
});

// ─── 2. failClosedContainment ─────────────────────────────────────────────────

describe("W2-PR172A — failClosedContainment: unknown ≠ healthy", () => {
  it("valid containment state is returned as-is", () => {
    for (const state of CONTAINMENT_STATES) {
      expect(CONTAINMENT_STATES).toContain(failClosedContainment(state));
    }
  });

  it("unknown string → fail-closed (never CT-GREEN)", () => {
    expect(failClosedContainment("GARBAGE")).not.toBe("CT-GREEN");
  });

  it("null → fail-closed (never CT-GREEN)", () => {
    expect(failClosedContainment(null)).not.toBe("CT-GREEN");
  });

  it("returns a value within the CONTAINMENT_STATES vocabulary", () => {
    expect(CONTAINMENT_STATES).toContain(failClosedContainment("GARBAGE"));
  });
});

// ─── 3. failClosedReplayState ─────────────────────────────────────────────────

describe("W2-PR172A — failClosedReplayState: ambiguity-preserving fail-closed", () => {
  it("valid replay state is returned as-is", () => {
    for (const state of REPLAY_STATES) {
      expect(failClosedReplayState(state)).toBe(state);
    }
  });

  it("unknown string → R-AMBIGUOUS (not R-OBSERVED or any determinism-implying state)", () => {
    expect(failClosedReplayState("GARBAGE")).toBe("R-AMBIGUOUS");
  });

  it("null → R-AMBIGUOUS", () => {
    expect(failClosedReplayState(null)).toBe("R-AMBIGUOUS");
  });

  it("undefined → R-AMBIGUOUS", () => {
    expect(failClosedReplayState(undefined)).toBe("R-AMBIGUOUS");
  });

  it("numeric input → R-AMBIGUOUS", () => {
    expect(failClosedReplayState(0)).toBe("R-AMBIGUOUS");
  });

  it("never returns R-OBSERVED for unknown input (preserves ambiguity)", () => {
    expect(failClosedReplayState("UNKNOWN_STATE")).not.toBe("R-OBSERVED");
  });
});

// ─── 4. failClosedTrustClass ──────────────────────────────────────────────────

describe("W2-PR172A — failClosedTrustClass: null for unparseable", () => {
  it("valid trust class → returns the trust class", () => {
    for (const cls of TRUST_CLASSES) {
      expect(failClosedTrustClass(cls)).toBe(cls);
    }
  });

  it("unknown string → returns null", () => {
    expect(failClosedTrustClass("GARBAGE")).toBeNull();
  });

  it("null → returns null", () => {
    expect(failClosedTrustClass(null)).toBeNull();
  });

  it("undefined → returns null", () => {
    expect(failClosedTrustClass(undefined)).toBeNull();
  });

  it("never coerces unknown to a trust class (no optimism-by-absence)", () => {
    expect(failClosedTrustClass("NOT-A-CLASS")).toBeNull();
  });
});

// ─── 5. handleTelemetryAbsence ────────────────────────────────────────────────

describe("W2-PR172A — handleTelemetryAbsence: missing telemetry → degraded", () => {
  const result = handleTelemetryAbsence("feed-timeout");

  it("integrity is CI-UNKNOWN (missing telemetry ≠ healthy)", () => {
    expect(result.integrity).toBe("CI-UNKNOWN");
  });

  it("containment is CT-UNKNOWN", () => {
    expect(result.containment).toBe("CT-UNKNOWN");
  });

  it("replay is R-AMBIGUOUS (preserves ambiguity)", () => {
    expect(result.replay).toBe("R-AMBIGUOUS");
  });

  it("reason is preserved in result", () => {
    expect(result.reason).toBe("feed-timeout");
  });

  it("result is frozen", () => {
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("different reasons produce different reason fields", () => {
    const r1 = handleTelemetryAbsence("stale-feed");
    const r2 = handleTelemetryAbsence("disconnected");
    expect(r1.reason).toBe("stale-feed");
    expect(r2.reason).toBe("disconnected");
  });
});

// ─── 6. EXCEPTION_SEVERITY vocabulary ────────────────────────────────────────

describe("W2-PR172A — EXCEPTION_SEVERITY vocabulary", () => {
  it("contains exactly 5 levels", () => {
    expect(EXCEPTION_SEVERITY).toHaveLength(5);
  });

  it("contains BLOCKING", () => expect(EXCEPTION_SEVERITY).toContain("BLOCKING"));
  it("contains WARNING", () => expect(EXCEPTION_SEVERITY).toContain("WARNING"));
  it("contains INFO", () => expect(EXCEPTION_SEVERITY).toContain("INFO"));
  it("contains LEGACY", () => expect(EXCEPTION_SEVERITY).toContain("LEGACY"));
  it("contains EXPERIMENTAL", () => expect(EXCEPTION_SEVERITY).toContain("EXPERIMENTAL"));
});

// ─── 7. EXCEPTION_KIND vocabulary ────────────────────────────────────────────

describe("W2-PR172A — EXCEPTION_KIND vocabulary", () => {
  it("contains exactly 5 kinds", () => {
    expect(EXCEPTION_KIND).toHaveLength(5);
  });

  it("contains lexicon-allowlist", () => expect(EXCEPTION_KIND).toContain("lexicon-allowlist"));
  it("contains adoption-allowlist", () => expect(EXCEPTION_KIND).toContain("adoption-allowlist"));
  it("contains deferred-cleanup", () => expect(EXCEPTION_KIND).toContain("deferred-cleanup"));
  it("contains legacy-grandfather", () => expect(EXCEPTION_KIND).toContain("legacy-grandfather"));
  it("contains experimental-suppression", () => expect(EXCEPTION_KIND).toContain("experimental-suppression"));
});

// ─── 8. MAX_EXCEPTION_DURATION_DAYS ──────────────────────────────────────────

describe("W2-PR172A — MAX_EXCEPTION_DURATION_DAYS", () => {
  it("is 90 days", () => {
    expect(MAX_EXCEPTION_DURATION_DAYS).toBe(90);
  });
});

// ─── 9. validateException — valid exception ───────────────────────────────────

describe("W2-PR172A — validateException: valid exception", () => {
  it("fully-formed valid exception → zero errors", () => {
    const errors = validateException(validException(), NOW);
    expect(errors).toHaveLength(0);
  });
});

// ─── 10. validateException — missing-field ────────────────────────────────────

describe("W2-PR172A — validateException: missing-field", () => {
  it("missing id → missing-field error", () => {
    const errors = validateException({ ...validException(), id: "" }, NOW);
    expect(errors.some((e) => e.tag === "missing-field" && e.field === "id")).toBe(true);
  });

  it("missing justification → missing-field error", () => {
    const errors = validateException({ ...validException(), justification: "" }, NOW);
    expect(errors.some((e) => e.tag === "missing-field" && e.field === "justification")).toBe(true);
  });
});

// ─── 11. validateException — expired ─────────────────────────────────────────

describe("W2-PR172A — validateException: expired", () => {
  it("past expiresAt → expired error", () => {
    const errors = validateException(
      validException({ expiresAt: "2025-01-01", approvedAt: "2024-10-01" }),
      NOW,
    );
    expect(errors.some((e) => e.tag === "expired")).toBe(true);
  });
});

// ─── 12. validateException — expiration-too-far-out ──────────────────────────

describe("W2-PR172A — validateException: expiration-too-far-out", () => {
  it("duration > 90 days → expiration-too-far-out error", () => {
    const errors = validateException(
      validException({ approvedAt: "2026-05-10", expiresAt: "2026-12-31" }), // 235 days
      NOW,
    );
    expect(errors.some((e) => e.tag === "expiration-too-far-out")).toBe(true);
  });
});

// ─── 13. validateException — invalid-id-format ───────────────────────────────

describe("W2-PR172A — validateException: invalid-id-format", () => {
  it("ID not matching EXC-YYYY-NNN format → invalid-id-format error", () => {
    const errors = validateException(validException({ id: "BAD-ID" }), NOW);
    expect(errors.some((e) => e.tag === "invalid-id-format")).toBe(true);
  });

  it("valid EXC-2026-001 format → no invalid-id-format error", () => {
    const errors = validateException(validException(), NOW);
    expect(errors.some((e) => e.tag === "invalid-id-format")).toBe(false);
  });
});

// ─── 14. defaultSeverityForTag ────────────────────────────────────────────────

describe("W2-PR172A — defaultSeverityForTag", () => {
  it("missing-registry-import → BLOCKING", () => {
    expect(defaultSeverityForTag("missing-registry-import")).toBe("BLOCKING");
  });

  it("ad-hoc-rendering → BLOCKING", () => {
    expect(defaultSeverityForTag("ad-hoc-rendering")).toBe("BLOCKING");
  });

  it("lexicon-violation → BLOCKING", () => {
    expect(defaultSeverityForTag("lexicon-violation")).toBe("BLOCKING");
  });

  it("migration-surface → WARNING", () => {
    expect(defaultSeverityForTag("migration-surface")).toBe("WARNING");
  });

  it("legacy-grandfathered → LEGACY", () => {
    expect(defaultSeverityForTag("legacy-grandfathered")).toBe("LEGACY");
  });

  it("experimental → EXPERIMENTAL", () => {
    expect(defaultSeverityForTag("experimental")).toBe("EXPERIMENTAL");
  });

  it("unknown tag → WARNING (safe default)", () => {
    expect(defaultSeverityForTag("completely-unknown-tag")).toBe("WARNING");
  });
});

// ─── 15. remediationGuidance ──────────────────────────────────────────────────

describe("W2-PR172A — remediationGuidance", () => {
  it("missing-registry-import → non-empty guidance string", () => {
    expect(remediationGuidance("missing-registry-import").length).toBeGreaterThan(10);
  });

  it("ad-hoc-rendering → non-empty guidance string", () => {
    expect(remediationGuidance("ad-hoc-rendering").length).toBeGreaterThan(10);
  });

  it("lexicon-violation with phrase → guidance includes the phrase", () => {
    const guidance = remediationGuidance("lexicon-violation", { phrase: "automatically verified" });
    expect(guidance).toContain("automatically verified");
  });

  it("unknown tag → returns fallback guidance string", () => {
    expect(remediationGuidance("unknown-tag").length).toBeGreaterThan(0);
  });
});

// ─── 16. EXCEPTION_LIFECYCLE vocabulary ──────────────────────────────────────

describe("W2-PR172A — EXCEPTION_LIFECYCLE vocabulary", () => {
  it("contains exactly 6 states", () => {
    expect(EXCEPTION_LIFECYCLE).toHaveLength(6);
  });

  it("contains PROPOSED", () => expect(EXCEPTION_LIFECYCLE).toContain("PROPOSED"));
  it("contains REVIEWED", () => expect(EXCEPTION_LIFECYCLE).toContain("REVIEWED"));
  it("contains APPROVED", () => expect(EXCEPTION_LIFECYCLE).toContain("APPROVED"));
  it("contains APPLIED", () => expect(EXCEPTION_LIFECYCLE).toContain("APPLIED"));
  it("contains CLOSED", () => expect(EXCEPTION_LIFECYCLE).toContain("CLOSED"));
  it("contains REJECTED", () => expect(EXCEPTION_LIFECYCLE).toContain("REJECTED"));
});

// ─── 17. computeExceptionReceiptId ───────────────────────────────────────────

describe("W2-PR172A — computeExceptionReceiptId", () => {
  const input = {
    proposingActor: "op-1",
    proposedAt: NOW,
    justification: "test",
    impactedReplayState: false,
    impactedAmbiguityState: false,
  };

  it("returns a 64-char hex string", () => {
    expect(computeExceptionReceiptId(input)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for identical inputs", () => {
    const r1 = computeExceptionReceiptId(input);
    const r2 = computeExceptionReceiptId(input);
    expect(r1).toBe(r2);
  });

  it("changes when proposingActor changes", () => {
    const r1 = computeExceptionReceiptId(input);
    const r2 = computeExceptionReceiptId({ ...input, proposingActor: "op-2" });
    expect(r1).not.toBe(r2);
  });

  it("changes when impactedAmbiguityState changes", () => {
    const r1 = computeExceptionReceiptId(input);
    const r2 = computeExceptionReceiptId({ ...input, impactedAmbiguityState: true });
    expect(r1).not.toBe(r2);
  });
});

// ─── 18. validateExceptionApplication — valid application ────────────────────

describe("W2-PR172A — validateExceptionApplication: valid", () => {
  it("fully-valid PROPOSED application → zero violations", () => {
    const violations = validateExceptionApplication(validApplication());
    expect(violations).toHaveLength(0);
  });
});

// ─── 19. validateExceptionApplication — missing-field ────────────────────────

describe("W2-PR172A — validateExceptionApplication: missing-field", () => {
  it("missing applicationId → missing-field violation", () => {
    const violations = validateExceptionApplication({ ...validApplication(), applicationId: "" });
    expect(violations.some((v) => v.tag === "missing-field" && v.field === "applicationId")).toBe(true);
  });

  it("missing justification → missing-field violation", () => {
    const violations = validateExceptionApplication({ ...validApplication(), justification: "" });
    expect(violations.some((v) => v.tag === "missing-field" && v.field === "justification")).toBe(true);
  });
});

// ─── 20. validateExceptionApplication — state violations ─────────────────────

describe("W2-PR172A — validateExceptionApplication: state violations", () => {
  it("APPROVED state without reviewingActor → approved-without-reviewer", () => {
    const app = validApplication({ state: "APPROVED", reviewingActor: undefined });
    const violations = validateExceptionApplication(app);
    expect(violations.some((v) => v.tag === "approved-without-reviewer")).toBe(true);
  });

  it("APPLIED state without approvingActor → applied-without-approver", () => {
    const app = validApplication({
      state: "APPLIED",
      reviewingActor: "reviewer-1",
      approvingActor: undefined,
    });
    const violations = validateExceptionApplication(app);
    expect(violations.some((v) => v.tag === "applied-without-approver")).toBe(true);
  });

  it("REJECTED state without closingReason → closed-without-reason", () => {
    const app = validApplication({ state: "REJECTED", closingReason: undefined });
    const violations = validateExceptionApplication(app);
    expect(violations.some((v) => v.tag === "closed-without-reason")).toBe(true);
  });

  it("CLOSED state without closingReason → closed-without-reason", () => {
    const app = validApplication({ state: "CLOSED", closingReason: undefined });
    const violations = validateExceptionApplication(app);
    expect(violations.some((v) => v.tag === "closed-without-reason")).toBe(true);
  });
});

// ─── 21. validateExceptionApplication — receipt-id-mismatch ──────────────────

describe("W2-PR172A — validateExceptionApplication: receipt-id-mismatch", () => {
  it("tampered applicationReceiptId → receipt-id-mismatch violation", () => {
    const app = validApplication({ applicationReceiptId: "0".repeat(64) });
    const violations = validateExceptionApplication(app);
    expect(violations.some((v) => v.tag === "receipt-id-mismatch")).toBe(true);
  });
});

// ─── 22. buildExceptionGovernanceReport ──────────────────────────────────────

describe("W2-PR172A — buildExceptionGovernanceReport", () => {
  it("empty applications → zero violations, hasCiGatingCondition=false", () => {
    const report = buildExceptionGovernanceReport([], NOW);
    expect(report.violations).toHaveLength(0);
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("valid application → zero violations", () => {
    const report = buildExceptionGovernanceReport([validApplication()], NOW);
    expect(report.violations).toHaveLength(0);
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("invalid application → violations present, hasCiGatingCondition=true", () => {
    const badApp = validApplication({ applicationReceiptId: "tampered" });
    const report = buildExceptionGovernanceReport([badApp], NOW);
    expect(report.hasCiGatingCondition).toBe(true);
    expect(report.violations.length).toBeGreaterThan(0);
  });

  it("applicationsEvaluated matches input length", () => {
    const report = buildExceptionGovernanceReport([validApplication()], NOW);
    expect(report.applicationsEvaluated).toBe(1);
  });

  it("executedAt is the passed ISO string", () => {
    const report = buildExceptionGovernanceReport([], NOW);
    expect(report.executedAt).toBe(NOW);
  });

  it("report is frozen", () => {
    expect(Object.isFrozen(buildExceptionGovernanceReport([], NOW))).toBe(true);
  });
});
