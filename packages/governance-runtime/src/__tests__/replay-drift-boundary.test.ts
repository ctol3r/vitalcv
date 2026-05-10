/**
 * W2-PR133A — Replay Drift-Boundary Enforcement.
 *
 * Pins the replay state set, validates that no doctrine drift has occurred
 * in operator-visible strings, verifies cognitive-load level caps, and
 * confirms that the assertNever exhaustiveness guard is functional.
 *
 * Doctrine: docs/ops/TRUST_GUARANTEE_LEXICON.md §1.3
 *           docs/ops/replay-taxonomy-map.md §1
 */

import { describe, expect, it } from "vitest";

import {
  REPLAY_STATES,
  REPLAY_TRANSITIONS,
  replayStateDescription,
  assertNever,
  failClosedReplayState,
  handleTelemetryAbsence,
} from "../index.js";

import {
  REPLAY_ABSTRACTION_LEVELS,
  buildOperatorReplayDigest,
} from "../replay-cognition.js";

import {
  buildReplaySurvivabilityReport,
} from "../replay-survivability.js";

import { appendEpoch, emptyLedger, type GovernanceEpoch } from "../longitudinal-memory.js";

// ─── 1. State-set drift pin ───────────────────────────────────────────────────

describe("W2-PR133A — REPLAY_STATES drift pin", () => {
  it("REPLAY_STATES is exactly the 5 canonical strings (drift pin)", () => {
    const expected = new Set(["R-OBSERVED", "R-DENIED", "R-ACCEPTED", "R-COLLAPSED", "R-AMBIGUOUS"]);
    const actual = new Set([...REPLAY_STATES]);
    expect(actual).toEqual(expected);
  });

  it("REPLAY_STATES has no duplicate values", () => {
    const set = new Set(REPLAY_STATES);
    expect(set.size).toBe(REPLAY_STATES.length);
  });

  it("every REPLAY_STATE appears in REPLAY_TRANSITIONS as either from or to", () => {
    const covered = new Set<string>([
      ...REPLAY_TRANSITIONS.map((t) => t.from),
      ...REPLAY_TRANSITIONS.map((t) => t.to),
    ]);
    for (const s of REPLAY_STATES) {
      expect(covered.has(s), `${s} is orphaned — not in any transition`).toBe(true);
    }
  });
});

// ─── 2. Forbidden-phrase drift scan ─────────────────────────────────────────

const LEXICON_FORBIDDEN = [
  "replay protected",
  "replay-resistant",
  "replay-secure",
  "replay prevention",
  "guaranteed",
  "automatically verified",
  "risk transferred",
  "certified compliant",
  "instant",
] as const;

describe("W2-PR133A — replayStateDescription forbidden-phrase scan", () => {
  for (const phrase of LEXICON_FORBIDDEN) {
    it(`no replayStateDescription contains "${phrase}"`, () => {
      for (const s of REPLAY_STATES) {
        const desc = replayStateDescription(s).toLowerCase();
        expect(desc, `${s} description contains forbidden phrase: ${phrase}`).not.toContain(
          phrase.toLowerCase(),
        );
      }
    });
  }
});

// ─── 3. assertNever exhaustiveness guard ─────────────────────────────────────

describe("W2-PR133A — assertNever runtime guard", () => {
  it("throws on a value that should be unreachable", () => {
    const bad = "PHANTOM-STATE" as never;
    expect(() => assertNever(bad, "test context")).toThrow(/test context/);
  });

  it("error message contains the offending value", () => {
    const bad = "PHANTOM-STATE" as never;
    expect(() => assertNever(bad)).toThrow(/PHANTOM-STATE/);
  });
});

// ─── 4. Fail-closed telemetry-absence coherence ──────────────────────────────

describe("W2-PR133A — fail-closed telemetry-absence replay drift", () => {
  it("failClosedReplayState(undefined) is R-AMBIGUOUS (no drift from absence default)", () => {
    expect(failClosedReplayState(undefined)).toBe("R-AMBIGUOUS");
  });

  it("absence result is immutable (Object.freeze check)", () => {
    const result = handleTelemetryAbsence("freeze-test");
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("absence replay field matches direct fail-closed call with null input", () => {
    const a = handleTelemetryAbsence("test");
    const b = failClosedReplayState(null);
    expect(a.replay).toBe(b);
  });
});

// ─── 5. Cognitive-load level cap enforcement ─────────────────────────────────

function buildMinimalLedger(): ReturnType<typeof emptyLedger> {
  const e: GovernanceEpoch = {
    activeOverrideCount: 0,
    expiredOverrideCount: 0,
    overRenewedOverrideCount: 0,
    replayAmbiguousCount: 2,
    replayCollapsedCount: 1,
    integrityDegradedCount: 0,
    containmentDegradedCount: 0,
    recoveryAttemptCount: 0,
    recoveryFailureCount: 0,
    contradictionCount: 0,
    aggregateVerificationConfidence: "VERIFIED",
    degradedDomainTallies: {},
    observedAt: "2026-01-01T00:00:00Z",
  };
  return appendEpoch(emptyLedger(), e);
}

// LEVEL_INDICATOR_CAP mirrors replay-cognition.ts (drift-pin: update both together)
const LEVEL_CAP: Record<string, number | null> = {
  HEADLINE: 1,
  SUMMARY: 7,
  DETAIL: 20,
  RAW: null,
};

describe("W2-PR133A — operator digest indicator caps (cognitive-load drift)", () => {
  const ledger = buildMinimalLedger();
  const report = buildReplaySurvivabilityReport(ledger, "2026-01-01T01:00:00Z");

  it("HEADLINE digest has exactly 1 indicator", () => {
    const digest = buildOperatorReplayDigest(report, "HEADLINE");
    expect(digest.indicators.length).toBe(1);
  });

  it("SUMMARY digest has ≤ 7 indicators", () => {
    const digest = buildOperatorReplayDigest(report, "SUMMARY");
    expect(digest.indicators.length).toBeLessThanOrEqual(7);
  });

  it("DETAIL digest has ≤ 20 indicators", () => {
    const digest = buildOperatorReplayDigest(report, "DETAIL");
    expect(digest.indicators.length).toBeLessThanOrEqual(20);
  });

  it("every non-RAW level stays within its documented cap", () => {
    for (const level of REPLAY_ABSTRACTION_LEVELS) {
      const cap = LEVEL_CAP[level];
      if (cap === null) continue; // RAW is uncapped
      const digest = buildOperatorReplayDigest(report, level);
      expect(
        digest.indicators.length,
        `${level} has ${digest.indicators.length} indicators (cap: ${cap})`,
      ).toBeLessThanOrEqual(cap);
    }
  });

  it("every digest cites source score (lineage never severed)", () => {
    for (const level of REPLAY_ABSTRACTION_LEVELS) {
      const digest = buildOperatorReplayDigest(report, level);
      expect(digest.sourceScore).toBe(report.score.survivabilityScore);
      expect(digest.sourceConfidence).toBe(report.score.confidence);
    }
  });

  it("digest hash is non-empty and 64-char hex (SHA-256)", () => {
    const digest = buildOperatorReplayDigest(report, "SUMMARY");
    expect(digest.digestHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("digest is immutable (Object.freeze check)", () => {
    const digest = buildOperatorReplayDigest(report, "HEADLINE");
    expect(Object.isFrozen(digest)).toBe(true);
  });
});
