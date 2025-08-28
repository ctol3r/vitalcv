import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.job.deleteMany()
  await prisma.credential.deleteMany()
  await prisma.user.deleteMany()

  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice'
    }
  })

  const bob = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      name: 'Bob'
    }
  })

  await prisma.credential.createMany({
    data: [
      { name: 'Nursing License', issuer: 'State Board of Nursing', userId: alice.id },
      { name: 'Pharmacy Certification', issuer: 'Board of Pharmacy', userId: bob.id }
    ]
  })

  await prisma.job.createMany({
    data: [
      { title: 'Nurse', userId: alice.id },
      { title: 'Pharmacist', userId: bob.id }
    ]
  })

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
