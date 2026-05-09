/**
 * Semantic snapshot tooling (W2-PR25A target 1).
 *
 * Captures a deterministic, diffable representation of governance semantics:
 *   - canonical state-set arrays
 *   - frozen trust-class profiles
 *   - transition-graph edges
 *   - cross-axis coherence rules (encoded as discriminated union tags)
 *   - severity orderings
 *
 * The snapshot is COMPARED across PRs. Mutations are flagged + classified by
 * evolution severity (W2-PR25A target 3).
 *
 * Per W2-PR25A non-negotiable rules:
 *   2. Semantic weakening must remain detectable.
 *   5. Ambiguity suppression is a semantic mutation.
 *   7. Governance evolution history must remain reconstructable.
 */

import { CONTAINMENT_STATES } from "./containment-state.js";
import { INTEGRITY_STATES } from "./integrity-state.js";
import { REPLAY_STATES } from "./replay-state.js";
import { TRUST_CLASSES, getTrustClassProfile } from "./trust-class.js";
import {
  CONTAINMENT_TRANSITIONS,
  INTEGRITY_TRANSITIONS,
  REPLAY_TRANSITIONS,
  CAUSAL_CONFIDENCE_LEVELS,
  CONTINUITY_CONFIDENCE_LEVELS,
} from "./transitions.js";
import { SYSTEMIC_STATES } from "./coherence.js";
import { OVERRIDE_CLASSES, OVERRIDE_STATUS, RENEWAL_POLICY, MAX_RENEWALS, MAX_OVERRIDE_DURATION_MS } from "./override-audit.js";

export interface SemanticSnapshot {
  readonly version: 1;
  readonly capturedAt: string; // ISO-8601 UTC
  readonly trustClasses: ReadonlyArray<{
    readonly cls: string;
    readonly profile: ReturnType<typeof getTrustClassProfile>;
  }>;
  readonly stateSets: {
    readonly integrity: ReadonlyArray<string>;
    readonly containment: ReadonlyArray<string>;
    readonly replay: ReadonlyArray<string>;
    readonly systemic: ReadonlyArray<string>;
    readonly continuityConfidence: ReadonlyArray<string>;
    readonly causalConfidence: ReadonlyArray<string>;
  };
  readonly transitions: {
    readonly integrity: ReadonlyArray<{ from: string; to: string; evidenceRequired: string | null }>;
    readonly containment: ReadonlyArray<{ from: string; to: string; evidenceRequired: string | null }>;
    readonly replay: ReadonlyArray<{ from: string; to: string; evidenceRequired: string | null }>;
  };
  readonly overrideRules: {
    readonly classes: ReadonlyArray<string>;
    readonly statuses: ReadonlyArray<string>;
    readonly renewalPolicies: ReadonlyArray<string>;
    readonly maxRenewals: number;
    readonly maxDurationMs: number;
  };
}

/**
 * Build a deterministic semantic snapshot of all governance primitives.
 * Field ordering is fixed; arrays are alphabetized where order is not
 * semantically meaningful (state-set arrays are NOT sorted because their
 * order may carry meaning per the registry).
 */
