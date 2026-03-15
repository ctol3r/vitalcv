'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GraphEdge, GraphNode } from '@/components/graph-system/types';

interface UseGraphInteractionsOptions {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelectNode?: (id: string | null) => void | Promise<void>;
  onIsolateNode?: (id: string) => void | Promise<void>;
  onPinNode?: (id: string, x: number, y: number) => void | Promise<void>;
}

export function useGraphInteractions({
  nodes,
  edges,
  onSelectNode,
  onIsolateNode,
  onPinNode,
}: UseGraphInteractionsOptions) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const neighborsByNodeId = useMemo(() => {
    const neighbors = new Map<string, Set<string>>();

    for (const edge of edges) {
      const sourceNeighbors = neighbors.get(edge.source) ?? new Set<string>();
      sourceNeighbors.add(edge.target);
      neighbors.set(edge.source, sourceNeighbors);

      const targetNeighbors = neighbors.get(edge.target) ?? new Set<string>();
      targetNeighbors.add(edge.source);
      neighbors.set(edge.target, targetNeighbors);
    }

    return neighbors;
  }, [edges]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const stillVisible = nodes.some((node) => node.id === selectedNodeId);
    if (!stillVisible) {
      setSelectedNodeId(null);
      setInspectorOpen(false);
      void onSelectNode?.(null);
    }
  }, [nodes, onSelectNode, selectedNodeId]);

  const highlightRootId = hoveredNodeId ?? selectedNodeId;

  const highlightedNodeIds = useMemo(() => {
    if (!highlightRootId) {
      return new Set<string>();
    }

    const ids = new Set<string>([highlightRootId]);
    const neighbors = neighborsByNodeId.get(highlightRootId);

    if (neighbors) {
      for (const neighborId of neighbors) {
        ids.add(neighborId);
      }
    }

    return ids;
  }, [highlightRootId, neighborsByNodeId]);

  const highlightedEdgeIds = useMemo(() => {
    if (!highlightRootId) {
      return new Set<string>();
    }

    return new Set(
      edges
        .filter((edge) => edge.source === highlightRootId || edge.target === highlightRootId)
        .map((edge) => edge.id),
    );
  }, [edges, highlightRootId]);

  const handleNodeClick = useCallback(async (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setInspectorOpen(Boolean(nodeId));
    await onSelectNode?.(nodeId);
  }, [onSelectNode]);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  }, []);

  const handleNodeDoubleClick = useCallback(async (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setInspectorOpen(true);
    await onSelectNode?.(nodeId);
    await onIsolateNode?.(nodeId);
  }, [onIsolateNode, onSelectNode]);

  const handleNodePin = useCallback(async (nodeId: string, x: number, y: number) => {
    await onPinNode?.(nodeId, x, y);
  }, [onPinNode]);

  const closeInspector = useCallback(async () => {
    setInspectorOpen(false);
    setSelectedNodeId(null);
    await onSelectNode?.(null);
  }, [onSelectNode]);

  return {
    selectedNodeId,
    hoveredNodeId,
    inspectorOpen,
    highlightedNodeIds,
    highlightedEdgeIds,
    neighborsByNodeId,
    handleNodeClick,
    handleNodeHover,
    handleNodeDoubleClick,
    handleNodePin,
    closeInspector,
  };
}
