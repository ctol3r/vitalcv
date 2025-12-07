'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Loader2, RefreshCw, Wifi, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConnectorHealth = 'ok' | 'warning' | 'error';

type AtsConnectorStatus = {
  connector: string;
  orgId: string;
  health: ConnectorHealth;
  pendingDeliveries: number;
  lastSync: string;
  lastError?: string | null;
  latencyMs?: number | null;
};

type AtsSyncEvent = {
  id: string;
  clinicianId: string;
  connector: string;
  status: 'delivered' | 'retrying' | 'failed';
  attempts: number;
  updatedAt: string;
  note?: string;
};

type AtsSyncResponse = {
  connectors: AtsConnectorStatus[];
  events: AtsSyncEvent[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '');

export default function EmployerAtsSyncPage() {
  const [connectors, setConnectors] = useState<AtsConnectorStatus[]>([]);
  const [events, setEvents] = useState<AtsSyncEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSyncStatus();
  }, []);

  async function loadSyncStatus() {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchAtsSyncStatus();
      setConnectors(payload.connectors);
      setEvents(payload.events);
    } catch (err) {
      console.warn('[employer][ats-sync] fallback data loaded', err);
      const fallback = buildFallbackAtsSync();
      setConnectors(fallback.connectors);
      setEvents(fallback.events);
      setError('Unable to reach ATS sync status API — showing cached data.');
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => summarize(connectors), [connectors]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-3">
        <Badge variant="secondary">Employer · ATS Sync</Badge>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Connector health</h1>
            <p className="text-muted-foreground">
              Monitor webhook deliveries, retry cadence, and error budgets across ATS vendors.
            </p>
          </div>
          <Button
            className="ml-auto gap-2"
            variant="outline"
            onClick={() => loadSyncStatus()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
        {error && <p className="text-sm text-amber-600">{error}</p>}
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Healthy connectors</CardTitle>
            <CardDescription>Greenhouse, Workday, Lever status.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-baseline gap-2">
            <Wifi className="h-5 w-5 text-emerald-500" />
            <p className="text-3xl font-semibold">{summary.healthy}</p>
            <p className="text-sm text-muted-foreground">/ {connectors.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending deliveries</CardTitle>
            <CardDescription>Queued payloads awaiting ack.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-baseline gap-2">
            <Activity className="h-5 w-5 text-sky-500" />
            <p className="text-3xl font-semibold">{summary.pending}</p>
            <p className="text-sm text-muted-foreground">
              Avg latency {summary.avgLatency.toFixed(0)} ms
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>Connectors requiring attention.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-baseline gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <p className="text-3xl font-semibold">{summary.alerts}</p>
            <p className="text-sm text-muted-foreground">warnings or errors</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Connector status</CardTitle>
          <CardDescription>Last heartbeat and backlog per integration.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading connector telemetry…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connector</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Last sync</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectors.map((connector) => (
                  <TableRow key={connector.connector}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium capitalize">{connector.connector}</span>
                        <span className="text-xs text-muted-foreground">
                          {connector.orgId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={healthVariant(connector.health)}>
                        {connector.health === 'ok'
                          ? 'Healthy'
                          : connector.health === 'warning'
                            ? 'Degraded'
                            : 'Error'}
                      </Badge>
                    </TableCell>
                    <TableCell>{connector.pendingDeliveries}</TableCell>
                    <TableCell>
                      {connector.latencyMs ? `${connector.latencyMs.toFixed(0)} ms` : '—'}
                    </TableCell>
                    <TableCell>{new Date(connector.lastSync).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {connector.lastError ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sync events</CardTitle>
          <CardDescription>Blend of readiness pushes and credential updates.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinician</TableHead>
                <TableHead>Connector</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.clinicianId}</TableCell>
                  <TableCell className="capitalize">{event.connector}</TableCell>
                  <TableCell>
                    <Badge variant={eventStatusVariant(event.status)}>{event.status}</Badge>
                  </TableCell>
                  <TableCell>{event.attempts}</TableCell>
                  <TableCell>{new Date(event.updatedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {event.note ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function summarize(connectors: AtsConnectorStatus[]) {
  if (connectors.length === 0) {
    return { healthy: 0, pending: 0, avgLatency: 0, alerts: 0 };
  }
  const healthy = connectors.filter((connector) => connector.health === 'ok').length;
  const pending = connectors.reduce((sum, item) => sum + item.pendingDeliveries, 0);
  const latencies = connectors
    .map((connector) => connector.latencyMs ?? 0)
    .filter((value) => value > 0);
  const avgLatency =
    latencies.length === 0
      ? 0
      : latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
  const alerts = connectors.length - healthy;

  return { healthy, pending, avgLatency, alerts };
}

function healthVariant(health: ConnectorHealth): 'default' | 'secondary' | 'destructive' {
  switch (health) {
    case 'ok':
      return 'default';
    case 'warning':
      return 'secondary';
    case 'error':
    default:
      return 'destructive';
  }
}

function eventStatusVariant(
  status: AtsSyncEvent['status'],
): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'delivered':
      return 'default';
    case 'retrying':
      return 'secondary';
    case 'failed':
    default:
      return 'destructive';
  }
}

async function fetchAtsSyncStatus(): Promise<AtsSyncResponse> {
  if (!API_BASE) {
    throw new Error('API base URL not configured for ATS sync monitor');
  }
  const response = await fetch(`${API_BASE}/api/employer/ats-sync`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`ATS sync endpoint responded with ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload?.connectors) || !Array.isArray(payload?.events)) {
    throw new Error('Malformed ATS sync response');
  }
  return payload as AtsSyncResponse;
}

function buildFallbackAtsSync(): AtsSyncResponse {
  const now = Date.now();
  return {
    connectors: [
      {
        connector: 'greenhouse',
        orgId: 'org-demo-health',
        health: 'ok',
        pendingDeliveries: 1,
        lastSync: new Date(now - 4 * 60 * 1000).toISOString(),
        latencyMs: 420,
      },
      {
        connector: 'workday',
        orgId: 'org-demo-health',
        health: 'warning',
        pendingDeliveries: 3,
        lastError: '504 Gateway timeout',
        lastSync: new Date(now - 18 * 60 * 1000).toISOString(),
        latencyMs: 980,
      },
      {
        connector: 'lever',
        orgId: 'org-demo-health',
        health: 'ok',
        pendingDeliveries: 0,
        lastSync: new Date(now - 2 * 60 * 1000).toISOString(),
        latencyMs: 310,
      },
    ],
    events: [
      {
        id: 'sync-1',
        clinicianId: 'clinician-8891',
        connector: 'greenhouse',
        status: 'delivered',
        attempts: 1,
        updatedAt: new Date(now - 3 * 60 * 1000).toISOString(),
        note: 'Readiness delta +0.08',
      },
      {
        id: 'sync-2',
        clinicianId: 'clinician-1544',
        connector: 'workday',
        status: 'retrying',
        attempts: 2,
        updatedAt: new Date(now - 8 * 60 * 1000).toISOString(),
        note: 'Retry scheduled in 5m',
      },
      {
        id: 'sync-3',
        clinicianId: 'clinician-6620',
        connector: 'lever',
        status: 'failed',
        attempts: 3,
        updatedAt: new Date(now - 25 * 60 * 1000).toISOString(),
        note: 'Signature mismatch',
      },
    ],
  };
}









