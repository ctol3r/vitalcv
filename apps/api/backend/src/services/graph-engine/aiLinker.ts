/**
 * aiLinker.ts — AI Bi-Directional Linking Engine
 *
 * Scans nodes and proposes or creates bidirectional relationships.
 * Uses a deterministic scoring system (no LLM), fast and reproducible.
 *
 * Strategy layers (evaluated in order):
 *   1. Exact entity match (same NPI, same institution name)
 *   2. Synonym / alias match (credential variations, name variants)
 *   3. Shared attributes (tags, specialties, states, sources)
 *   4. Graph topology reinforcement (friends-of-friends)
 *   5. Co-occurrence (appear in same artifact, same claim chain)
 *
 * Anti-spam rules:
 *   - Max 10 suggestions per node per run
 *   - Min confidence threshold 0.3
 *   - Rejected links are remembered and never re-suggested
 *   - Same-type links get a 0.1 confidence penalty (avoid clinician↔clinician spam)
 *   - Links already existing (explicit or accepted) are never re-suggested
 */

import { createHash } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import type {
  GraphNode, GraphEdge, EdgeType, EdgeCreator, EdgeStatus, NodeType,
} from './schema';
import { COLOR_GROUPS, EDGE_COLORS, nodeLayer } from './schema';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LinkSuggestion {
  id:             string;
  sourceNodeId:   string;
  targetNodeId:   string;
  edgeType:       EdgeType;
  confidence:     number;       // 0-1
  explanation:    string;       // human-readable reason
  strategy:       LinkStrategy;
  reciprocal:     boolean;
  directed:       boolean;
  status:         'pending' | 'accepted' | 'rejected' | 'auto_applied';
  createdAt:      string;
}

export type LinkStrategy =
  | 'exact_entity_match'
  | 'synonym_alias'
  | 'shared_attributes'
  | 'topology_reinforcement'
  | 'co_occurrence'
  | 'semantic_similarity';

export interface LinkResult {
  nodeId:         string;
  suggestions:    LinkSuggestion[];
  applied:        number;
  rejected:       number;
  skipped:        number;
  durationMs:     number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_SUGGESTIONS_PER_NODE = 10;
const MIN_CONFIDENCE = 0.30;
const AUTO_APPLY_THRESHOLD = 0.85;
const SAME_TYPE_PENALTY = 0.10;

// ── Rejected link memory ──────────────────────────────────────────────────────

// In-memory for now; could be persisted to DB
const rejectedLinks = new Set<string>();

function rejectionKey(a: string, b: string, edgeType: string): string {
  const sorted = [a, b].sort();
  return `${sorted[0]}|${sorted[1]}|${edgeType}`;
}

export function rejectLink(sourceId: string, targetId: string, edgeType: string): void {
  rejectedLinks.add(rejectionKey(sourceId, targetId, edgeType));
}

function isRejected(a: string, b: string, edgeType: string): boolean {
  return rejectedLinks.has(rejectionKey(a, b, edgeType));
}

// ── Suggestion ID ─────────────────────────────────────────────────────────────

function suggestionId(sourceId: string, targetId: string, edgeType: string): string {
  const sorted = [sourceId, targetId].sort();
  return 'sug_' + createHash('sha256')
    .update(`${sorted[0]}|${sorted[1]}|${edgeType}`)
    .digest('hex').slice(0, 24);
}

// ── Strategy: Exact Entity Match ──────────────────────────────────────────────

function exactEntityMatch(
  node: GraphNode,
  candidates: GraphNode[],
  existingEdges: Set<string>,
): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = [];
  const nodeAttrs = node.metadata;

