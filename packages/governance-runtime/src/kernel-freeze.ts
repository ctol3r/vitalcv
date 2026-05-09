/**
 * Governance kernel freeze + stability contracts (W2-PR41A).
 *
 * STOP governance recursion. The kernel — the set of cross-version
 * invariants that downstream consumers depend on — is FROZEN at a
 * declared version. Mutating the kernel without bumping the major
 * version is a CI failure.
 *
 * What's in the kernel (frozen):
 *   - state-set arrays (TRUST_CLASSES, REPLAY_STATES, INTEGRITY_STATES,
 *     CONTAINMENT_STATES) — adding members allowed (minor); removing
 *     members or reordering forbidden without major bump.
 *   - REPLAY_TRANSITIONS evidence-required graph — removing edges
 *     forbidden without major bump.
 *   - FORBIDDEN_LEXICON_PHRASES — adding allowed; removing requires
 *     founder + Codex SAFE per the lexicon update protocol.
 *   - EXTERNAL_TRUST_API_VERSION — bumping requires major version bump
 *     of the kernel.
 *
 * What's NOT in the kernel (extension-zone, free to evolve):
 *   - blast-radius scoring weights
 *   - decay half-lives
 *   - drift detector thresholds
 *   - UI labels and copy (subject to lexicon scanner)
 *
 * Pure module. No side effects. The freeze validator is a pure
 * comparison function that takes a "claimed kernel" object and the
 * "live kernel" derived from current registry exports, returning
 * stability findings.
 */

import {
  CONTAINMENT_STATES,
  type ContainmentState,
} from "./containment-state.js";
import {
  INTEGRITY_STATES,
  type IntegrityState,
} from "./integrity-state.js";
import { REPLAY_STATES, type ReplayState } from "./replay-state.js";
import { TRUST_CLASSES, type TrustClass } from "./trust-class.js";
import { REPLAY_TRANSITIONS } from "./transitions.js";

// ---------------------------------------------------------------------------
// Kernel version
// ---------------------------------------------------------------------------

/**
 * SemVer for the governance kernel.
 *
 *   MAJOR — incremented when frozen surface area mutates incompatibly
 *           (member removed from state-set, edge removed from
 *           REPLAY_TRANSITIONS, lexicon phrase removed).
 *   MINOR — incremented when extension-zone or backwards-compatible
 *           kernel additions land (new state-set member appended, new
 *           transition edge added, new lexicon phrase added).
 *   PATCH — bug fixes, weight tuning, doc-only changes.
 */
export const GOVERNANCE_KERNEL_VERSION = "1.0.0" as const;
export type GovernanceKernelVersion = typeof GOVERNANCE_KERNEL_VERSION;

// ---------------------------------------------------------------------------
// Kernel surface (frozen)
// ---------------------------------------------------------------------------

/**
 * Read-only snapshot of the frozen kernel surface, derived from current
 * registry exports. Built once per call; pure.
 */
export interface FrozenKernelSurface {
  readonly version: GovernanceKernelVersion;
  readonly trustClasses: readonly TrustClass[];
  readonly integrityStates: readonly IntegrityState[];
  readonly containmentStates: readonly ContainmentState[];
  readonly replayStates: readonly ReplayState[];
  /** [from, to] pairs only — evidence text is extension-zone. */
  readonly replayTransitionEdges: readonly (readonly [ReplayState, ReplayState])[];
}

/** Capture the live kernel surface from current registry exports. */
export function captureLiveKernel(): FrozenKernelSurface {
  return Object.freeze({
    version: GOVERNANCE_KERNEL_VERSION,
    trustClasses: Object.freeze([...TRUST_CLASSES]),
    integrityStates: Object.freeze([...INTEGRITY_STATES]),
    containmentStates: Object.freeze([...CONTAINMENT_STATES]),
    replayStates: Object.freeze([...REPLAY_STATES]),
    replayTransitionEdges: Object.freeze(
      REPLAY_TRANSITIONS.map((t) => Object.freeze([t.from, t.to] as const)),
    ),
  });
}

// ---------------------------------------------------------------------------
// TARGET 1/4 — Stability contract validation
// ---------------------------------------------------------------------------

export type KernelStabilityFinding =
  | { readonly tag: "version-major-mismatch"; readonly claimed: string; readonly live: string }
  | { readonly tag: "state-set-member-removed"; readonly stateSet: string; readonly removed: string }
  | { readonly tag: "state-set-member-reordered"; readonly stateSet: string; readonly atIndex: number; readonly claimed: string; readonly live: string }
  | { readonly tag: "replay-edge-removed"; readonly from: ReplayState; readonly to: ReplayState };

function findRemovedMembers<T extends string>(
  claimed: readonly T[],
  live: readonly T[],
): readonly T[] {
  const liveSet = new Set<string>(live);
  return claimed.filter((c) => !liveSet.has(c));
}

function findReorderedMember<T extends string>(
  claimed: readonly T[],
  live: readonly T[],
): { atIndex: number; claimed: T; live: T } | null {
  // Reordering: a member that exists in both arrays at different positions
  // among the shared prefix.
  const len = Math.min(claimed.length, live.length);
  for (let i = 0; i < len; i++) {
    const c = claimed[i]!;
    const l = live[i]!;
    if (c === l) continue;
    // If c exists in live somewhere AND l exists in claimed somewhere,
    // it's a reorder, not a pure add/remove.
    if (live.includes(c) && claimed.includes(l)) {
      return { atIndex: i, claimed: c, live: l };
    }
  }
  return null;
}

