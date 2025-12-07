'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Anchor, RefreshCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type MonitoringStatus = 'clear' | 'warning' | 'critical';

interface MonitoringItem {
  itemType: string;
  status: MonitoringStatus;
  summary: string;
  lastCheck: string;
  nextCheck: string;
  details: Record<string, unknown>;
  source?: string;
}

interface MonitoringAnomaly {
  type: string;
  severity: 'low' | 'medium' | 'high';
  summary: string;
  detectedAt: string;
  relatedItems: string[];
}

interface MonitoringDashboard {
  clinicianId: string;
  clinicianName: string | null;
  refreshedAt: string;
  items: MonitoringItem[];
  anomalies: MonitoringAnomaly[];
  anchor?: {
    txHash: string;
    network: string;
    payload?: Record<string, unknown>;
  } | null;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE ??
  process.env.API_BASE_URL ??
  '';

const STATUS_COPY: Record<MonitoringStatus, { label: string; className: string }> = {
  clear: {
    label: 'Clear',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-500/10',
  },
  warning: {
    label: 'Warning',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-500/10',
  },
  critical: {
    label: 'Critical',
    className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-500/10',
  },
};

export default function WalletMonitoringPage() {
  const [dashboard, setDashboard] = useState<MonitoringDashboard | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setState('loading');
    setError(null);
    try {
      const data = await fetchMonitoringDashboard();
      setDashboard(data);
      setState('idle');
    } catch (err) {
      console.warn('[wallet][monitoring]', err);
      setDashboard(buildFallbackDashboard());
      setError(err instanceof Error ? err.message : 'Unable to load monitoring data');
      setState('error');
    }
  }

