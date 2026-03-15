'use client';

import { useCallback, useEffect, useRef } from 'react';
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
}

export function useGraphPhysics({
  nodes,
  edges,
  width,
  height,
  physics,
  visuals,
  selectedNodeId,
}: UseGraphPhysicsOptions) {
  const simNodesRef = useRef<SimulationNode[]>([]);

  useEffect(() => {
    simNodesRef.current = seedSimulationNodes(nodes, width, height, visuals.nodeSize / 7);
  }, [height, nodes, visuals.nodeSize, width]);

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
  }, [height, nodes, visuals.nodeSize, width]);

  return {
    simNodesRef,
    tick,
    updateNodePosition,
    resetLayout,
  };
}
