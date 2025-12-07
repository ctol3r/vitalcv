import {
  CredentialTimelineEventType,
  Prisma,
  PrismaClient,
  TimelineEventSeverity,
} from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger';
import { addAuditStamp, type AuditStampInput } from './addAuditStamp';
import {
  createCredentialTimelineEvent,
  type CredentialTimelineEventCreateInput,
} from './models/CredentialTimelineEvent';

const log = getServiceLogger('timeline/normalizer');
const defaultPrisma = new PrismaClient();

export interface EventBusLike {
  onEvent<TPayload = any>(
    eventType: string,
    handler: (payload: TPayload) => Promise<void> | void
  ): void;
}

export interface TimelineNormalizerOptions {
  eventBus: EventBusLike;
  prisma?: PrismaClient;
  addAuditStampFn?: (
    input: AuditStampInput
  ) => Promise<{ auditHash: string; anchorTxId?: string }>;
}

interface NormalizedTimelineEvent extends AuditStampInput {
  metadata?: Record<string, unknown>;
}

interface NPDBEventPayload {
  clinicianId: string;
  queryId: string;
  status: 'CLEAR' | 'HIT' | 'ERROR';
  adverseActionCount?: number;
  checkedAt?: string | Date;
  metadata?: Record<string, unknown>;
}

interface PecosEventPayload {
  clinicianId: string;
  enrollmentId: string;
  status: 'APPROVED' | 'PENDING' | 'DENIED';
  effectiveDate?: string | Date;
  checkedAt?: string | Date;
  metadata?: Record<string, unknown>;
}

interface LicenseEventPayload {
  clinicianId: string;
  state: string;
  licenseNumber: string;
  status: string;
  source?: string;
  checkedAt?: string | Date;
  metadata?: Record<string, unknown>;
}

interface PrivilegeGrantedPayload {
  clinicianId: string;
  privilegeGrantedId: string;
  privilegeSetName?: string;
  orgId?: string;
  grantedAt?: string | Date;
  expiresAt?: string | Date;
  severity?: TimelineEventSeverity;
  metadata?: Record<string, unknown>;
}

type DomainEventType =
  | 'NPDBQueryCompleted'
  | 'PECOSVerificationCompleted'
  | 'LicenseVerificationCompleted'
  | 'PrivilegeGranted';

type DomainEventMapper<TPayload> = (payload: TPayload) => NormalizedTimelineEvent | null;

const EVENT_MAPPERS: Record<DomainEventType, DomainEventMapper<any>> = {
  NPDBQueryCompleted: mapNpdbEvent,
  PECOSVerificationCompleted: mapPecosEvent,
  LicenseVerificationCompleted: mapLicenseEvent,
  PrivilegeGranted: mapPrivilegeEvent,
};

function ensureDate(value?: string | Date): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    return new Date(value);
  }
  return new Date();
}

function mapNpdbEvent(payload: NPDBEventPayload): NormalizedTimelineEvent | null {
  if (!payload.clinicianId) {
    return null;
  }
  const hasAdverseAction = (payload.adverseActionCount ?? 0) > 0 || payload.status === 'HIT';
  const severity =
    payload.status === 'ERROR'
      ? TimelineEventSeverity.CRITICAL
      : hasAdverseAction
        ? TimelineEventSeverity.WARNING
        : TimelineEventSeverity.INFO;

  return {
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.NPDB_QUERY,
    severity,
    timestamp: ensureDate(payload.checkedAt),
    metadata: {
      queryId: payload.queryId,
      status: payload.status,
      adverseActionCount: payload.adverseActionCount ?? 0,
      ...payload.metadata,
    },
  };
}

function mapPecosEvent(payload: PecosEventPayload): NormalizedTimelineEvent | null {
  if (!payload.clinicianId) {
    return null;
  }

  let severity = TimelineEventSeverity.INFO;
  if (payload.status === 'PENDING') {
    severity = TimelineEventSeverity.NOTICE;
  } else if (payload.status === 'DENIED') {
    severity = TimelineEventSeverity.WARNING;
  }

  return {
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.PECOS_VERIFIED,
    severity,
    timestamp: ensureDate(payload.checkedAt ?? payload.effectiveDate),
    metadata: {
      enrollmentId: payload.enrollmentId,
      status: payload.status,
      effectiveDate: payload.effectiveDate
        ? ensureDate(payload.effectiveDate).toISOString()
        : undefined,
      ...payload.metadata,
    },
  };
}

function mapLicenseEvent(payload: LicenseEventPayload): NormalizedTimelineEvent | null {
  if (!payload.clinicianId) {
    return null;
  }
  const severity =
    payload.status?.toUpperCase() === 'ACTIVE'
      ? TimelineEventSeverity.INFO
      : TimelineEventSeverity.WARNING;

  return {
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.LICENSE_VERIFIED,
    severity,
    timestamp: ensureDate(payload.checkedAt),
    metadata: {
      state: payload.state,
      licenseNumber: payload.licenseNumber,
      status: payload.status,
      source: payload.source ?? 'state_board',
      ...payload.metadata,
    },
  };
}

