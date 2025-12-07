import crypto from 'node:crypto';
import {
  CredentialTimelineEventType,
  PrismaClient,
  TimelineEventSeverity,
} from '@prisma/client';
import type { SafetySignalSeverity } from '../safety/models/PrivilegeSafetySignal.js';

const prisma = new PrismaClient();

export interface SafetyTimelineInput {
  signalId: string;
  clinicianId: string;
  orgId?: string;
  privilegeCodes: string[];
  severity: SafetySignalSeverity;
  summary: string;
  detectedAt: Date;
  source?: string;
  metadata?: Record<string, unknown>;
}

function mapSafetySeverityToTimeline(severity: SafetySignalSeverity): TimelineEventSeverity {
  switch (severity) {
    case 'CRITICAL':
      return TimelineEventSeverity.CRITICAL;
    case 'HIGH':
      return TimelineEventSeverity.WARNING;
    case 'MED':
      return TimelineEventSeverity.NOTICE;
    default:
      return TimelineEventSeverity.INFO;
  }
}

function buildAuditHash(payload: SafetyTimelineInput): string {
  return crypto
    .createHash('sha256')
    .update(
      [
        payload.signalId,
        payload.clinicianId,
        payload.privilegeCodes.join(','),
        payload.severity,
        payload.detectedAt.toISOString(),
      ].join(':')
    )
    .digest('hex');
}

export async function recordSafetySignalTimelineEvent(input: SafetyTimelineInput) {
  const auditHash = buildAuditHash(input);
  await prisma.credentialTimelineEvent.create({
    data: {
      clinicianId: input.clinicianId,
      eventType: CredentialTimelineEventType.PRIVILEGE_SAFETY_RESTRICTION,
      severity: mapSafetySeverityToTimeline(input.severity),
      timestamp: input.detectedAt,
      metadata: {
        signalId: input.signalId,
        orgId: input.orgId,
        privilegeCodes: input.privilegeCodes,
        source: input.source,
        ...input.metadata,
      },
      auditHash,
    },
  });
}

