'use client';

import { motion } from 'framer-motion';
import { GraphTokens } from '@/lib/design/graph-tokens';
import { EdgeType } from './types';

interface TrustEdgeProps {
  source: { x: number; y: number };
  target: { x: number; y: number };
  type?: EdgeType | string;
  isHighlighted?: boolean;
  isDimmed?: boolean;
}

export function TrustEdge({
  source,
  target,
  type = 'ISSUED_BY',
  isHighlighted = false,
  isDimmed = false
}: TrustEdgeProps) {
  const edgeColor = (GraphTokens.colors.edge as any)[type] || GraphTokens.colors.edge.base;
  const strokeColor = isHighlighted ? GraphTokens.colors.edge.highlighted : edgeColor;
  const opacity = isDimmed ? 0.05 : (isHighlighted ? 1 : 0.4);
  
  // Choose dash array based on type
  let strokeDasharray = "none";
  if (type === 'VERIFIED_BY') strokeDasharray = "4 4";
  if (type === 'DEPENDS_ON') strokeDasharray = "2 4";
  if (type === 'ACCEPTED_BY') strokeDasharray = "6 2";

  return (
    <g className="transition-opacity duration-500" style={{ opacity }}>
      <motion.line
        x1={source.x}
        y1={source.y}
        x2={target.x}
        y2={target.y}
        stroke={strokeColor}
        strokeWidth={isHighlighted ? 2.5 : 1.5}
        strokeDasharray={strokeDasharray}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={GraphTokens.motion.tween.smooth}
      />
      {/* Packets for ISSUED_BY or VERIFIED_BY or DEPENDS_ON to show data flow */}
      {(type === 'ISSUED_BY' || type === 'VERIFIED_BY' || type === 'DEPENDS_ON') && !isDimmed && (
        <motion.circle
          r={isHighlighted ? "2.5" : "1.5"}
          fill={edgeColor}
          initial={{ cx: source.x, cy: source.y, opacity: 0 }}
          animate={{
            cx: [source.x, target.x],
            cy: [source.y, target.y],
            opacity: [0, 1, 1, 0],
          }}
          transition={GraphTokens.motion.tween.packet}
        />
      )}
    </g>
  );
}
