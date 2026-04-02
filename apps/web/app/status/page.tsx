'use client';

/**
 * StatusPage.tsx — Infrastructure Status Page
 *
 * Public-facing status page showing system health, verification
 * throughput, source connectivity, and active incidents.
 */

import { Grid } from '@/components/layout/Grid';
import { IncidentPanel } from '@/components/system/IncidentPanel';
import NetworkTelemetryIntelligence from '@/components/telemetry/NetworkTelemetryIntelligence';
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

// ── Status colors ─────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, { text: string; dot: string }> = {
  OPERATIONAL: { text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  DEGRADED: { text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  OUTAGE: { text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  LOADING: { text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

// ── Component ─────────────────────────────────────────────────────────

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [networkHealth, setNetworkHealth] = useState<NetworkHealthStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  const overall: string = status?.overall ?? (loading ? 'LOADING' : 'DEGRADED');
  const overallLabel =
    overall === 'OPERATIONAL' ? 'All Systems Operational' :
    overall === 'DEGRADED' ? 'Partial System Degradation' :
    overall === 'OUTAGE' ? 'System Outage Detected' :
    overall === 'LOADING' ? 'Loading System Status…' :
    'Limited Visibility — Telemetry Unavailable';
  const style = STATUS_COLOR[overall] ?? STATUS_COLOR.DEGRADED;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
        {/* Overall Status Banner */}
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className={`inline-block h-3 w-3 rounded-full ${style.dot} animate-pulse`} />
            <span className={`text-2xl font-semibold ${style.text}`}>
              {overallLabel}
            </span>
          </div>
          {status ? (
            <p className="text-xs text-muted-foreground">
              Uptime: {status.uptime} | Last updated: {new Date(status.generatedAt).toLocaleTimeString()}
            </p>
          ) : !loading ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Telemetry unavailable — backend may be starting up or unreachable.{' '}
              <a href="/api/intelligence/system-health" className="underline underline-offset-2">Check system health →</a>
            </p>
          ) : null}
        </div>

        {/* Metrics Grid */}
        <NetworkTelemetryIntelligence windowDays={7} />

        <Grid cols={1} lg={2} gap="lg">
          {/* Verification Health */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
              Verification Throughput
            </h3>
            {status ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Last 1 hour</span>
                  <span className="text-foreground tabular-nums">{status.verificationHealth.last1h}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Last 24 hours</span>
                  <span className="text-foreground tabular-nums">{status.verificationHealth.last24h}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Avg Latency</span>
                  <span className="text-foreground tabular-nums">{status.latency.average} ms</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">P95 Latency</span>
                  <span className="text-foreground tabular-nums">{status.latency.p95} ms</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-4 bg-muted rounded animate-pulse" />
                ))}
              </div>
            )}
          </div>

          {/* Artifact Integrity */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
              Artifact Integrity
            </h3>
            {status ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Artifacts</span>
                  <span className="text-foreground tabular-nums">{status.artifactIntegrity.total}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Verified</span>
                  <span className="text-green-700 dark:text-green-400 tabular-nums">{status.artifactIntegrity.verified}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Revoked</span>
                  <span className="text-red-700 dark:text-red-400 tabular-nums">{status.artifactIntegrity.revoked}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Expired</span>
                  <span className="text-amber-700 dark:text-amber-400 tabular-nums">{status.artifactIntegrity.expired}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-4 bg-muted rounded animate-pulse" />
                ))}
              </div>
            )}
          </div>
        </Grid>

        {/* Extended Trust Metrics */}
        <div>
          <h2 className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
            Extended Trust Metrics
          </h2>
          <Grid cols={2} lg={4} gap="md">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Revocations</p>
              {loading ? (
                <div className="h-8 w-16 rounded bg-muted animate-pulse" />
              ) : (
                <p className="text-2xl font-bold text-red-700 dark:text-red-400 tabular-nums">
                  {status?.artifactIntegrity?.revoked ?? '—'}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">cumulative revoked</p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Source Health</p>
              {loading ? (
                <div className="h-8 w-16 rounded bg-muted animate-pulse" />
              ) : networkHealth ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${
                      networkHealth.stats.healthyIssuers === networkHealth.stats.totalIssuers
                        ? 'bg-green-500' : 'bg-amber-500'
                    }`} />
                    <p className={`text-2xl font-bold tabular-nums ${
                      networkHealth.stats.healthyIssuers === networkHealth.stats.totalIssuers
                        ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'
                    }`}>
                      {networkHealth.stats.healthyIssuers}/{networkHealth.stats.totalIssuers}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">sources healthy</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                    <p className="text-2xl font-bold text-muted-foreground tabular-nums">—</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">unavailable</p>
                </>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Networks</p>
              {loading ? (
                <div className="h-8 w-16 rounded bg-muted animate-pulse" />
              ) : networkHealth ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${
                      networkHealth.stats.activeNetworks === networkHealth.stats.federatedNetworks
                        ? 'bg-blue-500' : 'bg-amber-500'
                    }`} />
                    <p className={`text-2xl font-bold tabular-nums ${
                      networkHealth.stats.activeNetworks === networkHealth.stats.federatedNetworks
                        ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400'
                    }`}>
                      {networkHealth.stats.activeNetworks}/{networkHealth.stats.federatedNetworks}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">networks active</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                    <p className="text-2xl font-bold text-muted-foreground tabular-nums">—</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">unavailable</p>
                </>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Audit Rate</p>
              {loading ? (
                <div className="h-8 w-16 rounded bg-muted animate-pulse" />
              ) : (
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {status?.verificationHealth?.last1h != null
                    ? `${status.verificationHealth.last1h}/hr`
                    : '—'}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">events this hour</p>
            </div>
          </Grid>
        </div>

        {/* Source Connectivity */}
        {status && status.sourceConnectivity.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
              Source Connectivity
            </h3>
            <div className="space-y-2">
              {status.sourceConnectivity.map((src) => {
                const srcStyle = STATUS_COLOR[src.status] ?? STATUS_COLOR.OPERATIONAL;
                return (
                  <div key={src.source} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${srcStyle.dot}`} />
                      <span className="text-foreground">{src.source}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground tabular-nums">{src.artifactCount} artifacts</span>
                      <span className={`${srcStyle.text} uppercase text-[10px]`}>
                        {src.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Incidents */}
        <IncidentPanel incidents={status?.incidents ?? []} />
      </main>
    </div>
  );
}
