'use client';

/**
 * StatusPage.tsx — Wave 90: Infrastructure Status Page
 *
 * Public-facing status page showing system health, verification
 * throughput, network nodes, latency, and active incidents.
 */

import { IncidentPanel } from '@/components/system/IncidentPanel';
import NetworkTelemetryIntelligence from '@/components/telemetry/NetworkTelemetryIntelligence';
import { getApiBase } from '@/lib/api';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────

interface SystemStatus {
  overall: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
  uptime: string;
  verificationHealth: {
    status: string;
    last24h: number;
    last1h: number;
  };
  latency: {
    average: number;
    p95: number;
  };
  artifactIntegrity: {
    total: number;
    verified: number;
    revoked: number;
    expired: number;
  };
  sourceConnectivity: Array<{
    source: string;
    status: string;
    lastSeen: string | null;
    artifactCount: number;
  }>;
  incidents: Array<{
    id: string;
    type: 'credential_outage' | 'source_downtime' | 'revocation_spike';
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    description: string;
    detectedAt: string;
    resolved: boolean;
  }>;
  generatedAt: string;
}

// ── Styles ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  OPERATIONAL: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  DEGRADED: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  OUTAGE: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
};

// ── Component ─────────────────────────────────────────────────────────

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const base = getApiBase();

  useEffect(() => {
    Promise.all([
      fetch(`${base}/api/system/status`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([s]) => {
        if (s) setStatus(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [base]);

  const overall = status?.overall ?? 'OPERATIONAL';
  const style = STATUS_COLOR[overall] ?? STATUS_COLOR.OPERATIONAL;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
        {/* Overall Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border border-white/8 ${style.bg} p-8 text-center`}
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className={`inline-block h-3 w-3 rounded-full ${style.dot} animate-pulse`} />
            <span className={`text-2xl font-semibold ${style.text}`}>
              {overall === 'OPERATIONAL' ? 'All Systems Operational' :
               overall === 'DEGRADED' ? 'Partial System Degradation' :
               'System Outage Detected'}
            </span>
          </div>
          {status && (
            <p className="text-xs text-zinc-500 font-mono">
              Uptime: {status.uptime} | Last updated: {new Date(status.generatedAt).toLocaleTimeString()}
            </p>
          )}
        </motion.div>

        {/* Metrics Grid */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <NetworkTelemetryIntelligence windowDays={7} />
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Verification Health */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-white/8 bg-slate-900/40 p-5"
          >
            <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3 font-mono">
              Verification Throughput
            </h3>
            {status ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Last 1 hour</span>
                  <span className="text-white font-mono">{status.verificationHealth.last1h}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Last 24 hours</span>
                  <span className="text-white font-mono">{status.verificationHealth.last24h}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Avg Latency</span>
                  <span className="text-white font-mono">{status.latency.average} ms</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">P95 Latency</span>
                  <span className="text-white font-mono">{status.latency.p95} ms</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-4 bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            )}
          </motion.div>

          {/* Artifact Integrity */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-white/8 bg-slate-900/40 p-5"
          >
            <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3 font-mono">
              Artifact Integrity
            </h3>
            {status ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Total Artifacts</span>
                  <span className="text-white font-mono">{status.artifactIntegrity.total}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Verified</span>
                  <span className="text-emerald-400 font-mono">{status.artifactIntegrity.verified}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Revoked</span>
                  <span className="text-red-400 font-mono">{status.artifactIntegrity.revoked}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Expired</span>
                  <span className="text-amber-400 font-mono">{status.artifactIntegrity.expired}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-4 bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Extended Telemetry — Wave 135 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <h2 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3 font-mono">
            Extended Trust Metrics
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revocation Events */}
            <div className="rounded-xl border border-white/8 bg-slate-900/40 p-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">Revocations (24h)</p>
              <p className="text-2xl font-bold text-red-400 font-mono">
                {status?.artifactIntegrity?.revoked ?? '—'}
              </p>
              <p className="text-xs text-zinc-600 mt-1">cumulative active</p>
            </div>
            {/* Issuer Health */}
            <div className="rounded-xl border border-white/8 bg-slate-900/40 p-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">Issuer Health</p>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <p className="text-2xl font-bold text-emerald-400 font-mono">
                  {status ? 'OK' : '—'}
                </p>
              </div>
              <p className="text-xs text-zinc-600 mt-1">trust registry nominal</p>
            </div>
            {/* Federation Health */}
            <div className="rounded-xl border border-white/8 bg-slate-900/40 p-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">Federation</p>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                <p className="text-2xl font-bold text-sky-400 font-mono">
                  {status ? 'Synced' : '—'}
                </p>
              </div>
              <p className="text-xs text-zinc-600 mt-1">Nursys · CAQH · ABMS</p>
            </div>
            {/* Audit Event Rate */}
            <div className="rounded-xl border border-white/8 bg-slate-900/40 p-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">Audit Rate</p>
              <p className="text-2xl font-bold text-violet-400 font-mono">
                {status?.verificationHealth?.last1h != null
                  ? `${status.verificationHealth.last1h}/hr`
                  : '—'}
              </p>
              <p className="text-xs text-zinc-600 mt-1">events this hour</p>
            </div>
          </div>
        </motion.div>

        {/* Source Connectivity */}
        {status && status.sourceConnectivity.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl border border-white/8 bg-slate-900/40 p-5"
          >
            <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3 font-mono">
              Source Connectivity
            </h3>
            <div className="space-y-2">
              {status.sourceConnectivity.map((src) => {
                const srcStyle = STATUS_COLOR[src.status] ?? STATUS_COLOR.OPERATIONAL;
                return (
                  <div key={src.source} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${srcStyle.dot}`} />
                      <span className="text-white">{src.source}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-500 font-mono">{src.artifactCount} artifacts</span>
                      <span className={`${srcStyle.text} font-mono uppercase text-[10px]`}>
                        {src.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Incidents */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <IncidentPanel incidents={status?.incidents ?? []} />
        </motion.div>
      </main>
    </div>
  );
}