export function buildSemanticSnapshot(capturedAtIso: string): SemanticSnapshot {
  return {
    version: 1,
    capturedAt: capturedAtIso,
    trustClasses: TRUST_CLASSES.map((cls) => ({
      cls,
      profile: getTrustClassProfile(cls),
    })),
    stateSets: {
      integrity: [...INTEGRITY_STATES],
      containment: [...CONTAINMENT_STATES],
      replay: [...REPLAY_STATES],
      systemic: [...SYSTEMIC_STATES],
      continuityConfidence: [...CONTINUITY_CONFIDENCE_LEVELS],
      causalConfidence: [...CAUSAL_CONFIDENCE_LEVELS],
    },
    transitions: {
      integrity: INTEGRITY_TRANSITIONS.map((t) => ({
        from: t.from,
        to: t.to,
        evidenceRequired: t.evidenceRequired,
      })),
      containment: CONTAINMENT_TRANSITIONS.map((t) => ({
        from: t.from,
        to: t.to,
        evidenceRequired: t.evidenceRequired,
      })),
      replay: REPLAY_TRANSITIONS.map((t) => ({
        from: t.from,
        to: t.to,
        evidenceRequired: t.evidenceRequired,
      })),
    },
    overrideRules: {
      classes: [...OVERRIDE_CLASSES],
      statuses: [...OVERRIDE_STATUS],
      renewalPolicies: [...RENEWAL_POLICY],
      maxRenewals: MAX_RENEWALS,
      maxDurationMs: MAX_OVERRIDE_DURATION_MS,
    },
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* SEMANTIC MUTATION DETECTION (W2-PR25A target 2)                              */
/* ─────────────────────────────────────────────────────────────────────────── */

export const EVOLUTION_SEVERITY = ["SAFE", "CAUTION", "HIGH-RISK", "CRITICAL", "BREAKING"] as const;
export type EvolutionSeverity = (typeof EVOLUTION_SEVERITY)[number];

export type SemanticMutation =
  | { readonly tag: "state-removed"; readonly axis: string; readonly state: string; readonly severity: EvolutionSeverity }
  | { readonly tag: "state-added"; readonly axis: string; readonly state: string; readonly severity: EvolutionSeverity }
  | { readonly tag: "transition-removed"; readonly axis: string; readonly from: string; readonly to: string; readonly severity: EvolutionSeverity }
  | { readonly tag: "transition-added"; readonly axis: string; readonly from: string; readonly to: string; readonly severity: EvolutionSeverity }
  | { readonly tag: "transition-evidence-relaxed"; readonly axis: string; readonly from: string; readonly to: string; readonly severity: EvolutionSeverity }
  | { readonly tag: "trust-class-strength-inflated"; readonly cls: string; readonly axis: string; readonly previous: string; readonly current: string; readonly severity: EvolutionSeverity }
  | { readonly tag: "max-renewal-relaxed"; readonly previous: number; readonly current: number; readonly severity: EvolutionSeverity }
  | { readonly tag: "max-duration-relaxed"; readonly previousMs: number; readonly currentMs: number; readonly severity: EvolutionSeverity };

const SEVERITY_FOR_TAG: Readonly<Record<SemanticMutation["tag"], EvolutionSeverity>> = Object.freeze({
  "state-removed": "BREAKING", // removing a state breaks consumers
  "state-added": "CAUTION", // adding states is generally additive
  "transition-removed": "HIGH-RISK", // could prevent legitimate recovery paths
  "transition-added": "CRITICAL", // could enable previously-impossible jumps
  "transition-evidence-relaxed": "CRITICAL", // weakens recovery requirements
  "trust-class-strength-inflated": "HIGH-RISK", // claims stronger guarantees
  "max-renewal-relaxed": "CRITICAL", // weakens override expiration discipline
  "max-duration-relaxed": "CRITICAL", // same
});

/**
 * Compare two snapshots and emit a list of detected mutations.
 *
 * Order: comparison is "previous → current". Mutations describe the change
 * AS-OF current relative to previous baseline.
 */
export function diffSemanticSnapshots(
  previous: SemanticSnapshot,
  current: SemanticSnapshot,
): ReadonlyArray<SemanticMutation> {
  const mutations: SemanticMutation[] = [];

  // State-set diffs
  const axes: ReadonlyArray<keyof SemanticSnapshot["stateSets"]> = [
    "integrity",
    "containment",
    "replay",
    "systemic",
    "continuityConfidence",
    "causalConfidence",
  ];
  for (const axis of axes) {
    const prev = new Set(previous.stateSets[axis]);
    const curr = new Set(current.stateSets[axis]);
    for (const state of prev) {
      if (!curr.has(state)) {
        mutations.push({ tag: "state-removed", axis, state, severity: SEVERITY_FOR_TAG["state-removed"] });
      }
    }
    for (const state of curr) {
      if (!prev.has(state)) {
        mutations.push({ tag: "state-added", axis, state, severity: SEVERITY_FOR_TAG["state-added"] });
      }
    }
  }

  // Transition diffs
  type TKey = string;
  const tkey = (t: { from: string; to: string }): TKey => `${t.from}→${t.to}`;

  const transitionAxes: ReadonlyArray<keyof SemanticSnapshot["transitions"]> = [
    "integrity",
    "containment",
    "replay",
  ];
  for (const axis of transitionAxes) {
    const prevMap = new Map<TKey, { from: string; to: string; evidenceRequired: string | null }>();
    const currMap = new Map<TKey, { from: string; to: string; evidenceRequired: string | null }>();
    for (const t of previous.transitions[axis]) prevMap.set(tkey(t), t);
    for (const t of current.transitions[axis]) currMap.set(tkey(t), t);

    for (const [k, t] of prevMap) {
      if (!currMap.has(k)) {
        mutations.push({
          tag: "transition-removed",
          axis,
          from: t.from,
          to: t.to,
          severity: SEVERITY_FOR_TAG["transition-removed"],
        });
      }
    }
    for (const [k, t] of currMap) {
      const prev = prevMap.get(k);
      if (prev === undefined) {
        mutations.push({
          tag: "transition-added",
          axis,
          from: t.from,
          to: t.to,
          severity: SEVERITY_FOR_TAG["transition-added"],
        });
      } else {
        // Detect evidence-relaxation
        if (prev.evidenceRequired !== null && t.evidenceRequired === null) {
          mutations.push({
            tag: "transition-evidence-relaxed",
            axis,
            from: t.from,
            to: t.to,
            severity: SEVERITY_FOR_TAG["transition-evidence-relaxed"],
          });
        }
      }
    }
  }

  // Trust-class profile inflation detection
  const STRENGTH_RANK: Readonly<Record<string, number>> = Object.freeze({
    FRAGILE: 0,
    WEAK: 1,
    PARTIAL: 2,
    STRONG: 3,
  });
  const prevProfiles = new Map(previous.trustClasses.map((p) => [p.cls, p.profile]));
  const currProfiles = new Map(current.trustClasses.map((p) => [p.cls, p.profile]));
  for (const [cls, prev] of prevProfiles) {
    const curr = currProfiles.get(cls);
    if (curr === undefined) continue;
    const dimensions = [
      "lineageDurability",
      "replaySurvivability",
      "attributionDurability",
      "exportDurability",
      "denialSurvivability",
      "forensicSurvivability",
    ] as const;
    for (const dim of dimensions) {
      const prevValue = prev[dim] as string;
      const currValue = curr[dim] as string;
      const prevRank = STRENGTH_RANK[prevValue];
      const currRank = STRENGTH_RANK[currValue];
      if (
        typeof prevRank === "number" &&
        typeof currRank === "number" &&
        currRank > prevRank
      ) {
        mutations.push({
          tag: "trust-class-strength-inflated",
          cls,
          axis: dim,
          previous: prevValue,
          current: currValue,
          severity: SEVERITY_FOR_TAG["trust-class-strength-inflated"],
        });
      }
    }
  }

  // Override-rule relaxation
  if (current.overrideRules.maxRenewals > previous.overrideRules.maxRenewals) {
    mutations.push({
      tag: "max-renewal-relaxed",
      previous: previous.overrideRules.maxRenewals,
      current: current.overrideRules.maxRenewals,
      severity: SEVERITY_FOR_TAG["max-renewal-relaxed"],
    });
  }
  if (current.overrideRules.maxDurationMs > previous.overrideRules.maxDurationMs) {
    mutations.push({
      tag: "max-duration-relaxed",
      previousMs: previous.overrideRules.maxDurationMs,
      currentMs: current.overrideRules.maxDurationMs,
      severity: SEVERITY_FOR_TAG["max-duration-relaxed"],
    });
  }

  return mutations;
}

/**
 * Aggregate the worst severity from a list of mutations.
 * Returns "SAFE" for empty input.
 */
export function maxEvolutionSeverity(
  mutations: ReadonlyArray<SemanticMutation>,
): EvolutionSeverity {
  const RANK: Readonly<Record<EvolutionSeverity, number>> = Object.freeze({
    SAFE: 0,
    CAUTION: 1,
    "HIGH-RISK": 2,
    CRITICAL: 3,
    BREAKING: 4,
  });
  let worst: EvolutionSeverity = "SAFE";
  let worstRank = 0;
  for (const m of mutations) {
    const r = RANK[m.severity];
    if (r > worstRank) {
      worst = m.severity;
      worstRank = r;
    }
  }
  return worst;
}
