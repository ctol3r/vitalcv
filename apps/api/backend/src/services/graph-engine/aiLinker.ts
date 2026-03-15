import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { sha256ForPayload } from '../../utils/deterministic';
import { recordSuggestionOutcome } from '../intelligence/intelligenceEngineService';
import {
  createGraphDecisionId,
  createGraphEdgeId,
  createGraphRejectMemoryId,
  createGraphRejectMemoryPairKey,
  createGraphSuggestionBatchFingerprint,
  createGraphSuggestionBatchId,
  createGraphSuggestionId,
  createGraphSuggestionKey,
} from './ids';
import { invalidateGraphSnapshots } from './invalidation';
import { queryGraph } from './queryService';
import { ensureReciprocalEdgeRules, loadReciprocalRuleMap } from './reciprocity';
import type { GraphEdge, GraphLayer, GraphNode } from './schema';

type SuggestionState = 'pending' | 'accepted' | 'rejected' | 'ignored' | 'superseded';

const REJECT_RECONSIDERATION_WINDOW_DAYS = 30;
const aiLinkTracer = trace.getTracer('vitalcv.graph.ai-linker');

export type LinkStrategy =
  | 'exact_match'
  | 'alias_synonym'
  | 'semantic_similarity_hook'
  | 'shared_tags'
  | 'shared_institutions'
  | 'co_occurrence'
  | 'topology_reinforcement';

export interface SuggestionSignal {
  kind: LinkStrategy;
  score: number;
  evidence: string[];
}

export interface SuggestionExplanation {
  summary: string;
  semanticEdgeType: string;
  confidence: number;
  signals: SuggestionSignal[];
  candidateReciprocalBehavior: {
    mode: string;
    reverseEdgeType: string;
  };
  materialChangeHash: string;
}

export interface GraphSuggestionBatchInput {
  batchId?: string;
  graphMode?: GraphLayer;
  targetNodeId?: string | null;
  reviewerId?: string | null;
  maxSuggestionsPerNode?: number;
  minConfidence?: number;
  applyThreshold?: number;
}

export interface GraphSuggestionBatchResult {
  batchId: string;
  status: string;
  generated: number;
  suppressedByRejectMemory: number;
  superseded: number;
  targetNodeIds: string[];
}

export interface SuggestionDecisionInput {
  suggestionIds?: string[];
  batchId?: string;
  threshold?: number;
  action: 'accept' | 'reject' | 'ignore';
  reviewerId?: string | null;
  rationale?: string | null;
}

export interface SuggestionDecisionResult {
  action: SuggestionDecisionInput['action'];
  matched: number;
  decided: number;
  edgeIds: string[];
  rejectMemoryIds: string[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function tokenize(value: string): string[] {
  return unique(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length > 1),
  );
}

function jaccardSimilarity(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / union.size;
}

function buildNodeTokens(node: GraphNode): string[] {
  const metadata = asRecord(node.metadata);
  return unique([
    ...tokenize(node.label),
    ...tokenize(node.title),
    ...node.tags.flatMap((tag) => tokenize(tag)),
    ...tokenize(asString(metadata.specialty) ?? ''),
    ...tokenize(asString(metadata.institution) ?? ''),
    ...tokenize(asString(metadata.organizationName) ?? ''),
    ...tokenize((metadata.aliases as string[] | undefined)?.join(' ') ?? ''),
  ]);
}

function buildExistingEdgeLookup(edges: GraphEdge[]): Set<string> {
  const keys = new Set<string>();
  for (const edge of edges) {
    if (edge.status === 'rejected' || edge.status === 'superseded') continue;
    if (edge.type === 'semantic_similarity') continue;
    keys.add(createGraphSuggestionKey({
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      edgeType: edge.type,
      directed: edge.directed,
    }));
  }
  return keys;
}

function computeTopologyMap(edges: GraphEdge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const edge of edges) {
    const left = map.get(edge.source) ?? new Set<string>();
    left.add(edge.target);
    map.set(edge.source, left);
    const right = map.get(edge.target) ?? new Set<string>();
    right.add(edge.source);
    map.set(edge.target, right);
  }
  return map;
}

function highDegreeThreshold(node: GraphNode): { minConfidenceBoost: number; maxSuggestions: number } {
  if (node.degree >= 40) return { minConfidenceBoost: 0.2, maxSuggestions: 2 };
  if (node.degree >= 25) return { minConfidenceBoost: 0.1, maxSuggestions: 4 };
  return { minConfidenceBoost: 0, maxSuggestions: 10 };
}

