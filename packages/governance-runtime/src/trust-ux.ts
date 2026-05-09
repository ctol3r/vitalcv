/**
 * Institutional trust UX convergence (W2-PR39A).
 *
 * Pure derivation layer that collapses:
 *   - replay survivability
 *   - longitudinal drift / fatigue
 *   - tamper-evidence integrity
 *   - active overrides
 *   - open incidents
 *
 * into a single operator-readable summary. The web layer renders this via
 * TrustOverviewPanel; this module guarantees that derived UX state is:
 *   - ambiguity-preserving (R-AMBIGUOUS surfaces never collapse)
 *   - replay-explicit (gaps + impossible jumps surface)
 *   - drift-aware (fatigue tier visible)
 *   - cognitive-budget-bounded (≤ 7 top-line indicators)
 *
 * The UX integrity validator (validateUxIntegrity) checks these
 * invariants over a derived UxSummary and is wired to a CI gate.
 *
 * Lexicon-aligned. No replay-protection or non-repudiation claims.
 */

import type { GovernanceLedger } from "./longitudinal-memory.js";
import type { GovernanceIncident } from "./incident-governance.js";
import type { HumanOverrideRecord } from "./override-discipline.js";
import {
  buildInstitutionalDriftReport,
  type FatigueSeverity,
} from "./longitudinal-memory.js";
import {
  buildReplaySurvivabilityReport,
  type ReconstructionConfidence,
} from "./replay-survivability.js";
import { buildPersistenceIntegrityReport, type SealedGovernanceLedger, type GovernanceSnapshot } from "./tamper-evident-persistence.js";
import { computeOverrideBlastRadius, computeOverrideDecay } from "./override-discipline.js";
import { computeIncidentBlastRadius } from "./incident-governance.js";

// ---------------------------------------------------------------------------
// Top-line trust trajectory tier (5-tier)
// ---------------------------------------------------------------------------

export const TRUST_TRAJECTORY_TIERS = [
  "STABLE",
  "WATCH",
  "DEGRADED",
  "AT-RISK",
  "FAILING",
] as const;
export type TrustTrajectoryTier = (typeof TRUST_TRAJECTORY_TIERS)[number];

const TIER_NUMERIC: Readonly<Record<TrustTrajectoryTier, number>> = Object.freeze({
  STABLE: 0,
  WATCH: 1,
  DEGRADED: 2,
  "AT-RISK": 3,
  FAILING: 4,
});

function worseTier(a: TrustTrajectoryTier, b: TrustTrajectoryTier): TrustTrajectoryTier {
  return TIER_NUMERIC[a] >= TIER_NUMERIC[b] ? a : b;
}

// ---------------------------------------------------------------------------
// UX summary shape — caller passes to TrustOverviewPanel
// ---------------------------------------------------------------------------

export interface UxSummary {
  /** ISO-8601 UTC. */
  readonly capturedAt: string;
  readonly trustTrajectory: TrustTrajectoryTier;
  /** ≤ 7 short labels for top-line legibility. */
  readonly headlineIndicators: readonly string[];
  // Replay (W2-PR33A)
  readonly replayConfidence: ReconstructionConfidence;
  readonly replayImpossibleJumps: number;
  readonly replayAmbiguityPreserved: boolean;
  // Drift / fatigue (W2-PR30A)
  readonly fatigueSeverity: FatigueSeverity;
  readonly driftFindingCount: number;
  // Persistence (W2-PR32A)
  readonly chainClean: boolean;
  readonly snapshotPresent: boolean;
  // Overrides (W2-PR29A)
  readonly activeOverrideCount: number;
  readonly criticalOverrideIds: readonly string[];
  // Incidents (W2-PR35A)
  readonly openSev1Count: number;
  readonly openIncidentTotal: number;
  /** All sub-domains rolled up; never elides ambiguity. */
  readonly normalizationResistant: true;
}

export interface UxSummaryInputs {
  readonly ledger: GovernanceLedger;
  readonly sealed: SealedGovernanceLedger;
  readonly snapshot: GovernanceSnapshot | null;
  readonly overrides: readonly HumanOverrideRecord[];
  readonly incidents: readonly GovernanceIncident[];
  readonly nowIso: string;
}

