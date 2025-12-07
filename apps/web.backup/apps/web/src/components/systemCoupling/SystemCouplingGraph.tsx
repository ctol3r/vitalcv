'use client';

import { cn } from '@/lib/utils';
import { useMemo, useRef } from 'react';

interface GraphNode {
  id: string;
  label: string;
  color: string;
  loadScore: number;
  predictedStress: number;
  category: string;
}

interface GraphLink {
  source: string;
  target: string;
  strength: number;
  type: string;
}

interface SystemCouplingGraphProps {
  data: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  selectedNode?: string | null;
  hoveredNode?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onNodeHover?: (nodeId: string | null) => void;
}

export function SystemCouplingGraph({
  data,
  selectedNode,
  hoveredNode,
  onNodeSelect,
  onNodeHover,
}: SystemCouplingGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 800;
  const height = 600;

  // Simple force-directed layout simulation
  const layout = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    const nodeRadius = 40;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    // Arrange nodes in a circle
    data.nodes.forEach((node, index) => {
      const angle = (index / data.nodes.length) * 2 * Math.PI - Math.PI / 2;
      positions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    return { positions, nodeRadius };
  }, [data.nodes, width, height]);

  return (
    <div className="w-full overflow-auto rounded-lg border bg-slate-950/90 p-4">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="System coupling dependency graph"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Render links */}
        {data.links.map((link, idx) => {
          const sourcePos = layout.positions.get(link.source);
          const targetPos = layout.positions.get(link.target);
          if (!sourcePos || !targetPos) return null;

          const isHighlighted =
            (hoveredNode && (link.source === hoveredNode || link.target === hoveredNode)) ||
            (selectedNode && (link.source === selectedNode || link.target === selectedNode));

          const strokeWidth = Math.max(1, link.strength * 4);
          const opacity = isHighlighted ? 0.9 : 0.4;

          return (
            <line
              key={idx}
              x1={sourcePos.x}
              y1={sourcePos.y}
              x2={targetPos.x}
              y2={targetPos.y}
              stroke={isHighlighted ? '#f472b6' : '#94a3b8'}
              strokeWidth={strokeWidth}
              strokeOpacity={opacity}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* Render nodes */}
        {data.nodes.map((node) => {
          const position = layout.positions.get(node.id);
          if (!position) return null;

          const isSelected = selectedNode === node.id;
          const isHovered = hoveredNode === node.id;

          return (
            <g
              key={node.id}
              transform={`translate(${position.x}, ${position.y})`}
              className={cn('cursor-pointer transition-all', {
                'drop-shadow-[0_0_12px_rgba(248,113,113,0.8)]': isSelected,
                'drop-shadow-[0_0_8px_rgba(248,113,113,0.6)]': isHovered && !isSelected,
              })}
              onClick={() => onNodeSelect?.(isSelected ? null : node.id)}
              onMouseEnter={() => onNodeHover?.(node.id)}
              onMouseLeave={() => onNodeHover?.(null)}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected ? 'true' : 'false'}
            >
              <circle
                r={layout.nodeRadius}
                fill={node.color}
                stroke={isSelected ? '#f87171' : isHovered ? '#fb923c' : 'transparent'}
                strokeWidth={isSelected ? 4 : isHovered ? 3 : 0}
                opacity={isHovered || isSelected ? 1 : 0.9}
              />
              <text
                x={0}
                y={layout.nodeRadius + 20}
                textAnchor="middle"
                fill="white"
                className="text-xs font-semibold pointer-events-none"
              >
                {node.label}
              </text>
              <text
                x={0}
                y={layout.nodeRadius + 35}
                textAnchor="middle"
                fill="#94a3b8"
                className="text-[10px] pointer-events-none"
              >
                {(node.loadScore * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
