'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
    Award,
    Building2,
    FileCheck,
    Scale,
    Stethoscope,
} from 'lucide-react';
import {
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { GraphMotionLayer } from '../network/GraphMotionLayer';

/* ── Types ────────────────────────────────────────────────── */

export type NodeType = 'clinician' | 'issuer' | 'credential' | 'decision' | 'employer';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  status?: string;
  meta?: Record<string, string>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  type?: 'verification' | 'revocation' | 'attestation';
}

/* ── Color & icon config per node type ────────────────────── */

const NODE_CONFIG: Record<
  NodeType,
  { fill: string; stroke: string; bg: string; icon: typeof Stethoscope }
> = {
  clinician: {
    fill: 'var(--infra-amber)',
    stroke: '#d97706',
    bg: 'bg-amber-50 text-amber-700',
    icon: Stethoscope,
  },
  issuer: {
    fill: 'var(--infra-blue)',
    stroke: '#2563eb',
    bg: 'bg-blue-50 text-blue-700',
    icon: Building2,
  },
  credential: {
    fill: 'var(--infra-green)',
    stroke: '#059669',
    bg: 'bg-emerald-50 text-emerald-700',
    icon: FileCheck,
  },
  decision: {
    fill: 'var(--infra-violet)',
    stroke: '#7c3aed',
    bg: 'bg-violet-50 text-violet-700',
    icon: Scale,
  },
  employer: {
    fill: 'var(--infra-red)',
    stroke: '#dc2626',
    bg: 'bg-red-50 text-red-700',
    icon: Award,
  },
};

const NODE_RADIUS: Record<NodeType, number> = {
  clinician: 28,
  issuer: 20,
  credential: 18,
  decision: 22,
  employer: 20,
};

/* ── Force simulation ─────────────────────────────────────── */

export interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function createSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): SimNode[] {
  const cx = width / 2;
  const cy = height / 2;

  return nodes.map((node, i) => {
    // Place clinician at center, others in a spread
    if (node.type === 'clinician') {
      return { ...node, x: cx, y: cy, vx: 0, vy: 0 };
    }
    const angle = (i / nodes.length) * Math.PI * 2 + Math.random() * 0.3;
    const r = 120 + Math.random() * 80;
    return {
      ...node,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
    };
  });
}

function stepSimulation(
  simNodes: SimNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
) {
  const cx = width / 2;
  const cy = height / 2;

  // Reset forces
  for (const n of simNodes) {
    n.vx *= 0.85; // damping
    n.vy *= 0.85;
  }

  // Repulsion between all nodes
  for (let i = 0; i < simNodes.length; i++) {
    for (let j = i + 1; j < simNodes.length; j++) {
      const a = simNodes[i];
      const b = simNodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) dist = 1;
      const force = 800 / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  // Attraction along edges
  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const idealDist = 140;
    const force = (dist - idealDist) * 0.008;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    source.vx += fx;
    source.vy += fy;
    target.vx -= fx;
    target.vy -= fy;
  }

  // Center gravity
  for (const n of simNodes) {
    n.vx += (cx - n.x) * 0.002;
    n.vy += (cy - n.y) * 0.002;
  }

  // Apply velocity
  for (const n of simNodes) {
    // Keep clinician near center
    if (n.type === 'clinician') {
      n.x += (cx - n.x) * 0.1;
      n.y += (cy - n.y) * 0.1;
      continue;
    }
    n.x += n.vx;
    n.y += n.vy;
    // Boundary
    const pad = 40;
    n.x = Math.max(pad, Math.min(width - pad, n.x));
    n.y = Math.max(pad, Math.min(height - pad, n.y));
  }
}

/* ── Mock data ────────────────────────────────────────────── */

export const DEMO_NODES: GraphNode[] = [
  { id: 'c1', label: 'Dr. Sarah Chen', type: 'clinician', status: 'active' },
  { id: 'i1', label: 'CA Medical Board', type: 'issuer' },
  { id: 'i2', label: 'ABIM', type: 'issuer' },
  { id: 'i3', label: 'DEA', type: 'issuer' },
  { id: 'cr1', label: 'Medical License', type: 'credential', meta: { exp: '2027-03-15', status: 'ACTIVE' } },
  { id: 'cr2', label: 'Board Certification', type: 'credential', meta: { exp: '2028-12-01', status: 'ACTIVE' } },
  { id: 'cr3', label: 'DEA Registration', type: 'credential', meta: { exp: '2026-06-30', status: 'ACTIVE' } },
  { id: 'cr4', label: 'NPI Verification', type: 'credential', meta: { npi: '1003000126', status: 'VERIFIED' } },
  { id: 'd1', label: 'Clearance Decision', type: 'decision', meta: { verdict: 'CLEARED', confidence: '0.97' } },
  { id: 'e1', label: 'Memorial Hospital', type: 'employer' },
  { id: 'e2', label: 'Pacific Health', type: 'employer' },
];

export const DEMO_EDGES: GraphEdge[] = [
  { source: 'i1', target: 'cr1', label: 'issues', type: 'attestation' },
  { source: 'i2', target: 'cr2', label: 'issues', type: 'attestation' },
  { source: 'i3', target: 'cr3', label: 'issues', type: 'attestation' },
  { source: 'c1', target: 'cr1', label: 'holds', type: 'verification' },
  { source: 'c1', target: 'cr2', label: 'holds', type: 'verification' },
  { source: 'c1', target: 'cr3', label: 'holds', type: 'verification' },
  { source: 'c1', target: 'cr4', label: 'holds', type: 'verification' },
  { source: 'cr1', target: 'd1', label: 'informs', type: 'verification' },
  { source: 'cr2', target: 'd1', label: 'informs', type: 'verification' },
  { source: 'cr3', target: 'd1', label: 'informs', type: 'verification' },
  { source: 'cr4', target: 'd1', label: 'informs', type: 'verification' },
  { source: 'd1', target: 'e1', label: 'clears for', type: 'attestation' },
  { source: 'd1', target: 'e2', label: 'clears for', type: 'attestation' },
];

