import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function upsertTags(npi: string, patch: Record<string, string[]>) {
  const claim = await prisma.npiClaim.findUnique({ where: { npi } });
  if (!claim) {
    throw new Error(`No claim found for NPI: ${npi}`);
  }

  const prior = (claim.tags as any) || {};
  const merged: Record<string, string[]> = { ...prior };

  for (const [k, arr] of Object.entries(patch)) {
    const set = new Set([...(prior[k] || []), ...arr]);
    merged[k] = Array.from(set);
  }

  await prisma.npiClaim.update({
    where: { npi },
    data: { tags: merged },
  });

  return merged;
}
