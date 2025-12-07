import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DidUserLinkInput {
  userId: string;
  did: string;
}

function normalizeDid(did: string): string {
  return did.trim();
}

export async function linkDidToUser(input: DidUserLinkInput) {
  const did = normalizeDid(input.did);

  return prisma.didUserLink.upsert({
    where: { did },
    update: {
      userId: input.userId,
    },
    create: {
      did,
      userId: input.userId,
    },
  });
}

export function findUserIdByDid(did: string) {
  return prisma.didUserLink.findUnique({
    where: { did: normalizeDid(did) },
  });
}

export function listDidsForUser(userId: string) {
  return prisma.didUserLink.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export function unlinkDid(did: string) {
  return prisma.didUserLink.delete({
    where: { did: normalizeDid(did) },
  });
}

