'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Filter, RefreshCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
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

type StatusFilter = 'all' | 'clear' | 'warning' | 'critical';

interface MonitoringGridRow {
  clinicianId: string;
  clinicianName: string | null;
  state: string | null;
  specialty: string | null;
  statusCount: Record<string, number>;
  items: Array<{
    itemType: string;
    status: 'clear' | 'warning' | 'critical';
    lastCheck: string;
    nextCheck: string;
  }>;
}

interface MonitoringGridResponse {
  generatedAt: string;
  totals: {
    clinicians: number;
  };
  rows: MonitoringGridRow[];
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE ??
  process.env.API_BASE_URL ??
  '';

export default function AdminMonitoringGridPage() {
  const [grid, setGrid] = useState<MonitoringGridResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [state, setState] = useState<'loading' | 'idle' | 'error'>('loading');

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setState('loading');
    try {
      const snapshot = await fetchMonitoringGrid();
      setGrid(snapshot);
      setState('idle');
    } catch (error) {
      console.warn('[admin][monitoring-grid]', error);
      setGrid(buildFallbackGrid());
      setState('error');
    }
  }

  const filteredRows = useMemo(() => {
    if (!grid) return [];
    if (statusFilter === 'all') return grid.rows;
    return grid.rows.filter((row) =>
      row.items.some((item) => item.status === statusFilter),
    );
  }, [grid, statusFilter]);

