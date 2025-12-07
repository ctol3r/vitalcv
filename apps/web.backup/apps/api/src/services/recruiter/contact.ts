import { PrismaClient, type RecruiterContactEvent } from '@prisma/client';

const prisma = new PrismaClient();

export interface ContactRecordInput {
  clinicianId: string;
  recruiterId: string;
  channel?: string;
  metadata?: Record<string, unknown>;
  contactedAt?: Date;
}

export interface ContactSummary {
  clinicianId: string;
  recruiterId: string;
  contactedAt: Date;
  channel?: string;
  metadata?: Record<string, unknown>;
}

export async function recordRecruiterContact(
  input: ContactRecordInput,
): Promise<RecruiterContactEvent> {
  if (!input.clinicianId) throw new Error('clinicianId is required');
  if (!input.recruiterId) throw new Error('recruiterId is required');

  return prisma.recruiterContactEvent.create({
    data: {
      clinicianId: input.clinicianId,
      recruiterId: input.recruiterId,
      channel: input.channel,
      metadata: input.metadata ?? {},
      contactedAt: input.contactedAt ?? new Date(),
    },
  });
}

export async function getLastRecruiterContact(
  clinicianId: string,
): Promise<RecruiterContactEvent | null> {
  if (!clinicianId) throw new Error('clinicianId is required');

  return prisma.recruiterContactEvent.findFirst({
    where: { clinicianId },
    orderBy: { contactedAt: 'desc' },
  });
}

export async function listRecentContacts(
  limit = 25,
): Promise<RecruiterContactEvent[]> {
  return prisma.recruiterContactEvent.findMany({
    orderBy: { contactedAt: 'desc' },
    take: limit,
  });
}

export async function findCliniciansMissingContact(daysStale: number): Promise<ContactSummary[]> {
  const cutoff = new Date(Date.now() - daysStale * 24 * 60 * 60 * 1000);
  const lastContacts = await prisma.recruiterContactEvent.groupBy({
    by: ['clinicianId'],
    _max: { contactedAt: true },
  });

  const stale: ContactSummary[] = [];
  for (const entry of lastContacts) {
    const contactedAt = entry._max.contactedAt ?? new Date(0);
    if (contactedAt < cutoff) {
      stale.push({
        clinicianId: entry.clinicianId,
        recruiterId: '', // resolved at reminder stage
        contactedAt,
      });
    }
  }

  return stale;
}










