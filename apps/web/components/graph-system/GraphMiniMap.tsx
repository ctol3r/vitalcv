'use client';

import { colorForNodeType } from '@/components/graph/graphPalette';
import type { GraphLayoutSnapshot } from './GraphCanvas';

interface GraphMiniMapProps {
  snapshot: GraphLayoutSnapshot | null;
  className?: string;
}

function clampToRange(value: number, fallback = 0.5): number {
  return Number.isFinite(value) ? value : fallback;
}

export function GraphMiniMap({ snapshot, className }: GraphMiniMapProps) {
  if (!snapshot || snapshot.nodes.length === 0) {
    return null;
  }

  const width = 180;
  const height = 124;
  const padding = 10;
  const rangeX = Math.max(1, snapshot.bounds.maxX - snapshot.bounds.minX);
  const rangeY = Math.max(1, snapshot.bounds.maxY - snapshot.bounds.minY);
  const scale = Math.min(
    (width - (padding * 2)) / rangeX,
    (height - (padding * 2)) / rangeY,
  );

  const projectX = (x: number) => padding + ((x - snapshot.bounds.minX) * scale);
  const projectY = (y: number) => padding + ((y - snapshot.bounds.minY) * scale);

  const viewportWidth = clampToRange(width / Math.max(snapshot.viewport.zoom, 0.35), width);
  const viewportHeight = clampToRange(height / Math.max(snapshot.viewport.zoom, 0.35), height);
  const viewportCenterX = width / 2 - (snapshot.viewport.x * scale);
  const viewportCenterY = height / 2 - (snapshot.viewport.y * scale);

  return (
    <div className={className}>
      <svg
        aria-label="Graph minimap"
        className="h-full w-full"
        viewBox={`0 0 ${width} ${height}`}
      >
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx="16"
          fill="rgba(10, 16, 29, 0.92)"
          stroke="rgba(148, 163, 184, 0.18)"
        />

        {snapshot.nodes.map((node) => (
          <circle
            key={node.id}
            cx={projectX(node.x)}
            cy={projectY(node.y)}
            r={node.highlighted ? 3 : 2.1}
            fill={colorForNodeType(node.type)}
            fillOpacity={node.highlighted ? 0.9 : 0.55}
          />
        ))}

        <rect
          x={Math.max(2, viewportCenterX - (viewportWidth / 2))}
          y={Math.max(2, viewportCenterY - (viewportHeight / 2))}
          width={Math.min(width - 4, viewportWidth)}
          height={Math.min(height - 4, viewportHeight)}
          rx="12"
          fill="rgba(56, 189, 248, 0.05)"
          stroke="rgba(56, 189, 248, 0.8)"
          strokeWidth="1.1"
        />
      </svg>
    </div>
  );
}
