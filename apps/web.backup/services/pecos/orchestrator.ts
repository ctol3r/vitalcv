import { PrismaClient } from '@prisma/client';
import {
  mapProviderStatusToEnrollment,
  PecosProviderStatus,
} from './models/PECOSProvider.js';
import { lookupPecosSnapshot } from './stub/pecosLookupStub.js';
import {
  EvidenceEventType,
  EvidenceResult,
  EvidenceSource,
  logEvidenceEvent,
} from '../audit/payerEnrollmentEvents.js';

const prisma = new PrismaClient();

type PrismaLike = Pick<
  PrismaClient,
  'payerEnrollment' | 'pECOSProvider' | 'pECOSDocument' | 'npiClaim' | 'pECOSEnrollment'
>;

export interface PecosOrchestratorSummary {
  success: boolean;
  checked: number;
  statusChanged: number;
  failures: Array<{ enrollmentId: string; reason: string }>;
  runAt: Date;
}

export interface PecosOrchestratorOptions {
  prismaClient?: PrismaLike;
  lookupFn?: typeof lookupPecosSnapshot;
  maxRetries?: number;
}

const DEFAULT_MAX_RETRIES = 3;

function evidenceResultFromStatus(status: PecosProviderStatus): EvidenceResult {
  switch (status) {
    case PecosProviderStatus.ENROLLED:
      return EvidenceResult.PASS;
    case PecosProviderStatus.PENDING:
      return EvidenceResult.WARNING;
    case PecosProviderStatus.REJECTED:
    case PecosProviderStatus.DEACTIVATED:
    default:
      return EvidenceResult.FAIL;
  }
}

async function withBackoff<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= maxRetries) break;
      const delay = 250 * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('PECOS lookup failed');
}

function parseLifecycleHistory(raw: unknown): PecosLifecycleHistory {
  if (!raw) return [];
  try {
    return PecosLifecycleHistorySchema.parse(raw);
  } catch (error) {
    log.warn('[PECOS Orchestrator] Failed to parse lifecycle history payload', error);
    return [];
  }
}

function serializeLifecycleHistory(history: PecosLifecycleHistory) {
  return history.map((event) => ({
    ...event,
    occurredAt:
      event.occurredAt instanceof Date ? event.occurredAt.toISOString() : event.occurredAt,
  }));
}

function buildDiscrepancyContext(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const record = metadata as Record<string, unknown>;
  return {
    expectedEnrollmentType: parseEnrollmentType(record.expectedEnrollmentType),
    specialties: pluckSpecialties(record),
    practiceLocations: pluckPracticeLocations(record),
  };
}

function parseEnrollmentType(value: unknown): PecosEnrollmentType | undefined {
  if (typeof value !== 'string') return undefined;
  return Object.values(PecosEnrollmentType).includes(value as PecosEnrollmentType)
    ? (value as PecosEnrollmentType)
    : undefined;
}

function pluckSpecialties(metadata: Record<string, unknown>): string[] {
  const raw = toArray(metadata.specialties);
  const resolved = raw
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        return (
          (typeof record.taxonomyCode === 'string' && record.taxonomyCode) ||
          (typeof record.specialty === 'string' && record.specialty) ||
          undefined
        );
      }
      return undefined;
    })
    .filter((value): value is string => Boolean(value));
  return resolved;
}

function pluckPracticeLocations(metadata: Record<string, unknown>): PracticeLocation[] {
  const locationsFromPractice = toArray(metadata.practiceLocations).map(mapToPracticeLocation);
  const practiceAddresses = toArray(metadata.addresses)
    .filter(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        (entry as Record<string, unknown>).type === 'practice'
    )
    .map(mapToPracticeLocation);
  return [...locationsFromPractice, ...practiceAddresses].filter(
    (location) => Object.values(location).some(Boolean)
  );
}

function mapToPracticeLocation(entry: unknown): PracticeLocation {
  if (!entry || typeof entry !== 'object') {
    return {};
  }
  const record = entry as Record<string, any>;
  const address = record.address && typeof record.address === 'object' ? record.address : record;
  return {
    street: stringOrUndefined(address?.street ?? record?.street),
    city: stringOrUndefined(address?.city ?? record?.city),
    state: stringOrUndefined(address?.state ?? record?.state),
    zip: stringOrUndefined(address?.zip ?? record?.zip),
  };
}

function toArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length ? value : undefined;
}