  const statusCounts = useMemo(() => summarizeStatuses(dashboard?.items ?? []), [dashboard]);
  const upcomingChecks = useMemo(() => {
    if (!dashboard) return [];
    return [...dashboard.items]
      .sort((a, b) => new Date(a.nextCheck).getTime() - new Date(b.nextCheck).getTime())
      .slice(0, 3);
  }, [dashboard]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <Badge variant="secondary">Wallet · Monitoring</Badge>
          {dashboard?.anchor && (
            <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
              <Anchor className="h-3.5 w-3.5" />
              Chain anchored
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
          <h1 className="text-3xl font-semibold tracking-tight">Credential monitoring grid</h1>
          <p className="text-sm text-muted-foreground">
            Continuous watches across state licenses, board certs, DEA, sanctions, and NPDB feeds.
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </header>

      {dashboard ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Active monitors</CardTitle>
                <CardDescription>Realtime signals per credential stream.</CardDescription>
              </CardHeader>
              <CardContent className="text-4xl font-semibold">
                {dashboard.items.length}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Critical exposures</CardTitle>
                  <CardDescription>Requires immediate action.</CardDescription>
                </div>
                <ShieldAlert className="h-5 w-5 text-rose-500" />
              </CardHeader>
              <CardContent className="text-4xl font-semibold text-rose-600">
                {statusCounts.critical}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Next scan</CardTitle>
                <CardDescription>Earliest scheduled monitor refresh.</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingChecks.length ? (
                  <>
                    <p className="text-2xl font-semibold">
                      {new Date(upcomingChecks[0].nextCheck).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {labelForItem(upcomingChecks[0].itemType)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No monitors scheduled.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Monitored items</CardTitle>
              <CardDescription>Every feed contributing to your monitoring grid.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Last check</TableHead>
                    <TableHead>Next check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.items.map((item) => (
                    <TableRow key={item.itemType}>
                      <TableCell className="font-medium">{labelForItem(item.itemType)}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-3 py-1 text-xs font-medium',
                            STATUS_COPY[item.status].className,
                          )}
                        >
                          {STATUS_COPY[item.status].label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <p className="font-medium">{item.summary}</p>
                        {Object.keys(item.details || {}).length > 0 && (
                          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {Object.entries(item.details ?? {}).slice(0, 4).map(([key, value]) => (
                              <div key={key} className="flex flex-col">
                                <dt className="uppercase">{key}</dt>
                                <dd className="font-semibold text-muted-foreground/90">
                                  {formatValue(value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.lastCheck).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.nextCheck).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Anomalies & escalations</CardTitle>
                <CardDescription>Auto-detected monitoring anomalies.</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard.anomalies.length ? (
                  <ul className="space-y-3">
                    {dashboard.anomalies.map((anomaly) => (
                      <li key={`${anomaly.type}-${anomaly.detectedAt}`} className="space-y-1 rounded-lg border p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold">{anomaly.summary}</span>
                          <SeverityBadge severity={anomaly.severity} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Triggered {new Date(anomaly.detectedAt).toLocaleString()} ·{' '}
                          {anomaly.relatedItems.map(labelForItem).join(', ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <Activity className="h-4 w-4" />
                    No anomalies detected in the last scan.
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Anchor evidence</CardTitle>
                <CardDescription>Latest monitoring scan receipt.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {dashboard.anchor ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Network</span>
                      <span className="font-medium">{dashboard.anchor.network}</span>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tx hash</p>
                      <p className="font-mono text-xs">{shorten(dashboard.anchor.txHash)}</p>
                    </div>
                    <Progress value={statusCounts.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(dashboard.refreshedAt).toLocaleString()}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    Monitoring scan not yet anchored.
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          <Activity className="h-5 w-5" />
          Monitoring signals will appear once credential feeds are provisioned.
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: MonitoringAnomaly['severity'] }) {
  const mapping: Record<MonitoringAnomaly['severity'], { label: string; className: string }> = {
    low: { label: 'Low', className: 'text-emerald-600' },
    medium: { label: 'Medium', className: 'text-amber-600' },
    high: { label: 'High', className: 'text-rose-600' },
  };
  return (
    <span className={cn('text-xs font-semibold', mapping[severity].className)}>
      {mapping[severity].label}
    </span>
  );
}

function summarizeStatuses(items: MonitoringItem[]) {
  return items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      acc.progress = Math.min(100, acc.progress + (item.status === 'clear' ? 20 : item.status === 'warning' ? 12 : 5));
      return acc;
    },
    { clear: 0, warning: 0, critical: 0, progress: 0 },
  );
}

function labelForItem(itemType: string): string {
  switch (itemType) {
    case 'license':
      return 'State license';
    case 'sanction':
      return 'Sanctions';
    case 'board':
      return 'Board certification';
    case 'dea':
      return 'DEA / MATE';
    case 'npdb':
      return 'NPDB';
    default:
      return itemType;
  }
}

function shorten(value: string, length = 10) {
  if (value.length <= length) return value;
  return `${value.slice(0, length)}…`;
}

async function fetchMonitoringDashboard(): Promise<MonitoringDashboard> {
  const base =
    API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) {
    throw new Error('API base URL missing');
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/api/monitoring/clinician/self`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Monitoring API failed with ${response.status}`);
  }
  return (await response.json()) as MonitoringDashboard;
}

function buildFallbackDashboard(): MonitoringDashboard {
  const now = new Date();
  return {
    clinicianId: 'self',
    clinicianName: 'Demo Clinician',
    refreshedAt: now.toISOString(),
    items: [
      {
        itemType: 'license',
        status: 'warning',
        summary: 'Next renewal due in 22 days',
        lastCheck: now.toISOString(),
        nextCheck: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        details: { state: 'CA', expiringInDays: 22 },
      },
      {
        itemType: 'board',
        status: 'clear',
        summary: 'Board certifications aligned with registry',
        lastCheck: now.toISOString(),
        nextCheck: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        details: { expiringSoon: [] },
      },
      {
        itemType: 'sanction',
        status: 'clear',
        summary: 'OIG feed clear',
        lastCheck: now.toISOString(),
        nextCheck: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        details: { adverseActionCount: 0 },
      },
      {
        itemType: 'npdb',
        status: 'warning',
        summary: '1 malpractice settlement flagged',
        lastCheck: now.toISOString(),
        nextCheck: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        details: { counts: { malpractice: 1 } },
      },
      {
        itemType: 'dea',
        status: 'critical',
        summary: 'DEA credential expired 5 days ago',
        lastCheck: now.toISOString(),
        nextCheck: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        details: { deaNumber: 'AB1234567', expiringInDays: -5 },
      },
    ],
    anomalies: [
      {
        type: 'sudden_revocation',
        severity: 'high',
        summary: 'DEA credential expired suddenly',
        detectedAt: now.toISOString(),
        relatedItems: ['dea'],
      },
    ],
    anchor: null,
  };
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') {
    const date = Date.parse(value);
    if (!Number.isNaN(date) && value.includes('T')) {
      return new Date(value).toLocaleDateString();
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.length ? `${value.length} entries` : 'None';
  }
  return JSON.stringify(value);
}










