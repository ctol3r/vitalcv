import { CredentialTimelineEventType, PrismaClient, TimelineEventSeverity } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface BaseEventOptions {
  clinicianId: string;
  orgId: string;
  privilegeSetId?: string;
  privilegeGrantedId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export async function recordPrivilegeSyncedEvent(options: BaseEventOptions) {
  return createTimelineEvent(CredentialTimelineEventType.PRIVILEGE_SYNCED, 'INFO', {
    ...options,
  });
}

export async function recordPrivilegeSyncFailureEvent(options: BaseEventOptions & { error?: string }) {
  const metadata = {
    ...options.metadata,
    error: options.error,
  };
  return createTimelineEvent(CredentialTimelineEventType.PRIVILEGE_SYNC_FAILED, 'WARNING', {
    ...options,
    metadata,
  });
}

export async function recordEhrMismatchDetectedEvent(
  options: BaseEventOptions & {
    mismatch?: {
      missing?: string[];
      unexpected?: string[];
    };
  }
) {
  const metadata = {
    ...options.metadata,
    mismatch: options.mismatch,
  };
  return createTimelineEvent(CredentialTimelineEventType.EHR_MISMATCH_DETECTED, 'CRITICAL', {
    ...options,
    metadata,
  });
}

async function createTimelineEvent(
  eventType: CredentialTimelineEventType,
  severity: TimelineEventSeverity,
  options: BaseEventOptions
) {
  const { clinicianId, privilegeSetId, privilegeGrantedId, orgId, metadata, timestamp } = options;
  const auditHash = crypto
    .createHash('sha256')
    .update(
      [
        eventType,
        clinicianId,
        privilegeSetId ?? 'none',
        privilegeGrantedId ?? 'none',
        (timestamp ?? new Date()).toISOString(),
        Math.random().toString(36),
      ].join(':')
    )
    .digest('hex');

  return prisma.credentialTimelineEvent.create({
    data: {
      clinicianId,
      eventType,
      severity,
      timestamp: timestamp ?? new Date(),
      metadata: {
        orgId,
        privilegeSetId,
        privilegeGrantedId,
        ...metadata,
      },
      auditHash,
    },
  });
}
