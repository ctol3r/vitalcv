import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();
const log = getServiceLogger('common/clinicianContext');

export interface ClinicianContext {
  clinicianId: string;
  userId: string;
  clinicianDid?: string;
  npi?: string;
  specialty?: string;
  state?: string;
}

export interface ResolveClinicianContextInput {
  clinicianId?: string;
  clinicianDid?: string;
  npi?: string;
}

export async function resolveClinicianContext(
  input: ResolveClinicianContextInput
): Promise<ClinicianContext | null> {
  if (!input.clinicianId && !input.clinicianDid && !input.npi) {
    return null;
  }

  if (input.clinicianId) {
    const profile = await prisma.clinicianProfile.findUnique({
      where: { id: input.clinicianId },
      include: {
        user: {
          select: { id: true, did: true },
        },
      },
    });

    if (!profile) {
      log.warn('[resolveClinicianContext] clinician not found', { clinicianId: input.clinicianId });
      return null;
    }

    return {
      clinicianId: profile.id,
      userId: profile.userId,
      clinicianDid: profile.user.did ?? undefined,
      npi: profile.npi,
      specialty: profile.specialty,
      state: profile.state,
    };
  }

  if (input.clinicianDid) {
    const user = await prisma.user.findFirst({
      where: { did: input.clinicianDid },
      select: { id: true },
    });

    if (!user) {
      log.warn('[resolveClinicianContext] user not found for DID', { clinicianDid: input.clinicianDid });
      return null;
    }

    const profile = await prisma.clinicianProfile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      log.warn('[resolveClinicianContext] clinician profile missing for DID', { clinicianDid: input.clinicianDid });
      return null;
    }

    return {
      clinicianId: profile.id,
      userId: profile.userId,
      clinicianDid: input.clinicianDid,
      npi: profile.npi,
      specialty: profile.specialty,
      state: profile.state,
    };
  }

  if (input.npi) {
    const profile = await prisma.clinicianProfile.findFirst({
      where: { npi: input.npi },
      include: {
        user: {
          select: { id: true, did: true },
        },
      },
    });

    if (!profile) {
      log.warn('[resolveClinicianContext] clinician not found for NPI', { npi: input.npi });
      return null;
    }

    return {
      clinicianId: profile.id,
      userId: profile.userId,
      clinicianDid: profile.user.did ?? undefined,
      npi: profile.npi,
      specialty: profile.specialty,
      state: profile.state,
    };
  }

  return null;
}
