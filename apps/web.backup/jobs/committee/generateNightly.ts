import { PrismaClient } from '@prisma/client';
import { CommitteePacketStatus } from '../../services/committeePacket/models/CommitteePacket';
import { generateCommitteePacketSnapshot } from '../../services/committeePacket/assemble';

const prisma = new PrismaClient();

export interface CommitteePacketNightlyStats {
  cliniciansReviewed: number;
  packetsGenerated: number;
  regenerated: number;
  skippedFresh: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

const FRESHNESS_MINUTES = Number(process.env.COMMITTEE_PACKET_FRESHNESS_MINUTES ?? 360);
const FRESHNESS_MS = FRESHNESS_MINUTES * 60 * 1000;

export async function runCommitteePacketNightly(referenceDate = new Date()): Promise<CommitteePacketNightlyStats> {
  const stats: CommitteePacketNightlyStats = {
    cliniciansReviewed: 0,
    packetsGenerated: 0,
    regenerated: 0,
    skippedFresh: 0,
    errors: [],
    startedAt: new Date(),
    finishedAt: new Date(),
  };

  try {
    const clinicians = await prisma.clinicianProfile.findMany({
      select: { id: true },
    });

    for (const clinician of clinicians) {
      stats.cliniciansReviewed += 1;
      try {
        const latestPacket = await prisma.committeePacket.findFirst({
          where: { clinicianId: clinician.id },
          orderBy: { snapshotAt: 'desc' },
        });

        const newestSourceUpdate = await getLatestSourceUpdate(clinician.id);
        const needsRegeneration =
          !latestPacket ||
          referenceDate.getTime() - latestPacket.snapshotAt.getTime() > FRESHNESS_MS ||
          (newestSourceUpdate && newestSourceUpdate > latestPacket.snapshotAt);

        if (!needsRegeneration) {
          stats.skippedFresh += 1;
          continue;
        }

        await generateCommitteePacketSnapshot({
          clinicianId: clinician.id,
          statusOverride: latestPacket ? CommitteePacketStatus.REGENERATED : CommitteePacketStatus.GENERATED,
        });

        stats.packetsGenerated += 1;
        if (latestPacket) {
          stats.regenerated += 1;
        }
      } catch (error) {
        stats.errors.push(
          `[${clinician.id}] ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`
        );
      }
    }
  } finally {
    stats.finishedAt = new Date();
  }

  return stats;
}

async function getLatestSourceUpdate(clinicianId: string): Promise<Date | null> {
  const [license, payer, privilege, quality] = await Promise.all([
    prisma.stateLicenseVerification.findFirst({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.payerEnrollmentV2.findFirst({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.privilegeGranted.findFirst({
      where: { clinicianDid: { not: null }, privilegeSetId: { not: null } },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.fppeOppe.findFirst({
      where: { clinicianDid: { not: null } },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
  ]);

  const timestamps = [license?.updatedAt, payer?.updatedAt, privilege?.updatedAt, quality?.updatedAt].filter(
    Boolean
  ) as Date[];

  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.sort((a, b) => b.getTime() - a.getTime())[0];
}

if (require.main === module) {
  runCommitteePacketNightly()
    .then((result) => {
      console.log('[CommitteePacketNightly] Complete', result);
      process.exit(result.errors.length ? 1 : 0);
    })
    .catch((error) => {
      console.error('[CommitteePacketNightly] Failed', error);
      process.exit(1);
    });
}

