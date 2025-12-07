/**
 * Jest test setup
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Clean up database before tests
beforeAll(async () => {
  // Ensure database is clean
  await prisma.recoveryKey.deleteMany({});
  await prisma.webAuthnAuthenticator.deleteMany({});
  await prisma.userAalAssignment.deleteMany({});
  await prisma.aalPolicy.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

