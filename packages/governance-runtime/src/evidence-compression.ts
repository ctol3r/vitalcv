/**
 * Institutional evidence compression (W2-PR69A).
 *
 * Compresses a window of archived governance epochs into an
 * ambiguity-preserving summary. Compression rules:
 *
 *   - Ambiguity-bearing fields (replayAmbiguousCount, replayCollapsedCount,
 *     contradictionCount) are SUMMED — never averaged or dropped.
 *   - Counters (overrides, integrity-degraded, etc.) are summed.
 *   - Aggregate verification confidence collapses to the WORST observed
 *     in the window (per W2-PR27A rule #6: completeness inflation
 *     forbidden). UNKNOWN dominates.
 *   - degradedDomainTallies are merged additively.
 *   - Original epoch hashes are listed in `contributingEpochHashes` so
 *     the summary's lineage to the source archive is auditable.
 *
 * The summary carries its own canonical hash + a roundTripCheckHash that
 * recomputes the summary from the source envelopes. Mismatch = tampering.
 *
 * Lexicon-aligned: this is summarization, not reconstruction. The
 * summary cannot be "decompressed" back to per-epoch evidence — only the
 * source archive can. Compression confidence is evidence-derived from
 * the count of contributing envelopes vs the windowEpochs claimed.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";
import type { GovernanceEpoch } from "./longitudinal-memory.js";
import type { ArchivedEpochEnvelope } from "./evidence-durability.js";

// ---------------------------------------------------------------------------
// Confidence + summary
// ---------------------------------------------------------------------------

export const COMPRESSION_CONFIDENCE = [
  "FULL",
  "HIGH",
  "PARTIAL",
  "LOW",
  "UNRECONSTRUCTABLE",
] as const;
export type CompressionConfidence = (typeof COMPRESSION_CONFIDENCE)[number];

const CONFIDENCE_RANK: Readonly<Record<GovernanceEpoch["aggregateVerificationConfidence"], number>> =
  Object.freeze({
    UNKNOWN: 0,
    UNVERIFIED: 1,
    ASSUMED: 2,
    "PARTIALLY-VERIFIED": 3,
    VERIFIED: 4,
  });

function worstConfidence(
  a: GovernanceEpoch["aggregateVerificationConfidence"],
  b: GovernanceEpoch["aggregateVerificationConfidence"],
): GovernanceEpoch["aggregateVerificationConfidence"] {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}

export interface EvidenceSummary {
  readonly summaryVersion: 1;
  readonly windowFromIso: string;
  readonly windowToIso: string;
  readonly windowEpochs: number;
  readonly contributingEpochCount: number;
  readonly contributingEpochHashes: readonly string[];
  // Sums (never averaged)
  readonly totalReplayAmbiguous: number;
  readonly totalReplayCollapsed: number;
  readonly totalContradictions: number;
  readonly totalActiveOverrides: number;
  readonly totalExpiredOverrides: number;
  readonly totalOverRenewedOverrides: number;
  readonly totalIntegrityDegraded: number;
  readonly totalContainmentDegraded: number;
  readonly totalRecoveryAttempts: number;
  readonly totalRecoveryFailures: number;
  // Worst-of (no smoothing)
  readonly worstAggregateConfidence: GovernanceEpoch["aggregateVerificationConfidence"];
  readonly mergedDegradedDomainTallies: Readonly<Record<string, number>>;
  // Compression metadata
  readonly compressionConfidence: CompressionConfidence;
  readonly summaryCanonicalHash: string;
  readonly roundTripCheckHash: string;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export interface CompressionInput {
  readonly windowFromIso: string;
  readonly windowToIso: string;
  /** Total epochs the caller claims belong to this window (incl. missing). */
  readonly windowEpochs: number;
  readonly envelopes: readonly ArchivedEpochEnvelope[];
}

/**
 * Produce a compressed summary. Pure: identical input ⇒ identical output.
 */
