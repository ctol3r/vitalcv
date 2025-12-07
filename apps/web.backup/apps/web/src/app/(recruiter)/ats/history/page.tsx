'use client';

import { useEffect, useState } from 'react';
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
import { AlertTriangle, ArrowUpRight, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type SyncEvent = {
  id: string;
  clinicianId: string;
  orgId: string;
  event: string;
  processed: boolean;
  createdAt: string;
  payload: {
    diff?: {
      before?: number | null;
      after?: number;
      delta?: number;
    };
    retryCount?: number;
    nextAttemptAt?: string;
    lastError?: string | null;
    deliveredAt?: string;
  };
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '');

export default function AtsHistoryPage() {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAtsHistory();
      setEvents(data);
    } catch (err) {
      console.warn('[recruiter][ats-history] falling back to demo data', err);
      setEvents(buildFallbackHistory());
      setError('Unable to reach ATS sync history API — showing last known demo events.');
    } finally {
      setLoading(false);
    }
  }

  const successful = events.filter((event) => isSuccess(event));
  const failures = events.length - successful.length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Recruiter · ATS Syncs</Badge>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Sync history</h1>
            <p className="text-muted-foreground">
              Monitor the last 100 push-to-ATS deliveries, status codes, and retry cadence.
            </p>
          </div>
          <Button variant="outline" className="ml-auto gap-2" onClick={() => loadHistory()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
        {error && (
          <p className="text-sm text-amber-600">
            <AlertTriangle className="mr-1 inline h-4 w-4 align-middle" />
            {error}
          </p>
        )}
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Delivered</CardTitle>
            <CardDescription>Processed webhook posts in the lookback window.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{successful.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending retries</CardTitle>
            <CardDescription>Queued records awaiting next attempt.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{events.length - successful.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Most recent diff</CardTitle>
            <CardDescription>Readiness lift shipped in the latest delivery.</CardDescription>
          </CardHeader>
          <CardContent>
            {events[0]?.payload?.diff?.delta ? (
              <div className="flex items-baseline gap-2">
                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                <p className="text-3xl font-semibold">
                  {(events[0].payload.diff.delta * 100).toFixed(1)} pts
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">No readiness data in the latest record.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Last 100 sync events</CardTitle>
          <CardDescription>Includes readiness updates, credential issuance signals, and fails.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading ATS history…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinician</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retry count</TableHead>
                  <TableHead>Last update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{event.clinicianId}</span>
                        <span className="text-xs text-muted-foreground">{event.orgId}</span>
                      </div>
                    </TableCell>
                    <TableCell>{event.event}</TableCell>
                    <TableCell>
                      <Badge variant={isSuccess(event) ? 'default' : 'destructive'}>
                        {isSuccess(event) ? 'Success' : 'Retrying'}
                      </Badge>
                      {event.payload.lastError && (
                        <p className="text-xs text-muted-foreground">
                          {event.payload.lastError}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{event.payload.retryCount ?? 0}</TableCell>
                    <TableCell>
                      {event.payload.deliveredAt
                        ? new Date(event.payload.deliveredAt).toLocaleString()
                        : new Date(event.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function isSuccess(event: SyncEvent): boolean {
  return event.processed && !event.payload?.lastError;
}

async function fetchAtsHistory(): Promise<SyncEvent[]> {
  if (!API_BASE) {
    throw new Error('API base URL not configured for ATS history');
  }

  const response = await fetch(`${API_BASE}/api/ats/history?limit=100`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`ATS history endpoint returned ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload?.events)) {
    throw new Error('Malformed ATS history payload');
  }

  return payload.events as SyncEvent[];
}

function buildFallbackHistory(): SyncEvent[] {
  const now = Date.now();
  return [
    {
      id: 'demo-1',
      clinicianId: 'clinician-4488',
      orgId: 'demo-health-system',
      event: 'readinessUpdate',
      processed: true,
      createdAt: new Date(now - 5 * 60_000).toISOString(),
      payload: {
        diff: { before: 0.81, after: 0.92, delta: 0.11 },
        retryCount: 0,
        deliveredAt: new Date(now - 4 * 60_000).toISOString(),
      },
    },
    {
      id: 'demo-2',
      clinicianId: 'clinician-9931',
      orgId: 'demo-health-system',
      event: 'readinessUpdate',
      processed: false,
      createdAt: new Date(now - 15 * 60_000).toISOString(),
      payload: {
        diff: { before: 0.65, after: 0.78, delta: 0.13 },
        retryCount: 2,
        nextAttemptAt: new Date(now + 5 * 60_000).toISOString(),
        lastError: 'ATS endpoint timed out (504)',
      },
    },
  ];
}










