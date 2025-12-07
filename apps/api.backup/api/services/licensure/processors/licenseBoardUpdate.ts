import {
  CredentialTimelineEventType,
  LicenseVerificationStatus,
  PrismaClient,
  TimelineEventSeverity,
} from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent.js';
import { mergeCredentialRisk } from '../../credentialRisk/riskService.js';
import { CredentialRiskFactors } from '../../credentialRisk/enums.js';

const prisma = new PrismaClient();
const log = getServiceLogger('licensure/processors/licenseBoardUpdate');

export interface LicenseBoardUpdatePayload {
  clinicianId: string;
  state: string;
  licenseNumber: string;
  status: LicenseVerificationStatus | string;
  issueDate?: string | Date;
  expiryDate?: string | Date;
  disciplinaryFlag?: boolean;
  restrictions?: Record<string, unknown>;
  disciplinaryHistory?: Record<string, unknown>;
  sourceMetadata?: Record<string, unknown>;
  evidenceUrl?: string;
  checkedAt?: string | Date;
}

function assertPayload(payload: LicenseBoardUpdatePayload) {
  if (!payload.clinicianId) {
    throw new Error('clinicianId is required');
  }
  if (!payload.state) {
    throw new Error('state is required');
  }
  if (!payload.licenseNumber) {
    throw new Error('licenseNumber is required');
  }
}

function normalizeStatus(status: LicenseVerificationStatus | string): LicenseVerificationStatus {
  if (typeof status !== 'string') {
    return status;
  }
  const normalized = status.toUpperCase();
  const allowed = Object.values(LicenseVerificationStatus);
  const match = allowed.find((entry) => entry.toUpperCase() === normalized);
  if (!match) {
    log.warn('[licenseBoardUpdate] unknown status, defaulting to INACTIVE', { status });
    return LicenseVerificationStatus.INACTIVE;
  }
  return match as LicenseVerificationStatus;
}

function toDate(value?: string | Date): Date | undefined {
  if (!value) {
    return undefined;
  }
  return value instanceof Date ? value : new Date(value);
}

function severityForStatus(status: LicenseVerificationStatus, disciplinary: boolean): TimelineEventSeverity {
  if (status === LicenseVerificationStatus.SUSPENDED || status === LicenseVerificationStatus.REVOKED) {
    return TimelineEventSeverity.CRITICAL;
  }
  if (disciplinary || status === LicenseVerificationStatus.EXPIRED || status === LicenseVerificationStatus.INACTIVE) {
    return TimelineEventSeverity.WARNING;
  }
  return TimelineEventSeverity.INFO;
}

export async function processLicenseBoardUpdate(payload: LicenseBoardUpdatePayload) {
  assertPayload(payload);
  const status = normalizeStatus(payload.status);
  const issueDate = toDate(payload.issueDate) ?? null;
  const expiryDate = toDate(payload.expiryDate) ?? null;
  const checkedAt = toDate(payload.checkedAt) ?? new Date();

  const uniqueKey = {
    clinicianId_state_licenseNumber: {
      clinicianId: payload.clinicianId,
      state: payload.state.toUpperCase(),
      licenseNumber: payload.licenseNumber.trim(),
    },
  } as const;

  const existing = await prisma.stateLicenseVerification.findUnique({ where: uniqueKey });

  const record = await prisma.stateLicenseVerification.upsert({
    where: uniqueKey,
    create: {
      clinicianId: payload.clinicianId,
      state: uniqueKey.clinicianId_state_licenseNumber.state,
      licenseNumber: uniqueKey.clinicianId_state_licenseNumber.licenseNumber,
      status,
      issueDate,
      expiryDate,
      disciplinaryFlag: payload.disciplinaryFlag ?? false,
      restrictions: payload.restrictions ?? null,
      disciplinaryHistory: payload.disciplinaryHistory ?? null,
      sourceMetadata: {
        ...(payload.sourceMetadata ?? {}),
        evidenceUrl: payload.evidenceUrl,
      },
      lastCheckedAt: checkedAt,
    },
    update: {
      status,
      issueDate,
      expiryDate,
      disciplinaryFlag: payload.disciplinaryFlag ?? undefined,
      restrictions: payload.restrictions ?? undefined,
      disciplinaryHistory: payload.disciplinaryHistory ?? undefined,
      sourceMetadata: {
        ...(existing?.sourceMetadata as Record<string, unknown> | undefined),
        ...(payload.sourceMetadata ?? {}),
        evidenceUrl: payload.evidenceUrl,
      },
      lastCheckedAt: checkedAt,
    },
  });

  const severity = severityForStatus(status, payload.disciplinaryFlag ?? false);
  await logCredentialTimelineEvent({
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.LICENSE_VERIFIED,
    severity,
    metadata: {
      licenseNumber: record.licenseNumber,
      state: record.state,
      status: record.status,
      expiryDate: record.expiryDate?.toISOString(),
      disciplinaryFlag: record.disciplinaryFlag,
    },
  });

  if (payload.disciplinaryFlag || status !== LicenseVerificationStatus.ACTIVE) {
    await mergeCredentialRisk(payload.clinicianId, {
      add: [CredentialRiskFactors.LICENSE_DISCIPLINARY],
    });
    if (status === LicenseVerificationStatus.EXPIRED || status === LicenseVerificationStatus.REVOKED) {
      await mergeCredentialRisk(payload.clinicianId, {
        add: [CredentialRiskFactors.LICENSE_EXPIRED],
      });
    }
  } else {
    await mergeCredentialRisk(payload.clinicianId, {
      remove: [CredentialRiskFactors.LICENSE_DISCIPLINARY, CredentialRiskFactors.LICENSE_EXPIRED],
    });
  }

  return record;
}
