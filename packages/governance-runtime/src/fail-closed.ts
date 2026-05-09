/**
 * Fail-closed helpers.
 *
 * Doctrine: docs/ops/AUTHORIZATION_BASELINE_V1.md §4.3
 *           docs/ops/FAIL_CLOSED_MATRIX.md
 *
 * Per W2-PR18A non-negotiable rules:
 *   1. Unknown ≠ healthy.
 *   2. Missing telemetry ≠ healthy telemetry.
 *   4. Undefined survivability must remain degraded.
 *   7. Runtime optimism-by-absence is forbidden.
 *
 * All helpers in this module:
 *   - Accept any unknown input.
 *   - Return an EXPLICIT degraded-or-unknown value.
 *   - NEVER coerce unknown → healthy / green / safe.
 */

import { type IntegrityState, parseIntegrityState } from "./integrity-state.js";
import { type ContainmentState, parseContainmentState } from "./containment-state.js";
import { type ReplayState, parseReplayState } from "./replay-state.js";
import { type TrustClass, parseTrustClass } from "./trust-class.js";

/**
 * Fail-closed integrity rendering.
 *
 * Input: any runtime-derived value purporting to be an integrity state.
 * Output: a definite IntegrityState — CI-UNKNOWN if input cannot be parsed.
 *
 * NEVER returns CI-GREEN for unparseable input. NEVER throws.
 */
export function failClosedIntegrity(value: unknown): IntegrityState {
  return parseIntegrityState(value);
}

/**
 * Fail-closed containment rendering.
 * NEVER returns CT-GREEN for unparseable input.
 */
export function failClosedContainment(value: unknown): ContainmentState {
  return parseContainmentState(value);
}

/**
 * Fail-closed replay-state rendering.
 *
 * Input: any runtime-derived value purporting to be a replay state.
 * Output: ReplayState OR "R-AMBIGUOUS" (the explicit ambiguity-visible default).
 *
 * NEVER silently maps unknown to R-OBSERVED, R-DENIED, or any other
 * state that implies determinism. R-AMBIGUOUS preserves ambiguity per
 * W2-PR19A rule #4.
 */
export function failClosedReplayState(value: unknown): ReplayState {
  return parseReplayState(value) ?? "R-AMBIGUOUS";
}

/**
 * Fail-closed trust-class assignment.
 *
 * Returns null for unparseable input — caller MUST handle (no silent fallback).
 * Per W2-PR18A rule #4: "Unknown states may not silently default healthy."
 *
 * Trust-class assignment is REQUIRED for every audit-emitting code path; a
 * null return signals to the caller that the path's class is undeclared and
 * must be resolved before proceeding.
 */
export function failClosedTrustClass(value: unknown): TrustClass | null {
  return parseTrustClass(value);
}

/**
 * Telemetry-absence handler.
 *
 * Per W2-PR18A target 5: "missing telemetry NEVER renders healthy, safe, or complete."
 *
 * Use when telemetry feed is missing/stale/unavailable; returns the
 * fail-closed state for each axis.
 */
export interface TelemetryAbsenceResult {
  readonly integrity: IntegrityState;
  readonly containment: ContainmentState;
  readonly replay: ReplayState;
  readonly reason: string;
}

export function handleTelemetryAbsence(reason: string): TelemetryAbsenceResult {
  return Object.freeze({
    integrity: "CI-UNKNOWN",
    containment: "CT-UNKNOWN",
    replay: "R-AMBIGUOUS",
    reason,
  });
}

/**
 * Exhaustiveness assertion.
 *
 * Use in switch statements over discriminated unions. Compiler enforces
 * the function is unreachable at compile time; runtime throws if reached
 * (defensive — should never fire if types are correct).
 *
 * Per W2-PR18A target 6: "impossible states explicit; invalid trust-class
 * combinations rejected."
 */
export function assertNever(value: never, context = "unhandled state"): never {
  throw new Error(
    `${context}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`,
  );
}