function computeSignals(
  sourceNode: GraphNode,
  targetNode: GraphNode,
  topology: Map<string, Set<string>>,
): { semanticEdgeType: string; signals: SuggestionSignal[] } {
  const sourceMetadata = asRecord(sourceNode.metadata);
  const targetMetadata = asRecord(targetNode.metadata);
  const signals: SuggestionSignal[] = [];

  const sourceNpi = asString(sourceMetadata.npi);
  const targetNpi = asString(targetMetadata.npi);
  if (sourceNpi && targetNpi && sourceNpi === targetNpi && sourceNode.type !== targetNode.type) {
    signals.push({
      kind: 'exact_match',
      score: 0.65,
      evidence: [`matching npi ${sourceNpi}`],
    });
  }

  const sourceAliases = [
    sourceNode.label,
    sourceNode.title,
    ...(sourceMetadata.aliases as string[] | undefined ?? []),
  ].map((value) => value.toLowerCase());
  const targetAliases = [
    targetNode.label,
    targetNode.title,
    ...(targetMetadata.aliases as string[] | undefined ?? []),
  ].map((value) => value.toLowerCase());
  if (sourceAliases.some((alias) => targetAliases.includes(alias)) && sourceNode.id !== targetNode.id) {
    signals.push({
      kind: 'alias_synonym',
      score: 0.2,
      evidence: ['matching alias/title token'],
    });
  }

  const tokenSimilarity = jaccardSimilarity(buildNodeTokens(sourceNode), buildNodeTokens(targetNode));
  if (tokenSimilarity >= 0.45) {
    signals.push({
      kind: 'semantic_similarity_hook',
      score: Math.min(0.35, tokenSimilarity * 0.5),
      evidence: [`token_similarity=${tokenSimilarity.toFixed(2)}`],
    });
  }

  const sharedTags = sourceNode.tags.filter((tag) => targetNode.tags.includes(tag));
  if (sharedTags.length > 0) {
    signals.push({
      kind: 'shared_tags',
      score: Math.min(0.08 * sharedTags.length, 0.24),
      evidence: sharedTags.slice(0, 5),
    });
  }

  const sourceInstitution = asString(sourceMetadata.institution) ?? asString(sourceMetadata.organizationName);
  const targetInstitution = asString(targetMetadata.institution) ?? asString(targetMetadata.organizationName);
  const sourceSpecialty = asString(sourceMetadata.specialty);
  const targetSpecialty = asString(targetMetadata.specialty);
  const institutionEvidence: string[] = [];
  let institutionScore = 0;
  if (sourceInstitution && targetInstitution && sourceInstitution.toLowerCase() === targetInstitution.toLowerCase()) {
    institutionScore += 0.18;
    institutionEvidence.push(`institution:${sourceInstitution}`);
  }
  if (sourceSpecialty && targetSpecialty && sourceSpecialty.toLowerCase() === targetSpecialty.toLowerCase()) {
    institutionScore += 0.14;
    institutionEvidence.push(`specialty:${sourceSpecialty}`);
  }
  if (institutionScore > 0) {
    signals.push({
      kind: 'shared_institutions',
      score: institutionScore,
      evidence: institutionEvidence,
    });
  }

  const sharedRefs = sourceNode.sourceRefs.filter((ref) => targetNode.sourceRefs.includes(ref));
  if (sharedRefs.length > 0) {
    signals.push({
      kind: 'co_occurrence',
      score: Math.min(0.1 * sharedRefs.length, 0.25),
      evidence: sharedRefs.slice(0, 4),
    });
  }

  const sourceNeighbors = topology.get(sourceNode.id) ?? new Set<string>();
  const targetNeighbors = topology.get(targetNode.id) ?? new Set<string>();
  const mutualNeighbors = [...sourceNeighbors].filter((neighbor) => targetNeighbors.has(neighbor));
  if (mutualNeighbors.length >= 2) {
    signals.push({
      kind: 'topology_reinforcement',
      score: Math.min(0.12 + mutualNeighbors.length * 0.05, 0.25),
      evidence: mutualNeighbors.slice(0, 4),
    });
  }

  const semanticEdgeType = signals.some((signal) => signal.kind === 'exact_match')
    ? 'same_as'
    : signals.some((signal) => signal.kind === 'semantic_similarity_hook')
      ? 'semantic_similarity'
      : signals.some((signal) => signal.kind === 'shared_institutions')
        ? 'related_to'
        : 'related_to';

  return { semanticEdgeType, signals };
}

function buildMaterialChangeHash(
  sourceNode: GraphNode,
  targetNode: GraphNode,
  semanticEdgeType: string,
  signals: SuggestionSignal[],
): string {
  return sha256ForPayload({
    sourceNodeId: sourceNode.id,
    targetNodeId: targetNode.id,
    semanticEdgeType,
    sourceRefs: sourceNode.sourceRefs,
    targetRefs: targetNode.sourceRefs,
    sourceTags: sourceNode.tags,
    targetTags: targetNode.tags,
    signals,
  });
}

