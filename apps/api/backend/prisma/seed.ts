import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derivedKey}`
}

async function main() {
  const reset = process.env.SEED_RESET === '1' || process.env.SEED_RESET === 'true'

  if (reset) {
    // Destructive reset for local dev only. Never run this in production.
    await prisma.job.deleteMany()
    await prisma.credential.deleteMany()
    await prisma.auditEvent.deleteMany()
    await prisma.user.deleteMany()
  }

  const demoPassword = 'demo123'

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: { name: 'Alice Example' },
    data: {
      email: 'alice@example.com',
      name: 'Alice Example',
      passwordHash: hashPassword(demoPassword),
    }
  })

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: { name: 'Bob Example' },
    data: {
      email: 'bob@example.com',
      name: 'Bob Example',
      passwordHash: hashPassword(demoPassword),
    }
  })

  const demoIssuer = 'VitalCV Demo Issuer (Non-PHI)'

  // Idempotent credential creation (avoid duplicates)
  const existingCreds = await prisma.credential.findMany({
    where: { userId: { in: [alice.id, bob.id] }, issuer: demoIssuer },
  })
  const existingKey = new Set(existingCreds.map((c) => `${c.userId}:${c.name}`))
  const credToCreate = [
    { name: 'Nursing License', issuer: demoIssuer, userId: alice.id },
    { name: 'Pharmacy Certification', issuer: demoIssuer, userId: bob.id },
  ].filter((c) => !existingKey.has(`${c.userId}:${c.name}`))
  if (credToCreate.length) {
    await prisma.credential.createMany({ data: credToCreate })
  }

  const existingJobs = await prisma.job.findMany({ where: { userId: { in: [alice.id, bob.id] } } })
  const existingJobKey = new Set(existingJobs.map((j) => `${j.userId}:${j.title}`))
  const jobsToCreate = [
    { title: 'Nurse', userId: alice.id },
    { title: 'Pharmacist', userId: bob.id },
  ].filter((j) => !existingJobKey.has(`${j.userId}:${j.title}`))
  if (jobsToCreate.length) {
    await prisma.job.createMany({ data: jobsToCreate })
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
