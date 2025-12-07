import { Prisma, PrismaClient } from '@prisma/client';
import type { EventType } from '../../../backend/src/services/notifications/eventBus';

const prisma = new PrismaClient();

export interface AnalyticsEventInput {
  eventType: EventType | string;
  subjectId?: string | null;
  orgId?: string | null;
  metadata?: Prisma.JsonValue | null;
  timestamp?: Date | string;
}

export interface AnalyticsEventQuery {
  eventType?: string | string[];
  orgId?: string | null;
  since?: Date;
  until?: Date;
  limit?: number;
}

function normalizeDate(timestamp?: Date | string): Date {
  if (!timestamp) {
    return new Date();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
}

export async function recordAnalyticsEvent(input: AnalyticsEventInput) {
  const payload = {
    eventType: input.eventType,
    subjectId: input.subjectId ?? null,
    orgId: input.orgId ?? null,
    metadata: input.metadata ?? null,
    timestamp: normalizeDate(input.timestamp),
  };

  return prisma.analyticsEvent.create({
    data: payload,
  });
}

export async function recordAnalyticsEvents(events: AnalyticsEventInput[]) {
  if (!events.length) {
    return [];
  }

  return prisma.$transaction(
    events.map((event) =>
      prisma.analyticsEvent.create({
        data: {
          eventType: event.eventType,
          subjectId: event.subjectId ?? null,
          orgId: event.orgId ?? null,
          metadata: event.metadata ?? null,
          timestamp: normalizeDate(event.timestamp),
        },
      })
    )
  );
}

export async function listAnalyticsEvents(query: AnalyticsEventQuery = {}) {
  const { eventType, orgId, since, until, limit = 100 } = query;

  return prisma.analyticsEvent.findMany({
    where: {
      eventType: Array.isArray(eventType)
        ? { in: eventType }
        : eventType
        ? eventType
        : undefined,
      orgId: orgId === undefined ? undefined : orgId,
      timestamp: since || until ? { gte: since, lt: until } : undefined,
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: limit,
  });
}

/**
 * B163C-AN-001: Analytics event model helpers
 *
 * Provides a thin wrapper around Prisma for recording and querying immutable
 * analytics events (eventType, subjectId, orgId, metadata, timestamp). Events
 * are later rolled up into daily summaries for the executive dashboard.
 */

import { PrismaClient, Prisma, AnalyticsEvent as AnalyticsEventRecord } from '@prisma/client';

const prisma = new PrismaClient();

export const ANALYTICS_EVENT_TYPES = [
  'ApplicationCreated',
  'PrivilegeRequested',
  'PrivilegeApproved',
  'PrivilegeDenied',
  'PayerEnrollmentSubmitted',
  'PsvCompleted',
  'PilotSmokeRun',
] as const;

export type AnalyticsEventType =
  | (typeof ANALYTICS_EVENT_TYPES)[number]
  | string;

export interface AnalyticsEventInput {
  eventType: AnalyticsEventType;
  subjectId?: string | null;
  orgId?: string | null;
  metadata?: Record<string, unknown> | Prisma.JsonValue | null;
  timestamp?: Date;
}

export interface AnalyticsEventFilters {
  eventType?: AnalyticsEventType | AnalyticsEventType[];
  orgId?: string | null;
  start?: Date;
  end?: Date;
}

/**
 * Persist a single analytics event.
 */
export async function recordAnalyticsEvent(
  input: AnalyticsEventInput
): Promise<AnalyticsEventRecord> {
  return prisma.analyticsEvent.create({
    data: {
      eventType: input.eventType,
      subjectId: input.subjectId ?? null,
      orgId: input.orgId ?? null,
      metadata: input.metadata ?? undefined,
      timestamp: input.timestamp ?? new Date(),
    },
  });
}

/**
 * Persist a batch of analytics events in a single transaction.
 */
export async function recordAnalyticsEvents(
  events: AnalyticsEventInput[]
): Promise<AnalyticsEventRecord[]> {
  if (events.length === 0) {
    return [];
  }

  const results = await prisma.$transaction(
    events.map((event) =>
      prisma.analyticsEvent.create({
        data: {
          eventType: event.eventType,
          subjectId: event.subjectId ?? null,
          orgId: event.orgId ?? null,
          metadata: event.metadata ?? undefined,
          timestamp: event.timestamp ?? new Date(),
        },
      })
    )
  );

  return results;
}

/**
 * Count analytics events that match the provided filters.
 */
export async function countAnalyticsEvents(
  filters: AnalyticsEventFilters = {}
): Promise<number> {
  return prisma.analyticsEvent.count({
    where: buildWhereClause(filters),
  });
}

/**
 * Group analytics events by orgId (null = global) and return counts.
 */
export async function countAnalyticsEventsByOrg(
  filters: AnalyticsEventFilters = {}
): Promise<Record<string, number>> {
  const groups = await prisma.analyticsEvent.groupBy({
    by: ['orgId'],
    where: buildWhereClause(filters),
    _count: {
      _all: true,
    },
  });

  return groups.reduce<Record<string, number>>((acc, group) => {
    const key = group.orgId ?? 'global';
    acc[key] = group._count._all;
    return acc;
  }, {});
}

function buildWhereClause(
  filters: AnalyticsEventFilters
): Prisma.AnalyticsEventWhereInput {
  const where: Prisma.AnalyticsEventWhereInput = {};

  if (filters.eventType) {
    if (Array.isArray(filters.eventType)) {
      where.eventType = { in: filters.eventType as string[] };
    } else {
      where.eventType = filters.eventType;
    }
  }

  if (filters.orgId !== undefined) {
    where.orgId = filters.orgId;
  }

  if (filters.start || filters.end) {
    where.timestamp = {};
    if (filters.start) {
      where.timestamp.gte = filters.start;
    }
    if (filters.end) {
      where.timestamp.lte = filters.end;
    }
  }

  return where;
}

export default {
  recordAnalyticsEvent,
  recordAnalyticsEvents,
  countAnalyticsEvents,
  countAnalyticsEventsByOrg,
};

