/**
 * Professional Reasoning Engine (Wave 1200)
 * ──────────────────────────────────────────────────────────────────────────
 * The semantic layer over the canonical Knowledge Graph. It answers queries by
 * planning and executing bounded traversals, and EVERY answer is explainable:
 * it returns the evidence, the relationships used, the traversal path, and an
 * honest confidence. It reuses the graph's `decisionGrade`/`trustScore` — it
 * adds NO new trust or business logic.
 *
 * Two honesty rules are load-bearing:
 *  1. Confidence is derived ONLY from decision-grade (checked) evidence. Gated,
 *     self-reported, and hypothetical evidence never raise it.
 *  2. Scenario simulation (C5) NEVER mutates source data and is always tagged
 *     `hypothetical:true`. A simulated result can never be presented as real
 *     verification — hypothetical entities are excluded from decision-grade
 *     confidence even if a scenario marks them 'checked'.
 */
import {
  indexKnowledgeGraph,
  traverseSubgraph,
  searchEntities,
  type KnowledgeGraph,
  type KnowledgeGraphIndex,
  type KnowledgeEntity,
  type KnowledgeEntityKind,
  type KnowledgeEdge,
} from '../knowledge/graph';
import type { EvidenceStatus } from '../types';

export const REASONING_SCHEMA = 'vitalcv.reasoning.v1' as const;

const MAX_REASONING_DEPTH = 6;

export interface ReasoningQuery {
  /** Traversal root entity id (defaults to the subject). */
  root?: string;
  /** Restrict the answer to a kind. */
  kind?: KnowledgeEntityKind;
  /** Case-insensitive label match for the answer. */
  q?: string;
  /** Only decision-grade entities in the answer. */
  decisionGradeOnly?: boolean;
  /** Traversal depth bound (clamped to [0,6]). */
  maxDepth?: number;
}

/** C2: the chosen traversal, with a rationale (explainability). */
export interface TraversalPlan {
  root: string;
  maxDepth: number;
  rationale: string;
}

/** Honest confidence — bounded by decision-grade coverage, never inflated. */
export interface ReasoningConfidence {
  /** 0..1: decisionGradeEvidence / totalEvidence in scope (0 when no evidence). */
  score: number;
  decisionGradeEvidence: number;
  totalEvidence: number;
  basis: string;
}

/** C4: every response carries a full explanation. */
export interface ReasoningExplanation {
  /** Evidence entities within the reasoned subgraph. */
  evidence: KnowledgeEntity[];
  /** Relationships traversed. */
  relationships: KnowledgeEdge[];
  /** Entity ids in BFS visitation order. */
  traversalPath: string[];
  confidence: ReasoningConfidence;
}

export interface ReasoningResult {
  schema: typeof REASONING_SCHEMA;
  subjectKey: string;
  query: ReasoningQuery;
  plan: TraversalPlan;
  /** Entities answering the query. */
  answer: KnowledgeEntity[];
  explanation: ReasoningExplanation;
  /** True only for scenario simulations. Real reasoning is always false. */
  hypothetical: boolean;
  /** Whether the traversal hit a bound (honest partial-answer signal). */
  truncated: boolean;
}

/** C2: pick the root and depth for a query, with a stated rationale. */
export function planTraversal(graph: KnowledgeGraph, query: ReasoningQuery): TraversalPlan {
  const root = query.root && query.root.trim() ? query.root.trim() : graph.subjectId;
  const requested = query.maxDepth ?? 2;
  const maxDepth = Number.isFinite(requested) ? Math.min(MAX_REASONING_DEPTH, Math.max(0, Math.floor(requested))) : 2;
  const rationale =
    `Traverse from ${root === graph.subjectId ? 'the subject' : `"${root}"`} to depth ${maxDepth}` +
    (query.kind ? `, answering ${query.kind} entities` : '') +
    (query.decisionGradeOnly ? ', decision-grade only' : '') +
    '.';
  return { root, maxDepth, rationale };
}

