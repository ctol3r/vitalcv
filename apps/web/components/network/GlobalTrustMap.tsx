'use client';

/**
 * GlobalTrustMap.tsx — Wave 96: Global Trust Network Map
 *
 * Interactive canvas visualization of the entire trust network:
 * clinicians, issuers, credentials, and decisions. Fetches live
 * data from /api/network/global with a force-directed layout.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Building2, FileCheck, Scale, Stethoscope, Users } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────

type NodeGroup = 'clinician' | 'issuer' | 'credential' | 'decision';

interface GlobalNode {
  id: string;
  label: string;
  group: NodeGroup;
  val: number;
  metadata?: Record<string, unknown>;
  // Physics state (mutable)
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GlobalEdge {
  source: string;
  target: string;
  label: string;
  weight?: number;
}

interface GlobalGraphData {
  nodes: GlobalNode[];
  edges: GlobalEdge[];
  stats: {
    clinicians: number;
    issuers: number;
    credentials: number;
    decisions: number;
    totalNodes: number;
    totalEdges: number;
  };
  generatedAt: string;
}

// ── Visual config ─────────────────────────────────────────────────────

const GROUP_COLORS: Record<NodeGroup, { fill: string; stroke: string }> = {
  clinician: { fill: '#22c55e', stroke: '#16a34a' },
  issuer: { fill: '#3b82f6', stroke: '#2563eb' },
  credential: { fill: '#a855f7', stroke: '#9333ea' },
  decision: { fill: '#f59e0b', stroke: '#d97706' },
};

const GROUP_RADIUS: Record<NodeGroup, number> = {
  clinician: 5,
  issuer: 9,
  credential: 4,
  decision: 4,
};

// ── Demo fallback ─────────────────────────────────────────────────────

function buildDemoData(): GlobalGraphData {
  const nodes: GlobalNode[] = [
    { id: 'i1', label: 'CA Medical Board', group: 'issuer', val: 6, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'i2', label: 'ABIM', group: 'issuer', val: 6, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'i3', label: 'NPI Registry', group: 'issuer', val: 6, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'c1', label: 'Dr. Sarah Chen', group: 'clinician', val: 3, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'c2', label: 'Dr. James Park', group: 'clinician', val: 3, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'c3', label: 'Dr. Maria Lopez', group: 'clinician', val: 3, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'cr1', label: 'License #CA8821', group: 'credential', val: 2, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'cr2', label: 'Board Cert #4422', group: 'credential', val: 2, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'd1', label: 'Acceptance A1', group: 'decision', val: 2, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'd2', label: 'Acceptance A2', group: 'decision', val: 2, x: 0, y: 0, vx: 0, vy: 0 },
  ];
  const edges: GlobalEdge[] = [
    { source: 'i1', target: 'cr1', label: 'issued' },
    { source: 'i2', target: 'cr2', label: 'issued' },
    { source: 'cr1', target: 'c1', label: 'held_by' },
    { source: 'cr2', target: 'c2', label: 'held_by' },
    { source: 'i3', target: 'c3', label: 'verified' },
    { source: 'c1', target: 'd1', label: 'received' },
    { source: 'c2', target: 'd2', label: 'received' },
  ];
  return {
    nodes,
    edges,
    stats: { clinicians: 3, issuers: 3, credentials: 2, decisions: 2, totalNodes: 10, totalEdges: 7 },
    generatedAt: new Date().toISOString(),
  };
}

// ── Force simulation helpers ──────────────────────────────────────────

function randomizePositions(nodes: GlobalNode[], w: number, h: number): void {
  for (const n of nodes) {
    n.x = w * 0.2 + Math.random() * w * 0.6;
    n.y = h * 0.2 + Math.random() * h * 0.6;
    n.vx = 0;
    n.vy = 0;
  }
}

function tickForce(nodes: GlobalNode[], edges: GlobalEdge[], w: number, h: number): void {
  const alpha = 0.015;
  const repulsion = 900;
  const linkDist = 80;
  const linkStrength = 0.12;
  const centerX = w / 2;
  const centerY = h / 2;

  // Repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = repulsion / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx * alpha;
      a.vy -= fy * alpha;
      b.vx += fx * alpha;
      b.vy += fy * alpha;
    }
  }

  // Attraction (spring)
  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
  for (const edge of edges) {
    const ai = nodeIndex.get(edge.source);
    const bi = nodeIndex.get(edge.target);
    if (ai == null || bi == null) continue;
    const a = nodes[ai]!;
    const b = nodes[bi]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const delta = (dist - linkDist) * linkStrength;
    const fx = (dx / dist) * delta;
    const fy = (dy / dist) * delta;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  // Center gravity
  for (const n of nodes) {
    n.vx += (centerX - n.x) * 0.002;
    n.vy += (centerY - n.y) * 0.002;
    // Damping
    n.vx *= 0.82;
    n.vy *= 0.82;
    n.x += n.vx;
    n.y += n.vy;
    // Clamp
    n.x = Math.max(16, Math.min(w - 16, n.x));
    n.y = Math.max(16, Math.min(h - 16, n.y));
  }
}

// ── Component ─────────────────────────────────────────────────────────

interface GlobalTrustMapProps {
  height?: number;
  className?: string;
}

export function GlobalTrustMap({ height = 420, className = '' }: GlobalTrustMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<GlobalNode[]>([]);
  const edgesRef = useRef<GlobalEdge[]>([]);
  const frameRef = useRef(0);
  const widthRef = useRef(600);

  const [stats, setStats] = useState<GlobalGraphData['stats'] | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hoveredRef = useRef<string | null>(null);

  // Fetch data
  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
    const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
    setLoading(true);
    fetch(`${base}/api/network/global`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: GlobalGraphData | null) => {
        const d = data ?? buildDemoData();
        const w = widthRef.current;
        randomizePositions(d.nodes, w, height);
        nodesRef.current = d.nodes;
        edgesRef.current = d.edges;
        setStats(d.stats);
      })
      .catch(() => {
        const d = buildDemoData();
        randomizePositions(d.nodes, widthRef.current, height);
        nodesRef.current = d.nodes;
        edgesRef.current = d.edges;
        setStats(d.stats);
      })
      .finally(() => setLoading(false));
  }, [height]);

  // Track container width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 600;
      widthRef.current = w;
      if (canvasRef.current) {
        canvasRef.current.width = w;
      }
    });
    ro.observe(containerRef.current);
    widthRef.current = containerRef.current.clientWidth;
    return () => ro.disconnect();
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    function draw() {
      if (!running || !ctx || !canvas) return;
      const w = canvas.width;
      const h = canvas.height;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // Tick physics
      if (nodes.length > 0) tickForce(nodes, edges, w, h);

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Build node lookup
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // Draw edges
      ctx.lineWidth = 1;
      for (const edge of edges) {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(148,163,184,0.35)';
        ctx.stroke();
      }

      // Draw nodes
      for (const node of nodes) {
        const color = GROUP_COLORS[node.group] ?? GROUP_COLORS.clinician;
        const r = GROUP_RADIUS[node.group] ?? 5;
        const isHovered = hoveredRef.current === node.id;

        ctx.beginPath();
        ctx.arc(node.x, node.y, isHovered ? r * 1.5 : r, 0, Math.PI * 2);
        ctx.fillStyle = color.fill + (isHovered ? 'ff' : 'cc');
        ctx.fill();
        ctx.strokeStyle = color.stroke;
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.stroke();

        // Label on hover
        if (isHovered) {
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillStyle = 'rgba(15,23,42,0.9)';
          ctx.fillText(node.label, node.x + r + 4, node.y + 3);
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Mouse hover
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const nodes = nodesRef.current;
    let found: string | null = null;
    for (const n of nodes) {
      const r = GROUP_RADIUS[n.group] ?? 5;
      const dx = n.x - mx;
      const dy = n.y - my;
      if (Math.sqrt(dx * dx + dy * dy) < r + 4) {
        found = n.id;
        break;
      }
    }
    hoveredRef.current = found;
    setHovered(found);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = null;
    setHovered(null);
  }, []);

  const LEGEND_ITEMS: Array<{ group: NodeGroup; label: string; icon: typeof Users }> = [
    { group: 'clinician', label: 'Clinicians', icon: Stethoscope },
    { group: 'issuer', label: 'Issuers', icon: Building2 },
    { group: 'credential', label: 'Credentials', icon: FileCheck },
    { group: 'decision', label: 'Decisions', icon: Scale },
  ];

  return (
    <div ref={containerRef} className={`relative w-full rounded-2xl overflow-hidden border border-infra-border bg-infra-surface ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-infra-border">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-infra-blue" />
          <span className="text-sm font-bold text-foreground">Global Trust Network</span>
        </div>
        {stats && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{stats.totalNodes} nodes</span>
            <span>{stats.totalEdges} edges</span>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="relative" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-infra-surface/80 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 rounded-full border-2 border-infra-blue border-t-transparent animate-spin" />
              <p className="text-xs text-muted-foreground">Loading trust network…</p>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={600}
          height={height}
          className="w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: hovered ? 'pointer' : 'default' }}
        />
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 divide-x divide-infra-border border-t border-infra-border">
          {LEGEND_ITEMS.map(({ group, label, icon: Icon }) => {
            const color = GROUP_COLORS[group];
            const count = stats[group as keyof typeof stats];
            return (
              <div key={group} className="flex items-center gap-2 px-4 py-2.5">
                <div
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color.fill }}
                />
                <Icon className="h-3 w-3 text-muted-foreground" />
                <div>
                  <p className="text-xs font-bold text-foreground">{count}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
