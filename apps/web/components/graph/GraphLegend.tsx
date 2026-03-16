'use client';

import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import {
  classifyEdgeType,
  formatGraphNodeType,
  GRAPH_COLOR_MODE_LABELS,
  GRAPH_LINK_CLASS_LABELS,
  GRAPH_LINK_CLASS_ORDER,
  type GraphColorMode,
} from '@/components/graph/state/graphDisplayState';
import {
  colorForNodeType,
  LINK_CLASS_STYLES,
} from '@/components/graph/graphPalette';
import { GraphLegend as VdsGraphLegend } from '@/src/ui/components';

interface GraphLegendProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  colorMode: GraphColorMode;
  maxNodeTypes?: number;
}

export function GraphLegend({
  nodes,
  edges,
  colorMode,
  maxNodeTypes = 8,
}: GraphLegendProps) {
  const nodeCounts = new Map<string, number>();
  const edgeClassCounts = new Map<string, number>();

  for (const node of nodes) {
    nodeCounts.set(node.type, (nodeCounts.get(node.type) ?? 0) + 1);
  }

  for (const edge of edges) {
    const edgeClass = classifyEdgeType(edge);
    edgeClassCounts.set(edgeClass, (edgeClassCounts.get(edgeClass) ?? 0) + 1);
  }

  return (
    <VdsGraphLegend
      description={`Active color mode: ${GRAPH_COLOR_MODE_LABELS[colorMode]}.`}
      sections={[
        {
          id: 'nodes',
          label: 'Node types',
          items: [...nodeCounts.entries()].slice(0, maxNodeTypes).map(([nodeType, count]) => ({
            id: nodeType,
            label: formatGraphNodeType(nodeType as GraphNode['type']),
            detail: `${count} nodes`,
            color: colorForNodeType(nodeType as GraphNode['type']),
          })),
        },
        {
          id: 'edges',
          label: 'Link classes',
          items: GRAPH_LINK_CLASS_ORDER.map((linkClass) => ({
            id: linkClass,
            label: GRAPH_LINK_CLASS_LABELS[linkClass],
            detail: `${edgeClassCounts.get(linkClass) ?? 0} visible edges`,
            color: LINK_CLASS_STYLES[linkClass].stroke,
            line: true,
          })),
        },
      ]}
      title="Rendering semantics"
    />
  );
}