function mapPrivilegeEvent(payload: PrivilegeGrantedPayload): NormalizedTimelineEvent | null {
  if (!payload.clinicianId) {
    return null;
  }
  return {
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.PRIVILEGE_GRANTED,
    severity: payload.severity ?? TimelineEventSeverity.INFO,
    timestamp: ensureDate(payload.grantedAt),
    metadata: {
      privilegeGrantedId: payload.privilegeGrantedId,
      privilegeSetName: payload.privilegeSetName,
      orgId: payload.orgId,
      expiresAt: payload.expiresAt ? ensureDate(payload.expiresAt).toISOString() : undefined,
      ...payload.metadata,
    },
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta?.target.includes('CredentialTimelineEvent_auditHash_key')
  );
}

async function persistTimelineEvent(
  prisma: PrismaClient,
  normalized: NormalizedTimelineEvent,
  addAuditStampFn: TimelineNormalizerOptions['addAuditStampFn']
): Promise<void> {
  const auditor = addAuditStampFn ?? addAuditStamp;
  const { auditHash, anchorTxId } = await auditor(normalized);
  const payload: CredentialTimelineEventCreateInput = {
    clinicianId: normalized.clinicianId,
    eventType: normalized.eventType,
    severity: normalized.severity,
    timestamp: normalized.timestamp,
    metadata: normalized.metadata,
    auditHash,
    anchorTxId: anchorTxId ?? null,
  };
  await createCredentialTimelineEvent(prisma, payload);
}

export function registerTimelineNormalizers(options: TimelineNormalizerOptions): void {
  const prisma = options.prisma ?? defaultPrisma;
  const addAuditStampFn = options.addAuditStampFn ?? addAuditStamp;

  (Object.keys(EVENT_MAPPERS) as DomainEventType[]).forEach((eventType) => {
    options.eventBus.onEvent(eventType, async (payload: any) => {
      const mapper = EVENT_MAPPERS[eventType];
      const normalized = mapper(payload);
      if (!normalized) {
        log.warn(`[timeline/normalizer] Skipping ${eventType} - missing clinicianId`);
        return;
      }

      try {
        await persistTimelineEvent(prisma, normalized, addAuditStampFn);
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          log.warn(`[timeline/normalizer] Duplicate timeline event ignored for ${eventType}`);
          return;
        }
        log.error(`[timeline/normalizer] Failed to persist ${eventType}`, error);
      }
    });
  });
}

/**
 * B182A-TIMELINE-002: Normalize EventBus payloads into credential timeline events
 */

import { eventBus, type EventType, type EventPayload } from '../../backend/src/services/notifications/eventBus';
import {
  CredentialTimelineEventType,
  TimelineEventSeverity,
  type CredentialTimelineEventMetadata,
  createCredentialTimelineEvent,
} from './models/CredentialTimelineEvent';

type NormalizedTimelineEvent = {
  clinicianId: string;
  eventType: CredentialTimelineEventType;
  severity?: TimelineEventSeverity;
  timestamp?: Date;
  metadata?: CredentialTimelineEventMetadata;
};

type EventNormalizer<K extends EventType> = (payload: EventPayload<K>) => NormalizedTimelineEvent | undefined;

