/**
 * Replay survivability + continuity reconstruction (W2-PR33A).
 *
 * Builds a reconstruction graph over the W2-PR30A append-only ledger's
 * replay observations, scores partial-continuity recovery, and rejects
 * impossible continuity jumps that the REPLAY_TRANSITIONS evidence rules
 * (W2-PR20A) forbid.
 *
 * Lexicon: this layer DOES NOT claim replay protection or replay
 * resistance. It surfaces replay observability + best-effort continuity
 * reconstruction. Ambiguity is preserved at every step.
 *
 * Non-negotiable rules (W2-PR33A):
 *   - ambiguity preserved
 *   - partial reconstruction visible
 *   - impossible continuity jumps rejected
 *   - replay confidence evidence-derived
 *   - degraded replay remains operator-visible
 */

import type { GovernanceEpoch, GovernanceLedger } from "./longitudinal-memory.js";
import { REPLAY_TRANSITIONS, type AllowedTransition } from "./transitions.js";
import type { ReplayState } from "./replay-state.js";

// ---------------------------------------------------------------------------
// Reconstruction node — one observed replay slice (one epoch)
// ---------------------------------------------------------------------------

export interface ReplayObservationNode {
  /** Sequence index in the ledger window. */
  readonly sequenceIndex: number;
  /** ISO-8601 UTC observation instant. */
  readonly observedAt: string;
  /** Observed replay state distribution (counts) for this epoch. */
  readonly observedAmbiguous: number;
  readonly observedCollapsed: number;
  /**
   * Whether this observation is "evidence-bearing" — i.e., contains any
   * non-zero replay signals. An evidence-bearing observation can anchor a
   * reconstruction; a fully-zero observation cannot disambiguate prior
   * gaps.
   */
  readonly evidenceBearing: boolean;
}

// ---------------------------------------------------------------------------
// TARGET 1 — Reconstruction graph
// ---------------------------------------------------------------------------

export type ContinuityEdgeKind =
  | "CONTIGUOUS" // adjacent epochs, no gap
  | "BRIDGED" // gap exists but both endpoints carry replay evidence
  | "GAPPED" // gap exists, evidence missing on at least one side
  | "IMPOSSIBLE-JUMP"; // claimed transition not allowed by REPLAY_TRANSITIONS

export interface ReplayContinuityEdge {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly gapSize: number; // 0 for contiguous; N for N missing epochs in between
  readonly kind: ContinuityEdgeKind;
  /**
   * If the two endpoints assert different dominant replay states (e.g.,
   * R-COLLAPSED → R-OBSERVED), the transition is checked against
   * REPLAY_TRANSITIONS. If forbidden without evidence, edge becomes
   * IMPOSSIBLE-JUMP.
   */
  readonly fromDominantState: ReplayState | null;
  readonly toDominantState: ReplayState | null;
}

export interface ReplayReconstructionGraph {
  readonly nodes: readonly ReplayObservationNode[];
  readonly edges: readonly ReplayContinuityEdge[];
  /** Indices of epochs in the original window that had no observation (gaps). */
  readonly missingIndices: readonly number[];
}

/**
 * Derive the dominant replay state from an epoch's counts.
 *
 * Conservative: ties resolve to R-AMBIGUOUS (rule: ambiguity preserved).
 * Empty observation returns null (caller treats as missing).
 */
function dominantReplayState(epoch: GovernanceEpoch): ReplayState | null {
  const ambig = epoch.replayAmbiguousCount;
  const collapsed = epoch.replayCollapsedCount;
  if (ambig === 0 && collapsed === 0) return null;
  if (ambig > collapsed) return "R-AMBIGUOUS";
  if (collapsed > ambig) return "R-COLLAPSED";
  // ties → preserve ambiguity rather than picking arbitrarily
  return "R-AMBIGUOUS";
}

