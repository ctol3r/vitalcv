import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import type {
  IntelligenceFinding,
  IntelligenceProvider,
  IntelligenceSeverity,
  IntelligenceStoryline,
} from './contracts';
import { candidateProviderNpisFromGraphNode } from './contracts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type KnowledgeEntityType = 'provider' | 'finding' | 'storyline' | 'graph_node';

export interface KnowledgeEntity {
  id: string;
  type: KnowledgeEntityType;
  sourceId: string;
  label: string;
  summary: string | null;
  severity: IntelligenceSeverity | null;
  trustScore: number | null;
  tags: string[];
  updatedAt: string | null;
  links: Set<string>;
}

export interface ExpandedContext {
  root: KnowledgeEntity;
  providers: KnowledgeEntity[];
  findings: KnowledgeEntity[];
  storylines: KnowledgeEntity[];
  graphNodes: KnowledgeEntity[];
}

export interface TooltipEntityContext {
  provider: { name: string; npi: string; trustScore: number } | null;
  findings: { id: string; title: string; severity: string }[];
  storylines: { id: string; title: string }[];
  backlinkCount: number;
}

export interface EntityRegistrySources {
  providers: IntelligenceProvider[];
  findings: IntelligenceFinding[];
  storylines: IntelligenceStoryline[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
}

// ── Canonical ID helpers ──────────────────────────────────────────────────────

function providerId(npi: string): string { return `provider:${npi}`; }
function findingId(id: string): string { return `finding:${id}`; }
function storylineId(id: string): string { return `storyline:${id}`; }
function graphNodeId(id: string): string { return `graph_node:${id}`; }

// ── EntityRegistry ────────────────────────────────────────────────────────────

export class EntityRegistry {
  private readonly entities: Map<string, KnowledgeEntity>;
  private readonly backlinks: Map<string, Set<string>>;
  private readonly graphNodeMap: Map<string, string>;   // graph node ID → canonical entity ID
  private readonly npiMap: Map<string, string>;          // NPI → canonical provider entity ID

  private constructor(
    entities: Map<string, KnowledgeEntity>,
    backlinks: Map<string, Set<string>>,
    graphNodeMap: Map<string, string>,
    npiMap: Map<string, string>,
  ) {
    this.entities = entities;
    this.backlinks = backlinks;
    this.graphNodeMap = graphNodeMap;
    this.npiMap = npiMap;
  }

  // ── Construction ──────────────────────────────────────────────────────────

