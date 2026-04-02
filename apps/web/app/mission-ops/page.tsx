'use client';

/**
 * Mission Ops — Wave CC-146: Operator Surfaces
 *
 * Healthcare-specific operator control interface showing:
 *   - Issuer onboarding state, Verifier onboarding state
 *   - Federation health, Trust registry health
 *   - Control inheritance status, System readiness
 *   - [Wave 137] Live Trust Graph Console
 *   - [Wave 138] Issuer Onboarding Panel
 *   - [Wave 140] Network Telemetry Intelligence
 *   - [Wave 141] Network Reputation Summary
 *   - [Wave 143] Provider Directory Distribution
 *   - [CC-146] Federation Health Panel
 *   - [CC-146] Revocation Activity Panel
 *   - [CC-146] Ops Telemetry (API-connected)
 *   - [CC-146] Operator keyboard shortcuts (⌘E/R/I)
 */

import { Grid, MetricStrip } from '@/components/layout/Grid';
import NetworkHealthPanel from '@/components/network/NetworkHealthPanel';
import DebugPanel from '@/components/ops/DebugPanel';
import IssuerOnboardingPanel from '@/components/ops/IssuerOnboardingPanel';
import PayerNetworkPanel from '@/components/ops/PayerNetworkPanel';
import ProviderDirectoryPanel from '@/components/ops/ProviderDirectoryPanel';
import OpsTelemetryPanel from '@/components/ops/TelemetryPanel';
import TrustGraphConsole from '@/components/ops/TrustGraphConsole';
import { FederationHealthPanel } from '@/components/substrate/FederationHealthPanel';
import { RevocationCascadePanel } from '@/components/substrate/RevocationCascadePanel';
import MonitoringStatusPanel from '@/components/monitoring/MonitoringStatusPanel';
import NetworkTelemetryDashboard from '@/components/telemetry/NetworkTelemetryDashboard';
import NetworkTelemetryIntelligence from '@/components/telemetry/NetworkTelemetryIntelligence';
import TelemetryPanel from '@/components/telemetry/TelemetryPanel';
import type { TimeSeriesPoint } from '@/components/telemetry/TimeSeriesChart';
import { getApiBase } from '@/lib/api';
import { motion } from 'framer-motion';
import {
    Activity,
    AlertTriangle,
    Award,
    Building,
    CheckCircle,
    Handshake, Keyboard,
    Network,
    RefreshCw, Shield,
    Users,
    XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
    OPERATIONAL: { icon: CheckCircle, color: 'text-vt-success', bg: 'bg-vt-success/10 border-vt-success/30', label: 'Operational' },
    DEGRADED:    { icon: AlertTriangle, color: 'text-vt-warning', bg: 'bg-vt-warning/10 border-vt-warning/30', label: 'Degraded' },
    CRITICAL:    { icon: XCircle, color: 'text-vt-danger', bg: 'bg-vt-danger/10 border-vt-danger/30', label: 'Critical' },
  }[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg}`}>
      <Icon className={`h-4 w-4 ${config.color}`} />
      <span className={`heading-md ${config.color}`}>{config.label}</span>
    </div>
  );
}

function ProgressRing({ value, size = 48, className = '' }: { value: number; size?: number; className?: string }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (value / 100) * circumference;
  const color = value === 100 ? 'var(--vt-color-success)' : value > 50 ? 'var(--vt-color-info)' : 'var(--vt-color-warning)';

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

  // Panel refs for keyboard shortcut scroll targeting
  const graphRef = useRef<HTMLDivElement>(null);
  const directoryRef = useRef<HTMLDivElement>(null);

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

  // Wave CC-146: Operator keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'e') {
        e.preventDefault();
        directoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (e.key === 'r') {
        e.preventDefault();
        graphRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (e.key === 'i') {
        e.preventDefault();
        graphRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Focus the graph panel after scroll
        setTimeout(() => graphRef.current?.querySelector<HTMLElement>('[data-graph-focus]')?.focus(), 400);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <main className="min-h-screen bg-vt-surface-ops-base text-foreground surface-operator">
      {/* Header */}
      <motion.header {...fadeUp} className="border-b border-vt-neutral-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="heading-lg">Mission Ops</h1>
            <p className="text-xs text-vt-neutral-800 mt-0.5">Trust substrate deployment readiness & onboarding</p>
          </div>
          <div className="flex items-center gap-3">
            {overview && <ReadinessIndicator status={overview.systemReadiness} />}
            <button onClick={fetchOverview} className="text-vt-neutral-800 hover:text-vt-neutral-200 transition-colors p-2 rounded-lg hover:bg-vt-surface-ops-raised">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </motion.header>

      {error && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="text-xs text-vt-danger rounded-xl bg-vt-danger/[0.05] border border-vt-danger/20 p-3">
            {error} <button onClick={fetchOverview} className="ml-2 underline text-vt-neutral-800">Retry</button>
          </div>
        </div>
      )}

      {overview && (
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
          {/* Top-level metrics — Wave 173: MetricStrip grid */}
          <motion.div {...fadeUp}>
          <MetricStrip cols={5} gap="sm">
            {[
              { icon: Building, label: 'Issuers', value: overview.trustRegistryHealth.totalIssuers, sub: `${overview.trustRegistryHealth.haipCompliant} HAIP`, color: 'text-vt-success' },
              { icon: Users, label: 'Verifiers', value: overview.verifierOnboarding.total, sub: `${overview.verifierOnboarding.complete} active`, color: 'text-vt-info' },
              { icon: Network, label: 'Fed Peers', value: overview.federationHealth.totalPeers, sub: `${overview.federationHealth.activePeers} active`, color: 'text-vt-brand-primary' },
              { icon: Shield, label: 'Controls', value: overview.controlInheritanceStatus.totalControls, sub: `${overview.controlInheritanceStatus.inherited} inherited`, color: 'text-vt-warning' },
              { icon: Award, label: 'Avg Trust', value: overview.trustRegistryHealth.averageTrustScore, sub: 'registry score', color: 'text-vt-neutral-100' },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <div key={label} className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  <span className="text-[10px] text-vt-neutral-800 uppercase tracking-wider">{label}</span>
                </div>
                <p className={`heading-xl ${color}`}>{value}</p>
                <p className="text-[10px] text-vt-neutral-800 mt-0.5">{sub}</p>
              </div>
            ))}
          </MetricStrip>
          </motion.div>

          {/* Onboarding sections */}
          <Grid cols={1} lg={3} gap="md">
            {/* Issuer Onboarding */}
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}
              className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Building className="h-4 w-4 text-vt-success" />
                <h3 className="heading-md text-vt-neutral-100">Issuer Onboarding</h3>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <ProgressRing value={overview.issuerOnboarding.total > 0
                  ? Math.round((overview.issuerOnboarding.complete / overview.issuerOnboarding.total) * 100)
                  : 0}
                />
                <div className="space-y-1">
                  <p className="text-xs text-vt-neutral-200">{overview.issuerOnboarding.complete} / {overview.issuerOnboarding.total} complete</p>
                  <p className="text-xs text-vt-neutral-800">{overview.issuerOnboarding.inProgress} in progress</p>
                  {overview.issuerOnboarding.blocked > 0 && (
                    <p className="text-xs text-vt-danger">{overview.issuerOnboarding.blocked} blocked</p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Verifier Onboarding */}
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}
              className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-vt-info" />
                <h3 className="heading-md text-vt-neutral-100">Verifier Onboarding</h3>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <ProgressRing value={overview.verifierOnboarding.total > 0
                  ? Math.round((overview.verifierOnboarding.complete / overview.verifierOnboarding.total) * 100)
                  : 0}
                />
                <div className="space-y-1">
                  <p className="text-xs text-vt-neutral-200">{overview.verifierOnboarding.complete} / {overview.verifierOnboarding.total} complete</p>
                  <p className="text-xs text-vt-neutral-800">{overview.verifierOnboarding.inProgress} in progress</p>
                </div>
              </div>
            </motion.div>

            {/* Federation Health */}
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}
              className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Network className="h-4 w-4 text-vt-brand-primary" />
                <h3 className="heading-md text-vt-neutral-100">Federation</h3>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <ProgressRing value={overview.federationHealth.totalPeers > 0
                  ? Math.round((overview.federationHealth.activePeers / overview.federationHealth.totalPeers) * 100)
                  : 0}
                />
                <div className="space-y-1">
                  <p className="text-xs text-vt-neutral-200">{overview.federationHealth.activePeers} active peers</p>
                  {overview.federationHealth.degradedPeers > 0 && (
                    <p className="text-xs text-vt-warning">{overview.federationHealth.degradedPeers} degraded</p>
                  )}
                </div>
              </div>
            </motion.div>
          </Grid>

          {/* Control Inheritance Status */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.25 }}
            className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-vt-warning" />
                <h3 className="heading-md text-vt-neutral-100">HealthStart Controls</h3>
              </div>
              <div className="flex items-center gap-2">
                {overview.controlInheritanceStatus.healthy ? (
                  <span className="flex items-center gap-1 text-[10px] text-vt-success bg-vt-success/10 border border-vt-success/20 rounded-full px-2 py-0.5">
                    <CheckCircle className="h-2.5 w-2.5" /> All Healthy
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-vt-warning bg-vt-warning/10 border border-vt-warning/20 rounded-full px-2 py-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" /> Degraded
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6 mt-3">
              <div>
                <p className="heading-lg text-vt-neutral-100">{overview.controlInheritanceStatus.totalControls}</p>
                <p className="text-[10px] text-vt-neutral-800">Total Controls</p>
              </div>
              <div>
                <p className="heading-lg text-vt-success">{overview.controlInheritanceStatus.inherited}</p>
                <p className="text-[10px] text-vt-neutral-800">Inherited</p>
              </div>
              <div className="flex-1" />
              <Link
                href="/developers#healthstart"
                className="text-[10px] text-vt-neutral-800 hover:text-vt-neutral-200 transition-colors"
              >
                View Controls →
              </Link>
            </div>
          </motion.div>

          {/* Quick links */}
          <Grid cols={2} lg={4} gap="sm">
            {[
              { label: 'Command Center', href: '/command-center', icon: Activity },
              { label: 'Developer Portal', href: '/developers', icon: Building },
              { label: 'Trust Network', href: '/intelligence?view=graph', icon: Network },
              { label: 'Holder Passport', href: '/holder', icon: Shield },
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 px-4 py-3 text-xs text-vt-neutral-200 hover:text-vt-neutral-100 hover:border-vt-neutral-800 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 text-vt-neutral-800" />
                {label}
              </Link>
            ))}
          </Grid>

          {/* Wave CC-146: Operator Telemetry (API-connected) */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.27 }}>
            <OpsTelemetryPanel />
          </motion.div>

          {/* Wave 140: Network Telemetry Intelligence */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.28 }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-vt-info" />
              <h2 className="heading-md text-vt-neutral-100">Network Telemetry</h2>
              <span className="text-[10px] code text-vt-neutral-800 border border-vt-neutral-800 rounded px-1.5 py-0.5">
                Wave 140
              </span>
            </div>
            <NetworkTelemetryIntelligence />
          </motion.div>

          {/* Wave 137: Trust Graph Operator Console */}
          <motion.div ref={graphRef} {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.3 }}>
            <div className="flex items-center gap-2 mb-4">
              <Network className="h-4 w-4 text-vt-success" />
              <h2 className="heading-md text-vt-neutral-100">Trust Graph Console</h2>
              <span className="text-[10px] code text-vt-neutral-800 border border-vt-neutral-800 rounded px-1.5 py-0.5">
                Wave 137
              </span>
            </div>
            <TrustGraphConsole />
          </motion.div>

          {/* Wave 141: Network Reputation Summary */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.32 }}>
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-4 w-4 text-vt-warning" />
              <h2 className="heading-md text-vt-neutral-100">Network Reputation</h2>
              <span className="text-[10px] code text-vt-neutral-800 border border-vt-neutral-800 rounded px-1.5 py-0.5">
                Wave 141
              </span>
            </div>
            <NetworkReputationSummaryPanel />
          </motion.div>

          {/* Wave CC-146: Federation Health */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.34 }}>
            <div className="flex items-center gap-2 mb-4">
              <Handshake className="h-4 w-4 text-vt-brand-primary" />
              <h2 className="heading-md text-vt-neutral-100">Federation Health</h2>
              <span className="text-[10px] code text-vt-neutral-800 border border-vt-neutral-800 rounded px-1.5 py-0.5">
                CC-146
              </span>
            </div>
            <FederationHealthPanel />
          </motion.div>

          {/* Wave 138: Issuer Onboarding Panel */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.35 }}>
            <div className="flex items-center gap-2 mb-4">
              <Building className="h-4 w-4 text-vt-info" />
              <h2 className="heading-md text-vt-neutral-100">Issuer Onboarding</h2>
              <span className="text-[10px] code text-vt-neutral-800 border border-vt-neutral-800 rounded px-1.5 py-0.5">
                Wave 138
              </span>
            </div>
            <IssuerOnboardingPanel onIssuerRegistered={fetchOverview} />
          </motion.div>

          {/* Wave CC-146: Revocation Activity */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.36 }}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-vt-danger" />
              <h2 className="heading-md text-vt-neutral-100">Revocation Activity</h2>
              <span className="text-[10px] code text-vt-neutral-800 border border-vt-neutral-800 rounded px-1.5 py-0.5">
                CC-146
              </span>
            </div>
            <RevocationCascadePanel />
          </motion.div>

          {/* Wave 245: Async Trust Monitor */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.38 }}>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-blue-400" />
              <h2 className="heading-md text-vt-neutral-100">Async Trust Monitor</h2>
              <span className="text-[10px] code text-vt-neutral-800 border border-vt-neutral-800 rounded px-1.5 py-0.5">
                Wave 245
              </span>
            </div>
            <MonitoringStatusPanel />
          </motion.div>

          {/* Wave 143: Provider Directory Distribution */}
          <motion.div
            ref={directoryRef}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.37 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="heading-sm text-infra-muted uppercase tracking-widest">
                Provider Directory
              </span>
              <span className="text-xs text-vt-info border border-vt-info/20 rounded px-1.5 py-0.5">
                Wave 143
              </span>
            </div>
            <ProviderDirectoryPanel />
          </motion.div>

          {/* Wave 148: Payer Credential Network */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="heading-sm text-infra-muted uppercase tracking-widest">
                Payer Network
              </span>
              <span className="text-xs text-vt-info border border-vt-info/20 rounded px-1.5 py-0.5">
                Wave 148
              </span>
            </div>
            <PayerNetworkPanel />
          </motion.div>

          {/* Wave 150: Network Telemetry Intelligence */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="heading-sm text-infra-muted uppercase tracking-widest">
                Network Telemetry
              </span>
              <span className="text-xs text-vt-success border border-vt-success/20 rounded px-1.5 py-0.5">
                Wave 150
              </span>
            </div>
            <NetworkTelemetryDashboard />
          </motion.div>

          {/* Network Health Monitor — Wave 162 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <span className="heading-sm text-vt-neutral-200 uppercase tracking-wider">Network Health</span>
              <span className="text-xs text-vt-success border border-vt-success/20 rounded px-1.5 py-0.5">
                Wave 162
              </span>
            </div>
            <NetworkHealthPanel />
          </motion.div>
        </div>
      )}

      {!overview && !loading && !error && (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="text-5xl mb-4 opacity-20">⬡</div>
            <p className="text-sm text-vt-neutral-800">Loading Mission Ops…</p>
          </div>
        </div>
      )}

      {/* Wave 131 — Mission Telemetry */}
      {overview && <MissionTelemetry overview={overview} />}

      {/* Wave CC-146: Keyboard shortcut hints */}
      <div className="fixed bottom-4 right-4 flex items-center gap-3 rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/90 backdrop-blur-sm px-4 py-2 shadow-lg">
        <Keyboard className="h-3.5 w-3.5 text-vt-neutral-800" />
        {[
          { key: '⌘E', label: 'Export Dir' },
          { key: '⌘R', label: 'Refresh Graph' },
          { key: '⌘I', label: 'Inspect Node' },
        ].map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1 text-[10px] text-vt-neutral-800">
            <kbd className="px-1 py-0.5 rounded bg-vt-neutral-800 border border-vt-neutral-800 code text-vt-neutral-200 text-[9px]">
              {key}
            </kbd>
            {label}
          </span>
        ))}
      </div>
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
      color: 'var(--vt-color-success)',
    },
    {
      title: 'Control Coverage',
      value: '15/15',
      trend: 'flat' as const,
      series: seedSeries(15, 12, 0),
      color: 'var(--vt-color-brand-primary)',
    },
    {
      title: 'Issuer Health',
      value: 'Nominal',
      trend: 'up' as const,
      delta: '+1',
      series: seedSeries(95, 12, 0.04),
      color: 'var(--vt-color-info)',
    },
    {
      title: 'SDK Diagnostics',
      value: '3/3',
      trend: 'flat' as const,
      series: seedSeries(3, 12, 0),
      color: 'var(--vt-color-warning)',
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
      <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-5 animate-pulse space-y-3">
        <div className="h-6 w-1/3 bg-vt-neutral-800 rounded" />
        <div className="h-20 bg-vt-neutral-800/60 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-5 text-center">
        <p className="text-xs text-vt-neutral-800">Reputation engine warming up — no issuers scored yet</p>
      </div>
    );
  }

  const scoreColor =
    data.networkTrustScore >= 80
      ? 'text-vt-success'
      : data.networkTrustScore >= 60
        ? 'text-vt-info'
        : 'text-vt-warning';

  return (
    <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 overflow-hidden">
      <Grid cols={1} sm={4} className="divide-y sm:divide-y-0 sm:divide-x divide-vt-neutral-800">
        {/* Network score */}
        <div className="p-4 sm:col-span-1">
          <p className="text-[10px] text-vt-neutral-800 uppercase tracking-wider mb-1">Network Trust Score</p>
          <p className={`text-4xl font-bold ${scoreColor}`}>{data.networkTrustScore}</p>
          <p className="text-[10px] text-vt-neutral-800 mt-1">
            {data.networkTrustScore >= 80
              ? 'Healthy network'
              : data.networkTrustScore >= 60
                ? 'Moderate health'
                : 'Attention needed'}
          </p>
        </div>
        {/* Health breakdown */}
        <div className="p-4 sm:col-span-1">
          <p className="text-[10px] text-vt-neutral-800 uppercase tracking-wider mb-2">Issuer Health</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-vt-neutral-200">Healthy ≥80</span>
              <span className="text-vt-success font-medium">{data.healthyIssuers}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-vt-neutral-200">Degraded 50–79</span>
              <span className="text-vt-warning font-medium">{data.degradedIssuers}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-vt-neutral-200">Critical &lt;50</span>
              <span className="text-vt-danger font-medium">{data.criticalIssuers}</span>
            </div>
          </div>
        </div>
        {/* Top issuers */}
        <div className="p-4 sm:col-span-2">
          <p className="text-[10px] text-vt-neutral-800 uppercase tracking-wider mb-2">Issuer Scores</p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {data.issuerScores
              .sort((a, b) => b.trustScore - a.trustScore)
              .slice(0, 6)
              .map((s) => (
                <div key={s.issuerId} className="flex items-center gap-2">
                  <span className="flex-1 text-[11px] text-vt-neutral-200 truncate">{s.issuerName}</span>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <div className="w-16 h-1 bg-vt-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${s.trustScore}%`,
                          background:
                            s.trustScore >= 80
                              ? 'var(--vt-color-success)'
                              : s.trustScore >= 60
                                ? 'var(--vt-color-info)'
                                : 'var(--vt-color-warning)',
                        }}
                      />
                    </div>
                    <span className="text-[10px] code text-vt-neutral-800 w-6 text-right">
                      {s.trustScore}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </Grid>
      {/* Operator Debug Panel — Wave 170 */}
      <DebugPanel />
    </div>
  );
}
