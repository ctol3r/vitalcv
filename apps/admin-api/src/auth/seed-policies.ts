/**
 * Seed default AAL policies
 *
 * Run this script to initialize default AAL2/AAL3 policies in the database.
 */

import { PrismaClient } from '@prisma/client';
import { defaultAalPolicies, upsertAalPolicy } from './auth/policy-config';

const prisma = new PrismaClient();

async function seedPolicies() {
  console.log('Seeding default AAL policies...');

  try {
    // Seed AAL2 policy
    await upsertAalPolicy(
      defaultAalPolicies.aal2.name,
      defaultAalPolicies.aal2,
      defaultAalPolicies.aal2.description
    );
    console.log(`✓ Created policy: ${defaultAalPolicies.aal2.name}`);

    // Seed AAL3 policy
    await upsertAalPolicy(
      defaultAalPolicies.aal3.name,
      defaultAalPolicies.aal3,
      defaultAalPolicies.aal3.description
    );
    console.log(`✓ Created policy: ${defaultAalPolicies.aal3.name}`);

    // Seed admin default policy
    await upsertAalPolicy(
      defaultAalPolicies.adminDefault.name,
      defaultAalPolicies.adminDefault,
      defaultAalPolicies.adminDefault.description
    );
    console.log(`✓ Created policy: ${defaultAalPolicies.adminDefault.name}`);

    // Seed verifier default policy
    await upsertAalPolicy(
      defaultAalPolicies.verifierDefault.name,
      defaultAalPolicies.verifierDefault,
      defaultAalPolicies.verifierDefault.description
    );
    console.log(`✓ Created policy: ${defaultAalPolicies.verifierDefault.name}`);

    console.log('✓ All policies seeded successfully');
  } catch (error) {
    console.error('Error seeding policies:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedPolicies();
}

export { seedPolicies };

