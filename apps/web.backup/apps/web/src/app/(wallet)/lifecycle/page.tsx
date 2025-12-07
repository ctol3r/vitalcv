'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Anchor,
  CalendarClock,
  Download,
  RefreshCw,
  Shield,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

type TimelineSeverity = 'low' | 'medium' | 'high';

interface LifecyclePanelResponse {
  clinicianId: string;
  generatedAt: string;
  lifecycle: {
    id: string;
    phase: string;
    updatedAt: string;
    metadata: Record<string, unknown>;
  } | null;
  timeline: {
    generatedAt: string;
    cycleSummary: {
      licenseCount: number;
      expiringWithin90: number;
      nextLicenseDue: string | null;
      cmeHoursRemaining: number | null;
      nextCmeDue: string | null;
      deaExpiresAt: string | null;
      lifecyclePhase: string | null;
    };
    events: RenewalTimelineEvent[];
    alerts: LifecycleAlert[];
  };
  alerts: LifecycleAlert[];
  tasks: LicenseTask[];
  evidencePack: {
    id: string;
    createdAt: string;
    items: unknown;
  } | null;
}

interface RenewalTimelineEvent {
  id: string;
  category: 'license' | 'cme' | 'dea' | 'readiness';
  label: string;
  dueDate: string;
  severity: TimelineSeverity;
  status: 'upcoming' | 'due_now' | 'overdue';
  metadata?: Record<string, unknown>;
}

interface LifecycleAlert {
  id: string;
  level: '90_day' | '60_day' | '30_day' | 'overdue';
  component: 'license' | 'cme' | 'dea' | 'readiness';
  label: string;
  dueDate: string;
  daysRemaining: number;
  severity: TimelineSeverity;
}

interface LicenseTask {
  id: string;
  state?: string | null;
  task: string;
  reason: string;
  dueDate?: string;
  status?: string;
}

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');
const DEFAULT_CLINICIAN_ID =
  process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID ??
  process.env.NEXT_PUBLIC_DEFAULT_CLINICIAN_ID ??
  'wallet-demo-clinician';

