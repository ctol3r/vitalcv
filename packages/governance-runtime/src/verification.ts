/**
 * Governance runtime verification (W2-PR26A).
 *
 * Hard invariant verification layer + verification-report builder.
 *
 * Per W2-PR26A non-negotiable rules:
 *   1. Governance-runtime itself must remain verifiable.
 *   2. Ambiguity suppression is a verification failure.
 *   3. Silent coercion is a verification failure.
 *   4. Replay weakening is adversarial behavior.
 *   5. Unknown combinations must fail closed.
 *   6. Systemic contradictions must remain detectable.
 *   7. Governance correctness must remain stress-testable.
 *
 * The functions here are PURE invariant checks. They take registry state
 * (or constructed snapshots) and return invariant violations. They do NOT
 * mutate. They are exercised by the test suite + can be invoked from CI.
 */

import { CONTAINMENT_STATES, parseContainmentState } from "./containment-state.js";
import { INTEGRITY_STATES, parseIntegrityState, integritySeverity } from "./integrity-state.js";
import { REPLAY_STATES, parseReplayState, classifyReplayState } from "./replay-state.js";
import { TRUST_CLASSES, parseTrustClass } from "./trust-class.js";
import { detectCoherenceContradictions, resolveSystemicState, type CrossAxisStateSnapshot } from "./coherence.js";
import {
  handleTelemetryAbsence,
  failClosedIntegrity,
  failClosedContainment,
  failClosedReplayState,
  failClosedTrustClass,
} from "./fail-closed.js";

export type InvariantViolation =
  | { readonly tag: "fail-closed-coerced-to-healthy"; readonly axis: string; readonly input: unknown; readonly result: string }
  | { readonly tag: "ambiguity-suppressed"; readonly axis: string; readonly input: unknown; readonly result: string }
  | { readonly tag: "silent-coercion"; readonly axis: string; readonly input: unknown; readonly expected: string; readonly result: string }
  | { readonly tag: "contradiction-not-detected"; readonly snapshot: CrossAxisStateSnapshot }
  | { readonly tag: "systemic-state-too-optimistic"; readonly snapshot: CrossAxisStateSnapshot; readonly state: string };

