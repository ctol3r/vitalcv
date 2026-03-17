import type { Prisma } from '@prisma/client';
import type { EventEnvelope, VitalEvent } from '../../core/events/eventBus';
import { listRecentEvents } from '../../core/events/eventBus';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { runIntelligenceAutoWarm } from '../intelligence/intelligenceAutoWarmService';
import { syncPersistedStorylines } from '../storylines/storylineService';

export type LiveFeedEvent =
  | (EventEnvelope<'PROVIDER_UPDATED'> & { source: 'event_bus' | 'db_backfill' })
  | (EventEnvelope<'FINDING_CREATED'> & { source: 'event_bus' | 'db_backfill' })
  | (EventEnvelope<'STORYLINE_UPDATED'> & { source: 'event_bus' | 'db_backfill' });

export interface LiveFeedResponse {
  schema: string;
  generatedAt: string;
  total: number;
  cached: boolean;
  degradedReason: 'backend_failure' | 'empty_feed' | null;
  recoveryTriggered: boolean;
  events: LiveFeedEvent[];
}

let lastSuccessfulLiveFeed: LiveFeedResponse | null = null;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function timestampValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function severityWeight(value: string | null | undefined): number {
  switch ((value ?? '').toLowerCase()) {
    case 'critical':
      return 5;
    case 'high':
      return 4;
    case 'medium':
      return 3;
    case 'low':
      return 2;
    case 'info':
    default:
      return 1;
  }
}

function eventSeverityWeight(event: LiveFeedEvent): number {
  switch (event.type) {
    case 'FINDING_CREATED':
      return severityWeight(event.payload.severity);
    case 'STORYLINE_UPDATED':
      return severityWeight(event.payload.severity);
    case 'PROVIDER_UPDATED':
    default:
      return severityWeight('info');
  }
}

function compareLiveFeedEvents(left: LiveFeedEvent, right: LiveFeedEvent): number {
  return (
    timestampValue(right.timestamp) - timestampValue(left.timestamp)
    || eventSeverityWeight(right) - eventSeverityWeight(left)
    || right.id.localeCompare(left.id)
  );
}

function logFeedFailure(fields: Record<string, unknown>): void {
  log('warn', 'intelligence_failure_detected', {
    event: 'intelligence_failure_detected',
    ...fields,
  });
}

function isLiveFeedEvent(
  event: VitalEvent,
): event is EventEnvelope<'PROVIDER_UPDATED'> | EventEnvelope<'FINDING_CREATED'> | EventEnvelope<'STORYLINE_UPDATED'> {
  return event.type === 'PROVIDER_UPDATED' || event.type === 'FINDING_CREATED' || event.type === 'STORYLINE_UPDATED';
}

function findingOperationFromRow(row: {
  createdAt: Date;
  updatedAt: Date;
  occurrenceCount: number;
}): 'created' | 'updated' {
  return row.occurrenceCount > 1 || row.updatedAt.getTime() > row.createdAt.getTime()
    ? 'updated'
    : 'created';
}

function providerOperationFromRow(row: {
  createdAt: Date;
  updatedAt: Date;
}): 'created' | 'updated' {
  return row.updatedAt.getTime() > row.createdAt.getTime()
    ? 'updated'
    : 'created';
}

function toStorylineType(value: string): string {
  switch (value) {
    case 'TRUST_DECLINE':
      return 'trust decline';
    case 'RISING_INVESTIGATOR':
      return 'rising investigator';
    case 'NETWORK_EMERGENCE':
      return 'network emergence';
    case 'COMPLIANCE_RISK':
      return 'compliance risk';
    case 'WORKFORCE_OPPORTUNITY':
      return 'workforce opportunity';
    case 'INSTITUTION_SHIFT':
      return 'institution shift';
    case 'INDUSTRY_INFLUENCE':
    default:
      return 'industry influence';
  }
}