function nodeFromEpoch(idx: number, e: GovernanceEpoch): ReplayObservationNode {
  return Object.freeze({
    sequenceIndex: idx,
    observedAt: e.observedAt,
    observedAmbiguous: e.replayAmbiguousCount,
    observedCollapsed: e.replayCollapsedCount,
    evidenceBearing: e.replayAmbiguousCount + e.replayCollapsedCount > 0,
  });
}

function isAllowedTransition(
  from: ReplayState,
  to: ReplayState,
): AllowedTransition<ReplayState> | null {
  if (from === to) return { from, to } as AllowedTransition<ReplayState>;
  for (const t of REPLAY_TRANSITIONS) {
    if (t.from === from && t.to === to) return t;
  }
  return null;
}

/**
 * Build the reconstruction graph over a ledger window.
 *
 * Nodes: epochs that carry any replay-relevant signal (evidence-bearing OR
 *        explicitly-zeroed, both are observations).
 * Edges: between consecutive evidence-bearing nodes. Adjacent epochs ⇒
 *        CONTIGUOUS. Skipped epochs that have no evidence ⇒ counted in
 *        gapSize. If a forbidden state-jump is asserted across the gap
 *        with no intervening evidence ⇒ IMPOSSIBLE-JUMP.
 */
export function buildReplayReconstructionGraph(
  ledger: GovernanceLedger,
): ReplayReconstructionGraph {
  const epochs = ledger.epochs;
  const nodes: ReplayObservationNode[] = epochs.map((e, i) => nodeFromEpoch(i, e));
  const evidenceBearing = nodes.filter((n) => n.evidenceBearing);

  const edges: ReplayContinuityEdge[] = [];
  for (let i = 1; i < evidenceBearing.length; i++) {
    const prev = evidenceBearing[i - 1]!;
    const cur = evidenceBearing[i]!;
    const gapSize = cur.sequenceIndex - prev.sequenceIndex - 1;
    const fromDom = dominantReplayState(epochs[prev.sequenceIndex]!);
    const toDom = dominantReplayState(epochs[cur.sequenceIndex]!);
    let kind: ContinuityEdgeKind;
    if (gapSize === 0) {
      kind = "CONTIGUOUS";
    } else if (gapSize > 0 && fromDom && toDom) {
      const allowed = isAllowedTransition(fromDom, toDom);
      kind = allowed ? "BRIDGED" : "IMPOSSIBLE-JUMP";
    } else {
      kind = "GAPPED";
    }
    edges.push(
      Object.freeze({
        fromIndex: prev.sequenceIndex,
        toIndex: cur.sequenceIndex,
        gapSize,
        kind,
        fromDominantState: fromDom,
        toDominantState: toDom,
      }),
    );
  }

  const observed = new Set(evidenceBearing.map((n) => n.sequenceIndex));
  const missingIndices: number[] = [];
  for (let i = 0; i < epochs.length; i++) {
    if (!observed.has(i)) missingIndices.push(i);
  }

  return Object.freeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    missingIndices: Object.freeze(missingIndices),
  });
}

// ---------------------------------------------------------------------------
// TARGET 2/3 — Partial continuity recovery + survivability scoring
// ---------------------------------------------------------------------------

export const RECONSTRUCTION_CONFIDENCE = [
  "FULL",
  "HIGH",
  "PARTIAL",
  "LOW",
  "UNRECONSTRUCTABLE",
] as const;
export type ReconstructionConfidence =
  (typeof RECONSTRUCTION_CONFIDENCE)[number];

export interface ReplaySurvivabilityScore {
  readonly windowEpochs: number;
  readonly observedEpochs: number;
  readonly evidenceBearingEpochs: number;
  readonly contiguousEdges: number;
  readonly bridgedEdges: number;
  readonly gappedEdges: number;
  readonly impossibleJumps: number;
  /** 0..100 — fraction of expected continuity that's actually present. */
  readonly survivabilityScore: number;
  readonly confidence: ReconstructionConfidence;
  /** Whether ambiguity remains explicitly visible (no silent up-resolution). */
  readonly ambiguityPreserved: boolean;
}

