/**
 * Replay-cognitive compression (W2-PR73A).
 *
 * Operator-facing projection over a ReplaySurvivabilityReport. Distinct
 * from evidence-compression (W2-PR69A): that layer is archival; this
 * layer is UX. Both share the same source of truth and never claim
 * decompression — they are projections that cite their lineage.
 *
 * Cognitive budget:
 *   - HEADLINE  ≤ 1 indicator (one short sentence)
 *   - SUMMARY   ≤ 7 indicators (matches TrustOverviewPanel cap)
 *   - DETAIL    ≤ 20 indicators (counters + per-edge call-outs)
 *   - RAW       no cap (full survivability report fields exposed)
 *
 * Each level MUST surface ambiguity if the source has it. Each level
 * MUST cite the source survivability report's score so the lineage is
 * never severed.
 *
 * Lexicon-aligned: this is "operator replay observability + best-effort
 * idempotency check via correlationId" — not a decompression substrate
 * guarantee.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";
import type { ReplaySurvivabilityReport, ReconstructionConfidence } from "./replay-survivability.js";

// ---------------------------------------------------------------------------
// Abstraction levels
// ---------------------------------------------------------------------------

export const REPLAY_ABSTRACTION_LEVELS = ["HEADLINE", "SUMMARY", "DETAIL", "RAW"] as const;
export type ReplayAbstractionLevel = (typeof REPLAY_ABSTRACTION_LEVELS)[number];

const LEVEL_INDICATOR_CAP: Readonly<Record<ReplayAbstractionLevel, number | null>> = Object.freeze({
  HEADLINE: 1,
  SUMMARY: 7,
  DETAIL: 20,
  RAW: null, // uncapped
});

// ---------------------------------------------------------------------------
// Digest shape
// ---------------------------------------------------------------------------

export interface OperatorReplayDigest {
  readonly level: ReplayAbstractionLevel;
  readonly capturedAt: string;
  /** Short, operator-readable indicator strings; bounded per level. */
  readonly indicators: readonly string[];
  // Lineage citation — every digest cites the source survivability report.
  readonly sourceConfidence: ReconstructionConfidence;
  readonly sourceScore: number;
  readonly sourceWindowEpochs: number;
  readonly sourceImpossibleJumps: number;
  readonly ambiguityPreserved: boolean;
  /** Cognitive load score 0..100 — lower is lighter for the operator. */
  readonly cognitiveLoadScore: number;
  /** Convergence hash binds level + indicators + lineage for tamper evidence. */
  readonly digestHash: string;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function buildIndicatorsFor(
  level: ReplayAbstractionLevel,
  report: ReplaySurvivabilityReport,
): readonly string[] {
  const score = report.score;
  const headlineLine =
    `replay ${score.confidence} (score ${score.survivabilityScore}/100` +
    `${score.impossibleJumps > 0 ? `, ⚠ ${score.impossibleJumps} impossible jump(s)` : ""}` +
    `${!score.ambiguityPreserved ? ", ⚠ ambiguity ELIDED" : ""})`;

  if (level === "HEADLINE") {
    return Object.freeze([headlineLine]);
  }

  const summary: string[] = [
    headlineLine,
    `evidence-bearing ${score.evidenceBearingEpochs}/${score.windowEpochs}`,
  ];
  if (score.contiguousEdges > 0) summary.push(`${score.contiguousEdges} contiguous edge(s)`);
  if (score.bridgedEdges > 0) summary.push(`${score.bridgedEdges} bridged edge(s)`);
  if (score.gappedEdges > 0) summary.push(`⚠ ${score.gappedEdges} gapped edge(s)`);
  if (score.impossibleJumps > 0) summary.push(`⚠ ${score.impossibleJumps} impossible jump(s)`);
  if (!score.ambiguityPreserved) summary.push(`⚠ AMBIGUITY ELIDED (suspected up-resolution)`);

  if (level === "SUMMARY") {
    return Object.freeze(summary.slice(0, LEVEL_INDICATOR_CAP.SUMMARY!));
  }

  const detail: string[] = [...summary];
  // DETAIL adds lineage call-outs
  detail.push(`contributing epoch indices: ${report.lineage.contributingEpochIndices.join(", ") || "(none)"}`);
  detail.push(`gap epoch indices: ${report.lineage.gapEpochIndices.join(", ") || "(none)"}`);
  for (const f of report.findings) {
    detail.push(`finding: ${JSON.stringify(f)}`);
  }
  for (const a of report.lineage.assertedStates) {
    detail.push(`asserted: idx ${a.atIndex} → ${a.state}`);
  }
  if (level === "DETAIL") {
    return Object.freeze(detail.slice(0, LEVEL_INDICATOR_CAP.DETAIL!));
  }

  // RAW
  const raw: string[] = [...detail];
  for (const node of report.graph.nodes) {
    raw.push(
      `node idx=${node.sequenceIndex} amb=${node.observedAmbiguous} coll=${node.observedCollapsed} bearing=${node.evidenceBearing}`,
    );
  }
  for (const edge of report.graph.edges) {
    raw.push(
      `edge ${edge.fromIndex}→${edge.toIndex} kind=${edge.kind} gap=${edge.gapSize}`,
    );
  }
  return Object.freeze(raw);
}

/**
 * Cognitive load score: a function of indicator count + ambiguity-bearing
 * field surface area. Lower is lighter for the operator.
 *
 * Bounded such that:
 *   - HEADLINE → 5..15
 *   - SUMMARY  → 15..35
 *   - DETAIL   → 35..70
 *   - RAW      → 70..100
 */
