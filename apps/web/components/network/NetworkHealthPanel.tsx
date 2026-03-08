'use client';

/**
 * NetworkHealthPanel.tsx — Wave 162: Network Health Monitoring
 *
 * Operator panel showing:
 *   - Overall network health status
 *   - Per-node health (issuers + system)
 *   - Per-issuer health with credential stats
 *   - Federated payer/network health
 *
 * Data: GET /api/network/health
 * Refresh: every 30 seconds
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Building,
  CheckCircle,
  Globe,
  RefreshCw,
  Server,
  ShieldAlert,
  XCircle,
  Zap,
} from 'lucide-react';
import { getApiBase } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';

interface NodeHealth {
  nodeId: string;
  nodeName: string;
  nodeType: 'issuer' | 'verifier' | 'federation' | 'system';
  status: HealthStatus;
  latencyMs: number | null;
  credentialCount: number;
  activeCredentialCount: number;
  revocationRate: number;
  lastSeenAt: string | null;
  indicators: string[];
}

interface IssuerHealth {
  issuerId: string;
  issuerName: string;
  trustLevel: string;
  trustScore: number;
  status: HealthStatus;
  credentialsIssued: number;
  activeCredentials: number;
  revokedCredentials: number;
  revocationRatePct: number;
  lastActivityAt: string | null;
  indicators: string[];
}

interface PayerHealth {
  networkId: string;
  networkName: string;
  networkType: string;
  connectionStatus: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DISCONNECTED';
  healthStatus: HealthStatus;
  providerCount: number;
  lastSyncAt: string | null;
  indicators: string[];
}

interface NetworkHealthSummary {
  overallStatus: HealthStatus;
  nodes: NodeHealth[];
  issuers: IssuerHealth[];
  payers: PayerHealth[];
  stats: {
    totalNodes: number;
    healthyNodes: number;
    degradedNodes: number;
    criticalNodes: number;
    totalIssuers: number;
    healthyIssuers: number;
    federatedNetworks: number;
    activeNetworks: number;
  };
  computedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusConfig(status: HealthStatus): {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  label: string;
} {
  switch (status) {
    case 'HEALTHY':
      return { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Healthy' };
    case 'DEGRADED':
      return { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Degraded' };
    case 'CRITICAL':
      return { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Critical' };
    default:
      return { icon: ShieldAlert, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', label: 'Unknown' };
  }
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const cfg = statusConfig(status);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

function nodeTypeIcon(type: NodeHealth['nodeType']) {
  switch (type) {
    case 'issuer':     return Building;
    case 'verifier':   return CheckCircle;
    case 'federation': return Globe;
    case 'system':     return Server;
    default:           return Activity;
  }
}

function relativeTime(ts: string | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function NodeHealthList({ nodes }: { nodes: NodeHealth[] }) {
  if (nodes.length === 0) {
    return <p className="text-xs text-zinc-600 text-center py-4">No node data</p>;
  }

  return (
    <div className="space-y-2">
      {nodes.map((node) => {
        const Icon = nodeTypeIcon(node.nodeType);
        return (
          <div key={node.nodeId} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
            <Icon className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-300 truncate">{node.nodeName}</span>
                <StatusBadge status={node.status} />
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-zinc-600">
                <span>{node.activeCredentialCount}/{node.credentialCount} active creds</span>
                {node.latencyMs !== null && <span className="flex items-center gap-0.5"><Zap className="h-2 w-2" />{node.latencyMs}ms</span>}
                <span>seen {relativeTime(node.lastSeenAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IssuerHealthList({ issuers }: { issuers: IssuerHealth[] }) {
  if (issuers.length === 0) {
    return <p className="text-xs text-zinc-600 text-center py-4">No issuers registered</p>;
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {issuers.map((issuer) => (
        <div key={issuer.issuerId} className="px-3 py-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-300 truncate">{issuer.issuerName}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono text-zinc-500">score {issuer.trustScore}</span>
              <StatusBadge status={issuer.status} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-600">
            <span className="text-emerald-500">{issuer.activeCredentials} active</span>
            {issuer.revokedCredentials > 0 && (
              <span className="text-red-400">{issuer.revokedCredentials} revoked ({issuer.revocationRatePct}%)</span>
            )}
            <span>last activity {relativeTime(issuer.lastActivityAt)}</span>
          </div>
          {issuer.indicators.filter((i) => i !== 'Issuer in good standing').length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {issuer.indicators.filter((i) => i !== 'Issuer in good standing').map((ind, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px] text-amber-400">
                  <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                  {ind}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PayerHealthList({ payers }: { payers: PayerHealth[] }) {
  if (payers.length === 0) {
    return <p className="text-xs text-zinc-600 text-center py-4">No federated networks configured</p>;
  }

  return (
    <div className="space-y-2">
      {payers.map((payer) => (
        <div key={payer.networkId} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
          <Globe className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-zinc-300 truncate block">{payer.networkName}</span>
                <span className="text-[10px] text-zinc-600 capitalize">{payer.networkType.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-zinc-500">{payer.providerCount} nodes</span>
                <StatusBadge status={payer.healthStatus} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Overall Status Banner ─────────────────────────────────────────────────────

function OverallStatusBanner({
  status,
  stats,
}: {
  status: HealthStatus;
  stats: NetworkHealthSummary['stats'];
}) {
  const cfg = statusConfig(status);
  const Icon = cfg.icon;

  return (
    <div className={`flex items-center justify-between px-5 py-4 ${cfg.bg} border-b ${cfg.border}`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${cfg.color}`} />
        <div>
          <p className={`text-sm font-bold ${cfg.color}`}>Network {cfg.label}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {stats.healthyNodes}/{stats.totalNodes} nodes healthy · {stats.healthyIssuers}/{stats.totalIssuers} issuers healthy · {stats.activeNetworks}/{stats.federatedNetworks} federated
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        {[
          { label: 'Healthy', value: stats.healthyNodes, color: 'text-emerald-400' },
          { label: 'Degraded', value: stats.degradedNodes, color: 'text-amber-400' },
          { label: 'Critical', value: stats.criticalNodes, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function NetworkHealthPanel() {
  const [data, setData] = useState<NetworkHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeTab, setActiveTab] = useState<'nodes' | 'issuers' | 'federation'>('nodes');

  const apiBase = getApiBase();

  const fetchHealth = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/network/health`);
      if (res.ok) {
        setData(await res.json() as NetworkHealthSummary);
        setLastRefresh(new Date());
      } else {
        setError(`API ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchHealth();
    timerRef.current = setInterval(fetchHealth, 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchHealth]);

  const tabs: { key: typeof activeTab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'nodes',      label: 'Nodes',      icon: Server,   count: data?.nodes.length },
    { key: 'issuers',    label: 'Issuers',    icon: Building, count: data?.issuers.length },
    { key: 'federation', label: 'Federation', icon: Globe,    count: data?.payers.length },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-200">Network Health Monitor</span>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-zinc-600">
              {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={fetchHealth}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}

      {/* Overall status */}
      {data && (
        <OverallStatusBanner status={data.overallStatus} stats={data.stats} />
      )}

      {loading && !data ? (
        <div className="p-5 space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-zinc-800/40" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Tab bar */}
          <div className="flex border-b border-zinc-800 bg-zinc-900/40">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
                      activeTab === tab.key ? 'bg-blue-500/20 text-blue-300' : 'bg-zinc-800 text-zinc-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="p-4"
          >
            {activeTab === 'nodes'      && <NodeHealthList   nodes={data.nodes} />}
            {activeTab === 'issuers'    && <IssuerHealthList issuers={data.issuers} />}
            {activeTab === 'federation' && <PayerHealthList  payers={data.payers} />}
          </motion.div>
        </>
      ) : (
        <div className="flex items-center justify-center h-32">
          <p className="text-xs text-zinc-600">No health data available</p>
        </div>
      )}
    </div>
  );
}
