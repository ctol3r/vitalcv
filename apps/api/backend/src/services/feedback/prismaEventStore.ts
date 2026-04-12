/**
 * prismaEventStore.ts — Persistent EventStore backed by the LearningEvent Prisma model.
 *
 * Bridges the in-memory EventStore interface from feedbackLearningService.ts
 * to PostgreSQL via the existing LearningEvent table.
 */

import prisma from '../../graphql/prisma_client';
import { sha256ForPayload } from '../../utils/deterministic';
import { log } from '../../obs/logger';

// Type stubs to unbreak missing module
export interface Event {
  id: string;
  type: string;
  timestamp: Date;
  providerId: string;
  payload: any;
  jobId?: string;
  employerId?: string;
  sourceId?: string;
  relatedId?: string;
  metadata?: any;
}
export interface TrackEventInput {
  type: string;
  providerId: string;
  payload: any;
  jobId?: string;
  employerId?: string;
  timestamp?: Date;
  metadata?: any;
}
export interface EventStore {
  append(event: Event): void;
  getById?(id: string): Event | null;
  list?(): Event[];
  listByProvider(providerId: string): Promise<Event[]>;
  listByJob(jobId: string): Promise<Event[]>;
  listByEmployer(employerId: string): Promise<Event[]>;
  listByType(eventType: string, limit?: number): Promise<Event[]>;
}

const LOOP_TYPE = 'USAGE_TRACKING';
const SUBJECT_TYPE = 'provider';

function toPrismaData(event: Event) {
  return {
    id: event.id,
    dedupeKey: event.id,
    eventType: event.type,
    loopType: LOOP_TYPE,
    subjectType: SUBJECT_TYPE,
    subjectId: event.providerId,
    sourceId: event.employerId || null,
    relatedId: event.jobId || null,
    status: 'RECORDED',
    metadata: event.metadata as Record<string, unknown>,
    occurredAt: new Date(event.timestamp),
  };
}

function fromPrismaRow(row: {
  id: string;
  eventType: string;
  subjectId: string;
  sourceId: string | null;
  relatedId: string | null;
  metadata: unknown;
  occurredAt: Date;
}): Event {
  const meta = (typeof row.metadata === 'object' && row.metadata !== null)
    ? row.metadata as Record<string, unknown>
    : {};
  return {
    id: row.id,
    type: row.eventType,
    timestamp: row.occurredAt,
    providerId: row.subjectId,
    jobId: row.relatedId ?? '',
    employerId: row.sourceId ?? '',
    metadata: meta,
    payload: meta,
  };
}

export function buildEventId(input: Omit<Event, 'id'>): string {
  return `evt_${sha256ForPayload(input).slice(0, 24)}`;
}

export function createPrismaEventStore(): EventStore & {
  listByProvider(providerId: string): Promise<Event[]>;
  listByJob(jobId: string): Promise<Event[]>;
  listByEmployer(employerId: string): Promise<Event[]>;
  listByType(eventType: string, limit?: number): Promise<Event[]>;
} {
  return {
    append(event: Event): void {
      // Fire-and-forget write to database
      void prisma.learningEvent
        .upsert({
          where: { dedupeKey: event.id },
          create: {
            ...toPrismaData(event),
            metadata: toPrismaData(event).metadata as any,
          },
          update: {},
        })
        .catch((error: unknown) => {
          log('warn', 'learning_event_persist_failed', {
            eventId: event.id,
            eventType: event.type,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    },

    getById(id: string): Event | null {
      // Synchronous interface — return null for Prisma-backed store.
      // Use async queries for lookups.
      return null;
    },

    list(): Event[] {
      // Synchronous interface — return empty for Prisma-backed store.
      // Use listByProvider/listByJob/listByEmployer for queries.
      return [];
    },

    async listByProvider(providerId: string): Promise<Event[]> {
      const rows = await prisma.learningEvent.findMany({
        where: { subjectType: SUBJECT_TYPE, subjectId: providerId, loopType: LOOP_TYPE },
        orderBy: { occurredAt: 'asc' },
        take: 1000,
      });
      return rows.map(fromPrismaRow);
    },

    async listByJob(jobId: string): Promise<Event[]> {
      const rows = await prisma.learningEvent.findMany({
        where: { relatedId: jobId, loopType: LOOP_TYPE },
        orderBy: { occurredAt: 'asc' },
        take: 1000,
      });
      return rows.map(fromPrismaRow);
    },

    async listByEmployer(employerId: string): Promise<Event[]> {
      const rows = await prisma.learningEvent.findMany({
        where: { sourceId: employerId, loopType: LOOP_TYPE },
        orderBy: { occurredAt: 'asc' },
        take: 1000,
      });
      return rows.map(fromPrismaRow);
    },

    async listByType(eventType: string, limit = 500): Promise<Event[]> {
      const rows = await prisma.learningEvent.findMany({
        where: { eventType, loopType: LOOP_TYPE },
        orderBy: { occurredAt: 'desc' },
        take: limit,
      });
      return rows.map(fromPrismaRow);
    },
  };
}

/**
 * Emit a learning event to the persistent store. Fire-and-forget.
 * This is the primary entry point for all tracking across the backend.
 */
export function emitLearningEvent(input: TrackEventInput): Event {
  const store = createPrismaEventStore();
  const timestamp = input.timestamp instanceof Date
    ? input.timestamp
    : (input.timestamp ? new Date(input.timestamp) : new Date());

  const normalized: Omit<Event, 'id'> = {
    type: input.type,
    timestamp,
    providerId: input.providerId,
    jobId: input.jobId,
    employerId: input.employerId,
    metadata: input.metadata ?? {},
    payload: input.payload || {},
  };

  const event: Event = {
    ...normalized,
    id: buildEventId(normalized),
  };

  store.append(event);
  return event;
}

/** Singleton store instance for use in analytics queries. */
let _store: ReturnType<typeof createPrismaEventStore> | null = null;
export function getPrismaEventStore(): ReturnType<typeof createPrismaEventStore> {
  if (!_store) {
    _store = createPrismaEventStore();
  }
  return _store;
}
