import { PrismaClient, type WalletCredential } from '@prisma/client';

const prisma = new PrismaClient();

export async function getWalletCredentialOrMock(
  credentialId: string | undefined,
  clinicianId: string,
): Promise<WalletCredential> {
  if (!credentialId) {
    return buildMockCredential(clinicianId, `mock-${Date.now()}`);
  }
  const record = await prisma.walletCredential.findUnique({ where: { credentialId } });
  if (record && record.clinicianId !== clinicianId) {
    throw new Error('credential_does_not_belong_to_clinician');
  }
  return record ?? buildMockCredential(clinicianId, credentialId);
}

export function buildMockCredential(clinicianId: string, credentialId: string): WalletCredential {
  const now = new Date();
  return {
    credentialId,
    clinicianId,
    type: 'VitalLicenseCredential',
    payload: {
      credentialSubject: {
        id: clinicianId,
        name: {
          first: 'Demo',
          last: 'Clinician',
        },
        license: {
          number: 'MOCK-12345',
          status: 'active',
          state: 'CA',
          expires: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        sanction: {
          status: 'clear',
          lastChecked: now.toISOString(),
        },
      },
    },
    issuedAt: now,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export { prisma as walletPrisma };









