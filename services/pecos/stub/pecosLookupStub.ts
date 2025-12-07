import { randomUUID } from 'crypto';
import {
  PecosEnrollmentType,
  PecosProviderStatus,
} from '../models/PECOSProvider.js';
import { PecosDocumentType } from '../models/PECOSDocuments.js';

export interface PecosProviderSnapshot {
  clinicianId?: string;
  npi: string;
  medicareId: string;
  enrollmentType: PecosEnrollmentType;
  status: PecosProviderStatus;
  effectiveDate: string;
  revalidationDate: string | null;
  lastCheckedAt: string;
  specialties: string[];
  practiceLocations: Array<{
    street: string;
    city: string;
    state: string;
    zip: string;
  }>;
}

export interface PecosDocumentSnapshot {
  documentType: PecosDocumentType;
  submittedAt: string;
  parsedFields: Record<string, unknown>;
}

export interface PecosLookupResponse {
  provider: PecosProviderSnapshot;
  documents: PecosDocumentSnapshot[];
  checkedAt: Date;
}

export interface PecosLookupOptions {
  npi: string;
  clinicianId?: string;
  enrollmentType?: PecosEnrollmentType;
  failureRate?: number;
  seed?: number;
}

const STATUS_POOL: Array<{ status: PecosProviderStatus; weight: number }> = [
  { status: PecosProviderStatus.ENROLLED, weight: 0.62 },
  { status: PecosProviderStatus.PENDING, weight: 0.2 },
  { status: PecosProviderStatus.REJECTED, weight: 0.1 },
  { status: PecosProviderStatus.DEACTIVATED, weight: 0.08 },
];

const REVALIDATION_WINDOWS_MONTHS = [18, 24, 36, 48, 60];

function weightedStatus(randomValue: number): PecosProviderStatus {
  let pointer = 0;
  for (const bucket of STATUS_POOL) {
    pointer += bucket.weight;
    if (randomValue <= pointer) {
      return bucket.status;
    }
  }
  return STATUS_POOL[0].status;
}

function seededRandom(seed?: number): number {
  if (typeof seed === 'number') {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }
  return Math.random();
}

export async function lookupPecosSnapshot(
  options: PecosLookupOptions
): Promise<PecosLookupResponse> {
  const { npi, clinicianId, enrollmentType, failureRate = 0.08, seed } = options;
  if (!npi) {
    throw new Error('NPI is required for PECOS lookup');
  }

  const randomValue = seededRandom(seed);
  if (randomValue < failureRate) {
    throw new Error('PECOS stub: simulated upstream failure');
  }

  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 400));

  const status = weightedStatus(randomValue);
  const now = new Date();
  const effectiveDate = new Date(now);
  effectiveDate.setFullYear(effectiveDate.getFullYear() - (1 + Math.floor(randomValue * 4)));

  let revalidationDate: Date | null = null;
  if (status === PecosProviderStatus.ENROLLED || status === PecosProviderStatus.PENDING) {
    const months = REVALIDATION_WINDOWS_MONTHS[
      Math.floor(randomValue * REVALIDATION_WINDOWS_MONTHS.length)
    ] ?? 36;
    revalidationDate = new Date(effectiveDate);
    revalidationDate.setMonth(revalidationDate.getMonth() + months);
  }

  const documents: PecosDocumentSnapshot[] = [
    {
      documentType: PecosDocumentType.CMS855I,
      submittedAt: new Date(effectiveDate).toISOString(),
      parsedFields: {
        controlNumber: randomUUID(),
        practiceAddress: '123 Credentialing Way, Austin, TX 78701',
      },
    },
  ];

  if (status === PecosProviderStatus.ENROLLED) {
    documents.push({
      documentType: PecosDocumentType.CMS855R,
      submittedAt: new Date(effectiveDate.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      parsedFields: { payToGroup: 'Example Medical Group PLLC' },
    });
  }

  const provider: PecosProviderSnapshot = {
    clinicianId,
    npi,
    medicareId: `MED-${npi.slice(-4)}-${Math.abs(Math.round(randomValue * 999))
      .toString()
      .padStart(3, '0')}`,
    enrollmentType: enrollmentType ?? PecosEnrollmentType.CMS855I,
    status,
    effectiveDate: effectiveDate.toISOString(),
    revalidationDate: revalidationDate?.toISOString() ?? null,
    lastCheckedAt: now.toISOString(),
    specialties: ['207R00000X'],
    practiceLocations: [
      {
        street: '123 Credentialing Way',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
      },
    ],
  };

  return {
    provider,
    documents,
    checkedAt: now,
  };
}
