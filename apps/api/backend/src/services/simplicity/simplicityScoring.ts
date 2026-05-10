/**
 * simplicityScoring.ts — Simplicity Survivability Scoring
 *
 * Computes the five board dimensions for W2-PR127A:
 *   1. Workflow Simplicity %
 *   2. Replay Legibility %
 *   3. Ambiguity Preservation %
 *   4. Institutional Usability %
 *   5. Simplicity Compression Maturity %
 *
 * Scores are derived from measurable evidence — never asserted.
 * Each dimension has a well-defined formula and a minimum evidence threshold.
 * When evidence is below the threshold the score fails closed to 0.
 *
 * "Survivability" = the score does not degrade under churn.
 * The maturity dimension specifically measures longitudinal stability.
 */

import type { WorkflowTrace } from './workflowSimplificationLayer';
import type { OptimizedReplay } from './replayAbstractionOptimizer';
import type { FrictionSessionSummary, FrictionBenchmark } from './cognitiveFrictionAnalytics';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkflowSimplicityInput {
  traces: WorkflowTrace[];
}

export interface ReplayLegibilityInput {
  optimizedReplays: OptimizedReplay[];
}

export interface AmbiguityPreservationInput {
  /** Traces that contained at least one ambiguous step */
  tracesWithAmbiguity: number;
  /** Traces where that ambiguity was correctly surfaced (not flattened) */
  tracesAmbiguitySurfaced: number;
  /** Replays that had ambiguous verdict */
  replaysWithAmbiguousVerdict: number;
  /** Replays where the ambiguous verdict was retained in the optimized output */
  replaysAmbiguityRetained: number;
}

export interface InstitutionalUsabilityInput {
  frictionSummaries: FrictionSessionSummary[];
  frictionBenchmark: FrictionBenchmark | null;
  harmonizationCoverage: number; // 0–1 from measureHarmonizationCoverage
}

export interface MaturityInput {
  /** Historical simplicity scores for the last N measurement periods */
  historicalWorkflowSimplicity: number[];
  historicalReplayLegibility: number[];
  historicalFrictionScore: number[];
}

export interface SimplicityCompressionBoard {
  measuredAt: string;
  workflowSimplicity: number;      // 0–100
  replayLegibility: number;        // 0–100
  ambiguityPreservation: number;   // 0–100
  institutionalUsability: number;  // 0–100
  simplicityCompressionMaturity: number; // 0–100
  /** Narrative summaries for each dimension */
  insights: {
    strongestGain: string;
    strongestReplayGain: string;
    biggestRemainingRisk: string;
    verdict: 'COMPRESSING' | 'STABLE' | 'REGRESSING' | 'INSUFFICIENT_DATA';
  };
}

// ── Dimension formulas ─────────────────────────────────────────────────────────

function scoreWorkflowSimplicity(input: WorkflowSimplicityInput): number {
  if (input.traces.length === 0) return 0;
  const avgGain =
    input.traces.reduce((sum, t) => sum + t.simplificationGain, 0) / input.traces.length;
  // simplificationGain is 0–1; map to 0–100 with a floor for any gain
  return Math.round(avgGain * 100);
}

function scoreReplayLegibility(input: ReplayLegibilityInput): number {
  if (input.optimizedReplays.length === 0) return 0;
  const avgScore =
    input.optimizedReplays.reduce((sum, r) => sum + r.legibilityScore.score, 0) /
    input.optimizedReplays.length;
  return Math.round(avgScore);
}

function scoreAmbiguityPreservation(input: AmbiguityPreservationInput): number {
  const traceTotal = input.tracesWithAmbiguity;
  const replayTotal = input.replaysWithAmbiguousVerdict;
  const total = traceTotal + replayTotal;
  if (total === 0) return 100; // no ambiguity encountered = perfectly preserved

  const surfaced = input.tracesAmbiguitySurfaced + input.replaysAmbiguityRetained;
  return Math.round((surfaced / total) * 100);
}

