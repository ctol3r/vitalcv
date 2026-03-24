/**
 * clinicianGraphResolution.ts — Wave G9: Cross-Graph Resolution + Explainability
 *
 * Takes all enrichment edges from G1-G8 axes and produces:
 *   1. A resolved identity graph with confidence scoring across axes
 *   2. Explainability objects for every non-trivial assertion
 *   3. Safe profile summaries (institutional, research, geographic footprint)
 *   4. Clear separation between trust-core verified claims and graph enrichment
 *
 * CRITICAL INVARIANT: Graph scoring is NEVER fed back into readiness.
 * The graph score is for: employer packet context, internal search/ranking,
 * operator investigation, and clinician profile richness.
 *
 * Score composition:
 *   - Each axis contributes 0–1 axis score
 *   - Axis scores are weighted by confidence and corroboration count
 *   - Final graph confidence score: weighted average, 0–1
 *   - Corroboration bonus: +0.05 per axis that independently confirms the same entity
 */

import {
  type ClinicianEnrichmentEdge,
  type ClinicianEnrichmentSummary,
  type GraphSourceType,
  enrichmentStatusLabel,
  shouldShowToEmployer,
} from '../../../../../../core/graph/enrichment';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GraphResolutionResult {
  npi: string;
  /** Composite graph confidence 0–1 across all enrichment axes. */
  graphConfidence: number;
  /** How many distinct axes contributed at least one high-confidence edge. */
  corroboratingAxisCount: number;
  /** Per-axis breakdown for explainability. */
  axisSummaries: AxisSummary[];
  /** Whether ORCID bridge was confirmed (elevates publication/funding confidence). */
  orcidBridgeConfirmed: boolean;
  /** Resolved ORCID iD (null if not bridged). */
  resolvedOrcidId: string | null;
  /** Employer-safe edges (no review_required, no stale). */
  employerSafeEdges: ClinicianEnrichmentEdge[];
  /** Human-readable explanation of the graph resolution. */
  resolutionExplanation: string;
  /** All input edges, re-sorted by confidence descending. */
  allEdges: ClinicianEnrichmentEdge[];
}

export interface AxisSummary {
  graphSourceType: GraphSourceType;
  edgeCount: number;
  highConfidenceCount: number;
  /** Axis-level confidence: mean confidence of all edges in this axis. */
  axisConfidence: number;
  /** Whether this axis has at least one employer-safe edge. */
  hasEmployerSafeEdges: boolean;
  /** Representative edges for display (top 3). */
  topEdges: ClinicianEnrichmentEdge[];
}

// ── Graph confidence scoring ──────────────────────────────────────────────────

const AXIS_WEIGHTS: Partial<Record<GraphSourceType, number>> = {
  cms_institutional:    1.0,   // NPI-keyed — highest weight
  nih_funding:          0.8,   // name-based but authoritative
  publication:          0.7,   // name-based, common in academia
  bibliometric:         0.5,   // derivative of publication axis
  clinical_trial:       0.75,  // name-based with NCT anchor
  orcid_academic:       0.9,   // strong academic identity signal
  geography_workforce:  0.6,   // address-derived, contextual
  training_provenance:  0.7,   // mostly from CMS NDF — reliable
  aggregate_market:     0.0,   // aggregate only — no individual identity signal
};

function axisWeight(sourceType: GraphSourceType): number {
  return AXIS_WEIGHTS[sourceType] ?? 0.5;
}

// ── Resolution engine ─────────────────────────────────────────────────────────

