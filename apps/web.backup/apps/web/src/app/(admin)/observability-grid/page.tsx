'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Server, Gauge, BellRing, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

interface ObservabilitySnapshot {
  region: string;
  metrics: {
    chain: {
      blockTimeMs: number;
      finalityLag: number;
      queueDepth: number;
      validatorHealth: Array<{ nodeId: string; status: string; latencyMs: number }>;
    };
    aiAgents: {
      successRate: number;
      avgLatencyMs: number;
      hitlRate: number;
    };
    psvPipeline: {
      ocrThroughput: number;
      npdbLatencyMinutes: number;
      sanctionsMatches: number;
      boardVerifications: number;
    };
    hris: {
      apiErrors24h: number;
      syncFailures24h: number;
      slowRegions: string[];
    };
    alerts: Array<{ id: string; severity: 'info' | 'warning' | 'critical'; message: string }>;
  };
  failover: Array<{ region: string; status: string; latencyMs: number }>;
  digest: string;
  generatedAt: string;
}

export default function ObservabilityGridPage() {
  const { formatError } = useRoleUX();
  const [snapshot, setSnapshot] = useState<ObservabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/observability/grid`);
      if (!response.ok) {
        throw new Error(`Observability API failed (${response.status})`);
      }
      const payload = (await response.json()) as ObservabilitySnapshot;
      setSnapshot(payload);
    } catch (err) {
      console.error('[admin][observability-grid] load failed', err);
      setError(formatError('observability_fetch_failed', err instanceof Error ? err.message : 'Unable to load grid'));
    } finally {
      setLoading(false);
    }
  }, [formatError]);

  useEffect(() => {
    void load();
  }, [load]);

  const alertSummary = useMemo(() => snapshot?.metrics.alerts ?? [], [snapshot]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-8">
      <header className="flex flex-col gap-3 px-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-2">
            <Activity className="h-3.5 w-3.5" />
            Observability grid v4
          </Badge>
          <Badge variant="outline">{snapshot ? new Date(snapshot.generatedAt).toLocaleString() : '—'}</Badge>
          <div className="ml-auto">
            <Button variant="outline" onClick={load} disabled={loading}>
              Refresh grid
            </Button>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Full-fabric observability</h1>
          <p className="text-sm text-muted-foreground">
            Chain telemetry, AI guardrails, PSV pipelines, and HRIS connectors in one control plane.
          </p>
        </div>
        {error && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </div>
        )}
      </header>

      {snapshot && (
        <>
          <section className="grid gap-4 px-4 md:grid-cols-4">
            <MetricCard
              icon={Server}
              label="Block time"
              value={`${snapshot.metrics.chain.blockTimeMs}ms`}
              description={`Finality lag ${snapshot.metrics.chain.finalityLag} blocks`}
            />
            <MetricCard
              icon={Gauge}
              label="AI success"
              value={`${(snapshot.metrics.aiAgents.successRate * 100).toFixed(1)}%`}
              description={`Latency ${snapshot.metrics.aiAgents.avgLatencyMs.toFixed(0)}ms`}
            />
            <MetricCard
              icon={BellRing}
              label="Active alerts"
              value={alertSummary.length}
              description="Threshold-based guardrails"
            />
            <MetricCard
              icon={Globe}
              label="Slow HRIS regions"
              value={snapshot.metrics.hris.slowRegions.length}
              description="Latency > 4.5s"
            />
          </section>

          <Card className="mx-4">
            <CardHeader>
              <CardTitle>Chain observability collector v3</CardTitle>
              <CardDescription>Validators, queue depth, and failover posture.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
              <div className="space-y-2">
                {snapshot.metrics.chain.validatorHealth.map((node) => (
                  <div
                    key={node.nodeId}
                    className="flex items-center justify-between rounded border p-3 text-sm"
                  >
                    <div>
                      <p className="font-mono text-xs">{node.nodeId}</p>
                      <p className="text-xs text-muted-foreground">Latency {node.latencyMs}ms</p>
                    </div>
                    <Badge
                      variant={
                        node.status === 'active'
                          ? 'outline'
                          : node.status === 'degraded'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {node.status}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold">Failover map</p>
                <ul className="mt-3 space-y-1 text-xs">
                  {snapshot.failover.map((entry) => (
                    <li key={entry.region} className="flex items-center justify-between">
                      <span>{entry.region}</span>
                      <span>
                        {entry.status}{' '}
                        <Badge variant="outline" className="ml-1">
                          {entry.latencyMs}ms
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="mx-4">
            <CardHeader>
              <CardTitle>AI agent & PSV pipeline observability</CardTitle>
              <CardDescription>Guardrails across HITL triggers, NPDB latency, sanctions, and board verification.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4 text-sm">
                <p className="font-semibold">AI guardrails</p>
                <p className="text-muted-foreground">
                  HITL rate {(snapshot.metrics.aiAgents.hitlRate * 100).toFixed(1)}% ·{' '}
                  {snapshot.metrics.aiAgents.avgLatencyMs.toFixed(0)}ms avg latency
                </p>
              </div>
              <div className="rounded-lg border p-4 text-sm">
                <p className="font-semibold">PSV throughput</p>
                <p className="text-muted-foreground">
                  {snapshot.metrics.psvPipeline.ocrThroughput} OCR docs · {snapshot.metrics.psvPipeline.boardVerifications}{' '}
                  board verifications
                </p>
                <p className="text-xs text-muted-foreground">
                  NPDB latency {snapshot.metrics.psvPipeline.npdbLatencyMinutes.toFixed(1)} minutes ·{' '}
                  {snapshot.metrics.psvPipeline.sanctionsMatches} sanctions matches
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="mx-4">
            <CardHeader>
              <CardTitle>Alerts & digest</CardTitle>
              <CardDescription>Threshold based alert engine and daily digest copy.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              {alertSummary.length === 0 ? (
                <p className="text-muted-foreground">All systems nominal.</p>
              ) : (
                alertSummary.map((alert) => (
                  <div key={alert.id} className="rounded border p-2">
                    <p className="font-semibold capitalize">{alert.severity}</p>
                    <p>{alert.message}</p>
                  </div>
                ))
              )}
              <div>
                <p className="text-xs uppercase text-muted-foreground">Digest</p>
                <p className="font-mono text-xs">{snapshot.digest}</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

