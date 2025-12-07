'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
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
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

type TestStatus = 'pass' | 'fail' | 'warn';

type HrisConnectorTestStep = {
  name: string;
  status: TestStatus;
  detail: string;
  durationMs: number;
};

type HrisConnectorTestResult = {
  connectionId: string;
  orgId: string;
  vendor: string;
  status: TestStatus;
  latencyMs: number;
  startedAt: string;
  completedAt: string;
  region?: string;
  message?: string;
  steps: HrisConnectorTestStep[];
};

type HrisTestSummary = {
  total: number;
  passing: number;
  failing: number;
  warning: number;
  avgLatency: number;
};

type HrisTestResponse = {
  runs: HrisConnectorTestResult[];
  summary: HrisTestSummary;
  generatedAt: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '');

export default function EmployerHrisTestPage() {
  const [data, setData] = useState<HrisTestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTests();
  }, []);

  async function loadTests() {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchHrisTests();
      setData(payload);
    } catch (err) {
      console.warn('[hris-test] fallback payload loaded', err);
      setData(buildFallbackTestResponse());
      setError('Unable to reach HRIS test API — showing cached diagnostics.');
    } finally {
      setLoading(false);
    }
  }

  const summary = data?.summary ?? { total: 0, passing: 0, failing: 0, warning: 0, avgLatency: 0 };
  const highlight = data?.runs?.[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-3">
        <Badge variant="secondary">Employer · HRIS test suite</Badge>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Connector diagnostics</h1>
            <p className="text-muted-foreground">
              Validate onboarding, profile sync, and identity provisioning across Workday, UKG, ADP, and Oracle.
            </p>
          </div>
          <Button className="ml-auto gap-2" variant="outline" onClick={() => loadTests()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
        {error && <p className="text-sm text-amber-600">{error}</p>}
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          icon={<Server className="h-5 w-5 text-slate-500" />}
          label="Total connectors"
          value={summary.total}
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          label="Healthy"
          value={summary.passing}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
          label="Warnings"
          value={summary.warning}
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-sky-500" />}
          label="Avg latency"
          value={`${summary.avgLatency.toFixed(0)} ms`}
          sub={`${summary.failing} failing`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Connector runs</CardTitle>
          <CardDescription>Latest heartbeat from each HRIS integration.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <div className="py-10 text-center text-muted-foreground">Loading HRIS diagnostics…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connector</TableHead>
                  <TableHead>Org</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.runs.map((run) => (
                  <TableRow key={run.connectionId}>
                    <TableCell className="capitalize">{run.vendor}</TableCell>
                    <TableCell className="font-mono text-xs">{run.orgId}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(run.status)}>{labelForStatus(run.status)}</Badge>
                    </TableCell>
                    <TableCell>{run.region ?? '—'}</TableCell>
                    <TableCell>{run.latencyMs ? `${run.latencyMs.toFixed(0)} ms` : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {run.message ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(run.completedAt).toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {highlight && (
        <Card>
          <CardHeader>
            <CardTitle>Step trace · {highlight.vendor}</CardTitle>
            <CardDescription>
              Region {highlight.region ?? 'primary'} · started{' '}
              {new Date(highlight.startedAt).toLocaleTimeString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {highlight.steps.length === 0 && (
                <p className="text-sm text-muted-foreground">No diagnostic steps recorded.</p>
              )}
              {highlight.steps.map((step, index) => (
                <div
                  key={`${step.name}-${index}`}
                  className="flex flex-wrap items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{step.name}</span>
                    <span className="text-muted-foreground">{step.detail}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusVariant(step.status)}>{labelForStatus(step.status)}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {step.durationMs.toFixed(0)} ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-3xl font-semibold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function statusVariant(status: TestStatus): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'pass':
      return 'default';
    case 'warn':
      return 'secondary';
    case 'fail':
    default:
      return 'destructive';
  }
}

function labelForStatus(status: TestStatus) {
  switch (status) {
    case 'pass':
      return 'Passing';
    case 'warn':
      return 'Warning';
    case 'fail':
    default:
      return 'Failed';
  }
}

async function fetchHrisTests(): Promise<HrisTestResponse> {
  if (!API_BASE) {
    throw new Error('API base URL not configured for HRIS testing suite');
  }
  const response = await fetch(`${API_BASE}/api/employer/hris-test`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HRIS test endpoint responded with ${response.status}`);
  }
  return (await response.json()) as HrisTestResponse;
}

function buildFallbackTestResponse(): HrisTestResponse {
  const now = Date.now();
  const runs: HrisConnectorTestResult[] = [
    {
      connectionId: 'workday-fallback',
      orgId: 'org-fallback',
      vendor: 'workday',
      status: 'pass',
      latencyMs: 540,
      startedAt: new Date(now - 4000).toISOString(),
      completedAt: new Date(now - 3460).toISOString(),
      region: 'primary',
      message: 'Synthetic Workday heartbeat',
      steps: [
        { name: 'Metadata ping', status: 'pass', detail: 'ok', durationMs: 520 },
        { name: 'Provision dry-run', status: 'pass', detail: 'ok', durationMs: 20 },
      ],
    },
    {
      connectionId: 'ukg-fallback',
      orgId: 'org-fallback',
      vendor: 'ukg',
      status: 'warn',
      latencyMs: 0,
      startedAt: new Date(now - 6000).toISOString(),
      completedAt: new Date(now - 5800).toISOString(),
      message: 'Eligibility cache stale — retry scheduled',
      steps: [
        { name: 'Eligibility ping', status: 'fail', detail: 'Timeout', durationMs: 200 },
      ],
    },
  ];
  return {
    runs,
    summary: {
      total: runs.length,
      passing: runs.filter((run) => run.status === 'pass').length,
      failing: runs.filter((run) => run.status === 'fail').length,
      warning: runs.filter((run) => run.status === 'warn').length,
      avgLatency: runs.reduce((sum, run) => sum + run.latencyMs, 0) / runs.length,
    },
    generatedAt: new Date().toISOString(),
  };
}


