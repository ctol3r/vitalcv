'use client';

/**
 * DemoGraphOverlay.tsx — Wave 60: Animated Demo Graph
 *
 * SVG-based graph that animates packets along edges as the demo
 * progresses: issuer → credential → decision → employer.
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

interface DemoNode {
  id: string;
  label: string;
  group: string;
}

interface DemoEdge {
  source: string;
  target: string;
  label: string;
}

interface DemoGraphOverlayProps {
  nodes: DemoNode[];
  edges: DemoEdge[];
  activeNodeIds: Set<string>;
  activeEdgeIndices: Set<number>;
  revokedNodeId?: string | null;
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
  clinician: '#228B22', credential: '#DAA520', issuer: '#4A90D9',
  employer: '#8B5CF6', decision: '#F97316', policy: '#EC4899',
};

const SIZE = 400;
const CENTER = SIZE / 2;
const RADIUS = 150;

// ── Layout ────────────────────────────────────────────────────────────────

interface LayoutNode extends DemoNode {
  x: number; y: number; r: number;
}

function layout(nodes: DemoNode[]): LayoutNode[] {
  const clinician = nodes.find((n) => n.group === 'clinician');
  const others = nodes.filter((n) => n.group !== 'clinician');
  const result: LayoutNode[] = [];

  if (clinician) {
    result.push({ ...clinician, x: CENTER, y: CENTER, r: 16 });
  }

  others.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(others.length, 1) - Math.PI / 2;
    const jitter = (i % 2) * 15;
    result.push({
      ...n,
      x: CENTER + Math.cos(angle) * (RADIUS + jitter),
      y: CENTER + Math.sin(angle) * (RADIUS + jitter),
      r: 10,
    });
  });

  return result;
}

// ── Component ─────────────────────────────────────────────────────────────

export function DemoGraphOverlay({
  nodes, edges, activeNodeIds, activeEdgeIndices, revokedNodeId, className = '',
}: DemoGraphOverlayProps) {
  const laid = useMemo(() => layout(nodes), [nodes]);
  const nodeMap = useMemo(() => new Map(laid.map((n) => [n.id, n])), [laid]);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={`w-full max-w-md mx-auto ${className}`}>
      {/* Edges */}
      {edges.map((edge, i) => {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) return null;
        const active = activeEdgeIndices.has(i);

        return (
          <g key={`edge-${i}`}>
            <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={active ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.08)'}
              strokeWidth={active ? 1.5 : 0.8} />
            {active && (
              <motion.circle r={3} fill="#34D399"
                initial={{ cx: s.x, cy: s.y, opacity: 0 }}
                animate={{ cx: [s.x, t.x], cy: [s.y, t.y], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5, ease: 'easeInOut' }}
              />
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {laid.map((node) => {
        const active = activeNodeIds.has(node.id);
        const revoked = revokedNodeId === node.id;
        const color = revoked ? '#EF4444' : (GROUP_COLORS[node.group] ?? '#888');

        return (
          <g key={node.id}>
            {/* Pulse glow */}
            <AnimatePresence>
              {(active || revoked) && (
                <motion.circle cx={node.x} cy={node.y} r={node.r * 2.5}
                  initial={{ opacity: 0 }} animate={{ opacity: [0.1, 0.25, 0.1] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  fill={revoked ? '#EF4444' : color} />
              )}
            </AnimatePresence>

            {/* Node */}
            <motion.circle cx={node.x} cy={node.y} r={node.r}
              fill={color + (active ? 'CC' : '66')}
              stroke={color} strokeWidth={active ? 2 : 1}
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }} />

            {/* Label */}
            <text x={node.x} y={node.y + node.r + 11} textAnchor="middle"
              fill={active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)'}
              fontSize="7" fontFamily="system-ui">
              {node.label.length > 12 ? node.label.slice(0, 10) + '…' : node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default DemoGraphOverlay;
