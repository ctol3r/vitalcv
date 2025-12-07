'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Activity,
  BarChart3,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

interface MetricFields {
  applications: number;
  privilegesGranted: number;
  verifications: number;
  payerEnrollments: number;
  ehrFetches: number;
  vcsIssued: number;
}

interface DailyMetric extends MetricFields {
  date: string;
}

interface OrgBreakdownEntry extends MetricFields {
  orgId: string;
  orgName: string;
}

interface ExecSummaryResponse {
  scope: 'global' | 'org';
  orgId?: string;
  orgName?: string | null;
  days: number;
  totals: MetricFields;
  daily: DailyMetric[];
  orgBreakdown: OrgBreakdownEntry[];
  lastUpdated: string | null;
}

const METRIC_CONFIG: Array<{
  key: keyof MetricFields;
  label: string;
  description: string;
  accent: string;
  color: string;
}> = [
  {
    key: 'applications',
    label: 'Applications',
    description: 'Apply-with-VitalCV submissions',
    accent: 'text-blue-600',
    color: '#2563eb',
  },
  {
    key: 'privilegesGranted',
    label: 'Privileges Granted',
    description: 'Approved privilege decisions',
    accent: 'text-emerald-600',
    color: '#059669',
  },
  {
    key: 'verifications',
    label: 'PSV Runs',
    description: 'Primary source verifications',
    accent: 'text-purple-600',
    color: '#7c3aed',
  },
  {
    key: 'payerEnrollments',
    label: 'Payer Enrollments',
    description: 'Submitted enrollments',
    accent: 'text-orange-600',
    color: '#ea580c',
  },
  {
    key: 'ehrFetches',
    label: 'EHR Fetches',
    description: 'EHR/TEFCA reads',
    accent: 'text-cyan-600',
    color: '#0891b2',
  },
  {
    key: 'vcsIssued',
    label: 'VCs Issued',
    description: 'Privilege VC issuance events',
    accent: 'text-rose-600',
    color: '#e11d48',
  },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatUpdated(timestamp: string | null): string {
  if (!timestamp) return 'n/a';
  return new Date(timestamp).toLocaleString();
}

export default function ExecSummaryV2Page() {
  const [metrics, setMetrics] = useState<ExecSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const orgIdParam = searchParams?.get('orgId') ?? undefined;

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const query = orgIdParam ? `?orgId=${encodeURIComponent(orgIdParam)}` : '';
      const response = await fetch(`/api/admin/exec/summary/v2${query}`);
      if (!response.ok) {
        throw new Error('Request failed');
      }
      const data = (await response.json()) as ExecSummaryResponse;
      setMetrics(data);
    } catch (err) {
      console.error('[ExecSummaryV2] failed to load metrics', err);
      setError('Unable to load executive metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [orgIdParam]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-muted-foreground">
          <RefreshCw className="h-10 w-10 animate-spin" />
          <p>Loading executive metrics…</p>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Activity className="h-5 w-5" />
              Exec dashboard unavailable
            </CardTitle>
            <CardDescription>{error ?? 'Unknown error'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchMetrics}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase text-muted-foreground">Exec dashboard v2</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            {metrics.scope === 'global'
              ? 'Platform overview'
              : metrics.orgName || `Organization ${metrics.orgId}`}
          </h1>
          <p className="text-muted-foreground">
            {metrics.days}-day trailing sums · Last updated {formatUpdated(metrics.lastUpdated)}
          </p>
          {metrics.scope === 'org' && metrics.orgId && (
            <p className="text-sm text-muted-foreground">Org ID: {metrics.orgId}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchMetrics} aria-label="Refresh metrics">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {METRIC_CONFIG.map((metric) => (
          <Card key={metric.key}>
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className={`text-3xl font-bold ${metric.accent}`}>
                {formatNumber(metrics.totals[metric.key])}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{metric.description}</p>
              <p className="text-xs text-muted-foreground">
                Latest day: {formatNumber(metrics.daily.at(-1)?.[metric.key] ?? 0)}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Daily trend
          </CardTitle>
          <CardDescription>Rolling activity across the last {metrics.days} days</CardDescription>
        </CardHeader>
        <CardContent>
          <LineChart
            data={metrics.daily}
            series={METRIC_CONFIG.slice(0, 4).map((config) => ({
              key: config.key,
              label: config.label,
              color: config.color,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Org breakdown</CardTitle>
          <CardDescription>
            Leading organizations by aggregate activity ({metrics.days}-day window)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.orgBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organization-level data yet.</p>
          ) : (
            <OrgBreakdownChart data={metrics.orgBreakdown} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LineChart({
  data,
  series,
}: {
  data: DailyMetric[];
  series: Array<{ key: keyof MetricFields; label: string; color: string }>;
}) {
  const width = 720;
  const height = 260;
  const padding = 32;

  const maxValue = useMemo(() => {
    const max = Math.max(
      1,
      ...series.flatMap((line) => data.map((point) => point[line.key] ?? 0))
    );
    return max;
  }, [data, series]);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data to chart yet.</p>;
  }

  const buildPolyline = (key: keyof MetricFields) => {
    return data
      .map((point, index) => {
        const x =
          data.length === 1
            ? width / 2
            : padding + (index / (data.length - 1)) * (width - padding * 2);
        const value = point[key] ?? 0;
        const y =
          height -
          padding -
          (value / maxValue) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg
        role="img"
        aria-label="Daily metrics line chart"
        className="max-w-full"
        width={width}
        height={height}
      >
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#d1d5db"
          strokeWidth={1}
        />
        {series.map((line) => (
          <polyline
            key={line.key as string}
            fill="none"
            stroke={line.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={buildPolyline(line.key)}
          />
        ))}
      </svg>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        {series.map((line) => (
          <div key={line.key as string} className="flex items-center gap-2">
            <span
              className="h-2 w-6 rounded-full"
              style={{ backgroundColor: line.color }}
              aria-hidden
            />
            <span>{line.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrgBreakdownChart({ data }: { data: OrgBreakdownEntry[] }) {
  const totals = data.map((entry) => ({
    orgId: entry.orgId,
    orgName: entry.orgName,
    total:
      entry.applications +
      entry.privilegesGranted +
      entry.verifications +
      entry.payerEnrollments +
      entry.vcsIssued,
    detail: entry,
  }));
  const maxValue = Math.max(1, ...totals.map((item) => item.total));

  return (
    <div className="space-y-4">
      {totals.map((entry) => (
        <div key={entry.orgId} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{entry.orgName}</span>
            <span className="text-muted-foreground">{formatNumber(entry.total)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${(entry.total / maxValue) * 100}%` }}
              aria-hidden
            />
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <span>Apps: {formatNumber(entry.detail.applications)}</span>
            <span>Privs: {formatNumber(entry.detail.privilegesGranted)}</span>
            <span>PSV: {formatNumber(entry.detail.verifications)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
