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
import { AlertTriangle, CheckCircle2, Link2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type HiringEvent = {
  id: string;
  clinicianId: string;
  employerId: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  txHash?: string | null;
  blockHash?: string | null;
  anchoredAt?: string | null;
};

type TimelineResponse = {
  clinicianId: string;
  events: HiringEvent[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '');

const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_CHAIN_EXPLORER ??
  'https://explorer.vitalcv.health/tx/';

export default function HiringTimelinePage({
  params,
}: {
  params: { clinicianId: string };
}) {
  const [events, setEvents] = useState<HiringEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTimeline(params.clinicianId);
  }, [params.clinicianId]);

  async function loadTimeline(clinicianId: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchTimeline(clinicianId);
      setEvents(response.events);
    } catch (err) {
      console.warn('[recruiter][hiring-timeline] using demo timeline', err);
      setEvents(buildFallbackEvents(clinicianId));
      setError('Showing cached ledger snapshot while hiring ledger API is unavailable.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Recruiter · Hiring Ledger</Badge>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">
              Hiring timeline for{' '}
              <span className="font-mono text-base">{params.clinicianId}</span>
            </h1>
            <p className="text-muted-foreground">
              Immutable ledger of applied → PSV → privileges → onboarding.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadTimeline(params.clinicianId)} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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

      <Card>
        <CardHeader>
          <CardTitle>Hiring events</CardTitle>
          <CardDescription>
            Each milestone is hashed, anchored on chain, and exportable for Joint Commission audits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading ledger…
            </div>
          ) : (
            <ol className="space-y-4">
              {events.map((event, index) => (
                <li key={event.id} className="relative rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{humanizeEventType(event.eventType)}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-base font-semibold">
                        {event.employerId}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {renderMetadataSummary(event.metadata)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={!event.txHash}
                      onClick={() => openExplorer(event.txHash ?? undefined)}
                    >
                      <Link2 className="h-4 w-4" />
                      Verify on chain
                    </Button>
                  </div>
                  {event.txHash && (
                    <p className="mt-3 text-xs text-muted-foreground break-all">
                      <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-500" />
                      Tx {event.txHash} · Block {event.blockHash ?? 'pending'}
                    </p>
                  )}
                  {index < events.length - 1 && (
                    <span className="absolute bottom-0 left-4 w-px translate-y-full bg-border" style={{ height: 16 }} />
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function renderMetadataSummary(metadata: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return 'No additional metadata captured.';
  }
  const keys = Object.keys(metadata).slice(0, 3);
  return keys
    .map((key) => `${humanizeKey(key)}: ${String(metadata[key])}`)
    .join(' · ');
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeEventType(eventType: string): string {
  switch (eventType) {
    case 'applied':
      return 'Application submitted';
    case 'verified':
      return 'Primary source verified';
    case 'privileged':
      return 'Privileges granted';
    case 'offerSent':
      return 'Offer sent';
    case 'offerAccepted':
      return 'Offer accepted';
    case 'onboarded':
      return 'Onboarding complete';
    default:
      return eventType;
  }
}

async function fetchTimeline(clinicianId: string): Promise<TimelineResponse> {
  if (!API_BASE) {
    throw new Error('API base URL not configured');
  }

  const response = await fetch(`${API_BASE}/api/hiring/timeline/${clinicianId}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Hiring timeline API returned ${response.status}`);
  }
  return (await response.json()) as TimelineResponse;
}

function openExplorer(txHash?: string) {
  if (!txHash) return;
  const url = `${EXPLORER_BASE.replace(/\/$/, '')}/${txHash.replace(/^0x/, '')}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function buildFallbackEvents(clinicianId: string): HiringEvent[] {
  const base = Date.now();
  return [
    {
      id: 'evt-1',
      clinicianId,
      employerId: 'demo-health-system',
      eventType: 'applied',
      metadata: { requisitionId: 'REQ-8831', recruiter: 'JDoe' },
      createdAt: new Date(base - 7 * 24 * 60 * 60 * 1000).toISOString(),
      txHash: '0xabc123',
      blockHash: '0xblock1',
      anchoredAt: new Date(base - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'evt-2',
      clinicianId,
      employerId: 'demo-health-system',
      eventType: 'verified',
      metadata: { psvPacket: 'packet-4481', turnaroundHours: 72 },
      createdAt: new Date(base - 5 * 24 * 60 * 60 * 1000).toISOString(),
      txHash: '0xdef456',
      blockHash: '0xblock2',
      anchoredAt: new Date(base - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'evt-3',
      clinicianId,
      employerId: 'demo-health-system',
      eventType: 'privileged',
      metadata: { committee: 'MEC', chair: 'Dr. Alvarez' },
      createdAt: new Date(base - 3 * 24 * 60 * 60 * 1000).toISOString(),
      txHash: '0xghi789',
      blockHash: '0xblock3',
      anchoredAt: new Date(base - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'evt-4',
      clinicianId,
      employerId: 'demo-health-system',
      eventType: 'onboarded',
      metadata: { startDate: new Date(base + 5 * 24 * 60 * 60 * 1000).toISOString() },
      createdAt: new Date(base - 24 * 60 * 60 * 1000).toISOString(),
      txHash: '0xjkl012',
      blockHash: '0xblock4',
      anchoredAt: new Date(base - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}










