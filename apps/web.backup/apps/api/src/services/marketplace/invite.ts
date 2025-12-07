import { PrismaClient } from '@prisma/client';
import { recordHiringEvent } from '../audit/hiring-ledger';
import { anchorMarketplaceInvite } from '../audit/anchor';

const prisma = new PrismaClient();

export interface MarketplaceInviteInput {
  clinicianId: string;
  jobId: string;
  orgId: string;
  recruiterId: string;
  specialtyFilters?: string[];
}

export async function recordMarketplaceInvite(input: MarketplaceInviteInput) {
  if (!input.clinicianId) {
    throw new Error('clinicianId is required');
  }
  if (!input.jobId) {
    throw new Error('jobId is required');
  }

  const event = await recordHiringEvent({
    clinicianId: input.clinicianId,
    employerId: input.orgId,
    eventType: 'inviteSent',
    metadata: {
      jobId: input.jobId,
      recruiterId: input.recruiterId,
      channel: 'marketplace',
    },
  });

  await prisma.candidateSyncQueue.create({
    data: {
      clinicianId: input.clinicianId,
      orgId: input.orgId,
      event: 'inviteSent',
      payload: {
        jobId: input.jobId,
        recruiterId: input.recruiterId,
        eventId: event.id,
      },
    },
  });

  anchorMarketplaceInvite({
    clinicianId: input.clinicianId,
    jobId: input.jobId,
    orgId: input.orgId,
    recruiterId: input.recruiterId,
    specialtyFilters: input.specialtyFilters,
  });

  return {
    event,
    notification: buildNotificationEnvelope(input),
  };
}

function buildNotificationEnvelope(input: MarketplaceInviteInput) {
  return {
    clinicianId: input.clinicianId,
    jobId: input.jobId,
    message: `Invite sent for job ${input.jobId} via ${input.orgId}`,
    metadata: {
      recruiterId: input.recruiterId,
      specialties: input.specialtyFilters ?? [],
    },
  };
}