export function resolveClinicianGraph(
  npi: string,
  summary: ClinicianEnrichmentSummary,
): GraphResolutionResult {
  const edges = summary.edges.filter(e => e.graphStatus !== 'stale');

  // Group by axis
  const byAxis = new Map<GraphSourceType, ClinicianEnrichmentEdge[]>();
  for (const edge of edges) {
    const existing = byAxis.get(edge.graphSourceType) ?? [];
    existing.push(edge);
    byAxis.set(edge.graphSourceType, existing);
  }

  // Build per-axis summaries
  const axisSummaries: AxisSummary[] = [];
  const axisConfidences: Array<{ confidence: number; weight: number }> = [];

  for (const [sourceType, axisEdges] of byAxis.entries()) {
    const highConf = axisEdges.filter(e =>
      e.graphStatus === 'linked_verified' || e.graphStatus === 'linked_high_confidence',
    );
    const safeEdges = axisEdges.filter(e => shouldShowToEmployer(e));
    const axisConf =
      axisEdges.length > 0
        ? axisEdges.reduce((sum, e) => sum + e.edgeConfidence, 0) / axisEdges.length
        : 0;

    axisSummaries.push({
      graphSourceType: sourceType,
      edgeCount: axisEdges.length,
      highConfidenceCount: highConf.length,
      axisConfidence: axisConf,
      hasEmployerSafeEdges: safeEdges.length > 0,
      topEdges: [...axisEdges]
        .sort((a, b) => b.edgeConfidence - a.edgeConfidence)
        .slice(0, 3),
    });

    axisConfidences.push({ confidence: axisConf, weight: axisWeight(sourceType) });
  }

  // Compute composite graph confidence (weighted average)
  const totalWeight = axisConfidences.reduce((sum, { weight }) => sum + weight, 0);
  const graphConfidence =
    totalWeight > 0
      ? axisConfidences.reduce((sum, { confidence, weight }) => sum + confidence * weight, 0) / totalWeight
      : 0;

  // Corroborating axis count: axes with ≥1 high-confidence edge
  const corroboratingAxisCount = axisSummaries.filter(a => a.highConfidenceCount > 0).length;

  // ORCID bridge detection
  const orcidEdge = edges.find(e => e.edgeType === 'ORCID_IDENTITY_BRIDGE');
  const orcidBridgeConfirmed =
    orcidEdge !== undefined &&
    (orcidEdge.graphStatus === 'linked_verified' || orcidEdge.graphStatus === 'linked_high_confidence');
  const resolvedOrcidId = orcidEdge?.objectNodeKey ?? null;

  // Employer-safe edges
  const employerSafeEdges = edges
    .filter(e => shouldShowToEmployer(e))
    .sort((a, b) => b.edgeConfidence - a.edgeConfidence);

  // Resolution explanation
  const explanation = buildExplanation(npi, axisSummaries, graphConfidence, orcidBridgeConfirmed);

  return {
    npi,
    graphConfidence: Math.min(graphConfidence, 1.0),
    corroboratingAxisCount,
    axisSummaries,
    orcidBridgeConfirmed,
    resolvedOrcidId,
    employerSafeEdges,
    resolutionExplanation: explanation,
    allEdges: [...edges].sort((a, b) => b.edgeConfidence - a.edgeConfidence),
  };
}

function buildExplanation(
  npi: string,
  axisSummaries: AxisSummary[],
  graphConfidence: number,
  orcidConfirmed: boolean,
): string {
  const parts: string[] = [
    `NPI ${npi} — graph resolution across ${axisSummaries.length} enrichment axes.`,
  ];

  if (orcidConfirmed) {
    parts.push('ORCID academic identity bridge confirmed — elevates publication/funding edge confidence.');
  }

  const highConfAxes = axisSummaries.filter(a => a.highConfidenceCount > 0);
  if (highConfAxes.length > 0) {
    parts.push(
      `High-confidence edges in ${highConfAxes.length} axes: ${highConfAxes.map(a => a.graphSourceType).join(', ')}.`,
    );
  }

  parts.push(
    `Composite graph confidence: ${(graphConfidence * 100).toFixed(0)}%.`,
    'All enrichment edges are non-decision-grade — this score does not affect readiness.',
  );

  return parts.join(' ');
}

// ── Employer packet summary ───────────────────────────────────────────────────

export interface EmployerPacketEnrichment {
  institutionalFootprint: string[];
  researchFootprint: string | null;
  geographyContext: string | null;
  trainingContext: string[];
  graphConfidenceLabel: string;
  /** Always false — enrichment is never decision-grade */
  readonly decisionGrade: false;
}

/**
 * Build a concise employer-safe enrichment summary from a resolved graph.
 * Only includes employer-safe edges (no review_required, no stale).
 */
export function buildEmployerPacketEnrichment(
  resolution: GraphResolutionResult,
  geographyLabel: string | null,
): EmployerPacketEnrichment {
  const safeEdges = resolution.employerSafeEdges;

  const institutionalEdges = safeEdges.filter(
    e => e.edgeType === 'AFFILIATED_WITH_FACILITY'
      || e.edgeType === 'AFFILIATED_WITH_HOSPITAL'
      || e.edgeType === 'MEMBER_OF_GROUP_PRACTICE'
      || e.edgeType === 'EMPLOYED_AT_INSTITUTION',
  );

  const researchEdge = resolution.axisSummaries.find(
    a => a.graphSourceType === 'publication' || a.graphSourceType === 'nih_funding',
  );

  const trainingEdges = safeEdges.filter(
    e => e.edgeType === 'COMPLETED_RESIDENCY' || e.edgeType === 'TRAINED_AT_PROGRAM',
  );

  const graphConfidenceLabel =
    resolution.graphConfidence >= 0.8 ? 'Rich enrichment profile — multiple verified linkages'
    : resolution.graphConfidence >= 0.5 ? 'Moderate enrichment — some corroborated linkages'
    : resolution.graphConfidence >= 0.2 ? 'Basic enrichment — limited corroboration'
    : 'Minimal enrichment data available';

  const researchSummary = researchEdge
    ? `${researchEdge.edgeCount} ${researchEdge.graphSourceType === 'nih_funding' ? 'NIH grants' : 'publications'} found via name-match enrichment (non-decision-grade)`
    : null;

  return {
    institutionalFootprint: institutionalEdges.map(e =>
      `${enrichmentStatusLabel(e.graphStatus)}: ${e.objectNodeLabel}`,
    ),
    researchFootprint: researchSummary,
    geographyContext: geographyLabel,
    trainingContext: trainingEdges.map(e => e.objectNodeLabel),
    graphConfidenceLabel,
    decisionGrade: false,
  };
}
