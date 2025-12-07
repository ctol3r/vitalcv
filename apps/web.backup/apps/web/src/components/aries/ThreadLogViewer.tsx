'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MessageEntry {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  connectionId?: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
  auditId?: string | null;
}

interface ThreadLog {
  threadId: string;
  total: number;
  messages: MessageEntry[];
}

export function ThreadLogViewer({ threadId }: { threadId: string }) {
  const [log, setLog] = useState<ThreadLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchLogs(threadId);
  }, [threadId]);

  async function fetchLogs(id: string) {
    setError(null);
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        process.env.API_BASE_URL ??
        (typeof window !== 'undefined' ? window.location.origin : '');

      if (!baseUrl) {
        throw new Error('Missing API base URL');
      }

      const response = await fetch(`${baseUrl}/api/aries/logs/${id}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Log API returned ${response.status}`);
      }
      setLog((await response.json()) as ThreadLog);
    } catch (err) {
      console.error('[aries][logs][viewer]', err);
      setError('Unable to fetch DIDComm transcript. Showing cached entries if available.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>DIDComm transcript</CardTitle>
        <CardDescription>Thread {threadId}</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-amber-600">{error}</p>}
        <ScrollArea className="h-[420px] pr-4">
          <ol className="space-y-3">
            {(log?.messages ?? []).map((message) => (
              <li
                key={message.id}
                className="rounded-lg border p-3 shadow-sm"
                data-direction={message.direction.toLowerCase()}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={message.direction === 'OUTBOUND' ? 'default' : 'secondary'}>
                    {message.direction === 'OUTBOUND' ? 'Outbound' : 'Inbound'}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{message.id}</span>
                  <span className="text-muted-foreground">
                    {new Date(message.createdAt).toLocaleString()}
                  </span>
                  <span className="ml-auto font-medium">{message.type}</span>
                </div>
                <pre className="mt-2 overflow-x-auto rounded bg-muted/60 p-2 text-xs">
                  {JSON.stringify(message.payload, null, 2)}
                </pre>
                {message.auditId && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Audit reference {message.auditId}
                  </p>
                )}
              </li>
            ))}
            {log?.messages?.length === 0 && (
              <li className="text-sm text-muted-foreground">
                No DIDComm traffic recorded for this thread yet.
              </li>
            )}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}










