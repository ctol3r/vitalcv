'use client';

/**
 * FilterableTrustGraph — Wave 232
 *
 * Obsidian/Roam-style interactive trust graph.
 * Filter by node type, search by label, highlight connected paths.
 * Everything visual is functionally practical.
 */

import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  DEMO_EDGES,
  DEMO_NODES,
  TrustGraphPrimary,
  type GraphEdge,
  type GraphNode,
  type NodeType,
} from './TrustGraphPrimary';

/* ── Node type config ───────────────────────────────────────── */

const TYPE_CONFIG: Record<NodeType, { label: string; color: string; active: string; dot: string }> = {
  clinician:  { label: 'Clinicians',   color: 'border-amber-500/30 text-amber-400',    active: 'bg-amber-500/20 border-amber-500/60 text-amber-300',    dot: 'bg-amber-400'    },
  issuer:     { label: 'Issuers',      color: 'border-blue-500/30 text-blue-400',      active: 'bg-blue-500/20 border-blue-500/60 text-blue-300',      dot: 'bg-blue-400'     },
  credential: { label: 'Credentials',  color: 'border-emerald-500/30 text-emerald-400', active: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300', dot: 'bg-emerald-400' },
  decision:   { label: 'Decisions',    color: 'border-violet-500/30 text-violet-400',  active: 'bg-violet-500/20 border-violet-500/60 text-violet-300',  dot: 'bg-violet-400'   },
  employer:   { label: 'Employers',    color: 'border-rose-500/30 text-rose-400',      active: 'bg-rose-500/20 border-rose-500/60 text-rose-300',      dot: 'bg-rose-400'     },
};

const ALL_TYPES = Object.keys(TYPE_CONFIG) as NodeType[];

/* ── Stats bar ──────────────────────────────────────────────── */

function GraphStats({ nodes, edges, filtered }: { nodes: GraphNode[]; edges: GraphEdge[]; filtered: boolean }) {
  const typeCounts = useMemo(() => {
    const counts: Partial<Record<NodeType, number>> = {};
    nodes.forEach(n => { counts[n.type] = (counts[n.type] ?? 0) + 1; });
    return counts;
  }, [nodes]);

  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/30">
      <span>{nodes.length} nodes</span>
      <span>·</span>
      <span>{edges.length} edges</span>
      {filtered && (
        <>
          <span>·</span>
          <span className="text-amber-400/70">filtered</span>
        </>
      )}
      {ALL_TYPES.map(type => {
        const count = typeCounts[type];
        if (!count) return null;
        const cfg = TYPE_CONFIG[type];
        return (
          <span key={type} className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            <span>{count} {cfg.label.toLowerCase()}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */

interface Props {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  height?: number;
  /** Show a compact version without stats bar (e.g. embedded in page sections) */
  compact?: boolean;
}

export function FilterableTrustGraph({
  nodes: rawNodes = DEMO_NODES,
  edges: rawEdges = DEMO_EDGES,
  height = 480,
  compact = false,
}: Props) {
  const [activeTypes, setActiveTypes] = useState<Set<NodeType>>(new Set(ALL_TYPES));
  const [query, setQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Toggle a single type filter
  function toggleType(type: NodeType) {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.size === ALL_TYPES.length) {
        // First click: show only this type
        return new Set([type]);
      }
      if (next.has(type) && next.size === 1) {
        // Last active type — reset to all
        return new Set(ALL_TYPES);
      }
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function resetFilters() {
    setActiveTypes(new Set(ALL_TYPES));
    setQuery('');
    setSelectedNode(null);
  }

  // Filtered nodes: type filter + search
  const filteredNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rawNodes.filter(n => {
      if (!activeTypes.has(n.type)) return false;
      if (q && !n.label.toLowerCase().includes(q) && !n.id.includes(q)) return false;
      return true;
    });
  }, [rawNodes, activeTypes, query]);

  // Only include edges where BOTH ends are visible
  const filteredEdges = useMemo(() => {
    const visible = new Set(filteredNodes.map(n => n.id));
    return rawEdges.filter(e => visible.has(e.source) && visible.has(e.target));
  }, [rawEdges, filteredNodes]);

  const isFiltered = activeTypes.size < ALL_TYPES.length || query.trim().length > 0;

  return (
    <div
      className="rounded-2xl border border-white/8 overflow-hidden"
      style={{ background: '#080e1a' }}
    >
      {/* ── Controls ── */}
      <div className="px-5 py-4 border-b border-white/6 space-y-3">

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search nodes…"
              className="glue-input pl-9 pr-4 py-2 text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {isFiltered && (
            <button
              onClick={resetFilters}
              className="flex-shrink-0 rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition"
            >
              Reset
            </button>
          )}
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-2">
          {ALL_TYPES.map(type => {
            const cfg = TYPE_CONFIG[type];
            const isActive = activeTypes.has(type);
            const isAll = activeTypes.size === ALL_TYPES.length;
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
                  isAll || isActive ? cfg.active : 'border-white/8 text-white/20 bg-transparent'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isAll || isActive ? cfg.dot : 'bg-white/15'}`} />
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Stats */}
        {!compact && (
          <GraphStats
            nodes={filteredNodes}
            edges={filteredEdges}
            filtered={isFiltered}
          />
        )}
      </div>

      {/* ── Graph ── */}
      <div style={{ height: `${height}px` }} className="relative">
        {filteredNodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Search className="h-8 w-8 text-white/10" />
            <p className="text-sm text-white/25">No nodes match your filters.</p>
            <button onClick={resetFilters} className="text-xs text-white/35 hover:text-white/60 transition underline">
              Reset filters
            </button>
          </div>
        ) : (
          <TrustGraphPrimary
            nodes={filteredNodes}
            edges={filteredEdges}
            onNodeClick={setSelectedNode}
            height={height}
            className="h-full border-none !rounded-none !shadow-none !bg-transparent"
          />
        )}
      </div>

      {/* ── Selected node detail ── */}
      {selectedNode && (
        <div className="border-t border-white/6 px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`h-2 w-2 rounded-full ${TYPE_CONFIG[selectedNode.type].dot}`} />
              <span className="text-xs font-bold uppercase tracking-[0.15em] text-white/40">
                {TYPE_CONFIG[selectedNode.type].label.replace(/s$/, '')}
              </span>
            </div>
            <p className="text-base font-semibold text-white">{selectedNode.label}</p>
            {selectedNode.meta && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {Object.entries(selectedNode.meta).map(([k, v]) => (
                  <span key={k} className="text-xs text-white/35">
                    <span className="text-white/20">{k}:</span> {v}
                  </span>
                ))}
              </div>
            )}
            {/* Connected edges */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rawEdges
                .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                .slice(0, 4)
                .map((e, i) => {
                  const otherId = e.source === selectedNode.id ? e.target : e.source;
                  const other = rawNodes.find(n => n.id === otherId);
                  return other ? (
                    <span key={i} className="text-[10px] rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-white/35">
                      {e.label} · {other.label}
                    </span>
                  ) : null;
                })}
            </div>
          </div>
          <button
            onClick={() => setSelectedNode(null)}
            className="text-white/20 hover:text-white/50 transition flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
