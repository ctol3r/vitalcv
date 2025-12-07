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
import { cn } from '@/lib/utils';
import { Activity, AlertOctagon, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';

type StreamTopicMeta = {
  id: string;
  label: string;
  description: string;
};

type DeliveryStats = {
  successes: number;
  failures: number;
  lastAttemptAt?: string;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
  pending: number;
};

type DeliveryRecord = {
  id: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  topic: string;
  status: 'success' | 'failed';
  attempts: number;
  lastAttemptAt: string;
  note?: string;
};

type StreamSubscription = {
  id: string;
  orgId: string;
  topic: string;
  endpoint: string;
  secretPreview: string;
  createdAt: string;
  delivery: DeliveryStats;
  recentDeliveries: DeliveryRecord[];
};

type StreamEvent = {
  id: string;
  eventType: string;
  topic: string;
  orgId: string;
  timestamp: string;
  payload: Record<string, any>;
};

type DeadLetterEntry = {
  id: string;
  subscriptionId: string;
  endpoint: string;
  topic: string;
  eventType: string;
  eventId: string;
  failureReason: string;
  attempts: number;
  failedAt: string;
  payloadHash: string;
  lastError?: string;
};

type StreamConsoleResponse = {
  topics: StreamTopicMeta[];
  subscriptions: StreamSubscription[];
  queueDepth: number;
  recentDeliveries: DeliveryRecord[];
  recentEvents: StreamEvent[];
  deadLetter: {
    size: number;
    entries: DeadLetterEntry[];
  };
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '');

export default function EmployerStreamConsolePage() {
  const [data, setData] = useState<StreamConsoleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadConsoleSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadConsoleSnapshot() {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchStreamConsoleSnapshot();
      setData(snapshot);
    } catch (err) {
      console.warn('[employer][stream-console] falling back to synthetic data', err);
      setError('Live stream console unavailable — showing cached diagnostic data.');
      setData(buildFallbackConsole());
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => summarizeDeliveries(data), [data]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-3">
        <Badge variant="secondary">Employer · Streaming Console</Badge>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Credential stream telemetry</h1>
            <p className="text-muted-foreground">
              Monitor webhook throughput, per-topic delivery success, and the dead-letter queue for your org feeds.
            </p>
          </div>
          <Button
            className="ml-auto gap-2"
            variant="outline"
            onClick={() => loadConsoleSnapshot()}
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
            <CardTitle>Successful deliveries</CardTitle>
            <CardDescription>Signed webhooks acked in the last 24h.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-baseline gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <p className="text-3xl font-semibold">{summary.successes}</p>
            <p className="text-sm text-muted-foreground">/{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Failed or retrying</CardTitle>
            <CardDescription>Events that hit the backoff ladder.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-baseline gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <p className="text-3xl font-semibold">{summary.failures}</p>
            <p className="text-sm text-muted-foreground">{summary.failureRate}% error rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Queue depth</CardTitle>
            <CardDescription>Pending deliveries awaiting retry window.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-baseline gap-2">
            <Activity className="h-5 w-5 text-sky-500" />
            <p className="text-3xl font-semibold">{summary.pending}</p>
            <p className="text-sm text-muted-foreground">active jobs</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Available topics</CardTitle>
          <CardDescription>Each topic maps to a dedicated delivery channel per org.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {data?.topics.map((topic) => (
            <div key={topic.id} className="rounded-lg border bg-muted/50 p-4">
              <p className="text-xs uppercase text-muted-foreground">{topic.id}</p>
              <p className="text-lg font-semibold">{topic.label}</p>
              <p className="text-sm text-muted-foreground">{topic.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active subscriptions</CardTitle>
          <CardDescription>Endpoint health, pending load, and recent attempts per subscription.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Org</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Success / Fail</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Last attempt</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.subscriptions.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{subscription.orgId}</span>
                      <span className="text-xs text-muted-foreground">{subscription.secretPreview}</span>
                    </div>
                  </TableCell>
                  <TableCell className="uppercase text-xs font-semibold">
                    {subscription.topic}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">{subscription.endpoint}</TableCell>
                  <TableCell>
                    <span className="font-medium text-emerald-600">{subscription.delivery.successes}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="font-medium text-rose-600">{subscription.delivery.failures}</span>
                  </TableCell>
                  <TableCell>{subscription.delivery.pending}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {subscription.delivery.lastAttemptAt
                      ? new Date(subscription.delivery.lastAttemptAt).toLocaleString()
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {subscription.delivery.lastStatus === 'failed'
                      ? subscription.delivery.lastError ?? 'Delivery failed'
                      : 'Healthy'}
                  </TableCell>
                </TableRow>
              ))}
              {data?.subscriptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    No webhook subscriptions registered yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent deliveries</CardTitle>
            <CardDescription>Rolling sample of stream jobs across all topics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.recentDeliveries.map((record) => (
              <div key={record.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={record.status === 'success' ? 'secondary' : 'destructive'}>
                      {record.status}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground uppercase">
                      {record.topic}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(record.lastAttemptAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm font-medium">{record.eventType}</p>
                <p className="text-xs text-muted-foreground">
                  Attempts: {record.attempts} • Job {record.eventId.slice(0, 10)}…
                </p>
                {record.note && (
                  <p className="text-xs text-amber-600 mt-2">{record.note}</p>
                )}
              </div>
            ))}
            {data?.recentDeliveries.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No delivery attempts yet. Events will appear here once the stream bus emits payloads.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dead-letter queue</CardTitle>
            <CardDescription>Failed deliveries parked after exhausting retries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <AlertOctagon className="h-4 w-4 text-amber-500" />
              <span>
                {data?.deadLetter.size ?? 0} total • showing {data?.deadLetter.entries.length ?? 0}
              </span>
            </div>
            {data?.deadLetter.entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border p-3 text-sm">
                <p className="font-mono text-xs text-muted-foreground uppercase">
                  {entry.topic} · {entry.eventType}
                </p>
                <p className="font-medium">{entry.endpoint}</p>
                <p className="text-xs text-muted-foreground">
                  Attempts {entry.attempts} • {new Date(entry.failedAt).toLocaleString()}
                </p>
                <p className="text-xs text-rose-600">{entry.failureReason}</p>
              </div>
            ))}
            {data?.deadLetter.entries.length === 0 && (
              <p className="text-sm text-muted-foreground">Dead-letter queue empty.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent stream events</CardTitle>
          <CardDescription>Events emitted from the in-memory bus pre-delivery.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.recentEvents.map((event) => (
            <div key={event.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{event.eventType}</Badge>
                  <span className="text-xs uppercase text-muted-foreground">{event.topic}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Org {event.orgId}</p>
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          ))}
          {data?.recentEvents.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Event bus idle. Trigger credential issuance or revocation to populate this feed.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function summarizeDeliveries(data: StreamConsoleResponse | null) {
  if (!data) {
    return { successes: 0, failures: 0, total: 0, failureRate: 0, pending: 0 };
  }

  const stats = data.subscriptions.map((subscription) => subscription.delivery);
  const successes = stats.reduce((sum, item) => sum + (item.successes ?? 0), 0);
  const failures = stats.reduce((sum, item) => sum + (item.failures ?? 0), 0);
  const pending = stats.reduce((sum, item) => sum + (item.pending ?? 0), 0) + data.queueDepth;
  const total = successes + failures;
  const failureRate = total === 0 ? 0 : Number(((failures / total) * 100).toFixed(1));

  return { successes, failures, total, failureRate, pending };
}

async function fetchStreamConsoleSnapshot(): Promise<StreamConsoleResponse> {
  if (!API_BASE) {
    throw new Error('API base URL not configured for stream console');
  }

  const response = await fetch(`${API_BASE}/api/stream/subscriptions`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Stream console API responded with ${response.status}`);
  }
  return (await response.json()) as StreamConsoleResponse;
}

function buildFallbackConsole(): StreamConsoleResponse {
  const now = new Date();
  const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  return {
    topics: [
      {
        id: 'clinician-updates',
        label: 'Clinician updates',
        description: 'Issued credentials and wallet sync events.',
      },
      {
        id: 'revocations',
        label: 'Revocations',
        description: 'Immediate notifications for revoked artifacts.',
      },
      {
        id: 'status-changes',
        label: 'Status changes',
        description: 'Readiness score delta and monitoring shifts.',
      },
    ],
    subscriptions: [
      {
        id: 'sub-demo-1',
        orgId: 'org-demo-health',
        topic: 'clinician-updates',
        endpoint: 'https://hooks.demo.health/clinician-updates',
        secretPreview: 'abcd••••ff12',
        createdAt: iso(180),
        delivery: {
          successes: 128,
          failures: 2,
          pending: 1,
          lastAttemptAt: iso(2),
          lastStatus: 'success',
        },
        recentDeliveries: [],
      },
      {
        id: 'sub-demo-2',
        orgId: 'org-demo-health',
        topic: 'revocations',
        endpoint: 'https://hooks.demo.health/revocations',
        secretPreview: 'ef45••••88aa',
        createdAt: iso(240),
        delivery: {
          successes: 42,
          failures: 1,
          pending: 0,
          lastAttemptAt: iso(15),
          lastStatus: 'failed',
          lastError: 'Signature mismatch',
        },
        recentDeliveries: [],
      },
    ],
    queueDepth: 1,
    recentDeliveries: [
      {
        id: 'record-1',
        subscriptionId: 'sub-demo-1',
        eventId: 'evt-1',
        eventType: 'credentialIssued',
        topic: 'clinician-updates',
        status: 'success',
        attempts: 1,
        lastAttemptAt: iso(2),
        note: 'Anchored tx 0xabc…',
      },
      {
        id: 'record-2',
        subscriptionId: 'sub-demo-2',
        eventId: 'evt-2',
        eventType: 'credentialRevoked',
        topic: 'revocations',
        status: 'failed',
        attempts: 5,
        lastAttemptAt: iso(15),
        note: 'HTTP 504 from webhook target',
      },
    ],
    recentEvents: [
      {
        id: 'evt-1',
        eventType: 'credentialIssued',
        topic: 'clinician-updates',
        orgId: 'org-demo-health',
        timestamp: iso(2),
        payload: { clinicianId: 'clinician-101', credentialId: 'cred-1' },
      },
      {
        id: 'evt-2',
        eventType: 'statusUpdated',
        topic: 'status-changes',
        orgId: 'org-demo-health',
        timestamp: iso(5),
        payload: { clinicianId: 'clinician-202', readinessDelta: 0.12 },
      },
    ],
    deadLetter: {
      size: 1,
      entries: [
        {
          id: 'dlq-1',
          subscriptionId: 'sub-demo-2',
          endpoint: 'https://hooks.demo.health/revocations',
          topic: 'revocations',
          eventType: 'credentialRevoked',
          eventId: 'evt-2',
          failureReason: 'HTTP 504 Gateway',
          attempts: 5,
          failedAt: iso(15),
          payloadHash: '0xdeadbeef',
          lastError: 'HTTP 504 Gateway',
        },
      ],
    },
  };
}

