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
        const isRevoked = edge.type === 'revocation';
        const strokeColor = isRevoked ? 'var(--infra-red)' : isHoveredNode ? 'var(--infra-blue)' : 'var(--infra-grid)';
        const strokeWidth = isHoveredNode || isRevoked ? 1.5 : 1;
        const opacity = isDimmed ? 0.15 : (isHoveredNode || isRevoked) ? 0.8 : 0.5;

        // Packet propagation logic:
        const { delay, duration } = packetDelays[i];
        const packetColor = isRevoked ? 'var(--infra-red)' : isHoveredNode ? 'var(--infra-blue)' : 'var(--infra-grid)';
        const packetSize = isRevoked ? 3 : isHoveredNode ? 2.5 : 1.5;

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
              animate={isRevoked ? {
                pathLength: 1,
                strokeOpacity: [0.3, 0.8, 0.3], // Pulsing effect for revocation edge
                strokeWidth: [1, 2, 1]
              } : { pathLength: 1 }}
              transition={isRevoked ? {
                pathLength: { duration: 0.8, delay: i * 0.05 },
                strokeOpacity: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
                strokeWidth: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
              } : { duration: 0.8, delay: i * 0.05 }}
            />
            {/* Packet propagation animation */}
            {!isDimmed && (
              <motion.circle
                r={packetSize}
                fill={packetColor}
                opacity={isHoveredNode || isRevoked ? 0.9 : 0.5}
                style={isRevoked ? { filter: 'url(#node-glow)' } : undefined}
                initial={{ cx: source.x, cy: source.y, opacity: 0 }}
                animate={{
                  cx: [source.x, target.x],
                  cy: [source.y, target.y],
                  opacity: [0, isHoveredNode || isRevoked ? 0.9 : 0.5, 0],
                  scale: isRevoked ? [1, 1.5, 1] : 1
                }}
                transition={{
                  duration: isRevoked ? duration * 0.7 : duration, // revocation moves faster
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
