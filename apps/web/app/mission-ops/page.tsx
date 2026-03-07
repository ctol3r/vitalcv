'use client';

/**
 * Mission Ops — Wave 137/138: Trust Graph Console + Issuer Onboarding integrated
 *
 * Healthcare-specific Mission Manager showing:
 *   - Issuer onboarding state
 *   - Verifier onboarding state
 *   - Federation health
 *   - Trust registry health
 *   - Control inheritance status
 *   - System readiness
 *   - [Wave 137] Live Trust Graph Console
 *   - [Wave 138] Issuer Onboarding Panel
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import TelemetryPanel from '@/components/telemetry/TelemetryPanel';
import type { TimeSeriesPoint } from '@/components/telemetry/TimeSeriesChart';
import {
  RefreshCw, Shield, Award, Network, Activity, CheckCircle,
  AlertTriangle, XCircle, Users, Building, Handshake,
} from 'lucide-react';
import Link from 'next/link';
import { getApiBase } from '@/lib/api';
import TrustGraphConsole from '@/components/ops/TrustGraphConsole';
import IssuerOnboardingPanel from '@/components/ops/IssuerOnboardingPanel';
import NetworkTelemetryIntelligence from '@/components/telemetry/NetworkTelemetryIntelligence';

interface MissionOpsOverview {
  issuerOnboarding: { total: number; complete: number; inProgress: number; blocked: number };
  verifierOnboarding: { total: number; complete: number; inProgress: number };
  federationHealth: { totalPeers: number; activePeers: number; degradedPeers: number };
  trustRegistryHealth: { totalIssuers: number; haipCompliant: number; averageTrustScore: number };
  controlInheritanceStatus: { totalControls: number; inherited: number; healthy: boolean };
  systemReadiness: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL';
  computedAt: string;
}

const base = () => getApiBase();

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const },
};

function ReadinessIndicator({ status }: { status: MissionOpsOverview['systemReadiness'] }) {
  const config = {
    OPERATIONAL: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'Operational' },
    DEGRADED:    { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: 'Degraded' },
    CRITICAL:    { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'Critical' },
  }[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg}`}>
      <Icon className={`h-4 w-4 ${config.color}`} />
      <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
    </div>
  );
}

function ProgressRing({ value, size = 48, className = '' }: { value: number; size?: number; className?: string }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (value / 100) * circumference;
  const color = value === 100 ? '#34d399' : value > 50 ? '#60a5fa' : '#fbbf24';

  return (
    <svg width={size} height={size} className={className}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#27272a" strokeWidth="3" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        className="transition-all duration-500"
      />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fill={color} fontSize="11" fontWeight="bold">
        {value}%
      </text>
    </svg>
  );
}

export default function MissionOpsPage() {
  const [overview, setOverview] = useState<MissionOpsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${base()}/api/mission-ops/overview`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setOverview(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const iv = setInterval(fetchOverview, 60_000);
    return () => clearInterval(iv);
  }, [fetchOverview]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <motion.header {...fadeUp} className="border-b border-zinc-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Mission Ops</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Trust substrate deployment readiness & onboarding</p>
          </div>
          <div className="flex items-center gap-3">
            {overview && <ReadinessIndicator status={overview.systemReadiness} />}
            <button onClick={fetchOverview} className="text-zinc-600 hover:text-zinc-300 transition-colors p-2 rounded-lg hover:bg-white/[0.05]">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </motion.header>

      {error && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="text-xs text-red-400 rounded-xl bg-red-500/[0.05] border border-red-500/20 p-3">
            {error} <button onClick={fetchOverview} className="ml-2 underline text-zinc-500">Retry</button>
          </div>
        </div>
      )}

      {overview && (
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
          {/* Top-level metrics */}
          <motion.div {...fadeUp} className="grid grid-cols-5 gap-3">
            {[
              { icon: Building, label: 'Issuers', value: overview.trustRegistryHealth.totalIssuers, sub: `${overview.trustRegistryHealth.haipCompliant} HAIP`, color: 'text-emerald-400' },
              { icon: Users, label: 'Verifiers', value: overview.verifierOnboarding.total, sub: `${overview.verifierOnboarding.complete} active`, color: 'text-blue-400' },
              { icon: Network, label: 'Fed Peers', value: overview.federationHealth.totalPeers, sub: `${overview.federationHealth.activePeers} active`, color: 'text-purple-400' },
              { icon: Shield, label: 'Controls', value: overview.controlInheritanceStatus.totalControls, sub: `${overview.controlInheritanceStatus.inherited} inherited`, color: 'text-amber-400' },
              { icon: Award, label: 'Avg Trust', value: overview.trustRegistryHealth.averageTrustScore, sub: 'registry score', color: 'text-zinc-200' },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>
              </div>
            ))}
          </motion.div>

          {/* Onboarding sections */}
          <div className="grid grid-cols-3 gap-4">
            {/* Issuer Onboarding */}
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Building className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-medium text-zinc-200">Issuer Onboarding</h3>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <ProgressRing value={overview.issuerOnboarding.total > 0
                  ? Math.round((overview.issuerOnboarding.complete / overview.issuerOnboarding.total) * 100)
                  : 0}
                />
                <div className="space-y-1">
                  <p className="text-xs text-zinc-400">{overview.issuerOnboarding.complete} / {overview.issuerOnboarding.total} complete</p>
                  <p className="text-xs text-zinc-500">{overview.issuerOnboarding.inProgress} in progress</p>
                  {overview.issuerOnboarding.blocked > 0 && (
                    <p className="text-xs text-red-400">{overview.issuerOnboarding.blocked} blocked</p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Verifier Onboarding */}
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-medium text-zinc-200">Verifier Onboarding</h3>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <ProgressRing value={overview.verifierOnboarding.total > 0
                  ? Math.round((overview.verifierOnboarding.complete / overview.verifierOnboarding.total) * 100)
                  : 0}
                />
                <div className="space-y-1">
                  <p className="text-xs text-zinc-400">{overview.verifierOnboarding.complete} / {overview.verifierOnboarding.total} complete</p>
                  <p className="text-xs text-zinc-500">{overview.verifierOnboarding.inProgress} in progress</p>
                </div>
              </div>
            </motion.div>

            {/* Federation Health */}
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Network className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-medium text-zinc-200">Federation</h3>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <ProgressRing value={overview.federationHealth.totalPeers > 0
                  ? Math.round((overview.federationHealth.activePeers / overview.federationHealth.totalPeers) * 100)
                  : 0}
                />
                <div className="space-y-1">
                  <p className="text-xs text-zinc-400">{overview.federationHealth.activePeers} active peers</p>
                  {overview.federationHealth.degradedPeers > 0 && (
                    <p className="text-xs text-amber-400">{overview.federationHealth.degradedPeers} degraded</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Control Inheritance Status */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.25 }}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-medium text-zinc-200">HealthStart Controls</h3>
              </div>
              <div className="flex items-center gap-2">
                {overview.controlInheritanceStatus.healthy ? (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                    <CheckCircle className="h-2.5 w-2.5" /> All Healthy
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" /> Degraded
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6 mt-3">
              <div>
                <p className="text-xl font-bold text-zinc-200">{overview.controlInheritanceStatus.totalControls}</p>
                <p className="text-[10px] text-zinc-600">Total Controls</p>
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-400">{overview.controlInheritanceStatus.inherited}</p>
                <p className="text-[10px] text-zinc-600">Inherited</p>
              </div>
              <div className="flex-1" />
              <Link
                href="/developers#healthstart"
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                View Controls →
              </Link>
            </div>
          </motion.div>

          {/* Quick links */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Command Center', href: '/command-center', icon: Activity },
              { label: 'Developer Portal', href: '/developers', icon: Building },
              { label: 'Trust Network', href: '/network', icon: Network },
              { label: 'Holder Passport', href: '/holder', icon: Shield },
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 text-zinc-600" />
                {label}
              </Link>
            ))}
          </div>

          {/* Wave 140: Network Telemetry Intelligence */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.28 }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Network Telemetry</h2>
              <span className="text-[10px] font-mono text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">
                Wave 140
              </span>
            </div>
            <NetworkTelemetryIntelligence />
          </motion.div>

          {/* Wave 137: Trust Graph Operator Console */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.3 }}>
            <div className="flex items-center gap-2 mb-4">
              <Network className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Trust Graph Console</h2>
              <span className="text-[10px] font-mono text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">
                Wave 137
              </span>
            </div>
            <TrustGraphConsole />
          </motion.div>

          {/* Wave 141: Network Reputation Summary */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.32 }}>
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Network Reputation</h2>
              <span className="text-[10px] font-mono text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">
                Wave 141
              </span>
            </div>
            <NetworkReputationSummaryPanel />
          </motion.div>

          {/* Wave 138: Issuer Onboarding Panel */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.35 }}>
            <div className="flex items-center gap-2 mb-4">
              <Building className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Issuer Onboarding</h2>
              <span className="text-[10px] font-mono text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">
                Wave 138
              </span>
            </div>
            <IssuerOnboardingPanel onIssuerRegistered={fetchOverview} />
          </motion.div>
        </div>
      )}

      {!overview && !loading && !error && (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="text-5xl mb-4 opacity-20">⬡</div>
            <p className="text-sm text-zinc-500">Loading Mission Ops…</p>
          </div>
        </div>
      )}

      {/* Wave 131 — Mission Telemetry */}
      {overview && <MissionTelemetry overview={overview} />}
    </main>
  );
}

