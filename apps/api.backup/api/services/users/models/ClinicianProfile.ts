import { PrismaClient } from '@prisma/client';
import { sanitizeUserFields } from '../../security/sanitizeUserFields';

const prisma = new PrismaClient();

export interface UpsertClinicianProfileInput {
  userId: string;
  npi: string;
  specialty: string;
  state: string;
  bio?: string | null;
}

function normalizeNpi(npi: string): string {
  return npi.replace(/\D/g, '').slice(0, 10);
}

function normalizeState(state: string): string {
  return state.trim().toUpperCase();
}

export async function upsertClinicianProfile(input: UpsertClinicianProfileInput) {
  const sanitizedBio = input.bio
    ? sanitizeUserFields({ bio: input.bio }).bio ?? null
    : null;

  return prisma.clinicianProfile.upsert({
    where: { userId: input.userId },
    update: {
      npi: normalizeNpi(input.npi),
      specialty: input.specialty.trim(),
      state: normalizeState(input.state),
      bio: sanitizedBio,
    },
    create: {
      userId: input.userId,
      npi: normalizeNpi(input.npi),
      specialty: input.specialty.trim(),
      state: normalizeState(input.state),
      bio: sanitizedBio,
    },
  });
}

export function getClinicianProfileByUserId(userId: string) {
  return prisma.clinicianProfile.findUnique({ where: { userId } });
}

export function getClinicianProfileByNpi(npi: string) {
  return prisma.clinicianProfile.findFirst({
    where: { npi: normalizeNpi(npi) },
  });
}

export function listClinicianProfiles(limit = 50) {
  return prisma.clinicianProfile.findMany({
    orderBy: { updatedAt: 'desc' },
    take: Math.min(limit, 200),
  });
}