  const aggregate = useMemo(() => aggregateStatuses(grid?.rows ?? []), [grid]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">Admin · Monitoring grid</Badge>
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
          <h1 className="text-3xl font-semibold tracking-tight">Clinician monitoring grid</h1>
          <p className="text-sm text-muted-foreground">
            Cross-tenant view of license, board, sanctions, DEA, and NPDB monitoring status.
          </p>
        </div>
      </header>

      {grid ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Clinicians covered</CardTitle>
                <CardDescription>Monitoring-ready profiles.</CardDescription>
              </CardHeader>
              <CardContent className="text-4xl font-semibold">
                {grid.totals.clinicians}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Critical exposures</CardTitle>
                  <CardDescription>Any monitor at red status.</CardDescription>
                </div>
                <ShieldAlert className="h-5 w-5 text-rose-500" />
              </CardHeader>
              <CardContent className="text-4xl font-semibold text-rose-600">
                {aggregate.critical}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Clear monitors</CardTitle>
                  <CardDescription>Proactive coverage.</CardDescription>
                </div>
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </CardHeader>
              <CardContent className="text-4xl font-semibold text-emerald-600">
                {aggregate.clear}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Monitoring table</CardTitle>
                <CardDescription>Filtered by severity to prioritize outreach.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <div className="flex gap-2">
                  {(['all', 'clear', 'warning', 'critical'] as StatusFilter[]).map((option) => (
                    <Button
                      key={option}
                      variant={option === statusFilter ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(option)}
                    >
                      {option === 'all' ? 'All' : option.charAt(0).toUpperCase() + option.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinician</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead className="text-center">Clear</TableHead>
                    <TableHead className="text-center">Warning</TableHead>
                    <TableHead className="text-center">Critical</TableHead>
                    <TableHead>Next check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.clinicianId}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold">{row.clinicianName ?? row.clinicianId}</span>
                          <span className="text-xs text-muted-foreground">{row.clinicianId}</span>
                        </div>
                      </TableCell>
                      <TableCell>{row.state ?? '—'}</TableCell>
                      <TableCell>{row.specialty ?? '—'}</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-600">
                        {row.statusCount.clear ?? 0}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-amber-600">
                        {row.statusCount.warning ?? 0}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-rose-600">
                        {row.statusCount.critical ?? 0}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatUpcoming(row.items)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredRows.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                        No clinicians match the selected filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming monitoring windows</CardTitle>
              <CardDescription>Next five actions to keep the grid green.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {deriveUpcomingActions(filteredRows).map((item) => (
                  <li key={`${item.clinicianId}-${item.itemType}`} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-semibold">
                        {labelForItem(item.itemType)} · {item.clinicianName}
                      </p>
                      <p className="text-muted-foreground">
                        Due {new Date(item.nextCheck).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className={badgeClass(item.status)}>
                      {item.status}
                    </Badge>
                  </li>
                ))}
                {!deriveUpcomingActions(filteredRows).length && (
                  <li className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-muted-foreground">
                    <CalendarClock className="h-4 w-4" />
                    No upcoming checks within selected scope.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          <AlertTriangle className="h-5 w-5" />
          Monitoring grid unavailable; provision backend to view signals.
        </div>
      )}
    </div>
  );
}

function badgeClass(status: string) {
  switch (status) {
    case 'critical':
      return 'border-rose-200 text-rose-600';
    case 'warning':
      return 'border-amber-200 text-amber-600';
    default:
      return 'border-emerald-200 text-emerald-600';
  }
}

function formatUpcoming(items: MonitoringGridRow['items']) {
  if (!items.length) return '—';
  const next = items.reduce((soonest, item) => {
    const date = new Date(item.nextCheck).getTime();
    if (!soonest || date < soonest) {
      return date;
    }
    return soonest;
  }, 0);
  return next ? new Date(next).toLocaleString() : '—';
}

function deriveUpcomingActions(rows: MonitoringGridRow[]) {
  return rows
    .flatMap((row) =>
      row.items.map((item) => ({
        ...item,
        clinicianId: row.clinicianId,
        clinicianName: row.clinicianName ?? row.clinicianId,
      })),
    )
    .sort((a, b) => new Date(a.nextCheck).getTime() - new Date(b.nextCheck).getTime())
    .slice(0, 5);
}

async function fetchMonitoringGrid(): Promise<MonitoringGridResponse> {
  const base =
    API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) {
    throw new Error('API base URL missing');
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/api/monitoring/grid?limit=40`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Monitoring grid API failed with ${response.status}`);
  }
  return (await response.json()) as MonitoringGridResponse;
}

function buildFallbackGrid(): MonitoringGridResponse {
  const now = new Date();
  return {
    generatedAt: now.toISOString(),
    totals: { clinicians: 3 },
    rows: [
      {
        clinicianId: 'cln_demo_1',
        clinicianName: 'Dr. Ada Rivera',
        state: 'CA',
        specialty: 'Cardiology',
        statusCount: { clear: 3, warning: 1, critical: 1 },
        items: [
          {
            itemType: 'license',
            status: 'warning',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 14 * 86400000).toISOString(),
          },
          {
            itemType: 'board',
            status: 'clear',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 120 * 86400000).toISOString(),
          },
          {
            itemType: 'sanction',
            status: 'clear',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 30 * 86400000).toISOString(),
          },
          {
            itemType: 'npdb',
            status: 'critical',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 3 * 86400000).toISOString(),
          },
          {
            itemType: 'dea',
            status: 'clear',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 60 * 86400000).toISOString(),
          },
        ],
      },
      {
        clinicianId: 'cln_demo_2',
        clinicianName: 'Dr. Eli Tan',
        state: 'NY',
        specialty: 'Emergency Medicine',
        statusCount: { clear: 4, warning: 0, critical: 1 },
        items: [
          {
            itemType: 'license',
            status: 'clear',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 45 * 86400000).toISOString(),
          },
          {
            itemType: 'board',
            status: 'clear',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 180 * 86400000).toISOString(),
          },
          {
            itemType: 'sanction',
            status: 'clear',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 21 * 86400000).toISOString(),
          },
          {
            itemType: 'npdb',
            status: 'clear',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 10 * 86400000).toISOString(),
          },
          {
            itemType: 'dea',
            status: 'critical',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 2 * 86400000).toISOString(),
          },
        ],
      },
      {
        clinicianId: 'cln_demo_3',
        clinicianName: 'Dr. Noor Patel',
        state: 'TX',
        specialty: 'Family Medicine',
        statusCount: { clear: 5, warning: 0, critical: 0 },
        items: [
          {
            itemType: 'license',
            status: 'clear',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 80 * 86400000).toISOString(),
          },
          {
            itemType: 'board',
            status: 'clear',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 200 * 86400000).toISOString(),
          },
          {
            itemType: 'sanction',
            status: 'clear',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 30 * 86400000).toISOString(),
          },
          {
            itemType: 'npdb',
            status: 'clear',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 15 * 86400000).toISOString(),
          },
          {
            itemType: 'dea',
            status: 'clear',
            lastCheck: now.toISOString(),
            nextCheck: new Date(now.getTime() + 90 * 86400000).toISOString(),
          },
        ],
      },
    ],
  };
}

function aggregateStatuses(rows: MonitoringGridRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.clear += row.statusCount.clear ?? 0;
      acc.warning += row.statusCount.warning ?? 0;
      acc.critical += row.statusCount.critical ?? 0;
      return acc;
    },
    { clear: 0, warning: 0, critical: 0 },
  );
}

function labelForItem(itemType: string) {
  switch (itemType) {
    case 'license':
      return 'License';
    case 'board':
      return 'Board';
    case 'sanction':
      return 'Sanctions';
    case 'npdb':
      return 'NPDB';
    case 'dea':
      return 'DEA';
    default:
      return itemType;
  }
}










