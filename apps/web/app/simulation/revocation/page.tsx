'use client';

/**
 * Revocation Blast Radius Simulation — Wave 59
 *
 * Route: /simulation/revocation
 *
 * Simulates credential revocation and visualizes cascading impact
 * across the trust network. Fetches from /api/graph/:npi and
 * /api/decisions/:npi, then computes affected entities client-side.
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RevocationGraph } from '@/components/simulation/RevocationGraph';
import { ImpactAlertPanel } from '@/components/simulation/ImpactAlertPanel';

// ── Types ─────────────────────────────────────────────────────────────────

interface GraphApiNode { id: string; label: string; group: string; val: number }
interface GraphApiEdge { source: string; target: string; label: string }
interface DecisionCapsule {
  id: string; subjectNpi: string; decisionType: string; status: string;
  credentialIds: string[]; issuerIds: string[]; artifactHash: string;
}

interface GraphResponse {
  npi: string;
  graph: { nodes: GraphApiNode[]; edges: GraphApiEdge[] };
  crs: { overallBand: string; overallScore: number };
  credentials: Array<{ id: string; source: string; status: string }>;
}

interface DecisionResponse {
  capsules: DecisionCapsule[];
  totalCount: number;
}

export interface SimNode {
  id: string;
  label: string;
  group: string;
  affected: boolean;
  directlyRevoked: boolean;
}

export interface SimEdge {
  source: string;
  target: string;
  relation: string;
  affected: boolean;
}

export interface ImpactResult {
  revokedCredentialId: string;
  revokedCredentialLabel: string;
  affectedNodes: SimNode[];
  affectedEdges: SimEdge[];
  impactedEmployers: string[];
  impactedDecisions: string[];
  impactedDeployments: string[];
  estimatedFinancialImpact: number;
  cascadeDepth: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const },
};

// ── Impact Computation ────────────────────────────────────────────────────

function computeBlastRadius(
  revokedId: string,
  graphData: GraphResponse,
  decisionData: DecisionResponse | null,
): ImpactResult {
  const allNodes: SimNode[] = graphData.graph.nodes.map((n) => ({
    id: n.id, label: n.label, group: n.group, affected: false, directlyRevoked: false,
  }));
  const allEdges: SimEdge[] = graphData.graph.edges.map((e) => ({
    source: e.source, target: e.target, relation: e.label, affected: false,
  }));

  // Build adjacency (undirected for cascade)
  const adj = new Map<string, Set<string>>();
  for (const e of allEdges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }

  // BFS cascade from revoked credential
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: revokedId, depth: 0 }];
  let maxDepth = 0;

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item || visited.has(item.id)) continue;
    visited.add(item.id);
    maxDepth = Math.max(maxDepth, item.depth);

    const neighbors = adj.get(item.id);
    if (neighbors) {
      for (const nId of neighbors) {
        if (!visited.has(nId)) queue.push({ id: nId, depth: item.depth + 1 });
      }
    }
  }

  // Mark affected
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  for (const id of visited) {
    const node = nodeMap.get(id);
    if (node) {
      node.affected = true;
      if (id === revokedId) node.directlyRevoked = true;
    }
  }
  for (const e of allEdges) {
    if (visited.has(e.source) && visited.has(e.target)) e.affected = true;
  }

  // Categorize impact
  const affectedNodes = allNodes.filter((n) => n.affected);
  const impactedEmployers = affectedNodes.filter((n) => n.group === 'employer').map((n) => n.label);
  const impactedDeployments = affectedNodes.filter((n) => n.group === 'policy').map((n) => n.label);

  // Cross-reference decisions
  const impactedDecisions: string[] = [];
  if (decisionData) {
    for (const cap of decisionData.capsules) {
      if (cap.credentialIds.some((cId) => visited.has(cId))) {
        impactedDecisions.push(`${cap.decisionType} (${cap.status})`);
      }
    }
  }

  // Estimate financial impact (stub: $15K per employer, $5K per decision)
  const estimatedFinancialImpact = impactedEmployers.length * 15000 + impactedDecisions.length * 5000;

  const revokedNode = nodeMap.get(revokedId);

  return {
    revokedCredentialId: revokedId,
    revokedCredentialLabel: revokedNode?.label ?? revokedId.slice(0, 12),
    affectedNodes: allNodes,
    affectedEdges: allEdges,
    impactedEmployers,
    impactedDecisions,
    impactedDeployments,
    estimatedFinancialImpact,
    cascadeDepth: maxDepth,
  };
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function RevocationSimulationPage() {
  const [npiInput, setNpiInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [decisionData, setDecisionData] = useState<DecisionResponse | null>(null);
  const [selectedCredId, setSelectedCredId] = useState<string | null>(null);
  const [impact, setImpact] = useState<ImpactResult | null>(null);

  const loadData = useCallback(async (npi: string) => {
    setLoading(true); setImpact(null); setSelectedCredId(null);
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

  const credentials = useMemo(() => {
    if (!graphData) return [];
    return graphData.graph.nodes.filter((n) => n.group === 'credential');
  }, [graphData]);

  const handleRevoke = useCallback((credId: string) => {
    if (!graphData) return;
    setSelectedCredId(credId);
    setImpact(computeBlastRadius(credId, graphData, decisionData));
  }, [graphData, decisionData]);

  const hasData = graphData !== null;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <motion.header {...fadeUp} className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Revocation Blast Radius</h1>
          <p className="text-xs text-zinc-500">Simulate credential revocations and visualize cascading impact</p>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input type="text" value={npiInput} onChange={(e) => setNpiInput(e.target.value)} placeholder="Enter NPI" maxLength={10}
            className="bg-white/[0.05] border border-zinc-700 rounded-lg px-3 py-1.5 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-48" />
          <button type="submit" disabled={!/^\d{10}$/.test(npiInput.trim()) || loading}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors">
            {loading ? 'Loading...' : 'Load Network'}
          </button>
        </form>
      </motion.header>

      {/* Empty state */}
      {!hasData && !loading && (
        <div className="flex items-center justify-center h-[calc(100vh-73px)]">
          <motion.div {...fadeUp} className="text-center max-w-md">
            <div className="text-5xl mb-4 opacity-20">💥</div>
            <h2 className="text-xl font-semibold text-zinc-300 mb-2">Blast Radius Simulator</h2>
            <p className="text-sm text-zinc-500">Enter a clinician NPI to load their trust network, then select a credential to simulate revocation and view the cascading impact.</p>
          </motion.div>
        </div>
      )}

      {/* Loaded state */}
      {hasData && (
        <div className="flex h-[calc(100vh-73px)]">
          {/* Left — Credential Selector */}
          <motion.aside {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="w-64 border-r border-zinc-800 overflow-y-auto p-4 flex-shrink-0">
            <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">
              Select Credential to Revoke ({credentials.length})
            </h3>
            <div className="space-y-1">
              {credentials.map((cred) => (
                <button
                  key={cred.id}
                  onClick={() => handleRevoke(cred.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors ${
                    selectedCredId === cred.id
                      ? 'bg-red-500/15 border border-red-500/30 text-red-300'
                      : 'bg-white/[0.02] hover:bg-white/[0.05] text-zinc-300'
                  }`}
                >
                  <p className="font-medium truncate">{cred.label}</p>
                  <p className="text-[9px] text-zinc-600 mt-0.5 font-mono">{cred.id.slice(0, 12)}…</p>
                </button>
              ))}
            </div>
          </motion.aside>

          {/* Center — Graph */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }} className="flex-1 relative">
            <RevocationGraph
              nodes={impact?.affectedNodes ?? graphData.graph.nodes.map((n) => ({ ...n, affected: false, directlyRevoked: false }))}
              edges={impact?.affectedEdges ?? graphData.graph.edges.map((e) => ({ ...e, relation: e.label, affected: false }))}
              width={typeof window !== 'undefined' ? Math.max(window.innerWidth - 576, 400) : 700}
              height={typeof window !== 'undefined' ? window.innerHeight - 73 : 600}
            />
            {impact && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-4 left-4 glass rounded-lg px-3 py-2"
              >
                <span className="text-[10px] text-red-400 font-medium">
                  ⚡ Cascade depth: {impact.cascadeDepth} · {impact.affectedNodes.filter((n) => n.affected).length} nodes impacted
                </span>
              </motion.div>
            )}
          </motion.div>

          {/* Right — Impact Panel */}
          <motion.aside {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.3 }}
            className="w-72 border-l border-zinc-800 overflow-y-auto flex-shrink-0">
            <AnimatePresence mode="wait">
              {impact ? (
                <ImpactAlertPanel key="impact" impact={impact} />
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-center h-full">
                  <p className="text-xs text-zinc-600 text-center px-6">
                    Select a credential from the left panel to simulate revocation
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </div>
      )}
    </main>
  );
}
