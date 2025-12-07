'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowRight, Info, TrendingUp } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import styles from './PathDiagram.module.css';

export type CausalNodeType = 'root-cause' | 'intermediate' | 'event' | 'remediation';

export interface CausalNode {
  id: string;
  label: string;
  type: CausalNodeType;
  description?: string;
  confidence?: 'high' | 'medium' | 'low';
  evidence?: Array<{ type: string; label: string; timestamp?: string }>;
  metadata?: Record<string, unknown>;
}

export interface CausalEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  strength?: 'strong' | 'moderate' | 'weak';
  evidence?: Array<{ type: string; label: string }>;
}

export interface CausalPath {
  nodes: CausalNode[];
  edges: CausalEdge[];
  rootCauseId: string;
  eventId: string;
}

export interface PathDiagramProps {
  path: CausalPath;
  selectedNodeId?: string | null;
  onNodeSelect?: (node: CausalNode | null) => void;
  onNodeHover?: (node: CausalNode | null) => void;
  className?: string;
}

const NODE_COLORS: Record<CausalNodeType, { fill: string; stroke: string; text: string }> = {
  'root-cause': {
    fill: '#fef3c7', // amber-100
    stroke: '#f59e0b', // amber-500
    text: '#78350f', // amber-900
  },
  intermediate: {
    fill: '#e0e7ff', // indigo-100
    stroke: '#6366f1', // indigo-500
    text: '#312e81', // indigo-900
  },
  event: {
    fill: '#fee2e2', // red-100
    stroke: '#ef4444', // red-500
    text: '#7f1d1d', // red-900
  },
  remediation: {
    fill: '#d1fae5', // emerald-100
    stroke: '#10b981', // emerald-500
    text: '#064e3b', // emerald-900
  },
};

const CONFIDENCE_COLORS: Record<'high' | 'medium' | 'low', string> = {
  high: '#10b981', // emerald-500
  medium: '#f59e0b', // amber-500
  low: '#ef4444', // red-500
};

const STRENGTH_COLORS: Record<'strong' | 'moderate' | 'weak', { color: string; width: number }> = {
  strong: { color: '#3b82f6', width: 3 },
  moderate: { color: '#60a5fa', width: 2 },
  weak: { color: '#93c5fd', width: 1.5 },
};

