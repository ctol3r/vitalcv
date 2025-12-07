import {
  Prisma,
  CredentialTimelineEventType,
  PecosLifecycleHistory,
  PecosLifecycleHistorySchema,
  PecosProviderStatus,
  PecosEnrollmentType,
  PrismaClient,
  TimelineEventSeverity,
} from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { toDate as toOptionalDate } from '../models/PECOSProvider.js';
import { runPecosStatusEngine } from '../statusEngine.js';
import {
  detectPecosDiscrepancies,
  DiscrepancyContext,
  PracticeLocation,
} from '../detectDiscrepancies.js';
import { mergeCredentialRisk } from '../../credentialRisk/riskService.js';
import { CredentialRiskFactors } from '../../credentialRisk/enums.js';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent.js';
import { createNotification } from '../../notifications/notificationService.js';
import {
  RevalidationTaskStatus,
  RevalidationTaskType,
} from '../../revalidation/models/RevalidationTask.js';
import { upsertRevalidationTask } from '../../revalidation/revalidationTaskService.js';
import { resolveClinicianContext } from '../../common/clinicianContext.js';

const prisma = new PrismaClient();
const log = getServiceLogger('pecos/processors/pecosUpdate');

export interface PecosDocumentInput {
  documentType: string;
  submittedAt?: string | Date | null;
  parsedFields?: Record<string, unknown>;
}

export interface PecosUpdatePayload {
  clinicianId: string;
  clinicianDid?: string;
  enrollmentType: PecosEnrollmentType | string;
  providerStatus: PecosProviderStatus | string;
  npi: string;
  medicareId?: string;
  effectiveDate?: string | Date | null;
  revalidationDate?: string | Date | null;
  lastCheckedAt?: string | Date | null;
  specialties?: string[];
  practiceLocations?: PracticeLocation[];
  documents?: PecosDocumentInput[];
  discrepancyContext?: DiscrepancyContext;
  metadata?: Record<string, unknown>;
  notificationUserId?: string;
}

function normalizeEnrollmentType(value: PecosEnrollmentType | string): PecosEnrollmentType {
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.toUpperCase();
  const match = Object.values(PecosEnrollmentType).find((entry) => entry === normalized);
  if (!match) {
    throw new Error(`Unsupported PECOS enrollment type: ${value}`);
  }
  return match as PecosEnrollmentType;
}

function normalizeProviderStatus(value: PecosProviderStatus | string): PecosProviderStatus {
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.toUpperCase();
  const match = Object.values(PecosProviderStatus).find((entry) => entry === normalized);
  if (!match) {
    throw new Error(`Unsupported PECOS provider status: ${value}`);
  }
  return match as PecosProviderStatus;
}
function toJson(value?: Record<string, unknown> | null): Prisma.InputJsonValue | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return value as Prisma.InputJsonValue;
}


function parseLifecycleHistory(raw: unknown): PecosLifecycleHistory {
  if (!raw) {
    return [];
  }
  try {
    return PecosLifecycleHistorySchema.parse(raw);
  } catch (error) {
    log.warn('[pecosUpdate] Failed to parse lifecycle history', { error });
    return [];
  }
}

function serializeLifecycleHistory(history: PecosLifecycleHistory) {
  return history.map((event) => ({
    ...event,
    occurredAt: event.occurredAt instanceof Date ? event.occurredAt.toISOString() : event.occurredAt,
  }));
}

function severityForPecosStatus(
  status: PecosProviderStatus,
  hasDiscrepancies: boolean,
  anomalies: number
): TimelineEventSeverity {
  if (status === PecosProviderStatus.DEACTIVATED || status === PecosProviderStatus.REJECTED) {
    return TimelineEventSeverity.CRITICAL;
  }
  if (hasDiscrepancies || anomalies > 0) {
    return TimelineEventSeverity.WARNING;
  }
  if (status === PecosProviderStatus.PENDING) {
    return TimelineEventSeverity.NOTICE;
  }
  return TimelineEventSeverity.INFO;
}

async function upsertDocuments(providerId: string, documents: PecosDocumentInput[] = []) {
  for (const doc of documents) {
    if (!doc.documentType) {
      continue;
    }
    await prisma.pECOSDocument.upsert({
      where: {
        providerId_documentType: {
          providerId,
          documentType: doc.documentType,
        },
      },
      create: {
        providerId,
        documentType: doc.documentType,
        submittedAt: doc.submittedAt ? new Date(doc.submittedAt) : null,
        parsedFields: doc.parsedFields ? (doc.parsedFields as Prisma.InputJsonValue) : null,
      },
      update: {
        submittedAt: doc.submittedAt ? new Date(doc.submittedAt) : null,
        parsedFields: doc.parsedFields ? (doc.parsedFields as Prisma.InputJsonValue) : null,
      },
    });
  }
}