export default function LifecyclePanelPage() {
  const [clinicianId, setClinicianId] = useState(DEFAULT_CLINICIAN_ID);
  const [panel, setPanel] = useState<LifecyclePanelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPanel = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = `/api/lifecycle/panel/${clinicianId}`;
        const response = await fetch(API_BASE ? `${API_BASE}${endpoint}` : endpoint, {
          method: 'GET',
          headers: refresh ? { 'x-refresh': 'true' } : undefined,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || 'Unable to load lifecycle panel');
        }
        const data = (await response.json()) as LifecyclePanelResponse;
        setPanel(data);
      } catch (err) {
        setPanel(null);
        setError(err instanceof Error ? err.message : 'Unexpected error');
      } finally {
        setLoading(false);
      }
    },
    [clinicianId],
  );

  useEffect(() => {
    void fetchPanel(false);
  }, [fetchPanel]);

  const alertsBySeverity = useMemo(() => {
    if (!panel) return { high: [], medium: [], low: [] as LifecycleAlert[] };
    return panel.alerts.reduce(
      (acc, alert) => {
        const bucket =
          alert.severity === 'high' ? acc.high : alert.severity === 'medium' ? acc.medium : acc.low;
        bucket.push(alert);
        return acc;
      },
      { high: [] as LifecycleAlert[], medium: [] as LifecycleAlert[], low: [] as LifecycleAlert[] },
    );
  }, [panel]);

  const cycleSummary = panel?.timeline.cycleSummary;

  return (
    <div className="container max-w-6xl space-y-8 py-10">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Wallet · Lifecycle</Badge>
          {panel?.lifecycle?.phase ? (
            <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
              <Shield className="h-3.5 w-3.5" />
              {panel.lifecycle.phase}
            </Badge>
          ) : null}
          <Badge variant="outline" className="gap-1">
            <Anchor className="h-3.5 w-3.5" />
            Anchored snapshots
          </Badge>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Lifecycle automation panel</h1>
            <p className="text-sm text-muted-foreground">
              Monitor provider phases, renewal cycles, and risk alerts in one place.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => fetchPanel(true)} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="secondary" size="sm" disabled={!panel?.evidencePack}>
              <Download className="mr-2 h-4 w-4" />
              Export evidence pack
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Last generated · {panel?.generatedAt ? new Date(panel.generatedAt).toLocaleString() : '--'}
        </div>
        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : null}
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Lifecycle phase"
          value={panel?.lifecycle?.phase ?? '—'}
          subtitle={panel?.lifecycle?.updatedAt ? `Updated ${new Date(panel.lifecycle.updatedAt).toLocaleDateString()}` : ''}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Licenses in flight"
          value={cycleSummary?.expiringWithin90 ?? 0}
          subtitle="Expiring within 90 days"
          icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Open tasks"
          value={panel?.tasks.length ?? 0}
          subtitle="License readiness checkpoints"
          icon={<Target className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="High-risk alerts"
          value={panel?.alerts.length ?? 0}
          subtitle="Aggregated 90 / 60 / 30 day warnings"
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Renewal timeline</CardTitle>
            <CardDescription>Automated cadence across licenses, CME, and DEA.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TimelineTable events={panel?.timeline.events ?? []} loading={loading} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>High-risk alerts</CardTitle>
            <CardDescription>Escalations at 90/60/30 day checkpoints.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {panel?.alerts.length ? (
              <div className="space-y-3">
                {(['high', 'medium', 'low'] as const).map((bucket) => (
                  <AlertBucket key={bucket} title={bucket} alerts={alertsBySeverity[bucket]} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active alerts.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>License readiness tasks</CardTitle>
            <CardDescription>Auto-generated tasks when graduation or risk signals trigger.</CardDescription>
          </CardHeader>
          <CardContent>
            {panel?.tasks.length ? (
              <div className="space-y-4">
                {panel.tasks.map((task) => (
                  <div key={task.id} className="rounded-md border p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{task.task}</div>
                      <Badge variant={task.status === 'scheduled' ? 'secondary' : 'outline'}>
                        {task.status ?? 'pending'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{task.reason}</p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'TBD'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">All good. Readiness queue is clear.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Evidence anchor</CardTitle>
            <CardDescription>Latest lifecycle evidence pack anchored for audit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {panel?.evidencePack ? (
              <>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pack ID</p>
                    <p className="font-mono text-sm">{panel.evidencePack.id}</p>
                  </div>
                  <Badge variant="outline">Anchored</Badge>
                </div>
                <Separator />
                <div className="text-sm text-muted-foreground">
                  Generated {new Date(panel.evidencePack.createdAt).toLocaleString()}
                </div>
                <Progress value={100} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Evidence pack includes renewal timeline, risk alerts, and credential inventory snapshots.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No evidence pack recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </CardContent>
    </Card>
  );
}

function TimelineTable({ events, loading }: { events: RenewalTimelineEvent[]; loading: boolean }) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading timeline…</p>;
  }
  if (!events.length) {
    return <p className="text-sm text-muted-foreground">No timeline events recorded.</p>;
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.slice(0, 10).map((event) => (
            <TableRow key={event.id}>
              <TableCell className="font-medium">{event.label}</TableCell>
              <TableCell>
                <Badge variant="outline">{event.category}</Badge>
              </TableCell>
              <TableCell>
                <Badge className={severityTone(event.severity)}>{event.status}</Badge>
              </TableCell>
              <TableCell className="text-right">{new Date(event.dueDate).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AlertBucket({ title, alerts }: { title: string; alerts: LifecycleAlert[] }) {
  if (!alerts.length) {
    return null;
  }
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase text-muted-foreground">{title}</div>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div key={alert.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{alert.label}</span>
              <Badge variant="outline">{alert.component}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Due {new Date(alert.dueDate).toLocaleDateString()} ({alert.daysRemaining} days)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function severityTone(severity: TimelineSeverity) {
  if (severity === 'high') return 'bg-red-50 text-red-700 border-red-200';
  if (severity === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}