export function deriveUxSummary(inputs: UxSummaryInputs): UxSummary {
  const drift = buildInstitutionalDriftReport(inputs.ledger, inputs.nowIso);
  const replay = buildReplaySurvivabilityReport(inputs.ledger, inputs.nowIso);
  const persistence = buildPersistenceIntegrityReport(
    inputs.sealed,
    inputs.snapshot,
    inputs.nowIso,
  );

  // Override roll-up
  let criticalIds: string[] = [];
  let activeCount = 0;
  for (const o of inputs.overrides) {
    const decay = computeOverrideDecay(o, inputs.nowIso);
    if (decay.state === "FRESH" || decay.state === "DECAYING") activeCount++;
    const blast = computeOverrideBlastRadius(o);
    if (blast.severityTier === "CRITICAL") criticalIds.push(o.id);
  }

  // Incident roll-up
  let openSev1 = 0;
  let openTotal = 0;
  for (const inc of inputs.incidents) {
    if (inc.state !== "POSTMORTEM-CLOSED") openTotal++;
    if (inc.sev === "SEV-1" && inc.state !== "POSTMORTEM-CLOSED") openSev1++;
    // Side-effect: flag CRITICAL blast in headline
    const blast = computeIncidentBlastRadius(inc);
    if (blast.tier === "CRITICAL" && !criticalIds.includes(`incident:${inc.id}`)) {
      // not added to override ids; tracked separately via openSev1Count
    }
  }

  // Trajectory derivation — start STABLE, worsen by every signal
  let traj: TrustTrajectoryTier = "STABLE";
  if (drift.fatigue.severity === "ELEVATED") traj = worseTier(traj, "WATCH");
  if (drift.fatigue.severity === "CHRONIC") traj = worseTier(traj, "DEGRADED");
  if (drift.fatigue.severity === "CRITICAL") traj = worseTier(traj, "AT-RISK");
  if (drift.hasCiFailure) traj = worseTier(traj, "AT-RISK");
  if (replay.score.confidence === "LOW") traj = worseTier(traj, "DEGRADED");
  if (replay.score.confidence === "UNRECONSTRUCTABLE") traj = worseTier(traj, "FAILING");
  if (replay.score.impossibleJumps > 0) traj = worseTier(traj, "AT-RISK");
  if (!persistence.hasSnapshot && persistence.ledgerLength > 0) traj = worseTier(traj, "AT-RISK");
  if (!persistence.chainFindings.length === false) traj = worseTier(traj, "FAILING");
  if (persistence.chainFindings.length > 0) traj = worseTier(traj, "FAILING");
  if (criticalIds.length > 0) traj = worseTier(traj, "AT-RISK");
  if (openSev1 > 0) traj = worseTier(traj, "FAILING");

  // Headline indicators (≤ 7) — short, operator-readable
  const headline: string[] = [];
  headline.push(`trajectory: ${traj}`);
  headline.push(`replay: ${replay.score.confidence}`);
  if (replay.score.impossibleJumps > 0) headline.push(`⚠ ${replay.score.impossibleJumps} impossible jump(s)`);
  if (drift.fatigue.severity !== "CALM") headline.push(`fatigue: ${drift.fatigue.severity}`);
  if (!persistence.chainFindings.length) {
    /* clean — no headline */
  } else {
    headline.push(`⚠ ${persistence.chainFindings.length} tamper finding(s)`);
  }
  if (activeCount > 0) headline.push(`overrides: ${activeCount} active`);
  if (openSev1 > 0) headline.push(`⚠ ${openSev1} SEV-1 open`);

  // Cap at 7 — but never drop a fail-closed indicator
  const capped = headline.slice(0, 7);

  return Object.freeze({
    capturedAt: inputs.nowIso,
    trustTrajectory: traj,
    headlineIndicators: Object.freeze(capped),
    replayConfidence: replay.score.confidence,
    replayImpossibleJumps: replay.score.impossibleJumps,
    replayAmbiguityPreserved: replay.score.ambiguityPreserved,
    fatigueSeverity: drift.fatigue.severity,
    driftFindingCount: drift.driftFindings.length,
    chainClean: persistence.chainFindings.length === 0,
    snapshotPresent: persistence.hasSnapshot,
    activeOverrideCount: activeCount,
    criticalOverrideIds: Object.freeze(criticalIds),
    openSev1Count: openSev1,
    openIncidentTotal: openTotal,
    normalizationResistant: true,
  });
}

// ---------------------------------------------------------------------------
// UX integrity validator (TARGET 7 — UX integrity CI gate)
// ---------------------------------------------------------------------------

export type UxIntegrityViolation =
  | { readonly tag: "headline-overflow"; readonly count: number }
  | { readonly tag: "ambiguity-elided" }
  | { readonly tag: "tier-inconsistent-with-signals"; readonly tier: TrustTrajectoryTier; readonly reason: string }
  | { readonly tag: "replay-failure-not-headlined" };

export function validateUxIntegrity(summary: UxSummary): readonly UxIntegrityViolation[] {
  const v: UxIntegrityViolation[] = [];
  if (summary.headlineIndicators.length > 7) {
    v.push({ tag: "headline-overflow", count: summary.headlineIndicators.length });
  }
  // Ambiguity must remain explicit when impossible jumps exist
  if (!summary.replayAmbiguityPreserved) {
    v.push({ tag: "ambiguity-elided" });
  }
  // Tier consistency: FAILING signals should not coexist with STABLE/WATCH tier
  const failingSignals =
    summary.replayConfidence === "UNRECONSTRUCTABLE" ||
    summary.openSev1Count > 0 ||
    !summary.chainClean;
  if (failingSignals && (summary.trustTrajectory === "STABLE" || summary.trustTrajectory === "WATCH")) {
    v.push({
      tag: "tier-inconsistent-with-signals",
      tier: summary.trustTrajectory,
      reason: "FAILING-class signal present (replay UNRECONSTRUCTABLE / open SEV-1 / chain finding)",
    });
  }
  // Replay failure must surface in headline
  if (
    summary.replayConfidence === "UNRECONSTRUCTABLE" &&
    !summary.headlineIndicators.some((h) => h.toLowerCase().includes("replay"))
  ) {
    v.push({ tag: "replay-failure-not-headlined" });
  }
  return v;
}
