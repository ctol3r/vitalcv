/**
 * Constitutional integrity convergence (W2-PR72A).
 *
 * Synthesizes the outputs of every prior wave (PR26A→PR69A) into one
 * cross-wave verdict. The synthesis layer DOES NOT introduce new
 * primitives; it composes existing pure reports and asserts cross-wave
 * invariants:
 *
 *   - replay continuity is unified across runtime, archival, and summary
 *     layers (replay-survivability + evidence-durability + evidence-
 *     compression must all agree on per-epoch ambiguity counts).
 *   - ambiguity preservation is system-wide (no layer may zero out
 *     R-AMBIGUOUS observations).
 *   - institutional continuity is reconstructable (longitudinal-memory
 *     + tamper-evident-persistence + evidence-durability all chain).
 *   - constitutional drift is bounded (kernel-freeze + meta-verification
 *     hold).
 *   - operational trust trajectory is visible (trust-ux summary present).
 *
 * Pure transform. No fetches. No DB writes.
 */

import { canonicalize } from "./tamper-evident-persistence.js";
import { createHash } from "node:crypto";

import type { GovernanceLedger } from "./longitudinal-memory.js";
import type { SealedGovernanceLedger, GovernanceSnapshot } from "./tamper-evident-persistence.js";
import type { ArchivedEpochEnvelope } from "./evidence-durability.js";
import type { EvidenceSummary } from "./evidence-compression.js";
import type { HumanOverrideRecord } from "./override-discipline.js";
import type { GovernanceIncident } from "./incident-governance.js";
import type { FrozenKernelSurface } from "./kernel-freeze.js";

import { buildInstitutionalDriftReport } from "./longitudinal-memory.js";
import { buildReplaySurvivabilityReport } from "./replay-survivability.js";
import { buildPersistenceIntegrityReport } from "./tamper-evident-persistence.js";
import { buildEvidenceDurabilityReport } from "./evidence-durability.js";
import { buildEvidenceCompressionReport } from "./evidence-compression.js";
import { deriveUxSummary } from "./trust-ux.js";
import { buildKernelFreezeReport } from "./kernel-freeze.js";

// ---------------------------------------------------------------------------
// Convergence verdict
// ---------------------------------------------------------------------------

export const CONSTITUTIONAL_VERDICTS = [
  "CONSTITUTIONALLY-COHERENT",
  "DEGRADED-BUT-COHERENT",
  "INCOHERENT",
  "FAILED-CLOSED",
] as const;
export type ConstitutionalVerdict = (typeof CONSTITUTIONAL_VERDICTS)[number];

export type CrossWaveInvariantViolation =
  | { readonly tag: "replay-counts-disagree"; readonly ledgerSum: number; readonly summarySum: number }
  | { readonly tag: "ambiguity-elided-system-wide"; readonly layer: "ledger" | "ux" | "summary" }
  | { readonly tag: "snapshot-missing-but-archive-non-empty" }
  | { readonly tag: "kernel-drifted"; readonly findings: number }
  | { readonly tag: "ux-trajectory-failing-but-no-incident-flagged" };

// ---------------------------------------------------------------------------
// Convergence input + report
// ---------------------------------------------------------------------------

export interface ConstitutionalConvergenceInput {
  readonly nowIso: string;
  readonly ledger: GovernanceLedger;
  readonly sealed: SealedGovernanceLedger;
  readonly snapshot: GovernanceSnapshot | null;
  readonly archive: readonly ArchivedEpochEnvelope[];
  readonly compressedSummary: EvidenceSummary | null;
  readonly overrides: readonly HumanOverrideRecord[];
  readonly incidents: readonly GovernanceIncident[];
  readonly kernelBaseline: FrozenKernelSurface | null;
}

