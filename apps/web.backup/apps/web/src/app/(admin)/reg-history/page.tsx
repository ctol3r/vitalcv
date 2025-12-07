'use client';

import { useEffect, useMemo, useState } from 'react';
import { Filter, History, RefreshCcw, ShieldCheck } from 'lucide-react';

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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  '';

const AUTHORITY_CODES = ['FSMB', 'NCSBN', 'GMC', 'AHPRA'];

type TimelineFilter = 'all' | 'ruleSetUpdated' | 'ruleSetSynced';

interface TimelineRecord {
  id: string;
  authorityCode: string;
  title: string;
  description?: string | null;
  eventType: string;
  tags: string[];
  occurredAt: string;
  anchor?: {
    txHash: string;
    network: string;
    anchorId: string;
    timestamp: string;
  } | null;
}

export default function RegulatoryHistoryAdminPage() {
  const [events, setEvents] = useState<TimelineRecord[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('loading');
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTimeline();
  }, []);

  async function loadTimeline() {
    setState('loading');
    setError(null);
    try {
      const records = await fetchTimeline();
      setEvents(records);
      setState('idle');
    } catch (err) {
      console.warn('[admin][reg-history]', err);
      setError(err instanceof Error ? err.message : 'Unable to load timeline events.');
      setEvents([]);
      setState('error');
    }
  }

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((event) => event.eventType === filter);
  }, [events, filter]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary" className="w-fit gap-1">
          <History className="h-3.5 w-3.5" />
          Admin · Regulatory history
        </Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Regulatory event timeline</h1>
            <p className="text-muted-foreground">
              Combined CME + renewal updates anchored on-chain across FSMB, NCSBN, GMC, and AHPRA.
            </p>
          </div>
          <Button variant="outline" onClick={() => loadTimeline()} disabled={state === 'loading'}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', state === 'loading' && 'animate-spin')} />
            Refresh
          </Button>
        </div>
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </header>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Event filters</CardTitle>
            <CardDescription>Highlight deltas vs refresh-only snapshots.</CardDescription>
          </div>
          <Tabs value={filter} onValueChange={(value) => setFilter(value as TimelineFilter)}>
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="all">
                <Filter className="mr-2 h-3.5 w-3.5" />
                All
              </TabsTrigger>
              <TabsTrigger value="ruleSetUpdated">Deltas</TabsTrigger>
              <TabsTrigger value="ruleSetSynced">No change</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} className="w-full">
            <TabsContent value="all">
              <TimelineFeed events={events} />
            </TabsContent>
            <TabsContent value="ruleSetUpdated">
              <TimelineFeed events={events.filter((event) => event.eventType === 'ruleSetUpdated')} />
            </TabsContent>
            <TabsContent value="ruleSetSynced">
              <TimelineFeed events={events.filter((event) => event.eventType === 'ruleSetSynced')} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineFeed({ events }: { events: TimelineRecord[] }) {
  if (!events.length) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        No timeline entries for this filter yet.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">{event.authorityCode}</Badge>
            <Badge variant={event.eventType === 'ruleSetUpdated' ? 'default' : 'secondary'}>
              {event.eventType === 'ruleSetUpdated' ? 'Rule delta' : 'Synced'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(event.occurredAt).toLocaleString()}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              {event.tags.map((tag) => (
                <Badge key={`${event.id}-${tag}`} variant="outline">
                  {tag}
                </Badge>
              ))}
              {event.anchor && (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {shortHash(event.anchor.txHash)}
                </Badge>
              )}
            </div>
          </div>
          <p className="mt-3 text-lg font-semibold">{event.title}</p>
          {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
        </li>
      ))}
    </ul>
  );
}

async function fetchTimeline(): Promise<TimelineRecord[]> {
  if (!API_BASE) {
    throw new Error('NEXT_PUBLIC_API_BASE is not configured');
  }
  const payloads = await Promise.allSettled(
    AUTHORITY_CODES.map(async (authority) => {
      const response = await fetch(`${API_BASE}/api/regulatory/${authority}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Timeline API for ${authority} failed with ${response.status}`);
      }
      const data = (await response.json()) as {
        timeline: TimelineRecord[];
      };
      return data.timeline.map((event) => ({ ...event, authorityCode: authority }));
    }),
  );

  const events: TimelineRecord[] = [];
  for (const result of payloads) {
    if (result.status === 'fulfilled') {
      events.push(...result.value);
    }
  }

  return events.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

function shortHash(value: string) {
  return value.slice(0, 8);
}









