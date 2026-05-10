/**
 * Constitutional UX consistency layer (W2-PR79A).
 *
 * Pure cross-surface validator. Given a set of (surface, summary)
 * observations from each rendering surface, asserts that they describe
 * a consistent constitutional state — same trust trajectory, same
 * ambiguity preservation, same replay confidence within tolerance.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";
import type { TrustTrajectoryTier } from "./trust-ux.js";
import type { ReconstructionConfidence } from "./replay-survivability.js";

export interface SurfaceObservation {
  readonly surfaceId: string; // e.g., "TrustOverviewPanel", "ReplaySurvivabilityPanel"
  readonly trajectory: TrustTrajectoryTier;
  readonly replayConfidence: ReconstructionConfidence;
  readonly ambiguityPreserved: boolean;
  readonly headlineIndicatorCount: number;
}

export type UxConsistencyViolation =
  | { readonly tag: "trajectory-divergence"; readonly surfaces: readonly string[] }
  | { readonly tag: "replay-confidence-divergence"; readonly surfaces: readonly string[] }
  | { readonly tag: "ambiguity-rendering-divergence"; readonly surfaces: readonly string[] }
  | { readonly tag: "headline-overflow"; readonly surfaceId: string; readonly count: number };

export interface UxConsistencyReport {
  readonly executedAt: string;
  readonly observationCount: number;
  readonly violations: readonly UxConsistencyViolation[];
  readonly consistencyHash: string;
  readonly hasCiGatingCondition: boolean;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function validateUxConsistency(
  observations: readonly SurfaceObservation[],
  nowIso: string,
): UxConsistencyReport {
  const violations: UxConsistencyViolation[] = [];

  // All trajectories must agree
  const traj = new Map<TrustTrajectoryTier, string[]>();
  for (const o of observations) {
    const arr = traj.get(o.trajectory) ?? [];
    arr.push(o.surfaceId);
    traj.set(o.trajectory, arr);
  }
  if (traj.size > 1) {
    violations.push({
      tag: "trajectory-divergence",
      surfaces: observations.map((o) => o.surfaceId),
    });
  }

  // All replay confidences must agree
  const conf = new Map<ReconstructionConfidence, string[]>();
  for (const o of observations) {
    const arr = conf.get(o.replayConfidence) ?? [];
    arr.push(o.surfaceId);
    conf.set(o.replayConfidence, arr);
  }
  if (conf.size > 1) {
    violations.push({
      tag: "replay-confidence-divergence",
      surfaces: observations.map((o) => o.surfaceId),
    });
  }

  // Ambiguity flag must be consistent
  const ambig = new Set(observations.map((o) => o.ambiguityPreserved));
  if (ambig.size > 1) {
    violations.push({
      tag: "ambiguity-rendering-divergence",
      surfaces: observations.map((o) => o.surfaceId),
    });
  }

  // Per-surface headline cap (≤ 7 — matches TrustOverviewPanel + ReplayCognition SUMMARY)
  for (const o of observations) {
    if (o.headlineIndicatorCount > 7) {
      violations.push({
        tag: "headline-overflow",
        surfaceId: o.surfaceId,
        count: o.headlineIndicatorCount,
      });
    }
  }

  const consistencyHash = sha256Hex(canonicalize({ observations, violations }));
  return Object.freeze({
    executedAt: nowIso,
    observationCount: observations.length,
    violations: Object.freeze(violations),
    consistencyHash,
    hasCiGatingCondition: violations.length > 0,
  });
}