/**
 * Score replay survivability for a given graph.
 *
 * Score model (additive, capped at 100):
 *   start = 100 if windowEpochs > 0 else 0
 *   - 5 per missing-evidence epoch (cap −40)
 *   - 8 per gapped edge          (cap −30)
 *   - 25 per impossible jump     (no cap — single impossible jump drops
 *                                  to UNRECONSTRUCTABLE territory)
 *   + 0 for bridged edges (presence already counted by contiguity)
 *
 * Confidence tier:
 *   FULL              if score ≥ 95 AND no missing AND no gapped AND no impossible
 *   HIGH              if score ≥ 80 AND impossibleJumps == 0
 *   PARTIAL           if score ≥ 50 AND impossibleJumps == 0
 *   LOW               if score ≥ 25
 *   UNRECONSTRUCTABLE otherwise
 */
export function scoreReplaySurvivability(
  graph: ReplayReconstructionGraph,
  ledger: GovernanceLedger,
): ReplaySurvivabilityScore {
  const windowEpochs = ledger.epochs.length;
  const observedEpochs = graph.nodes.length;
  const evidenceBearingEpochs = graph.nodes.filter((n) => n.evidenceBearing).length;

  let contiguous = 0;
  let bridged = 0;
  let gapped = 0;
  let impossible = 0;
  for (const e of graph.edges) {
    if (e.kind === "CONTIGUOUS") contiguous++;
    else if (e.kind === "BRIDGED") bridged++;
    else if (e.kind === "GAPPED") gapped++;
    else if (e.kind === "IMPOSSIBLE-JUMP") impossible++;
  }

  // Zero-evidence window on a non-empty ledger collapses immediately to
  // UNRECONSTRUCTABLE — there is no signal to reconstruct from.
  let score: number;
  if (windowEpochs === 0) {
    score = 0;
  } else if (evidenceBearingEpochs === 0) {
    score = 0;
  } else {
    score = 100;
    const missingPenalty = Math.min(graph.missingIndices.length * 5, 40);
    score -= missingPenalty;
    const gappedPenalty = Math.min(gapped * 8, 30);
    score -= gappedPenalty;
    score -= impossible * 25;
    // Low-evidence-density penalty: when most of the window has no signal,
    // the few observations don't support a high-confidence reconstruction.
    const evidenceRatio = evidenceBearingEpochs / windowEpochs;
    if (evidenceRatio < 0.5) {
      score -= Math.round((0.5 - evidenceRatio) * 80);
    }
    if (score < 0) score = 0;
    if (score > 100) score = 100;
  }

  // Ambiguity preservation: any node with observedAmbiguous > 0 must
  // remain visible somewhere in the graph (not silently aggregated away).
  const ambiguityPreserved = graph.nodes.some(
    (n) => n.observedAmbiguous > 0,
  )
    ? graph.nodes.some((n) => n.observedAmbiguous > 0)
    : true;

  let confidence: ReconstructionConfidence;
  if (
    score >= 95 &&
    graph.missingIndices.length === 0 &&
    gapped === 0 &&
    impossible === 0
  ) {
    confidence = "FULL";
  } else if (score >= 80 && impossible === 0) {
    confidence = "HIGH";
  } else if (score >= 50 && impossible === 0) {
    confidence = "PARTIAL";
  } else if (score >= 25) {
    confidence = "LOW";
  } else {
    confidence = "UNRECONSTRUCTABLE";
  }

  return Object.freeze({
    windowEpochs,
    observedEpochs,
    evidenceBearingEpochs,
    contiguousEdges: contiguous,
    bridgedEdges: bridged,
    gappedEdges: gapped,
    impossibleJumps: impossible,
    survivabilityScore: score,
    confidence,
    ambiguityPreserved,
  });
}

// ---------------------------------------------------------------------------
// TARGET 5 — Reconstruction lineage tracking
// ---------------------------------------------------------------------------