export function buildEvidenceSummary(input: CompressionInput): EvidenceSummary {
  let totalReplayAmbiguous = 0;
  let totalReplayCollapsed = 0;
  let totalContradictions = 0;
  let totalActive = 0;
  let totalExpired = 0;
  let totalOverRenewed = 0;
  let totalIntegrityDeg = 0;
  let totalContainmentDeg = 0;
  let totalRecoveryAttempts = 0;
  let totalRecoveryFailures = 0;
  let worst: GovernanceEpoch["aggregateVerificationConfidence"] = "VERIFIED";
  const merged: Record<string, number> = {};
  const contributingHashes: string[] = [];

  for (const env of input.envelopes) {
    const e = env.currentPayload;
    contributingHashes.push(env.envelopeHash);
    totalReplayAmbiguous += e.replayAmbiguousCount;
    totalReplayCollapsed += e.replayCollapsedCount;
    totalContradictions += e.contradictionCount;
    totalActive += e.activeOverrideCount;
    totalExpired += e.expiredOverrideCount;
    totalOverRenewed += e.overRenewedOverrideCount;
    totalIntegrityDeg += e.integrityDegradedCount;
    totalContainmentDeg += e.containmentDegradedCount;
    totalRecoveryAttempts += e.recoveryAttemptCount;
    totalRecoveryFailures += e.recoveryFailureCount;
    worst = worstConfidence(worst, e.aggregateVerificationConfidence);
    for (const [domain, count] of Object.entries(e.degradedDomainTallies ?? {})) {
      merged[domain] = (merged[domain] ?? 0) + (count ?? 0);
    }
  }

  // Sort hash list + merged keys for canonical output (order-independent input)
  contributingHashes.sort();
  const mergedSorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));

  // Compression confidence: function of contributing/window ratio
  const ratio = input.windowEpochs === 0 ? 0 : input.envelopes.length / input.windowEpochs;
  let conf: CompressionConfidence;
  if (input.windowEpochs === 0 || input.envelopes.length === 0) conf = "UNRECONSTRUCTABLE";
  else if (ratio >= 0.95) conf = "FULL";
  else if (ratio >= 0.8) conf = "HIGH";
  else if (ratio >= 0.5) conf = "PARTIAL";
  else if (ratio >= 0.2) conf = "LOW";
  else conf = "UNRECONSTRUCTABLE";

  const preHash = {
    summaryVersion: 1 as const,
    windowFromIso: input.windowFromIso,
    windowToIso: input.windowToIso,
    windowEpochs: input.windowEpochs,
    contributingEpochCount: input.envelopes.length,
    contributingEpochHashes: contributingHashes,
    totalReplayAmbiguous,
    totalReplayCollapsed,
    totalContradictions,
    totalActiveOverrides: totalActive,
    totalExpiredOverrides: totalExpired,
    totalOverRenewedOverrides: totalOverRenewed,
    totalIntegrityDegraded: totalIntegrityDeg,
    totalContainmentDegraded: totalContainmentDeg,
    totalRecoveryAttempts: totalRecoveryAttempts,
    totalRecoveryFailures: totalRecoveryFailures,
    worstAggregateConfidence: worst,
    mergedDegradedDomainTallies: mergedSorted,
    compressionConfidence: conf,
  };
  const summaryCanonicalHash = sha256Hex(canonicalize(preHash));
  const roundTripCheckHash = sha256Hex(canonicalize({
    contributingHashes,
    totals: {
      ambig: totalReplayAmbiguous,
      collapsed: totalReplayCollapsed,
      contradictions: totalContradictions,
    },
    worst,
  }));

  return Object.freeze({
    ...preHash,
    summaryCanonicalHash,
    roundTripCheckHash,
  });
}

// ---------------------------------------------------------------------------
// Reconstruction verifier
// ---------------------------------------------------------------------------

export type CompressionFinding =
  | { readonly tag: "summary-hash-mismatch"; readonly recorded: string; readonly recomputed: string }
  | { readonly tag: "round-trip-mismatch"; readonly recorded: string; readonly recomputed: string }
  | { readonly tag: "ambiguity-collapsed"; readonly field: string }
  | { readonly tag: "missing-source-envelope"; readonly hash: string }
  | { readonly tag: "summary-version-mismatch"; readonly value: number };

/**
 * Verify a previously-built summary against its source archive.
 * Recomputes from the supplied envelopes and compares hashes.
 */