function computeConfidence(evidence: KnowledgeEntity[], hypothetical: boolean): ReasoningConfidence {
  // Hypothetical entities NEVER count toward decision-grade confidence.
  const real = evidence.filter((e) => !isHypothetical(e));
  const total = real.length;
  const decisionGrade = real.filter((e) => e.decisionGrade).length;
  const score = total === 0 ? 0 : round4(decisionGrade / total);
  const basis =
    total === 0
      ? 'No real evidence in scope — confidence 0.'
      : `${decisionGrade}/${total} in-scope evidence items are decision-grade (checked).` +
        (hypothetical ? ' Hypothetical evidence excluded from confidence.' : '');
  return { score, decisionGradeEvidence: decisionGrade, totalEvidence: total, basis };
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/**
 * C1/C3/C4: reason over a graph. Plans a traversal (C2), projects only the
 * needed subgraph (C3 optimizer — never the whole graph unless asked), filters
 * the answer, and returns a full explanation (C4). `index` may be supplied to
 * reuse a cached adjacency index across queries (C6).
 */
export function reason(
  graph: KnowledgeGraph,
  query: ReasoningQuery = {},
  index?: KnowledgeGraphIndex,
  hypothetical = false,
): ReasoningResult {
  const idx = index ?? indexKnowledgeGraph(graph);
  const plan = planTraversal(graph, query);
  const sub = traverseSubgraph(idx, plan.root, plan.maxDepth);

  // Answer = entities in the reasoned subgraph matching the query criteria.
  const needle = query.q?.trim().toLowerCase();
  const answer = sub.entities
    .filter((e) => {
      if (query.kind && e.kind !== query.kind) return false;
      if (query.decisionGradeOnly && !e.decisionGrade) return false;
      if (needle && !e.label.toLowerCase().includes(needle)) return false;
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const evidence = sub.entities.filter((e) => e.kind === 'evidence');
  const explanation: ReasoningExplanation = {
    evidence,
    relationships: sub.edges,
    traversalPath: sub.entities.map((e) => e.id),
    confidence: computeConfidence(evidence, hypothetical),
  };

  return {
    schema: REASONING_SCHEMA,
    subjectKey: graph.subjectKey,
    query,
    plan,
    answer,
    explanation,
    hypothetical,
    truncated: sub.truncated,
  };
}

/** A reusable reasoner that caches the adjacency index across queries (C6). */
export interface Reasoner {
  graph: KnowledgeGraph;
  ask(query?: ReasoningQuery): ReasoningResult;
}

export function createReasoner(graph: KnowledgeGraph): Reasoner {
  const index = indexKnowledgeGraph(graph); // built once, reused (cached traversals)
  return {
    graph,
    ask: (query: ReasoningQuery = {}) => reason(graph, query, index, false),
  };
}

// ── C5: scenario simulation ──────────────────────────────────────────────────

const HYPOTHETICAL_PREFIX = 'hypothetical:';

function isHypothetical(entity: KnowledgeEntity): boolean {
  return entity.id.startsWith(HYPOTHETICAL_PREFIX);
}

/** A hypothetical mutation. Source data is never touched. */
export interface ScenarioMutation {
  type: 'add_entity' | 'add_edge' | 'set_status';
  /** add_entity: a new evidence entity (id auto-prefixed `hypothetical:`). */
  entity?: { id: string; kind: KnowledgeEntityKind; label: string; status?: EvidenceStatus };
  /** add_edge: connect two existing/added entities. */
  edge?: { from: string; to: string; predicate: KnowledgeEdge['predicate'] };
  /** set_status: hypothetically change an existing entity's status. */
  target?: string;
  status?: EvidenceStatus;
}

export interface ScenarioResult {
  /** Always true — a simulation can never be presented as real verification. */
  hypothetical: true;
  mutations: ScenarioMutation[];
  /** Reasoning over the simulated graph (its `hypothetical` is also true). */
  result: ReasoningResult;
  note: string;
}

/**
 * Simulate hypothetical graph changes WITHOUT mutating the source graph. Returns
 * a brand-new derived graph; the input is deep-cloned first. Added entities are
 * id-prefixed `hypothetical:` and are excluded from decision-grade confidence,
 * so a scenario can never inflate a real verification claim.
 */
export function simulateScenario(
  graph: KnowledgeGraph,
  mutations: ScenarioMutation[],
  query: ReasoningQuery = {},
): ScenarioResult {
  // Deep clone — the source graph is never mutated.
  const draft: KnowledgeGraph = structuredClone(graph);

  for (const m of mutations) {
    if (m.type === 'add_entity' && m.entity) {
      const id = m.entity.id.startsWith(HYPOTHETICAL_PREFIX) ? m.entity.id : `${HYPOTHETICAL_PREFIX}${m.entity.id}`;
      draft.entities.push({
        id,
        kind: m.entity.kind,
        label: m.entity.label,
        // Hypothetical evidence is NEVER decision-grade, regardless of status.
        decisionGrade: false,
        status: m.entity.status ?? null,
        evidenceClass: null,
        trustScore: null,
        source: null,
      });
    } else if (m.type === 'add_edge' && m.edge) {
      draft.edges.push({
        id: `${HYPOTHETICAL_PREFIX}${m.edge.from}->${m.edge.to}:${m.edge.predicate}`,
        from: m.edge.from,
        to: m.edge.to,
        predicate: m.edge.predicate,
        decisionGrade: false,
        evidenceIds: [],
      });
    } else if (m.type === 'set_status' && m.target) {
      const entity = draft.entities.find((e) => e.id === m.target);
      if (entity) {
        entity.status = m.status ?? entity.status;
        // A SIMULATED status change is hypothetical — it can never CONFER
        // decision-grade, on a hypothetical OR a real entity. Otherwise a scenario
        // could upgrade a real gated/self-reported credential to "checked" and
        // inflate confidence, presenting a hypothetical as real verification.
        // It may only REMOVE decision-grade (a hypothetical downgrade).
        entity.decisionGrade = false;
      }
    }
  }

  // Recompute stats over the simulated graph (kept honest for the explanation).
  const byKind: Record<KnowledgeEntityKind, number> = { subject: 0, evidence: 0, source: 0, organization: 0 };
  let decisionGradeEntityCount = 0;
  for (const e of draft.entities) {
    byKind[e.kind] += 1;
    if (e.decisionGrade) decisionGradeEntityCount += 1;
  }
  draft.stats = {
    entityCount: draft.entities.length,
    edgeCount: draft.edges.length,
    decisionGradeEntityCount,
    byKind,
  };

  const result = reason(draft, query, undefined, /* hypothetical */ true);

  // CONFIDENCE HONESTY: a simulation must never raise confidence above reality.
  // Hypothetical structure of ANY kind — added entities, added edges that pull
  // real decision-grade evidence into scope, or status upgrades — must not
  // inflate it. So the reported confidence is computed from the REAL graph for
  // the same query; the hypothetical only changes the shown structure, never the
  // verification standing. This closes the add_edge reachability vector.
  const realConfidence = reason(graph, query, undefined, false).explanation.confidence;
  result.explanation.confidence = {
    ...realConfidence,
    basis:
      realConfidence.basis +
      ' Confidence reflects the real graph; hypothetical structure cannot raise it.',
  };

  return {
    hypothetical: true,
    mutations,
    result,
    note: 'Hypothetical scenario over a cloned graph. Source data unchanged; simulated evidence is not decision-grade, and confidence reflects the real graph — a scenario is never real verification.',
  };
}
