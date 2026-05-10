/**
 * W2-PR133A — Replay Lineage Verification.
 *
 * Validates that:
 *   - validateReplayTransition accepts all canonical transitions and rejects all forbidden ones
 *   - validateCausalLineage requires replayRef for R-AMBIGUOUS stabilization transitions
 *   - Every recovery-like transition requires evidenceRef
 *   - Cross-state reclassification transitions require re-investigation evidence
 */

import { describe, expect, it } from "vitest";

import {
  REPLAY_STATES,
  REPLAY_TRANSITIONS,
  validateReplayTransition,
  validateCausalLineage,
  type ReplayState,
  type TransitionAuditEvent,
  type CausalLineageRefs,
} from "../index.js";

// ─── 1. Canonical transitions are all accepted ─────────────────────────────

describe("W2-PR133A — validateReplayTransition: canonical allowed paths", () => {
  for (const t of REPLAY_TRANSITIONS) {
    it(`allows ${t.from} → ${t.to}`, () => {
      const result = validateReplayTransition(t.from, t.to);
      expect(result.tag).toBe("allowed");
    });
  }

  it("no-op (same → same) returns no-op tag for every state", () => {
    for (const s of REPLAY_STATES) {
      const result = validateReplayTransition(s, s);
      expect(result.tag).toBe("no-op");
    }
  });
});

// ─── 2. Forbidden transitions are all rejected ────────────────────────────

/**
 * Enumerates state pairs NOT present in REPLAY_TRANSITIONS and not self-loops.
 * Every such pair MUST be rejected by validateReplayTransition.
 */
function forbiddenPairs(): Array<{ from: ReplayState; to: ReplayState }> {
  const allowed = new Set(REPLAY_TRANSITIONS.map((t) => `${t.from}→${t.to}`));
  const pairs: Array<{ from: ReplayState; to: ReplayState }> = [];
  for (const from of REPLAY_STATES) {
    for (const to of REPLAY_STATES) {
      if (from !== to && !allowed.has(`${from}→${to}`)) {
        pairs.push({ from, to });
      }
    }
  }
  return pairs;
}

describe("W2-PR133A — validateReplayTransition: forbidden transitions all blocked", () => {
  const forbidden = forbiddenPairs();

  it("at least 6 state pairs are forbidden (graph completeness guard)", () => {
    // 5 states × 4 non-self = 20 possible directed pairs; 12 are allowed → ≥ 8 forbidden
    expect(forbidden.length).toBeGreaterThanOrEqual(6);
  });

  for (const { from, to } of forbidden) {
    it(`blocks ${from} → ${to} (impossible jump)`, () => {
      const result = validateReplayTransition(from, to);
      expect(result.tag).toBe("forbidden");
    });
  }

  it("R-COLLAPSED → R-OBSERVED is forbidden (must transit via R-AMBIGUOUS)", () => {
    const result = validateReplayTransition("R-COLLAPSED", "R-OBSERVED");
    expect(result.tag).toBe("forbidden");
  });

  it("R-DENIED → R-COLLAPSED is forbidden (no direct denied-to-collapsed path)", () => {
    const result = validateReplayTransition("R-DENIED", "R-COLLAPSED");
    expect(result.tag).toBe("forbidden");
  });

  it("R-ACCEPTED → R-DENIED is forbidden (requires re-investigation via R-AMBIGUOUS)", () => {
    const result = validateReplayTransition("R-ACCEPTED", "R-DENIED");
    expect(result.tag).toBe("forbidden");
  });
});

// ─── 3. validateCausalLineage: replay-stabilization requires replayRef ──────

function makeLineage(overrides: Partial<CausalLineageRefs> = {}): CausalLineageRefs {
  return {
    evidenceRef: "ev-001",
    continuityRef: null,
    replayRef: "rp-001",
    telemetryRef: null,
    confidenceSource: "audit-trail",
    causalityReason: "IDEMPOTENT_REPLAY row found for correlationId",
    ...overrides,
  };
}

function makeEvent(
  from: ReplayState,
  to: ReplayState,
  lineage?: CausalLineageRefs,
): TransitionAuditEvent<ReplayState> {
  return {
    axis: "replay",
    previousState: from,
    nextState: to,
    timestamp: "2026-01-01T00:00:00Z",
    actor: "audit-engine",
    transitionReason: "classification resolved",
    evidenceReference: null,
    continuityConfidence: "STRONG",
    lineage,
    causalConfidence: "CONFIRMED",
  };
}

