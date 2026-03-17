'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  InvestigationEdgeKind,
  InvestigationNodeKind,
} from '@/components/graph-system/types';
import {
  errorMessageFromPayload,
  type UseIntelligenceResourceResult,
} from './useIntelligenceResource';
import {
  normalizeInvestigationGraphPayload,
  summarizeGraph,
  type InvestigationGraphResponse,
} from '@/lib/intelligence/contracts';

export interface UseInvestigationGraphOptions {
  npi?: string | null;
  providerId?: string | null;
  findingId?: string | null;
  storylineId?: string | null;
  focusNodeId?: string | null;
  sourceNodeId?: string | null;
  targetNodeId?: string | null;
  entityTypes?: InvestigationNodeKind[];
  relationshipTypes?: InvestigationEdgeKind[];
  dateFrom?: string | null;
  dateTo?: string | null;
  onlyFlagged?: boolean;
  onlyStorylineRelated?: boolean;
  limit?: number;
  depth?: number;
  pollIntervalMs?: number;
  paused?: boolean;
}

export interface UseInvestigationGraphResult extends UseIntelligenceResourceResult<InvestigationGraphResponse> {
  expandNode: (nodeId: string) => Promise<void>;
  expandingNodeId: string | null;
  requestUrl: string;
}

function appendIfPresent(searchParams: URLSearchParams, key: string, value: string | null | undefined) {
  if (typeof value !== 'string') {
    return;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }

  searchParams.set(key, trimmed);
}

function appendList(searchParams: URLSearchParams, key: string, values: readonly string[] | undefined) {
  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      searchParams.append(key, trimmed);
    }
  }
}

function mergeInvestigationGraph(
  base: InvestigationGraphResponse | null,
  incoming: InvestigationGraphResponse,
  expandedFromNodeId?: string | null,
): InvestigationGraphResponse {
  if (!base) {
    return incoming;
  }

  const nodeMap = new Map(base.nodes.map((node) => [node.id, node]));
  for (const node of incoming.nodes) {
    const previous = nodeMap.get(node.id);
    nodeMap.set(node.id, previous ? { ...previous, ...node } : (
      expandedFromNodeId && node.id !== expandedFromNodeId
        ? {
          ...node,
          metadata: {
            ...node.metadata,
            expandedFromNodeId,
          },
        }
        : node
    ));
  }

  const edgeMap = new Map(base.edges.map((edge) => [edge.id, edge]));
  for (const edge of incoming.edges) {
    const previous = edgeMap.get(edge.id);
    edgeMap.set(edge.id, previous ? { ...previous, ...edge } : edge);
  }

  const nodes = [...nodeMap.values()];
  const edges = [...edgeMap.values()];
  const stats = summarizeGraph(nodes, edges);

  return {
    ...base,
    ...incoming,
    nodes,
    edges,
    stats: {
      ...stats,
      flaggedNodes: nodes.filter((node) => node.flagged).length,
      evidenceEdges: edges.filter((edge) => edge.type === 'evidence_link').length,
      storylineEdges: edges.filter((edge) => edge.type === 'storyline_related').length,
    },
    highlights: {
      nodeIds: [...new Set([...(base.highlights.nodeIds ?? []), ...(incoming.highlights.nodeIds ?? [])])],
      edgeIds: [...new Set([...(base.highlights.edgeIds ?? []), ...(incoming.highlights.edgeIds ?? [])])],
    },
    paths: incoming.paths.shortestPath || incoming.paths.rankedPaths.length > 0
      ? incoming.paths
      : base.paths,
    semanticZoom: {
      overviewClusters: [...new Map(
        [...base.semanticZoom.overviewClusters, ...incoming.semanticZoom.overviewClusters].map((cluster) => [cluster.id, cluster]),
      ).values()],
      detailNodeCount: nodes.length,
      detailEdgeCount: edges.length,
    },
  };
}

