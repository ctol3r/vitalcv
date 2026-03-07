'use client';

/**
 * TrustGraphConsole.tsx — Wave 137: Trust Graph Operator Console
 *
 * Live operational interface for the VitalCV trust substrate:
 *   - Live trust graph topology (nodes, edges, health rings)
 *   - Node drilldown panel (issuer details, federation status)
 *   - Issuer trust health summary
 *   - Federation health timeline
 *   - Revocation cascade visualization (cascade depth tree)
 *
 * Data sources:
 *   GET /api/network/global          — Graph topology
 *   GET /api/federation/health        — Network-wide federation health
 *   GET /api/federation/health/:entity — Per-entity health
 *   GET /api/audit/events             — Recent audit events
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  GitBranch,
  Globe,
  Network,
  RefreshCw,
  Shield,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { getApiBase } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  type: 'issuer' | 'verifier' | 'federated' | 'clinician';
  trustScore?: number;
  status?: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'PENDING';
  federationId?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
  type?: string;
}

interface GlobalGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  computedAt: string;
  totalNodes: number;
  totalEdges: number;
}

interface FederationHealth {
  healthScore: number;
  totalEntities: number;
  activeEntities: number;
  degradedEntities: number;
  computedAt: string;
}

interface AuditEvent {
  eventId: string;
  type: string;
  clinicianId?: string;
  referenceId?: string;
  timestamp: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REFRESH_MS = 30_000;
const GRAPH_W = 600;
const GRAPH_H = 360;
const NODE_R = 14;

// Stable layout: place nodes in a force-directed ring
function layoutNodes(nodes: GraphNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const cx = GRAPH_W / 2;
  const cy = GRAPH_H / 2;
  const rx = (GRAPH_W / 2) - 60;
  const ry = (GRAPH_H / 2) - 40;

  // Central hub node first
  const hub = nodes.find((n) => n.type === 'issuer' && n.id.includes('vitalcv'));
  if (hub) {
    positions.set(hub.id, { x: cx, y: cy });
  }

  const outer = nodes.filter((n) => n.id !== hub?.id);
  outer.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / outer.length - Math.PI / 2;
    positions.set(node.id, {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  });

  return positions;
}

function nodeColor(node: GraphNode): string {
  if (node.status === 'SUSPENDED' || node.status === 'REVOKED') return '#ef4444';
  if (node.type === 'federated') return '#14b8a6';
  if (node.type === 'verifier') return '#8b5cf6';
  const score = node.trustScore ?? 75;
  if (score >= 85) return '#10b981';
  if (score >= 60) return '#60a5fa';
  return '#f59e0b';
}

function healthLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Healthy', color: 'text-emerald-400' };
  if (score >= 60) return { label: 'Degraded', color: 'text-amber-400' };
  return { label: 'Critical', color: 'text-red-400' };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}
    />
  );
}

function SectionHeader({ icon: Icon, title, action }: {
  icon: React.ElementType;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-200">{title}</span>
      </div>
      {action}
    </div>
  );
}

// ── Graph SVG ─────────────────────────────────────────────────────────────────

function GraphView({
  graph,
  selected,
  onSelect,
  zoom,
}: {
  graph: GlobalGraph;
  selected: string | null;
  onSelect: (id: string) => void;
  zoom: number;
}) {
  const positions = layoutNodes(graph.nodes);

  return (
    <svg
      viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
      className="w-full h-full"
      style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s ease' }}
    >
      <defs>
        <radialGradient id="bgGrad" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#18181b" />
          <stop offset="100%" stopColor="#09090b" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width={GRAPH_W} height={GRAPH_H} fill="url(#bgGrad)" />

      {/* Edges */}
      {graph.edges.map((edge, i) => {
        const s = positions.get(edge.source);
        const t = positions.get(edge.target);
        if (!s || !t) return null;
        return (
          <line
            key={i}
            x1={s.x} y1={s.y} x2={t.x} y2={t.y}
            stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 3"
            opacity="0.6"
          />
        );
      })}

      {/* Nodes */}
      {graph.nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        const color = nodeColor(node);
        const isSelected = selected === node.id;

        return (
          <g
            key={node.id}
            transform={`translate(${pos.x}, ${pos.y})`}
            onClick={() => onSelect(node.id)}
            className="cursor-pointer"
          >
            {/* Selection ring */}
            {isSelected && (
              <circle r={NODE_R + 6} fill="none" stroke={color} strokeWidth="1.5"
                opacity="0.4" className="animate-ping" />
            )}
            {/* Trust score arc */}
            <circle r={NODE_R + 3} fill="none" stroke={color} strokeWidth="2"
              opacity={isSelected ? 0.8 : 0.3} />
            {/* Node body */}
            <circle r={NODE_R} fill="#18181b" stroke={color} strokeWidth="2"
              filter={isSelected ? 'url(#glow)' : undefined} />
            {/* Type icon text */}
            <text textAnchor="middle" dominantBaseline="central"
              fontSize="10" fill={color} fontFamily="monospace">
              {node.type === 'issuer' ? 'IS'
                : node.type === 'federated' ? 'FD'
                : node.type === 'verifier' ? 'VR'
                : 'CL'}
            </text>
            {/* Label below */}
            <text
              y={NODE_R + 12} textAnchor="middle"
              fontSize="8" fill="#71717a"
              style={{ maxWidth: '60px' }}
            >
              {node.label.length > 12 ? node.label.slice(0, 11) + '…' : node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Node Drilldown Panel ──────────────────────────────────────────────────────

function NodeDrilldown({
  node,
  federationHealth,
  onClose,
}: {
  node: GraphNode;
  federationHealth: FederationHealth | null;
  onClose: () => void;
}) {
  const color = nodeColor(node);
  const score = node.trustScore ?? 0;
  const { label: healthLab, color: healthColor } = healthLabel(score);

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <span className="text-sm font-semibold text-zinc-200">{node.label}</span>
          </div>
          <p className="text-[10px] font-mono text-zinc-600 mt-0.5 break-all">{node.id}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-400 text-xs"
        >
          ✕
        </button>
      </div>

      {/* Trust score */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-800/50 p-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Trust Score</p>
          <p className={`text-xl font-bold ${healthColor}`}>{score}</p>
          <p className={`text-[10px] ${healthColor}`}>{healthLab}</p>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Type</p>
          <p className="text-xs text-zinc-300 capitalize">{node.type}</p>
          <p className={`text-[10px] mt-1 ${
            node.status === 'ACTIVE' ? 'text-emerald-400' :
            node.status === 'SUSPENDED' ? 'text-amber-400' : 'text-red-400'
          }`}>
            {node.status ?? 'ACTIVE'}
          </p>
        </div>
      </div>

      {/* Federation info */}
      {node.type === 'federated' && federationHealth && (
        <div className="rounded-lg bg-zinc-800/50 p-3 space-y-1.5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Federation Health</p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Network Score</span>
            <span className={healthLabel(federationHealth.healthScore).color}>
              {federationHealth.healthScore}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Active Entities</span>
            <span className="text-zinc-300">{federationHealth.activeEntities} / {federationHealth.totalEntities}</span>
          </div>
          {federationHealth.degradedEntities > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
              <AlertTriangle className="h-2.5 w-2.5" />
              {federationHealth.degradedEntities} degraded entities
            </div>
          )}
        </div>
      )}

      {/* Cascade indicator */}
      <div className="rounded-lg bg-zinc-800/50 p-3">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1">
          <GitBranch className="h-2.5 w-2.5" /> Revocation Cascade Risk
        </p>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(5, 100 - score)}%`,
                background: score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
          <span className="text-[10px] text-zinc-500">{100 - score}%</span>
        </div>
        <p className="text-[10px] text-zinc-600 mt-1">
          {score >= 85 ? 'Low blast radius — minimal cascade risk'
            : score >= 60 ? 'Moderate — downstream verification may be affected'
            : 'High — revocation here triggers cascade alerts'}
        </p>
      </div>
    </motion.div>
  );
}

// ── Audit Event Feed ──────────────────────────────────────────────────────────

function AuditFeed({ events }: { events: AuditEvent[] }) {
  const severityColor = (s?: string) => {
    if (s === 'CRITICAL') return 'text-red-400';
    if (s === 'HIGH') return 'text-orange-400';
    if (s === 'MEDIUM') return 'text-amber-400';
    return 'text-zinc-500';
  };

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {events.length === 0 && (
        <p className="text-[10px] text-zinc-600 text-center py-4">No events</p>
      )}
      {events.map((ev) => (
        <div key={ev.eventId} className="flex items-start gap-2 text-[10px] font-mono">
          <span className={`mt-0.5 ${severityColor(ev.severity)}`}>▸</span>
          <span className="text-zinc-500 shrink-0">
            {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="text-zinc-400 truncate">{ev.type}</span>
          {ev.referenceId && (
            <span className="text-zinc-600 shrink-0 truncate">{ev.referenceId.slice(0, 12)}…</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TrustGraphConsole() {
  const [graph, setGraph] = useState<GlobalGraph | null>(null);
  const [federationHealth, setFederationHealth] = useState<FederationHealth | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = getApiBase();

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [graphRes, fedRes, auditRes] = await Promise.allSettled([
        fetch(`${apiBase}/api/network/global`),
        fetch(`${apiBase}/api/federation/health`),
        fetch(`${apiBase}/api/audit/events?limit=20`),
      ]);

      if (graphRes.status === 'fulfilled' && graphRes.value.ok) {
        const data = await graphRes.value.json() as GlobalGraph;
        setGraph(data);
      }
      if (fedRes.status === 'fulfilled' && fedRes.value.ok) {
        const data = await fedRes.value.json() as { healthScore: number; totalEntities: number; activeEntities: number; degradedEntities: number; computedAt: string };
        setFederationHealth(data);
      }
      if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
        const data = await auditRes.value.json() as { events?: AuditEvent[] };
        setAuditEvents(data.events ?? []);
      }

      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchAll]);

  const selectedNode = graph?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Issuer health summary
  const issuerNodes = graph?.nodes.filter((n) => n.type === 'issuer') ?? [];
  const avgTrustScore = issuerNodes.length
    ? Math.round(issuerNodes.reduce((s, n) => s + (n.trustScore ?? 75), 0) / issuerNodes.length)
    : 0;
  const degradedIssuers = issuerNodes.filter((n) => (n.trustScore ?? 75) < 60).length;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      {/* Console Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-200">Trust Graph Console</span>
          {graph && (
            <span className="text-[10px] font-mono text-zinc-600">
              {graph.totalNodes}N · {graph.totalEdges}E
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[10px] text-zinc-600">
              {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <span className="text-[10px] font-mono text-zinc-600 w-8 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={fetchAll}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-5 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400">
          <XCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-zinc-800">
        {/* ── Left: Graph + Audit Feed ────────────────────────────── */}
        <div className="xl:col-span-2 p-5 space-y-5">
          {/* Graph viewport */}
          <div>
            <SectionHeader
              icon={Globe}
              title="Live Trust Graph"
              action={
                <div className="flex items-center gap-1.5">
                  <StatusDot ok={!error && !loading} />
                  <span className="text-[10px] text-zinc-600">
                    {loading ? 'Syncing…' : 'Live'}
                  </span>
                </div>
              }
            />
            <div
              className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950"
              style={{ height: 280 }}
            >
              {graph && graph.nodes.length > 0 ? (
                <GraphView
                  graph={graph}
                  selected={selectedNodeId}
                  onSelect={(id) => setSelectedNodeId((prev) => (prev === id ? null : id))}
                  zoom={zoom}
                />
              ) : loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-[10px] text-zinc-600 animate-pulse">Loading graph…</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Network className="h-8 w-8 text-zinc-700" />
                  <p className="text-xs text-zinc-600">No nodes in graph</p>
                </div>
              )}
            </div>
            {graph && (
              <p className="text-[10px] text-zinc-700 mt-1.5 text-right">
                Click a node to inspect · computed {new Date(graph.computedAt).toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Audit event feed */}
          <div>
            <SectionHeader icon={Activity} title="Audit Event Feed" />
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <AuditFeed events={auditEvents} />
            </div>
          </div>
        </div>

        {/* ── Right: Health + Drilldown ───────────────────────────── */}
        <div className="p-5 space-y-5">
          {/* Issuer trust health */}
          <div>
            <SectionHeader icon={Shield} title="Issuer Trust Health" />
            <div className="space-y-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Avg Score</p>
                  <p className={`text-2xl font-bold ${healthLabel(avgTrustScore).color}`}>
                    {avgTrustScore || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Issuers</p>
                  <p className="text-2xl font-bold text-zinc-200">{issuerNodes.length}</p>
                </div>
                {degradedIssuers > 0 ? (
                  <div className="col-span-2 flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {degradedIssuers} issuer{degradedIssuers > 1 ? 's' : ''} below trust threshold
                  </div>
                ) : issuerNodes.length > 0 ? (
                  <div className="col-span-2 flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 rounded px-2 py-1.5">
                    <CheckCircle className="h-3 w-3 shrink-0" />
                    All issuers healthy
                  </div>
                ) : null}
              </div>

              {/* Issuer list */}
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {issuerNodes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedNodeId((prev) => (prev === n.id ? null : n.id))}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[11px] transition-colors
                      ${selectedNodeId === n.id
                        ? 'bg-zinc-800 border border-zinc-700'
                        : 'border border-transparent hover:bg-zinc-800/50'}`}
                  >
                    <span className="text-zinc-300 truncate">{n.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={healthLabel(n.trustScore ?? 75).color}>
                        {n.trustScore ?? '—'}
                      </span>
                      <ChevronRight className="h-3 w-3 text-zinc-600" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Federation health */}
          {federationHealth && (
            <div>
              <SectionHeader icon={Globe} title="Federation Health" />
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Health Score</span>
                  <span className={healthLabel(federationHealth.healthScore).color}>
                    {federationHealth.healthScore}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${federationHealth.healthScore}%`,
                      background: federationHealth.healthScore >= 85
                        ? '#10b981' : federationHealth.healthScore >= 60
                        ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-1 text-center mt-1">
                  {[
                    { label: 'Total', val: federationHealth.totalEntities },
                    { label: 'Active', val: federationHealth.activeEntities, color: 'text-emerald-400' },
                    { label: 'Degraded', val: federationHealth.degradedEntities, color: federationHealth.degradedEntities > 0 ? 'text-amber-400' : 'text-zinc-500' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="rounded bg-zinc-800/50 px-1 py-1.5">
                      <p className={`text-sm font-bold ${color ?? 'text-zinc-200'}`}>{val}</p>
                      <p className="text-[9px] text-zinc-600">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Node drilldown */}
          <AnimatePresence mode="wait">
            {selectedNode && (
              <div>
                <SectionHeader icon={ZoomIn} title="Node Inspector" />
                <NodeDrilldown
                  node={selectedNode}
                  federationHealth={federationHealth}
                  onClose={() => setSelectedNodeId(null)}
                />
              </div>
            )}
          </AnimatePresence>

          {!selectedNode && (
            <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center">
              <Network className="h-6 w-6 text-zinc-700 mx-auto mb-2" />
              <p className="text-[11px] text-zinc-600">Select a node to inspect</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