function createSuggestionBatchRequestFingerprint(input: GraphSuggestionBatchInput): string {
  return createGraphSuggestionBatchFingerprint({
    graphMode: input.graphMode ?? 'blended',
    targetNodeId: input.targetNodeId ?? null,
    filterSignature: sha256ForPayload({
      graphMode: input.graphMode ?? 'blended',
      targetNodeId: input.targetNodeId ?? null,
    }),
    maxSuggestionsPerNode: input.maxSuggestionsPerNode ?? 10,
    minConfidence: input.minConfidence ?? 0.3,
    applyThreshold: input.applyThreshold ?? 0.85,
  });
}

function graphModesForSuggestion(graphMode?: GraphLayer): GraphLayer[] {
  if (graphMode === 'knowledge') return ['knowledge', 'blended'];
  if (graphMode === 'trust') return ['trust', 'blended'];
  return ['knowledge', 'trust', 'blended'];
}

function reconsiderAfterDate(baseDate: Date): Date {
  return new Date(baseDate.getTime() + REJECT_RECONSIDERATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

async function ensureBatch(
  input: GraphSuggestionBatchInput,
  prismaClient: PrismaClient,
): Promise<string> {
  const requestFingerprint = createSuggestionBatchRequestFingerprint(input);
  const batchId = input.batchId ?? createGraphSuggestionBatchId({
    graphMode: input.graphMode ?? 'blended',
    targetNodeId: input.targetNodeId ?? null,
    filterSignature: sha256ForPayload({
      graphMode: input.graphMode ?? 'blended',
      targetNodeId: input.targetNodeId ?? null,
      maxSuggestionsPerNode: input.maxSuggestionsPerNode ?? 10,
      minConfidence: input.minConfidence ?? 0.3,
      applyThreshold: input.applyThreshold ?? 0.85,
    }),
  });

  await prismaClient.graphSuggestionBatch.upsert({
    where: { id: batchId },
    update: {
      status: 'RUNNING',
      requestFingerprint,
      summary: {},
      errorText: null,
    },
    create: {
      id: batchId,
      status: 'RUNNING',
      requestFingerprint,
      graphMode: input.graphMode ?? 'blended',
      targetNodeId: input.targetNodeId ?? null,
      filterSignature: sha256ForPayload({
        graphMode: input.graphMode ?? 'blended',
        targetNodeId: input.targetNodeId ?? null,
      }),
      maxSuggestionsPerNode: input.maxSuggestionsPerNode ?? 10,
      minConfidence: input.minConfidence ?? 0.3,
      applyThreshold: input.applyThreshold ?? 0.85,
    },
  });

  return batchId;
}

export async function generateGraphLinkSuggestions(
  input: GraphSuggestionBatchInput,
  prismaClient: PrismaClient = prisma,
): Promise<GraphSuggestionBatchResult> {
  return aiLinkTracer.startActiveSpan('graph.ai_links.generate', async (span) => {
    span.setAttributes({
      'graph.mode': input.graphMode ?? 'blended',
      'graph.target_node_id': input.targetNodeId ?? 'global',
      'graph.max_suggestions_per_node': input.maxSuggestionsPerNode ?? 10,
      'graph.min_confidence': input.minConfidence ?? 0.3,
      'graph.apply_threshold': input.applyThreshold ?? 0.85,
    });

    await ensureReciprocalEdgeRules(prismaClient);
    const batchId = await ensureBatch(input, prismaClient);

    const batch = await prismaClient.graphSuggestionBatch.findUniqueOrThrow({
      where: { id: batchId },
    });

    try {
      const startedAt = new Date();
      const graph = await queryGraph({
        graphMode: input.graphMode ?? 'blended',
        scope: input.targetNodeId ? 'local' : 'global',
        focusNodeId: input.targetNodeId ?? null,
        depth: input.targetNodeId ? 2 : 3,
        showAiLinks: false,
        limit: 2000,
      }, prismaClient);

      const nodes = graph.chunk.nodes;
      const edges = graph.chunk.edges;
      const targetNodes = input.targetNodeId
        ? nodes.filter((node) => node.id === input.targetNodeId)
        : nodes;

      const targetNodeIds: string[] = [];
      const existingEdgeKeys = buildExistingEdgeLookup(edges);
      const topology = computeTopologyMap(edges);
      const rejectMemory = await prismaClient.graphRejectMemory.findMany();
      const rejectMemoryByPairKey = new Map(rejectMemory.map((row) => [row.pairKey, row]));
      const ruleMap = await loadReciprocalRuleMap(prismaClient);
      const pendingSuggestionRows = await prismaClient.graphLinkSuggestion.findMany({
        where: {
          state: { in: ['PENDING', 'IGNORED'] },
        },
      });
      const pendingByKey = new Map<string, typeof pendingSuggestionRows>();
      const pendingByCompositeKey = new Map<string, (typeof pendingSuggestionRows)[number]>();
      for (const row of pendingSuggestionRows) {
        const bucket = pendingByKey.get(row.suggestionKey) ?? [];
        bucket.push(row);
        pendingByKey.set(row.suggestionKey, bucket);
        pendingByCompositeKey.set(`${row.suggestionKey}:${row.materialChangeHash}`, row);
      }

      let generated = 0;
      let suppressedByRejectMemory = 0;
      let superseded = 0;
      const emittedSuggestionKeys = new Set<string>();
      const suppressedRejectPairs = new Map<string, number>();

      for (const node of targetNodes) {
        const nodeBudget = highDegreeThreshold(node);
        const maxSuggestions = Math.min(input.maxSuggestionsPerNode ?? batch.maxSuggestionsPerNode, nodeBudget.maxSuggestions);
        const minConfidence = (input.minConfidence ?? batch.minConfidence) + nodeBudget.minConfidenceBoost;
        const ranked: Array<{ sourceNode: GraphNode; targetNode: GraphNode; confidence: number; semanticEdgeType: string; signals: SuggestionSignal[]; materialChangeHash: string }> = [];

        for (const candidate of nodes) {
          if (candidate.id === node.id) continue;
          const { semanticEdgeType, signals } = computeSignals(node, candidate, topology);
          const confidence = signals.reduce((sum, signal) => sum + signal.score, 0);
          if (confidence < minConfidence) continue;

          const suggestionKey = createGraphSuggestionKey({
            sourceNodeId: node.id,
            targetNodeId: candidate.id,
            edgeType: semanticEdgeType,
            directed: false,
          });
          if (existingEdgeKeys.has(suggestionKey)) continue;

          const materialChangeHash = buildMaterialChangeHash(node, candidate, semanticEdgeType, signals);
          const rejectKey = createGraphRejectMemoryPairKey({
            sourceNodeId: node.id,
            targetNodeId: candidate.id,
            edgeType: semanticEdgeType,
          });
          const rejectRow = rejectMemoryByPairKey.get(rejectKey);
          if (rejectRow) {
            const evidenceChanged = rejectRow.evidenceHash !== materialChangeHash;
            const reconsiderBlocked = Boolean(rejectRow.reconsiderAfter && rejectRow.reconsiderAfter > startedAt);
            if (!evidenceChanged || reconsiderBlocked) {
              suppressedByRejectMemory += 1;
              suppressedRejectPairs.set(rejectKey, (suppressedRejectPairs.get(rejectKey) ?? 0) + 1);
              continue;
            }
          }

          ranked.push({
            sourceNode: node,
            targetNode: candidate,
            confidence: Math.min(confidence, 0.98),
            semanticEdgeType,
            signals,
            materialChangeHash,
          });
        }

        targetNodeIds.push(node.id);
        for (const entry of ranked
          .sort((left, right) => right.confidence - left.confidence || left.targetNode.id.localeCompare(right.targetNode.id))
          .slice(0, maxSuggestions)) {
          const suggestionKey = createGraphSuggestionKey({
            sourceNodeId: entry.sourceNode.id,
            targetNodeId: entry.targetNode.id,
            edgeType: entry.semanticEdgeType,
            directed: false,
          });
          const explanation: SuggestionExplanation = {
            summary: entry.signals.map((signal) => `${signal.kind}:${signal.evidence.join('|')}`).join('; '),
            semanticEdgeType: entry.semanticEdgeType,
            confidence: entry.confidence,
            signals: entry.signals,
            candidateReciprocalBehavior: {
              mode: ruleMap.get('ai_accepted_link')?.relationshipMode ?? 'MIRROR',
              reverseEdgeType: ruleMap.get('ai_accepted_link')?.reverseEdgeType ?? 'ai_accepted_link',
            },
            materialChangeHash: entry.materialChangeHash,
          };
          const compositeKey = `${suggestionKey}:${entry.materialChangeHash}`;
          if (emittedSuggestionKeys.has(compositeKey)) {
            continue;
          }
          emittedSuggestionKeys.add(compositeKey);

          const existingRow = pendingByCompositeKey.get(compositeKey);
          if (existingRow?.state === 'IGNORED') {
            continue;
          }

          const priorRows = (pendingByKey.get(suggestionKey) ?? [])
            .filter((row) => row.materialChangeHash !== entry.materialChangeHash);
          for (const prior of priorRows) {
            await prismaClient.graphLinkSuggestion.update({
              where: { id: prior.id },
              data: {
                state: 'SUPERSEDED',
                decidedAt: new Date(),
              },
            });
            superseded += 1;
            pendingByCompositeKey.delete(`${prior.suggestionKey}:${prior.materialChangeHash}`);
          }

          const id = createGraphSuggestionId({
            sourceNodeId: entry.sourceNode.id,
            targetNodeId: entry.targetNode.id,
            edgeType: entry.semanticEdgeType,
            directed: false,
            materialChangeHash: entry.materialChangeHash,
          });

          await prismaClient.graphLinkSuggestion.upsert({
            where: {
              suggestionKey_materialChangeHash: {
                suggestionKey,
                materialChangeHash: entry.materialChangeHash,
              },
            },
            update: {
              batchId,
              confidence: entry.confidence,
              state: 'PENDING',
              explanation: toJsonValue(explanation),
              signalBreakdown: toJsonValue({ signals: entry.signals }),
              decidedAt: null,
            },
            create: {
              id,
              suggestionKey,
              batchId,
              sourceNodeId: entry.sourceNode.id,
              targetNodeId: entry.targetNode.id,
              edgeType: entry.semanticEdgeType,
              directed: false,
              reciprocal: true,
              confidence: entry.confidence,
              state: 'PENDING',
              explanation: toJsonValue(explanation),
              signalBreakdown: toJsonValue({ signals: entry.signals }),
              materialChangeHash: entry.materialChangeHash,
            },
          });
          pendingByCompositeKey.set(compositeKey, {
            ...(existingRow ?? {
              id,
              batchId,
              sourceNodeId: entry.sourceNode.id,
              targetNodeId: entry.targetNode.id,
              edgeType: entry.semanticEdgeType,
              directed: false,
              reciprocal: true,
              confidence: entry.confidence,
              state: 'PENDING',
              explanation: explanation as unknown as Prisma.JsonValue,
              signalBreakdown: { signals: entry.signals } as unknown as Prisma.JsonValue,
              materialChangeHash: entry.materialChangeHash,
              createdAt: startedAt,
              updatedAt: startedAt,
              decidedAt: null,
              suggestionKey,
            }),
            batchId,
            confidence: entry.confidence,
            state: 'PENDING',
            materialChangeHash: entry.materialChangeHash,
          });
          generated += 1;
        }
      }

      for (const [pairKey, suppressionCount] of suppressedRejectPairs.entries()) {
        await prismaClient.graphRejectMemory.update({
          where: { pairKey },
          data: {
            lastSuggestedAt: startedAt,
            lastSuppressedAt: startedAt,
            suppressionCount: {
              increment: suppressionCount,
            },
          },
        });
      }

      await prismaClient.graphSuggestionBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          summary: {
            generated,
            suppressedByRejectMemory,
            superseded,
            targetNodeIds,
          },
        },
      });

      await invalidateGraphSnapshots(prismaClient, {
        reason: 'ai_link_suggest',
        graphModes: graphModesForSuggestion(input.graphMode),
        focusNodeIds: input.targetNodeId ? [input.targetNodeId] : targetNodeIds,
        invalidateGlobal: true,
        metadata: {
          batchId,
          generated,
          suppressedByRejectMemory,
        },
      });

      log('info', 'graph_ai_linker: batch completed', {
        batchId,
        generated,
        suppressedByRejectMemory,
        superseded,
      });

      span.setAttributes({
        'graph.generated': generated,
        'graph.suppressed_by_reject_memory': suppressedByRejectMemory,
        'graph.superseded': superseded,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return {
        batchId,
        status: 'COMPLETED',
        generated,
        suppressedByRejectMemory,
        superseded,
        targetNodeIds,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prismaClient.graphSuggestionBatch.update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          errorText: message,
        },
      });
      span.recordException(error instanceof Error ? error : new Error(message));
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      throw error;
    } finally {
      span.end();
    }
  });
}

