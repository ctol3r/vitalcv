/**
 * Canonical Professional Knowledge Graph (Wave 1100)
 * ──────────────────────────────────────────────────────────────────────────
 * ONE typed graph through which every professional fact resolves. It does not
 * hold its own state — it composes the already-audited projections (the evidence
 * graph and the organization graph) into a single canonical entity/edge model
 * with traversal, search, and an adjacency index for large-graph performance.
 *
 * Honesty: every entity and edge carries `decisionGrade`, sourced straight from
 * the evidence (`decisionGrade ⇔ status==='checked'`). Nothing is fabricated;
 * organization and subject nodes are structural (decisionGrade false unless an
 * evidence edge backs them). No new trust math.
 *
 * Layering: imports only from the graph + organization projectors. Pure.
 */
import type { EvidenceCollection, EvidenceClass, EvidenceStatus } from '../types';
import {
  projectEvidenceToGraph,
  type GraphProjection,
  type GraphRelationshipType,
} from '../projectors/graph';
import { projectOrganizations } from '../organizations/organizations';

export const KNOWLEDGE_GRAPH_SCHEMA = 'vitalcv.knowledge-graph.v1' as const;

export type KnowledgeEntityKind = 'subject' | 'evidence' | 'source' | 'organization';

/** A canonical node. Predicate/edge vocabulary is reused from the evidence graph. */
export interface KnowledgeEntity {
  id: string;
  kind: KnowledgeEntityKind;
  label: string;
  decisionGrade: boolean;
  /** Evidence nodes only; else null. */
  status: EvidenceStatus | null;
  evidenceClass: EvidenceClass | null;
  /** 0..1 monotonic trust (evidence/org nodes); null otherwise. */
  trustScore: number | null;
  /** Backing source id, when applicable. */
  source: string | null;
}

export type KnowledgePredicate = GraphRelationshipType;

export interface KnowledgeEdge {
  id: string;
  from: string;
  to: string;
  predicate: KnowledgePredicate;
  decisionGrade: boolean;
  /** Backing evidence object ids (may be empty for structural edges). */
  evidenceIds: string[];
}

export interface KnowledgeGraph {
  schema: typeof KNOWLEDGE_GRAPH_SCHEMA;
  subjectKey: string;
  /** Canonical id of the subject entity — the natural traversal root. */
  subjectId: string;
  entities: KnowledgeEntity[];
  edges: KnowledgeEdge[];
  stats: {
    entityCount: number;
    edgeCount: number;
    decisionGradeEntityCount: number;
    byKind: Record<KnowledgeEntityKind, number>;
  };
  /** Deterministic cache key over the decision-relevant content (route ETag). */
  contentHash: string;
}

