import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';

type PecosCheckPayload = {
  npi: string;
  enrolled: boolean;
  claimState: 'ENROLLED' | 'NOT_FOUND';
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

  const enrolled = normalizedNpi.startsWith('1');
  const enrollmentType = enrolled ? 'simulated-prefix-1' : null;
  const checkedAt = new Date();
  const claimState = enrolled ? 'ENROLLED' as const : 'NOT_FOUND' as const;
  const quarter = Math.floor(checkedAt.getUTCMonth() / 3) + 1;
  const dataVersion = `${checkedAt.getUTCFullYear()}-Q${quarter}`;
  const rawPayload = {
    source: 'simulated-pecos-pipeline',
    method: 'npi-prefix-check',
    checkedAt: checkedAt.toISOString(),
    observedAt: checkedAt.toISOString(),
    claimState,
    dataVersion,
    dataFreshness: 'QUARTERLY',
    sourceLatency: 'QUARTERLY',
    enrollmentType,
  } as const;

  const persisted = await prisma.pecosCheck.create({
    data: {
      npi: normalizedNpi,
      enrolled,
      enrollmentType,
      rawPayload: rawPayload as Prisma.InputJsonValue,
      checkedAt,
    },
  });

  return {
    npi: persisted.npi,
    enrolled: persisted.enrolled,
    claimState,
    enrollmentType: persisted.enrollmentType,
    observedAt: persisted.checkedAt,
    dataVersion,
    dataFreshness: 'QUARTERLY',
    sourceLatency: 'QUARTERLY',
    checkedAt: persisted.checkedAt,
    rawPayload: persisted.rawPayload,
  };
}