async function materializeAcceptedSuggestion(
  suggestionId: string,
  reviewerId: string | null,
  rationale: string | null,
  prismaClient: PrismaClient,
): Promise<string[]> {
  await ensureReciprocalEdgeRules(prismaClient);
  const suggestion = await prismaClient.graphLinkSuggestion.findUniqueOrThrow({
    where: { id: suggestionId },
  });
  const ruleMap = await loadReciprocalRuleMap(prismaClient);
  const acceptRule = ruleMap.get('ai_accepted_link');
  const explanation = asRecord(suggestion.explanation);
  const materialHash = suggestion.materialChangeHash;

  const primaryEdgeId = createGraphEdgeId({
    sourceNodeId: suggestion.sourceNodeId,
    targetNodeId: suggestion.targetNodeId,
    edgeType: 'ai_accepted_link',
    directed: false,
    createdBy: 'ai',
    materialHash,
  });
  const reverseEdgeId = createGraphEdgeId({
    sourceNodeId: suggestion.targetNodeId,
    targetNodeId: suggestion.sourceNodeId,
    edgeType: acceptRule?.reverseEdgeType ?? 'ai_accepted_link',
    directed: false,
    createdBy: 'ai',
    materialHash,
  });

  const edgeIds = [primaryEdgeId];
  await prismaClient.graphEdge.upsert({
    where: { id: primaryEdgeId },
    update: {
      reverseEdgeId: null,
      confidence: suggestion.confidence,
      status: 'ACTIVE',
      explanation: asString(explanation.summary),
      provenance: toJsonValue({
        suggestionId,
        reviewerId,
        rationale,
        semanticEdgeType: suggestion.edgeType,
        explanation,
      }),
    },
    create: {
      id: primaryEdgeId,
      canonicalKey: primaryEdgeId,
      pairKey: createGraphSuggestionKey({
        sourceNodeId: suggestion.sourceNodeId,
        targetNodeId: suggestion.targetNodeId,
        edgeType: 'ai_accepted_link',
        directed: false,
      }),
      sourceNodeId: suggestion.sourceNodeId,
      targetNodeId: suggestion.targetNodeId,
      edgeType: 'ai_accepted_link',
      directed: false,
      reciprocal: true,
      reverseEdgeId: null,
      confidence: suggestion.confidence,
      status: 'ACTIVE',
      createdBy: 'ai',
      provenance: toJsonValue({
        suggestionId,
        reviewerId,
        rationale,
        semanticEdgeType: suggestion.edgeType,
        explanation,
      }),
      explanation: asString(explanation.summary),
      materialHash,
    },
  });

  if (acceptRule?.autoCreate) {
    edgeIds.push(reverseEdgeId);
    await prismaClient.graphEdge.upsert({
      where: { id: reverseEdgeId },
      update: {
        reverseEdgeId: null,
        confidence: suggestion.confidence,
        status: 'ACTIVE',
        explanation: 'Reciprocal AI accepted link',
        provenance: toJsonValue({
          suggestionId,
          reviewerId,
          rationale,
          semanticEdgeType: suggestion.edgeType,
          reciprocalOf: primaryEdgeId,
        }),
      },
      create: {
        id: reverseEdgeId,
        canonicalKey: reverseEdgeId,
        pairKey: createGraphSuggestionKey({
          sourceNodeId: suggestion.targetNodeId,
          targetNodeId: suggestion.sourceNodeId,
          edgeType: acceptRule.reverseEdgeType,
          directed: false,
        }),
        sourceNodeId: suggestion.targetNodeId,
        targetNodeId: suggestion.sourceNodeId,
        edgeType: acceptRule.reverseEdgeType,
        directed: false,
        reciprocal: true,
        reverseEdgeId: null,
        confidence: suggestion.confidence,
        status: 'ACTIVE',
        createdBy: 'ai',
        provenance: toJsonValue({
          suggestionId,
          reviewerId,
          rationale,
          semanticEdgeType: suggestion.edgeType,
          reciprocalOf: primaryEdgeId,
        }),
        explanation: 'Reciprocal AI accepted link',
        materialHash,
      },
    });

    await prismaClient.graphEdge.update({
      where: { id: primaryEdgeId },
      data: { reverseEdgeId },
    });

    await prismaClient.graphEdge.update({
      where: { id: reverseEdgeId },
      data: { reverseEdgeId: primaryEdgeId },
    });
  }

  await prismaClient.graphLinkDecision.create({
    data: {
      id: createGraphDecisionId({ suggestionId, action: 'ACCEPT' }),
      suggestionId,
      action: 'ACCEPT',
      decidedBy: reviewerId,
      rationale,
      metadata: toJsonValue({
        edgeIds,
      }),
    },
  });

  await prismaClient.graphLinkSuggestion.update({
    where: { id: suggestionId },
    data: {
      state: 'ACCEPTED',
      decidedAt: new Date(),
    },
  });

  await invalidateGraphSnapshots(prismaClient, {
    reason: 'ai_link_accept',
    graphModes: graphModesForSuggestion('blended'),
    focusNodeIds: [suggestion.sourceNodeId, suggestion.targetNodeId],
    invalidateGlobal: true,
    metadata: {
      suggestionId,
      edgeIds,
    },
  });
  await recordSuggestionOutcome({
    suggestionType: 'GRAPH_LINK',
    suggestionKey: suggestion.suggestionKey,
    subjectType: 'GRAPH_NODE',
    subjectId: suggestion.sourceNodeId,
    accepted: true,
    confidence: suggestion.confidence,
    feedbackSource: 'GRAPH_REVIEW',
    graphSuggestionId: suggestionId,
    sourceNodeId: suggestion.sourceNodeId,
    targetNodeId: suggestion.targetNodeId,
    outcomeScore: suggestion.confidence,
    rationale,
    metadata: {
      edgeIds,
      semanticEdgeType: suggestion.edgeType,
      reviewerId,
    },
    createdAt: new Date(),
  }, prismaClient);
  return edgeIds;
}