export function PathDiagram({
  path,
  selectedNodeId,
  onNodeSelect,
  onNodeHover,
  className,
}: PathDiagramProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const layout = useMemo(() => computeLayout(path), [path]);

  const handleNodeHover = useCallback(
    (nodeId: string | null) => {
      setHoveredNodeId(nodeId);
      if (onNodeHover) {
        const node = nodeId ? path.nodes.find((n) => n.id === nodeId) ?? null : null;
        onNodeHover(node);
      }
    },
    [onNodeHover, path.nodes],
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (onNodeSelect) {
        const node = path.nodes.find((n) => n.id === nodeId) ?? null;
        onNodeSelect(node);
      }
    },
    [onNodeSelect, path.nodes],
  );

  const hoveredNode = hoveredNodeId ? path.nodes.find((n) => n.id === hoveredNodeId) : null;
  const hoveredEdge = hoveredEdgeId ? path.edges.find((e) => e.id === hoveredEdgeId) : null;

  const width = 900;
  const height = 500;
  const viewBox = `0 0 ${width} ${height}`;

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
            Causal Path Diagram
          </CardTitle>
          <CardDescription>
            Interactive visualization of the causal chain from root cause to event. Hover over nodes
            or edges for details and evidence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.diagramContainer}>
            <svg
              role="img"
              aria-label="Causal path diagram"
              viewBox={viewBox}
              className={cn('w-full', styles.svgContainer)}
            >
              <defs>
                <marker
                  id="causal-arrow"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,6 L8,3 z" fill="#64748b" />
                </marker>
              </defs>

              {/* Render edges */}
              {path.edges.map((edge) => {
                const sourcePos = layout.positions.get(edge.source);
                const targetPos = layout.positions.get(edge.target);
                if (!sourcePos || !targetPos) return null;

                const isHovered = hoveredEdgeId === edge.id;
                const strength = edge.strength ?? 'moderate';

                return (
                  <g key={edge.id}>
                    <line
                      x1={sourcePos.x + layout.nodeWidth / 2}
                      y1={sourcePos.y + layout.nodeHeight / 2}
                      x2={targetPos.x - layout.nodeWidth / 2}
                      y2={targetPos.y + layout.nodeHeight / 2}
                      markerEnd="url(#causal-arrow)"
                      className={cn('cursor-pointer', styles.edgeLine)}
                      data-strength={strength}
                      data-hovered={isHovered}
                      onMouseEnter={() => setHoveredEdgeId(edge.id)}
                      onMouseLeave={() => setHoveredEdgeId(null)}
                    />
                    {edge.label && (
                      <text
                        x={(sourcePos.x + targetPos.x) / 2}
                        y={(sourcePos.y + targetPos.y) / 2 - 10}
                        textAnchor="middle"
                        className="fill-slate-600 text-xs font-medium"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Render nodes */}
              {path.nodes.map((node) => {
                const position = layout.positions.get(node.id);
                if (!position) return null;

                const isHovered = hoveredNodeId === node.id;
                const isSelected = selectedNodeId === node.id;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${position.x}, ${position.y})`}
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => handleNodeHover(node.id)}
                    onMouseLeave={() => handleNodeHover(null)}
                    onClick={() => handleNodeClick(node.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.type} node: ${node.label}`}
                  >
                    <rect
                      width={layout.nodeWidth}
                      height={layout.nodeHeight}
                      rx={12}
                      ry={12}
                      className={styles.nodeRect}
                      data-node-type={node.type}
                      data-selected={isSelected}
                      data-hovered={isHovered}
                    />
                    {node.confidence && (
                      <circle
                        cx={layout.nodeWidth - 12}
                        cy={12}
                        r={6}
                        className={styles.confidenceCircle}
                        data-confidence={node.confidence}
                      />
                    )}
                    <text
                      x={layout.nodeWidth / 2}
                      y={layout.nodeHeight / 2 - 6}
                      textAnchor="middle"
                      className={cn(styles.nodeLabelText, styles.nodeText)}
                      data-node-type={node.type}
                    >
                      {node.label}
                    </text>
                    {node.description && (
                      <text
                        x={layout.nodeWidth / 2}
                        y={layout.nodeHeight / 2 + 12}
                        textAnchor="middle"
                        className="fill-slate-600 text-[10px]"
                      >
                        {node.description.slice(0, 30)}
                        {node.description.length > 30 ? '...' : ''}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Hover tooltip */}
          {(hoveredNode || hoveredEdge) && (
            <div className="mt-4 rounded-lg border bg-card p-4 shadow-lg">
              {hoveredNode && (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-lg">{hoveredNode.label}</h3>
                      <Badge variant="outline" className="mt-1">
                        {hoveredNode.type.replace('-', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    {hoveredNode.confidence && (
                      <Badge
                        variant="outline"
                        className={cn(
                          hoveredNode.confidence === 'high'
                            ? 'border-emerald-300 text-emerald-700'
                            : hoveredNode.confidence === 'medium'
                            ? 'border-amber-300 text-amber-700'
                            : 'border-rose-300 text-rose-700',
                        )}
                      >
                        {hoveredNode.confidence.toUpperCase()} CONFIDENCE
                      </Badge>
                    )}
                  </div>
                  {hoveredNode.description && (
                    <p className="text-sm text-muted-foreground">{hoveredNode.description}</p>
                  )}
                  {hoveredNode.evidence && hoveredNode.evidence.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                        Evidence
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {hoveredNode.evidence.map((ev, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            <Info className="mr-1 h-3 w-3" aria-hidden="true" />
                            {ev.type}: {ev.label}
                            {ev.timestamp && (
                              <span className="ml-1 text-muted-foreground">
                                ({new Date(ev.timestamp).toLocaleDateString()})
                              </span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {hoveredEdge && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h3 className="font-semibold">Causal Link</h3>
                    {hoveredEdge.strength && (
                      <Badge variant="outline" className="ml-auto">
                        {hoveredEdge.strength.toUpperCase()} STRENGTH
                      </Badge>
                    )}
                  </div>
                  {hoveredEdge.label && (
                    <p className="text-sm text-muted-foreground">{hoveredEdge.label}</p>
                  )}
                  {hoveredEdge.evidence && hoveredEdge.evidence.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                        Supporting Evidence
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {hoveredEdge.evidence.map((ev, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {ev.type}: {ev.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!hoveredNode && !hoveredEdge && (
            <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              <Info className="mx-auto h-5 w-5 mb-2" aria-hidden="true" />
              Hover over nodes or edges to view details and evidence
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className={styles.legendContainer}>
        <div>
          <p className="mb-2 font-semibold uppercase tracking-wide text-muted-foreground">
            Node Types
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(NODE_COLORS).map(([type, colors]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className={cn('h-4 w-4 rounded border-2', styles.legendNodeIndicator)}
                  data-node-type={type}
                />
                <span className="text-muted-foreground">{type.replace('-', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-semibold uppercase tracking-wide text-muted-foreground">
            Edge Strength
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(STRENGTH_COLORS).map(([strength, edgeStyle]) => (
              <div key={strength} className="flex items-center gap-2">
                <div
                  className={cn('w-8', styles.legendEdgeIndicator)}
                  data-edge-strength={strength}
                />
                <span className="text-muted-foreground">{strength}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function computeLayout(path: CausalPath) {
  const nodeWidth = 160;
  const nodeHeight = 80;
  const width = 900;
  const height = 500;
  const positions = new Map<string, { x: number; y: number }>();

  // Build adjacency list to determine depth
  const adjacency = new Map<string, string[]>();
  path.edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)!.push(edge.target);
  });

  // Calculate depth for each node using BFS from root cause
  const depth = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [{ id: path.rootCauseId, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, depth: d } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    depth.set(id, d);

    const neighbors = adjacency.get(id) ?? [];
    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        queue.push({ id: neighbor, depth: d + 1 });
      }
    });
  }

  // Set depth for any nodes not reached (shouldn't happen, but safety)
  path.nodes.forEach((node) => {
    if (!depth.has(node.id)) {
      depth.set(node.id, 0);
    }
  });

  // Find max depth
  const maxDepth = Math.max(...Array.from(depth.values()));

  // Layout nodes by depth
  const nodesByDepth = new Map<number, CausalNode[]>();
  path.nodes.forEach((node) => {
    const d = depth.get(node.id) ?? 0;
    if (!nodesByDepth.has(d)) {
      nodesByDepth.set(d, []);
    }
    nodesByDepth.get(d)!.push(node);
  });

  // Position nodes
  const padding = 80;
  const availableWidth = width - 2 * padding;
  const availableHeight = height - 2 * padding;

  nodesByDepth.forEach((nodes, d) => {
    const x = padding + (d / Math.max(maxDepth, 1)) * availableWidth;
    const spacing = availableHeight / (nodes.length + 1);
    nodes.forEach((node, idx) => {
      const y = padding + spacing * (idx + 1);
      positions.set(node.id, { x, y });
    });
  });

  return { positions, nodeWidth, nodeHeight };
}