/**
 * Validate that a previously-claimed kernel surface is still compatible
 * with the live kernel. Returns findings; empty = stable.
 *
 * Adding members or edges is allowed (forward-compatible additions).
 * Removing or reordering breaks the freeze.
 */
export function validateKernelStability(
  claimed: FrozenKernelSurface,
): readonly KernelStabilityFinding[] {
  const findings: KernelStabilityFinding[] = [];
  const live = captureLiveKernel();

  // Major-version compare (claimed vs live)
  const claimedMajor = claimed.version.split(".")[0];
  const liveMajor = live.version.split(".")[0];
  if (claimedMajor !== liveMajor) {
    findings.push({
      tag: "version-major-mismatch",
      claimed: claimed.version,
      live: live.version,
    });
  }

  // Per state-set: removed members
  const setPairs: readonly [string, readonly string[], readonly string[]][] = [
    ["trustClasses", claimed.trustClasses, live.trustClasses],
    ["integrityStates", claimed.integrityStates, live.integrityStates],
    ["containmentStates", claimed.containmentStates, live.containmentStates],
    ["replayStates", claimed.replayStates, live.replayStates],
  ];
  for (const [name, c, l] of setPairs) {
    for (const removed of findRemovedMembers(c, l)) {
      findings.push({ tag: "state-set-member-removed", stateSet: name, removed });
    }
    const reorder = findReorderedMember(c, l);
    if (reorder) {
      findings.push({
        tag: "state-set-member-reordered",
        stateSet: name,
        atIndex: reorder.atIndex,
        claimed: reorder.claimed,
        live: reorder.live,
      });
    }
  }

  // Replay transitions: removed edges
  const liveEdges = new Set(live.replayTransitionEdges.map(([f, t]) => `${f}|${t}`));
  for (const [f, t] of claimed.replayTransitionEdges) {
    if (!liveEdges.has(`${f}|${t}`)) {
      findings.push({ tag: "replay-edge-removed", from: f, to: t });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// TARGET 2/3/5 — Versioning + extension boundary discipline
// ---------------------------------------------------------------------------

export interface CompatibilityContract {
  /** Caller's required kernel major version. */
  readonly requiresMajor: number;
  /** Caller's required state-set member presence (e.g., "R-AMBIGUOUS"). */
  readonly requiredStateMembers: readonly string[];
  /** Caller's required replay transition edges. */
  readonly requiredReplayEdges: readonly (readonly [ReplayState, ReplayState])[];
}

export type CompatibilityViolation =
  | { readonly tag: "major-version-too-old"; readonly required: number; readonly live: number }
  | { readonly tag: "required-state-member-missing"; readonly member: string }
  | { readonly tag: "required-replay-edge-missing"; readonly from: ReplayState; readonly to: ReplayState };

/**
 * Validate that the caller's compatibility contract holds against the
 * live kernel. Used by downstream consumers (issuer/verifier/audit
 * layers) to fail-closed at startup if the kernel has drifted under them.
 */
export function validateCompatibilityContract(
  contract: CompatibilityContract,
): readonly CompatibilityViolation[] {
  const violations: CompatibilityViolation[] = [];
  const live = captureLiveKernel();
  const liveMajor = parseInt(live.version.split(".")[0]!, 10);
  if (liveMajor < contract.requiresMajor) {
    violations.push({
      tag: "major-version-too-old",
      required: contract.requiresMajor,
      live: liveMajor,
    });
  }
  const allLiveMembers = new Set<string>([
    ...live.trustClasses,
    ...live.integrityStates,
    ...live.containmentStates,
    ...live.replayStates,
  ]);
  for (const m of contract.requiredStateMembers) {
    if (!allLiveMembers.has(m)) {
      violations.push({ tag: "required-state-member-missing", member: m });
    }
  }
  const liveEdges = new Set(live.replayTransitionEdges.map(([f, t]) => `${f}|${t}`));
  for (const [f, t] of contract.requiredReplayEdges) {
    if (!liveEdges.has(`${f}|${t}`)) {
      violations.push({ tag: "required-replay-edge-missing", from: f, to: t });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// TARGET 6/7 — Semantic freeze validators + CI gate
// ---------------------------------------------------------------------------

export interface KernelFreezeReport {
  readonly executedAt: string;
  readonly liveVersion: GovernanceKernelVersion;
  readonly stabilityFindings: readonly KernelStabilityFinding[];
  readonly contractViolations: readonly CompatibilityViolation[];
  readonly hasCiGatingCondition: boolean;
}

/**
 * Build a kernel-freeze report. Pass an optional baseline kernel surface
 * (e.g., loaded from a checked-in `kernel-baseline.json`) and an optional
 * compatibility contract (e.g., one per downstream consumer).
 *
 * Gating triggers:
 *   - any stability finding (member removed / reordered / edge removed)
 *   - any contract violation
 */
export function buildKernelFreezeReport(
  baseline: FrozenKernelSurface | null,
  contract: CompatibilityContract | null,
  nowIso: string,
): KernelFreezeReport {
  const stabilityFindings = baseline ? validateKernelStability(baseline) : [];
  const contractViolations = contract ? validateCompatibilityContract(contract) : [];
  return Object.freeze({
    executedAt: nowIso,
    liveVersion: GOVERNANCE_KERNEL_VERSION,
    stabilityFindings: Object.freeze([...stabilityFindings]),
    contractViolations: Object.freeze([...contractViolations]),
    hasCiGatingCondition: stabilityFindings.length > 0 || contractViolations.length > 0,
  });
}
