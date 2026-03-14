import prisma from '../src/graphql/prisma_client'
import { seedCredentialIngestionExamples } from './credentialIngestionSeedExamples'

function shouldSeedCredentialIngestionExamples(): boolean {
  const value = process.env.SEED_CREDENTIAL_INGESTION_EXAMPLES?.trim().toLowerCase()
  return value === '1' || value === 'true'
}

async function main() {
  const reset = process.env.SEED_RESET === '1' || process.env.SEED_RESET === 'true'

  if (reset) {
    // Destructive reset for local dev only. Never run this in production.
    await prisma.auditEvent.deleteMany()
    await prisma.user.deleteMany()
  }

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {
      clerkUserId: 'seed_alice',
      role: 'CLINICIAN',
      status: 'ACTIVE',
    },
    create: {
      clerkUserId: 'seed_alice',
      email: 'alice@example.com',
      role: 'CLINICIAN',
      status: 'ACTIVE',
    }
  })

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {
      clerkUserId: 'seed_bob',
      role: 'CLINICIAN',
      status: 'ACTIVE',
    },
    create: {
      clerkUserId: 'seed_bob',
      email: 'bob@example.com',
      role: 'CLINICIAN',
      status: 'ACTIVE',
    }
  })

  if (shouldSeedCredentialIngestionExamples()) {
    const seeded = await seedCredentialIngestionExamples()
    console.log(`Seeded ${seeded.seededRunCount} credential ingestion runs for ${seeded.clinicianCount} clinicians`)
  }

  console.log('Database seeded successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
