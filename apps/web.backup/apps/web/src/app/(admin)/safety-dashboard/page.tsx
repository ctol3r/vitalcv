'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, BarChart3, LineChart, RefreshCcw, Shield, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type Trend = 'up' | 'down' | 'flat';

interface ServiceLineTrend {
  name: string;
  signals: number;
  severityIndex: number;
  commendations: number;
  trend: Trend;
}

interface CorrelationEntry {
  privilege: string;
  signalType: string;
  correlationScore: number;
  sampleSize: number;
}

interface SafetyDashboardResponse {
  generatedAt: string;
  summary: {
    totalSignals: number;
    commendations: number;
    highSeverity: number;
  };
  serviceLines: ServiceLineTrend[];
  correlationMatrix: CorrelationEntry[];
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE ??
  process.env.API_BASE_URL ??
  '';

export default function AdminSafetyDashboardPage() {
  const [snapshot, setSnapshot] = useState<SafetyDashboardResponse | null>(null);
  const [state, setState] = useState<'loading' | 'idle' | 'error'>('loading');

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setState('loading');
    try {
      const data = await fetchSafetyDashboard();
      setSnapshot(data);
      setState('idle');
    } catch (error) {
      console.warn('[admin][safety-dashboard]', error);
      setSnapshot(buildFallbackDashboard());
      setState('error');
    }
  }

  const topServiceLines = useMemo(() => (snapshot ? snapshot.serviceLines.slice(0, 5) : []), [snapshot]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">Admin · Safety dashboard</Badge>
          {state === 'error' && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Degraded
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={state === 'loading'}>
              <RefreshCcw className={cn('mr-2 h-4 w-4', state === 'loading' && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Hospital-level safety dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Per service-line safety trends and privilege correlation insights. No PHI stored or rendered.
          </p>
        </div>
      </header>

      {snapshot ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Signals (30d)"
              value={snapshot.summary.totalSignals}
              description={`${snapshot.summary.highSeverity} high severity`}
            />
            <StatCard
              label="Commendations"
              value={snapshot.summary.commendations}
              description="Positive signals surfaced to admin"
              icon={<LineChart className="h-5 w-5 text-emerald-500" />}
            />
            <StatCard
              label="Service lines monitored"
              value={snapshot.serviceLines.length}
              description="Tracked departments"
              icon={<BarChart3 className="h-5 w-5 text-indigo-500" />}
            />
          </section>

          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Per service-line trends</CardTitle>
                <CardDescription>Signals, commendations, and severity shifts per department.</CardDescription>
              </div>
              <Badge variant="secondary">Window · 30 days</Badge>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service line</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead>Commendations</TableHead>
                    <TableHead>Severity index</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topServiceLines.map((line) => (
                    <TableRow key={line.name}>
                      <TableCell className="font-semibold">{line.name}</TableCell>
                      <TableCell>{line.signals}</TableCell>
                      <TableCell>{line.commendations}</TableCell>
                      <TableCell>
                        <SeverityMeter value={line.severityIndex} />
                      </TableCell>
                      <TableCell>
                        <TrendBadge trend={line.trend} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!topServiceLines.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        No service-line telemetry available for this window.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Credential vs signal correlation</CardTitle>
              <CardDescription>How privilege families correlate with safety events.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Privilege family</TableHead>
                    <TableHead>Signal type</TableHead>
                    <TableHead>Correlation</TableHead>
                    <TableHead>Sample size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.correlationMatrix.map((entry) => (
                    <TableRow key={`${entry.privilege}-${entry.signalType}`}>
                      <TableCell className="font-medium">{entry.privilege}</TableCell>
                      <TableCell>{entry.signalType}</TableCell>
                      <TableCell>
                        <CorrelationPill score={entry.correlationScore} />
                      </TableCell>
                      <TableCell>{entry.sampleSize}</TableCell>
                    </TableRow>
                  ))}
                  {!snapshot.correlationMatrix.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        No correlation data available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          <Shield className="h-5 w-5" />
          Safety dashboard unavailable; provision backend to view aggregated indicators.
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function TrendBadge({ trend }: { trend: Trend }) {
  const copy: Record<
    Trend,
    { label: string; icon: ReactNode; className: string }
  > = {
    up: {
      label: 'rising',
      icon: <TrendingUp className="h-4 w-4" />,
      className: 'text-emerald-600',
    },
    down: {
      label: 'declining',
      icon: <TrendingDown className="h-4 w-4" />,
      className: 'text-amber-600',
    },
    flat: {
      label: 'steady',
      icon: <TrendingDown className="h-4 w-4 rotate-90" />,
      className: 'text-muted-foreground',
    },
  };
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium', copy[trend].className)}>
      {copy[trend].icon}
      {copy[trend].label}
    </span>
  );
}

function SeverityMeter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={cn('h-2 rounded-full bg-rose-500')}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{value.toFixed(0)}%</span>
    </div>
  );
}

function CorrelationPill({ score }: { score: number }) {
  const bucket = score > 0 ? 'positive' : score < -0.2 ? 'negative' : 'neutral';
  const copy = {
    positive: 'text-emerald-600',
    negative: 'text-rose-600',
    neutral: 'text-muted-foreground',
  };
  return (
    <span className={cn('font-semibold', copy[bucket])}>
      {(score * 100).toFixed(0)} bp
    </span>
  );
}

async function fetchSafetyDashboard(): Promise<SafetyDashboardResponse> {
  const base =
    API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) {
    throw new Error('API base URL missing');
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/api/safety/dashboard`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Safety dashboard API failed with ${response.status}`);
  }
  return (await response.json()) as SafetyDashboardResponse;
}

function buildFallbackDashboard(): SafetyDashboardResponse {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalSignals: 28,
      commendations: 9,
      highSeverity: 6,
    },
    serviceLines: [
      {
        name: 'Cardiology',
        signals: 8,
        commendations: 3,
        severityIndex: 62,
        trend: 'flat',
      },
      {
        name: 'Emergency Medicine',
        signals: 10,
        commendations: 1,
        severityIndex: 74,
        trend: 'up',
      },
      {
        name: 'Oncology',
        signals: 5,
        commendations: 2,
        severityIndex: 41,
        trend: 'down',
      },
      {
        name: 'Surgery',
        signals: 3,
        commendations: 1,
        severityIndex: 55,
        trend: 'flat',
      },
      {
        name: 'Cath Lab',
        signals: 2,
        commendations: 2,
        severityIndex: 30,
        trend: 'down',
      },
    ],
    correlationMatrix: [
      {
        privilege: 'Cath lab complex',
        signalType: 'adverse-event',
        correlationScore: 0.42,
        sampleSize: 38,
      },
      {
        privilege: 'Cardio moderate',
        signalType: 'near-miss',
        correlationScore: 0.21,
        sampleSize: 44,
      },
      {
        privilege: 'Electrophysiology',
        signalType: 'commendation',
        correlationScore: -0.28,
        sampleSize: 26,
      },
    ],
  };
}

