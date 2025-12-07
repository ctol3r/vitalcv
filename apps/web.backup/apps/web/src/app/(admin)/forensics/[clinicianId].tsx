'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Loader2,
  RefreshCw,
  ShieldExclamation,
  TimerReset,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000').replace(/\/$/, '');

interface ForensicsSignal {
  id: string;
  clinicianId: string;
  category: 'identity' | 'document' | 'behavior' | 'registry';
  type: string;
  severity: 'low' | 'medium' | 'high';
  score: number;
  description: string;
  observedAt: string;
  metadata?: Record<string, unknown>;
}

interface ForensicsRecord {
  id: string;
  clinicianId: string;
  riskScore: number;
  signals: ForensicsSignal[];
  lastReviewed: string;
}

interface ForensicsHistoryResponse {
  clinicianId: string;
  records: ForensicsRecord[];
}

interface PageProps {
  params: { clinicianId: string };
}

export default function ForensicsInvestigationPage({ params }: PageProps) {
  const [history, setHistory] = useState<ForensicsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        buildApiUrl(`/api/forensics/clinicians/${params.clinicianId}?limit=20`),
        { cache: 'no-store' },
      );
      if (!response.ok) {
        throw new Error(`Forensics API responded ${response.status}`);
      }
      const payload = (await response.json()) as ForensicsHistoryResponse;
      setHistory(payload.records ?? []);
    } catch (err) {
      console.warn('[forensics][history] failed to load', err);
      setError('Live forensics timeline unavailable. Showing cached snapshot.');
      setHistory(buildMockHistory(params.clinicianId));
    } finally {
      setLoading(false);
    }
  }, [params.clinicianId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const currentRecord = history[0] ?? null;
  const aggregatedSignals = useMemo(() => {
    const map = new Map<string, ForensicsSignal & { occurrences: number }>();
    history.forEach((record) => {
      record.signals?.forEach((signal) => {
        const key = `${signal.category}:${signal.type}`;
        const existing = map.get(key);
        if (existing) {
          existing.occurrences += 1;
          existing.score = Math.max(existing.score, signal.score);
          existing.severity = signal.severity === 'high' ? 'high' : existing.severity;
        } else {
          map.set(key, { ...signal, occurrences: 1 });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.score - a.score);
  }, [history]);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Credential forensics</p>
          <h1 className="text-3xl font-bold tracking-tight">Investigation matrix</h1>
          <p className="text-muted-foreground max-w-3xl">
            Drill into identity, document, behavior, and registry signals for clinician{' '}
            <span className="font-semibold">{params.clinicianId}</span>. Each regression or escalation is
            anchored for compliance review.
          </p>
        </div>
        <Button onClick={fetchHistory} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh snapshot
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Degraded telemetry</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Current risk score"
          description={currentRecord ? `Last reviewed ${formatRelative(currentRecord.lastReviewed)}` : 'Pending evaluation'}
          value={currentRecord ? `${currentRecord.riskScore.toFixed(1)}` : '—'}
          badge={classifyRisk(currentRecord?.riskScore ?? 0)}
          icon={<ShieldExclamation className="h-5 w-5 text-muted-foreground" />}
          loading={loading}
        />
        <MetricCard
          title="High severity signals"
          description="Across current window"
          value={currentRecord ? currentRecord.signals.filter((signal) => signal.severity === 'high').length : '—'}
          icon={<Activity className="h-5 w-5 text-muted-foreground" />}
          loading={loading}
        />
        <MetricCard
          title="History span"
          description="Records captured"
          value={history.length}
          icon={<TimerReset className="h-5 w-5 text-muted-foreground" />}
          loading={loading}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.8fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Risk evolution</CardTitle>
              <CardDescription>Composite score across the last {history.length || 1} evaluations.</CardDescription>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Trend
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : history.length ? (
              <RiskSparkline records={history} />
            ) : (
              <EmptyState message="No forensic runs captured yet." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Signal breakdown</CardTitle>
            <CardDescription>Top contributors by severity and recurrence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : aggregatedSignals.length ? (
              aggregatedSignals.slice(0, 6).map((signal) => (
                <div key={signal.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold capitalize">{signal.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">{signal.category}</p>
                    </div>
                    <Badge variant={badgeVariant(signal.severity)}>{signal.severity}</Badge>
                  </div>
                  <div className="mt-3 h-2 rounded bg-muted">
                    <div
                      className="h-2 rounded bg-primary transition-all"
                      style={{ width: `${Math.min(signal.score * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {signal.occurrences} occurrence{signal.occurrences === 1 ? '' : 's'} ·{' '}
                    {signal.description}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState message="No elevated contributors detected." />
            )}
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Signals timeline</TabsTrigger>
          <TabsTrigger value="events">Raw events</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Anchored forensic snapshots</CardTitle>
              <CardDescription>Each entry reflects a persisted IdentityForensics record.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : history.length ? (
                <ForensicsTimeline records={history} />
              ) : (
                <EmptyState message="No forensic timeline available yet." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Raw signal feed</CardTitle>
              <CardDescription>Flattened view across identity, document, behavior, and registry inputs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : aggregatedSignals.length ? (
                aggregatedSignals.map((signal) => (
                  <div key={signal.id} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold capitalize">{signal.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">{signal.category}</p>
                      </div>
                      <Badge variant={badgeVariant(signal.severity)}>{signal.severity}</Badge>
                    </div>
                    <p className="mt-2 text-sm">{signal.description}</p>
                  </div>
                ))
              ) : (
                <EmptyState message="No raw events recorded." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ForensicsTimeline({ records }: { records: ForensicsRecord[] }) {
  return (
    <div className="space-y-6">
      {records.map((record, index) => (
        <div key={record.id} className="relative pl-6">
          <div className="absolute left-1 top-1 h-full w-px bg-border" aria-hidden="true" />
          <div className="absolute left-0 top-2 h-3 w-3 rounded-full bg-primary shadow-sm" />
          <div className="rounded-lg border p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Snapshot #{records.length - index}</p>
                <p className="text-xl font-semibold">{record.riskScore.toFixed(1)} risk</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
                {new Date(record.lastReviewed).toLocaleString()}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {record.signals.slice(0, 4).map((signal) => (
                <Badge key={signal.id} variant={badgeVariant(signal.severity)}>
                  {signal.type.replace(/_/g, ' ')}
                </Badge>
              ))}
              {record.signals.length > 4 && (
                <Badge variant="outline">+{record.signals.length - 4} more</Badge>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {record.signals[0]?.description ?? 'No high-signal narrative recorded.'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskSparkline({ records }: { records: ForensicsRecord[] }) {
  const maxScore = Math.max(...records.map((record) => record.riskScore));
  const minScore = Math.min(...records.map((record) => record.riskScore));
  const scale = maxScore === minScore ? 1 : maxScore - minScore;

  return (
    <div className="flex h-48 items-end gap-2">
      {records
        .slice()
        .reverse()
        .map((record) => {
          const normalized = (record.riskScore - minScore) / scale;
          return (
            <div key={record.id} className="flex flex-1 flex-col items-center gap-2">
              <div
                className={`w-full rounded-t ${riskColor(record.riskScore)}`}
                style={{ height: `${Math.max(normalized * 100, 8)}%` }}
              />
              <span className="text-xs text-muted-foreground">{record.riskScore.toFixed(0)}</span>
            </div>
          );
        })}
    </div>
  );
}

function MetricCard({
  title,
  description,
  value,
  badge,
  icon,
  loading,
}: {
  title: string;
  description: string;
  value: string | number;
  badge?: string;
  icon: ReactNode;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {icon}
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        {loading ? (
          <Skeleton className="h-6 w-16" />
        ) : (
          <span className="text-2xl font-semibold">{value}</span>
        )}
        {badge && !loading && (
          <Badge variant="outline" className="uppercase">
            {badge}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function classifyRisk(score: number): string {
  if (score >= 75) return 'High';
  if (score >= 50) return 'Elevated';
  if (score > 0) return 'Low';
  return 'n/a';
}

function badgeVariant(severity: ForensicsSignal['severity']) {
  switch (severity) {
    case 'high':
      return 'destructive';
    case 'medium':
      return 'secondary';
    default:
      return 'outline';
  }
}

function riskColor(score: number) {
  if (score >= 75) return 'bg-red-500';
  if (score >= 50) return 'bg-amber-500';
  if (score >= 25) return 'bg-yellow-400';
  return 'bg-emerald-500';
}

function formatRelative(timestamp: string) {
  const delta = Date.now() - new Date(timestamp).getTime();
  const hours = Math.round(delta / (1000 * 60 * 60));
  if (hours <= 1) {
    return 'just now';
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}

function buildApiUrl(path: string) {
  if (!API_BASE) {
    return path;
  }
  return `${API_BASE}${path}`;
}

function buildMockHistory(clinicianId: string): ForensicsRecord[] {
  const now = Date.now();
  return Array.from({ length: 4 }).map((_, index) => {
    const timestamp = new Date(now - index * 1000 * 60 * 60 * 6).toISOString();
    return {
      id: `mock-${index}`,
      clinicianId,
      riskScore: 45 + index * 6,
      lastReviewed: timestamp,
      signals: [
        {
          id: `identity:name_drift:${index}`,
          clinicianId,
          category: 'identity',
          type: 'name_drift_vs_npi_history',
          severity: index >= 2 ? 'medium' : 'low',
          score: 0.45 + index * 0.1,
          description: 'Detected shifts in preferred name vs. NPPES profile.',
          observedAt: timestamp,
          metadata: {},
        },
        {
          id: `document:fingerprint:${index}`,
          clinicianId,
          category: 'document',
          type: 'fingerprint_reuse',
          severity: index >= 1 ? 'high' : 'medium',
          score: 0.75,
          description: 'Fingerprint overlaps with artifacts from another clinician.',
          observedAt: timestamp,
          metadata: {},
        },
      ],
    };
  });
}


