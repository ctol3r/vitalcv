'use client';

/**
 * MobileTrustGraph.tsx — Wave 56: Simplified Mobile Trust Graph
 *
 * Radial layout: clinician at center, outer nodes grouped by type.
 * Animated packet motion along edges to show trust flow.
 * Optimized for small screens — SVG-based, lightweight.
 */

import { useMemo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  group: string;
  status?: string;
  val: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

interface MobileTrustGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  size?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  clinician: '#228B22',
  issuer: '#4A90D9',
  credential: '#DAA520',
  employer: '#8B5CF6',
  policy: '#EC4899',
  decision: '#F97316',
};

// ── Layout ────────────────────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  label: string;
  group: string;
  x: number;
  y: number;
  radius: number;
  color: string;
}

function computeRadialLayout(
  nodes: GraphNode[],
  size: number,
): LayoutNode[] {
  const center = size / 2;
  const outerRadius = size * 0.36;
  const clinician = nodes.find((n) => n.group === 'clinician');
  const others = nodes.filter((n) => n.group !== 'clinician');

  const layout: LayoutNode[] = [];

  if (clinician) {
    layout.push({
      id: clinician.id,
      label: clinician.label.length > 12 ? clinician.label.slice(0, 10) + '…' : clinician.label,
      group: clinician.group,
      x: center,
      y: center,
      radius: 16,
      color: NODE_COLORS.clinician,
    });
  }

  others.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(others.length, 1) - Math.PI / 2;
    const r = outerRadius + (i % 2) * 20; // stagger slightly
    layout.push({
      id: node.id,
      label: node.label.length > 10 ? node.label.slice(0, 8) + '…' : node.label,
      group: node.group,
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
      radius: Math.max(node.val * 0.5, 6),
      color: NODE_COLORS[node.group] ?? '#888',
    });
  });

  return layout;
}

// ── Animated Packet ───────────────────────────────────────────────────────

function AnimatedPacket({
  x1, y1, x2, y2, delay, color,
}: {
  x1: number; y1: number; x2: number; y2: number; delay: number; color: string;
}) {
  return (
    <motion.circle
      r={2.5}
      fill={color}
      initial={{ cx: x1, cy: y1, opacity: 0 }}
      animate={{
        cx: [x1, x2],
        cy: [y1, y2],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        repeatDelay: 1 + delay,
        ease: 'easeInOut',
      }}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function MobileTrustGraph({
  nodes,
  edges,
  size = 280,
}: MobileTrustGraphProps) {
  const layout = useMemo(() => computeRadialLayout(nodes, size), [nodes, size]);
  const nodeMap = useMemo(
    () => new Map(layout.map((n) => [n.id, n])),
    [layout],
  );

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-xs mx-auto">
      {/* Edges */}
      {edges.map((edge, i) => {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) return null;
        return (
          <g key={`edge-${i}`}>
            <line
              x1={src.x} y1={src.y}
              x2={tgt.x} y2={tgt.y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            <AnimatedPacket
              x1={src.x} y1={src.y}
              x2={tgt.x} y2={tgt.y}
              delay={i * 0.3}
              color={src.color + '80'}
            />
          </g>
        );
      })}

      {/* Nodes */}
      {layout.map((node) => (
        <g key={node.id}>
          {/* Glow */}
          <circle
            cx={node.x} cy={node.y} r={node.radius * 2}
            fill={node.color} opacity={0.08}
          />
          {/* Node */}
          <motion.circle
            cx={node.x} cy={node.y} r={node.radius}
            fill={node.color}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          />
          {/* Label */}
          <text
            x={node.x}
            y={node.y + node.radius + 10}
            textAnchor="middle"
            fill="rgba(255,255,255,0.5)"
            fontSize="7"
            fontFamily="system-ui"
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default MobileTrustGraph;
