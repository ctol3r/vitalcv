/**
 * graphIndexer.ts — Graph Indexing & Rebuild Pipeline
 *
 * Builds and maintains the graph from source data:
 *   - KnowledgeNode + AuthorityEdge tables (existing Prisma models)
 *   - VerificationArtifacts (identity claims → nodes + edges)
 *   - CandidateCredentials
 *   - DecisionCapsules
 *   - PersonProfiles
 *
 * Operations:
 *   - fullRebuild: wipe and rebuild from all source tables
 *   - incrementalReindex: update graph for one NPI or entity
 *   - orphanDetection: find unlinked nodes
 *   - reciprocalValidation: verify all bidirectional links are consistent
 *   - snapshotGeneration: create cached graph snapshots for fast API responses
 */

import { createHash } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import {
  type GraphNode, type GraphEdge, type GraphSnapshot, type GraphStats,
  type NodeType, type EdgeType, type GraphLayer,
  COLOR_GROUPS, EDGE_COLORS, nodeLayer, edgeLayer,
  NODE_TYPES,
} from './schema';

// ── In-memory snapshot cache ──────────────────────────────────────────────────

let cachedSnapshot: GraphSnapshot | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

// ── Node ID generation ────────────────────────────────────────────────────────

function nodeId(type: NodeType, entityId: string): string {
  return createHash('sha256').update(`${type}|${entityId}`).digest('hex').slice(0, 24);
}

function edgeId(sourceId: string, targetId: string, relType: string): string {
  return createHash('sha256').update(`${sourceId}|${targetId}|${relType}`).digest('hex').slice(0, 24);
}

// ── Build graph from Prisma data ──────────────────────────────────────────────

export async function buildFullGraph(): Promise<GraphSnapshot> {
  const start = Date.now();
  log('info', 'graphIndexer: starting full rebuild');

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<string, GraphNode>();

  // ── 1. KnowledgeNode table → GraphNodes ────────────────────────────────
  const dbNodes = await prisma.knowledgeNode.findMany({
    select: { id: true, entityType: true, entityId: true, label: true, attributes: true, createdAt: true, updatedAt: true },
  });

  for (const n of dbNodes) {
    const type = mapEntityType(n.entityType);
    const attrs = (n.attributes ?? {}) as Record<string, unknown>;
    const gn: GraphNode = {
      id: n.id,
      type,
      label: n.label,
      title: n.label,
      color: COLOR_GROUPS[type] ?? '#94a3b8',
      group: type,
      degree: 0, inDegree: 0, outDegree: 0,
      layer: nodeLayer(type),
      metadata: attrs,
      tags: (attrs.tags ?? []) as string[],
      sourceRefs: (attrs.sourceRefs ?? []) as string[],
      trustTier: attrs.trustTier as GraphNode['trustTier'],
      trustBand: attrs.trustBand as GraphNode['trustBand'],
      confidence: typeof attrs.confidence === 'number' ? attrs.confidence : undefined,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    };
    nodes.push(gn);
    nodeMap.set(n.id, gn);
  }

  // ── 2. AuthorityEdge table → GraphEdges ────────────────────────────────
  const dbEdges = await prisma.authorityEdge.findMany({
    select: {
      id: true, sourceNodeId: true, targetNodeId: true,
      relationType: true, weight: true, metadata: true, createdAt: true,
    },
  });

  for (const e of dbEdges) {
    const meta = (e.metadata ?? {}) as Record<string, unknown>;
    const edgeType = mapEdgeType(e.relationType);
    const ge: GraphEdge = {
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      type: edgeType,
      directed: meta.directed !== false,
      reciprocal: meta.reciprocal === true,
      confidence: typeof meta.confidence === 'number' ? meta.confidence : e.weight,
      createdBy: (meta.createdBy as GraphEdge['createdBy']) ?? 'system',
      explanation: (meta.explanation as string) ?? `${e.relationType} relationship`,
      status: (meta.status as GraphEdge['status']) ?? 'active',
      weight: e.weight,
      metadata: meta,
      layer: edgeLayer(edgeType),
      color: EDGE_COLORS[edgeType] ?? '#475569',
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.createdAt.toISOString(),
    };
    edges.push(ge);

    // Update degree counts
    const src = nodeMap.get(e.sourceNodeId);
    const tgt = nodeMap.get(e.targetNodeId);
    if (src) { src.degree++; src.outDegree++; }
    if (tgt) { tgt.degree++; tgt.inDegree++; }
  }

  // ── 3. Enrich from VerificationArtifacts (identity claims) ─────────────
  await enrichFromArtifacts(nodes, edges, nodeMap);

  // ── 4. Enrich from PersonProfiles ──────────────────────────────────────
  await enrichFromProfiles(nodes, edges, nodeMap);

  // ── 5. Compute node sizes from degree ──────────────────────────────────
  const maxDeg = Math.max(1, ...nodes.map(n => n.degree));
  for (const n of nodes) {
    n.size = 4 + (n.degree / maxDeg) * 16; // 4-20 range
  }

  // ── 6. Build stats ─────────────────────────────────────────────────────
  const stats = computeStats(nodes, edges);

  const snapshot: GraphSnapshot = {
    id: createHash('sha256').update(Date.now().toString()).digest('hex').slice(0, 16),
    generatedAt: new Date().toISOString(),
    layer: 'blended',
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
    stats,
    version: '1.0.0',
  };

  // Cache it
  cachedSnapshot = snapshot;
  cacheTimestamp = Date.now();

  log('info', 'graphIndexer: rebuild complete', {
    nodes: nodes.length, edges: edges.length,
    durationMs: Date.now() - start,
  });

  return snapshot;
}

