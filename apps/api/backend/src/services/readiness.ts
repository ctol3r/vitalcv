import prisma from '../graphql/prisma_client';

type VerifiedCredential = {
  type: string;
};

async function getVerifiedCredentials(clinicianId: string): Promise<VerifiedCredential[]> {
  const sanitizedId = clinicianId.trim();
  if (!sanitizedId) return [];

  const asInt = Number.parseInt(sanitizedId, 10);
  const user =
    Number.isInteger(asInt) && asInt > 0
      ? await prisma.user.findUnique({
          where: { id: asInt },
          include: { credentials: true },
        })
      : await prisma.user.findUnique({
          where: { email: sanitizedId },
          include: { credentials: true },
        });

  if (!user) return [];

  return user.credentials.map((cred) => ({
    type: cred.name,
  }));
}

export async function getReadinessScore(clinicianId: string) {
  const credentials = await getVerifiedCredentials(clinicianId);
  const requiredTypes = ['License', 'DEA', 'BoardCert'];
  const provided = new Set(credentials.map((c) => c.type));

  const missing = requiredTypes.filter((t) => !provided.has(t));
  const readiness = Math.round((provided.size / requiredTypes.length) * 100);

  return {
    clinicianId,
    readinessPercent: Math.max(0, Math.min(100, readiness)),
    missingCredentials: missing,
    status: readiness >= 100 ? 'Ready' : 'Incomplete',
  };
}
