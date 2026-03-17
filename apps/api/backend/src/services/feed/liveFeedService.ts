import type { Prisma } from '@prisma/client';
import type { EventEnvelope, VitalEvent } from '../../core/events/eventBus';
import { listRecentEvents } from '../../core/events/eventBus';
import prisma from '../../graphql/prisma_client';
import { syncPersistedStorylines } from '../storylines/storylineService';

export type LiveFeedEvent =
  | (EventEnvelope<'FINDING_CREATED'> & { source: 'event_bus' | 'db_backfill' })
  | (EventEnvelope<'STORYLINE_UPDATED'> & { source: 'event_bus' | 'db_backfill' });

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function timestampValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareByTimestampDesc<TEvent extends { id: string; timestamp: string }>(left: TEvent, right: TEvent): number {
  return timestampValue(right.timestamp) - timestampValue(left.timestamp) || right.id.localeCompare(left.id);
}

function isLiveFeedEvent(
  event: VitalEvent,
): event is EventEnvelope<'FINDING_CREATED'> | EventEnvelope<'STORYLINE_UPDATED'> {
  return event.type === 'FINDING_CREATED' || event.type === 'STORYLINE_UPDATED';
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
  return event.type === 'FINDING_CREATED'
    ? `finding:${event.payload.findingId}:${event.payload.operation}`
    : `storyline:${event.payload.storylineId}:${event.payload.operation}`;
}

function dedupeAndSortEvents(events: LiveFeedEvent[], limit: number): LiveFeedEvent[] {
  const sorted = [...events].sort(compareByTimestampDesc);
  const deduped = new Map<string, LiveFeedEvent>();

  for (const event of sorted) {
    const key = liveFeedKey(event);
    if (!deduped.has(key)) {
      deduped.set(key, event);
    }
  }

  return [...deduped.values()].sort(compareByTimestampDesc).slice(0, limit);
}

function busEventToLiveFeedEvent(
  event: EventEnvelope<'FINDING_CREATED'> | EventEnvelope<'STORYLINE_UPDATED'>,
): LiveFeedEvent {
  return {
    ...event,
    source: 'event_bus',
  };
}

async function loadBackfillEvents(limit: number): Promise<LiveFeedEvent[]> {
  const queryLimit = Math.max(limit, 50);
  await syncPersistedStorylines();

  const [findingRows, storylineRows] = await Promise.all([
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

  return [...findingEvents, ...storylineEvents];
}

export async function buildLiveFeed(limit = 50): Promise<{
  schema: string;
  generatedAt: string;
  total: number;
  events: LiveFeedEvent[];
}> {
  const normalizedLimit = Math.min(Math.max(limit, 1), 50);
  const busEvents = listRecentEvents({
    limit: 200,
    types: ['FINDING_CREATED', 'STORYLINE_UPDATED'],
  })
    .filter(isLiveFeedEvent)
    .map((event) => busEventToLiveFeedEvent(event));

  const backfillEvents = busEvents.length >= normalizedLimit
    ? []
    : await loadBackfillEvents(normalizedLimit);

  const events = dedupeAndSortEvents([...busEvents, ...backfillEvents], normalizedLimit);

  return {
    schema: 'https://vitalcv.com/feed/live/v1',
    generatedAt: new Date().toISOString(),
    total: events.length,
    events,
  };
}