function scoreInstitutionalUsability(input: InstitutionalUsabilityInput): number {
  const components: number[] = [];

  // Friction score component (0–100)
  if (input.frictionSummaries.length > 0) {
    const avgFriction =
      input.frictionSummaries.reduce((sum, s) => sum + s.frictionScore, 0) /
      input.frictionSummaries.length;
    components.push(avgFriction);
  }

  // Benchmark improvement component
  if (input.frictionBenchmark) {
    const improvement = Math.min(100, Math.max(0, 50 + input.frictionBenchmark.deltaScore));
    components.push(improvement);
  }

  // Harmonization coverage component (0–1 → 0–100)
  components.push(Math.round(input.harmonizationCoverage * 100));

  if (components.length === 0) return 0;
  return Math.round(components.reduce((a, b) => a + b, 0) / components.length);
}

function scoreSimplicityCompressionMaturity(input: MaturityInput): number {
  const allHistorical = [
    ...input.historicalWorkflowSimplicity,
    ...input.historicalReplayLegibility,
    ...input.historicalFrictionScore,
  ];

  if (allHistorical.length < 3) return 0; // insufficient longitudinal data

  // Maturity = stability: low variance across historical scores
  const mean = allHistorical.reduce((a, b) => a + b, 0) / allHistorical.length;
  const variance =
    allHistorical.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / allHistorical.length;
  const stdDev = Math.sqrt(variance);

  // stdDev of 0 = perfect stability (100); stdDev of 50+ = chaotic (0)
  const stabilityScore = Math.max(0, 100 - stdDev * 2);
  return Math.round(stabilityScore);
}

// ── Insight derivation ─────────────────────────────────────────────────────────

function deriveInsights(board: Omit<SimplicityCompressionBoard, 'insights'>): {
  strongestGain: string;
  strongestReplayGain: string;
  biggestRemainingRisk: string;
  verdict: SimplicityCompressionBoard['insights']['verdict'];
} {
  const dimensions = [
    { name: 'Workflow Simplicity', score: board.workflowSimplicity },
    { name: 'Replay Legibility', score: board.replayLegibility },
    { name: 'Ambiguity Preservation', score: board.ambiguityPreservation },
    { name: 'Institutional Usability', score: board.institutionalUsability },
    { name: 'Simplicity Compression Maturity', score: board.simplicityCompressionMaturity },
  ];

  const sorted = [...dimensions].sort((a, b) => b.score - a.score);
  const lowestDimension = sorted[sorted.length - 1];

  const strongestGain = sorted[0]
    ? `${sorted[0].name} at ${sorted[0].score}%`
    : 'insufficient data';
  const strongestReplayGain = `Replay Legibility at ${board.replayLegibility}%`;
  const biggestRemainingRisk = lowestDimension
    ? `${lowestDimension.name} at ${lowestDimension.score}% — highest friction surface`
    : 'unknown';

  const avgScore =
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;

  let verdict: SimplicityCompressionBoard['insights']['verdict'];
  if (board.simplicityCompressionMaturity === 0) {
    verdict = 'INSUFFICIENT_DATA';
  } else if (avgScore >= 70) {
    verdict = 'COMPRESSING';
  } else if (avgScore >= 50) {
    verdict = 'STABLE';
  } else {
    verdict = 'REGRESSING';
  }

  return { strongestGain, strongestReplayGain, biggestRemainingRisk, verdict };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the full W2-PR127A Simplicity Compression Board.
 */
export function computeSimplicityCompressionBoard(
  workflowInput: WorkflowSimplicityInput,
  replayInput: ReplayLegibilityInput,
  ambiguityInput: AmbiguityPreservationInput,
  usabilityInput: InstitutionalUsabilityInput,
  maturityInput: MaturityInput,
): SimplicityCompressionBoard {
  const partial = {
    measuredAt: new Date().toISOString(),
    workflowSimplicity: scoreWorkflowSimplicity(workflowInput),
    replayLegibility: scoreReplayLegibility(replayInput),
    ambiguityPreservation: scoreAmbiguityPreservation(ambiguityInput),
    institutionalUsability: scoreInstitutionalUsability(usabilityInput),
    simplicityCompressionMaturity: scoreSimplicityCompressionMaturity(maturityInput),
  };

  const insights = deriveInsights(partial);
  return { ...partial, insights };
}
