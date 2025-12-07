'use client';

import { useMemo } from 'react';
import {
  type PrivilegeNode,
  getPrerequisiteEdges,
} from '@/data/privileges';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<PrivilegeNode['category'], string> = {
  baseline: '#cbd5f5',
  core: '#bfdbfe',
  sedation: '#fde68a',
  imaging: '#a7f3d0',
  cardiology: '#fecaca',
  structural: '#fbcfe8',
  robotics: '#ddd6fe',
  pediatric: '#c7d2fe',
};

const CATEGORY_LABELS: Record<PrivilegeNode['category'], string> = {
  baseline: 'Baseline',
  core: 'Core Medicine',
  sedation: 'Sedation',
  imaging: 'Imaging',
  cardiology: 'Cardiology',
  structural: 'Structural Heart',
  robotics: 'Robotics',
  pediatric: 'Pediatric',
};

export interface PrivilegeGraphProps {
  nodes: PrivilegeNode[];
  selectedCode?: string | null;
  highlightedNodes?: Set<string>;
  dimUnselected?: boolean;
  onSelect?: (node: PrivilegeNode) => void;
  onHover?: (node: PrivilegeNode | null) => void;
}

export function PrivilegeGraph({
  nodes,
  selectedCode,
  highlightedNodes,
  dimUnselected,
  onSelect,
  onHover,
}: PrivilegeGraphProps) {
  const edges = useMemo(() => getPrerequisiteEdges(nodes), [nodes]);
  const layout = useMemo(() => computeLayout(nodes), [nodes]);
  const width = 860;
  const height = 420;

  const shouldDim = Boolean(dimUnselected && highlightedNodes && highlightedNodes.size > 0);

  return (
    <svg
      role="img"
      aria-label="Privilege dependency graph"
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-lg border bg-slate-950/90 p-4 text-white"
    >
      <defs>
        <marker
          id="priv-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const source = layout.positions.get(edge.source);
        const target = layout.positions.get(edge.target);
        if (!source || !target) return null;
        const edgeHighlighted = highlightedNodes?.has(edge.source) && highlightedNodes?.has(edge.target);

        return (
          <line
            key={edge.id}
            x1={source.x + layout.nodeWidth / 2}
            y1={source.y + layout.nodeHeight / 2}
            x2={target.x - layout.nodeWidth / 2}
            y2={target.y + layout.nodeHeight / 2}
            stroke={edgeHighlighted ? '#f472b6' : '#94a3b8'}
            strokeWidth={edgeHighlighted ? 3 : 2}
            strokeOpacity={edgeHighlighted ? 0.95 : shouldDim ? 0.25 : 0.6}
            markerEnd="url(#priv-arrow)"
          />
        );
      })}

      {nodes.map((node) => {
        const position = layout.positions.get(node.code);
        if (!position) return null;

        const isHighlighted = highlightedNodes?.has(node.code);
        const isSelected = selectedCode === node.code;
        const faded = shouldDim && !isHighlighted;

        const fillColor = CATEGORY_COLORS[node.category];
        const textColor = isSelected ? '#0f172a' : '#0f172a';

        return (
          <g
            key={node.code}
            transform={`translate(${position.x}, ${position.y})`}
            className={cn('cursor-pointer transition-all', {
              'opacity-40': faded,
              'drop-shadow-[0_0_8px_rgba(248,113,113,0.7)]': isSelected,
            })}
            onMouseEnter={() => onHover?.(node)}
            onMouseLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(node)}
            onBlur={() => onHover?.(null)}
            onClick={() => onSelect?.(node)}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
          >
            <rect
              width={layout.nodeWidth}
              height={layout.nodeHeight}
              rx={12}
              ry={12}
              fill={fillColor}
              stroke={isSelected ? '#ea580c' : isHighlighted ? '#f97316' : 'transparent'}
              strokeWidth={isSelected || isHighlighted ? 3 : 1}
            />
            <text
              x={layout.nodeWidth / 2}
              y={layout.nodeHeight / 2 - 4}
              textAnchor="middle"
              fill={textColor}
              className="text-xs font-semibold"
            >
              {node.code}
            </text>
            <text
              x={layout.nodeWidth / 2}
              y={layout.nodeHeight / 2 + 12}
              textAnchor="middle"
              fill="#475569"
              className="text-[10px]"
            >
              {CATEGORY_LABELS[node.category]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function PrivilegeGraphLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
        <div key={category} className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm border border-slate-300"
            style={{ backgroundColor: CATEGORY_COLORS[category as PrivilegeNode['category']] }}
          />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function computeLayout(nodes: PrivilegeNode[]) {
  const nodeWidth = 140;
  const nodeHeight = 56;
  const width = 860;
  const height = 420;
  const levels = Array.from(new Set(nodes.map((node) => node.level))).sort((a, b) => a - b);
  const positions = new Map<string, { x: number; y: number }>();
  const innerWidth = width - 160;
  const levelCount = Math.max(levels.length - 1, 1);

  levels.forEach((level, columnIndex) => {
    const nodesInLevel = nodes
      .filter((node) => node.level === level)
      .sort((a, b) => a.lane - b.lane || a.code.localeCompare(b.code));
    const spacing = height / (nodesInLevel.length + 1);
    nodesInLevel.forEach((node, index) => {
      const x = (columnIndex / levelCount) * innerWidth + 80 - nodeWidth / 2;
      const y = spacing * (index + 1) - nodeHeight / 2;
      positions.set(node.code, { x, y });
    });
  });

  return { positions, nodeWidth, nodeHeight };
}