async function rejectSuggestion(
  suggestionId: string,
  reviewerId: string | null,
  rationale: string | null,
  prismaClient: PrismaClient,
): Promise<string> {
  const suggestion = await prismaClient.graphLinkSuggestion.findUniqueOrThrow({
    where: { id: suggestionId },
  });
  const rejectMemoryId = createGraphRejectMemoryId({
    sourceNodeId: suggestion.sourceNodeId,
    targetNodeId: suggestion.targetNodeId,
    edgeType: suggestion.edgeType,
  });
  const pairKey = createGraphRejectMemoryPairKey({
    sourceNodeId: suggestion.sourceNodeId,
    targetNodeId: suggestion.targetNodeId,
    edgeType: suggestion.edgeType,
  });

  await prismaClient.graphRejectMemory.upsert({
    where: { pairKey },
    update: {
      reviewerId,
      rationale,
      evidenceHash: suggestion.materialChangeHash,
      reconsiderAfter: reconsiderAfterDate(new Date()),
      lastRejectedAt: new Date(),
    },
    create: {
      id: rejectMemoryId,
      pairKey,
      sourceNodeId: suggestion.sourceNodeId,
      targetNodeId: suggestion.targetNodeId,
      edgeType: suggestion.edgeType,
      reviewerId,
      rationale,
      evidenceHash: suggestion.materialChangeHash,
      reconsiderAfter: reconsiderAfterDate(new Date()),
    },
  });

  await prismaClient.graphLinkDecision.create({
    data: {
      id: createGraphDecisionId({ suggestionId, action: 'REJECT' }),
      suggestionId,
      action: 'REJECT',
      decidedBy: reviewerId,
      rationale,
    },
  });

  await prismaClient.graphLinkSuggestion.update({
    where: { id: suggestionId },
    data: {
      state: 'REJECTED',
      decidedAt: new Date(),
    },
  });

  await invalidateGraphSnapshots(prismaClient, {
    reason: 'ai_link_reject',
    graphModes: graphModesForSuggestion('blended'),
    focusNodeIds: [suggestion.sourceNodeId, suggestion.targetNodeId],
    invalidateGlobal: true,
    metadata: {
      suggestionId,
      rejectMemoryId,
    },
  });
  await recordSuggestionOutcome({
    suggestionType: 'GRAPH_LINK',
    suggestionKey: suggestion.suggestionKey,
    subjectType: 'GRAPH_NODE',
    subjectId: suggestion.sourceNodeId,
    accepted: false,
    confidence: suggestion.confidence,
    feedbackSource: 'GRAPH_REVIEW',
    graphSuggestionId: suggestionId,
    sourceNodeId: suggestion.sourceNodeId,
    targetNodeId: suggestion.targetNodeId,
    outcomeScore: 0,
    rationale,
    metadata: {
      rejectMemoryId,
      semanticEdgeType: suggestion.edgeType,
      reviewerId,
      outcome: 'REJECTED',
    },
    createdAt: new Date(),
  }, prismaClient);
  return rejectMemoryId;
}

