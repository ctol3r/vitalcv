import { PrismaClient, EhrSynchronizationStatus } from '@prisma/client';
import { recordPrivilegeSyncedEvent } from '../timeline/ehrIntegration.js';

const prisma = new PrismaClient();

export interface EhrBootstrapInput {
  clinicianId: string;
  orgId: string;
  privilegeSetIds: string[];
}

export interface EhrBootstrapResult {
  queued: number;
  message: string;
  ehrSystem: string;
}

export async function bootstrapEhrPrivileges(
  input: EhrBootstrapInput
): Promise<EhrBootstrapResult> {
  if (!input.privilegeSetIds.length) {
    throw new Error('At least one privilege set is required to bootstrap EHR sync');
  }

  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: input.clinicianId },
    include: { user: true },
  });

  if (!clinician) {
    throw new Error(`Clinician ${input.clinicianId} not found`);
  }

  const ehrConfig = await prisma.ehrConfig.findFirst({
    where: {
      orgId: input.orgId,
      isActive: true,
    },
  });

  if (!ehrConfig) {
    throw new Error(`Org ${input.orgId} does not have an active EHR integration`);
  }

  const privilegeSets = await prisma.privilegeSetV2.findMany({
    where: {
      orgId: input.orgId,
      id: { in: input.privilegeSetIds },
    },
    include: {
      privileges: true,
    },
  });

  if (privilegeSets.length === 0) {
    throw new Error('No matching privilege sets found for Org B');
  }

  let queued = 0;

  await prisma.$transaction(async (tx) => {
    for (const set of privilegeSets) {
      const privilegeCodes = derivePrivilegeCodes(set.privileges.map((entry) => entry.privilegeCode));
      const recordId = `mobility-${set.id}`;

      await tx.ehrSynchronization.upsert({
        where: { id: recordId },
        update: {
          clinicianId: clinician.id,
          clinicianDid: clinician.user?.did ?? undefined,
          orgId: input.orgId,
          privilegeSetId: set.id,
          privilegeCode: privilegeCodes[0] ?? set.name,
          ehrSystem: ehrConfig.ehrType ?? 'ehr',
          status: EhrSynchronizationStatus.PENDING,
          attemptCount: 0,
          error: null,
          metadata: {
            bootstrap: true,
            privilegeCodes,
          },
          lastAttemptAt: new Date(),
        },
        create: {
          id: recordId,
          clinicianId: clinician.id,
          clinicianDid: clinician.user?.did ?? undefined,
          orgId: input.orgId,
          privilegeSetId: set.id,
          privilegeCode: privilegeCodes[0] ?? set.name,
          ehrSystem: ehrConfig.ehrType ?? 'ehr',
          status: EhrSynchronizationStatus.PENDING,
          metadata: {
            bootstrap: true,
            privilegeCodes,
          },
        },
      });

      await recordPrivilegeSyncedEvent({
        clinicianId: clinician.id,
        orgId: input.orgId,
        privilegeSetId: set.id,
        metadata: {
          action: 'queued_for_ehr_bootstrap',
          privilegeCodes,
        },
      });

      queued += 1;
    }
  });

  return {
    queued,
    message: `Queued ${queued} privilege set(s) for EHR synchronization`,
    ehrSystem: ehrConfig.ehrType ?? 'ehr',
  };
}

function derivePrivilegeCodes(codes: Array<string | null>): string[] {
  const normalized = codes
    .filter((code): code is string => Boolean(code))
    .map((code) => code.toUpperCase());

  if (normalized.length > 0) {
    return Array.from(new Set(normalized));
  }

  return ['DEFAULT'];
}

