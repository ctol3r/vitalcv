/**
 * seed-opportunities.ts
 *
 * Manual launch-opportunity bootstrap for controlled environments.
 * Run: pnpm exec ts-node -P tsconfig.seed.json prisma/seed-opportunities.ts
 */

import prisma from '../src/graphql/prisma_client';
import { seedLaunchOpportunities } from '../src/services/opportunities/launchOpportunitySeed';

async function main() {
  const summary = await seedLaunchOpportunities(prisma, (level, message, fields) => {
    const payload = fields ? ` ${JSON.stringify(fields)}` : '';
    console.log(`[${level}] ${message}${payload}`);
  });

  console.log(
    `Done. Seeded ${summary.seededOpportunityCount} opportunities. Active public opportunities: ${summary.activeOpportunityCount}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