async function ignoreSuggestion(
  suggestionId: string,
  reviewerId: string | null,
  rationale: string | null,
  prismaClient: PrismaClient,
): Promise<void> {
  await prismaClient.graphLinkDecision.create({
    data: {
      id: createGraphDecisionId({ suggestionId, action: 'IGNORE' }),
      suggestionId,
      action: 'IGNORE',
      decidedBy: reviewerId,
      rationale,
    },
  });

  await prismaClient.graphLinkSuggestion.update({
    where: { id: suggestionId },
    data: {
      state: 'IGNORED',
      decidedAt: new Date(),
    },
  });

  const suggestion = await prismaClient.graphLinkSuggestion.findUnique({
    where: { id: suggestionId },
    select: {
      suggestionKey: true,
      sourceNodeId: true,
      targetNodeId: true,
      confidence: true,
      edgeType: true,
    },
  });
  if (suggestion) {
    await invalidateGraphSnapshots(prismaClient, {
      reason: 'ai_link_ignore',
      graphModes: graphModesForSuggestion('blended'),
      focusNodeIds: [suggestion.sourceNodeId, suggestion.targetNodeId],
      invalidateGlobal: true,
      metadata: {
        suggestionId,
      },
    });
    await recordSuggestionOutcome({
      suggestionType: 'GRAPH_LINK',
      suggestionKey: suggestion.suggestionKey,
      subjectType: 'GRAPH_NODE',
      subjectId: suggestion.sourceNodeId,
      accepted: false,
      confidence: suggestion.confidence,
      feedbackSource: 'GRAPH_REVIEW',
      graphSuggestionId: suggestionId,
      sourceNodeId: suggestion.sourceNodeId,
      targetNodeId: suggestion.targetNodeId,
      outcomeScore: 0,
      rationale,
      metadata: {
        semanticEdgeType: suggestion.edgeType,
        reviewerId,
        outcome: 'IGNORED',
      },
      createdAt: new Date(),
    }, prismaClient);
  }
}

