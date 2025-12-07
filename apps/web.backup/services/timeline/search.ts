import {
  type CredentialTimelineEvent,
  type CredentialTimelineEventType,
  PrismaClient,
  TimelineEventSeverity,
} from '@prisma/client';
import { SortDirection } from './types';

export interface TimelineEventSearchFilters {
  clinicianId: string;
  from?: Date;
  to?: Date;
  eventTypes?: CredentialTimelineEventType[];
  severity?: TimelineEventSeverity | TimelineEventSeverity[];
  sortDirection?: SortDirection;
  limit?: number;
  cursorId?: string;
}

function normalizeSeverityFilter(
  severity?: TimelineEventSeverity | TimelineEventSeverity[]
): TimelineEventSeverity[] | undefined {
  if (!severity) {
    return undefined;
  }
  return Array.isArray(severity) ? severity : [severity];
}

export async function searchTimelineEvents(
  prisma: PrismaClient,
  filters: TimelineEventSearchFilters
): Promise<CredentialTimelineEvent[]> {
  const severityFilter = normalizeSeverityFilter(filters.severity);

  return prisma.credentialTimelineEvent.findMany({
    where: {
      clinicianId: filters.clinicianId,
      ...(filters.from || filters.to
        ? {
            timestamp: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
      ...(filters.eventTypes?.length ? { eventType: { in: filters.eventTypes } } : {}),
      ...(severityFilter?.length ? { severity: { in: severityFilter } } : {}),
    },
    orderBy: {
      timestamp: filters.sortDirection === 'asc' ? 'asc' : 'desc',
    },
    ...(filters.limit ? { take: filters.limit } : {}),
    ...(filters.cursorId
      ? {
          cursor: { id: filters.cursorId },
          skip: 1,
        }
      : {}),
  });
}
/**
 * B182A-TIMELINE-004: Timeline search interface
 */

import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import {
  CredentialTimelineEventType,
  TimelineEventSeverity,
  type CredentialTimelineEvent,
} from './models/CredentialTimelineEvent';

const prisma = new PrismaClient();

export interface TimelineEventSearchFilters {
  clinicianId: string;
  from?: Date;
  to?: Date;
  eventTypes?: CredentialTimelineEventType[] | CredentialTimelineEventType;
  severity?: TimelineEventSeverity | TimelineEventSeverity[];
  limit?: number;
}

function buildWhere(filters: TimelineEventSearchFilters): Prisma.CredentialTimelineEventWhereInput {
  const eventTypes = Array.isArray(filters.eventTypes)
    ? filters.eventTypes
    : filters.eventTypes
      ? [filters.eventTypes]
      : undefined;
  const severity = Array.isArray(filters.severity)
    ? filters.severity
    : filters.severity
      ? [filters.severity]
      : undefined;

  const timestamp: Prisma.DateTimeFilter = {};
  if (filters.from) {
    timestamp.gte = filters.from;
  }
  if (filters.to) {
    timestamp.lte = filters.to;
  }

  return {
    clinicianId: filters.clinicianId,
    ...(eventTypes ? { eventType: { in: eventTypes } } : {}),
    ...(severity ? { severity: { in: severity } } : {}),
    ...(filters.from || filters.to ? { timestamp } : {}),
  };
}

export async function searchTimelineEvents(
  filters: TimelineEventSearchFilters
): Promise<CredentialTimelineEvent[]> {
  if (!filters.clinicianId) {
    throw new Error('clinicianId is required for timeline search');
  }

  return prisma.credentialTimelineEvent.findMany({
    where: buildWhere(filters),
    orderBy: [
      { timestamp: 'desc' },
      { createdAt: 'desc' },
    ],
    take: filters.limit ?? 100,
  });
}