describe("W2-PR133A — validateCausalLineage: replay-stabilization transitions", () => {
  it("R-AMBIGUOUS → R-OBSERVED with replayRef passes causal validation", () => {
    const event = makeEvent("R-AMBIGUOUS", "R-OBSERVED", makeLineage());
    const errors = validateCausalLineage(event, {
      isRecovery: false,
      isReplayStabilization: true,
      evidenceRequiredByGraph: "IDEMPOTENT_REPLAY audit row found",
    });
    expect(errors.length).toBe(0);
  });

  it("R-AMBIGUOUS → R-OBSERVED WITHOUT replayRef fails with missing-replay-ref", () => {
    const event = makeEvent("R-AMBIGUOUS", "R-OBSERVED", makeLineage({ replayRef: null }));
    const errors = validateCausalLineage(event, {
      isRecovery: false,
      isReplayStabilization: true,
      evidenceRequiredByGraph: "IDEMPOTENT_REPLAY audit row found",
    });
    expect(errors.map((e) => e.tag)).toContain("missing-replay-ref");
  });

  it("R-AMBIGUOUS → R-COLLAPSED WITHOUT replayRef fails", () => {
    const event = makeEvent("R-AMBIGUOUS", "R-COLLAPSED", makeLineage({ replayRef: "" }));
    const errors = validateCausalLineage(event, {
      isRecovery: false,
      isReplayStabilization: true,
      evidenceRequiredByGraph: "CONCURRENCY_GUARD_TRIGGERED row found",
    });
    expect(errors.map((e) => e.tag)).toContain("missing-replay-ref");
  });

  it("no lineage at all on stabilization transition fails with missing-replay-ref", () => {
    const event = makeEvent("R-AMBIGUOUS", "R-DENIED", undefined);
    const errors = validateCausalLineage(event, {
      isRecovery: false,
      isReplayStabilization: true,
      evidenceRequiredByGraph: null,
    });
    expect(errors.map((e) => e.tag)).toContain("missing-replay-ref");
  });
});

describe("W2-PR133A — validateCausalLineage: evidence-required transitions", () => {
  it("evidenceRequiredByGraph forces evidenceRef presence", () => {
    const event = makeEvent("R-OBSERVED", "R-DENIED", makeLineage({ evidenceRef: null }));
    const errors = validateCausalLineage(event, {
      isRecovery: false,
      isReplayStabilization: false,
      evidenceRequiredByGraph: "re-investigation evidence required",
    });
    expect(errors.map((e) => e.tag)).toContain("missing-evidence-ref");
  });

  it("CONFIRMED confidence without evidenceRef fails with confidence-without-evidence", () => {
    const event = makeEvent("R-AMBIGUOUS", "R-OBSERVED", makeLineage({ evidenceRef: "" }));
    const errors = validateCausalLineage(event, {
      isRecovery: false,
      isReplayStabilization: false,
      evidenceRequiredByGraph: null,
    });
    expect(errors.map((e) => e.tag)).toContain("confidence-without-evidence");
  });

  it("empty confidenceSource fails with missing-confidence-source", () => {
    const event = makeEvent("R-AMBIGUOUS", "R-OBSERVED", makeLineage({ confidenceSource: "" }));
    const errors = validateCausalLineage(event, {
      isRecovery: false,
      isReplayStabilization: false,
      evidenceRequiredByGraph: null,
    });
    expect(errors.map((e) => e.tag)).toContain("missing-confidence-source");
  });
});

// ─── 4. REPLAY_TRANSITIONS graph completeness ─────────────────────────────

describe("W2-PR133A — REPLAY_TRANSITIONS graph completeness", () => {
  it("R-AMBIGUOUS appears as 'from' state (it can always be resolved with evidence)", () => {
    const fromStates = REPLAY_TRANSITIONS.map((t) => t.from);
    expect(fromStates).toContain("R-AMBIGUOUS");
  });

  it("R-AMBIGUOUS → resolved state transitions always require evidenceRequired (non-null)", () => {
    const resolutions = REPLAY_TRANSITIONS.filter(
      (t) => t.from === "R-AMBIGUOUS" && t.to !== "R-AMBIGUOUS",
    );
    for (const t of resolutions) {
      expect(t.evidenceRequired).not.toBeNull();
      expect(t.evidenceRequired!.length).toBeGreaterThan(0);
    }
  });

  it("every resolved → R-AMBIGUOUS transition has an entry (ambiguity can always resurface)", () => {
    const resolvedStates: ReplayState[] = ["R-OBSERVED", "R-DENIED", "R-ACCEPTED", "R-COLLAPSED"];
    for (const s of resolvedStates) {
      const found = REPLAY_TRANSITIONS.some((t) => t.from === s && t.to === "R-AMBIGUOUS");
      expect(found, `${s} → R-AMBIGUOUS must exist`).toBe(true);
    }
  });

  it("all transitions reference only known REPLAY_STATES values", () => {
    const states = new Set(REPLAY_STATES as readonly string[]);
    for (const t of REPLAY_TRANSITIONS) {
      expect(states.has(t.from), `unknown from: ${t.from}`).toBe(true);
      expect(states.has(t.to), `unknown to: ${t.to}`).toBe(true);
    }
  });
});