  static build(sources: EntityRegistrySources): EntityRegistry {
    const entities = new Map<string, KnowledgeEntity>();
    const backlinks = new Map<string, Set<string>>();
    const graphNodeMap = new Map<string, string>();
    const npiMap = new Map<string, string>();

    function ensureBacklinkSet(id: string): Set<string> {
      let set = backlinks.get(id);
      if (!set) {
        set = new Set<string>();
        backlinks.set(id, set);
      }
      return set;
    }

    function link(a: KnowledgeEntity, bId: string): void {
      a.links.add(bId);
      ensureBacklinkSet(bId).add(a.id);
    }

    function linkBidi(a: KnowledgeEntity, b: KnowledgeEntity): void {
      a.links.add(b.id);
      b.links.add(a.id);
      ensureBacklinkSet(b.id).add(a.id);
      ensureBacklinkSet(a.id).add(b.id);
    }

    // 1. Create provider entities
    for (const p of sources.providers) {
      const id = providerId(p.npi);
      const entity: KnowledgeEntity = {
        id,
        type: 'provider',
        sourceId: p.npi,
        label: p.name,
        summary: p.summary,
        severity: null,
        trustScore: p.trustScore,
        tags: p.tags,
        updatedAt: p.lastVerifiedAt,
        links: new Set(),
      };
      entities.set(id, entity);
      npiMap.set(p.npi, id);
    }

    // 2. Create finding entities
    for (const f of sources.findings) {
      const id = findingId(f.id);
      const entity: KnowledgeEntity = {
        id,
        type: 'finding',
        sourceId: f.id,
        label: f.title,
        summary: f.summary,
        severity: f.severity,
        trustScore: null,
        tags: [],
        updatedAt: f.updatedAt,
        links: new Set(),
      };
      entities.set(id, entity);
    }

    // 3. Create storyline entities
    for (const s of sources.storylines) {
      const id = storylineId(s.id);
      const entity: KnowledgeEntity = {
        id,
        type: 'storyline',
        sourceId: s.id,
        label: s.title,
        summary: s.summary,
        severity: s.severity,
        trustScore: null,
        tags: [],
        updatedAt: s.lastActivityAt,
        links: new Set(),
      };
      entities.set(id, entity);
    }

    // 4. Create graph node entities
    for (const n of sources.graphNodes) {
      const id = graphNodeId(n.id);
      const entity: KnowledgeEntity = {
        id,
        type: 'graph_node',
        sourceId: n.id,
        label: n.label,
        summary: n.title || null,
        severity: null,
        trustScore: n.trustScore ?? null,
        tags: n.tags,
        updatedAt: n.updatedAt,
        links: new Set(),
      };
      entities.set(id, entity);
      graphNodeMap.set(n.id, id);
    }

    // ── Link rules ────────────────────────────────────────────────────────

    // Finding → Provider (via providerNpi)
    for (const f of sources.findings) {
      if (!f.providerNpi) continue;
      const fe = entities.get(findingId(f.id));
      const pe = entities.get(providerId(f.providerNpi));
      if (fe && pe) {
        linkBidi(fe, pe);
      } else if (fe) {
        // Provider not in registry — create forward link to canonical ID anyway
        link(fe, providerId(f.providerNpi));
      }
    }

    // Finding → Storyline (via storylineId)
    for (const f of sources.findings) {
      if (!f.storylineId) continue;
      const fe = entities.get(findingId(f.id));
      const se = entities.get(storylineId(f.storylineId));
      if (fe && se) {
        linkBidi(fe, se);
      } else if (fe) {
        link(fe, storylineId(f.storylineId));
      }
    }

    // Storyline → Finding (via findingIds[])
    for (const s of sources.storylines) {
      const se = entities.get(storylineId(s.id));
      if (!se) continue;
      for (const fId of s.findingIds) {
        const fe = entities.get(findingId(fId));
        if (fe) {
          linkBidi(se, fe);
        } else {
          link(se, findingId(fId));
        }
      }
    }

    // GraphNode → Finding (via findingIds[])
    for (const n of sources.graphNodes) {
      const ne = entities.get(graphNodeId(n.id));
      if (!ne || !n.findingIds) continue;
      for (const fId of n.findingIds) {
        const fe = entities.get(findingId(fId));
        if (fe) {
          linkBidi(ne, fe);
        } else {
          link(ne, findingId(fId));
        }
      }
    }

    // GraphNode → Storyline (via storylineIds[])
    for (const n of sources.graphNodes) {
      const ne = entities.get(graphNodeId(n.id));
      if (!ne || !n.storylineIds) continue;
      for (const sId of n.storylineIds) {
        const se = entities.get(storylineId(sId));
        if (se) {
          linkBidi(ne, se);
        } else {
          link(ne, storylineId(sId));
        }
      }
    }

    // GraphNode → Provider (NPI bridge)
    for (const n of sources.graphNodes) {
      const ne = entities.get(graphNodeId(n.id));
      if (!ne) continue;
      for (const npi of candidateProviderNpisFromGraphNode(n)) {
        const pe = entities.get(providerId(npi));
        if (pe) {
          linkBidi(ne, pe);
        } else {
          link(ne, providerId(npi));
        }
      }
    }

    // GraphEdge findingIds/storylineIds → link source/target nodes to those entities
    for (const edge of sources.graphEdges) {
      const srcEntity = entities.get(graphNodeId(edge.source));
      const tgtEntity = entities.get(graphNodeId(edge.target));

      for (const fId of edge.findingIds ?? []) {
        const fe = entities.get(findingId(fId));
        if (fe && srcEntity) linkBidi(srcEntity, fe);
        if (fe && tgtEntity) linkBidi(tgtEntity, fe);
      }

      for (const sId of edge.storylineIds ?? []) {
        const se = entities.get(storylineId(sId));
        if (se && srcEntity) linkBidi(srcEntity, se);
        if (se && tgtEntity) linkBidi(tgtEntity, se);
      }
    }

    return new EntityRegistry(entities, backlinks, graphNodeMap, npiMap);
  }

  // ── Core lookups ──────────────────────────────────────────────────────────

  get(id: string): KnowledgeEntity | undefined {
    return this.entities.get(id);
  }

