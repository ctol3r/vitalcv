/**
 * W2-PR133A — Global Replay Integrity Scan.
 *
 * Validates that the complete governance-runtime replay surface is:
 *   - Fail-closed: unknown input NEVER coerces to an optimistic state
 *   - Lexicon-compliant: no forbidden phrases in operator-visible strings
 *   - Cross-surface coherent: failClosedReplayState and handleTelemetryAbsence agree
 *   - State-set pinned: REPLAY_STATES has exactly the canonical 5 members
 *   - Deterministic: classifyReplayState is a total function (never returns null)
 */

import { describe, expect, it } from "vitest";

import {
  REPLAY_STATES,
  parseReplayState,
  replayStateDescription,
  classifyReplayState,
  failClosedReplayState,
  handleTelemetryAbsence,
} from "../index.js";

// Phrases banned by TRUST_GUARANTEE_LEXICON.md §1.3 + CLAUDE.md
const FORBIDDEN_PHRASES = [
  "replay protected",
  "replay-resistant",
  "replay-secure",
  "automatically verified",
  "guaranteed verification",
  "replay prevention",
  "replay prevented",
  "attack prevented",
  "risk transferred",
] as const;

// ─── 1. State-set integrity ───────────────────────────────────────────────────

describe("W2-PR133A — REPLAY_STATES set integrity", () => {
  it("has exactly 5 canonical states", () => {
    expect(REPLAY_STATES.length).toBe(5);
  });

  it("contains exactly the expected state identifiers in canonical order", () => {
    expect([...REPLAY_STATES]).toEqual([
      "R-OBSERVED",
      "R-DENIED",
      "R-ACCEPTED",
      "R-COLLAPSED",
      "R-AMBIGUOUS",
    ]);
  });

  it("every state parses round-trip via parseReplayState", () => {
    for (const s of REPLAY_STATES) {
      expect(parseReplayState(s)).toBe(s);
    }
  });
});

// ─── 2. Fail-closed exhaustive ────────────────────────────────────────────────

describe("W2-PR133A — failClosedReplayState (exhaustive chaos)", () => {
  const GARBAGE: readonly unknown[] = [
    null,
    undefined,
    0,
    1,
    -1,
    NaN,
    Infinity,
    true,
    false,
    "",
    "unknown",
    "OBSERVED",        // missing prefix
    "r-observed",      // wrong case
    "R_OBSERVED",      // wrong separator
    "R-AMBIGUOUS ",    // trailing space
    " R-AMBIGUOUS",    // leading space
    {},
    [],
    Symbol("x"),
    42n,
  ];

  for (const bad of GARBAGE) {
    const label = typeof bad === "bigint" ? `${bad}n` : JSON.stringify(bad) ?? String(bad);
    it(`garbage input ${label} → R-AMBIGUOUS, never optimistic`, () => {
      const result = failClosedReplayState(bad);
      expect(result).toBe("R-AMBIGUOUS");
    });
  }

  it("valid R-OBSERVED string passes through unchanged", () => {
    expect(failClosedReplayState("R-OBSERVED")).toBe("R-OBSERVED");
  });

  it("valid R-DENIED string passes through unchanged", () => {
    expect(failClosedReplayState("R-DENIED")).toBe("R-DENIED");
  });

  it("valid R-ACCEPTED string passes through unchanged", () => {
    expect(failClosedReplayState("R-ACCEPTED")).toBe("R-ACCEPTED");
  });

  it("valid R-COLLAPSED string passes through unchanged", () => {
    expect(failClosedReplayState("R-COLLAPSED")).toBe("R-COLLAPSED");
  });
});

// ─── 3. Cross-surface coherence ───────────────────────────────────────────────

