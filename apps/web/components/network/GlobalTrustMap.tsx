'use client';

/**
 * GlobalTrustMap.tsx — Wave 96: Global Trust Network Map
 *
 * Interactive canvas visualization of the entire trust network:
 * clinicians, issuers, credentials, and decisions. Fetches live
 * data from /api/network/global with a force-directed layout.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Building2, FileCheck, Globe2, Scale, Stethoscope, Users } from 'lucide-react';
import { getApiBase } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────

// Wave 113 + Phase 4: Differentiate local trust, federated trust, OpenID Federation, and degraded nodes
type NodeGroup = 'clinician' | 'issuer' | 'credential' | 'decision' | 'federated_issuer' | 'oid_federation' | 'degraded_federation' | 'payer';

interface GlobalNode {
  id: string;
  label: string;
  group: NodeGroup;
  val: number;
  metadata?: Record<string, unknown>;
  /** Wave 105: trust score 0–100 for issuer nodes */
  trustScore?: number;
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
  // Wave 102: federated nodes — external network peers (dashed teal ring)
  federated_issuer: { fill: '#06b6d4', stroke: '#0891b2' },
  // Wave 113: OpenID Federation entities — verified via entity configuration chain (gold ring)
  oid_federation: { fill: '#f59e0b', stroke: '#d97706' },
  // Phase 4: Degraded federation nodes — expired/broken trust chain (red dashed ring)
  degraded_federation: { fill: '#ef4444', stroke: '#dc2626' },
  // Wave 142: Payer network nodes — insurance verifiers (indigo)
  payer: { fill: '#6366f1', stroke: '#4f46e5' },
};

const GROUP_RADIUS: Record<NodeGroup, number> = {
  clinician: 5,
  issuer: 9,
  credential: 4,
  decision: 4,
  federated_issuer: 10,
  oid_federation: 11,
  degraded_federation: 10,
  payer: 10,
};

// ── Demo fallback ─────────────────────────────────────────────────────

