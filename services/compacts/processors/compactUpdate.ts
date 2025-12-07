import { Prisma, PrismaClient, CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { resolveClinicianContext } from '../../common/clinicianContext.js';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent.js';
import { mergeCredentialRisk } from '../../credentialRisk/riskService.js';
import { CredentialRiskFactors } from '../../credentialRisk/enums.js';
import { createNotification } from '../../notifications/notificationService.js';
import { CompactType } from '../models/CompactParticipation.js';

const prisma = new PrismaClient();
const log = getServiceLogger('compacts/processors/compactUpdate');

export interface CompactUpdatePayload {
  clinicianId: string;
  compactType: CompactType;
  homeState: string;
  authorizedStates: string[];
  expiresAt?: string | Date;
  metadata?: Record<string, unknown>;
}

function assertPayload(payload: CompactUpdatePayload) {
  if (!payload.clinicianId) {
    throw new Error('clinicianId is required');
  }
  if (!payload.compactType) {
    throw new Error('compactType is required');
  }
  if (!payload.homeState) {
    throw new Error('homeState is required');
  }
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

function normalizeStates(states: string[]): string[] {
  return [...new Set(states.map((state) => state.trim().toUpperCase()))].sort();
}

export async function processCompactUpdate(payload: CompactUpdatePayload) {
  assertPayload(payload);

  const context = await resolveClinicianContext({ clinicianId: payload.clinicianId });
  if (!context) {
    throw new Error(`Unable to resolve clinician context for ${payload.clinicianId}`);
  }

  const desiredStates = normalizeStates(payload.authorizedStates);
  const existing = await prisma.clinicianCompactWallet.findFirst({
    where: {
      clinicianId: payload.clinicianId,
      compactType: payload.compactType,
    },
  });

  const wallet = await prisma.clinicianCompactWallet.upsert({
    where: {
      clinicianId_compactType: {
        clinicianId: payload.clinicianId,
        compactType: payload.compactType,
      },
    },
    create: {
      clinicianId: payload.clinicianId,
      compactType: payload.compactType,
      homeState: payload.homeState.toUpperCase(),
      privileges: desiredStates,
      metadata: toJson(payload.metadata) ?? null,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
    },
    update: {
      homeState: payload.homeState.toUpperCase(),
      privileges: desiredStates,
      metadata: toJson(payload.metadata) ?? undefined,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : existing?.expiresAt,
    },
  });

  const previousStates = existing?.privileges ?? [];
  const added = desiredStates.filter((state) => !previousStates.includes(state));
  const removed = previousStates.filter((state) => !desiredStates.includes(state));

  if (removed.length > 0) {
    await mergeCredentialRisk(payload.clinicianId, {
      add: [CredentialRiskFactors.COMPACT_GAP],
    });
  } else if (added.length > 0) {
    await mergeCredentialRisk(payload.clinicianId, {
      remove: [CredentialRiskFactors.COMPACT_GAP],
    });
  }

  await logCredentialTimelineEvent({
    clinicianId: payload.clinicianId,
    eventType: CredentialTimelineEventType.COMPACT_ELIGIBILITY_UPDATED,
    severity: removed.length > 0 ? TimelineEventSeverity.WARNING : TimelineEventSeverity.INFO,
    metadata: {
      compactType: payload.compactType,
      homeState: wallet.homeState,
      addedStates: added,
      removedStates: removed,
      totalStates: wallet.privileges.length,
    },
  });

  if (added.length || removed.length) {
    await createNotification(context.userId, 'compact.wallet.updated', {
      clinicianId: payload.clinicianId,
      compactType: payload.compactType,
      addedStates: added,
      removedStates: removed,
    });
  }

  return wallet;
}
