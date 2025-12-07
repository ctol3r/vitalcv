import { PrismaClient } from '@prisma/client';
import { computeCompactEligibility, persistCompactEligibility } from '../services/compacts/engine';

const prisma = new PrismaClient();
const BATCH_SIZE = 50;

export async function runCompactEligibilitySweep(batchSize: number = BATCH_SIZE) {
  let cursor: string | null = null;
  let processed = 0;

  try {
    while (true) {
      const clinicians = await prisma.clinicianProfile.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (clinicians.length === 0) {
        break;
      }

      for (const clinician of clinicians) {
        await processClinician(clinician.id);
        processed += 1;
      }

      cursor = clinicians[clinicians.length - 1]?.id ?? null;
    }
  } finally {
    console.info('[CompactCheck] sweep complete', { processed });
    await prisma.$disconnect();
  }
}

async function processClinician(clinicianId: string) {
  try {
    const previous = await prisma.compactEligibility.findMany({
      where: { clinicianId },
    });
    const previousMap = new Map(previous.map((record) => [record.compact, record]));

    const computations = await computeCompactEligibility(prisma, clinicianId);
    await persistCompactEligibility(prisma, clinicianId, computations);

    const unlocked = computations.filter(
      (record) => record.eligible && !(previousMap.get(record.compact)?.eligible ?? false),
    );

    if (unlocked.length === 0) {
      return;
    }

    await Promise.all(
      unlocked.map((record) =>
        prisma.auditEvidence.create({
          data: {
            clinicianId,
            category: 'compact_eligibility',
            payload: {
              compact: record.compact,
              rationale: record.rationale,
              previous: previousMap.get(record.compact)?.eligible ?? null,
            },
          },
        }),
      ),
    );
  } catch (error) {
    console.warn('[CompactCheck] failed to process clinician', clinicianId, error);
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  runCompactEligibilitySweep()
    .catch((error) => {
      console.error('[CompactCheck] worker failed', error);
      process.exitCode = 1;
    });
}


