'use client';

import { Card } from '@blueprintjs/core';
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

interface GraphLegendProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  colorMode: GraphColorMode;
}

export function GraphLegend({ nodes, edges, colorMode }: GraphLegendProps) {
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
    <Card className="vital-panel vital-panel--dense">
      <div className="vital-panel__header">
        <div>
          <p className="vital-panel__eyebrow">Legend</p>
          <h2 className="vital-panel__title">Rendering semantics</h2>
        </div>
      </div>
      <p className="vital-panel__copy">
        Active color mode: {GRAPH_COLOR_MODE_LABELS[colorMode]}.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <div>
          <p className="vital-panel__eyebrow">Node types</p>
          <div className="vital-legend-list mt-2">
            {[...nodeCounts.entries()].slice(0, 8).map(([nodeType, count]) => (
              <div key={nodeType} className="vital-legend-item">
                <div className="flex items-center gap-3">
                  <span className="vital-swatch" style={{ backgroundColor: colorForNodeType(nodeType as GraphNode['type']) }} />
                  <div className="vital-legend-item__meta">
                    <span className="vital-legend-item__label">{formatGraphNodeType(nodeType as GraphNode['type'])}</span>
                    <span className="vital-legend-item__detail">{count} nodes</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="vital-panel__eyebrow">Link classes</p>
          <div className="vital-legend-list mt-2">
            {GRAPH_LINK_CLASS_ORDER.map((linkClass) => (
              <div key={linkClass} className="vital-legend-item">
                <div className="flex items-center gap-3">
                  <span
                    className="vital-swatch vital-swatch--line"
                    style={{ backgroundColor: LINK_CLASS_STYLES[linkClass].stroke }}
                  />
                  <div className="vital-legend-item__meta">
                    <span className="vital-legend-item__label">{GRAPH_LINK_CLASS_LABELS[linkClass]}</span>
                    <span className="vital-legend-item__detail">
                      {edgeClassCounts.get(linkClass) ?? 0} visible edges
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