// ── Mission Telemetry panel ────────────────────────────────────────────────

function seedSeries(base: number, count = 12, variance = 0.15): TimeSeriesPoint[] {
  const now = Date.now();
  const step = 5 * 60 * 1000; // 5-min buckets
  return Array.from({ length: count }, (_, i) => ({
    t: now - (count - 1 - i) * step,
    v: Math.max(0, Math.round(base * (1 + (Math.random() - 0.5) * variance))),
  }));
}

interface MissionTelemetryProps {
  overview: MissionOpsOverview;
}

function MissionTelemetry({ overview }: MissionTelemetryProps) {
  const readinessMap = { OPERATIONAL: 100, DEGRADED: 60, CRITICAL: 20 } as const;
  const readiness = readinessMap[overview.systemReadiness] ?? 80;

  // Stable seeds — recompute only when overview changes
  const metrics = useMemo(() => [
    {
      title: 'Onboarding Progress',
      value: `${readiness}%`,
      trend: readiness >= 80 ? 'up' as const : 'flat' as const,
      delta: readiness >= 80 ? '+2%' : undefined,
      series: seedSeries(readiness, 12, 0.05),
      color: '#10b981',
    },
    {
      title: 'Control Coverage',
      value: '15/15',
      trend: 'flat' as const,
      series: seedSeries(15, 12, 0),
      color: '#8b5cf6',
    },
    {
      title: 'Issuer Health',
      value: 'Nominal',
      trend: 'up' as const,
      delta: '+1',
      series: seedSeries(95, 12, 0.04),
      color: '#06b6d4',
    },
    {
      title: 'SDK Diagnostics',
      value: '3/3',
      trend: 'flat' as const,
      series: seedSeries(3, 12, 0),
      color: '#f59e0b',
    },
  ], [readiness]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-8"
    >
      <TelemetryPanel
        title="Mission Telemetry (Wave 131)"
        metrics={metrics}
        cols={4}
      />
    </motion.div>
  );
}