function buildInvestigationGraphUrl(
  options: UseInvestigationGraphOptions,
  mode: 'base' | 'expand',
  expandNodeId?: string,
): string {
  const searchParams = new URLSearchParams();
  appendIfPresent(searchParams, 'npi', options.npi);
  appendIfPresent(searchParams, 'providerId', options.providerId);
  appendIfPresent(searchParams, 'findingId', options.findingId);
  appendIfPresent(searchParams, 'storylineId', options.storylineId);
  appendIfPresent(searchParams, 'focusNodeId', mode === 'expand' ? expandNodeId : options.focusNodeId);
  appendIfPresent(searchParams, 'sourceNodeId', options.sourceNodeId);
  appendIfPresent(searchParams, 'targetNodeId', options.targetNodeId);
  appendIfPresent(searchParams, 'dateFrom', options.dateFrom);
  appendIfPresent(searchParams, 'dateTo', options.dateTo);
  appendList(searchParams, 'entityType', options.entityTypes);
  appendList(searchParams, 'relationshipType', options.relationshipTypes);

  if (typeof options.onlyFlagged === 'boolean') {
    searchParams.set('onlyFlagged', String(options.onlyFlagged));
  }

  if (typeof options.onlyStorylineRelated === 'boolean') {
    searchParams.set('onlyStorylineRelated', String(options.onlyStorylineRelated));
  }

  if (typeof options.limit === 'number') {
    searchParams.set('limit', String(options.limit));
  }

  if (typeof options.depth === 'number') {
    searchParams.set('depth', String(options.depth));
  }

  if (mode === 'expand' && expandNodeId) {
    searchParams.set('nodeId', expandNodeId);
  }

  const query = searchParams.toString();
  const basePath = mode === 'expand'
    ? '/api/intelligence/graph/investigation/expand'
    : '/api/intelligence/graph/investigation';

  return query.length > 0 ? `${basePath}?${query}` : basePath;
}

export function useInvestigationGraph(options: UseInvestigationGraphOptions): UseInvestigationGraphResult {
  const requestUrl = useMemo(
    () => buildInvestigationGraphUrl(options, 'base'),
    [
      options.dateFrom,
      options.dateTo,
      options.depth,
      options.entityTypes,
      options.findingId,
      options.focusNodeId,
      options.limit,
      options.npi,
      options.onlyFlagged,
      options.onlyStorylineRelated,
      options.paused,
      options.providerId,
      options.relationshipTypes,
      options.sourceNodeId,
      options.storylineId,
      options.targetNodeId,
    ],
  );
  const [data, setData] = useState<InvestigationGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchGraph = useCallback(async (url: string, preserveExisting: boolean) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(!preserveExisting);
    setRecovering(preserveExisting);
    if (!preserveExisting) {
      setData(null);
    }

    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error(errorMessageFromPayload(payload, response.status));
      }

      const normalized = normalizeInvestigationGraphPayload(payload);
      setData((current) => preserveExisting ? mergeInvestigationGraph(current, normalized) : normalized);
      setError(null);
      setLastUpdated(new Date().toISOString());
    } catch (requestError) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(requestError instanceof Error ? requestError.message : 'Graph request failed.');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRecovering(false);
      }
    }
  }, []);

  useEffect(() => {
    if (options.paused) {
      return;
    }

    void fetchGraph(requestUrl, false);
  }, [fetchGraph, options.paused, requestUrl]);

  useEffect(() => {
    if (options.paused || !options.pollIntervalMs || options.pollIntervalMs <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchGraph(requestUrl, true);
    }, options.pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [fetchGraph, options.paused, options.pollIntervalMs, requestUrl]);

  const expandNode = useCallback(async (nodeId: string) => {
    setExpandingNodeId(nodeId);
    try {
      const response = await fetch(buildInvestigationGraphUrl(options, 'expand', nodeId), {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessageFromPayload(payload, response.status));
      }

      const normalized = normalizeInvestigationGraphPayload(payload);
      setData((current) => mergeInvestigationGraph(current, normalized, nodeId));
      setError(null);
    } catch (expandError) {
      setError(expandError instanceof Error ? expandError.message : 'Failed to expand graph.');
    } finally {
      setExpandingNodeId(null);
    }
  }, [
    options.dateFrom,
    options.dateTo,
    options.depth,
    options.entityTypes,
    options.findingId,
    options.focusNodeId,
    options.limit,
    options.npi,
    options.onlyFlagged,
    options.onlyStorylineRelated,
    options.providerId,
    options.relationshipTypes,
    options.sourceNodeId,
    options.storylineId,
    options.targetNodeId,
  ]);

  return {
    data,
    loading,
    recovering,
    error,
    lastUpdated,
    refresh: () => {
      void fetchGraph(requestUrl, Boolean(data));
    },
    expandNode,
    expandingNodeId,
    requestUrl,
  };
}