  getBacklinks(id: string): KnowledgeEntity[] {
    const ids = this.backlinks.get(id);
    if (!ids) return [];
    const result: KnowledgeEntity[] = [];
    for (const backlinkId of ids) {
      const entity = this.entities.get(backlinkId);
      if (entity) result.push(entity);
    }
    return result;
  }

  getLinked(id: string): KnowledgeEntity[] {
    const entity = this.entities.get(id);
    if (!entity) return [];
    const result: KnowledgeEntity[] = [];
    for (const linkedId of entity.links) {
      const linked = this.entities.get(linkedId);
      if (linked) result.push(linked);
    }
    return result;
  }

  // ── Cross-reference resolution ────────────────────────────────────────────

  entityForGraphNode(nodeId: string): KnowledgeEntity | undefined {
    const canonicalId = this.graphNodeMap.get(nodeId);
    return canonicalId ? this.entities.get(canonicalId) : undefined;
  }

  entityForNpi(npi: string): KnowledgeEntity | undefined {
    const canonicalId = this.npiMap.get(npi);
    return canonicalId ? this.entities.get(canonicalId) : undefined;
  }

  entityForFinding(id: string): KnowledgeEntity | undefined {
    return this.entities.get(findingId(id));
  }

  entityForStoryline(id: string): KnowledgeEntity | undefined {
    return this.entities.get(storylineId(id));
  }

  // ── Context expansion ─────────────────────────────────────────────────────

  expandContext(entityId: string, depth = 1): ExpandedContext | null {
    const root = this.entities.get(entityId);
    if (!root) return null;

    const visited = new Set<string>([entityId]);
    let frontier = new Set<string>();

    // Collect direct links + backlinks for the root
    for (const id of root.links) frontier.add(id);
    for (const id of this.backlinks.get(entityId) ?? []) frontier.add(id);

    for (let d = 1; d < depth; d++) {
      const nextFrontier = new Set<string>();
      for (const id of frontier) {
        if (visited.has(id)) continue;
        visited.add(id);
        const entity = this.entities.get(id);
        if (!entity) continue;
        for (const linkedId of entity.links) {
          if (!visited.has(linkedId)) nextFrontier.add(linkedId);
        }
        for (const backlinkId of this.backlinks.get(id) ?? []) {
          if (!visited.has(backlinkId)) nextFrontier.add(backlinkId);
        }
      }
      for (const id of nextFrontier) frontier.add(id);
    }

    // Mark remaining frontier as visited
    for (const id of frontier) visited.add(id);

    const providers: KnowledgeEntity[] = [];
    const findings: KnowledgeEntity[] = [];
    const storylines: KnowledgeEntity[] = [];
    const graphNodes: KnowledgeEntity[] = [];

    for (const id of visited) {
      if (id === entityId) continue;
      const entity = this.entities.get(id);
      if (!entity) continue;
      switch (entity.type) {
        case 'provider': providers.push(entity); break;
        case 'finding': findings.push(entity); break;
        case 'storyline': storylines.push(entity); break;
        case 'graph_node': graphNodes.push(entity); break;
      }
    }

    return { root, providers, findings, storylines, graphNodes };
  }

  // ── Tooltip context ───────────────────────────────────────────────────────

  getTooltipContext(nodeId: string): TooltipEntityContext | null {
    const canonicalId = this.graphNodeMap.get(nodeId);
    if (!canonicalId) return null;

    const context = this.expandContext(canonicalId);
    if (!context) return null;

    const providerEntity = context.providers[0] ?? null;
    const provider = providerEntity
      ? { name: providerEntity.label, npi: providerEntity.sourceId, trustScore: providerEntity.trustScore ?? 0 }
      : null;

    const findingEntities = context.findings.slice(0, 2).map((f) => ({
      id: f.sourceId,
      title: f.label,
      severity: f.severity ?? 'info',
    }));

    const storylineEntities = context.storylines.slice(0, 1).map((s) => ({
      id: s.sourceId,
      title: s.label,
    }));

    const backlinkCount = this.backlinks.get(canonicalId)?.size ?? 0;

    return {
      provider,
      findings: findingEntities,
      storylines: storylineEntities,
      backlinkCount,
    };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  get size(): number {
    return this.entities.size;
  }

  get linkCount(): number {
    let count = 0;
    for (const entity of this.entities.values()) {
      count += entity.links.size;
    }
    return count;
  }
}