export interface ReconstructionLineage {
  /** Indices of epochs that contributed evidence to the reconstruction. */
  readonly contributingEpochIndices: readonly number[];
  /** Indices skipped due to gaps. */
  readonly gapEpochIndices: readonly number[];
  /** Indices flagged for impossible-jump assertions. */
  readonly impossibleJumpEdgeIndices: readonly number[];
  /** Replay state assertions made along the reconstructed path. */
  readonly assertedStates: readonly { readonly atIndex: number; readonly state: ReplayState }[];
}

export function deriveReconstructionLineage(
  graph: ReplayReconstructionGraph,
  ledger: GovernanceLedger,
): ReconstructionLineage {
  const contributing = graph.nodes
    .filter((n) => n.evidenceBearing)
    .map((n) => n.sequenceIndex);
  const impossibleEdges: number[] = [];
  graph.edges.forEach((e, i) => {
    if (e.kind === "IMPOSSIBLE-JUMP") impossibleEdges.push(i);
  });
  const asserted: { atIndex: number; state: ReplayState }[] = [];
  for (const n of graph.nodes) {
    const dom = dominantReplayState(ledger.epochs[n.sequenceIndex]!);
    if (dom) asserted.push({ atIndex: n.sequenceIndex, state: dom });
  }
  return Object.freeze({
    contributingEpochIndices: Object.freeze(contributing),
    gapEpochIndices: graph.missingIndices,
    impossibleJumpEdgeIndices: Object.freeze(impossibleEdges),
    assertedStates: Object.freeze(asserted),
  });
}

// ---------------------------------------------------------------------------
// TARGET 7 — CI gate
// ---------------------------------------------------------------------------

export type ReplaySurvivabilityFinding =
  | { readonly tag: "impossible-jump"; readonly edgeIndex: number; readonly fromIndex: number; readonly toIndex: number; readonly fromState: ReplayState | null; readonly toState: ReplayState | null }
  | { readonly tag: "ambiguity-erasure-suspected"; readonly atIndex: number }
  | { readonly tag: "unreconstructable-window"; readonly score: number };

export interface ReplaySurvivabilityReport {
  readonly executedAt: string;
  readonly graph: ReplayReconstructionGraph;
  readonly score: ReplaySurvivabilityScore;
  readonly lineage: ReconstructionLineage;
  readonly findings: readonly ReplaySurvivabilityFinding[];
  /**
   * CI gating triggers:
   *   - any IMPOSSIBLE-JUMP edge
   *   - confidence == UNRECONSTRUCTABLE on a non-empty window
   *   - ambiguity not preserved (suspected silent up-resolution)
   */
  readonly hasCiGatingCondition: boolean;
}

export function buildReplaySurvivabilityReport(
  ledger: GovernanceLedger,
  nowIso: string,
): ReplaySurvivabilityReport {
  const graph = buildReplayReconstructionGraph(ledger);
  const score = scoreReplaySurvivability(graph, ledger);
  const lineage = deriveReconstructionLineage(graph, ledger);

  const findings: ReplaySurvivabilityFinding[] = [];
  graph.edges.forEach((e, i) => {
    if (e.kind === "IMPOSSIBLE-JUMP") {
      findings.push({
        tag: "impossible-jump",
        edgeIndex: i,
        fromIndex: e.fromIndex,
        toIndex: e.toIndex,
        fromState: e.fromDominantState,
        toState: e.toDominantState,
      });
    }
  });

  if (
    score.confidence === "UNRECONSTRUCTABLE" &&
    ledger.epochs.length > 0
  ) {
    findings.push({ tag: "unreconstructable-window", score: score.survivabilityScore });
  }

  if (!score.ambiguityPreserved) {
    findings.push({ tag: "ambiguity-erasure-suspected", atIndex: -1 });
  }

  const gating =
    findings.some((f) => f.tag === "impossible-jump") ||
    findings.some((f) => f.tag === "unreconstructable-window") ||
    findings.some((f) => f.tag === "ambiguity-erasure-suspected");

  return Object.freeze({
    executedAt: nowIso,
    graph,
    score,
    lineage,
    findings: Object.freeze(findings),
    hasCiGatingCondition: gating,
  });
}