/* ── Graph component ──────────────────────────────────────── */

interface TrustGraphPrimaryProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  className?: string;
  width?: number;
  height?: number;
}

export function TrustGraphPrimary({
  nodes = DEMO_NODES,
  edges = DEMO_EDGES,
  onNodeClick,
  className = '',
  width = 800,
  height = 500,
}: TrustGraphPrimaryProps) {
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const rafRef = useRef(0);
  const nodesRef = useRef<SimNode[]>([]);
  const tickRef = useRef(0);

  // Initialize simulation
  useEffect(() => {
    const sim = createSimulation(nodes, edges, width, height);
    nodesRef.current = sim;
    tickRef.current = 0;

    const animate = () => {
      tickRef.current++;
      stepSimulation(nodesRef.current, edges, width, height);
      // Copy positions for React rendering
      setSimNodes(nodesRef.current.map((n) => ({ ...n })));
      if (tickRef.current < 200) {
        rafRef.current = requestAnimationFrame(animate);
      }
      if (tickRef.current === 10) setReady(true);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [nodes, edges, width, height]);

  const nodeMap = useMemo(
    () => new Map(simNodes.map((n) => [n.id, n])),
    [simNodes],
  );

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-infra-border bg-white/80 backdrop-blur-sm shadow-sm ${className}`}
    >
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle, var(--infra-grid) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
      >
        <defs>
          <filter id="node-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Edges & Motion Layer */}
        <GraphMotionLayer
          edges={edges}
          nodeMap={nodeMap as Map<string, any>}
          hoveredId={hoveredId}
          ready={ready}
        />

        {/* Nodes */}
        <g>
          {ready &&
            simNodes.map((node) => {
              const config = NODE_CONFIG[node.type];
              const r = NODE_RADIUS[node.type];
              const isHoveredNode = hoveredId === node.id;
              const isConnected = hoveredId !== null && edges.some(e =>
                 (e.source === hoveredId && e.target === node.id) ||
                 (e.target === hoveredId && e.source === node.id)
              );
              const isDimmed = hoveredId !== null && !isHoveredNode && !isConnected;
              const Icon = config.icon;

              return (
                <motion.g
                  key={node.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: isDimmed ? 0.2 : 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 180,
                    damping: 18,
                    delay: 0.1,
                  }}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onNodeClick?.(node)}
                  style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
                >
                  {/* Outer ring on hover */}
                  {isHoveredNode && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r + 6}
                      fill="none"
                      stroke={config.fill}
                      strokeWidth="1.5"
                      strokeOpacity="0.4"
                    />
                  )}

                  {/* Node circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill="white"
                    stroke={config.fill}
                    strokeWidth={isHoveredNode ? 3 : 2}
                    filter={isHoveredNode ? 'url(#node-glow)' : undefined}
                  />

                  {/* Icon (SVG foreignObject) */}
                  <foreignObject
                    x={node.x - r * 0.5}
                    y={node.y - r * 0.5}
                    width={r}
                    height={r}
                    className="pointer-events-none"
                  >
                    <div className="flex items-center justify-center w-full h-full">
                      <Icon
                        style={{ color: config.fill, width: r * 0.6, height: r * 0.6 }}
                      />
                    </div>
                  </foreignObject>

                  {/* Label */}
                  <text
                    x={node.x}
                    y={node.y + r + 14}
                    textAnchor="middle"
                    className="text-[10px] font-medium pointer-events-none"
                    fill="var(--foreground)"
                    fillOpacity={isHoveredNode ? 1 : 0.7}
                  >
                    {node.label}
                  </text>
                </motion.g>
              );
            })}
          </g>
        </svg>

        {/* Node Hover Card Overlay */}
        {(() => {
          const hoveredNode = hoveredId ? simNodes.find((n) => n.id === hoveredId) : null;
          return (
            <AnimatePresence>
              {hoveredNode && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
                  className="absolute z-50 pointer-events-none rounded-xl border border-zinc-200 bg-white/95 dark:border-zinc-800 dark:bg-zinc-900/95 backdrop-blur-sm shadow-xl p-4 min-w-[220px]"
                  style={{
                    left: hoveredNode.x,
                    top: hoveredNode.y + NODE_RADIUS[hoveredNode.type] + 16,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {(() => {
                      const Icon = NODE_CONFIG[hoveredNode.type].icon;
                      return <Icon className="h-4 w-4 text-zinc-500" />;
                    })()}
                    <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">{hoveredNode.type}</span>
                  </div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{hoveredNode.label}</h4>

                  {hoveredNode.meta && Object.keys(hoveredNode.meta).length > 0 && (
                    <div className="mt-3 space-y-1.5 pt-3 border-t border-zinc-200 dark:border-zinc-800/50">
                      {Object.entries(hoveredNode.meta).map(([key, val]) => (
                        <div key={key} className="flex justify-between items-center text-[11px]">
                          <span className="text-zinc-500 capitalize">{key}</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">{val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {hoveredNode.status && (
                    <div className="mt-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Status: {hoveredNode.status.toUpperCase()}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          );
        })()}

        {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-3">
        {(Object.entries(NODE_CONFIG) as [NodeType, (typeof NODE_CONFIG)[NodeType]][]).map(
          ([type, config]) => (
            <div key={type} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${config.bg}`}>
              <config.icon className="h-3 w-3" />
              {type}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