export function verifyEvidenceSummary(
  summary: EvidenceSummary,
  sourceEnvelopes: readonly ArchivedEpochEnvelope[],
): readonly CompressionFinding[] {
  const findings: CompressionFinding[] = [];

  if (summary.summaryVersion !== 1) {
    findings.push({ tag: "summary-version-mismatch", value: summary.summaryVersion });
  }

  // Source-envelope coverage check
  const envelopeHashes = new Set(sourceEnvelopes.map((e) => e.envelopeHash));
  for (const h of summary.contributingEpochHashes) {
    if (!envelopeHashes.has(h)) {
      findings.push({ tag: "missing-source-envelope", hash: h });
    }
  }

  // Recompute hash from RECORDED summary fields (catches totals tampering
  // where the field changed but the recorded hash didn't).
  const recordedSelfHash = sha256Hex(canonicalize({
    summaryVersion: summary.summaryVersion,
    windowFromIso: summary.windowFromIso,
    windowToIso: summary.windowToIso,
    windowEpochs: summary.windowEpochs,
    contributingEpochCount: summary.contributingEpochCount,
    contributingEpochHashes: summary.contributingEpochHashes,
    totalReplayAmbiguous: summary.totalReplayAmbiguous,
    totalReplayCollapsed: summary.totalReplayCollapsed,
    totalContradictions: summary.totalContradictions,
    totalActiveOverrides: summary.totalActiveOverrides,
    totalExpiredOverrides: summary.totalExpiredOverrides,
    totalOverRenewedOverrides: summary.totalOverRenewedOverrides,
    totalIntegrityDegraded: summary.totalIntegrityDegraded,
    totalContainmentDegraded: summary.totalContainmentDegraded,
    totalRecoveryAttempts: summary.totalRecoveryAttempts,
    totalRecoveryFailures: summary.totalRecoveryFailures,
    worstAggregateConfidence: summary.worstAggregateConfidence,
    mergedDegradedDomainTallies: summary.mergedDegradedDomainTallies,
    compressionConfidence: summary.compressionConfidence,
  }));
  if (recordedSelfHash !== summary.summaryCanonicalHash) {
    findings.push({
      tag: "summary-hash-mismatch",
      recorded: summary.summaryCanonicalHash,
      recomputed: recordedSelfHash,
    });
  }

  // Recompute summary from source and compare
  const recomputed = buildEvidenceSummary({
    windowFromIso: summary.windowFromIso,
    windowToIso: summary.windowToIso,
    windowEpochs: summary.windowEpochs,
    envelopes: sourceEnvelopes,
  });
  if (
    recomputed.summaryCanonicalHash !== summary.summaryCanonicalHash &&
    !findings.some((f) => f.tag === "summary-hash-mismatch")
  ) {
    findings.push({
      tag: "summary-hash-mismatch",
      recorded: summary.summaryCanonicalHash,
      recomputed: recomputed.summaryCanonicalHash,
    });
  }
  if (recomputed.roundTripCheckHash !== summary.roundTripCheckHash) {
    findings.push({
      tag: "round-trip-mismatch",
      recorded: summary.roundTripCheckHash,
      recomputed: recomputed.roundTripCheckHash,
    });
  }

  // Ambiguity preservation: any non-zero source ambiguity must surface in summary
  const sourceAmbig = sourceEnvelopes.reduce((a, e) => a + e.currentPayload.replayAmbiguousCount, 0);
  if (sourceAmbig > 0 && summary.totalReplayAmbiguous === 0) {
    findings.push({ tag: "ambiguity-collapsed", field: "totalReplayAmbiguous" });
  }
  const sourceCollapsed = sourceEnvelopes.reduce((a, e) => a + e.currentPayload.replayCollapsedCount, 0);
  if (sourceCollapsed > 0 && summary.totalReplayCollapsed === 0) {
    findings.push({ tag: "ambiguity-collapsed", field: "totalReplayCollapsed" });
  }
  const sourceContradictions = sourceEnvelopes.reduce((a, e) => a + e.currentPayload.contradictionCount, 0);
  if (sourceContradictions > 0 && summary.totalContradictions === 0) {
    findings.push({ tag: "ambiguity-collapsed", field: "totalContradictions" });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// CI gate
// ---------------------------------------------------------------------------

export interface EvidenceCompressionReport {
  readonly executedAt: string;
  readonly summary: EvidenceSummary;
  readonly findings: readonly CompressionFinding[];
  readonly hasCiGatingCondition: boolean;
}

export function buildEvidenceCompressionReport(
  summary: EvidenceSummary,
  sourceEnvelopes: readonly ArchivedEpochEnvelope[],
  nowIso: string,
): EvidenceCompressionReport {
  const findings = verifyEvidenceSummary(summary, sourceEnvelopes);
  return Object.freeze({
    executedAt: nowIso,
    summary,
    findings,
    hasCiGatingCondition: findings.length > 0,
  });
}
