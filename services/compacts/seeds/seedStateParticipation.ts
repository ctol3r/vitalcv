const log = getServiceLogger('compacts/seeds/seedStateParticipation');
/**
 * B178A-COMPACT-002: Seed compact participation reference data
 *
 * Populates CompactParticipation with 50 states + DC for every compact type.
 * Idempotent: rerunning will upsert to keep status/startDate/metadata in sync with source data.
 */

import { PrismaClient } from '@prisma/client';
import type { CompactType } from '../models/CompactParticipation.js';
import {
import { getServiceLogger } from '../../logging/serviceLogger';
  COMPACT_STATE_PARTICIPATION_SEED_DATA,
  type CompactParticipationSeedMap,
} from '../data/stateParticipation.js';

const prisma = new PrismaClient();

async function main() {
  log.info('🌱 Seeding compact participation data...');

  for (const [compactType, records] of Object.entries(COMPACT_STATE_PARTICIPATION_SEED_DATA) as [
    CompactType,
    CompactParticipationSeedMap[CompactType],
  ][]) {
    for (const record of records) {
      await prisma.compactParticipation.upsert({
        where: {
          compactType_state: {
            compactType,
            state: record.state,
          },
        },
        create: {
          compactType,
          state: record.state,
          status: record.status,
          startDate: record.startDate ? new Date(record.startDate) : null,
          metadata: record.metadata ?? null,
        },
        update: {
          status: record.status,
          startDate: record.startDate ? new Date(record.startDate) : null,
          metadata: record.metadata ?? null,
        },
      });
    }

    log.info(`  • ${compactType}: ${records.length} jurisdictions`);
  }

  log.info('✅ Finished seeding compact participation data');
}

main()
  .catch((error) => {
    log.error('❌ Failed to seed compact participation data', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