describe("W2-PR133A — cross-surface replay default coherence", () => {
  it("handleTelemetryAbsence.replay equals failClosedReplayState(null)", () => {
    const absence = handleTelemetryAbsence("test: telemetry unavailable");
    const direct = failClosedReplayState(null);
    expect(absence.replay).toBe(direct);
    expect(absence.replay).toBe("R-AMBIGUOUS");
  });

  it("handleTelemetryAbsence never returns an optimistic replay state", () => {
    const result = handleTelemetryAbsence("any reason");
    const optimisticStates: string[] = ["R-OBSERVED", "R-DENIED", "R-COLLAPSED"];
    expect(optimisticStates).not.toContain(result.replay);
  });

  it("handleTelemetryAbsence reason field is preserved unchanged", () => {
    const reason = "postgres-replica-lag-exceeded-threshold";
    const result = handleTelemetryAbsence(reason);
    expect(result.reason).toBe(reason);
  });
});

// ─── 4. Lexicon compliance ────────────────────────────────────────────────────

describe("W2-PR133A — replayStateDescription lexicon compliance", () => {
  for (const state of REPLAY_STATES) {
    it(`description for ${state} is non-empty`, () => {
      const desc = replayStateDescription(state);
      expect(desc.length).toBeGreaterThan(0);
    });

    for (const phrase of FORBIDDEN_PHRASES) {
      it(`description for ${state} does not contain "${phrase}"`, () => {
        const desc = replayStateDescription(state).toLowerCase();
        expect(desc).not.toContain(phrase.toLowerCase());
      });
    }
  }

  it("R-ACCEPTED description includes forensic-detection wording (not direct prevention)", () => {
    const desc = replayStateDescription("R-ACCEPTED").toLowerCase();
    expect(desc).toContain("forensic");
  });

  it("R-AMBIGUOUS description references disambiguation (not false clarity)", () => {
    const desc = replayStateDescription("R-AMBIGUOUS").toLowerCase();
    expect(desc).toContain("ambiguous");
  });
});

// ─── 5. classifyReplayState — total function (never null) ────────────────────

describe("W2-PR133A — classifyReplayState determinism", () => {
  it("empty row (null type, null metadata) → R-AMBIGUOUS", () => {
    expect(classifyReplayState({ type: null, metadata: null })).toBe("R-AMBIGUOUS");
  });

  it("undefined type, undefined metadata → R-AMBIGUOUS", () => {
    expect(classifyReplayState({ type: undefined, metadata: undefined })).toBe("R-AMBIGUOUS");
  });

  it("IDEMPOTENT_REPLAY type → R-OBSERVED", () => {
    expect(classifyReplayState({ type: "IDEMPOTENT_REPLAY", metadata: {} })).toBe("R-OBSERVED");
  });

  it("CONCURRENCY_GUARD_TRIGGERED type → R-COLLAPSED", () => {
    expect(classifyReplayState({ type: "CONCURRENCY_GUARD_TRIGGERED", metadata: {} })).toBe("R-COLLAPSED");
  });

  it("action ending with .duplicate_request → R-DENIED", () => {
    expect(
      classifyReplayState({ type: "something", metadata: { action: "credential.update.duplicate_request" } }),
    ).toBe("R-DENIED");
  });

  it("action ending with .already_accepted → R-DENIED", () => {
    expect(
      classifyReplayState({ type: "action", metadata: { action: "verification.submit.already_accepted" } }),
    ).toBe("R-DENIED");
  });

  it("unknown type with no action → R-AMBIGUOUS (ambiguity preserved, not null)", () => {
    const result = classifyReplayState({ type: "SOME_OTHER_EVENT", metadata: { foo: "bar" } });
    expect(result).toBe("R-AMBIGUOUS");
    expect(result).not.toBeNull();
  });

  it("result is always a member of REPLAY_STATES (no phantom state)", () => {
    const inputs = [
      { type: null, metadata: null },
      { type: "IDEMPOTENT_REPLAY", metadata: {} },
      { type: "CONCURRENCY_GUARD_TRIGGERED", metadata: {} },
      { type: "x", metadata: { action: "y.duplicate_request" } },
      { type: "x", metadata: { action: "y.already_accepted" } },
      { type: "anything", metadata: {} },
    ];
    for (const input of inputs) {
      const state = classifyReplayState(input);
      expect(REPLAY_STATES as readonly string[]).toContain(state);
    }
  });
});
