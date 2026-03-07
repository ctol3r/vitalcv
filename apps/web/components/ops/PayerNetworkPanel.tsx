'use client';

/**
 * PayerNetworkPanel.tsx — Wave 148: Payer Credential Network
 *
 * Mission-ops panel showing:
 *   - Active payers with trust scores + tier badges
 *   - Verification throughput per payer
 *   - Credential coverage requirements
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Building2, RefreshCw, Shield, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import { getApiBase } from '@/lib/api';

interface PayerNetwork {
  payerId: string;
  payerName: string;
  tier: 'NATIONAL' | 'REGIONAL' | 'SPECIALTY';
  connectedIssuers: number;
  verifiedProviders: number;
  coverageRegions: string[];
  acceptedCredentialTypes: string[];
  networkHealth: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
}

interface PayerThroughput {
  payerId: string;
  payerName: string;
  totalVerifications: number;
  successfulVerifications: number;
  successRate: number;
}

type LoadState = 'idle' | 'loading' | 'done' | 'error';

const tierColors = {
  NATIONAL: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  REGIONAL: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  SPECIALTY: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
};

const healthIcons = {
  HEALTHY: { icon: CheckCircle, color: 'text-emerald-400' },
  DEGRADED: { icon: AlertTriangle, color: 'text-amber-400' },
  OFFLINE: { icon: AlertTriangle, color: 'text-red-400' },
};

export default function PayerNetworkPanel() {
  const [networks, setNetworks] = useState<PayerNetwork[]>([]);
  const [throughput, setThroughput] = useState<PayerThroughput[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');

  const base = getApiBase();

  const loadData = useCallback(async () => {
    setLoadState('loading');
    try {
      const [netRes, throughRes] = await Promise.all([
        fetch(`${base}/api/payers/networks`),
        fetch(`${base}/api/payers/throughput`),
      ]);

      if (!netRes.ok) throw new Error(`Networks: ${netRes.status}`);
      const netData = await netRes.json() as { networks: PayerNetwork[] };
      setNetworks(netData.networks);

      if (throughRes.ok) {
        const throughData = await throughRes.json() as { payers: PayerThroughput[] };
        setThroughput(throughData.payers);
      }

      setLoadState('done');
    } catch {
      setLoadState('error');
    }
  }, [base]);

  const getThroughput = (payerId: string) => throughput.find((t) => t.payerId === payerId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-infra-border bg-infra-surface overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-infra-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa]" />
          <span className="text-sm font-semibold text-infra-text">Payer Credential Network</span>
          <span className="text-xs text-infra-muted ml-1">Wave 148</span>
        </div>
        <button
          onClick={loadData}
          disabled={loadState === 'loading'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loadState === 'loading' ? 'animate-spin' : ''}`} />
          {loadState === 'loading' ? 'Loading…' : 'Load Network'}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {networks.length > 0 && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-infra-bg border border-infra-border">
                <div className="text-lg font-bold text-infra-text">{networks.length}</div>
                <div className="text-xs text-infra-muted">Active Payers</div>
              </div>
              <div className="p-3 rounded-xl bg-infra-bg border border-infra-border">
                <div className="text-lg font-bold text-emerald-400">
                  {throughput.reduce((s, t) => s + t.totalVerifications, 0)}
                </div>
                <div className="text-xs text-infra-muted">Verifications</div>
              </div>
              <div className="p-3 rounded-xl bg-infra-bg border border-infra-border">
                <div className="text-lg font-bold text-blue-400">
                  {networks.filter((n) => n.networkHealth === 'HEALTHY').length}/{networks.length}
                </div>
                <div className="text-xs text-infra-muted">Healthy</div>
              </div>
            </div>

            {/* Payer cards */}
            <div className="space-y-3">
              {networks.map((payer) => {
                const t = getThroughput(payer.payerId);
                const HealthIcon = healthIcons[payer.networkHealth].icon;
                return (
                  <div key={payer.payerId} className="p-4 rounded-xl bg-infra-bg border border-infra-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-infra-muted" />
                        <span className="text-sm font-semibold text-infra-text">{payer.payerName}</span>
                        <span className={`px-2 py-0.5 rounded border text-xs font-medium ${tierColors[payer.tier]}`}>
                          {payer.tier}
                        </span>
                      </div>
                      <HealthIcon className={`h-4 w-4 ${healthIcons[payer.networkHealth].color}`} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-infra-muted">Issuers: </span>
                        <span className="text-infra-text font-medium">{payer.connectedIssuers}</span>
                      </div>
                      <div>
                        <span className="text-infra-muted">Providers: </span>
                        <span className="text-infra-text font-medium">{payer.verifiedProviders}</span>
                      </div>
                      <div>
                        <span className="text-infra-muted">Regions: </span>
                        <span className="text-infra-text font-medium">{payer.coverageRegions.length > 3 ? 'ALL' : payer.coverageRegions.join(', ')}</span>
                      </div>
                    </div>

                    {t && t.totalVerifications > 0 && (
                      <div className="flex items-center gap-3 text-xs">
                        <Activity className="h-3 w-3 text-infra-muted" />
                        <span className="text-infra-muted">{t.totalVerifications} verifications</span>
                        <span className={t.successRate >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
                          {t.successRate}% success
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {payer.acceptedCredentialTypes.map((ct) => (
                        <span key={ct} className="px-2 py-0.5 rounded-full bg-infra-border/50 text-infra-muted text-xs">
                          <Shield className="inline h-2.5 w-2.5 mr-1" />{ct}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {loadState === 'idle' && networks.length === 0 && (
          <div className="text-xs text-infra-muted text-center py-4">
            Click &quot;Load Network&quot; to fetch payer data
          </div>
        )}
        {loadState === 'error' && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            Failed to load payer network — check API connection
          </div>
        )}
      </div>
    </motion.div>
  );
}