export async function applySuggestionDecisions(
  input: SuggestionDecisionInput,
  prismaClient: PrismaClient = prisma,
): Promise<SuggestionDecisionResult> {
  const where: Record<string, unknown> = {
    state: 'PENDING',
  };
  if (input.suggestionIds && input.suggestionIds.length > 0) {
    where.id = { in: input.suggestionIds };
  }
  if (input.batchId) {
    where.batchId = input.batchId;
  }
  if (typeof input.threshold === 'number') {
    if (input.action === 'accept') {
      where.confidence = { gte: input.threshold };
    } else if (input.action === 'reject') {
      where.confidence = { lte: input.threshold };
    }
  }

  const suggestions = await prismaClient.graphLinkSuggestion.findMany({ where });
  const edgeIds: string[] = [];
  const rejectMemoryIds: string[] = [];

  for (const suggestion of suggestions) {
    if (input.action === 'accept') {
      edgeIds.push(...await materializeAcceptedSuggestion(
        suggestion.id,
        input.reviewerId ?? null,
        input.rationale ?? null,
        prismaClient,
      ));
    } else if (input.action === 'reject') {
      rejectMemoryIds.push(await rejectSuggestion(
        suggestion.id,
        input.reviewerId ?? null,
        input.rationale ?? null,
        prismaClient,
      ));
    } else {
      await ignoreSuggestion(
        suggestion.id,
        input.reviewerId ?? null,
        input.rationale ?? null,
        prismaClient,
      );
    }
  }

  return {
    action: input.action,
    matched: suggestions.length,
    decided: suggestions.length,
    edgeIds,
    rejectMemoryIds,
  };
}

