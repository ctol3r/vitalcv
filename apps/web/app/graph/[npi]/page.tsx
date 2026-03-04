'use client';

/**
 * Trust Graph Explorer — Wave 53
 *
 * Full-screen interactive graph explorer for a clinician's trust network.
 * Palantir Foundry + Stripe Radar aesthetic — clean, technical, authoritative.
 *
 * Layout:
 *   Left panel   — CRS readiness summary, credential list, gap report
 *   Center       — Interactive force-directed trust graph
 *   Right panel  — Audit timeline, verification events
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import TrustGraph from '@/components/graph/TrustGraph';
import type { GraphNode } from '@/components/graph/TrustGraph';

// ── Types ─────────────────────────────────────────────────────────────────

interface CrsSummary {
  policyId: string;
  facilityName: string;
  roleName: string;
  crsScore: number;
  crsBand: string;
  isCleared: boolean;
  matchedCount: number;
  missingCount: number;
}

interface AuditEntry {
  id: string;
  type: string;
  hash: string;
  createdAt: string;
}

interface Credential {
  id: string;
  source: string;
  status: string;
  lifecycleState: string;
  verifiedAt: string;
  expiresAt: string | null;
}

interface ExplorerData {
  npi: string;
  graph: {
    nodes: GraphNode[];
    edges: Array<{ source: string; target: string; label: string; weight?: number }>;
  };
  crs: {
    overallBand: string;
    overallScore: number;
    evaluations: CrsSummary[];
  };
  audit: {
    events: AuditEntry[];
    totalCount: number;
  };
  credentials: Credential[];
}

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
  revoked: 'bg-red-400',
};

const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const },
};

// ── Component ─────────────────────────────────────────────────────────────

export default function TrustGraphExplorerPage() {
  const params = useParams();
  const npi = typeof params.npi === 'string' ? params.npi : '';

  const [data, setData] = useState<ExplorerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    if (!npi) return;

    setLoading(true);
    fetch(`/api/graph/explorer/${npi}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ExplorerData>;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [npi]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading trust graph...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg">Failed to load graph</p>
          <p className="text-zinc-500 text-sm mt-1">{error}</p>
        </div>
      </main>
    );
  }

  const bandColor = BAND_COLORS[data.crs.overallBand] ?? 'text-zinc-400';
  const bandBg = BAND_BG[data.crs.overallBand] ?? 'bg-zinc-800/50 border-zinc-700';

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <motion.header
        {...fadeInUp}
        className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between"
      >
        <div>
          <h1 className="text-lg font-semibold">Trust Graph Explorer</h1>
          <p className="text-sm text-zinc-500">NPI: {data.npi}</p>
        </div>
        <div className={`px-4 py-2 rounded-lg border ${bandBg}`}>
          <span className="text-xs text-zinc-400">Overall CRS</span>
          <span className={`ml-2 text-lg font-bold ${bandColor}`}>
            {data.crs.overallScore}%
          </span>
        </div>
      </motion.header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* ── Left Panel ──────────────────────────────────────────── */}
        <motion.aside
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="w-80 border-r border-zinc-800 overflow-y-auto p-4 space-y-4 flex-shrink-0"
        >
          {/* CRS Summary */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Readiness Evaluations
            </h2>
            {data.crs.evaluations.length === 0 ? (
              <p className="text-xs text-zinc-600">No evaluations yet</p>
            ) : (
              <div className="space-y-2">
                {data.crs.evaluations.map((ev) => (
                  <div
                    key={ev.policyId}
                    className={`p-3 rounded-lg border ${BAND_BG[ev.crsBand] ?? 'bg-zinc-800/50 border-zinc-700'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{ev.roleName}</p>
                        <p className="text-xs text-zinc-500">{ev.facilityName}</p>
                      </div>
                      <span className={`text-sm font-bold ${BAND_COLORS[ev.crsBand] ?? ''}`}>
                        {ev.crsScore}%
                      </span>
                    </div>
                    <div className="mt-2 flex gap-3 text-xs text-zinc-500">
                      <span>✓ {ev.matchedCount} matched</span>
                      {ev.missingCount > 0 && (
                        <span className="text-red-400">✗ {ev.missingCount} missing</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Credentials */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Credentials ({data.credentials.length})
            </h2>
            <div className="space-y-1">
              {data.credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${STATUS_DOT[cred.status] ?? 'bg-zinc-500'}`}
                  />
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
          </section>
        </motion.aside>

        {/* ── Center: Graph ────────────────────────────────────────── */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.2 }}
          className="flex-1 relative"
        >
          <TrustGraph
            nodes={data.graph.nodes}
            edges={data.graph.edges}
            width={typeof window !== 'undefined' ? Math.max(window.innerWidth - 640, 400) : 800}
            height={typeof window !== 'undefined' ? window.innerHeight - 73 : 600}
            onNodeClick={handleNodeClick}
            className="w-full h-full"
          />

          {/* Selected node detail overlay */}
          <AnimatePresence>
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-4 right-4 glass rounded-xl p-4 w-72"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-sm">{selectedNode.label}</h3>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-zinc-500 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-1 capitalize">{selectedNode.group}</p>
                {selectedNode.status && (
                  <p className="text-xs mt-2">
                    <span className="text-zinc-500">Status:</span>{' '}
                    <span className={BAND_COLORS[selectedNode.status] ?? 'text-zinc-300'}>
                      {selectedNode.status}
                    </span>
                  </p>
                )}
                {selectedNode.auditHash && (
                  <p className="text-[10px] font-mono text-zinc-600 mt-1 truncate">
                    Hash: {selectedNode.auditHash}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Right Panel ─────────────────────────────────────────── */}
        <motion.aside
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.3 }}
          className="w-80 border-l border-zinc-800 overflow-y-auto p-4 space-y-4 flex-shrink-0"
        >
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Audit Timeline ({data.audit.totalCount})
            </h2>
            {data.audit.events.length === 0 ? (
              <p className="text-xs text-zinc-600">No audit events</p>
            ) : (
              <div className="space-y-1">
                {data.audit.events.map((event) => (
                  <div
                    key={event.id}
                    className="px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-medium text-zinc-300">
                        {event.type.replace(/_/g, ' ')}
                      </p>
                    </div>
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
      </div>
    </main>
  );
}
