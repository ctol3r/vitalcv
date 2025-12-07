/**
 * B182A-TIMELINE-001: Credential timeline event model helpers
 *
 * Provides typed helpers for creating and querying `CredentialTimelineEvent`
 * records via Prisma. These helpers keep metadata serialization consistent
 * across services that persist timeline activity.
 */

import {
  type CredentialTimelineEvent,
  type CredentialTimelineEventType,
  Prisma,
  PrismaClient,
  TimelineEventSeverity,
} from '@prisma/client';

const EVENT_TYPE_VALUES: CredentialTimelineEventType[] = [
  'VC_ISSUED',
  'LICENSE_VERIFIED',
  'BOARD_VERIFIED',
  'DEA_VERIFIED',
  'PECOS_VERIFIED',
  'NPDB_QUERY',
  'PRIVILEGE_GRANTED',
  'FPPE_STARTED',
  'FPPE_COMPLETED',
  'OPPE_CYCLE',
  'REVALIDATION_CREATED',
  'COMPACT_ELIGIBILITY_UPDATED',
  'DISCREPANCY_FOUND',
] as const;

export const CREDENTIAL_TIMELINE_EVENT_TYPES = Object.freeze(EVENT_TYPE_VALUES);

export interface CredentialTimelineEventCreateInput {
  clinicianId: string;
  eventType: CredentialTimelineEventType;
  severity?: TimelineEventSeverity;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
  auditHash: string;
  anchorTxId?: string | null;
}

export interface TimelineEventListFilters {
  clinicianId: string;
  from?: Date;
  to?: Date;
  eventTypes?: CredentialTimelineEventType[];
  severity?: TimelineEventSeverity | TimelineEventSeverity[];
  limit?: number;
  sortDirection?: 'asc' | 'desc';
}

function serializeMetadata(metadata?: Record<string, unknown>): Prisma.JsonValue | undefined {
  if (!metadata) {
    return undefined;
  }
  // JSON stringify/parse to remove undefined values and ensure POJO
  return JSON.parse(JSON.stringify(metadata));
}

/**
 * Create a single credential timeline event.
 */
export async function createCredentialTimelineEvent(
  prisma: PrismaClient,
  input: CredentialTimelineEventCreateInput
): Promise<CredentialTimelineEvent> {
  if (!EVENT_TYPE_VALUES.includes(input.eventType)) {
    throw new Error(`Unsupported credential timeline event type: ${input.eventType}`);
  }

  return prisma.credentialTimelineEvent.create({
    data: {
      clinicianId: input.clinicianId,
      eventType: input.eventType,
      severity: input.severity ?? TimelineEventSeverity.INFO,
      timestamp: input.timestamp ?? new Date(),
      metadata: serializeMetadata(input.metadata),
      auditHash: input.auditHash,
      anchorTxId: input.anchorTxId ?? null,
    },
  });
}

/**
 * Locate a timeline event by its audit hash (unique constraint).
 */
export async function findTimelineEventByAuditHash(
  prisma: PrismaClient,
  auditHash: string
): Promise<CredentialTimelineEvent | null> {
  return prisma.credentialTimelineEvent.findUnique({
    where: { auditHash },
  });
}

/**
 * Fetch events for a clinician with optional filters.
 */
export async function listTimelineEventsForClinician(
  prisma: PrismaClient,
  filters: TimelineEventListFilters
): Promise<CredentialTimelineEvent[]> {
  const severityFilter = filters.severity
    ? Array.isArray(filters.severity)
      ? filters.severity
      : [filters.severity]
    : undefined;

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
  });
}

/**
 * B182A-TIMELINE-001: Credential timeline event model + validation
 */

import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { addAuditStamp, type AddAuditStampOptions } from '../addAuditStamp';

const prisma = new PrismaClient();

export enum CredentialTimelineEventType {
  VC_ISSUED = 'VC_ISSUED',
  LICENSE_VERIFIED = 'LICENSE_VERIFIED',
  BOARD_VERIFIED = 'BOARD_VERIFIED',
  DEA_VERIFIED = 'DEA_VERIFIED',
  PECOS_VERIFIED = 'PECOS_VERIFIED',
  NPDB_QUERY = 'NPDB_QUERY',
  PRIVILEGE_GRANTED = 'PRIVILEGE_GRANTED',
  FPPE_STARTED = 'FPPE_STARTED',
  FPPE_COMPLETED = 'FPPE_COMPLETED',
  OPPE_CYCLE = 'OPPE_CYCLE',
  REVALIDATION_CREATED = 'REVALIDATION_CREATED',
  COMPACT_ELIGIBILITY_UPDATED = 'COMPACT_ELIGIBILITY_UPDATED',
  DISCREPANCY_FOUND = 'DISCREPANCY_FOUND',
}

export enum TimelineEventSeverity {
  INFO = 'INFO',
  NOTICE = 'NOTICE',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export interface CredentialTimelineEventMetadata {
  source?: string;
  actor?: string;
  state?: string;
  licenseNumber?: string;
  boardName?: string;
  discrepancyId?: string;
  referenceId?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

const MetadataSchema: z.ZodType<CredentialTimelineEventMetadata> = z
  .object({
    source: z.string().min(1).optional(),
    actor: z.string().min(1).optional(),
    state: z.string().min(2).optional(),
    licenseNumber: z.string().optional(),
    boardName: z.string().optional(),
    discrepancyId: z.string().optional(),
    referenceId: z.string().optional(),
    details: z.record(z.any()).optional(),
  })
  .catchall(z.any());

export const CreateCredentialTimelineEventSchema = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  eventType: z.nativeEnum(CredentialTimelineEventType),
  timestamp: z.date().default(() => new Date()),
  severity: z.nativeEnum(TimelineEventSeverity).default(TimelineEventSeverity.INFO),
  metadata: MetadataSchema.optional(),
});

export type CreateCredentialTimelineEventInput = z.infer<typeof CreateCredentialTimelineEventSchema>;

export type CredentialTimelineEvent = Prisma.CredentialTimelineEvent;

function toJson(metadata?: CredentialTimelineEventMetadata): Prisma.InputJsonValue | undefined {
  if (!metadata) return undefined;
  return metadata as Prisma.InputJsonValue;
}

export async function createCredentialTimelineEvent(
  input: CreateCredentialTimelineEventInput,
  options?: AddAuditStampOptions
): Promise<CredentialTimelineEvent> {
  const parsed = CreateCredentialTimelineEventSchema.parse(input);
  const { auditHash, anchorTxId } = await addAuditStamp(
    {
      clinicianId: parsed.clinicianId,
      eventType: parsed.eventType,
      severity: parsed.severity,
      timestamp: parsed.timestamp,
      metadata: parsed.metadata,
    },
    options
  );

  return prisma.credentialTimelineEvent.create({
    data: {
      clinicianId: parsed.clinicianId,
      eventType: parsed.eventType,
      severity: parsed.severity,
      timestamp: parsed.timestamp,
      metadata: toJson(parsed.metadata),
      auditHash,
      anchorTxId,
    },
  });
}


