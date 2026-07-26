/**
 * Trust propagation engine (Wave 222).
 *
 * Deterministic, pure, NO ML / NO opaque scoring. Input is a GraphProjection
 * (W221); output is a TrustProjection that answers "why trusted / where does it
 * originate / what reinforces / what weakens / how it evolved".
 *
 * Doctrine (monotonic-down, W220-C3): trust aggregates UP from evidence into
 * dimensions and an overall score, but is never inflated by neighbors. Every
 * dimension/overall score is bounded by its contributing evidence — a gated or
 * non-decision-grade object contributes 0 and can only lower an aggregate.
 */

import type { EvidenceClass } from '../types';
import type { GraphNode, GraphProjection } from '../projectors/graph';

// ── C3: Trust dimensions ─────────────────────────────────────────────────────

export const TRUST_DIMENSIONS = [
  'identity',
  'authority',
  'professional',
  'research',
  'leadership',
  'institutional',
  'mobility',
] as const;

export type TrustDimension = (typeof TRUST_DIMENSIONS)[number];

/**
 * Which dimensions an evidence class contributes to. A class may feed more than
 * one dimension (e.g. a residency reinforces both professional background and
 * institutional trust) — dimensions are computed INDEPENDENTLY of each other, so
 * shared inputs never cause one dimension's score to feed another's.
 */
function dimensionsForClass(evidenceClass: EvidenceClass): TrustDimension[] {
  switch (evidenceClass) {
    case 'identity':
      return ['identity'];
    case 'licensure':
      return ['authority', 'mobility'];
    case 'registration':
      return ['authority', 'mobility'];
    case 'board_cert':
      return ['authority'];
    case 'exclusion':
    case 'enrollment':
      return ['authority'];
    case 'employment':
      return ['professional', 'institutional'];
    case 'recognition':
    case 'acceptance':
    case 'start':
      return ['professional', 'institutional'];
    case 'training':
      return ['professional', 'institutional'];
    case 'privilege':
      return ['leadership', 'institutional'];
    case 'peer_review':
      return ['leadership'];
    case 'research':
    case 'publication':
      return ['research'];
    default:
      return [];
  }
}

export interface DimensionTrust {
  dimension: TrustDimension;
  /** Mean of contributing evidence trustScores, or null when no evidence exists. */
  score: number | null;
  contributingCount: number;
  decisionGradeCount: number;
  /** evidenceIds that reinforce (trustScore > 0). */
  supporting: string[];
  /** evidenceIds that weaken (trustScore === 0: gated/unavailable/notDecisionGrade). */
  weakening: string[];
  /** distinct sourceIds where positive trust originates. */
  origins: string[];
}

// ── C4: Trust history ────────────────────────────────────────────────────────

export type TrustHistoryEventType = 'reinforcement' | 'decay';

export interface TrustHistoryEntry {
  /** ISO timestamp (checkedAt for reinforcement, expiresAt/checkedAt for decay). */
  occurredAt: string | null;
  type: TrustHistoryEventType;
  dimension: TrustDimension | null;
  evidenceId: string | null;
  detail: string;
  /** + reinforcement, - decay. Bounded by the evidence's own trust. */
  scoreDelta: number;
}

export interface TrustHistory {
  entries: TrustHistoryEntry[];
  reinforcementCount: number;
  decayCount: number;
  netDelta: number;
  /** Growth signal derived from net reinforcement vs decay. */
  trend: 'growing' | 'decaying' | 'stable';
}

export interface TrustProjection {
  subjectKey: string;
  overall: { score: number | null; decisionGradeEvidence: number; totalEvidence: number };
  dimensions: DimensionTrust[];
  history: TrustHistory;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round4(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function evidenceNodes(graph: GraphProjection): GraphNode[] {
  return graph.nodes.filter((n) => n.type === 'evidence' && n.evidenceClass !== null && n.trustScore !== null);
}

function buildDimension(dimension: TrustDimension, nodes: GraphNode[]): DimensionTrust {
  const contributing = nodes.filter((n) => n.evidenceClass && dimensionsForClass(n.evidenceClass).includes(dimension));
  const supporting: string[] = [];
  const weakening: string[] = [];
  const origins = new Set<string>();

  for (const node of contributing) {
    const score = node.trustScore ?? 0;
    if (score > 0) {
      supporting.push(node.id);
      if (node.evidenceSource) origins.add(node.evidenceSource);
    } else {
      weakening.push(node.id);
    }
  }

  return {
    dimension,
    score: mean(contributing.map((n) => n.trustScore ?? 0)),
    contributingCount: contributing.length,
    decisionGradeCount: contributing.filter((n) => n.decisionGrade).length,
    supporting,
    weakening,
    origins: [...origins],
  };
}

function buildHistory(nodes: GraphNode[]): TrustHistory {
  const entries: TrustHistoryEntry[] = [];

  for (const node of nodes) {
    const dimension = node.evidenceClass ? dimensionsForClass(node.evidenceClass)[0] ?? null : null;
    const score = node.trustScore ?? 0;

    if (node.status === 'checked') {
      entries.push({
        occurredAt: node.checkedAt,
        type: 'reinforcement',
        dimension,
        evidenceId: node.id,
        detail: `${node.label} checked — reinforces ${dimension ?? 'trust'}`,
        scoreDelta: round4(score),
      });
    }

    const decayed = node.status === 'stale' || node.lifecycle === 'expired' || node.lifecycle === 'revoked';
    if (decayed) {
      entries.push({
        occurredAt: node.expiresAt ?? node.checkedAt,
        type: 'decay',
        dimension,
        evidenceId: node.id,
        detail: `${node.label} ${node.lifecycle === 'revoked' ? 'revoked' : 'stale/expired'} — weakens ${dimension ?? 'trust'}`,
        scoreDelta: round4(-(1 - score)),
      });
    }
  }

  // Deterministic order: by timestamp ascending, nulls last, tiebreak evidenceId.
  entries.sort((a, b) => {
    if (a.occurredAt === b.occurredAt) return (a.evidenceId ?? '').localeCompare(b.evidenceId ?? '');
    if (a.occurredAt === null) return 1;
    if (b.occurredAt === null) return -1;
    return a.occurredAt.localeCompare(b.occurredAt);
  });

  const reinforcementCount = entries.filter((e) => e.type === 'reinforcement').length;
  const decayCount = entries.filter((e) => e.type === 'decay').length;
  const netDelta = round4(entries.reduce((sum, e) => sum + e.scoreDelta, 0));
  const trend: TrustHistory['trend'] = netDelta > 0 ? 'growing' : netDelta < 0 ? 'decaying' : 'stable';

  return { entries, reinforcementCount, decayCount, netDelta, trend };
}

// ── C2: propagateTrust ───────────────────────────────────────────────────────

export function propagateTrust(graph: GraphProjection): TrustProjection {
  const nodes = evidenceNodes(graph);
  const scores = nodes.map((n) => n.trustScore ?? 0);

  return {
    subjectKey: graph.subjectKey,
    overall: {
      score: mean(scores),
      decisionGradeEvidence: nodes.filter((n) => n.decisionGrade).length,
      totalEvidence: nodes.length,
    },
    dimensions: TRUST_DIMENSIONS.map((dimension) => buildDimension(dimension, nodes)),
    history: buildHistory(nodes),
  };
}