function toStorylineStatus(value: string): string {
  switch (value) {
    case 'ACTIVE':
      return 'active';
    case 'QUIET':
      return 'quiet';
    case 'ESCALATED':
      return 'escalated';
    case 'RESOLVED':
      return 'resolved';
    case 'ARCHIVED':
    default:
      return 'archived';
  }
}

function toStorylineSeverity(value: string): string {
  switch (value) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    case 'INFO':
    default:
      return 'info';
  }
}

function storylineOperationFromEventType(
  eventType: string | undefined,
): 'created' | 'updated' | 'status_changed' {
  if (eventType === 'ORIGIN') {
    return 'created';
  }

  if (eventType === 'UPDATED') {
    return 'updated';
  }

  return 'status_changed';
}

function liveFeedKey(event: LiveFeedEvent): string {
  switch (event.type) {
    case 'PROVIDER_UPDATED':
      return `provider:${event.payload.npi ?? event.payload.providerId}:${event.payload.operation}`;
    case 'FINDING_CREATED':
      return `finding:${event.payload.findingId}:${event.payload.operation}`;
    case 'STORYLINE_UPDATED':
    default:
      return `storyline:${event.payload.storylineId}:${event.payload.operation}`;
  }
}

function dedupeAndSortEvents(events: LiveFeedEvent[], limit: number): LiveFeedEvent[] {
  const sorted = [...events].sort(compareLiveFeedEvents);
  const deduped = new Map<string, LiveFeedEvent>();

  for (const event of sorted) {
    const key = liveFeedKey(event);
    if (!deduped.has(key)) {
      deduped.set(key, event);
    }
  }

  return [...deduped.values()].sort(compareLiveFeedEvents).slice(0, limit);
}

function busEventToLiveFeedEvent(
  event: EventEnvelope<'PROVIDER_UPDATED'> | EventEnvelope<'FINDING_CREATED'> | EventEnvelope<'STORYLINE_UPDATED'>,
): LiveFeedEvent {
  return {
    ...event,
    source: 'event_bus',
  };
}