export async function processQueuedSuggestionBatches(
  prismaClient: PrismaClient = prisma,
): Promise<GraphSuggestionBatchResult[]> {
  const queued = await prismaClient.graphSuggestionBatch.findMany({
    where: { status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  const results: GraphSuggestionBatchResult[] = [];
  for (const batch of queued) {
    const claim = await prismaClient.graphSuggestionBatch.updateMany({
      where: {
        id: batch.id,
        status: 'QUEUED',
      },
      data: {
        status: 'RUNNING',
      },
    });
    if (claim.count === 0) continue;

    results.push(await generateGraphLinkSuggestions({
      batchId: batch.id,
      graphMode: batch.graphMode as GraphLayer,
      targetNodeId: batch.targetNodeId ?? null,
      maxSuggestionsPerNode: batch.maxSuggestionsPerNode,
      minConfidence: batch.minConfidence,
      applyThreshold: batch.applyThreshold,
    }, prismaClient));
  }
  return results;
}

export async function rejectGraphEdge(
  input: {
    edgeId?: string;
    sourceNodeId?: string;
    targetNodeId?: string;
    edgeType?: string;
    reviewerId?: string | null;
    rationale?: string | null;
  },
  prismaClient: PrismaClient = prisma,
): Promise<{ edgeId: string | null; rejectMemoryId: string }> {
  const edge = input.edgeId
    ? await prismaClient.graphEdge.findUnique({ where: { id: input.edgeId } })
    : await prismaClient.graphEdge.findFirst({
        where: {
          sourceNodeId: input.sourceNodeId,
          targetNodeId: input.targetNodeId,
          edgeType: input.edgeType,
        },
      });

  if (!edge) {
    throw new Error('Graph edge not found for rejection');
  }

  const rejectMemoryId = createGraphRejectMemoryId({
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    edgeType: edge.edgeType,
  });
  const pairKey = createGraphRejectMemoryPairKey({
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    edgeType: edge.edgeType,
  });

  await prismaClient.graphEdge.update({
    where: { id: edge.id },
    data: {
      status: 'REJECTED',
    },
  });

  if (edge.reverseEdgeId) {
    await prismaClient.graphEdge.update({
      where: { id: edge.reverseEdgeId },
      data: {
        status: 'REJECTED',
      },
    });
  }

  await prismaClient.graphRejectMemory.upsert({
    where: { pairKey },
    update: {
      reviewerId: input.reviewerId ?? null,
      rationale: input.rationale ?? null,
      evidenceHash: edge.materialHash ?? sha256ForPayload({ edgeId: edge.id }),
      reconsiderAfter: reconsiderAfterDate(new Date()),
      lastRejectedAt: new Date(),
    },
    create: {
      id: rejectMemoryId,
      pairKey,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      edgeType: edge.edgeType,
      reviewerId: input.reviewerId ?? null,
      rationale: input.rationale ?? null,
      evidenceHash: edge.materialHash ?? sha256ForPayload({ edgeId: edge.id }),
      reconsiderAfter: reconsiderAfterDate(new Date()),
    },
  });

  await invalidateGraphSnapshots(prismaClient, {
    reason: 'graph_edge_reject',
    graphModes: graphModesForSuggestion('blended'),
    focusNodeIds: [edge.sourceNodeId, edge.targetNodeId],
    invalidateGlobal: true,
    metadata: {
      edgeId: edge.id,
      rejectMemoryId,
    },
  });

  return {
    edgeId: edge.id,
    rejectMemoryId,
  };
}
