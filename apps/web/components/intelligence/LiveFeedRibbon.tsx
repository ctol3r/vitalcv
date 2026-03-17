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

  return 'System warming. Waiting for the first live feed event.';
}

export function LiveFeedRibbon() {
  const [events, setEvents] = useState<RibbonEvent[]>([]);
  const [activeEventIndex, setActiveEventIndex] = useState(0);
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
        const response = await fetch('/api/feed/live?limit=18', {
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
    if (events.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setActiveEventIndex((prev) => (prev + 1) % events.length);
      setRefreshSeconds(0);
    }, FEED_ROTATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [events]);

  useEffect(() => {
    if (activeEventIndex < events.length) {
      return;
    }

    setActiveEventIndex(0);
  }, [activeEventIndex, events.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const pulseColor =
    delivery.mode === 'live'
      ? 'bg-[var(--vt-success)] shadow-[0_0_8px_var(--vt-success)]'
      : delivery.mode === 'cached'
        ? 'bg-[var(--vt-warning)] shadow-[0_0_8px_var(--vt-warning)]'
        : 'bg-[var(--vt-critical)] shadow-[0_0_8px_var(--vt-critical)]';

  const activeEvent = events[activeEventIndex];
  const tickerText = activeEvent ? activeEvent.text : emptyFeedMessage(delivery);
  const tickerSource = activeEvent ? activeEvent.source : null;

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 h-[36px] rounded-sm bg-transparent">
      <div className="shrink-0 flex items-center gap-2 pr-3">
        <div className={cn('relative flex h-2 w-2 items-center justify-center')}>
          <span className={cn('absolute h-full w-full animate-ping rounded-full opacity-75', pulseColor)} />
          <span className={cn('relative h-2 w-2 rounded-full', pulseColor)} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--vt-text-1)]">
          System Live
        </span>
      </div>

      <div className="h-4 w-px bg-[var(--vt-border)]" />

        <div className="flex-1 w-64 overflow-hidden relative group">
          <div
            key={activeEvent?.id ?? `${delivery.mode}-${delivery.reason}`}
            className="flex items-center whitespace-nowrap h-full animate-alive-slide"
          >
            <span className="text-xs font-mono text-[var(--vt-text-secondary)] flex items-center gap-2">
              {tickerSource ? (
                <span className="uppercase tracking-widest text-[9px] text-[var(--vt-text-muted)]">{tickerSource}</span>
              ) : null}
              <span className="text-[var(--vt-text-primary)] font-medium">{tickerText}</span>
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-[var(--vt-border)]" />

        <div className="shrink-0 flex items-center gap-2 text-xs text-[var(--vt-text-muted)] font-mono pl-1">
          <Activity className="h-3 w-3" />
          Last updated: {refreshSeconds}s ago
        </div>
      </div>
  );
}