// ── Enrichment from VerificationArtifacts ──────────────────────────────────────

async function enrichFromArtifacts(
  nodes: GraphNode[], edges: GraphEdge[], nodeMap: Map<string, GraphNode>,
): Promise<void> {
  // Get distinct NPIs with identity index artifacts
  const indexArts = await prisma.verificationArtifact.findMany({
    where: { source: 'IDENTITY_INDEX', lifecycleState: 'active' },
    select: { npi: true, rawPayload: true, id: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const seenNpis = new Set<string>();

  for (const art of indexArts) {
    if (seenNpis.has(art.npi)) continue;
    seenNpis.add(art.npi);

    const payload = (art.rawPayload ?? {}) as Record<string, unknown>;
    const summary = payload.summary as Record<string, unknown> | undefined;
    if (!summary) continue;

    // Ensure clinician node exists
    const clinicianId = nodeId('clinician', art.npi);
    if (!nodeMap.has(clinicianId)) {
      const cn: GraphNode = {
        id: clinicianId, type: 'clinician',
        label: `NPI ${art.npi}`, title: `Clinician ${art.npi}`,
        color: COLOR_GROUPS.clinician, group: 'clinician',
        degree: 0, inDegree: 0, outDegree: 0,
        layer: 'trust',
        metadata: { npi: art.npi, ...summary },
        tags: [], sourceRefs: [art.id],
        trustBand: summary.highestTier === 'GOLD' ? 'L2' : 'L1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      nodes.push(cn);
      nodeMap.set(clinicianId, cn);
    }

    // Create source nodes for each claim type
    const claimsByType = (summary.claimsByType ?? {}) as Record<string, number>;
    for (const [claimType, count] of Object.entries(claimsByType)) {
      const sourceNodeId = nodeId('claim', `${art.npi}_${claimType}`);
      if (!nodeMap.has(sourceNodeId)) {
        const sn: GraphNode = {
          id: sourceNodeId, type: 'claim',
          label: claimType.replace(/_/g, ' ').toLowerCase(),
          title: `${claimType} (${count} claim${count > 1 ? 's' : ''})`,
          color: COLOR_GROUPS.claim, group: 'claim',
          degree: 0, inDegree: 0, outDegree: 0,
          layer: 'trust',
          metadata: { claimType, count, npi: art.npi },
          tags: [claimType], sourceRefs: [art.id],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        nodes.push(sn);
        nodeMap.set(sourceNodeId, sn);
      }

      // Edge: clinician → claim
      const eid = edgeId(clinicianId, sourceNodeId, 'derived_from');
      edges.push({
        id: eid, source: clinicianId, target: sourceNodeId,
        type: 'derived_from', directed: true, reciprocal: false,
        confidence: 0.9, createdBy: 'system',
        explanation: `Clinician ${art.npi} has ${count} ${claimType} claim(s)`,
        status: 'active', weight: 1.0, metadata: {},
        layer: 'trust', color: EDGE_COLORS.derived_from,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });

      const srcNode = nodeMap.get(clinicianId);
      const tgtNode = nodeMap.get(sourceNodeId);
      if (srcNode) { srcNode.degree++; srcNode.outDegree++; }
      if (tgtNode) { tgtNode.degree++; tgtNode.inDegree++; }
    }
  }
}

// ── Enrichment from PersonProfiles ────────────────────────────────────────────

async function enrichFromProfiles(
  nodes: GraphNode[], edges: GraphEdge[], nodeMap: Map<string, GraphNode>,
): Promise<void> {
  const profiles = await prisma.personProfile.findMany({
    where: { npi: { not: null } },
    select: { npi: true, firstName: true, lastName: true, specialty: true, stateOfPractice: true },
    take: 1000,
  });

  for (const p of profiles) {
    if (!p.npi) continue;
    const clinicianId = nodeId('clinician', p.npi);

    // Update label if we have name data
    const existing = nodeMap.get(clinicianId);
    if (existing && p.firstName && p.lastName) {
      existing.label = `${p.firstName} ${p.lastName}`;
      existing.title = `${p.firstName} ${p.lastName} (NPI: ${p.npi})`;
      existing.metadata.firstName = p.firstName;
      existing.metadata.lastName = p.lastName;
    }

    // Specialty node
    if (p.specialty) {
      const specId = nodeId('specialty', p.specialty.toLowerCase());
      if (!nodeMap.has(specId)) {
        const sn: GraphNode = {
          id: specId, type: 'specialty',
          label: p.specialty, title: `Specialty: ${p.specialty}`,
          color: COLOR_GROUPS.specialty, group: 'specialty',
          degree: 0, inDegree: 0, outDegree: 0,
          layer: 'trust', metadata: { specialty: p.specialty },
          tags: [p.specialty], sourceRefs: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        nodes.push(sn);
        nodeMap.set(specId, sn);
      }

      const eid = edgeId(clinicianId, specId, 'affiliated_with');
      if (!edges.some(e => e.id === eid)) {
        edges.push({
          id: eid, source: clinicianId, target: specId,
          type: 'affiliated_with', directed: true, reciprocal: false,
          confidence: 0.95, createdBy: 'system',
          explanation: `${p.firstName ?? 'Clinician'} practices ${p.specialty}`,
          status: 'active', weight: 1.0, metadata: {},
          layer: 'trust', color: EDGE_COLORS.affiliated_with,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
      }
    }
  }
}

// ── Stats computation ─────────────────────────────────────────────────────────

function computeStats(nodes: GraphNode[], edges: GraphEdge[]): GraphStats {
  const nodesByType: Record<string, number> = {};
  const edgesByType: Record<string, number> = {};
  let orphanCount = 0;
  let maxDegree = 0;
  let totalDegree = 0;

  for (const n of nodes) {
    nodesByType[n.type] = (nodesByType[n.type] ?? 0) + 1;
    if (n.degree === 0) orphanCount++;
    if (n.degree > maxDegree) maxDegree = n.degree;
    totalDegree += n.degree;
  }

  for (const e of edges) {
    edgesByType[e.type] = (edgesByType[e.type] ?? 0) + 1;
  }

  return {
    totalNodes:       nodes.length,
    totalEdges:       edges.length,
    orphanCount,
    avgDegree:        nodes.length > 0 ? Math.round((totalDegree / nodes.length) * 100) / 100 : 0,
    maxDegree,
    clusterCount:     Object.keys(nodesByType).length,
    aiSuggestedLinks: edges.filter(e => e.createdBy === 'ai' && e.status === 'pending').length,
    aiAcceptedLinks:  edges.filter(e => e.createdBy === 'ai' && e.status === 'active').length,
    explicitLinks:    edges.filter(e => e.type === 'explicit_link').length,
    inferredLinks:    edges.filter(e => e.type === 'semantic_similarity' || e.type === 'ai_suggested_link').length,
    nodesByType,
    edgesByType,
  };
}

// ── Get cached or rebuild ─────────────────────────────────────────────────────

export async function getGraphSnapshot(fresh?: boolean): Promise<GraphSnapshot> {
  if (!fresh && cachedSnapshot && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedSnapshot;
  }
  return buildFullGraph();
}

// ── Incremental reindex for one NPI ───────────────────────────────────────────

export async function reindexNode(entityType: string, entityId: string): Promise<void> {
  // Invalidate cache
  cachedSnapshot = null;
  cacheTimestamp = 0;

  // Upsert the KnowledgeNode
  const type = mapEntityType(entityType);
  const id = nodeId(type, entityId);

  await prisma.knowledgeNode.upsert({
    where: { entityType_entityId: { entityType: type, entityId } },
    create: {
      id, entityType: type, entityId,
      label: entityId,
      attributes: JSON.parse(JSON.stringify({ reindexedAt: new Date().toISOString() })),
    },
    update: {
      attributes: JSON.parse(JSON.stringify({ reindexedAt: new Date().toISOString() })),
    },
  });

  log('info', 'graphIndexer: node reindexed', { entityType: type, entityId });
}

// ── Orphan detection ──────────────────────────────────────────────────────────

export async function detectOrphans(): Promise<GraphNode[]> {
  const snapshot = await getGraphSnapshot();
  return snapshot.nodes.filter(n => n.degree === 0);
}

// ── Reciprocal link validation ────────────────────────────────────────────────

export async function validateReciprocalLinks(): Promise<{
  total:     number;
  valid:     number;
  broken:    number;
  brokenIds: string[];
}> {
  const snapshot = await getGraphSnapshot();
  const edgeSet = new Set(snapshot.edges.map(e => `${e.source}|${e.target}|${e.type}`));

  let total = 0;
  let valid = 0;
  const brokenIds: string[] = [];

  for (const edge of snapshot.edges) {
    if (!edge.reciprocal) continue;
    total++;

    const reciprocalKey = `${edge.target}|${edge.source}|backlink`;
    const reverseKey = `${edge.target}|${edge.source}|${edge.type}`;
    if (edgeSet.has(reciprocalKey) || edgeSet.has(reverseKey)) {
      valid++;
    } else {
      brokenIds.push(edge.id);
    }
  }

  return { total, valid, broken: brokenIds.length, brokenIds };
}

// ── Local graph (neighborhood) ────────────────────────────────────────────────

export async function getLocalGraph(
  nodeId: string,
  depth: number = 2,
): Promise<GraphSnapshot> {
  const full = await getGraphSnapshot();

  // BFS from nodeId
  const visited = new Set<string>([nodeId]);
  let frontier = [nodeId];

  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const nextFrontier: string[] = [];
    for (const nid of frontier) {
      for (const edge of full.edges) {
        if (edge.status !== 'active') continue;
        if (edge.source === nid && !visited.has(edge.target)) {
          visited.add(edge.target);
          nextFrontier.push(edge.target);
        }
        if (edge.target === nid && !visited.has(edge.source)) {
          visited.add(edge.source);
          nextFrontier.push(edge.source);
        }
      }
    }
    frontier = nextFrontier;
  }

  const nodes = full.nodes.filter(n => visited.has(n.id));
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = full.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  // Mark the focus node
  const focusNode = nodes.find(n => n.id === nodeId);
  if (focusNode) {
    focusNode.highlighted = true;
    focusNode.selected = true;
  }

  return {
    id: `local_${nodeId}_d${depth}`,
    generatedAt: new Date().toISOString(),
    layer: full.layer,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
    stats: computeStats(nodes, edges),
    version: '1.0.0',
  };
}

// ── Type mapping ──────────────────────────────────────────────────────────────

function mapEntityType(raw: string): NodeType {
  const lower = raw.toLowerCase();
  const map: Record<string, NodeType> = {
    clinician: 'clinician', issuer: 'organization', credential: 'credential',
    policy: 'document', facility: 'institution', person: 'clinician',
    organization: 'organization', institution: 'institution',
    specialty: 'specialty', program: 'program', publication: 'publication',
    trial: 'trial', claim: 'claim', artifact: 'artifact',
    receipt: 'receipt', source: 'source', license: 'license',
    decision: 'decision', exclusion: 'exclusion', enrollment: 'enrollment',
    note: 'note', document: 'document', tag: 'tag', attachment: 'attachment',
    group: 'group',
  };
  return map[lower] ?? 'document';
}

function mapEdgeType(raw: string): EdgeType {
  const lower = raw.toLowerCase();
  const map: Record<string, EdgeType> = {
    verified_by: 'verified_by', issued_by: 'issued_by',
    issued_to: 'issued_by', complies_with: 'depends_on',
    required_by: 'depends_on', attested_by: 'attested_by',
    depends_on: 'depends_on', accepted_by: 'accepted_by',
    sanctioned_by: 'sanctioned_by', trained_at: 'trained_at',
    privileged_at: 'privileged_at',
    backlink: 'backlink', explicit_link: 'explicit_link',
    ai_suggested_link: 'ai_suggested_link', ai_accepted_link: 'ai_accepted_link',
    semantic_similarity: 'semantic_similarity', mentions: 'mentions',
    references: 'references', affiliated_with: 'affiliated_with',
    works_at: 'works_at', published_with: 'published_with',
    derived_from: 'derived_from', sourced_from: 'sourced_from',
    verifies: 'verifies', same_as: 'same_as', related_to: 'related_to',
    enrolled_in: 'enrolled_in', tagged_with: 'tagged_with',
    attached_to: 'attached_to', parent_of: 'parent_of', child_of: 'child_of',
  };
  return map[lower] ?? 'related_to';
}
