#!/usr/bin/env ts-node

import prisma from '../apps/api/backend/src/graphql/prisma_client';
import { seedInvestigationData } from '../apps/api/backend/src/services/investigators/seedInvestigationData';

async function main(): Promise<void> {
  const summary = await seedInvestigationData(prisma, (level, message, fields) => {
    const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
    method(message, fields ?? {});
  });
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error('[seed-investigation-data] fatal', message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