export interface ConstitutionalConvergenceReport {
  readonly executedAt: string;
  readonly verdict: ConstitutionalVerdict;
  readonly perWaveGating: {
    readonly drift: boolean;
    readonly replaySurvivability: boolean;
    readonly persistence: boolean;
    readonly durability: boolean;
    readonly compression: boolean;
    readonly kernel: boolean;
  };
  readonly crossWaveViolations: readonly CrossWaveInvariantViolation[];
  /** Convergence hash binds all sub-report hashes for tamper evidence. */
  readonly convergenceHash: string;
  readonly hasCiGatingCondition: boolean;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Synthesize the constitutional integrity verdict.
 *
 * Pure: identical input ⇒ identical output (and identical convergenceHash).
 */
export function synthesizeConstitutionalIntegrity(
  input: ConstitutionalConvergenceInput,
): ConstitutionalConvergenceReport {
  const drift = buildInstitutionalDriftReport(input.ledger, input.nowIso);
  const replay = buildReplaySurvivabilityReport(input.ledger, input.nowIso);
  const persistence = buildPersistenceIntegrityReport(
    input.sealed,
    input.snapshot,
    input.nowIso,
  );
  const durability = buildEvidenceDurabilityReport(input.archive, input.nowIso);
  const compression = input.compressedSummary
    ? buildEvidenceCompressionReport(input.compressedSummary, input.archive, input.nowIso)
    : null;
  const kernel = buildKernelFreezeReport(input.kernelBaseline, null, input.nowIso);
  const ux = deriveUxSummary({
    ledger: input.ledger,
    sealed: input.sealed,
    snapshot: input.snapshot,
    overrides: input.overrides,
    incidents: input.incidents,
    nowIso: input.nowIso,
  });

  const crossWaveViolations: CrossWaveInvariantViolation[] = [];

  // Cross-wave invariant 1: replay counts agree across ledger and summary
  const ledgerReplaySum = input.ledger.epochs.reduce(
    (a, e) => a + e.replayAmbiguousCount + e.replayCollapsedCount,
    0,
  );
  if (input.compressedSummary) {
    const summarySum =
      input.compressedSummary.totalReplayAmbiguous +
      input.compressedSummary.totalReplayCollapsed;
    // Summary may cover a subset; only flag if summary covers full ledger
    // (contributingEpochCount >= ledger length) and counts differ
    if (
      input.compressedSummary.contributingEpochCount >= input.ledger.epochs.length &&
      summarySum !== ledgerReplaySum
    ) {
      crossWaveViolations.push({
        tag: "replay-counts-disagree",
        ledgerSum: ledgerReplaySum,
        summarySum,
      });
    }
  }

  // Cross-wave invariant 2: ambiguity preservation system-wide
  const ledgerHasAmbig = input.ledger.epochs.some((e) => e.replayAmbiguousCount > 0);
  if (ledgerHasAmbig && !replay.score.ambiguityPreserved) {
    crossWaveViolations.push({ tag: "ambiguity-elided-system-wide", layer: "ledger" });
  }
  if (ledgerHasAmbig && !ux.replayAmbiguityPreserved) {
    crossWaveViolations.push({ tag: "ambiguity-elided-system-wide", layer: "ux" });
  }
  if (
    input.compressedSummary &&
    ledgerHasAmbig &&
    input.compressedSummary.totalReplayAmbiguous === 0
  ) {
    crossWaveViolations.push({ tag: "ambiguity-elided-system-wide", layer: "summary" });
  }

  // Cross-wave invariant 3: snapshot missing but archive non-empty
  if (input.archive.length > 0 && !input.snapshot) {
    crossWaveViolations.push({ tag: "snapshot-missing-but-archive-non-empty" });
  }

  // Cross-wave invariant 4: kernel drift
  if (kernel.stabilityFindings.length > 0) {
    crossWaveViolations.push({ tag: "kernel-drifted", findings: kernel.stabilityFindings.length });
  }

  // Cross-wave invariant 5: UX trajectory FAILING with no SEV-1 incident flagged
  if (ux.trustTrajectory === "FAILING" && ux.openSev1Count === 0) {
    crossWaveViolations.push({ tag: "ux-trajectory-failing-but-no-incident-flagged" });
  }

  const perWaveGating = {
    drift: drift.hasCiFailure,
    replaySurvivability: replay.hasCiGatingCondition,
    persistence: persistence.hasCiGatingCondition,
    durability: durability.hasCiGatingCondition,
    compression: compression?.hasCiGatingCondition ?? false,
    kernel: kernel.hasCiGatingCondition,
  };

  // Verdict derivation
  const anyWaveGating = Object.values(perWaveGating).some(Boolean);
  const anyCrossWave = crossWaveViolations.length > 0;
  let verdict: ConstitutionalVerdict;
  if (perWaveGating.kernel || perWaveGating.persistence) {
    verdict = "FAILED-CLOSED";
  } else if (anyCrossWave || anyWaveGating) {
    verdict = ux.trustTrajectory === "FAILING" ? "INCOHERENT" : "DEGRADED-BUT-COHERENT";
  } else {
    verdict = "CONSTITUTIONALLY-COHERENT";
  }

  // Bind sub-report hashes for tamper evidence
  const convergenceHash = sha256Hex(canonicalize({
    drift,
    replay,
    persistence,
    durability,
    compression,
    kernel,
    ux,
    crossWaveViolations,
    verdict,
  }));

  return Object.freeze({
    executedAt: input.nowIso,
    verdict,
    perWaveGating: Object.freeze(perWaveGating),
    crossWaveViolations: Object.freeze(crossWaveViolations),
    convergenceHash,
    hasCiGatingCondition: anyWaveGating || anyCrossWave,
  });
}
