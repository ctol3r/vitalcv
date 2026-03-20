'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

type DeliveryMode = 'live' | 'cached' | 'degraded';
type DeliveryReason = 'ok' | 'backend_unavailable' | 'missing_session' | 'missing_org';

interface LiveFeedEvent {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

interface LiveFeedResponse {
  events: LiveFeedEvent[];
  delivery: {
    mode: DeliveryMode;
    reason: DeliveryReason;
    cachedAt: string | null;
  };
}

interface RibbonEvent {
  id: string;
  source: string;
  text: string;
  timestamp: number;
}

const FEED_POLL_INTERVAL_MS = 15_000;
const FEED_ROTATE_INTERVAL_MS = 4_000;

const DEFAULT_DELIVERY: LiveFeedResponse['delivery'] = {
  mode: 'degraded',
  reason: 'backend_unavailable',
  cachedAt: null,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function asDeliveryMode(value: unknown): DeliveryMode {
  if (value === 'live' || value === 'cached' || value === 'degraded') {
    return value;
  }
  return 'degraded';
}

function asDeliveryReason(value: unknown): DeliveryReason {
  if (value === 'ok' || value === 'backend_unavailable' || value === 'missing_session' || value === 'missing_org') {
    return value;
  }
  return 'backend_unavailable';
}

function normalizeLiveFeedResponse(payload: unknown): LiveFeedResponse {
  const root = asRecord(payload);
  const delivery = asRecord(root.delivery);
  const events = Array.isArray(root.events) ? root.events : [];

  return {
    events: events.map((event, index) => {
      const entry = asRecord(event);
      return {
        id: asString(entry.id, `event_${index}`),
        type: asString(entry.type, 'UNKNOWN'),
        source: asString(entry.source, 'backend'),
        timestamp: asString(entry.timestamp, new Date().toISOString()),
        payload: asRecord(entry.payload),
      };
    }),
    delivery: {
      mode: asDeliveryMode(delivery.mode),
      reason: asDeliveryReason(delivery.reason),
      cachedAt: typeof delivery.cachedAt === 'string' ? delivery.cachedAt : null,
    },
  };
}

function formatLiveFeedEvent(event: LiveFeedEvent): string {
  const payload = event.payload;
  if (event.type === 'PROVIDER_UPDATED') {
    const providerLabel = asString(payload.providerLabel, asString(payload.npi, 'provider'));
    const operation = asString(payload.operation, 'updated');
    return `Provider ${providerLabel} ${operation}`;
  }

  if (event.type === 'FINDING_CREATED') {
    const severity = asString(payload.severity, 'info').toUpperCase();
    const investigatorId = asString(payload.investigatorId, 'investigator');
    const operation = asString(payload.operation, 'updated');
    return `${severity} finding ${operation} by ${investigatorId}`;
  }

  if (event.type === 'STORYLINE_UPDATED') {
    const storylineType = asString(payload.storylineType, 'storyline');
    const operation = asString(payload.operation, 'updated');
    return `${storylineType} storyline ${operation}`;
  }

  return 'Live intelligence event received';
}

function toRibbonEvents(events: LiveFeedEvent[]): RibbonEvent[] {
  return events.map((event) => {
    const parsedTimestamp = Date.parse(event.timestamp);
    return {
      id: event.id,
      source: event.source,
      text: formatLiveFeedEvent(event),
      timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now(),
    };
  });
}

function connectionLabel(mode: DeliveryMode): string {
  if (mode === 'live') {
    return 'Live';
  }

  if (mode === 'cached') {
    return 'Cached';
  }

  return 'Degraded';
}

function emptyFeedMessage(delivery: LiveFeedResponse['delivery']): string {
  if (delivery.reason === 'missing_session') {
    return 'Sign in to access the live intelligence feed.';
  }

  if (delivery.reason === 'missing_org') {
    return 'Select an organization workspace for live feed access.';
  }

  if (delivery.reason === 'backend_unavailable') {
    return delivery.mode === 'cached'
      ? 'Backend unavailable. Showing the last cached feed snapshot.'
      : 'Live feed backend unavailable. Retrying.';
  }

  return 'No live feed events have been observed yet.';
}

export function LiveFeedRibbon() {
  const [events, setEvents] = useState<RibbonEvent[]>([]);
  const [mounted, setMounted] = useState(false);
  const [refreshSeconds, setRefreshSeconds] = useState(0);
  const [delivery, setDelivery] = useState<LiveFeedResponse['delivery']>(DEFAULT_DELIVERY);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;

    const loadFeed = async () => {
      try {
        const response = await fetch('/api/feed/live?limit=1', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`feed ${response.status}`);
        }

        const normalized = normalizeLiveFeedResponse(await response.json().catch(() => ({})));
        if (!active) {
          return;
        }

        setEvents(toRibbonEvents(normalized.events));
        setDelivery(normalized.delivery);
        setRefreshSeconds(0);
      } catch {
        if (!active) {
          return;
        }

        setDelivery((current) => ({
          mode: current.mode === 'live' ? 'cached' : current.mode,
          reason: 'backend_unavailable',
          cachedAt: current.cachedAt,
        }));
      }
    };

    void loadFeed();
    const interval = setInterval(() => {
      void loadFeed();
    }, FEED_POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return null;
  }

  const latestEvent = events[0] || null;

  return (
    <div className="flex items-center gap-4 h-[30px] px-3 rounded-sm bg-[var(--vt-surface-dim)] border border-[var(--vt-border)]">
      <div className="shrink-0 flex items-center gap-2">
        {delivery.mode === 'live' ? (
          <div className="relative flex h-1.5 w-1.5 items-center justify-center">
            <span className="absolute h-full w-full animate-ping rounded-full bg-[var(--vt-text-1)] opacity-75" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--vt-text-1)]" />
          </div>
        ) : delivery.mode === 'cached' ? (
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--vt-text-2)]" />
        ) : (
           <div className="h-1.5 w-1.5 rounded-full bg-[var(--vt-border)]" />
        )}
        <span className="text-[9px] font-semibold uppercase tracking-widest text-[var(--vt-text-1)]">
          {delivery.mode === 'live' ? 'Pipeline Active' : delivery.mode === 'cached' ? 'Pipeline Waking' : 'System Degraded'}
        </span>
      </div>

      {latestEvent && (
        <>
          <div className="h-3 w-px bg-[var(--vt-border)]" />
          
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-widest text-[var(--vt-text-3)] font-mono">LATEST INGEST:</span>
            <span className="text-[9px] uppercase tracking-widest text-[var(--vt-text-2)] line-clamp-1 max-w-[300px]">
              {latestEvent.text}
            </span>
          </div>
          
          <div className="h-3 w-px bg-[var(--vt-border)]" />
          
          <div className="flex items-center gap-1.5 text-[9px] text-[var(--vt-text-3)] font-mono uppercase tracking-widest">
            <Activity className="h-2.5 w-2.5" />
            00:{refreshSeconds.toString().padStart(2, '0')}
          </div>
        </>
      )}
    </div>
  );
}
