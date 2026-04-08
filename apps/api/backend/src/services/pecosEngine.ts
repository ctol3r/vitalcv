/**
 * @deprecated pecosEngine.ts uses an NPI-prefix heuristic to simulate PECOS enrollment.
 * This is NOT a real data source. Use the PecosCheck table populated by
 * identityIngestionPipeline.ts (which calls the real CMS data.gov API) instead.
 *
 * No new callers should import this module. Existing callers in crossCheckEngine.ts
 * and crossCheckBundleEngine.ts have been migrated to read from PecosCheck directly.
 */
import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { getPecosProvider, recordPecosCheck } from './externalIntegrations';

type PecosCheckPayload = {
  npi: string;
  enrolled: boolean | null;
  claimState: 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN';
  enrollmentType: string | null;
  observedAt: Date;
  dataVersion: string;
  dataFreshness: 'QUARTERLY';
  sourceLatency: 'QUARTERLY';
  checkedAt: Date;
  rawPayload: Prisma.JsonValue;
};

export async function runPecosCheck(npi: string): Promise<PecosCheckPayload> {
  const normalizedNpi = typeof npi === 'string' ? npi.trim() : '';
  if (!normalizedNpi) {
    throw new Error('npi is required for PECOS check.');
  }

  const provider = getPecosProvider();
  const result = await provider.fetchEnrollmentStatus(normalizedNpi);
  recordPecosCheck();
  const checkedAt = result.checkedAt;
  const observedAt = result.observedAt;
  const dataVersion = result.dataVersion
    ?? `${checkedAt.getUTCFullYear()}-Q${Math.floor(checkedAt.getUTCMonth() / 3) + 1}`;
  const rawPayload = {
    ...result.rawPayload,
    checkedAt: checkedAt.toISOString(),
    observedAt: observedAt.toISOString(),
    claimState: result.claimState,
    dataVersion,
    dataFreshness: 'QUARTERLY',
    sourceLatency: 'QUARTERLY',
  } as Prisma.JsonObject;

  const persisted = await prisma.pecosCheck.create({
    data: {
      npi: normalizedNpi,
      enrolled: result.enrolled ?? false,
      enrollmentType: result.enrollmentType,
      rawPayload: rawPayload as Prisma.InputJsonValue,
      checkedAt,
    },
  });

  return {
    npi: persisted.npi,
    enrolled: persisted.enrolled,
    claimState: result.claimState,
    enrollmentType: persisted.enrollmentType,
    observedAt,
    dataVersion,
    dataFreshness: 'QUARTERLY',
    sourceLatency: 'QUARTERLY',
    checkedAt: persisted.checkedAt,
    rawPayload: persisted.rawPayload,
  };
}
