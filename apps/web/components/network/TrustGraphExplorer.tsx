'use client';

/**
 * TrustGraphExplorer.tsx — Wave 165: Trust Graph Explorer
 *
 * Operator-grade search + inspect interface for the trust network.
 * Supports search by NPI, issuer name, payer, or credential type.
 *
 * Data: GET /api/network/health + /api/directory + /api/network/telemetry
 * Architecture: client-side search over cached result sets (no per-keystroke API calls)
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Building,
  ChevronRight,
  FileKey2,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  User,
  X,
} from 'lucide-react';
import NodeInspector, { type TrustNode, type NodeKind } from './NodeInspector';

// ── Types ──────────────────────────────────────────────────────────────────────

interface IssuerHealth {
  issuerId: string;
  issuerName: string;
  trustLevel: string;
  trustScore: number;
  status: string;
  credentialsIssued: number;
  activeCredentials: number;
  revokedCredentials: number;
  lastActivityAt: string | null;
}

interface PayerHealth {
  networkId: string;
  networkName: string;
  networkType: string;
  connectionStatus: string;
  healthStatus: string;
  providerCount: number;
  lastSyncAt: string | null;
}

interface DirectoryEntry {
  npi: string;
  fullName: string;
  specialties: string[];
  credentialCount: number;
  activeCredentials: number;
  revokedCredentials?: number;
  primaryIssuer: string | null;
  credentialHealth: string;
  trustScore: number;
  lastVerifiedAt: string | null;
}

type SearchFilter = 'all' | 'npi' | 'issuer' | 'payer' | 'credential';

// ── Helpers ────────────────────────────────────────────────────────────────────

function kindColor(kind: NodeKind): string {
  switch (kind) {
    case 'issuer':     return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    case 'clinician':  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'payer':      return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
    case 'credential': return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
  }
}

function kindLabel(kind: NodeKind): string {
  switch (kind) {
    case 'issuer':     return 'Issuer';
    case 'clinician':  return 'NPI';
    case 'payer':      return 'Payer';
    case 'credential': return 'Credential';
  }
}

function kindIcon(kind: NodeKind): React.ElementType {
  switch (kind) {
    case 'issuer':     return Building;
    case 'clinician':  return User;
    case 'payer':      return Shield;
    case 'credential': return FileKey2;
  }
}

// ── Result Row ────────────────────────────────────────────────────────────────

function ResultRow({
  node,
  selected,
  onClick,
}: {
  node: TrustNode;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = kindIcon(node.kind);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
        selected
          ? 'bg-blue-500/10 border border-blue-500/20'
          : 'bg-zinc-800/30 border border-transparent hover:bg-zinc-800/60 hover:border-zinc-700/40'
      }`}
    >
      <div className="shrink-0 w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-200 truncate">{node.name}</p>
        <p className="text-[10px] text-zinc-600 truncate">
          {node.trustScore !== undefined && <span className="mr-2">score {node.trustScore}</span>}
          {node.status}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${kindColor(node.kind)}`}>
          {kindLabel(node.kind)}
        </span>
        <ChevronRight className="h-3 w-3 text-zinc-600" />
      </div>
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TrustGraphExplorer() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [allNodes, setAllNodes] = useState<TrustNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<TrustNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadNodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, dirRes] = await Promise.all([
        fetch('/api/network/health'),
        fetch('/api/directory?limit=200'),
      ]);

      const nodes: TrustNode[] = [];

      if (healthRes.ok) {
        const health = await healthRes.json() as {
          issuers: IssuerHealth[];
          payers: PayerHealth[];
        };

        // Issuer nodes
        for (const issuer of (health.issuers ?? [])) {
          nodes.push({
            id: issuer.issuerId,
            kind: 'issuer',
            name: issuer.issuerName,
            trustScore: issuer.trustScore,
            trustLevel: issuer.trustLevel,
            status: issuer.status,
            credentialCount: issuer.credentialsIssued,
            activeCredentials: issuer.activeCredentials,
            revokedCredentials: issuer.revokedCredentials,
            lastActivity: issuer.lastActivityAt ?? undefined,
          });
        }

        // Payer nodes
        for (const payer of (health.payers ?? [])) {
          nodes.push({
            id: payer.networkId,
            kind: 'payer',
            name: payer.networkName,
            status: payer.healthStatus,
            credentialCount: payer.providerCount,
            lastActivity: payer.lastSyncAt ?? undefined,
            metadata: {
              type: payer.networkType.replace(/_/g, ' '),
              connection: payer.connectionStatus,
              providers: payer.providerCount,
            },
          });
        }
      }

      if (dirRes.ok) {
        const dir = await dirRes.json() as { entries: DirectoryEntry[] };
        for (const entry of (dir.entries ?? [])) {
          nodes.push({
            id: entry.npi,
            kind: 'clinician',
            name: entry.fullName,
            trustScore: entry.trustScore,
            status: entry.credentialHealth,
            credentialCount: entry.credentialCount,
            activeCredentials: entry.activeCredentials,
            revokedCredentials: entry.revokedCredentials ?? 0,
            issuerName: entry.primaryIssuer ?? undefined,
            lastActivity: entry.lastVerifiedAt ?? undefined,
            metadata: {
              npi: entry.npi,
              specialties: entry.specialties.join(', ') || '—',
            },
          });
        }
      }

      setAllNodes(nodes);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load network nodes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNodes(); }, [loadNodes]);

  // Client-side search + filter
  const results = allNodes.filter((node) => {
    if (filter !== 'all') {
      const kindMap: Record<SearchFilter, NodeKind | undefined> = {
        all: undefined, npi: 'clinician', issuer: 'issuer', payer: 'payer', credential: 'credential',
      };
      if (node.kind !== kindMap[filter]) return false;
    }
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      node.name.toLowerCase().includes(q) ||
      node.id.toLowerCase().includes(q) ||
      (node.issuerName?.toLowerCase().includes(q) ?? false) ||
      (node.trustLevel?.toLowerCase().includes(q) ?? false)
    );
  });

  const filters: { key: SearchFilter; label: string; icon: React.ElementType }[] = [
    { key: 'all',        label: 'All',        icon: Activity },
    { key: 'npi',        label: 'NPI',        icon: User },
    { key: 'issuer',     label: 'Issuer',     icon: Building },
    { key: 'payer',      label: 'Payer',      icon: Shield },
    { key: 'credential', label: 'Credential', icon: FileKey2 },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-zinc-200">Trust Graph Explorer</span>
          {allNodes.length > 0 && (
            <span className="text-[10px] font-mono text-zinc-600">{allNodes.length} nodes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-zinc-600">
              {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={loadNodes}
            disabled={loading}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex" style={{ minHeight: '420px' }}>
        {/* Left: search + results */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-zinc-800">
          {/* Search bar */}
          <div className="p-4 border-b border-zinc-800 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search NPI, issuer, payer, or credential…"
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              {filters.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                      filter === f.key
                        ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                        : 'bg-zinc-800/40 border-zinc-700/30 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/70'
                    }`}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {loading ? (
              <div className="space-y-1.5 animate-pulse">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-zinc-800/40" />
                ))}
              </div>
            ) : error ? (
              <div className="text-xs text-amber-400 text-center py-6">{error}</div>
            ) : results.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-6 w-6 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-600">
                  {query ? `No results for "${query}"` : 'No nodes found'}
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {results.slice(0, 50).map((node) => (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                  >
                    <ResultRow
                      node={node}
                      selected={selectedNode?.id === node.id}
                      onClick={() => setSelectedNode(prev => prev?.id === node.id ? null : node)}
                    />
                  </motion.div>
                ))}
                {results.length > 50 && (
                  <p className="text-center text-[10px] text-zinc-600 py-2">
                    Showing 50 of {results.length} — refine your search
                  </p>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Right: node inspector */}
        <div className="p-3">
          {selectedNode ? (
            <NodeInspector node={selectedNode} onClose={() => setSelectedNode(null)} />
          ) : (
            <div className="w-72 h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-10 h-10 rounded-xl bg-zinc-800/60 flex items-center justify-center mb-3">
                {loading ? (
                  <Loader2 className="h-4 w-4 text-zinc-600 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 text-zinc-600" />
                )}
              </div>
              <p className="text-xs font-medium text-zinc-500">Select a node</p>
              <p className="text-[11px] text-zinc-700 mt-1">
                Search and click any issuer, clinician, or payer to inspect its trust profile.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
