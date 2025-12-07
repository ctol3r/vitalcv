const log = getServiceLogger('matching/seedEmbeddings');
/**
 * S72-STRETCH-D-003: Seed script for generating embeddings for existing data
 *
 * Generates embeddings for:
 * - Existing job postings
 * - Existing clinicians (users with 'holder' role)
 */

import { PrismaClient } from '@prisma/client';
import { embedProfile } from './embeddings';
import { EntityType } from './models/Embeddings';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();

/**
 * Seed embeddings for all job postings
 */
export async function seedJobEmbeddings(forceRefresh: boolean = false): Promise<void> {
  log.info('Seeding job embeddings...');

  const jobs = await prisma.jobPosting.findMany({
    where: { status: 'active' },
  });

  log.info(`Found ${jobs.length} active job postings`);

  for (const job of jobs) {
    try {
      await embedProfile(
        {
          specialty: job.specialty,
          description: job.description || undefined,
          requirements: job.requiredStates,
          preferences: {
            modality: job.modality,
            telehealth: job.telehealth,
            imlcAllowed: job.imlcAllowed,
            psypactAllowed: job.psypactAllowed,
            counselingCompactAllowed: job.counselingCompactAllowed,
          },
        },
        job.id,
        'Job' as EntityType,
        forceRefresh
      );
      log.info(`✓ Embedded job: ${job.id} - ${job.title}`);
    } catch (error) {
      log.error(`✗ Failed to embed job ${job.id}:`, error);
    }
  }

  log.info('Job embeddings seeding complete');
}

/**
 * Seed embeddings for all clinicians
 */
export async function seedClinicianEmbeddings(
  forceRefresh: boolean = false
): Promise<void> {
  log.info('Seeding clinician embeddings...');

  const clinicians = await prisma.user.findMany({
    where: {
      did: { not: null },
      roles: { has: 'holder' },
    },
    include: {
      npiClaims: true,
    },
  });

  log.info(`Found ${clinicians.length} clinicians`);

  for (const clinician of clinicians) {
    if (!clinician.did) continue;

    try {
      await embedProfile(
        {
          specialty: (clinician as any).metadata?.specialty || '',
          skills: (clinician as any).metadata?.skills || [],
          preferences: (clinician as any).metadata?.preferences || {},
        },
        clinician.did,
        'Clinician' as EntityType,
        forceRefresh
      );
      log.info(`✓ Embedded clinician: ${clinician.did} - ${clinician.name}`);
    } catch (error) {
      log.error(`✗ Failed to embed clinician ${clinician.did}:`, error);
    }
  }

  log.info('Clinician embeddings seeding complete');
}

/**
 * Seed all embeddings
 */
export async function seedAllEmbeddings(forceRefresh: boolean = false): Promise<void> {
  log.info('Starting embeddings seed...');
  log.info(`Force refresh: ${forceRefresh}`);

  await seedJobEmbeddings(forceRefresh);
  await seedClinicianEmbeddings(forceRefresh);

  log.info('All embeddings seeded successfully');
}

// Run if called directly
if (require.main === module) {
  const forceRefresh = process.argv.includes('--force-refresh');

  seedAllEmbeddings(forceRefresh)
    .then(() => {
      log.info('Seed complete');
      process.exit(0);
    })
    .catch((error) => {
      log.error('Seed failed:', error);
      process.exit(1);
    });
}

