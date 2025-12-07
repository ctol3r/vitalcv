import { Prisma, PrismaClient, CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { resolveClinicianContext } from '../../common/clinicianContext.js';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent.js';
import { createNotification } from '../../notifications/notificationService.js';

const prisma = new PrismaClient();
const log = getServiceLogger('board/processors/boardUpdate');

export type BoardCertificationStatus = 'ACTIVE' | 'LAPSED' | 'REVOKED';

export interface BoardUpdatePayload {
  clinicianId: string;
  clinicianDid?: string;
  board: string;
  specialty: string;
  status: BoardCertificationStatus;
  issuedAt?: string | Date;
  expiresAt?: string | Date;
  evidenceUrl?: string;
  metadata?: Record<string, unknown>;
}

function assertPayload(payload: BoardUpdatePayload) {
  if (!payload.clinicianId) {
    throw new Error('clinicianId is required');
  }
  if (!payload.board) {
    throw new Error('board is required');
  }
  if (!payload.specialty) {
    throw new Error('specialty is required');
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

function expiresWithinDays(expiresAt?: Date, days = 90): boolean {
  if (!expiresAt) {
    return false;
  }
  const diff = expiresAt.getTime() - Date.now();
  return diff > 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function severityForStatus(status: BoardCertificationStatus, expiringSoon: boolean): TimelineEventSeverity {
  if (status === 'REVOKED') {
    return TimelineEventSeverity.CRITICAL;
  }
  if (status === 'LAPSED' || expiringSoon) {
    return TimelineEventSeverity.WARNING;
  }
  return TimelineEventSeverity.INFO;
}

export async function processBoardUpdate(payload: BoardUpdatePayload) {
  assertPayload(payload);

  const context = await resolveClinicianContext({
    clinicianId: payload.clinicianId,
    clinicianDid: payload.clinicianDid,
  });

  if (!context) {
    throw new Error(`Unable to resolve clinician context for ${payload.clinicianId}`);
  }

  const expiresAt = toDate(payload.expiresAt);
  const issuedAt = toDate(payload.issuedAt) ?? new Date();
  const expiringSoon = expiresWithinDays(expiresAt);
  const severity = severityForStatus(payload.status, expiringSoon);
  const credentialName = `${payload.board}:${payload.specialty}`;

  const existing = await prisma.credential.findFirst({
    where: {
      userId: context.userId,
      type: 'BoardCertification',
      name: credentialName,
    },
  });

  const metadata = {
    board: payload.board,
    specialty: payload.specialty,
    evidenceUrl: payload.evidenceUrl,
    status: payload.status,
    ...(payload.metadata ?? {}),
  };

  const credential = existing
    ? await prisma.credential.update({
        where: { id: existing.id },
        data: {
          status: payload.status.toLowerCase(),
          issuedAt,
          expiresAt: expiresAt ?? existing.expiresAt,
          metadata: toJson(metadata),
        },
      })
    : await prisma.credential.create({
        data: {
          userId: context.userId,
          name: credentialName,
          issuer: payload.board,
          type: 'BoardCertification',
          status: payload.status.toLowerCase(),
          issuedAt,
          expiresAt: expiresAt ?? null,
          metadata: toJson(metadata),
        },
      });

  const clinicianDid = payload.clinicianDid ?? context.clinicianDid;
  if (clinicianDid) {
    const pendingRequests = await prisma.privilegeRequest.findMany({
      where: {
        clinicianDid,
        status: { in: ['PENDING', 'UNDER_REVIEW'] },
      },
      select: { id: true },
    });

    let pendingIds: string[] = [];
    if (pendingRequests.length > 0) {
      pendingIds = pendingRequests.map((request) => request.id);
      await createNotification(context.userId, 'privilege.prereq.board', {
        clinicianId: context.clinicianId,
        requestIds: pendingIds,
        board: payload.board,
        specialty: payload.specialty,
      });
    }

    await logCredentialTimelineEvent({
      clinicianId: context.clinicianId,
      eventType: CredentialTimelineEventType.BOARD_VERIFIED,
      severity,
      metadata: {
        board: payload.board,
        specialty: payload.specialty,
        status: payload.status,
        expiresAt: credential.expiresAt?.toISOString(),
        pendingRequestIds: pendingIds,
      },
    });
  } else {
    await logCredentialTimelineEvent({
      clinicianId: context.clinicianId,
      eventType: CredentialTimelineEventType.BOARD_VERIFIED,
      severity,
      metadata: {
        board: payload.board,
        specialty: payload.specialty,
        status: payload.status,
        expiresAt: credential.expiresAt?.toISOString(),
      },
    });
  }

  return credential;
}
