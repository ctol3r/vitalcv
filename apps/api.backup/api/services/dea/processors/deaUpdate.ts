import { Prisma, PrismaClient, CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { resolveClinicianContext } from '../../common/clinicianContext.js';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent.js';
import { mergeCredentialRisk } from '../../credentialRisk/riskService.js';
import { CredentialRiskFactors } from '../../credentialRisk/enums.js';
import { createNotification } from '../../notifications/notificationService.js';

const prisma = new PrismaClient();
const log = getServiceLogger('dea/processors/deaUpdate');

export type DEAStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';

export interface DEAUpdatePayload {
  clinicianId: string;
  clinicianDid?: string;
  registrationNumber: string;
  schedules: string[];
  status: DEAStatus;
  issuedAt?: string | Date;
  expiresAt?: string | Date;
  evidenceUrl?: string;
  metadata?: Record<string, unknown>;
}

function assertPayload(payload: DEAUpdatePayload) {
  if (!payload.clinicianId) {
    throw new Error('clinicianId is required');
  }
  if (!payload.registrationNumber) {
    throw new Error('registrationNumber is required');
  }
  if (!payload.status) {
    throw new Error('status is required');
  }
}

function toDate(value?: string | Date): Date | undefined {
  if (!value) {
    return undefined;
  }
  return value instanceof Date ? value : new Date(value);
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

function severityForStatus(status: DEAStatus, expiresSoon: boolean): TimelineEventSeverity {
  if (status === 'SUSPENDED') {
    return TimelineEventSeverity.CRITICAL;
  }
  if (status === 'EXPIRED' || expiresSoon) {
    return TimelineEventSeverity.WARNING;
  }
  return TimelineEventSeverity.INFO;
}

function expiresWithinDays(expiresAt?: Date, days = 60): boolean {
  if (!expiresAt) {
    return false;
  }
  const now = Date.now();
  const diff = expiresAt.getTime() - now;
  return diff > 0 && diff <= days * 24 * 60 * 60 * 1000;
}

export async function processDeaUpdate(payload: DEAUpdatePayload) {
  assertPayload(payload);

  const context = await resolveClinicianContext({
    clinicianId: payload.clinicianId,
    clinicianDid: payload.clinicianDid,
  });

  if (!context) {
    throw new Error(`Unable to resolve clinician context for ${payload.clinicianId}`);
  }

  const expiresAt = toDate(payload.expiresAt);
  const issuedAt = toDate(payload.issuedAt);
  const schedules = payload.schedules.map((schedule) => schedule.trim().toUpperCase()).sort();
  const expiresSoon = expiresWithinDays(expiresAt);
  const severity = severityForStatus(payload.status, expiresSoon);

  const existing = await prisma.credential.findFirst({
    where: {
      userId: context.userId,
      type: 'DEARegistration',
      name: payload.registrationNumber,
    },
  });

  const metadata = {
    ...(existing?.metadata as Record<string, unknown> | undefined),
    schedules,
    evidenceUrl: payload.evidenceUrl,
    status: payload.status,
    ...(payload.metadata ?? {}),
  };

  const credential = existing
    ? await prisma.credential.update({
        where: { id: existing.id },
        data: {
          issuer: 'DEA',
          status: payload.status.toLowerCase(),
          issuedAt: issuedAt ?? existing.issuedAt,
          expiresAt: expiresAt ?? existing.expiresAt,
          metadata: toJson(metadata),
        },
      })
    : await prisma.credential.create({
        data: {
          userId: context.userId,
          name: payload.registrationNumber,
          issuer: 'DEA',
          type: 'DEARegistration',
          status: payload.status.toLowerCase(),
          issuedAt: issuedAt ?? new Date(),
          expiresAt: expiresAt ?? null,
          metadata: toJson(metadata),
        },
      });

  await logCredentialTimelineEvent({
    clinicianId: context.clinicianId,
    eventType: CredentialTimelineEventType.DEA_VERIFIED,
    severity,
    metadata: {
      registrationNumber: credential.name,
      status: payload.status,
      schedules,
      expiresAt: credential.expiresAt?.toISOString(),
    },
  });

  const riskAdds: CredentialRiskFactors[] = [];
  const riskRemovals: CredentialRiskFactors[] = [];

  if (payload.status === 'SUSPENDED') {
    riskAdds.push(CredentialRiskFactors.DEA_SUSPENDED);
  } else {
    riskRemovals.push(CredentialRiskFactors.DEA_SUSPENDED);
  }

  if (payload.status === 'EXPIRED' || (expiresAt && expiresAt.getTime() < Date.now())) {
    riskAdds.push(CredentialRiskFactors.DEA_EXPIRED);
  } else {
    riskRemovals.push(CredentialRiskFactors.DEA_EXPIRED);
  }

  if (existing) {
    const previousMetadata = existing.metadata as Record<string, unknown> | undefined;
    const previousSchedules = Array.isArray(previousMetadata?.schedules)
      ? (previousMetadata!.schedules as string[]).map((entry) => entry.toUpperCase()).sort()
      : [];
    if (JSON.stringify(previousSchedules) !== JSON.stringify(schedules)) {
      riskAdds.push(CredentialRiskFactors.DEA_SCHEDULE_CHANGE);
    } else {
      riskRemovals.push(CredentialRiskFactors.DEA_SCHEDULE_CHANGE);
    }
  }

  if (riskAdds.length || riskRemovals.length) {
    await mergeCredentialRisk(context.clinicianId, {
      add: riskAdds,
      remove: riskRemovals,
    });
  }

  const results = await prisma.pSVResult.findMany({
    where: { clinicianId: context.clinicianId },
    select: { id: true },
  });
  if (results.length) {
    await prisma.pSVEvidenceBundle.updateMany({
      where: {
        psvResultId: { in: results.map((entry) => entry.id) },
      },
      data: { zipPath: null },
    });
  }

  if (payload.status !== 'ACTIVE') {
    await createNotification(context.userId, 'dea.registration.alert', {
      clinicianId: context.clinicianId,
      registrationNumber: payload.registrationNumber,
      status: payload.status,
      expiresAt: expiresAt?.toISOString(),
    });
  }

  return credential;
}
