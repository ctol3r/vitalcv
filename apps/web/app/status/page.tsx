'use client';

/**
 * StatusPage.tsx — Wave 90: Infrastructure Status Page
 *
 * Public-facing status page showing system health, verification
 * throughput, network nodes, latency, and active incidents.
 */

import { Grid } from '@/components/layout/Grid';
import { IncidentPanel } from '@/components/system/IncidentPanel';
import NetworkTelemetryIntelligence from '@/components/telemetry/NetworkTelemetryIntelligence';
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

interface NetworkHealthStats {
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';
  stats: {
    totalIssuers: number;
    healthyIssuers: number;
    federatedNetworks: number;
    activeNetworks: number;
  };
}

// ── Styles ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  OPERATIONAL: { bg: 'bg-vt-success/10', text: 'text-vt-success', dot: 'bg-vt-success' },
  DEGRADED: { bg: 'bg-vt-warning/10', text: 'text-vt-warning', dot: 'bg-vt-warning' },
  OUTAGE: { bg: 'bg-vt-danger/10', text: 'text-vt-danger', dot: 'bg-red-400' },
  LOADING: { bg: 'bg-slate-800/60', text: 'text-slate-400', dot: 'bg-slate-500' },
};

// ── Component ─────────────────────────────────────────────────────────

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [networkHealth, setNetworkHealth] = useState<NetworkHealthStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use relative Next.js proxy routes (Wave 163) — works in production without NEXT_PUBLIC_API_BASE
    Promise.all([
      fetch('/api/system/status', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null),
      fetch('/api/network/health', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([s, nh]) => {
        if (s) setStatus(s as SystemStatus);
        if (nh) setNetworkHealth(nh as NetworkHealthStats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // When telemetry is unavailable, be honest: show "Degraded / Limited visibility"
  // instead of falsely claiming all systems operational.
  const overall: string = status?.overall ?? (loading ? 'LOADING' : 'DEGRADED');
  const overallLabel =
    overall === 'OPERATIONAL' ? 'All Systems Operational' :
    overall === 'DEGRADED' ? 'Partial System Degradation' :
    overall === 'OUTAGE' ? 'System Outage Detected' :
    overall === 'LOADING' ? 'Loading System Status…' :
    'Limited Visibility — Telemetry Unavailable';
  const style = STATUS_COLOR[overall] ?? STATUS_COLOR.DEGRADED;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
        {/* Overall Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border border-vt-neutral-800 ${style.bg} p-8 text-center`}
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className={`inline-block h-3 w-3 rounded-full ${style.dot} animate-pulse`} />
            <span className={`text-2xl font-semibold ${style.text}`}>
              {overallLabel}
            </span>
          </div>
          {status ? (
            <p className="text-xs text-vt-neutral-800 code">
              Uptime: {status.uptime} | Last updated: {new Date(status.generatedAt).toLocaleTimeString()}
            </p>
          ) : !loading ? (
            <p className="mt-2 text-xs text-amber-400/70">
              Telemetry unavailable — backend may be starting up or unreachable.{' '}
              <a href="/api/intelligence/system-health" className="underline opacity-70 hover:opacity-100">Check system health →</a>
            </p>
          ) : null}
        </motion.div>

        {/* Metrics Grid */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <NetworkTelemetryIntelligence windowDays={7} />
        </motion.div>

        <Grid cols={1} lg={2} gap="lg">
          {/* Verification Health */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5"
          >
            <h3 className="text-[10px] text-vt-neutral-800 uppercase tracking-wider mb-3 code">
              Verification Throughput
            </h3>
            {status ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-vt-neutral-200">Last 1 hour</span>
                  <span className="text-white code">{status.verificationHealth.last1h}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-vt-neutral-200">Last 24 hours</span>
                  <span className="text-white code">{status.verificationHealth.last24h}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-vt-neutral-200">Avg Latency</span>
                  <span className="text-white code">{status.latency.average} ms</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-vt-neutral-200">P95 Latency</span>
                  <span className="text-white code">{status.latency.p95} ms</span>
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
            className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5"
          >
            <h3 className="text-[10px] text-vt-neutral-800 uppercase tracking-wider mb-3 code">
              Artifact Integrity
            </h3>
            {status ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-vt-neutral-200">Total Artifacts</span>
                  <span className="text-white code">{status.artifactIntegrity.total}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-vt-neutral-200">Verified</span>
                  <span className="text-vt-success code">{status.artifactIntegrity.verified}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-vt-neutral-200">Revoked</span>
                  <span className="text-vt-danger code">{status.artifactIntegrity.revoked}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-vt-neutral-200">Expired</span>
                  <span className="text-vt-warning code">{status.artifactIntegrity.expired}</span>
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
        </Grid>

        {/* Extended Telemetry — Wave 135 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <h2 className="text-[10px] text-vt-neutral-800 uppercase tracking-wider mb-3 code">
            Extended Trust Metrics
          </h2>
          <Grid cols={2} lg={4} gap="md">
            {/* Revocation Count — from system status artifactIntegrity */}
            <div className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-4">
              <p className="text-[10px] code uppercase tracking-wider text-vt-neutral-800 mb-2">Revocations</p>
              {loading ? (
                <div className="h-8 w-16 rounded bg-white/5 animate-pulse" />
              ) : (
                <p className="heading-xl text-vt-danger code">
                  {status?.artifactIntegrity?.revoked ?? '—'}
                </p>
              )}
              <p className="text-xs text-vt-neutral-800 mt-1">cumulative revoked</p>
            </div>
            {/* Issuer Health — from networkHealth stats */}
            <div className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-4">
              <p className="text-[10px] code uppercase tracking-wider text-vt-neutral-800 mb-2">Issuer Health</p>
              {loading ? (
                <div className="h-8 w-16 rounded bg-white/5 animate-pulse" />
              ) : networkHealth ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${
                      networkHealth.stats.healthyIssuers === networkHealth.stats.totalIssuers
                        ? 'bg-vt-success' : 'bg-vt-warning'
                    }`} />
                    <p className={`heading-xl code ${
                      networkHealth.stats.healthyIssuers === networkHealth.stats.totalIssuers
                        ? 'text-vt-success' : 'text-vt-warning'
                    }`}>
                      {networkHealth.stats.healthyIssuers}/{networkHealth.stats.totalIssuers}
                    </p>
                  </div>
                  <p className="text-xs text-vt-neutral-800 mt-1">issuers healthy</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-vt-neutral-600" />
                    <p className="heading-xl text-vt-neutral-800 code">—</p>
                  </div>
                  <p className="text-xs text-vt-neutral-800 mt-1">unavailable</p>
                </>
              )}
            </div>
            {/* Federation Health — from networkHealth stats */}
            <div className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-4">
              <p className="text-[10px] code uppercase tracking-wider text-vt-neutral-800 mb-2">Federation</p>
              {loading ? (
                <div className="h-8 w-16 rounded bg-white/5 animate-pulse" />
              ) : networkHealth ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${
                      networkHealth.stats.activeNetworks === networkHealth.stats.federatedNetworks
                        ? 'bg-vt-info' : 'bg-vt-warning'
                    }`} />
                    <p className={`heading-xl code ${
                      networkHealth.stats.activeNetworks === networkHealth.stats.federatedNetworks
                        ? 'text-vt-info' : 'text-vt-warning'
                    }`}>
                      {networkHealth.stats.activeNetworks}/{networkHealth.stats.federatedNetworks}
                    </p>
                  </div>
                  <p className="text-xs text-vt-neutral-800 mt-1">networks active</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-vt-neutral-600" />
                    <p className="heading-xl text-vt-neutral-800 code">—</p>
                  </div>
                  <p className="text-xs text-vt-neutral-800 mt-1">unavailable</p>
                </>
              )}
            </div>
            {/* Audit Event Rate — from system status verificationHealth */}
            <div className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-4">
              <p className="text-[10px] code uppercase tracking-wider text-vt-neutral-800 mb-2">Audit Rate</p>
              {loading ? (
                <div className="h-8 w-16 rounded bg-white/5 animate-pulse" />
              ) : (
                <p className="heading-xl text-vt-brand-primary code">
                  {status?.verificationHealth?.last1h != null
                    ? `${status.verificationHealth.last1h}/hr`
                    : '—'}
                </p>
              )}
              <p className="text-xs text-vt-neutral-800 mt-1">events this hour</p>
            </div>
          </Grid>
        </motion.div>

        {/* Source Connectivity */}
        {status && status.sourceConnectivity.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5"
          >
            <h3 className="text-[10px] text-vt-neutral-800 uppercase tracking-wider mb-3 code">
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
                      <span className="text-vt-neutral-800 code">{src.artifactCount} artifacts</span>
                      <span className={`${srcStyle.text} code uppercase text-[10px]`}>
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
