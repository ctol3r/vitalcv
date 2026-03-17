'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import {
  seedSimulationNodes,
  stepLayout,
  type SimulationNode,
} from '@/components/graph/physics/layoutEngine';
import type {
  GraphPhysicsState,
  GraphVisualState,
} from '@/components/graph/state/graphDisplayState';

interface UseGraphPhysicsOptions {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  physics: GraphPhysicsState;
  visuals: GraphVisualState;
  selectedNodeId: string | null;
  layoutVersion?: number;
}

const layoutCache = new Map<string, SimulationNode[]>();
const MAX_LAYOUT_CACHE_ENTRIES = 18;

function cloneSimulationNodes(nodes: SimulationNode[]): SimulationNode[] {
  return nodes.map((node) => ({ ...node }));
}

function rememberLayout(layoutKey: string, nodes: SimulationNode[]) {
  layoutCache.delete(layoutKey);
  layoutCache.set(layoutKey, cloneSimulationNodes(nodes));

  if (layoutCache.size <= MAX_LAYOUT_CACHE_ENTRIES) {
    return;
  }

  const oldestKey = layoutCache.keys().next().value;
  if (oldestKey) {
    layoutCache.delete(oldestKey);
  }
}

export function useGraphPhysics({
  nodes,
  edges,
  width,
  height,
  physics,
  visuals,
  selectedNodeId,
  layoutVersion = 0,
}: UseGraphPhysicsOptions) {
  const simNodesRef = useRef<SimulationNode[]>([]);
  const layoutKey = useMemo(() => {
    const nodeSignature = nodes.map((node) => node.id).join('|');
    const edgeSignature = edges.map((edge) => edge.id).join('|');
    return [
      width,
      height,
      visuals.nodeSize,
      physics.preset,
      layoutVersion,
      nodes.length,
      edges.length,
      nodeSignature,
      edgeSignature,
    ].join('::');
  }, [edges, height, layoutVersion, nodes, physics.preset, visuals.nodeSize, width]);

  useEffect(() => {
    const cachedLayout = layoutCache.get(layoutKey);

    simNodesRef.current = cachedLayout
      ? cloneSimulationNodes(cachedLayout)
      : seedSimulationNodes(nodes, width, height, visuals.nodeSize / 7);

    return () => {
      if (simNodesRef.current.length > 0) {
        rememberLayout(layoutKey, simNodesRef.current);
      }
    };
  }, [height, layoutKey, nodes, visuals.nodeSize, width]);

  const tick = useCallback(() => {
    if (!physics.frozen) {
      stepLayout({
        nodes: simNodesRef.current,
        edges,
        physics,
        width,
        height,
        selectedNodeId,
        nodeScale: visuals.nodeSize / 7,
      });
    }

    return simNodesRef.current;
  }, [edges, height, physics, selectedNodeId, visuals.nodeSize, width]);

  const updateNodePosition = useCallback((nodeId: string, x: number, y: number, pin = false) => {
    const node = simNodesRef.current.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return;
    }

    node.x = x;
    node.y = y;
    node.vx = 0;
    node.vy = 0;

    if (pin) {
      node.fx = x;
      node.fy = y;
    }
  }, []);

  const resetLayout = useCallback(() => {
    simNodesRef.current = seedSimulationNodes(
      nodes.map((node) => ({
        ...node,
        x: undefined,
        y: undefined,
        fx: null,
        fy: null,
      })),
      width,
      height,
      visuals.nodeSize / 7,
    );
    layoutCache.delete(layoutKey);
  }, [height, layoutKey, nodes, visuals.nodeSize, width]);

  return {
    simNodesRef,
    tick,
    updateNodePosition,
    resetLayout,
  };
}
