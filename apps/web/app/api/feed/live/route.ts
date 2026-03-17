import { getBackendBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildForwardHeaders,
  canReadIntelligence,
  logIntelligenceFallbackUsage,
  resolveIntelligenceAuthContext,
} from '../../intelligence/_shared';

export const runtime = 'nodejs';
const LIVE_FEED_SCHEMA = 'https://vitalcv.com/feed/live/v1';
const MAX_CACHE_KEYS = 8;

type DeliveryMode = 'live' | 'cached' | 'degraded';
type DeliveryReason = 'ok' | 'backend_unavailable' | 'missing_session' | 'missing_org';

interface LiveFeedEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: Record<string, unknown>;
}

interface LiveFeedPayload {
  schema: string;
  generatedAt: string;
  total: number;
  events: LiveFeedEvent[];
  delivery: {
    mode: DeliveryMode;
    reason: DeliveryReason;
    cachedAt: string | null;
  };
}

interface CachedLiveFeed {
  payload: LiveFeedPayload;
  cachedAt: string;
}

const liveFeedCache = new Map<string, CachedLiveFeed>();

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function asDateString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? value : fallback;
}

function asEvents(value: unknown): LiveFeedEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((event, index) => {
    const record = asRecord(event);
    const fallbackTimestamp = new Date().toISOString();

    return {
      id: asString(record.id, `feed_event_${index}`),
      type: asString(record.type, 'UNKNOWN'),
      timestamp: asDateString(record.timestamp, fallbackTimestamp),
      source: asString(record.source, 'backend'),
      payload: asRecord(record.payload),
    };
  });
}

function cacheKey(req: NextRequest): string {
  const serialized = req.nextUrl.searchParams.toString();
  return serialized.length > 0 ? serialized : 'default';
}

function getCachedLiveFeed(key: string): CachedLiveFeed | null {
  return liveFeedCache.get(key) ?? null;
}

function setCachedLiveFeed(key: string, payload: LiveFeedPayload): void {
  if (liveFeedCache.size >= MAX_CACHE_KEYS && !liveFeedCache.has(key)) {
    const oldestKey = liveFeedCache.keys().next().value;
    if (typeof oldestKey === 'string') {
      liveFeedCache.delete(oldestKey);
    }
  }

  liveFeedCache.set(key, {
    payload,
    cachedAt: new Date().toISOString(),
  });
}

function fromCachedFeed(cached: CachedLiveFeed, reason: DeliveryReason): LiveFeedPayload {
  return {
    ...cached.payload,
    delivery: {
      mode: 'cached',
      reason,
      cachedAt: cached.cachedAt,
    },
  };
}

function degradedFeed(reason: DeliveryReason): LiveFeedPayload {
  return {
    schema: LIVE_FEED_SCHEMA,
    generatedAt: new Date().toISOString(),
    total: 0,
    events: [],
    delivery: {
      mode: 'degraded',
      reason,
      cachedAt: null,
    },
  };
}

function normalizeLiveFeedPayload(payload: unknown): LiveFeedPayload {
  const record = asRecord(payload);
  const events = asEvents(record.events);

  return {
    schema: asString(record.schema, LIVE_FEED_SCHEMA),
    generatedAt: asDateString(record.generatedAt, new Date().toISOString()),
    total: typeof record.total === 'number' && Number.isFinite(record.total)
      ? Math.max(0, Math.floor(record.total))
      : events.length,
    events,
    delivery: {
      mode: 'live',
      reason: 'ok',
      cachedAt: null,
    },
  };
}

function fallbackReasonForAuth(status: string): DeliveryReason {
  return status === 'missing_org' ? 'missing_org' : 'missing_session';
}

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  const key = cacheKey(req);
  const cached = getCachedLiveFeed(key);

  if (!canReadIntelligence(authContext)) {
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'read_fallback');
    return NextResponse.json(degradedFeed(fallbackReasonForAuth(authContext.status)));
  }

  try {
    const response = await fetch(`${getBackendBase()}/api/feed/live${req.nextUrl.search}`, {
      headers: await buildForwardHeaders(undefined, { context: authContext }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(
        cached
          ? fromCachedFeed(cached, 'backend_unavailable')
          : degradedFeed('backend_unavailable'),
      );
    }

    const normalized = normalizeLiveFeedPayload(await response.json().catch(() => ({})));
    setCachedLiveFeed(key, normalized);
    return NextResponse.json(normalized);
  } catch {
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(
      cached
        ? fromCachedFeed(cached, 'backend_unavailable')
        : degradedFeed('backend_unavailable'),
    );
  }
}
