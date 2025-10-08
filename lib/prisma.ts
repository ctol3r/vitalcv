import { PrismaClient } from '@prisma/client'

/**
 * Prisma Client singleton for VitalCV
 *
 * Uses singleton pattern to prevent multiple instances in development
 * with hot reloading. In production, creates a single instance.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Gracefully disconnect Prisma on process termination
 */
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}