const normalizers: Partial<{ [K in EventType]: EventNormalizer<K> }> = {
  NPDBQueryCompleted: (payload) => ({
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.NPDB_QUERY,
    severity: payload.hasAdverseAction ? TimelineEventSeverity.CRITICAL : TimelineEventSeverity.NOTICE,
    timestamp: payload.completedAt ? new Date(payload.completedAt) : undefined,
    metadata: {
      state: payload.state,
      source: 'NPDB',
      details: {
        summary: payload.summary,
        hasAdverseAction: payload.hasAdverseAction,
      },
      ...payload.metadata,
    },
  }),
  PecosVerificationCompleted: (payload) => ({
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.PECOS_VERIFIED,
    severity:
      payload.status === 'DENIED'
        ? TimelineEventSeverity.WARNING
        : payload.status === 'PENDING'
          ? TimelineEventSeverity.NOTICE
          : TimelineEventSeverity.INFO,
    metadata: {
      source: 'PECOS',
      referenceId: payload.pecosId,
      details: {
        status: payload.status,
        cycle: payload.cycle,
        effectiveDate: payload.effectiveDate,
        ...payload.metadata,
      },
    },
  }),
  LicenseVerificationCompleted: (payload) => ({
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.LICENSE_VERIFIED,
    severity: payload.status === 'ACTIVE' ? TimelineEventSeverity.INFO : TimelineEventSeverity.WARNING,
    timestamp: payload.verifiedAt ? new Date(payload.verifiedAt) : undefined,
    metadata: {
      source: 'STATE_LICENSE',
      state: payload.state,
      licenseNumber: payload.licenseNumber,
      boardName: payload.boardName,
      details: {
        status: payload.status,
        expiresAt: payload.expiresAt,
        ...payload.metadata,
      },
    },
  }),
  PrivilegeApproved: (payload) => ({
    clinicianId: payload.clinicianDid || payload.clinicianUserId || '',
    eventType: CredentialTimelineEventType.PRIVILEGE_GRANTED,
    severity: TimelineEventSeverity.INFO,
    metadata: {
      source: 'PRIVILEGING',
      referenceId: payload.privilegeRequestId,
      details: {
        privilegeSetName: payload.privilegeSetName,
        reviewerDid: payload.reviewerDid,
      },
    },
  }),
  VcIssued: (payload) => ({
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.VC_ISSUED,
    severity: TimelineEventSeverity.INFO,
    timestamp: new Date(payload.issuedAt),
    metadata: {
      source: payload.issuer,
      referenceId: payload.credentialId,
      details: {
        credentialType: payload.credentialType,
        ...payload.metadata,
      },
    },
  }),
  CompactEligibilityUpdated: (payload) => ({
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.COMPACT_ELIGIBILITY_UPDATED,
    severity: payload.eligible ? TimelineEventSeverity.NOTICE : TimelineEventSeverity.WARNING,
    metadata: {
      source: payload.compact,
      state: payload.state,
      details: {
        eligible: payload.eligible,
        reason: payload.reason,
        ...payload.metadata,
      },
    },
  }),
  FppeStarted: (payload) => ({
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.FPPE_STARTED,
    severity: TimelineEventSeverity.NOTICE,
    timestamp: new Date(payload.startedAt),
    metadata: {
      referenceId: payload.fppeCaseId,
      details: {
        privilegeGrantedId: payload.privilegeGrantedId,
        specialty: payload.specialty,
        ...payload.metadata,
      },
    },
  }),
  FppeCompleted: (payload) => ({
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.FPPE_COMPLETED,
    severity: payload.outcome === 'PASS' ? TimelineEventSeverity.INFO : TimelineEventSeverity.WARNING,
    timestamp: new Date(payload.completedAt),
    metadata: {
      referenceId: payload.fppeCaseId,
      details: {
        privilegeGrantedId: payload.privilegeGrantedId,
        outcome: payload.outcome,
        ...payload.metadata,
      },
    },
  }),
  DiscrepancyFound: (payload) => ({
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.DISCREPANCY_FOUND,
    severity:
      payload.severity === 'CRITICAL'
        ? TimelineEventSeverity.CRITICAL
        : payload.severity === 'WARNING'
          ? TimelineEventSeverity.WARNING
          : TimelineEventSeverity.INFO,
    timestamp: payload.detectedAt ? new Date(payload.detectedAt) : undefined,
    metadata: {
      source: payload.source,
      discrepancyId: payload.description,
      details: {
        description: payload.description,
        ...payload.metadata,
      },
    },
  }),
  RevalidationTaskCreated: (payload) => ({
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.REVALIDATION_CREATED,
    severity: TimelineEventSeverity.NOTICE,
    timestamp: new Date(payload.dueDate),
    metadata: {
      referenceId: payload.taskId,
      details: {
        taskType: payload.taskType,
        ...payload.metadata,
      },
    },
  }),
};

async function persistNormalizedEvent(normalized: NormalizedTimelineEvent | undefined, source: EventType) {
  if (!normalized) {
    return;
  }
  if (!normalized.clinicianId) {
    console.warn(`[TimelineNormalizer] Skipping ${source} due to missing clinicianId`);
    return;
  }
  try {
    await createCredentialTimelineEvent({
      clinicianId: normalized.clinicianId,
      eventType: normalized.eventType,
      severity: normalized.severity ?? TimelineEventSeverity.INFO,
      timestamp: normalized.timestamp ?? new Date(),
      metadata: normalized.metadata,
    });
  } catch (error) {
    console.error(`[TimelineNormalizer] Failed to persist ${source}`, error);
  }
}

(Object.keys(normalizers) as EventType[]).forEach((eventType) => {
  const mapper = normalizers[eventType] as EventNormalizer<EventType> | undefined;
  if (!mapper) {
    return;
  }

  eventBus.onEvent(eventType, async (payload) => {
    const normalized = mapper(payload as EventPayload<EventType>);
    await persistNormalizedEvent(normalized, eventType);
  });
});

export function normalizeTimelineEvent<K extends EventType>(
  eventType: K,
  payload: EventPayload<K>
): NormalizedTimelineEvent | undefined {
  const mapper = normalizers[eventType];
  return mapper ? mapper(payload) : undefined;
}


