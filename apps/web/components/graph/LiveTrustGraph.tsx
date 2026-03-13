'use client';

/**
 * LiveTrustGraph.tsx — Wave 247: Canvas-based live trust graph visualization
 *
 * Features:
 *   - HTML5 Canvas rendering (no react-force-graph-2d)
 *   - Nodes: colored circles by type
 *   - Edges: lines with opacity based on trust weight
 *   - Click node → expand (fetch neighborhood)
 *   - Hover → tooltip
 *   - Zoom/pan support via transform matrix
 *   - Dark theme (#080e1a)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Maximize2, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type NodeType = 'clinician' | 'credential' | 'issuer' | 'hospital' | 'license';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  trustLevel: string;
  status: string;
  metadata?: Record<string, unknown>;
  // Layout (assigned at runtime)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  createdAt: string;
}

export interface TrustGraphStats {
  nodeCount: number;
  edgeCount: number;
  avgTrustScore: number;
}

export interface TrustGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: TrustGraphStats;
  generatedAt?: string;
}

interface Props {
  /** Initial NPI to load — if omitted, loads global network */
  npi?: string;
  height?: number;
  /** Override initial graph data */
  initialGraph?: TrustGraph;
}

// ── Color palette ──────────────────────────────────────────────────────────────

const NODE_COLORS: Record<NodeType, string> = {
  clinician:  '#3b82f6', // blue
  credential: '#22c55e', // green
  issuer:     '#a855f7', // purple
  hospital:   '#14b8a6', // teal
  license:    '#f97316', // orange
};

const NODE_RADIUS: Record<NodeType, number> = {
  clinician:  18,
  issuer:     16,
  hospital:   14,
  credential: 11,
  license:    10,
};

// ── Simple force-directed layout (spring) ─────────────────────────────────────

function initLayout(nodes: GraphNode[], width: number, height: number): GraphNode[] {
  return nodes.map((n, i) => ({
    ...n,
    x: n.x ?? width / 2 + (Math.random() - 0.5) * width * 0.6,
    y: n.y ?? height / 2 + (Math.random() - 0.5) * height * 0.6,
    vx: 0,
    vy: 0,
  }));
}

function tickLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): GraphNode[] {
  const REPULSION = 2800;
  const SPRING_K  = 0.03;
  const IDEAL_LEN = 120;
  const DAMPING   = 0.85;
  const CENTER_K  = 0.008;

  const nodeMap: Record<string, GraphNode> = {};
  for (const n of nodes) nodeMap[n.id] = n;

  const cx = width / 2;
  const cy = height / 2;

  // Reset forces
  for (const n of nodes) {
    n.vx = (n.vx ?? 0) + CENTER_K * (cx - (n.x ?? cx));
    n.vy = (n.vy ?? 0) + CENTER_K * (cy - (n.y ?? cy));
  }

  // Repulsion between all pairs
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = (b.x ?? 0) - (a.x ?? 0);
      const dy = (b.y ?? 0) - (a.y ?? 0);
      const dist2 = dx * dx + dy * dy + 0.1;
      const force = REPULSION / dist2;
      const dist = Math.sqrt(dist2);
      a.vx = (a.vx ?? 0) - (force * dx) / dist;
      a.vy = (a.vy ?? 0) - (force * dy) / dist;
      b.vx = (b.vx ?? 0) + (force * dx) / dist;
      b.vy = (b.vy ?? 0) + (force * dy) / dist;
    }
  }

  // Spring attraction along edges
  for (const e of edges) {
    const a = nodeMap[e.source];
    const b = nodeMap[e.target];
    if (!a || !b) continue;
    const dx = (b.x ?? 0) - (a.x ?? 0);
    const dy = (b.y ?? 0) - (a.y ?? 0);
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
    const force = SPRING_K * (dist - IDEAL_LEN);
    a.vx = (a.vx ?? 0) + (force * dx) / dist;
    a.vy = (a.vy ?? 0) + (force * dy) / dist;
    b.vx = (b.vx ?? 0) - (force * dx) / dist;
    b.vy = (b.vy ?? 0) - (force * dy) / dist;
  }

  // Integrate
  return nodes.map(n => ({
    ...n,
    vx: (n.vx ?? 0) * DAMPING,
    vy: (n.vy ?? 0) * DAMPING,
    x: Math.max(30, Math.min(width - 30, (n.x ?? 0) + (n.vx ?? 0))),
    y: Math.max(30, Math.min(height - 30, (n.y ?? 0) + (n.vy ?? 0))),
  }));
}

// ── Main component ─────────────────────────────────────────────────────────────

