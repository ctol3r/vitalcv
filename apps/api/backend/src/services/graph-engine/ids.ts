import { randomUUID } from 'node:crypto';
import { sha256ForPayload, sha256Hex, stableStringify } from '../../utils/deterministic';
import type { GraphLayer } from './schema';

function compactHash(prefix: string, value: unknown): string {
  return `${prefix}_${sha256ForPayload(value).slice(0, 24)}`;
}

export function createGraphNodeCanonicalKey(input: {
  type: string;
  sourceKind: string;
  sourceId: string;
}): string {
  return stableStringify({
    type: input.type,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
  });
}

export function createGraphNodeId(input: {
  type: string;
  sourceKind: string;
  sourceId: string;
}): string {
  return compactHash('gn', createGraphNodeCanonicalKey(input));
}

export function createGraphEdgePairKey(input: {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  directed: boolean;
}): string {
  if (input.directed) {
    return stableStringify(input);
  }

  const sorted = [input.sourceNodeId, input.targetNodeId].sort();
  return stableStringify({
    edgeType: input.edgeType,
    directed: false,
    a: sorted[0],
    b: sorted[1],
  });
}

export function createGraphEdgeCanonicalKey(input: {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  directed: boolean;
  createdBy: string;
  materialHash?: string | null;
}): string {
  return stableStringify({
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    edgeType: input.edgeType,
    directed: input.directed,
    createdBy: input.createdBy,
    materialHash: input.materialHash ?? null,
  });
}

export function createGraphEdgeId(input: {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  directed: boolean;
  createdBy: string;
  materialHash?: string | null;
}): string {
  return compactHash('ge', createGraphEdgeCanonicalKey(input));
}

export function createReciprocalGraphEdgeId(input: {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  createdBy: string;
  materialHash?: string | null;
}): string {
  return createGraphEdgeId({
    sourceNodeId: input.targetNodeId,
    targetNodeId: input.sourceNodeId,
    edgeType: input.edgeType,
    directed: false,
    createdBy: input.createdBy,
    materialHash: input.materialHash,
  });
}

export function createGraphSnapshotQuerySignature(input: {
  scopeType: string;
  scopeKey: string;
  graphMode: GraphLayer;
  focusNodeId?: string | null;
  depth?: number | null;
  filterSignature: string;
  schemaVersion: string;
}): string {
  return sha256Hex(
    stableStringify({
      scopeType: input.scopeType,
      scopeKey: input.scopeKey,
      graphMode: input.graphMode,
      focusNodeId: input.focusNodeId ?? null,
      depth: input.depth ?? null,
      filterSignature: input.filterSignature,
      schemaVersion: input.schemaVersion,
    }),
  );
}

export function createGraphSnapshotId(input: {
  scopeType: string;
  scopeKey: string;
  graphMode: GraphLayer;
  focusNodeId?: string | null;
  depth?: number | null;
  filterSignature: string;
  schemaVersion: string;
}): string {
  return compactHash('gs', createGraphSnapshotQuerySignature(input));
}

export function createGraphPresetId(input: { ownerKey: string; name: string }): string {
  return compactHash('gp', input);
}

export function createGraphLayoutStateId(input: {
  ownerKey: string;
  scopeType: string;
  scopeKey: string;
  graphMode: string;
  filterSignature: string;
}): string {
  return compactHash('gl', input);
}

export function createGraphBuildRunId(input: {
  buildType: string;
  graphMode?: string | null;
  scopeKey?: string | null;
  targetNodeId?: string | null;
}): string {
  return `gbr_${sha256ForPayload({ ...input, nonce: randomUUID(), at: new Date().toISOString() }).slice(0, 24)}`;
}

export function createGraphBuildRequestFingerprint(input: {
  buildType: string;
  graphMode?: string | null;
  scopeKey?: string | null;
  targetNodeId?: string | null;
  invalidationReasons?: string[];
}): string {
  return compactHash('gbrq', {
    buildType: input.buildType,
    graphMode: input.graphMode ?? null,
    scopeKey: input.scopeKey ?? null,
    targetNodeId: input.targetNodeId ?? null,
    invalidationReasons: [...(input.invalidationReasons ?? [])].sort(),
  });
}

export function createGraphSuggestionBatchId(input: {
  graphMode: string;
  targetNodeId?: string | null;
  filterSignature: string;
}): string {
  return `gsb_${sha256ForPayload({ ...input, nonce: randomUUID(), at: new Date().toISOString() }).slice(0, 24)}`;
}

export function createGraphSuggestionBatchFingerprint(input: {
  graphMode: string;
  targetNodeId?: string | null;
  filterSignature: string;
  maxSuggestionsPerNode?: number;
  minConfidence?: number;
  applyThreshold?: number;
}): string {
  return compactHash('gsbf', {
    graphMode: input.graphMode,
    targetNodeId: input.targetNodeId ?? null,
    filterSignature: input.filterSignature,
    maxSuggestionsPerNode: input.maxSuggestionsPerNode ?? null,
    minConfidence: input.minConfidence ?? null,
    applyThreshold: input.applyThreshold ?? null,
  });
}

export function createGraphSuggestionKey(input: {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  directed: boolean;
}): string {
  return createGraphEdgePairKey(input);
}

export function createGraphSuggestionId(input: {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  directed: boolean;
  materialChangeHash: string;
}): string {
  return compactHash('gsg', input);
}

export function createGraphDecisionId(input: { suggestionId: string; action: string; nonce?: string }): string {
  return compactHash('gld', {
    suggestionId: input.suggestionId,
    action: input.action,
    nonce: input.nonce ?? randomUUID(),
  });
}

export function createGraphRejectMemoryPairKey(input: {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
}): string {
  const sorted = [input.sourceNodeId, input.targetNodeId].sort();
  return stableStringify({
    edgeType: input.edgeType,
    a: sorted[0],
    b: sorted[1],
  });
}

export function createGraphRejectMemoryId(input: {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
}): string {
  return compactHash('grm', createGraphRejectMemoryPairKey(input));
}

export function createGraphClusterAssignmentId(input: {
  nodeId: string;
  snapshotId?: string | null;
  clusterMode: string;
  clusterKey: string;
}): string {
  return compactHash('gca', input);
}

export function createReciprocalRuleId(edgeType: string): string {
  return compactHash('ger', { edgeType });
}