export async function runPecosOrchestrator(
  options: PecosOrchestratorOptions = {}
): Promise<PecosOrchestratorSummary> {
  const client = options.prismaClient ?? (prisma as PrismaLike);
  const lookup = options.lookupFn ?? lookupPecosSnapshot;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  const runAt = new Date();
  const failures: Array<{ enrollmentId: string; reason: string }> = [];
  let checked = 0;
  let statusChanged = 0;

  const enrollments = await client.payerEnrollment.findMany({
    where: {
      status: 'APPROVED',
      payer: {
        requiresPecos: true,
      },
    },
  });

  for (const enrollment of enrollments) {
    checked += 1;

    const npiClaim = await client.npiClaim.findFirst({
      where: {
        user: {
          did: enrollment.clinicianDid,
        },
      },
      select: { npi: true },
    });

    if (!npiClaim) {
      failures.push({
        enrollmentId: enrollment.id,
        reason: 'No NPI on file',
      });
      continue;
    }

    let snapshot;
    try {
      snapshot = await withBackoff(
        () =>
          lookup({
            npi: npiClaim.npi,
            clinicianId: enrollment.clinicianDid,
          }),
        maxRetries
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'PECOS lookup failed';
      failures.push({ enrollmentId: enrollment.id, reason });
      await logEvidenceEvent({
        enrollmentId: enrollment.id,
        eventType: EvidenceEventType.PECOS_CHECK,
        source: EvidenceSource.PECOS,
        result: EvidenceResult.ERROR,
        metadata: {
          reason,
          clinicianId: enrollment.clinicianDid,
          npi: npiClaim.npi,
        },
      });
      continue;
    }

    const compositeKey = {
      clinicianId_enrollmentType: {
        clinicianId: enrollment.clinicianDid,
        enrollmentType: snapshot.provider.enrollmentType,
      },
    };

    const existingProvider = await client.pECOSProvider.findUnique({
      where: compositeKey,
    });

    const existingEnrollmentLifecycle = await client.pECOSEnrollment.findUnique({
      where: compositeKey,
    });

    const previousHistory = parseLifecycleHistory(existingEnrollmentLifecycle?.statuses);
    const statusEvaluation = runPecosStatusEngine({
      enrollmentType: snapshot.provider.enrollmentType,
      providerStatus: snapshot.provider.status,
      history: previousHistory,
      effectiveDate: snapshot.provider.effectiveDate,
      revalidationDate: snapshot.provider.revalidationDate,
      checkedAt: new Date(snapshot.provider.lastCheckedAt),
    });

    const providerRecord = await client.pECOSProvider.upsert({
      where: compositeKey,
      create: {
        clinicianId: enrollment.clinicianDid,
        npi: snapshot.provider.npi,
        medicareId: snapshot.provider.medicareId,
        enrollmentType: snapshot.provider.enrollmentType,
        status: snapshot.provider.status,
        effectiveDate: new Date(snapshot.provider.effectiveDate),
        revalidationDate: snapshot.provider.revalidationDate
          ? new Date(snapshot.provider.revalidationDate)
          : null,
        lastCheckedAt: new Date(snapshot.provider.lastCheckedAt),
      },
      update: {
        npi: snapshot.provider.npi,
        medicareId: snapshot.provider.medicareId,
        status: snapshot.provider.status,
        effectiveDate: new Date(snapshot.provider.effectiveDate),
        revalidationDate: snapshot.provider.revalidationDate
          ? new Date(snapshot.provider.revalidationDate)
          : null,
        lastCheckedAt: new Date(snapshot.provider.lastCheckedAt),
      },
    });

    const lifecycleHistoryJson = serializeLifecycleHistory(statusEvaluation.history);

    await client.pECOSEnrollment.upsert({
      where: compositeKey,
      create: {
        clinicianId: enrollment.clinicianDid,
        enrollmentType: snapshot.provider.enrollmentType,
        statuses: lifecycleHistoryJson,
        currentStatus: statusEvaluation.currentStatus,
        lastCheckedAt: new Date(snapshot.provider.lastCheckedAt),
        revalidationDueAt: statusEvaluation.revalidationDueAt ?? null,
        anomalies: statusEvaluation.anomalies,
      },
      update: {
        statuses: lifecycleHistoryJson,
        currentStatus: statusEvaluation.currentStatus,
        lastCheckedAt: new Date(snapshot.provider.lastCheckedAt),
        revalidationDueAt: statusEvaluation.revalidationDueAt ?? null,
        anomalies: statusEvaluation.anomalies,
      },
    });

    const providerStatusChanged =
      !!existingProvider && existingProvider.status !== snapshot.provider.status;
    const lifecycleStatusChanged =
      statusEvaluation.appended && previousHistory.length > 0;

    if (providerStatusChanged || lifecycleStatusChanged) {
      statusChanged += 1;
    }

    for (const document of snapshot.documents) {
      await client.pECOSDocument.upsert({
        where: {
          providerId_documentType: {
            providerId: providerRecord.id,
            documentType: document.documentType,
          },
        },
        create: {
          providerId: providerRecord.id,
          documentType: document.documentType,
          submittedAt: document.submittedAt ? new Date(document.submittedAt) : null,
          parsedFields: document.parsedFields,
        },
        update: {
          submittedAt: document.submittedAt ? new Date(document.submittedAt) : null,
          parsedFields: document.parsedFields,
        },
      });
    }

    const mappedStatus = mapProviderStatusToEnrollment(snapshot.provider.status);
    const discrepancyContext = buildDiscrepancyContext(enrollment.metadata);
    const discrepancies = detectPecosDiscrepancies(
      {
        enrollmentType: snapshot.provider.enrollmentType,
        specialties: snapshot.provider.specialties ?? [],
        practiceLocations: snapshot.provider.practiceLocations ?? [],
      },
      discrepancyContext
    );

    await client.payerEnrollment.update({
      where: { id: enrollment.id },
      data: {
        pecosStatus: mappedStatus,
        lastCheckedAt: new Date(snapshot.provider.lastCheckedAt),
        revalidationDueAt: statusEvaluation.revalidationDueAt ?? null,
      },
    });

    await logEvidenceEvent({
      enrollmentId: enrollment.id,
      eventType: EvidenceEventType.PECOS_CHECK,
      source: EvidenceSource.PECOS,
      result: evidenceResultFromStatus(snapshot.provider.status),
      evidenceData: snapshot,
      metadata: {
        providerId: providerRecord.id,
        status: snapshot.provider.status,
        effectiveDate: snapshot.provider.effectiveDate,
        revalidationDate: snapshot.provider.revalidationDate,
        lifecycle: {
          currentStatus: statusEvaluation.currentStatus,
          revalidationDueAt: statusEvaluation.revalidationDueAt
            ? statusEvaluation.revalidationDueAt.toISOString()
            : null,
          history: lifecycleHistoryJson,
          anomalies: statusEvaluation.anomalies,
        },
        discrepancies,
      },
    });
  }

  return {
    success: failures.length === 0,
    checked,
    statusChanged,
    failures,
    runAt,
  };
}

if (require.main === module) {
  runPecosOrchestrator()
    .then((summary) => {
      console.log('[PECOS Orchestrator] Run finished', summary);
      process.exit(summary.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('[PECOS Orchestrator] Fatal error', error);
      process.exit(1);
    });
}
/**
 * B169A-PECOS-004 / B169A-PECOS-005: PECOS orchestrator
 *
 * Daily job that refreshes PECOS provider status for all enrolled clinicians.
 * - Uses the PECOS lookup stub
 * - Upserts PECOSProvider and PECOSDocument rows
 * - Updates payer enrollment snapshots
 * - Logs audit events and retries transient errors
 */

import { PrismaClient } from '@prisma/client';
import {
  mapProviderStatusToEnrollment,
  PecosProviderStatus,
} from './models/PECOSProvider.js';
import { lookupPecosSnapshot, PecosLookupResponse } from './stub/pecosLookupStub.js';
import {
  EvidenceEventType,
  EvidenceResult,
  EvidenceSource,
  logEvidenceEvent,
} from '../audit/payerEnrollmentEvents.js';

const prisma = new PrismaClient();

type PrismaLike = Pick<
  PrismaClient,
  | 'payerEnrollment'
  | 'pECOSProvider'
  | 'pECOSDocument'
  | 'npiClaim'
  | 'payerEnrollmentEvent'
>;

export interface PecosOrchestratorOptions {
  prismaClient?: PrismaLike;
  lookupFn?: typeof lookupPecosSnapshot;
  maxRetries?: number;
}

export interface PecosOrchestratorSummary {
  success: boolean;
  checked: number;
  statusChanged: number;
  failures: Array<{ enrollmentId: string; reason: string }>;
  runAt: Date;
}

const DEFAULT_MAX_RETRIES = 3;

function getEvidenceResult(status: PecosProviderStatus): EvidenceResult {
  switch (status) {
    case PecosProviderStatus.ENROLLED:
      return EvidenceResult.PASS;
    case PecosProviderStatus.PENDING:
      return EvidenceResult.WARNING;
    case PecosProviderStatus.REJECTED:
    case PecosProviderStatus.DEACTIVATED:
    default:
      return EvidenceResult.FAIL;
  }
}

async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;
      if (attempt >= maxRetries) break;
      const delay = 250 * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Unknown PECOS lookup failure');
}

export async function runPecosOrchestrator(
  options: PecosOrchestratorOptions = {}
): Promise<PecosOrchestratorSummary> {
  const client = options.prismaClient ?? (prisma as PrismaLike);
  const lookup = options.lookupFn ?? lookupPecosSnapshot;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  const runAt = new Date();
  const failures: Array<{ enrollmentId: string; reason: string }> = [];
  let checked = 0;
  let statusChanged = 0;

  const enrollments = await client.payerEnrollment.findMany({
    where: {
      status: 'APPROVED',
      payer: {
        requiresPecos: true,
      },
    },
    include: {
      payer: true,
    },
  });

  for (const enrollment of enrollments) {
    checked += 1;

    // Pull NPI for clinician
    const npiClaim = await client.npiClaim.findFirst({
      where: {
        user: {
          did: enrollment.clinicianDid,
        },
      },
      select: {
        npi: true,
      },
    });

    if (!npiClaim) {
      failures.push({
        enrollmentId: enrollment.id,
        reason: 'Missing NPI for clinician',
      });
      continue;
    }

    let lookupResult: PecosLookupResponse | null = null;

    try {
      lookupResult = await withExponentialBackoff(
        () =>
          lookup({
            npi: npiClaim.npi,
            clinicianId: enrollment.clinicianDid,
          }),
        maxRetries
      );
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Unknown PECOS lookup failure';
      failures.push({ enrollmentId: enrollment.id, reason });

      await logEvidenceEvent({
        enrollmentId: enrollment.id,
        eventType: EvidenceEventType.PECOS_CHECK,
        source: EvidenceSource.PECOS,
        result: EvidenceResult.ERROR,
        metadata: {
          error: reason,
          clinicianId: enrollment.clinicianDid,
          npi: npiClaim.npi,
        },
      });

      continue;
    }

    // Persist provider snapshot
    const compositeKey = {
      clinicianId_enrollmentType: {
        clinicianId: enrollment.clinicianDid,
        enrollmentType: lookupResult.provider.enrollmentType,
      },
    };

    const existingProvider = await client.pECOSProvider.findUnique({
      where: compositeKey,
    });

    const providerRecord = await client.pECOSProvider.upsert({
      where: compositeKey,
      create: {
        clinicianId: enrollment.clinicianDid,
        npi: lookupResult.provider.npi,
        medicareId: lookupResult.provider.medicareId,
        enrollmentType: lookupResult.provider.enrollmentType,
        status: lookupResult.provider.status,
        effectiveDate: new Date(lookupResult.provider.effectiveDate),
        revalidationDate: lookupResult.provider.revalidationDate
          ? new Date(lookupResult.provider.revalidationDate)
          : null,
        lastCheckedAt: new Date(lookupResult.provider.lastCheckedAt),
        metadata: {},
      },
      update: {
        npi: lookupResult.provider.npi,
        medicareId: lookupResult.provider.medicareId,
        status: lookupResult.provider.status,
        effectiveDate: new Date(lookupResult.provider.effectiveDate),
        revalidationDate: lookupResult.provider.revalidationDate
          ? new Date(lookupResult.provider.revalidationDate)
          : null,
        lastCheckedAt: new Date(lookupResult.provider.lastCheckedAt),
      },
    });

    if (
      existingProvider &&
      existingProvider.status !== lookupResult.provider.status
    ) {
      statusChanged += 1;
    }

    // Upsert supporting documents
    for (const doc of lookupResult.documents) {
      await client.pECOSDocument.upsert({
        where: {
          providerId_documentType: {
            providerId: providerRecord.id,
            documentType: doc.documentType,
          },
        },
        create: {
          providerId: providerRecord.id,
          documentType: doc.documentType,
          submittedAt: new Date(doc.submittedAt),
          parsedFields: doc.parsedFields,
        },
        update: {
          submittedAt: new Date(doc.submittedAt),
          parsedFields: doc.parsedFields,
        },
      });
    }

    // Update payer enrollment snapshot
    const mappedStatus = mapProviderStatusToEnrollment(lookupResult.provider.status);
    await client.payerEnrollment.update({
      where: { id: enrollment.id },
      data: {
        pecosStatus: mappedStatus,
        lastCheckedAt: new Date(lookupResult.provider.lastCheckedAt),
        revalidationDueAt: lookupResult.provider.revalidationDate
          ? new Date(lookupResult.provider.revalidationDate)
          : null,
      },
    });

    await logEvidenceEvent({
      enrollmentId: enrollment.id,
      eventType: EvidenceEventType.PECOS_CHECK,
      source: EvidenceSource.PECOS,
      result: getEvidenceResult(lookupResult.provider.status),
      evidenceData: lookupResult,
      metadata: {
        providerId: providerRecord.id,
        npi: lookupResult.provider.npi,
        medicareId: lookupResult.provider.medicareId,
        status: lookupResult.provider.status,
        effectiveDate: lookupResult.provider.effectiveDate,
        revalidationDate: lookupResult.provider.revalidationDate,
        documentsAttached: lookupResult.documents.length,
      },
    });
  }

  return {
    success: failures.length === 0,
    checked,
    statusChanged,
    failures,
    runAt,
  };
}

if (require.main === module) {
  runPecosOrchestrator()
    .then((result) => {
      console.log('[PECOS Orchestrator] Run complete:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('[PECOS Orchestrator] Fatal error', error);
      process.exit(1);
    });
}

