'use client';

/**
 * Knowledge Graph Page — Wave 58
 *
 * Interactive knowledge graph explorer with NPI input,
 * CRS summary sidebar, and force-directed visualization.
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import TrustGraph from '@/components/graph/TrustGraph';
import type { GraphNode } from '@/components/graph/TrustGraph';
import { fetchKnowledgeGraph } from '@/lib/api';
import type { KnowledgeGraphData } from '@/types/graph';
import { EMPTY_GRAPH_DATA } from '@/types/graph';

// ── Constants ─────────────────────────────────────────────────────────────

const BAND_COLORS: Record<string, string> = {
  GREEN: 'text-emerald-400',
  YELLOW: 'text-amber-400',
  RED: 'text-red-400',
};

const BAND_BG: Record<string, string> = {
  GREEN: 'bg-emerald-500/10 border-emerald-500/20',
  YELLOW: 'bg-amber-500/10 border-amber-500/20',
  RED: 'bg-red-500/10 border-red-500/20',
};

const STATUS_DOT: Record<string, string> = {
  Valid: 'bg-emerald-400',
  active: 'bg-emerald-400',
  ACTIVE: 'bg-emerald-400',
  expired: 'bg-zinc-500',
  EXPIRED: 'bg-zinc-500',
  REVOKED: 'bg-red-400',
};

// ── Component ─────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [npi, setNpi] = useState('');
  const [data, setData] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const loadGraph = useCallback(async (targetNpi: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchKnowledgeGraph(targetNpi);
      if (result) {
        setData(result);
      } else {
        setData({ ...EMPTY_GRAPH_DATA, npi: targetNpi });
        setError('No graph data available for this NPI.');
      }
    } catch {
      setData({ ...EMPTY_GRAPH_DATA, npi: targetNpi });
      setError('Failed to load knowledge graph.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = npi.trim();
    if (/^\d{10}$/.test(trimmed)) loadGraph(trimmed);
  }, [npi, loadGraph]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  const bandColor = data ? BAND_COLORS[data.crs.overallBand] ?? 'text-zinc-400' : '';
  const bandBg = data ? BAND_BG[data.crs.overallBand] ?? 'bg-zinc-800/50 border-zinc-700' : '';

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Knowledge Graph</h1>
            <p className="text-xs text-zinc-500">
              Explore the trust network for any clinician
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={npi}
              onChange={(e) => setNpi(e.target.value)}
              placeholder="Enter NPI"
              maxLength={10}
              className="w-40 bg-white/[0.05] border border-zinc-700 rounded-lg px-3 py-1.5 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <button
              type="submit"
              disabled={!/^\d{10}$/.test(npi.trim()) || loading}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? '...' : 'Load'}
            </button>
          </form>

          {data && (
            <div className={`px-4 py-2 rounded-lg border ${bandBg}`}>
              <span className="text-xs text-zinc-400">CRS</span>
              <span className={`ml-2 text-lg font-bold ${bandColor}`}>
                {data.crs.overallScore}%
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Empty state */}
      {!data && !loading && (
        <div className="flex items-center justify-center h-[calc(100vh-73px)]">
          <div className="text-center">
            <p className="text-zinc-500 text-lg">Enter an NPI to explore the trust network</p>
            <p className="text-zinc-600 text-sm mt-2">
              The knowledge graph shows credentials, issuers, and trust relationships
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-[calc(100vh-73px)]">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-400">Loading knowledge graph...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20">
          <p className="text-sm text-red-400 text-center">{error}</p>
        </div>
      )}

      {/* Graph + Sidebar */}
      {data && !loading && (
        <div className="flex h-[calc(100vh-73px)]">
          {/* Sidebar */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-72 border-r border-zinc-800 overflow-y-auto p-4 space-y-4 flex-shrink-0"
          >
            {/* Credentials */}
            <section>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Credentials ({data.credentials.length})
              </h2>
              {data.credentials.length === 0 ? (
                <p className="text-xs text-zinc-600">No credentials found</p>
              ) : (
                <div className="space-y-1">
                  {data.credentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full ${STATUS_DOT[cred.status] ?? 'bg-zinc-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{cred.source}</p>
                        <p className="text-[10px] text-zinc-600">
                          {cred.lifecycleState}
                          {cred.expiresAt && ` · exp ${new Date(cred.expiresAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Audit Timeline */}
            <section>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Audit Events ({data.audit.totalCount})
              </h2>
              {data.audit.events.length === 0 ? (
                <p className="text-xs text-zinc-600">No audit events</p>
              ) : (
                <div className="space-y-1">
                  {data.audit.events.map((event) => (
                    <div key={event.id} className="px-3 py-2 rounded-lg bg-white/[0.03]">
                      <p className="text-xs text-zinc-300">{event.type.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                      <p className="text-[10px] font-mono text-zinc-700 truncate">
                        {event.hash.slice(0, 24)}…
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </motion.aside>

          {/* Graph */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 relative"
          >
            {data.graph.nodes.length > 0 ? (
              <TrustGraph
                nodes={data.graph.nodes}
                edges={data.graph.edges}
                width={typeof window !== 'undefined' ? Math.max(window.innerWidth - 288, 400) : 800}
                height={typeof window !== 'undefined' ? window.innerHeight - 73 : 600}
                onNodeClick={handleNodeClick}
                className="w-full h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-zinc-600">No graph data available</p>
              </div>
            )}

            {/* Selected node detail */}
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute top-4 right-4 glass rounded-xl p-4 w-64"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-sm">{selectedNode.label}</h3>
                  <button onClick={() => setSelectedNode(null)} className="text-zinc-500 hover:text-white text-xs">
                    ✕
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-1 capitalize">{selectedNode.group}</p>
                {selectedNode.status && (
                  <p className="text-xs mt-2">
                    <span className="text-zinc-500">Status:</span>{' '}
                    <span className={BAND_COLORS[selectedNode.status] ?? 'text-zinc-300'}>{selectedNode.status}</span>
                  </p>
                )}
                {selectedNode.auditHash && (
                  <p className="text-[10px] font-mono text-zinc-600 mt-1 truncate">
                    Hash: {selectedNode.auditHash}
                  </p>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </main>
  );
}