export function LiveTrustGraph({ npi, height = 500, initialGraph }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const [graph, setGraph] = useState<TrustGraph | null>(initialGraph ?? null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [loading, setLoading] = useState(!initialGraph);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ node: GraphNode; x: number; y: number } | null>(null);

  // Transform: pan (tx,ty) + scale
  const transform = useRef({ tx: 0, ty: 0, scale: 1 });
  // Drag state
  const drag = useRef<{ active: boolean; lastX: number; lastY: number; nodeId: string | null }>({
    active: false, lastX: 0, lastY: 0, nodeId: null,
  });

  // ── Fetch graph data ────────────────────────────────────────────────────────

  const fetchGraph = useCallback(async (targetNpi?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = targetNpi
        ? `/api/graph/live/${targetNpi}`
        : '/api/graph/network';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: TrustGraph = await res.json();
      setGraph(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialGraph) fetchGraph(npi);
  }, [npi, initialGraph, fetchGraph]);

  // ── Initialize layout when graph changes ───────────────────────────────────

  const canvasWidth = canvasRef.current?.offsetWidth ?? 800;

  useEffect(() => {
    if (!graph) return;
    setNodes(initLayout([...graph.nodes], canvasWidth, height));
  }, [graph, canvasWidth, height]);

  // ── Force simulation loop ──────────────────────────────────────────────────

  const edgesRef = useRef<GraphEdge[]>([]);
  useEffect(() => { edgesRef.current = graph?.edges ?? []; }, [graph]);

  const nodesRef = useRef<GraphNode[]>([]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  useEffect(() => {
    if (!nodes.length) return;
    let step = 0;
    const MAX_STEPS = 120; // stop after convergence

    function tick() {
      if (step < MAX_STEPS) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const w = canvas.offsetWidth || 800;
        const h = canvas.offsetHeight || height;
        const next = tickLayout([...nodesRef.current], edgesRef.current, w, h);
        setNodes(next);
        step++;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // ── Canvas rendering ───────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;

    // Background
    ctx.fillStyle = '#080e1a';
    ctx.fillRect(0, 0, W, H);

    if (!nodes.length) return;

    const { tx, ty, scale } = transform.current;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    const nodeMap: Record<string, GraphNode> = {};
    for (const n of nodes) nodeMap[n.id] = n;

    // Draw edges
    for (const e of edgesRef.current) {
      const a = nodeMap[e.source];
      const b = nodeMap[e.target];
      if (!a || !b) continue;
      const alpha = 0.15 + e.weight * 0.55;
      ctx.beginPath();
      ctx.moveTo(a.x ?? 0, a.y ?? 0);
      ctx.lineTo(b.x ?? 0, b.y ?? 0);
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 0.8 + e.weight;
      ctx.stroke();
    }

    // Draw nodes
    for (const n of nodes) {
      const nx = n.x ?? 0;
      const ny = n.y ?? 0;
      const r = NODE_RADIUS[n.type] ?? 10;
      const color = NODE_COLORS[n.type] ?? '#888';

      // Glow
      const grd = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 2.2);
      grd.addColorStop(0, color + '55');
      grd.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(nx, ny, r * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Circle
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label (truncated)
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `${Math.max(9, Math.min(11, r * 0.7))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxChars = 12;
      const lbl = n.label.length > maxChars ? n.label.slice(0, maxChars) + '…' : n.label;
      ctx.fillText(lbl, nx, ny + r + 11);
    }

    ctx.restore();
  });

  // ── Hit test ───────────────────────────────────────────────────────────────

  function hitTest(clientX: number, clientY: number): GraphNode | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { tx, ty, scale } = transform.current;
    const wx = (clientX - rect.left - tx) / scale;
    const wy = (clientY - rect.top - ty) / scale;

    for (const n of nodesRef.current) {
      const r = (NODE_RADIUS[n.type] ?? 10) + 4; // slightly larger hit area
      const dx = wx - (n.x ?? 0);
      const dy = wy - (n.y ?? 0);
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  // ── Mouse events ───────────────────────────────────────────────────────────

  function onMouseMove(e: React.MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (drag.current.active) {
      const dx = e.clientX - drag.current.lastX;
      const dy = e.clientY - drag.current.lastY;

      if (drag.current.nodeId) {
        // Drag a node
        setNodes(prev => prev.map(n =>
          n.id === drag.current.nodeId
            ? { ...n, x: (n.x ?? 0) + dx / transform.current.scale, y: (n.y ?? 0) + dy / transform.current.scale, vx: 0, vy: 0 }
            : n,
        ));
      } else {
        // Pan canvas
        transform.current.tx += dx;
        transform.current.ty += dy;
      }

      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      return;
    }

    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      const rect = canvas.getBoundingClientRect();
      setTooltip({ node: hit, x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else {
      setTooltip(null);
    }
  }

  function onMouseDown(e: React.MouseEvent) {
    const hit = hitTest(e.clientX, e.clientY);
    drag.current = {
      active: true,
      lastX: e.clientX,
      lastY: e.clientY,
      nodeId: hit ? hit.id : null,
    };
  }

  function onMouseUp() {
    drag.current.active = false;
    drag.current.nodeId = null;
  }

  async function onClick(e: React.MouseEvent) {
    if (Math.abs(e.clientX - drag.current.lastX) > 4) return; // was a drag
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;

    // Expand node
    try {
      const res = await fetch(`/api/graph/node/${encodeURIComponent(hit.id)}/expand`);
      if (!res.ok) return;
      const expanded: TrustGraph = await res.json();

      setGraph(prev => {
        if (!prev) return expanded;
        const existingIds = new Set(prev.nodes.map(n => n.id));
        const newNodes = expanded.nodes.filter(n => !existingIds.has(n.id));
        const existingEdgeIds = new Set(prev.edges.map(ed => ed.id));
        const newEdges = expanded.edges.filter(ed => !existingEdgeIds.has(ed.id));
        return {
          ...prev,
          nodes: [...prev.nodes, ...newNodes],
          edges: [...prev.edges, ...newEdges],
          stats: {
            nodeCount: prev.nodes.length + newNodes.length,
            edgeCount: prev.edges.length + newEdges.length,
            avgTrustScore: prev.stats.avgTrustScore,
          },
        };
      });
    } catch {
      // silently ignore expand failures
    }
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const { tx, ty, scale } = transform.current;
    const newScale = Math.max(0.2, Math.min(5, scale * factor));
    transform.current = {
      tx: mx - (mx - tx) * (newScale / scale),
      ty: my - (my - ty) * (newScale / scale),
      scale: newScale,
    };
  }

  function zoomBy(factor: number) {
    const { tx, ty, scale } = transform.current;
    const newScale = Math.max(0.2, Math.min(5, scale * factor));
    transform.current = { tx, ty, scale: newScale };
  }

  function resetView() {
    transform.current = { tx: 0, ty: 0, scale: 1 };
  }

  // ── Stats bar ──────────────────────────────────────────────────────────────

  const stats = graph?.stats;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/8" style={{ background: '#080e1a' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/6">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-white/80">
            {npi ? `Trust Graph — NPI ${npi}` : 'Global Trust Network'}
          </span>
          {loading && (
            <span className="ml-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-blue-400" />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => zoomBy(1.2)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => zoomBy(0.8)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition"
            title="Reset view"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => fetchGraph(npi)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="flex items-center gap-4 px-5 py-2 border-b border-white/4 text-[11px] text-white/35">
          <span>{stats.nodeCount} nodes</span>
          <span>·</span>
          <span>{stats.edgeCount} edges</span>
          <span>·</span>
          <span>Avg trust <span className="text-blue-400">{stats.avgTrustScore}</span>/100</span>
        </div>
      )}

      {/* Canvas */}
      <div className="relative" style={{ height }}>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400/70">
            {error}
          </div>
        )}
        {!loading && !error && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/20">
            No graph data available
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ height }}
          onMouseMove={onMouseMove}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onClick={onClick}
          onWheel={onWheel}
        />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl border border-white/10 bg-[#0d1528]/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm max-w-[200px]"
            style={{
              left: Math.min(tooltip.x + 12, (canvasRef.current?.offsetWidth ?? 400) - 220),
              top: Math.max(tooltip.y - 80, 4),
            }}
          >
            <div className="font-medium text-white/90 truncate">{tooltip.node.label}</div>
            <div className="mt-1 space-y-0.5 text-white/40">
              <div>Type: <span className="text-white/60">{tooltip.node.type}</span></div>
              <div>Trust: <span className="text-white/60">{tooltip.node.trustLevel}</span></div>
              <div>Status: <span className="text-white/60">{tooltip.node.status}</span></div>
            </div>
            <div className="mt-1.5 text-blue-400/60 text-[10px]">Click to expand</div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-white/4">
        {(Object.entries(NODE_COLORS) as [NodeType, string][]).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-[11px] text-white/30">
            <span className="h-2 w-2 rounded-full inline-block" style={{ background: color }} />
            {type}
          </div>
        ))}
      </div>
    </div>
  );
}

export default LiveTrustGraph;
