import { createHash } from 'crypto';
import { Prisma, PrismaClient, type HiringEvent } from '@prisma/client';
import { ChainClient } from '../chain/client';
import { autoScheduleOrientation } from '../scheduling/orientation';
import { recordOnboardingCheckpoint } from '../onboarding/checkpoints';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface HiringEventInput {
  clinicianId: string;
  employerId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}

export async function recordHiringEvent(input: HiringEventInput): Promise<HiringEvent> {
  const eventHash = hashHiringEvent(input);
  const created = await prisma.hiringEvent.create({
    data: {
      clinicianId: input.clinicianId,
      employerId: input.employerId,
      eventType: input.eventType,
      metadata: input.metadata ?? {},
      eventHash,
    },
  });

  const enriched = await maybeScheduleOrientation(created);

  const receipt = await chainClient.submitAuditEvent({
    eventType: 'HIRING_EVENT',
    payload: {
      eventId: enriched.id,
      clinicianId: enriched.clinicianId,
      employerId: enriched.employerId,
      eventType: enriched.eventType,
      eventHash,
    },
    tags: ['hiring', 'ledger'],
    correlationId: `${enriched.clinicianId}:${enriched.id}`,
  });

  const anchored = await prisma.hiringEvent.update({
    where: { id: enriched.id },
    data: {
      txHash: receipt.txHash,
      blockHash: (receipt.raw as Record<string, unknown> | undefined)?.blockHash
        ? String((receipt.raw as Record<string, unknown>).blockHash)
        : receipt.txHash,
      anchoredAt: new Date(receipt.timestamp),
    },
  });

  return anchored;
}

async function maybeScheduleOrientation(event: HiringEvent): Promise<HiringEvent> {
  if (!shouldAutoScheduleOrientation(event.eventType)) {
    return event;
  }

  try {
    const readiness = await prisma.clinicianReadinessScore.findUnique({
      where: { clinicianId: event.clinicianId },
    });
    const orientation = await autoScheduleOrientation({
      clinicianId: event.clinicianId,
      employerId: event.employerId,
      hiringEventId: event.id,
      readinessScore: readiness?.score,
      prisma,
    });

    await recordOnboardingCheckpoint({
      clinicianId: event.clinicianId,
      step: 'orientation',
      status: 'scheduled',
      metadata: orientation,
      prisma,
    });

    const existingMetadata =
      (event.metadata as Prisma.JsonObject | null) ?? ({} as Prisma.JsonObject);
    const merged: Prisma.JsonObject = {
      ...existingMetadata,
      orientation,
    };

    return prisma.hiringEvent.update({
      where: { id: event.id },
      data: {
        metadata: merged as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.warn('[hiring][orientation] auto-scheduling failed', {
      eventId: event.id,
      error: error instanceof Error ? error.message : error,
    });
    await recordOnboardingCheckpoint({
      clinicianId: event.clinicianId,
      step: 'orientation',
      status: 'pending',
      blockerCode: 'orientation_manual',
      metadata: {
        reason: 'Auto-scheduling failed',
      },
      prisma,
    });
    return event;
  }
}

function shouldAutoScheduleOrientation(eventType: string): boolean {
  const normalized = eventType.toLowerCase();
  return normalized === 'offeraccepted' || normalized === 'onboarded';
}

export async function listHiringEvents(clinicianId: string): Promise<HiringEvent[]> {
  return prisma.hiringEvent.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getHiringEvent(eventId: string): Promise<HiringEvent | null> {
  return prisma.hiringEvent.findUnique({
    where: { id: eventId },
  });
}

function hashHiringEvent(input: HiringEventInput): string {
  const payload = {
    clinicianId: input.clinicianId,
    employerId: input.employerId,
    eventType: input.eventType,
    metadata: input.metadata ?? {},
    timestamp: new Date().toISOString(),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}



