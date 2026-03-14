'use client';

import { motion } from 'framer-motion';
import { GraphTokens } from '@/lib/design/graph-tokens';
import { NodeGroup } from './types';

interface TrustNodeProps {
  id: string;
  x: number;
  y: number;
  label: string;
  group: NodeGroup | string;
  val: number;
  isHovered: boolean;
  isDimmed: boolean;
  isExpanded?: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}

export function TrustNode({
  x,
  y,
  label,
  group,
  val,
  isHovered,
  isDimmed,
  isExpanded = false,
  onHover,
  onLeave,
  onClick
}: TrustNodeProps) {
  const isCenter = group === 'clinician';
  const fill = (GraphTokens.colors.node as any)[group] || '#475569';
  
  // Radius calculation using unified tokens
  let r = val;
  if (isCenter) r = GraphTokens.sizes.nodeRadius.center;
  else if (group === 'credential') r = GraphTokens.sizes.nodeRadius.credential;
  else if (group === 'employer' || group === 'issuer') r = GraphTokens.sizes.nodeRadius.group;

  const isActive = isHovered || isExpanded;
  const opacity = isDimmed ? 0.15 : 1;

  return (
    <motion.g
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{ cursor: 'pointer', opacity }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity }}
      whileHover={{ scale: 1.15, transition: GraphTokens.motion.spring.bouncy }}
      whileTap={{ scale: 0.95 }}
      transition={GraphTokens.motion.spring.gentle}
      className="transition-opacity duration-500"
    >
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={fill}
        filter={(isActive || isCenter) ? 'url(#glow)' : ''}
        stroke={isActive ? '#ffffff' : 'rgba(255,255,255,0.1)'}
        strokeWidth={isActive ? 2.5 : 1}
      />
      {/* Dynamic Label visibility based on interaction states */}
      {(isActive || isCenter) && (
        <motion.text
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          x={x}
          y={y + r + 18}
          textAnchor="middle"
          fill="#f8fafc"
          className={`${GraphTokens.typography.micro} pointer-events-none drop-shadow-lg`}
        >
          {label}
        </motion.text>
      )}
    </motion.g>
  );
}
