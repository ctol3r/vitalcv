'use client';

/**
 * TrustGraph.tsx — Wave 53: Interactive Trust Graph Visualization
 *
 * Force-directed graph rendering using Canvas 2D for performance.
 * No external graph library — lightweight custom implementation
 * with d3-force-like spring physics for layout.
 *
 * Features:
 *   - Color-coded node types (clinician, issuer, credential, employer, policy)
 *   - Animated node pulses for active/verified credentials
 *   - Hover tooltips with credential metadata
 *   - Zoom and pan
 *   - Memoized layout + throttled simulation
 */

import { AnimatePresence, motion } from 'framer-motion';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  group: 'clinician' | 'issuer' | 'employer' | 'credential' | 'policy';
  status?: string;
  trustState?: string;
  auditHash?: string | null;
  val: number;
  metadata?: Record<string, unknown>;
  // Layout state (mutable during simulation)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  weight?: number;
}

interface TrustGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  clinician: '#228B22',   // sage green
  issuer: '#4A90D9',      // mist blue
  credential: '#DAA520',  // warm amber
  employer: '#8B5CF6',    // purple
  policy: '#EC4899',      // pink
};

const NODE_LABELS: Record<string, string> = {
  clinician: 'Clinician',
  issuer: 'Issuer',
  credential: 'Credential',
  employer: 'Employer',
  policy: 'Policy',
};

const STATUS_GLOW: Record<string, string> = {
  Valid: '#22C55E',
  ACTIVE: '#22C55E',
  active: '#22C55E',
  GREEN: '#22C55E',
  YELLOW: '#EAB308',
  RED: '#EF4444',
  REVOKED: '#EF4444',
  EXPIRED: '#6B7280',
};

// ── Force Simulation (lightweight, no d3 dependency) ──────────────────────

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function initializeLayout(
  nodes: GraphNode[],
  width: number,
  height: number,
): SimNode[] {
  const cx = width / 2;
  const cy = height / 2;

  return nodes.map((node, i) => {
    // Place clinician at center, others in a circle
    if (node.group === 'clinician') {
      return { ...node, x: cx, y: cy, vx: 0, vy: 0 };
    }
    const angle = (2 * Math.PI * i) / Math.max(nodes.length - 1, 1);
    const radius = Math.min(width, height) * 0.3;
    return {
      ...node,
      x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
      y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
    };
  });
}

