'use client';

/**
 * FederationHealthPanel — Phase 6: Operator Control Surface
 *
 * Shows federation health across all registered entities.
 * Degraded nodes are highlighted.
 *
 * APIs:
 *   GET /api/federation/health          — overall federation health
 *   GET /api/federation/health/:entity  — per-entity chain health (Phase 4)
 *   GET /api/network/peers              — federated peer list
 */

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Network, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface FederationHealthSummary {
  healthScore: number;
  totalEntities: number;
  healthyEntities: number;
  degradedEntities: string[];
  expiredChains: number;
  keyRotationsDue: number;
  computedAt: string;
}

interface EntityHealth {
  entityId: string;
  status: 'healthy' | 'degraded' | 'expired' | 'unknown';
  chainValid: boolean;
  metadataExpired: boolean;
  keyRotationDue: boolean;
  trustScore?: number;
}

const base = () =>
  (
    (typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_API_BASE ?? process.env.NEXT_PUBLIC_BACKEND_URL
      : '') ?? ''
  ).replace(/\/$/, '');

function StatusIcon({ status }: { status: EntityHealth['status'] }) {
  if (status === 'healthy') return <CheckCircle className="h-3 w-3 text-emerald-400" />;
  if (status === 'degraded') return <AlertCircle className="h-3 w-3 text-amber-400" />;
  if (status === 'expired') return <XCircle className="h-3 w-3 text-red-400" />;
  return <AlertCircle className="h-3 w-3 text-zinc-500" />;
}

export function FederationHealthPanel({ pollIntervalMs = 30_000 }: { pollIntervalMs?: number }) {
  const [summary, setSummary] = useState<FederationHealthSummary | null>(null);
  const [entities, setEntities] = useState<EntityHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, peersRes] = await Promise.allSettled([
        fetch(`${base()}/api/federation/health`),
        fetch(`${base()}/api/network/peers`),
      ]);

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        setSummary(await healthRes.value.json());
      }

      if (peersRes.status === 'fulfilled' && peersRes.value.ok) {
        const peers = await peersRes.value.json();
        const peerList: { networkId?: string; id?: string; networkName?: string; status?: string }[] =
          Array.isArray(peers) ? peers : (peers.networks ?? peers.peers ?? []);
        setEntities(
          peerList.map((p) => ({
            entityId: p.networkId ?? p.id ?? 'unknown',
            status: p.status === 'active' ? 'healthy' : p.status === 'suspended' ? 'degraded' : 'unknown',
            chainValid: p.status === 'active',
            metadataExpired: false,
            keyRotationDue: false,
          }))
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load federation health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const iv = setInterval(fetchHealth, pollIntervalMs);
    return () => clearInterval(iv);
  }, [fetchHealth, pollIntervalMs]);

  const scoreColor =
    !summary ? 'text-zinc-400'
    : summary.healthScore >= 90 ? 'text-emerald-400'
    : summary.healthScore >= 70 ? 'text-blue-400'
    : summary.healthScore >= 50 ? 'text-amber-400'
    : 'text-red-400';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Federation Health</p>
        <button onClick={fetchHealth} className="text-zinc-600 hover:text-zinc-300 transition-colors">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 rounded-lg bg-red-500/[0.05] border border-red-500/20 p-2">{error}</div>
      )}

      {summary && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Health Score', value: `${summary.healthScore}%`, color: scoreColor },
            { label: 'Entities', value: summary.totalEntities, color: 'text-zinc-200' },
            { label: 'Degraded', value: summary.degradedEntities?.length ?? 0, color: summary.degradedEntities?.length ? 'text-amber-400' : 'text-zinc-200' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-zinc-800 bg-white/[0.02] p-2.5 text-center">
              <p className={`text-base font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Degraded entities callout */}
      {summary && summary.degradedEntities?.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
          <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-2">Degraded Nodes</p>
          <div className="space-y-1">
            {summary.degradedEntities.map((id) => (
              <div key={id} className="flex items-center gap-2">
                <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
                <span className="text-xs font-mono text-zinc-400">{id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peer list */}
      {entities.length > 0 && (
        <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800/60 max-h-44 overflow-y-auto">
          {entities.map((e) => (
            <div key={e.entityId} className="flex items-center gap-2 px-3 py-2">
              <StatusIcon status={e.status} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 truncate font-mono">{e.entityId}</p>
              </div>
              <span className={`text-[9px] px-1 rounded ${
                e.status === 'healthy' ? 'text-emerald-500 bg-emerald-500/10' :
                e.status === 'degraded' ? 'text-amber-500 bg-amber-500/10' :
                'text-zinc-500 bg-zinc-800'
              }`}>
                {e.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && entities.length === 0 && !error && (
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <Network className="h-3 w-3" />
          <span>No federated entities registered.</span>
        </div>
      )}
    </div>
  );
}
