'use client';

/**
 * NetworkTelemetryDashboard.tsx — Wave 150: Network Telemetry Intelligence
 *
 * Comprehensive network behavior dashboard showing:
 *   - Verification rate (sparkline)
 *   - Revocation rate (sparkline)
 *   - Network growth (sparkline)
 *   - Issuer activity table
 *   - Activity feed
 */

import { getApiBase } from '@/lib/api';
import { motion } from 'framer-motion';
import {
    Activity,
    AlertTriangle,
    Building2,
    CheckCircle,
    RefreshCw,
    Shield,
    Users
} from 'lucide-react';
import { useCallback, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface GrowthData {
  currentTotals: {
    providers: number;
    issuers: number;
    credentials: number;
    revocations: number;
  };
  growthRate: {
    providers7d: number;
    credentials7d: number;
  };
  dataPoints: Array<{ date: string; credentials: number; cumulative: { credentials: number } }>;
}

interface ThroughputData {
  totalVerifications: number;
  successRate: number;
  avgResponseMs: number;
  dailyVolume: Array<{ date: string; count: number }>;
}

interface IssuerEntry {
  issuerId: string;
  issuerName: string;
  trustLevel: string;
  credentialsIssued: number;
  activeCredentials: number;
  revokedCredentials: number;
  trustScore: number;
}

interface ActivityEvent {
  type: string;
  description: string;
  timestamp: string;
}

interface DashboardData {
  growth: GrowthData;
  throughput: ThroughputData;
  issuerActivity: { issuers: IssuerEntry[]; averageTrustScore: number };
  activityFeed: { events: ActivityEvent[] };
}

type LoadState = 'idle' | 'loading' | 'done' | 'error';

// ── Mini Sparkline SVG ─────────────────────────────────────────────────────────

function Sparkline({ data, color = '#10b981', height = 32, width = 120 }: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - (v / max) * (height - 4)}`).join(' ');
  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NetworkTelemetryDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');

  const base = getApiBase();

  const loadDashboard = useCallback(async () => {
    setLoadState('loading');
    try {
      const res = await fetch(`${base}/api/network/telemetry/dashboard`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const dashboard = await res.json() as DashboardData;
      setData(dashboard);
      setLoadState('done');
    } catch {
      setLoadState('error');
    }
  }, [base]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-infra-border bg-infra-surface overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-infra-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
          <span className="heading-lg text-infra-text">Network Telemetry</span>
          <span className="text-xs text-infra-muted ml-1">Wave 150</span>
        </div>
        <button
          onClick={loadDashboard}
          disabled={loadState === 'loading'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loadState === 'loading' ? 'animate-spin' : ''}`} />
          {loadState === 'loading' ? 'Loading…' : 'Load Telemetry'}
        </button>
      </div>

      {data && (
        <div className="p-5 space-y-5">
          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Providers',
                value: data.growth.currentTotals.providers,
                delta: data.growth.growthRate.providers7d,
                icon: Users,
                color: 'text-blue-400',
                sparkData: data.growth.dataPoints.map((d) => d.cumulative.credentials),
                sparkColor: '#3b82f6',
              },
              {
                label: 'Credentials',
                value: data.growth.currentTotals.credentials,
                delta: data.growth.growthRate.credentials7d,
                icon: Shield,
                color: 'text-emerald-400',
                sparkData: data.growth.dataPoints.map((d) => d.credentials),
                sparkColor: '#10b981',
              },
              {
                label: 'Verifications',
                value: data.throughput.totalVerifications,
                delta: data.throughput.successRate,
                icon: CheckCircle,
                color: 'text-green-400',
                sparkData: data.throughput.dailyVolume.map((d) => d.count),
                sparkColor: '#22c55e',
              },
              {
                label: 'Revocations',
                value: data.growth.currentTotals.revocations,
                delta: 0,
                icon: AlertTriangle,
                color: 'text-red-400',
                sparkData: [],
                sparkColor: '#ef4444',
              },
            ].map(({ label, value, delta, icon: Icon, color, sparkData, sparkColor }) => (
              <div key={label} className="p-3 rounded-xl bg-infra-bg border border-infra-border">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  {sparkData.length > 0 && <Sparkline data={sparkData} color={sparkColor} width={60} height={20} />}
                </div>
                <div className={`text-lg font-bold ${color}`}>{value.toLocaleString()}</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-infra-muted">{label}</span>
                  {delta !== 0 && (
                    <span className={`text-xs ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {delta > 0 ? '+' : ''}{delta}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Issuer activity */}
          {data.issuerActivity.issuers.length > 0 && (
            <div className="rounded-xl border border-infra-border overflow-hidden">
              <div className="px-4 py-2 bg-infra-bg border-b border-infra-border flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-infra-muted" />
                <span className="text-xs font-semibold text-infra-muted uppercase tracking-wider">Issuer Activity</span>
                <span className="text-xs text-infra-muted ml-auto">Avg score: {data.issuerActivity.averageTrustScore}</span>
              </div>
              <div className="divide-y divide-infra-border/50">
                {data.issuerActivity.issuers.slice(0, 8).map((issuer) => (
                  <div key={issuer.issuerId} className="flex items-center justify-between px-4 py-2.5 hover:bg-infra-bg/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-infra-text font-medium truncate">{issuer.issuerName}</span>
                      <span className="text-xs text-infra-muted shrink-0">{issuer.trustLevel}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs shrink-0">
                      <span className="text-infra-muted">{issuer.credentialsIssued} issued</span>
                      <span className="text-emerald-400">{issuer.activeCredentials} active</span>
                      {issuer.revokedCredentials > 0 && (
                        <span className="text-red-400">{issuer.revokedCredentials} revoked</span>
                      )}
                      <div className="flex items-center gap-1">
                        <div className="w-8 h-1.5 rounded-full bg-infra-border overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${issuer.trustScore}%`,
                              backgroundColor: issuer.trustScore >= 80 ? '#10b981' : issuer.trustScore >= 50 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                        <span className="text-infra-muted w-6 text-right">{issuer.trustScore}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity feed */}
          {data.activityFeed.events.length > 0 && (
            <div className="rounded-xl border border-infra-border overflow-hidden">
              <div className="px-4 py-2 bg-infra-bg border-b border-infra-border flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-infra-muted" />
                <span className="text-xs font-semibold text-infra-muted uppercase tracking-wider">Recent Activity</span>
              </div>
              <div className="divide-y divide-infra-border/50 max-h-48 overflow-y-auto">
                {data.activityFeed.events.slice(0, 10).map((event, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      event.type === 'credential_revoked' ? 'bg-red-400' :
                      event.type === 'credential_issued' ? 'bg-emerald-400' :
                      event.type === 'federation' ? 'bg-cyan-400' : 'bg-blue-400'
                    }`} />
                    <span className="text-infra-muted truncate">{event.description}</span>
                    <span className="text-infra-muted/60 shrink-0 ml-auto">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loadState === 'idle' && !data && (
        <div className="p-5 text-xs text-infra-muted text-center py-8">
          Click &quot;Load Telemetry&quot; to fetch network data
        </div>
      )}
      {loadState === 'error' && (
        <div className="p-5">
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            Failed to load telemetry — check API connection
          </div>
        </div>
      )}
    </motion.div>
  );
}