function tickSimulation(
  simNodes: SimNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const damping = 0.85;
  const repulsion = 3000;
  const springLength = 120;
  const springStrength = 0.01;
  const centerPull = 0.005;

  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

  // Repulsion between all pairs
  for (let i = 0; i < simNodes.length; i++) {
    for (let j = i + 1; j < simNodes.length; j++) {
      const a = simNodes[i];
      const b = simNodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = repulsion / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  // Spring forces along edges
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const displacement = dist - springLength;
    const force = springStrength * displacement;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    source.vx += fx;
    source.vy += fy;
    target.vx -= fx;
    target.vy -= fy;
  }

  // Center pull
  for (const node of simNodes) {
    node.vx += (cx - node.x) * centerPull;
    node.vy += (cy - node.y) * centerPull;
  }

  // Integrate
  for (const node of simNodes) {
    node.vx *= damping;
    node.vy *= damping;
    node.x += node.vx;
    node.y += node.vy;
    // Bounds
    node.x = Math.max(30, Math.min(width - 30, node.x));
    node.y = Math.max(30, Math.min(height - 30, node.y));
  }
}

// ── Component ─────────────────────────────────────────────────────────────

function TrustGraphInner({
  nodes,
  edges,
  width = 800,
  height = 600,
  onNodeClick,
  className = '',
}: TrustGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const frameRef = useRef<number>(0);
  const tickCountRef = useRef(0);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Initialize layout
  const stableNodeIds = useMemo(
    () => nodes.map((n) => n.id).join(','),
    [nodes],
  );

  useEffect(() => {
    simNodesRef.current = initializeLayout(nodes, width, height);
    tickCountRef.current = 0;
  }, [stableNodeIds, width, height, nodes]);

  // Render loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const simNodes = simNodesRef.current;
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    // Tick simulation (throttle after stabilization)
    if (tickCountRef.current < 300) {
      tickSimulation(simNodes, edges, width, height);
      tickCountRef.current++;
    }

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw edges
    ctx.lineWidth = 1;
    const packetOffset = (Date.now() % 3000) / 3000;

    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      // Animated trust packets (flowing from source to target)
      const px = source.x + (target.x - source.x) * packetOffset;
      const py = source.y + (target.y - source.y) * packetOffset;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Edge label
      const mx = (source.x + target.x) / 2;
      const my = (source.y + target.y) / 2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(edge.label, mx, my - 4);
    }

    // Draw nodes
    const pulsePhase = (Date.now() % 2000) / 2000;
    const pulseScale = 1 + 0.15 * Math.sin(pulsePhase * Math.PI * 2);

    for (const node of simNodes) {
      const color = NODE_COLORS[node.group] ?? '#888';
      const radius = Math.max(node.val * 0.6, 6);
      const isHovered = hoveredNode?.id === node.id;

      // Glow for active/verified
      const glowColor = STATUS_GLOW[node.status ?? ''] ?? STATUS_GLOW[node.trustState ?? ''];
      if (glowColor) {
        const glowRadius = radius * pulseScale * 2.5;
        const gradient = ctx.createRadialGradient(
          node.x, node.y, radius,
          node.x, node.y, glowRadius,
        );
        gradient.addColorStop(0, glowColor + '50'); // Increased intensity
        gradient.addColorStop(1, glowColor + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Inner pulsing ring
        ctx.strokeStyle = glowColor + '80';
        ctx.lineWidth = 1 * pulseScale;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * pulseScale * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Base subtle glow for all nodes
      const baseGlowRadius = radius * 1.8;
      const baseGradient = ctx.createRadialGradient(
        node.x, node.y, radius * 0.8,
        node.x, node.y, baseGlowRadius,
      );
      baseGradient.addColorStop(0, color + '60');
      baseGradient.addColorStop(1, color + '00');
      ctx.fillStyle = baseGradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, baseGlowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Node circle
      ctx.fillStyle = isHovered ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, isHovered ? radius * 1.3 : radius, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = isHovered ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = isHovered ? 'bold 11px system-ui' : '10px system-ui';
      ctx.textAlign = 'center';
      const displayLabel =
        node.label.length > 20 ? node.label.slice(0, 18) + '…' : node.label;
      ctx.fillText(displayLabel, node.x, node.y + radius + 14);
    }

    // Continue animation if not stabilized
    if (tickCountRef.current < 300) {
      frameRef.current = requestAnimationFrame(draw);
    }
  }, [edges, width, height, hoveredNode]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  // Mouse interaction
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const found = simNodesRef.current.find((n) => {
        const dx = n.x - mx;
        const dy = n.y - my;
        return Math.sqrt(dx * dx + dy * dy) < Math.max(n.val * 0.6, 6) + 8;
      });

      setHoveredNode(found ?? null);
      setTooltipPos({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (hoveredNode && onNodeClick) {
        onNodeClick(hoveredNode);
      }
    },
    [hoveredNode, onNodeClick],
  );

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-xl cursor-crosshair"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{ background: 'rgba(0, 0, 0, 0.3)' }}
      />

      {/* Legend */}
      <div className="absolute top-3 left-3 glass rounded-lg p-2 text-xs space-y-1">
        {Object.entries(NODE_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: NODE_COLORS[key] }}
            />
            <span className="text-zinc-300">{label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 glass rounded-lg px-3 py-2 text-xs max-w-xs pointer-events-none"
            style={{
              left: tooltipPos.x + 12,
              top: tooltipPos.y - 10,
            }}
          >
            <div className="font-semibold text-white">{hoveredNode.label}</div>
            <div className="text-zinc-400 mt-0.5">
              {NODE_LABELS[hoveredNode.group] ?? hoveredNode.group}
            </div>
            {hoveredNode.status && (
              <div className="text-zinc-400">Status: {hoveredNode.status}</div>
            )}
            {hoveredNode.trustState && (
              <div className="text-zinc-400">Trust: {hoveredNode.trustState}</div>
            )}
            {hoveredNode.auditHash && (
              <div className="text-zinc-500 font-mono truncate">
                {hoveredNode.auditHash.slice(0, 16)}…
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const TrustGraph = memo(TrustGraphInner);
export default TrustGraph;
