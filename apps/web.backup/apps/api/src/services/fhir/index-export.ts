import { PrismaClient } from '@prisma/client';
import { mapPractitioner } from './mappers/practitioner';
import type { FhirQualification, PractitionerResource, VerificationResultResource } from '../../../../../services/fhir/types/r6';
import { buildMasterCredentialIndex } from '../indexer/build-index';

const prisma = new PrismaClient();

export interface PractitionerIndexExport {
  practitioner: PractitionerResource;
  qualifications: FhirQualification[];
  verificationResults: VerificationResultResource[];
}

export async function exportPractitionerIndex(clinicianId: string): Promise<PractitionerIndexExport> {
  if (!clinicianId) {
    throw new Error('clinicianId is required for PractitionerIndex export');
  }

  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const snapshot = await buildMasterCredentialIndex(clinicianId, { prisma, skipPersist: true });
  const practitioner = mapPractitioner({
    id: clinician.id,
    npi: clinician.npi ?? '0000000000',
    active: true,
    name: splitName(clinician.user?.name ?? clinician.displayName ?? 'Unknown Clinician'),
    telecom: {
      email: clinician.user?.email ?? undefined,
    },
    specialties: deriveSpecialtyCodings(snapshot),
    qualifications: deriveQualificationCodings(snapshot),
  });

  const verificationResults = snapshot.rows.map((row) => ({
    resourceType: 'VerificationResult',
    id: `${row.credentialType}-${row.credentialId}`,
    status: mapVerificationStatus(row.status),
    date: row.lastUpdated,
    target: [
      {
        reference: `Practitioner/${clinicianId}`,
        display: String(row.summary?.label ?? row.credentialType),
      },
    ],
    primarySource: [
      {
        who: { display: row.issuerDid },
        validationStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/validation-status',
              code: row.status === 'active' ? 'validated' : row.status === 'expired' ? 'req-revalid' : 'revoked',
            },
          ],
        },
        validationDate: row.lastUpdated,
      },
    ],
  }));

  return {
    practitioner,
    qualifications: practitioner.qualification ?? [],
    verificationResults,
  };
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return {
      first: parts[0],
      last: parts[0],
    };
  }
  return {
    first: parts.slice(0, -1).join(' '),
    last: parts[parts.length - 1],
  };
}

function deriveSpecialtyCodings(snapshot: Awaited<ReturnType<typeof buildMasterCredentialIndex>>) {
  return snapshot.rows
    .filter((row) => row.credentialType === 'board')
    .map((row) => ({
      code: String(row.summary?.specialty ?? row.summary?.label ?? 'BOARD'),
      display: String(row.summary?.label ?? 'Board certification'),
    }));
}

function deriveQualificationCodings(
  snapshot: Awaited<ReturnType<typeof buildMasterCredentialIndex>>,
): FhirQualification[] {
  return snapshot.rows.map((row) => ({
    code: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
          code: String(row.summary?.state ?? row.credentialType),
          display: String(row.summary?.label ?? row.credentialType),
        },
      ],
    },
    issuer: row.issuerDid ? { display: row.issuerDid } : undefined,
  }));
}

function mapVerificationStatus(status: string): VerificationResultResource['status'] {
  switch (status) {
    case 'active':
      return 'validated';
    case 'revoked':
      return 'revoked';
    case 'expired':
    default:
      return 'req-revalid';
  }
}



