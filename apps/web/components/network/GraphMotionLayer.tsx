'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { GraphEdge, GraphNode } from '../graph/TrustGraphPrimary';

// Duck-typing the SimNode from TrustGraphPrimary since it's not exported
export interface MotionSimNode extends GraphNode {
  x: number;
  y: number;
}

interface GraphMotionLayerProps {
  edges: GraphEdge[];
  nodeMap: Map<string, MotionSimNode>;
  hoveredId: string | null;
  ready: boolean;
}

export function GraphMotionLayer({ edges, nodeMap, hoveredId, ready }: GraphMotionLayerProps) {
  // Generate random delays for packet animation so they don't all span at once
  const packetDelays = useMemo(() => {
    return edges.map(() => ({
      delay: Math.random() * 2,
      duration: 1.5 + Math.random(),
    }));
  }, [edges]);

  if (!ready) return null;

  return (
    <g className="graph-motion-layer">
      {edges.map((edge, i) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return null;

        const isHoveredNode = hoveredId === edge.source || hoveredId === edge.target;
        const isDimmed = hoveredId !== null && !isHoveredNode;

        // Relationship highlight
        const strokeColor = isHoveredNode ? 'var(--infra-blue)' : 'var(--infra-grid)';
        const strokeWidth = isHoveredNode ? 1.5 : 1;
        const opacity = isDimmed ? 0.15 : isHoveredNode ? 0.8 : 0.5;

        // Packet propagation logic:
        const { delay, duration } = packetDelays[i];
        const packetColor = isHoveredNode ? 'var(--infra-blue)' : 'var(--infra-grid)';

        return (
          <g key={`${edge.source}-${edge.target}-${i}`}>
            <motion.line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeOpacity={opacity}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: i * 0.05 }}
            />
            {/* Packet propagation animation */}
            {!isDimmed && (
              <motion.circle
                r={isHoveredNode ? 2.5 : 1.5}
                fill={packetColor}
                opacity={isHoveredNode ? 0.9 : 0.5}
                initial={{ cx: source.x, cy: source.y, opacity: 0 }}
                animate={{
                  cx: [source.x, target.x],
                  cy: [source.y, target.y],
                  opacity: [0, isHoveredNode ? 0.9 : 0.5, 0],
                }}
                transition={{
                  duration,
                  repeat: Infinity,
                  ease: 'linear',
                  delay,
                  times: [0, 0.5, 1],
                }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}