export async function processPecosUpdate(payload: PecosUpdatePayload) {
  if (!payload.clinicianId) {
    throw new Error('clinicianId is required');
  }
  if (!payload.npi) {
    throw new Error('npi is required');
  }

  const enrollmentType = normalizeEnrollmentType(payload.enrollmentType);
  const providerStatus = normalizeProviderStatus(payload.providerStatus);
  const checkedAt = payload.lastCheckedAt ? new Date(payload.lastCheckedAt) : new Date();

  const context = await resolveClinicianContext({
    clinicianId: payload.clinicianId,
    clinicianDid: payload.clinicianDid,
    npi: payload.npi,
  });

  const providerKey = {
    clinicianId_enrollmentType: {
      clinicianId: payload.clinicianId,
      enrollmentType,
    },
  } as const;

  const existingLifecycle = await prisma.pECOSEnrollment.findUnique({ where: providerKey });
  const previousHistory = parseLifecycleHistory(existingLifecycle?.statuses);

  const statusEvaluation = runPecosStatusEngine({
    enrollmentType,
    providerStatus,
    history: previousHistory,
    effectiveDate: payload.effectiveDate,
    revalidationDate: payload.revalidationDate,
    checkedAt,
  });

  const providerRecord = await prisma.pECOSProvider.upsert({
    where: providerKey,
    create: {
      clinicianId: payload.clinicianId,
      npi: payload.npi,
      medicareId: payload.medicareId ?? null,
      enrollmentType,
      status: providerStatus,
      effectiveDate: toOptionalDate(payload.effectiveDate),
      revalidationDate: toOptionalDate(payload.revalidationDate),
      lastCheckedAt: checkedAt,
      metadata: toJson(payload.metadata) ?? null,
    },
    update: {
      npi: payload.npi,
      medicareId: payload.medicareId ?? null,
      status: providerStatus,
      effectiveDate: toOptionalDate(payload.effectiveDate),
      revalidationDate: toOptionalDate(payload.revalidationDate),
      lastCheckedAt: checkedAt,
      metadata: toJson(payload.metadata) ?? null,
    },
  });

  await prisma.pECOSEnrollment.upsert({
    where: providerKey,
    create: {
      clinicianId: payload.clinicianId,
      enrollmentType,
      statuses: serializeLifecycleHistory(statusEvaluation.history),
      currentStatus: statusEvaluation.currentStatus,
      lastCheckedAt: checkedAt,
      revalidationDueAt: statusEvaluation.revalidationDueAt,
      anomalies: statusEvaluation.anomalies,
    },
    update: {
      statuses: serializeLifecycleHistory(statusEvaluation.history),
      currentStatus: statusEvaluation.currentStatus,
      lastCheckedAt: checkedAt,
      revalidationDueAt: statusEvaluation.revalidationDueAt,
      anomalies: statusEvaluation.anomalies,
    },
  });

  await upsertDocuments(providerRecord.id, payload.documents);

  const snapshotDiscrepancies = detectPecosDiscrepancies(
    {
      enrollmentType,
      specialties: payload.specialties,
      practiceLocations: payload.practiceLocations,
    },
    payload.discrepancyContext ?? {}
  );

  const severity = severityForPecosStatus(
    providerStatus,
    snapshotDiscrepancies.length > 0,
    statusEvaluation.anomalies.length
  );

  await logCredentialTimelineEvent({
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.PECOS_VERIFIED,
    severity,
    metadata: {
      enrollmentType,
      providerStatus,
      anomalies: statusEvaluation.anomalies,
      discrepancies: snapshotDiscrepancies,
      revalidationDueAt: statusEvaluation.revalidationDueAt?.toISOString(),
    },
  });

  const payerNameValue = (payload.metadata as Record<string, unknown> | undefined)?.payerName;
  const payerName = typeof payerNameValue === 'string' ? payerNameValue : undefined;

  if (statusEvaluation.revalidationDueAt) {
    await upsertRevalidationTask({
      clinicianId: payload.clinicianId,
      type: RevalidationTaskType.PECOS,
      dueDate: statusEvaluation.revalidationDueAt,
      status: providerStatus === PecosProviderStatus.ENROLLED ? RevalidationTaskStatus.OPEN : RevalidationTaskStatus.IN_PROGRESS,
      source: 'SYSTEM',
      notes: `PECOS ${enrollmentType} revalidation due ${statusEvaluation.revalidationDueAt.toDateString()}`,
      metadata: {
        category: 'PECOS',
        referenceId: providerRecord.id,
        payerName: payerName,
      },
    });
  }

  if (snapshotDiscrepancies.length > 0 || statusEvaluation.anomalies.length > 0 || providerStatus !== PecosProviderStatus.ENROLLED) {
    await mergeCredentialRisk(payload.clinicianId, {
      add: [CredentialRiskFactors.PECOS_DISCREPANCY],
    });
  } else {
    await mergeCredentialRisk(payload.clinicianId, {
      remove: [CredentialRiskFactors.PECOS_DISCREPANCY],
    });
  }

  if (snapshotDiscrepancies.length > 0) {
    const userId = payload.notificationUserId ?? context?.userId;
    if (userId) {
      await createNotification(userId, 'pecos.discrepancy.detected', {
        clinicianId: payload.clinicianId,
        discrepancies: snapshotDiscrepancies,
      });
    }
  }

  return {
    providerId: providerRecord.id,
    currentStatus: statusEvaluation.currentStatus,
    discrepancies: snapshotDiscrepancies,
    anomalies: statusEvaluation.anomalies,
  };
}