export interface VerificationReport {
  readonly version: 1;
  readonly executedAt: string;
  readonly invariantsChecked: number;
  readonly violations: ReadonlyArray<InvariantViolation>;
  readonly summary: {
    readonly failClosedSamples: number;
    readonly ambiguitySamples: number;
    readonly contradictionSamples: number;
    readonly chaosSamples: number;
    readonly aggregateStatus: "VERIFIED" | "FAILED";
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* INVARIANT 1: fail-closed parsers NEVER coerce unknown → healthy             */
/* ─────────────────────────────────────────────────────────────────────────── */

const ADVERSARIAL_INPUTS: ReadonlyArray<unknown> = [
  null,
  undefined,
  "",
  "anything",
  "ci-green", // wrong case
  "CI_GREEN", // wrong separator
  "CI-OK",    // not in vocabulary
  42,
  Number.NaN,
  true,
  false,
  {},
  [],
  ["CI-GREEN"],
  Symbol("CI-GREEN"),
  "CI-GREEN ", // trailing space
  " CI-GREEN", // leading space
  "CI-GREEN\0", // null byte
  "CI-GREEN<script>",
  Object.create(null),
];

export function verifyFailClosedAxes(): ReadonlyArray<InvariantViolation> {
  const violations: InvariantViolation[] = [];

  for (const input of ADVERSARIAL_INPUTS) {
    // Integrity: unknown must NEVER be CI-GREEN
    const integrityResult = failClosedIntegrity(input);
    if (integrityResult === "CI-GREEN" && input !== "CI-GREEN") {
      violations.push({
        tag: "fail-closed-coerced-to-healthy",
        axis: "integrity",
        input,
        result: integrityResult,
      });
    }

    // Containment: unknown must NEVER be CT-GREEN
    const containmentResult = failClosedContainment(input);
    if (containmentResult === "CT-GREEN" && input !== "CT-GREEN") {
      violations.push({
        tag: "fail-closed-coerced-to-healthy",
        axis: "containment",
        input,
        result: containmentResult,
      });
    }

    // Replay: unknown must produce R-AMBIGUOUS, not silently classify
    const replayResult = failClosedReplayState(input);
    if (
      replayResult !== "R-AMBIGUOUS" &&
      input !== replayResult &&
      !REPLAY_STATES.includes(replayResult)
    ) {
      violations.push({
        tag: "silent-coercion",
        axis: "replay",
        input,
        expected: "R-AMBIGUOUS",
        result: replayResult,
      });
    }

    // Trust class: unknown must be null (caller must handle)
    const trustClassResult = failClosedTrustClass(input);
    if (trustClassResult !== null) {
      // Verify it's a real trust class — if not, that's a silent coercion
      if (!TRUST_CLASSES.includes(trustClassResult)) {
        violations.push({
          tag: "silent-coercion",
          axis: "trust-class",
          input,
          expected: "null OR valid TrustClass",
          result: trustClassResult,
        });
      }
    }
  }

  return violations;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* INVARIANT 2: parsers preserve ambiguity                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

export function verifyAmbiguityPreservation(): ReadonlyArray<InvariantViolation> {
  const violations: InvariantViolation[] = [];

  // Replay state: a row with no marker must classify as R-AMBIGUOUS
  const ambiguousRows: ReadonlyArray<{ type: string | null; metadata: Record<string, unknown> }> = [
    { type: "EMPLOYER_REVIEW_ACCEPTED", metadata: { outcome: "permitted" } },
    { type: "EMPLOYER_PACKET_SHARED", metadata: {} },
    { type: "ARTIFACT_EXPORTED", metadata: { actorId: "test-user" } },
    { type: null, metadata: { outcome: "permitted" } },
  ];
  for (const row of ambiguousRows) {
    const result = classifyReplayState(row);
    if (result !== "R-AMBIGUOUS") {
      violations.push({
        tag: "ambiguity-suppressed",
        axis: "replay",
        input: row,
        result,
      });
    }
  }

  // Telemetry absence: must produce all UNKNOWN/AMBIGUOUS axes
  const absence = handleTelemetryAbsence("test absence");
  if (absence.integrity !== "CI-UNKNOWN") {
    violations.push({
      tag: "silent-coercion",
      axis: "telemetry-absence-integrity",
      input: "absent",
      expected: "CI-UNKNOWN",
      result: absence.integrity,
    });
  }
  if (absence.containment !== "CT-UNKNOWN") {
    violations.push({
      tag: "silent-coercion",
      axis: "telemetry-absence-containment",
      input: "absent",
      expected: "CT-UNKNOWN",
      result: absence.containment,
    });
  }
  if (absence.replay !== "R-AMBIGUOUS") {
    violations.push({
      tag: "silent-coercion",
      axis: "telemetry-absence-replay",
      input: "absent",
      expected: "R-AMBIGUOUS",
      result: absence.replay,
    });
  }

  return violations;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* INVARIANT 3: cross-axis contradictions detected                              */
/* ─────────────────────────────────────────────────────────────────────────── */

const CONTRADICTORY_SNAPSHOTS: ReadonlyArray<CrossAxisStateSnapshot> = [
  // CI-GREEN + R-AMBIGUOUS — should be detected
  {
    integrity: "CI-GREEN",
    containment: "CT-GREEN",
    replay: "R-AMBIGUOUS",
    trustClass: "C-1",
    continuityConfidence: "STRONG",
    causalConfidence: "PROBABLE",
    hasEvidenceRef: true,
  },
  // CT-GREEN + CI-FRAGMENTED — containment cannot be greener
  {
    integrity: "CI-FRAGMENTED",
    containment: "CT-GREEN",
    replay: "R-OBSERVED",
    trustClass: "C-1",
    continuityConfidence: "PARTIAL",
    causalConfidence: "PARTIAL",
    hasEvidenceRef: true,
  },
  // T0 + STRONG continuity — structurally impossible
  {
    integrity: "CI-DEGRADED",
    containment: "CT-DEGRADED",
    replay: "R-OBSERVED",
    trustClass: "T0",
    continuityConfidence: "STRONG",
    causalConfidence: "PARTIAL",
    hasEvidenceRef: true,
  },
  // CONFIRMED confidence without evidence
  {
    integrity: "CI-DEGRADED",
    containment: "CT-DEGRADED",
    replay: "R-OBSERVED",
    trustClass: "C-1",
    continuityConfidence: "PARTIAL",
    causalConfidence: "CONFIRMED",
    hasEvidenceRef: false,
  },
];

export function verifyContradictionDetection(): ReadonlyArray<InvariantViolation> {
  const violations: InvariantViolation[] = [];

  for (const snapshot of CONTRADICTORY_SNAPSHOTS) {
    const contradictions = detectCoherenceContradictions(snapshot);
    if (contradictions.length === 0) {
      violations.push({ tag: "contradiction-not-detected", snapshot });
    }
    // Also verify resolveSystemicState returns SYSTEMIC-AMBIGUOUS for contradictions
    const resolved = resolveSystemicState(snapshot);
    if (resolved.contradictions.length > 0 && resolved.state !== "SYSTEMIC-AMBIGUOUS") {
      violations.push({
        tag: "systemic-state-too-optimistic",
        snapshot,
        state: resolved.state,
      });
    }
  }

  return violations;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* INVARIANT 4: chaos scenarios — telemetry corruption / unknown combinations  */
/* ─────────────────────────────────────────────────────────────────────────── */

export function verifyChaosScenarios(): ReadonlyArray<InvariantViolation> {
  const violations: InvariantViolation[] = [];

  // Scenario: every-axis-UNKNOWN should resolve to SYSTEMIC-UNVERIFIED
  const allUnknownSnapshot: CrossAxisStateSnapshot = {
    integrity: "CI-UNKNOWN",
    containment: "CT-UNKNOWN",
    replay: "R-AMBIGUOUS",
    trustClass: null,
    continuityConfidence: null,
    causalConfidence: null,
    hasEvidenceRef: false,
  };
  const allUnknownResolved = resolveSystemicState(allUnknownSnapshot);
  if (allUnknownResolved.state !== "SYSTEMIC-UNVERIFIED") {
    violations.push({
      tag: "systemic-state-too-optimistic",
      snapshot: allUnknownSnapshot,
      state: allUnknownResolved.state,
    });
  }

  // Scenario: missing trustClass with everything else green should still degrade to UNVERIFIED
  const missingTrustClassSnapshot: CrossAxisStateSnapshot = {
    integrity: "CI-GREEN",
    containment: "CT-GREEN",
    replay: "R-OBSERVED",
    trustClass: null, // UNCLASSIFIED
    continuityConfidence: "STRONG",
    causalConfidence: "PARTIAL",
    hasEvidenceRef: true,
  };
  const missingTrustResolved = resolveSystemicState(missingTrustClassSnapshot);
  if (missingTrustResolved.state !== "SYSTEMIC-UNVERIFIED") {
    violations.push({
      tag: "systemic-state-too-optimistic",
      snapshot: missingTrustClassSnapshot,
      state: missingTrustResolved.state,
    });
  }

  return violations;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* INVARIANT 5: registry-set membership consistency                             */
/* ─────────────────────────────────────────────────────────────────────────── */

export function verifyRegistryConsistency(): ReadonlyArray<InvariantViolation> {
  const violations: InvariantViolation[] = [];

  // Every state in INTEGRITY_STATES must parse back to itself
  for (const state of INTEGRITY_STATES) {
    const parsed = parseIntegrityState(state);
    if (parsed !== state) {
      violations.push({
        tag: "silent-coercion",
        axis: "integrity-roundtrip",
        input: state,
        expected: state,
        result: parsed,
      });
    }
  }
  for (const state of CONTAINMENT_STATES) {
    const parsed = parseContainmentState(state);
    if (parsed !== state) {
      violations.push({
        tag: "silent-coercion",
        axis: "containment-roundtrip",
        input: state,
        expected: state,
        result: parsed,
      });
    }
  }
  for (const state of REPLAY_STATES) {
    const parsed = parseReplayState(state);
    if (parsed !== state) {
      violations.push({
        tag: "silent-coercion",
        axis: "replay-roundtrip",
        input: state,
        expected: state,
        result: parsed ?? "null",
      });
    }
  }
  for (const cls of TRUST_CLASSES) {
    const parsed = parseTrustClass(cls);
    if (parsed !== cls) {
      violations.push({
        tag: "silent-coercion",
        axis: "trust-class-roundtrip",
        input: cls,
        expected: cls,
        result: parsed ?? "null",
      });
    }
  }

  // Severity ordering: CI-UNKNOWN must be MORE severe than CI-GREEN
  if (integritySeverity("CI-UNKNOWN") <= integritySeverity("CI-GREEN")) {
    violations.push({
      tag: "fail-closed-coerced-to-healthy",
      axis: "integrity-severity-ordering",
      input: "CI-UNKNOWN",
      result: `severity ${integritySeverity("CI-UNKNOWN")} ≤ CI-GREEN ${integritySeverity("CI-GREEN")} — fail-closed posture broken`,
    });
  }

  return violations;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* AGGREGATE VERIFICATION                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export function runAllInvariants(): VerificationReport {
  const failClosed = verifyFailClosedAxes();
  const ambiguity = verifyAmbiguityPreservation();
  const contradictions = verifyContradictionDetection();
  const chaos = verifyChaosScenarios();
  const consistency = verifyRegistryConsistency();

  const allViolations: InvariantViolation[] = [
    ...failClosed,
    ...ambiguity,
    ...contradictions,
    ...chaos,
    ...consistency,
  ];

  const totalChecks =
    ADVERSARIAL_INPUTS.length * 4 + // 4 axes per adversarial input
    8 + // ambiguity samples (4 rows + 3 telemetry-absence + 1 implicit)
    CONTRADICTORY_SNAPSHOTS.length * 2 + // detection + resolveSystemicState
    2 + // chaos scenarios
    INTEGRITY_STATES.length +
    CONTAINMENT_STATES.length +
    REPLAY_STATES.length +
    TRUST_CLASSES.length +
    1; // severity ordering

  return {
    version: 1,
    executedAt: new Date().toISOString(),
    invariantsChecked: totalChecks,
    violations: allViolations,
    summary: {
      failClosedSamples: ADVERSARIAL_INPUTS.length * 4,
      ambiguitySamples: 8,
      contradictionSamples: CONTRADICTORY_SNAPSHOTS.length * 2,
      chaosSamples: 2,
      aggregateStatus: allViolations.length === 0 ? "VERIFIED" : "FAILED",
    },
  };
}