function computeCognitiveLoad(
  level: ReplayAbstractionLevel,
  indicators: readonly string[],
  report: ReplaySurvivabilityReport,
): number {
  const base: Record<ReplayAbstractionLevel, number> = {
    HEADLINE: 5,
    SUMMARY: 15,
    DETAIL: 35,
    RAW: 70,
  };
  let score = base[level];
  score += Math.min(indicators.length * 2, 25);
  // Ambiguity surface: each non-zero ambiguity counter adds load
  if (report.score.impossibleJumps > 0) score += 5;
  if (!report.score.ambiguityPreserved) score += 10;
  if (score > 100) score = 100;
  return score;
}

export function buildOperatorReplayDigest(
  report: ReplaySurvivabilityReport,
  level: ReplayAbstractionLevel,
): OperatorReplayDigest {
  const indicators = buildIndicatorsFor(level, report);
  const cognitiveLoadScore = computeCognitiveLoad(level, indicators, report);
  const preHash = {
    level,
    capturedAt: report.executedAt,
    indicators,
    sourceConfidence: report.score.confidence,
    sourceScore: report.score.survivabilityScore,
    sourceWindowEpochs: report.score.windowEpochs,
    sourceImpossibleJumps: report.score.impossibleJumps,
    ambiguityPreserved: report.score.ambiguityPreserved,
    cognitiveLoadScore,
  };
  const digestHash = sha256Hex(canonicalize(preHash));
  return Object.freeze({
    ...preHash,
    digestHash,
  });
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export type CognitionViolation =
  | { readonly tag: "indicator-overflow"; readonly level: ReplayAbstractionLevel; readonly count: number; readonly cap: number }
  | { readonly tag: "ambiguity-elided"; readonly level: ReplayAbstractionLevel }
  | { readonly tag: "impossible-jump-not-headlined"; readonly level: ReplayAbstractionLevel }
  | { readonly tag: "lineage-severed"; readonly level: ReplayAbstractionLevel }
  | { readonly tag: "digest-hash-mismatch"; readonly recorded: string; readonly recomputed: string }
  | { readonly tag: "unreconstructable-without-headline"; readonly level: ReplayAbstractionLevel };

/**
 * Validate that a digest preserves the cognitive + ambiguity contract.
 *
 * Every level MUST cite source confidence and score (lineage). Every
 * non-RAW level MUST surface impossible jumps if any exist. Ambiguity-
 * preservation flag MUST match the source. Indicator count MUST stay
 * under the level's cap.
 */
export function validateOperatorReplayDigest(
  digest: OperatorReplayDigest,
  source: ReplaySurvivabilityReport,
): readonly CognitionViolation[] {
  const violations: CognitionViolation[] = [];

  // Indicator cap
  const cap = LEVEL_INDICATOR_CAP[digest.level];
  if (cap !== null && digest.indicators.length > cap) {
    violations.push({
      tag: "indicator-overflow",
      level: digest.level,
      count: digest.indicators.length,
      cap,
    });
  }

  // Ambiguity preservation must match source
  if (source.score.ambiguityPreserved && !digest.ambiguityPreserved) {
    violations.push({ tag: "ambiguity-elided", level: digest.level });
  }

  // Impossible jumps surface in non-RAW levels
  if (
    source.score.impossibleJumps > 0 &&
    digest.level !== "RAW" &&
    !digest.indicators.some((i) => i.toLowerCase().includes("impossible"))
  ) {
    violations.push({ tag: "impossible-jump-not-headlined", level: digest.level });
  }

  // Lineage citation: source-confidence + sourceScore must match
  if (
    digest.sourceConfidence !== source.score.confidence ||
    digest.sourceScore !== source.score.survivabilityScore ||
    digest.sourceWindowEpochs !== source.score.windowEpochs
  ) {
    violations.push({ tag: "lineage-severed", level: digest.level });
  }

  // UNRECONSTRUCTABLE source must produce HEADLINE coverage
  if (
    source.score.confidence === "UNRECONSTRUCTABLE" &&
    digest.level !== "HEADLINE" &&
    !digest.indicators.some((i) => i.toLowerCase().includes("unreconstructable"))
  ) {
    violations.push({ tag: "unreconstructable-without-headline", level: digest.level });
  }

  // Recompute digest hash
  const recomputed = sha256Hex(canonicalize({
    level: digest.level,
    capturedAt: digest.capturedAt,
    indicators: digest.indicators,
    sourceConfidence: digest.sourceConfidence,
    sourceScore: digest.sourceScore,
    sourceWindowEpochs: digest.sourceWindowEpochs,
    sourceImpossibleJumps: digest.sourceImpossibleJumps,
    ambiguityPreserved: digest.ambiguityPreserved,
    cognitiveLoadScore: digest.cognitiveLoadScore,
  }));
  if (recomputed !== digest.digestHash) {
    violations.push({ tag: "digest-hash-mismatch", recorded: digest.digestHash, recomputed });
  }

  return violations;
}

// ---------------------------------------------------------------------------
// CI gate
// ---------------------------------------------------------------------------

export interface ReplayCognitionReport {
  readonly executedAt: string;
  readonly digest: OperatorReplayDigest;
  readonly violations: readonly CognitionViolation[];
  readonly hasCiGatingCondition: boolean;
}

export function buildReplayCognitionReport(
  source: ReplaySurvivabilityReport,
  level: ReplayAbstractionLevel,
  nowIso: string,
): ReplayCognitionReport {
  const digest = buildOperatorReplayDigest(source, level);
  const violations = validateOperatorReplayDigest(digest, source);
  return Object.freeze({
    executedAt: nowIso,
    digest,
    violations,
    hasCiGatingCondition: violations.length > 0,
  });
}
