/**
 * B169A-PECOS-003: PECOS lookup stub
 *
 * Returns realistic PECOS enrollment snapshots for a given NPI.
 * Used by the PECOS orchestrator and PSV evidence bundle export.
 */

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

const DEFAULT_FAILURE_RATE = 0.08;

const STATUS_POOL: Array<{ status: PecosProviderStatus; weight: number }> = [
  { status: PecosProviderStatus.ENROLLED, weight: 0.62 },
  { status: PecosProviderStatus.PENDING, weight: 0.2 },
  { status: PecosProviderStatus.REJECTED, weight: 0.1 },
  { status: PecosProviderStatus.DEACTIVATED, weight: 0.08 },
];

const REVALIDATION_WINDOWS_MONTHS = [18, 24, 36, 48, 60];

function weightedRandomStatus(randomValue: number): PecosProviderStatus {
  let cursor = 0;
  for (const entry of STATUS_POOL) {
    cursor += entry.weight;
    if (randomValue <= cursor) {
      return entry.status;
    }
  }
  return STATUS_POOL[0].status;
}

function pickDocumentTypes(status: PecosProviderStatus): PecosDocumentType[] {
  if (status === PecosProviderStatus.ENROLLED) {
    return [PecosDocumentType.CMS855I, PecosDocumentType.CMS855R];
  }
  if (status === PecosProviderStatus.DEACTIVATED) {
    return [PecosDocumentType.CMS855B];
  }
  return [PecosDocumentType.CMS855I];
}

function randomFromSeed(seed?: number): number {
  if (typeof seed === 'number') {
    // Simple deterministic pseudo-random generator
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }
  return Math.random();
}

export async function lookupPecosSnapshot(
  options: PecosLookupOptions
): Promise<PecosLookupResponse> {
  const { npi, clinicianId, enrollmentType, failureRate = DEFAULT_FAILURE_RATE, seed } = options;

  if (!npi) {
    throw new Error('NPI is required for PECOS lookup');
  }

  const randomValue = randomFromSeed(seed);
  if (randomValue < failureRate) {
    throw new Error('PECOS stub: simulated upstream failure');
  }

  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 400));

  const status = weightedRandomStatus(randomValue);
  const now = new Date();
  const effectiveDate = new Date(now);
  effectiveDate.setFullYear(effectiveDate.getFullYear() - (1 + Math.floor(randomValue * 4)));

  let revalidationDate: Date | null = null;
  if (status === PecosProviderStatus.ENROLLED || status === PecosProviderStatus.PENDING) {
    const windowIdx = Math.floor(randomValue * REVALIDATION_WINDOWS_MONTHS.length);
    const months = REVALIDATION_WINDOWS_MONTHS[windowIdx] ?? 36;
    revalidationDate = new Date(effectiveDate);
    revalidationDate.setMonth(revalidationDate.getMonth() + months);
  }

  const docs = pickDocumentTypes(status).map<PecosDocumentSnapshot>((docType, idx) => {
    const submitted = new Date(effectiveDate);
    submitted.setMonth(submitted.getMonth() + idx * 6);
    return {
      documentType: docType,
      submittedAt: submitted.toISOString(),
      parsedFields: {
        controlNumber: `${docType}-${npi}-${idx + 1}`,
        practiceAddress: '123 Credentialing Way, Austin, TX 78701',
        taxonomyCodes: ['207R00000X', '261QP2000X'],
        payToGroup: docType === PecosDocumentType.CMS855R ? 'Example Medical Group PLLC' : undefined,
      },
    };
  });

  const provider: PecosProviderSnapshot = {
    clinicianId,
    npi,
    medicareId: `MED-${npi.slice(-4)}-${Math.abs(Math.round(randomValue * 999)).toString().padStart(3, '0')}`,
    enrollmentType: enrollmentType ?? PecosEnrollmentType.CMS855I,
    status,
    effectiveDate: effectiveDate.toISOString(),
    revalidationDate: revalidationDate?.toISOString() ?? null,
    lastCheckedAt: now.toISOString(),
  };

  return {
    provider,
    documents: docs,
    checkedAt: now,
  };
}