/** FNV-1a 32-bit. Pure JS cache hash, not security. */
function hashEntities(entities: KnowledgeEntity[], edges: KnowledgeEdge[]): string {
  let h = 0x811c9dc5;
  const material = [
    ...entities.map((e) => `${e.id}:${e.kind}:${e.status ?? ''}:${e.decisionGrade ? 1 : 0}`),
    ...edges.map((e) => `${e.from}>${e.predicate}>${e.to}:${e.decisionGrade ? 1 : 0}`),
  ]
    .sort()
    .join('|');
  for (let i = 0; i < material.length; i++) {
    h ^= material.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * C1/C2: build the canonical graph by unifying the evidence graph and the
 * organization graph. De-duplicates entities by id (an org that also appears as
 * a source node is one entity), preferring the more specific organization kind.
 */
export function buildKnowledgeGraph(collection: EvidenceCollection): KnowledgeGraph {
  const evidenceGraph: GraphProjection = projectEvidenceToGraph(collection);
  const orgGraph = projectOrganizations(collection, evidenceGraph);

  const entityById = new Map<string, KnowledgeEntity>();

  // Evidence-graph nodes (subject, evidence, source).
  for (const n of evidenceGraph.nodes) {
    entityById.set(n.id, {
      id: n.id,
      kind: n.type,
      label: n.label,
      decisionGrade: n.decisionGrade,
      status: n.status,
      evidenceClass: n.evidenceClass,
      trustScore: n.trustScore,
      source: n.evidenceSource,
    });
  }

  // Organization nodes — overlay as canonical 'organization' entities. An org id
  // may coincide with a source node id; the organization view is more specific.
  for (const o of orgGraph.organizations) {
    entityById.set(o.id, {
      id: o.id,
      kind: 'organization',
      label: o.label,
      decisionGrade: o.decisionGradeCount > 0,
      status: null,
      evidenceClass: null,
      trustScore: o.trustContribution,
      source: o.sourceId,
    });
  }

  const edgeById = new Map<string, KnowledgeEdge>();
  for (const r of evidenceGraph.relationships) {
    edgeById.set(r.id, {
      id: r.id,
      from: r.from,
      to: r.to,
      predicate: r.type,
      decisionGrade: entityById.get(r.to)?.decisionGrade ?? false,
      evidenceIds: r.evidenceId ? [r.evidenceId] : [],
    });
  }
  for (const r of orgGraph.relationships) {
    const id = `org:${r.from}->${r.to}:${r.type}`;
    edgeById.set(id, {
      id,
      from: r.from,
      to: r.to,
      predicate: r.type,
      decisionGrade: r.decisionGrade,
      evidenceIds: r.evidenceIds,
    });
  }

  const entities = [...entityById.values()];
  const edges = [...edgeById.values()];

  const byKind: Record<KnowledgeEntityKind, number> = { subject: 0, evidence: 0, source: 0, organization: 0 };
  let decisionGradeEntityCount = 0;
  for (const e of entities) {
    byKind[e.kind] += 1;
    if (e.decisionGrade) decisionGradeEntityCount += 1;
  }

  const subjectId = entities.find((e) => e.kind === 'subject')?.id ?? `subject:${collection.subjectKey}`;

  return {
    schema: KNOWLEDGE_GRAPH_SCHEMA,
    subjectKey: collection.subjectKey,
    subjectId,
    entities,
    edges,
    stats: { entityCount: entities.length, edgeCount: edges.length, decisionGradeEntityCount, byKind },
    contentHash: hashEntities(entities, edges),
  };
}

// ── C6: adjacency index for O(1) neighbor lookup on large graphs ─────────────

export interface KnowledgeGraphIndex {
  entityById: Map<string, KnowledgeEntity>;
  /** Undirected adjacency: entity id → edges touching it. */
  adjacency: Map<string, KnowledgeEdge[]>;
}

export function indexKnowledgeGraph(graph: KnowledgeGraph): KnowledgeGraphIndex {
  const entityById = new Map(graph.entities.map((e) => [e.id, e]));
  const adjacency = new Map<string, KnowledgeEdge[]>();
  const push = (id: string, edge: KnowledgeEdge) => {
    const list = adjacency.get(id);
    if (list) list.push(edge);
    else adjacency.set(id, [edge]);
  };
  for (const edge of graph.edges) {
    push(edge.from, edge);
    push(edge.to, edge);
  }
  return { entityById, adjacency };
}

/** C3: direct neighbors of an entity (undirected), deterministic order. */
export function neighbors(index: KnowledgeGraphIndex, entityId: string): KnowledgeEntity[] {
  const edges = index.adjacency.get(entityId) ?? [];
  const seen = new Set<string>();
  const out: KnowledgeEntity[] = [];
  for (const edge of edges) {
    const otherId = edge.from === entityId ? edge.to : edge.from;
    if (seen.has(otherId)) continue;
    seen.add(otherId);
    const entity = index.entityById.get(otherId);
    if (entity) out.push(entity);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * C3/C6: bounded BFS subgraph from a root. `maxDepth` caps traversal so a large
 * graph never explodes; `maxEntities` is a hard safety bound. Both are honest —
 * the result reports whether it was truncated.
 */
export interface SubgraphResult {
  rootId: string;
  depth: number;
  entities: KnowledgeEntity[];
  edges: KnowledgeEdge[];
  truncated: boolean;
}

export function traverseSubgraph(
  index: KnowledgeGraphIndex,
  rootId: string,
  maxDepth: number,
  maxEntities = 500,
): SubgraphResult {
  const root = index.entityById.get(rootId);
  if (!root) return { rootId, depth: maxDepth, entities: [], edges: [], truncated: false };

  const visited = new Set<string>([rootId]);
  const collectedEdges = new Map<string, KnowledgeEdge>();
  let frontier = [rootId];
  let truncated = false;

  for (let d = 0; d < Math.max(0, maxDepth) && frontier.length > 0; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of index.adjacency.get(id) ?? []) {
        collectedEdges.set(edge.id, edge);
        const otherId = edge.from === id ? edge.to : edge.from;
        if (visited.has(otherId)) continue;
        if (visited.size >= maxEntities) {
          truncated = true;
          continue;
        }
        visited.add(otherId);
        next.push(otherId);
      }
    }
    frontier = next;
  }
  if (frontier.length > 0 && maxDepth > 0) truncated = truncated || frontier.length > 0;

  const entities = [...visited].map((id) => index.entityById.get(id)!).filter(Boolean);
  // Only keep edges whose both endpoints are in the visited set.
  const edges = [...collectedEdges.values()].filter((e) => visited.has(e.from) && visited.has(e.to));
  return { rootId, depth: maxDepth, entities, edges, truncated };
}

// ── C5: graph search ─────────────────────────────────────────────────────────

export interface KnowledgeSearchQuery {
  kind?: KnowledgeEntityKind;
  /** Case-insensitive substring match on the entity label. */
  q?: string;
  decisionGradeOnly?: boolean;
}

export function searchEntities(graph: KnowledgeGraph, query: KnowledgeSearchQuery): KnowledgeEntity[] {
  const needle = query.q?.trim().toLowerCase();
  return graph.entities
    .filter((e) => {
      if (query.kind && e.kind !== query.kind) return false;
      if (query.decisionGradeOnly && !e.decisionGrade) return false;
      if (needle && !e.label.toLowerCase().includes(needle)) return false;
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