async function loadBackfillEvents(limit: number): Promise<LiveFeedEvent[]> {
  const queryLimit = Math.max(limit, 50);
  await syncPersistedStorylines();

  const [findingRows, storylineRows, providerRows] = await Promise.all([
    prisma.investigatorFinding.findMany({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: queryLimit,
      select: {
        findingId: true,
        investigatorId: true,
        severity: true,
        status: true,
        entityIds: true,
        storylineKey: true,
        metadata: true,
        occurrenceCount: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.storyline.findMany({
      orderBy: [{ lastActivityAt: 'desc' }, { updatedAt: 'desc' }],
      take: queryLimit,
      select: {
        storylineId: true,
        storylineType: true,
        status: true,
        severity: true,
        entityIds: true,
        findingIds: true,
        lastActivityAt: true,
        updatedAt: true,
        statusEvents: {
          orderBy: { occurredAt: 'desc' },
          take: 1,
          select: {
            eventType: true,
          },
        },
      },
    }),
    prisma.provider.findMany({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: queryLimit,
      select: {
        npi: true,
        fullName: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const findingEvents: LiveFeedEvent[] = findingRows.map((row) => {
    const metadata = asRecord(row.metadata as Prisma.JsonValue);
    return {
      id: `dbf_finding_${row.findingId}`,
      type: 'FINDING_CREATED',
      timestamp: row.updatedAt.toISOString(),
      source: 'db_backfill',
      payload: {
        runId: typeof metadata.runId === 'string' ? metadata.runId : null,
        findingId: row.findingId,
        investigatorId: row.investigatorId,
        severity: row.severity,
        status: row.status,
        entityIds: [...row.entityIds],
        storylineKey: row.storylineKey,
        operation: findingOperationFromRow(row),
      },
    };
  });

  const providerEvents: LiveFeedEvent[] = providerRows.map((row) => ({
    id: `dbf_provider_${row.npi}`,
    type: 'PROVIDER_UPDATED',
    timestamp: (row.updatedAt.getTime() > row.createdAt.getTime() ? row.updatedAt : row.createdAt).toISOString(),
    source: 'db_backfill',
    payload: {
      providerId: `provider:${row.npi}`,
      npi: row.npi,
      providerLabel: row.fullName,
      operation: providerOperationFromRow(row),
    },
  }));

  const storylineEvents: LiveFeedEvent[] = storylineRows.map((row) => ({
    id: `dbf_storyline_${row.storylineId}`,
    type: 'STORYLINE_UPDATED',
    timestamp: (row.updatedAt.getTime() > row.lastActivityAt.getTime() ? row.updatedAt : row.lastActivityAt).toISOString(),
    source: 'db_backfill',
    payload: {
      storylineId: row.storylineId,
      storylineType: toStorylineType(row.storylineType),
      status: toStorylineStatus(row.status),
      severity: toStorylineSeverity(row.severity),
      entityIds: [...row.entityIds],
      findingIds: [...row.findingIds],
      operation: storylineOperationFromEventType(row.statusEvents[0]?.eventType),
    },
  }));

  return [...providerEvents, ...findingEvents, ...storylineEvents];
}

async function collectLiveFeedEvents(limit: number): Promise<LiveFeedEvent[]> {
  const busEvents = listRecentEvents({
    limit: 200,
    types: ['PROVIDER_UPDATED', 'FINDING_CREATED', 'STORYLINE_UPDATED'],
  })
    .filter(isLiveFeedEvent)
    .map((event) => busEventToLiveFeedEvent(event));

  const backfillEvents = busEvents.length >= limit
    ? []
    : await loadBackfillEvents(limit);

  return dedupeAndSortEvents([...busEvents, ...backfillEvents], limit);
}

function buildLiveFeedResponse(
  events: LiveFeedEvent[],
  input: {
    cached?: boolean;
    degradedReason?: LiveFeedResponse['degradedReason'];
    recoveryTriggered?: boolean;
  } = {},
): LiveFeedResponse {
  return {
    schema: 'https://vitalcv.com/feed/live/v1',
    generatedAt: new Date().toISOString(),
    total: events.length,
    cached: input.cached ?? false,
    degradedReason: input.degradedReason ?? null,
    recoveryTriggered: input.recoveryTriggered ?? false,
    events,
  };
}

function rememberSuccessfulLiveFeed(feed: LiveFeedResponse): void {
  if (feed.events.length === 0) {
    return;
  }

  lastSuccessfulLiveFeed = {
    ...feed,
    cached: false,
    degradedReason: null,
    recoveryTriggered: false,
  };
}

export function getCachedLiveFeedSnapshot(
  degradedReason: LiveFeedResponse['degradedReason'] = 'backend_failure',
): LiveFeedResponse | null {
  if (!lastSuccessfulLiveFeed) {
    return null;
  }

  return buildLiveFeedResponse(lastSuccessfulLiveFeed.events, {
    cached: true,
    degradedReason,
  });
}

export function resetLiveFeedStateForTests(): void {
  lastSuccessfulLiveFeed = null;
}

export async function buildLiveFeed(limit = 50): Promise<LiveFeedResponse> {
  const normalizedLimit = Math.min(Math.max(limit, 1), 50);
  let recoveryTriggered = false;
  let events = await collectLiveFeedEvents(normalizedLimit);

  if (events.length === 0) {
    logFeedFailure({
      layer: 'db',
      route: '/api/feed/live',
      reason: 'live_feed_empty',
      recoveryTriggered: true,
    });

    const recovery = await runIntelligenceAutoWarm('feed_live_empty');
    recoveryTriggered = recovery.triggered;
    events = await collectLiveFeedEvents(normalizedLimit);

    if (events.length === 0) {
      const cached = getCachedLiveFeedSnapshot('empty_feed');
      if (cached) {
        return {
          ...cached,
          recoveryTriggered,
        };
      }
    }
  }

  const response = buildLiveFeedResponse(events, { recoveryTriggered });
  rememberSuccessfulLiveFeed(response);
  return response;
}
