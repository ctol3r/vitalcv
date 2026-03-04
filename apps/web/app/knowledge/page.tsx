'use client';

/**
 * Knowledge Graph Page — Wave 58
 *
 * Obsidian/Roam-style bidirectional knowledge graph at /knowledge.
 * Combines data from /api/graph/:npi and /api/decisions/:npi.
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BidirectionalGraph } from '@/components/knowledge/BidirectionalGraph';
import type { KnowledgeNode, KnowledgeEdge } from '@/components/knowledge/BidirectionalGraph';

// ── Types ─────────────────────────────────────────────────────────────────

interface GraphApiNode { id: string; label: string; group: string; val: number }
interface GraphApiEdge { source: string; target: string; label: string }
interface DecisionCapsule {
  id: string; decisionType: string; status: string;
  credentialIds: string[]; issuerIds: string[]; artifactHash: string;
}
interface GraphResponse {
  npi: string;
  graph: { nodes: GraphApiNode[]; edges: GraphApiEdge[] };
  crs: { overallBand: string; overallScore: number };
}
interface DecisionResponse { capsules: DecisionCapsule[] }

// ── Constants ─────────────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const },
};

const GROUP_LABELS: Record<string, string> = {
  credential: 'Credentials', issuer: 'Issuers', decision: 'Decisions',
  employer: 'Employers', monitoring: 'Monitoring', clinician: 'Clinicians',
};
const GROUP_DOTS: Record<string, string> = {
  credential: 'bg-amber-500', issuer: 'bg-blue-500', decision: 'bg-orange-500',
  employer: 'bg-violet-500', monitoring: 'bg-pink-500', clinician: 'bg-emerald-500',
};

const VALID_GROUPS = new Set(['credential', 'issuer', 'employer', 'clinician', 'decision', 'monitoring']);

// ── Data Merging ──────────────────────────────────────────────────────────

function mergeData(graph: GraphResponse | null, decisions: DecisionResponse | null): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
  const nodeMap = new Map<string, KnowledgeNode>();
  const edges: KnowledgeEdge[] = [];

  if (graph) {
    for (const n of graph.graph.nodes) {
      const group = (VALID_GROUPS.has(n.group) ? n.group : 'credential') as KnowledgeNode['group'];
      nodeMap.set(n.id, { id: n.id, label: n.label, group });
    }
    for (const e of graph.graph.edges) {
      edges.push({ source: e.source, target: e.target, relation: e.label, bidirectional: e.label === 'VERIFIED_BY' || e.label === 'ATTESTED_BY' });
    }
  }

  if (decisions) {
    for (const c of decisions.capsules) {
      const decId = `decision-${c.id}`;
      if (!nodeMap.has(decId)) {
        nodeMap.set(decId, { id: decId, label: `${c.decisionType} (${c.status})`, group: 'decision', metadata: { status: c.status, hash: c.artifactHash.slice(0, 12) } });
      }
      for (const credId of c.credentialIds) {
        if (nodeMap.has(credId)) edges.push({ source: credId, target: decId, relation: 'INFORMS' });
      }
      for (const issuerId of c.issuerIds) {
        if (nodeMap.has(issuerId)) edges.push({ source: decId, target: issuerId, relation: 'EVALUATED_FOR' });
      }
    }
  }

  const employers = [...nodeMap.values()].filter((n) => n.group === 'employer');
  if (employers.length > 0) {
    const monId = 'monitoring-trust-daemon';
    nodeMap.set(monId, { id: monId, label: 'Trust Daemon', group: 'monitoring' });
    for (const emp of employers) edges.push({ source: emp.id, target: monId, relation: 'MONITORED_BY', bidirectional: true });
  }

  return { nodes: [...nodeMap.values()], edges };
}

// ── Node Detail ───────────────────────────────────────────────────────────

function NodeDetail({ node, edges, nodes }: { node: KnowledgeNode; edges: KnowledgeEdge[]; nodes: KnowledgeNode[] }) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const conns = edges.filter((e) => e.source === node.id || e.target === node.id);

  return (
    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-3 h-3 rounded-full ${GROUP_DOTS[node.group] ?? 'bg-zinc-500'}`} />
        <h3 className="text-sm font-semibold text-zinc-200">{node.label}</h3>
      </div>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{GROUP_LABELS[node.group] ?? node.group}</p>
      {node.metadata && Object.keys(node.metadata).length > 0 && (
        <div className="mt-3 space-y-1">
          {Object.entries(node.metadata).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-[10px] text-zinc-500">{k}</span>
              <span className="text-[10px] font-mono text-zinc-400">{v}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 pt-2 border-t border-white/[0.05]">
        <p className="text-[10px] text-zinc-500 mb-1">{conns.length} connection{conns.length !== 1 ? 's' : ''}</p>
        <div className="space-y-1">
          {conns.slice(0, 6).map((edge, i) => {
            const otherId = edge.source === node.id ? edge.target : edge.source;
            const other = nodeMap.get(otherId);
            return (
              <div key={i} className="flex items-center gap-1.5 text-[9px]">
                <span className="text-zinc-600">{edge.source === node.id ? '→' : '←'}</span>
                <span className="text-zinc-400">{other?.label ?? otherId.slice(0, 12)}</span>
                <span className="text-zinc-600 ml-auto">{edge.relation}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [npiInput, setNpiInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [decisionData, setDecisionData] = useState<DecisionResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadData = useCallback(async (npi: string) => {
    setLoading(true); setSelectedId(null);
    try {
      const [gRes, dRes] = await Promise.allSettled([
        fetch(`/api/graph/explorer/${npi}`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<GraphResponse>; }),
        fetch(`/api/decisions/${npi}`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<DecisionResponse>; }),
      ]);
      setGraphData(gRes.status === 'fulfilled' ? gRes.value : null);
      setDecisionData(dRes.status === 'fulfilled' ? dRes.value : null);
    } finally { setLoading(false); }
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{10}$/.test(npiInput.trim())) loadData(npiInput.trim());
  }, [npiInput, loadData]);

  const merged = useMemo(() => mergeData(graphData, decisionData), [graphData, decisionData]);
  const selectedNode = useMemo(() => merged.nodes.find((n) => n.id === selectedId) ?? null, [merged.nodes, selectedId]);
  const hasData = graphData !== null || decisionData !== null;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <motion.header {...fadeUp} className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Knowledge Graph</h1>
          <p className="text-xs text-zinc-500">Bidirectional credential authority network</p>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input type="text" value={npiInput} onChange={(e) => setNpiInput(e.target.value)} placeholder="Enter NPI (10 digits)" maxLength={10}
            className="bg-white/[0.05] border border-zinc-700 rounded-lg px-3 py-1.5 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-48" />
          <button type="submit" disabled={!/^\d{10}$/.test(npiInput.trim()) || loading}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors">
            {loading ? 'Loading...' : 'Explore'}
          </button>
        </form>
      </motion.header>

      {!hasData && !loading && (
        <div className="flex items-center justify-center h-[calc(100vh-73px)]">
          <motion.div {...fadeUp} className="text-center max-w-md">
            <div className="text-5xl mb-4 opacity-20">⬡</div>
            <h2 className="text-xl font-semibold text-zinc-300 mb-2">Knowledge Graph</h2>
            <p className="text-sm text-zinc-500">Enter an NPI to explore bidirectional relationships between credentials, issuers, decisions, and employers.</p>
          </motion.div>
        </div>
      )}

      {hasData && (
        <div className="flex h-[calc(100vh-73px)]">
          <div className="flex-1 relative">
            <BidirectionalGraph nodes={merged.nodes} edges={merged.edges}
              width={typeof window !== 'undefined' ? Math.max(window.innerWidth - (selectedNode ? 288 : 0), 400) : 800}
              height={typeof window !== 'undefined' ? window.innerHeight - 73 : 600}
              className="w-full h-full"
              onNodeClick={(id) => setSelectedId(id === selectedId ? null : id)} />
            <motion.div {...fadeUp} className="absolute bottom-4 left-4 glass rounded-lg px-3 py-2 flex gap-3">
              {Object.entries(GROUP_LABELS).map(([g, label]) => (
                <div key={g} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${GROUP_DOTS[g] ?? 'bg-zinc-500'}`} />
                  <span className="text-[9px] text-zinc-500">{label}</span>
                </div>
              ))}
            </motion.div>
            <motion.div {...fadeUp} className="absolute top-4 left-4 glass rounded-lg px-3 py-2">
              <span className="text-[10px] text-zinc-500">{merged.nodes.length} nodes · {merged.edges.length} edges</span>
            </motion.div>
          </div>
          <AnimatePresence>
            {selectedNode && (
              <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 288, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} className="border-l border-zinc-800 p-4 overflow-y-auto flex-shrink-0">
                <NodeDetail node={selectedNode} edges={merged.edges} nodes={merged.nodes} />
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
}