function buildDemoData(): GlobalGraphData {
  const nodes: GlobalNode[] = [
    { id: 'i1', label: 'CA Medical Board', group: 'issuer', val: 6, trustScore: 95, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'i2', label: 'ABIM', group: 'issuer', val: 6, trustScore: 97, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'i3', label: 'NPI Registry', group: 'issuer', val: 6, trustScore: 99, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'c1', label: 'Dr. Sarah Chen', group: 'clinician', val: 3, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'c2', label: 'Dr. James Park', group: 'clinician', val: 3, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'c3', label: 'Dr. Maria Lopez', group: 'clinician', val: 3, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'cr1', label: 'License #CA8821', group: 'credential', val: 2, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'cr2', label: 'Board Cert #4422', group: 'credential', val: 2, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'd1', label: 'Acceptance A1', group: 'decision', val: 2, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'd2', label: 'Acceptance A2', group: 'decision', val: 2, x: 0, y: 0, vx: 0, vy: 0 },
    // Wave 102: federated external networks
    { id: 'fn1', label: 'Nursys (External)', group: 'federated_issuer', val: 7, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'fn2', label: 'CAQH ProView (External)', group: 'federated_issuer', val: 7, x: 0, y: 0, vx: 0, vy: 0 },
    // Wave 113: OpenID Federation verified entities
    { id: 'oidf1', label: 'CA Medical Board (OID Fed)', group: 'oid_federation', val: 9, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'oidf2', label: 'ABIM (OID Fed)', group: 'oid_federation', val: 9, x: 0, y: 0, vx: 0, vy: 0 },
  ];
  const edges: GlobalEdge[] = [
    { source: 'i1', target: 'cr1', label: 'issued' },
    { source: 'i2', target: 'cr2', label: 'issued' },
    { source: 'cr1', target: 'c1', label: 'held_by' },
    { source: 'cr2', target: 'c2', label: 'held_by' },
    { source: 'i3', target: 'c3', label: 'verified' },
    { source: 'c1', target: 'd1', label: 'received' },
    { source: 'c2', target: 'd2', label: 'received' },
    { source: 'fn1', target: 'c3', label: 'federated_verify' },
    { source: 'fn2', target: 'c1', label: 'federated_verify' },
  ];
  return {
    nodes,
    edges,
    stats: { clinicians: 3, issuers: 5, credentials: 2, decisions: 2, totalNodes: 12, totalEdges: 9 },
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

  // Wave 144: performance telemetry
  const renderStartRef = useRef<number>(0);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [clusteringActive, setClusteringActive] = useState(false);

  // Fetch data + Wave 141: overlay live reputation scores + Wave 144: scaled graph
  useEffect(() => {
    const base = getApiBase();
    setLoading(true);
    renderStartRef.current = performance.now();

    Promise.allSettled([
      // Wave 144: prefer scaled endpoint which applies clustering for large graphs
      fetch(`${base}/api/network/global/scaled?budget=200`)
        .then((r) => (r.ok ? r.json() as Promise<GlobalGraphData> : null))
        .catch(() => fetch(`${base}/api/network/global`).then((r) => r.ok ? r.json() as Promise<GlobalGraphData> : null)),
      fetch(`${base}/api/reputation/network`).then((r) =>
        r.ok
          ? r.json() as Promise<{ issuerScores: Array<{ issuerId: string; trustScore: number }> }>
          : null,
      ),
    ])
      .then(([graphResult, reputationResult]) => {
        const graphData =
          graphResult.status === 'fulfilled' && graphResult.value
            ? graphResult.value
            : buildDemoData();

        // Wave 141: patch live trustScore onto issuer nodes
        if (reputationResult.status === 'fulfilled' && reputationResult.value) {
          const scoreMap = new Map(
            reputationResult.value.issuerScores.map((s) => [s.issuerId, s.trustScore]),
          );
          for (const node of graphData.nodes) {
            if (
              (node.group === 'issuer' ||
                node.group === 'federated_issuer' ||
                node.group === 'oid_federation') &&
              scoreMap.has(node.id)
            ) {
              node.trustScore = scoreMap.get(node.id);
            }
          }
        }

        const w = widthRef.current;
        randomizePositions(graphData.nodes, w, height);
        nodesRef.current = graphData.nodes;
        edgesRef.current = graphData.edges;
        setStats(graphData.stats);

        // Wave 144: record load time + detect clustering
        const elapsed = Math.round(performance.now() - renderStartRef.current);
        setRenderMs(elapsed);
        const scaledData = graphData as GlobalGraphData & { scalingApplied?: boolean };
        setClusteringActive(scaledData.scalingApplied === true);
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
        const baseColor = GROUP_COLORS[node.group] ?? GROUP_COLORS.clinician;
        const r = GROUP_RADIUS[node.group] ?? 5;
        const isHovered = hoveredRef.current === node.id;
        const isFederated = node.group === 'federated_issuer';
        const isOIDFederation = node.group === 'oid_federation';
        const isDegradedFederation = node.group === 'degraded_federation';
        const isPayer = node.group === 'payer';
        const isIssuerId = node.group === 'issuer' || isFederated || isOIDFederation || isDegradedFederation || isPayer;
        const isIssuer = isIssuerId;
        const drawR = isHovered ? r * 1.5 : r;

        // Wave 105: derive fill from trustScore for issuer nodes
        let fillColor = baseColor.fill;
        let strokeColor = baseColor.stroke;
        if (isIssuer && node.trustScore != null) {
          const s = node.trustScore;
          if (s >= 90) { fillColor = '#10b981'; strokeColor = '#059669'; }        // emerald
          else if (s >= 70) { fillColor = '#3b82f6'; strokeColor = '#2563eb'; }   // blue
          else if (s >= 50) { fillColor = '#f59e0b'; strokeColor = '#d97706'; }   // amber
          else { fillColor = '#ef4444'; strokeColor = '#dc2626'; }                 // red
        }

        const color = { fill: fillColor, stroke: strokeColor };

        ctx.beginPath();
        ctx.arc(node.x, node.y, drawR, 0, Math.PI * 2);
        ctx.fillStyle = color.fill + (isHovered ? 'ff' : 'cc');
        ctx.fill();

        // Wave 102: dashed outer ring for federated peer nodes
        if (isFederated) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, drawR + 3, 0, Math.PI * 2);
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = color.stroke + '88';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // Wave 113: double solid ring for OpenID Federation verified entities
        if (isOIDFederation) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, drawR + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#f59e0bcc';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(node.x, node.y, drawR + 7, 0, Math.PI * 2);
          ctx.strokeStyle = '#f59e0b44';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Phase 4: red dashed ring for degraded/expired federation entities
        if (isDegradedFederation) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, drawR + 4, 0, Math.PI * 2);
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = '#ef4444cc';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(node.x, node.y, drawR + 7, 0, Math.PI * 2);
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = '#ef444444';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, drawR, 0, Math.PI * 2);
        ctx.strokeStyle = color.stroke;
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.stroke();

        // Wave 144: cluster nodes get a double ring + count label
        const nodeAsCluster = node as GlobalNode & { isCluster?: boolean; clusterSize?: number };
        if (nodeAsCluster.isCluster && nodeAsCluster.clusterSize) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, drawR + 5, 0, Math.PI * 2);
          ctx.setLineDash([2, 3]);
          ctx.strokeStyle = color.stroke + '66';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);
          // Count badge
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${Math.max(7, drawR * 0.9)}px Inter,sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(nodeAsCluster.clusterSize), node.x, node.y);
        }

        // Label on hover
        if (isHovered) {
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillStyle = 'rgba(15,23,42,0.9)';
          const scoreLabel = isIssuer && node.trustScore != null ? ` [${node.trustScore}]` : '';
          const federationTag = isDegradedFederation ? ' ⚠️' : isOIDFederation ? ' 🔐' : isFederated ? ' ↗' : '';
          ctx.fillText(node.label + federationTag + scoreLabel, node.x + drawR + 4, node.y + 3);
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
    { group: 'federated_issuer', label: 'External', icon: Globe2 },
    { group: 'oid_federation', label: 'OID Fed', icon: Globe2 },
    { group: 'degraded_federation', label: 'Degraded', icon: Activity },
    { group: 'payer', label: 'Payers', icon: Building2 },
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
            {/* Wave 144: performance telemetry */}
            {renderMs !== null && (
              <span className="text-infra-muted/70">{renderMs}ms</span>
            )}
            {clusteringActive && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs">clustered</span>
            )}
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
        <div className="grid grid-cols-5 divide-x divide-infra-border border-t border-infra-border">
          {LEGEND_ITEMS.map(({ group, label, icon: Icon }) => {
            const color = GROUP_COLORS[group];
            // federated/oid/degraded maps to issuers count; others direct
            const isFederated = group === 'federated_issuer' || group === 'oid_federation';
            const isDegraded = group === 'degraded_federation';
            const statKey = (isFederated || isDegraded) ? 'issuers' : (group as keyof typeof stats);
            const count = stats[statKey] ?? '—';
            return (
              <div key={group} className={`flex items-center gap-2 px-3 py-2.5 ${isDegraded ? 'bg-red-50/50' : isFederated ? 'bg-cyan-50/50' : ''}`}>
                <div
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: color.fill,
                    outline: isDegraded
                      ? `1.5px dashed ${color.stroke}`
                      : isFederated ? `1.5px dashed ${color.stroke}` : 'none',
                    outlineOffset: '1.5px',
                  }}
                />
                <Icon className="h-3 w-3 text-muted-foreground" />
                <div>
                  <p className="text-xs font-bold text-foreground">{count}</p>
                  <p className={`text-[10px] ${isDegraded ? 'text-red-600 font-medium' : isFederated ? 'text-cyan-600 font-medium' : 'text-muted-foreground'}`}>{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Wave 105: Trust score color scale legend */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-2 border-t border-infra-border text-[9px] text-muted-foreground">
        <span className="font-bold uppercase tracking-wider">Issuer Trust Score:</span>
        {[
          { color: '#10b981', label: '90–100 Excellent' },
          { color: '#3b82f6', label: '70–89 Good' },
          { color: '#f59e0b', label: '50–69 Fair' },
          { color: '#ef4444', label: '0–49 Poor' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