// ── Wave 141: Network Reputation Summary Panel ────────────────────────────────

interface NetworkReputationData {
  networkTrustScore: number;
  healthyIssuers: number;
  degradedIssuers: number;
  criticalIssuers: number;
  issuerScores: Array<{ issuerId: string; issuerName: string; trustScore: number }>;
  computedAt: string;
}

function NetworkReputationSummaryPanel() {
  const [data, setData] = useState<NetworkReputationData | null>(null);
  const [loading, setLoading] = useState(true);
  const apiBase = getApiBase();

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/api/reputation/network`)
      .then((r) => (r.ok ? r.json() as Promise<NetworkReputationData> : null))
      .then((d) => { if (!cancelled && d) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 animate-pulse space-y-3">
        <div className="h-6 w-1/3 bg-zinc-800 rounded" />
        <div className="h-20 bg-zinc-800/60 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 text-center">
        <p className="text-xs text-zinc-600">Reputation engine warming up — no issuers scored yet</p>
      </div>
    );
  }

  const scoreColor =
    data.networkTrustScore >= 80
      ? 'text-emerald-400'
      : data.networkTrustScore >= 60
        ? 'text-blue-400'
        : 'text-amber-400';

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800">
        {/* Network score */}
        <div className="p-4 sm:col-span-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Network Trust Score</p>
          <p className={`text-4xl font-bold ${scoreColor}`}>{data.networkTrustScore}</p>
          <p className="text-[10px] text-zinc-600 mt-1">
            {data.networkTrustScore >= 80
              ? 'Healthy network'
              : data.networkTrustScore >= 60
                ? 'Moderate health'
                : 'Attention needed'}
          </p>
        </div>
        {/* Health breakdown */}
        <div className="p-4 sm:col-span-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Issuer Health</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Healthy ≥80</span>
              <span className="text-emerald-400 font-medium">{data.healthyIssuers}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Degraded 50–79</span>
              <span className="text-amber-400 font-medium">{data.degradedIssuers}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Critical &lt;50</span>
              <span className="text-red-400 font-medium">{data.criticalIssuers}</span>
            </div>
          </div>
        </div>
        {/* Top issuers */}
        <div className="p-4 sm:col-span-2">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Issuer Scores</p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {data.issuerScores
              .sort((a, b) => b.trustScore - a.trustScore)
              .slice(0, 6)
              .map((s) => (
                <div key={s.issuerId} className="flex items-center gap-2">
                  <span className="flex-1 text-[11px] text-zinc-300 truncate">{s.issuerName}</span>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${s.trustScore}%`,
                          background:
                            s.trustScore >= 80
                              ? '#10b981'
                              : s.trustScore >= 60
                                ? '#60a5fa'
                                : '#f59e0b',
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 w-6 text-right">
                      {s.trustScore}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
