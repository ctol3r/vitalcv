import { Prisma, PrismaClient } from '@prisma/client';
import { getCompactEvidenceSummaries } from '../../../../../services/psv/evidenceBundle';
import type { ClinicianCredentialGraph } from './evaluator';

const prisma = new PrismaClient();

export async function buildCredentialGraph(
  clinicianId: string,
): Promise<ClinicianCredentialGraph | null> {
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: { user: true },
  });
  if (!clinician) {
    return null;
  }

  const [boardCerts, trainings, licenses, compacts] = await Promise.all([
    prisma.credential.findMany({
      where: {
        userId: clinician.userId,
        type: { contains: 'board', mode: 'insensitive' },
      },
    }),
    prisma.credential.findMany({
      where: {
        userId: clinician.userId,
        type: { in: ['ACLS', 'BLS', 'PALS', 'ATLS'] },
      },
    }),
    prisma.stateLicenseVerification.findMany({
      where: { clinicianId },
    }),
    getCompactEvidenceSummaries(clinician.user?.did ?? ''),
  ]);

  const earliestLicense = licenses
    .map((license) => license.issueDate)
    .filter(Boolean)
    .map((date) => date!.getTime());
  const experienceYears =
    earliestLicense.length > 0
      ? Math.max(0, (Date.now() - Math.min(...earliestLicense)) / (1000 * 60 * 60 * 24 * 365))
      : undefined;

  return {
    clinicianId,
    boardCertifications: boardCerts.map(serializeCredential),
    trainings: trainings.map(serializeCredential),
    licenses: licenses.map((license) => ({
      code: license.licenseNumber ?? license.state,
      label: license.state,
      status: license.status,
      jurisdiction: license.state,
      expiresAt: license.expiryDate?.toISOString() ?? null,
      verified: Boolean(license.verifiedAt),
    })),
    compactStates: compacts.flatMap((summary) => summary.authorizedStates),
    experienceYears:
      typeof experienceYears === 'number' ? Number(experienceYears.toFixed(1)) : undefined,
  };
}

function serializeCredential(credential: Prisma.CredentialGetPayload<{}>) {
  return {
    code: credential.type ?? credential.id,
    label: credential.name ?? credential.type ?? credential.id,
    status: credential.status,
    jurisdiction: undefined,
    expiresAt: credential.expiresAt?.toISOString() ?? null,
    verified: credential.status?.toLowerCase() === 'active',
  };
}

