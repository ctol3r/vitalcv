'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Clock, RefreshCcw, Zap } from 'lucide-react';

const API_BASE =
  process.env.NEXT_PUBLIC_VERIFIER_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

type ProofStreamStatus = 'pending' | 'validated' | 'anchored' | 'error';

interface ProofStreamEvent {
  id: string;
  event: string;
  payload: Record<string, any>;
  ts: string;
}

interface ProofStreamSummary {
  status: ProofStreamStatus;
  eventCount: number;
  lastEvent?: string;
  lastEventAt?: string;
  checkpointCount: number;
  workerStats: Record<
    string,
    {
      count: number;
      lastEventAt: string;
      lastPayload?: Record<string, any>;
    }
  >;
}

interface ProofStreamResponse {
  threadId: string;
  summary: ProofStreamSummary;
  events: ProofStreamEvent[];
}

export default function ProofStreamTimelinePage({ params }: { params: { threadId: string } }) {
  const { threadId } = params;
  const [data, setData] = useState<ProofStreamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function fetchStream() {
      setLoading(true);
      const base = API_BASE ? API_BASE.replace(/\/$/, '') : '';
      try {
        const response = await fetch(`${base}/api/proofs/stream/${threadId}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || `Failed to load stream (${response.status})`);
        }
        const payload = (await response.json()) as ProofStreamResponse;
        if (isMounted) {
          setData(payload);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load proof stream');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchStream();
    const interval = setInterval(fetchStream, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [threadId, refreshToken]);

  const workerEntries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.summary.workerStats).map(([worker, stats]) => ({
      worker,
      ...stats,
    }));
  }, [data]);

  const statusBadge = useMemo(() => {
    if (!data) return null;
    const status = data.summary.status;
    switch (status) {
      case 'anchored':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Anchored
          </Badge>
        );
      case 'validated':
        return (
          <Badge className="bg-primary text-primary-foreground">
            <Zap className="mr-1 h-4 w-4" />
            Validated
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertTriangle className="mr-1 h-4 w-4" />
            Attention
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-4 w-4" />
            In progress
          </Badge>
        );
    }
  }, [data]);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-10">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" asChild className="w-fit text-sm text-muted-foreground">
          <Link href="/verifier/scan">← Back to verifier</Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Proof timeline</h1>
          <p className="text-muted-foreground">
            Live stream of worker events for thread{' '}
            <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{threadId}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-2xl">{data?.summary.status ?? 'pending'}</CardTitle>
          </CardHeader>
          <CardContent>{statusBadge}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Events processed</CardDescription>
            <CardTitle className="text-2xl">{data?.summary.eventCount ?? '—'}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data?.summary.lastEventAt ? `Last event ${formatTimestamp(data.summary.lastEventAt)}` : 'Awaiting events'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Checkpoints</CardDescription>
            <CardTitle className="text-2xl">{data?.summary.checkpointCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Anchored events recorded when the stream is checkpointed on chain.
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefreshToken((value) => value + 1)}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Worker execution</CardTitle>
            <CardDescription>Dispatch health across sd-jwt, bbs+, and chain checks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {workerEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No worker events recorded yet. Once the dispatcher runs, worker stats will appear here.
              </p>
            ) : (
              workerEntries.map((entry) => (
                <div
                  key={entry.worker}
                  className="rounded-lg border bg-muted/40 p-3 text-sm flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium uppercase text-xs">{entry.worker}</p>
                    <p className="text-muted-foreground text-xs">
                      Last update {formatTimestamp(entry.lastEventAt)}
                    </p>
                  </div>
                  <Badge variant="secondary">{entry.count} events</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Latest checkpoints</CardTitle>
            <CardDescription>Recent anchoring metadata captured from the dispatcher.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data?.events
              .filter((event) => event.event === 'anchored')
              .slice(0, 3)
              .map((event) => (
                <div key={event.id} className="rounded-md border p-3">
                  <p className="font-mono text-xs break-all text-muted-foreground">
                    {event.payload?.txHash || '0x…'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Block {event.payload?.blockHash || 'unknown'} •{' '}
                    {formatTimestamp(event.ts)}
                  </p>
                </div>
              ))}
            {data?.summary.checkpointCount === 0 && (
              <p className="text-muted-foreground">No checkpoints anchored yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Every proof-stream event captured for this thread.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading timeline…</p>
          )}
          {!loading && data?.events.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No events recorded yet. The queue will populate this timeline once processing begins.
            </p>
          )}
          {!loading &&
            data?.events.map((event) => (
              <div key={event.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="uppercase">
                    {event.event}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatTimestamp(event.ts)}</span>
                </div>
                {event.payload && Object.keys(event.payload).length > 0 && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/30 p-2 text-xs">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString();
  } catch {
    return iso;
  }
}