  for (const candidate of candidates) {
    if (candidate.id === node.id) continue;
    const key = rejectionKey(node.id, candidate.id, 'same_as');
    if (existingEdges.has(`${node.id}|${candidate.id}`) || existingEdges.has(`${candidate.id}|${node.id}`)) continue;
    if (isRejected(node.id, candidate.id, 'same_as')) continue;

    // Same NPI
    const nodeNpi = nodeAttrs.npi as string | undefined;
    const candNpi = candidate.metadata.npi as string | undefined;
    if (nodeNpi && candNpi && nodeNpi === candNpi && node.type !== candidate.type) {
      suggestions.push({
        id: suggestionId(node.id, candidate.id, 'same_as'),
        sourceNodeId: node.id, targetNodeId: candidate.id,
        edgeType: 'same_as', confidence: 0.95,
        explanation: `Same NPI (${nodeNpi}) across ${node.type} and ${candidate.type} nodes`,
        strategy: 'exact_entity_match', reciprocal: true, directed: false,
        status: 'pending', createdAt: new Date().toISOString(),
      });
    }

    // Same institution name (fuzzy)
    const nodeInst = (nodeAttrs.institution as string ?? node.label).toLowerCase().trim();
    const candInst = (candidate.metadata.institution as string ?? candidate.label).toLowerCase().trim();
    if (nodeInst.length > 3 && candInst.length > 3 && nodeInst === candInst &&
        node.type !== candidate.type && node.id !== candidate.id) {
      const edgeType: EdgeType = candidate.type === 'institution' ? 'affiliated_with' : 'related_to';
      if (!isRejected(node.id, candidate.id, edgeType)) {
        suggestions.push({
          id: suggestionId(node.id, candidate.id, edgeType),
          sourceNodeId: node.id, targetNodeId: candidate.id,
          edgeType, confidence: 0.80,
          explanation: `Same institution name: "${nodeInst}"`,
          strategy: 'exact_entity_match', reciprocal: true, directed: false,
          status: 'pending', createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return suggestions;
}

// ── Strategy: Shared Attributes ───────────────────────────────────────────────

function sharedAttributeMatch(
  node: GraphNode,
  candidates: GraphNode[],
  existingEdges: Set<string>,
): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = [];
  const nodeTags = new Set(node.tags);
  const nodeState = (node.metadata.state as string)?.toUpperCase();
  const nodeSpecialty = (node.metadata.specialty as string)?.toLowerCase();
  const nodeSource = (node.metadata.sourceId as string);

  for (const candidate of candidates) {
    if (candidate.id === node.id) continue;
    if (existingEdges.has(`${node.id}|${candidate.id}`) || existingEdges.has(`${candidate.id}|${node.id}`)) continue;

    let score = 0;
    const reasons: string[] = [];

    // Shared tags
    const sharedTags = candidate.tags.filter(t => nodeTags.has(t));
    if (sharedTags.length > 0) {
      score += Math.min(sharedTags.length * 0.15, 0.45);
      reasons.push(`${sharedTags.length} shared tag(s): ${sharedTags.slice(0, 3).join(', ')}`);
    }

    // Same state
    const candState = (candidate.metadata.state as string)?.toUpperCase();
    if (nodeState && candState && nodeState === candState) {
      score += 0.10;
      reasons.push(`Same state: ${nodeState}`);
    }

    // Same specialty
    const candSpec = (candidate.metadata.specialty as string)?.toLowerCase();
    if (nodeSpecialty && candSpec && nodeSpecialty === candSpec) {
      score += 0.20;
      reasons.push(`Same specialty: ${nodeSpecialty}`);
    }

    // Same source
    const candSource = (candidate.metadata.sourceId as string);
    if (nodeSource && candSource && nodeSource === candSource) {
      score += 0.10;
      reasons.push(`Same data source: ${nodeSource}`);
    }

    // Same-type penalty
    if (node.type === candidate.type) {
      score -= SAME_TYPE_PENALTY;
    }

    if (score >= MIN_CONFIDENCE && reasons.length > 0) {
      const edgeType: EdgeType = 'related_to';
      if (!isRejected(node.id, candidate.id, edgeType)) {
        suggestions.push({
          id: suggestionId(node.id, candidate.id, edgeType),
          sourceNodeId: node.id, targetNodeId: candidate.id,
          edgeType, confidence: Math.min(score, 0.90),
          explanation: reasons.join('; '),
          strategy: 'shared_attributes', reciprocal: true, directed: false,
          status: 'pending', createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return suggestions;
}

// ── Strategy: Topology Reinforcement ──────────────────────────────────────────

function topologyReinforcement(
  node: GraphNode,
  candidates: GraphNode[],
  edges: GraphEdge[],
  existingEdges: Set<string>,
): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = [];

  // Build adjacency from existing edges
  const neighbors = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.status !== 'active') continue;
    if (!neighbors.has(edge.source)) neighbors.set(edge.source, new Set());
    if (!neighbors.has(edge.target)) neighbors.set(edge.target, new Set());
    neighbors.get(edge.source)!.add(edge.target);
    neighbors.get(edge.target)!.add(edge.source);
  }

  const nodeNeighbors = neighbors.get(node.id) ?? new Set();
  if (nodeNeighbors.size === 0) return suggestions;

  // Friends-of-friends: if A↔B and B↔C, suggest A↔C
  for (const neighborId of nodeNeighbors) {
    const fofNeighbors = neighbors.get(neighborId) ?? new Set();
    for (const fofId of fofNeighbors) {
      if (fofId === node.id) continue;
      if (nodeNeighbors.has(fofId)) continue; // already connected
      if (existingEdges.has(`${node.id}|${fofId}`) || existingEdges.has(`${fofId}|${node.id}`)) continue;
      if (isRejected(node.id, fofId, 'related_to')) continue;

      // Count mutual connections
      const fofN = neighbors.get(fofId) ?? new Set();
      const mutual = [...nodeNeighbors].filter(n => fofN.has(n)).length;
      if (mutual < 2) continue; // need at least 2 mutual connections

      const confidence = Math.min(0.30 + mutual * 0.10, 0.70);
      const fofNode = candidates.find(c => c.id === fofId);

      suggestions.push({
        id: suggestionId(node.id, fofId, 'related_to'),
        sourceNodeId: node.id, targetNodeId: fofId,
        edgeType: 'related_to', confidence,
        explanation: `${mutual} mutual connections via graph topology (friends-of-friends)`,
        strategy: 'topology_reinforcement', reciprocal: true, directed: false,
        status: 'pending', createdAt: new Date().toISOString(),
      });
    }
  }

  return suggestions;
}

// ── Strategy: Co-occurrence ───────────────────────────────────────────────────

function coOccurrenceMatch(
  node: GraphNode,
  candidates: GraphNode[],
  existingEdges: Set<string>,
): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = [];
  const nodeRefs = new Set(node.sourceRefs);

  if (nodeRefs.size === 0) return suggestions;

  for (const candidate of candidates) {
    if (candidate.id === node.id) continue;
    if (existingEdges.has(`${node.id}|${candidate.id}`) || existingEdges.has(`${candidate.id}|${node.id}`)) continue;

    const shared = candidate.sourceRefs.filter(r => nodeRefs.has(r));
    if (shared.length === 0) continue;

    const confidence = Math.min(0.25 + shared.length * 0.15, 0.75);
    const edgeType: EdgeType = 'derived_from';

    if (confidence >= MIN_CONFIDENCE && !isRejected(node.id, candidate.id, edgeType)) {
      suggestions.push({
        id: suggestionId(node.id, candidate.id, edgeType),
        sourceNodeId: node.id, targetNodeId: candidate.id,
        edgeType, confidence,
        explanation: `${shared.length} shared source artifact(s) — co-occurring in same evidence chain`,
        strategy: 'co_occurrence', reciprocal: false, directed: true,
        status: 'pending', createdAt: new Date().toISOString(),
      });
    }
  }

  return suggestions;
}

// ── Main AI linking function ──────────────────────────────────────────────────

export async function generateLinkSuggestions(
  nodeId: string,
  allNodes: GraphNode[],
  allEdges: GraphEdge[],
): Promise<LinkResult> {
  const start = Date.now();
  const node = allNodes.find(n => n.id === nodeId);
  if (!node) {
    return { nodeId, suggestions: [], applied: 0, rejected: 0, skipped: 0, durationMs: Date.now() - start };
  }

  // Build existing edge set
  const existingEdges = new Set<string>();
  for (const edge of allEdges) {
    if (edge.status === 'active' || edge.status === 'pending') {
      existingEdges.add(`${edge.source}|${edge.target}`);
    }
  }

  // Run all strategies
  const raw: LinkSuggestion[] = [
    ...exactEntityMatch(node, allNodes, existingEdges),
    ...sharedAttributeMatch(node, allNodes, existingEdges),
    ...topologyReinforcement(node, allNodes, allEdges, existingEdges),
    ...coOccurrenceMatch(node, allNodes, existingEdges),
  ];

  // Dedupe by suggestion ID, keep highest confidence
  const byId = new Map<string, LinkSuggestion>();
  for (const s of raw) {
    const existing = byId.get(s.id);
    if (!existing || s.confidence > existing.confidence) {
      byId.set(s.id, s);
    }
  }

  // Filter, sort, cap
  let suggestions = [...byId.values()]
    .filter(s => s.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_SUGGESTIONS_PER_NODE);

  // Auto-apply high-confidence suggestions
  let applied = 0;
  for (const s of suggestions) {
    if (s.confidence >= AUTO_APPLY_THRESHOLD) {
      s.status = 'auto_applied';
      applied++;
    }
  }

  return {
    nodeId,
    suggestions,
    applied,
    rejected: 0,
    skipped: raw.length - suggestions.length,
    durationMs: Date.now() - start,
  };
}

// ── Batch AI linking ──────────────────────────────────────────────────────────

export async function generateAllLinkSuggestions(
  allNodes: GraphNode[],
  allEdges: GraphEdge[],
  options?: { staleOnly?: boolean; maxNodes?: number },
): Promise<{
  totalNodes:      number;
  suggestionsGenerated: number;
  autoApplied:     number;
  durationMs:      number;
  results:         LinkResult[];
}> {
  const start = Date.now();
  const maxNodes = options?.maxNodes ?? 500;
  const nodesToProcess = allNodes.slice(0, maxNodes);

  const results: LinkResult[] = [];
  let totalSuggestions = 0;
  let totalAutoApplied = 0;

  for (const node of nodesToProcess) {
    const result = await generateLinkSuggestions(node.id, allNodes, allEdges);
    if (result.suggestions.length > 0) {
      results.push(result);
      totalSuggestions += result.suggestions.length;
      totalAutoApplied += result.applied;
    }
  }

  return {
    totalNodes: nodesToProcess.length,
    suggestionsGenerated: totalSuggestions,
    autoApplied: totalAutoApplied,
    durationMs: Date.now() - start,
    results,
  };
}

// ── Apply accepted link → create reciprocal edges ─────────────────────────────

export async function applyLinkSuggestion(
  suggestion: LinkSuggestion,
): Promise<{ edgesCreated: string[] }> {
  const edgesCreated: string[] = [];
  const now = new Date();

  // Create primary edge
  const primary = await prisma.authorityEdge.create({
    data: {
      sourceNodeId: suggestion.sourceNodeId,
      targetNodeId: suggestion.targetNodeId,
      relationType: suggestion.edgeType,
      weight: suggestion.confidence,
      metadata: JSON.parse(JSON.stringify({
        createdBy: 'ai',
        strategy: suggestion.strategy,
        explanation: suggestion.explanation,
        confidence: suggestion.confidence,
        status: 'active',
        reciprocal: suggestion.reciprocal,
        directed: suggestion.directed,
        appliedAt: now.toISOString(),
      })),
    },
    select: { id: true },
  });
  edgesCreated.push(primary.id);

  // Create reciprocal edge if bidirectional
  if (suggestion.reciprocal) {
    const reciprocal = await prisma.authorityEdge.create({
      data: {
        sourceNodeId: suggestion.targetNodeId,
        targetNodeId: suggestion.sourceNodeId,
        relationType: `backlink`,
        weight: suggestion.confidence,
        metadata: JSON.parse(JSON.stringify({
          createdBy: 'ai',
          strategy: suggestion.strategy,
          explanation: `Reciprocal of: ${suggestion.explanation}`,
          confidence: suggestion.confidence,
          status: 'active',
          reciprocalOf: primary.id,
          directed: false,
          appliedAt: now.toISOString(),
        })),
      },
      select: { id: true },
    });
    edgesCreated.push(reciprocal.id);
  }

  log('info', 'aiLinker: applied suggestion', {
    suggestionId: suggestion.id,
    source: suggestion.sourceNodeId,
    target: suggestion.targetNodeId,
    edgeType: suggestion.edgeType,
    reciprocal: suggestion.reciprocal,
    edgesCreated: edgesCreated.length,
  });

  return { edgesCreated };
}

// ── Bulk apply by threshold ───────────────────────────────────────────────────

export async function bulkApplyByThreshold(
  suggestions: LinkSuggestion[],
  threshold: number = AUTO_APPLY_THRESHOLD,
): Promise<{ applied: number; edgesCreated: string[] }> {
  const qualifying = suggestions.filter(s => s.confidence >= threshold && s.status === 'pending');
  const allEdges: string[] = [];

  for (const s of qualifying) {
    const { edgesCreated } = await applyLinkSuggestion(s);
    allEdges.push(...edgesCreated);
    s.status = 'accepted';
  }

  return { applied: qualifying.length, edgesCreated: allEdges };
}
