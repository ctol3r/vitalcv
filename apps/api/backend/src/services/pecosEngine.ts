import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';

type PecosCheckPayload = {
  npi: string;
  enrolled: boolean;
  enrollmentType: string | null;
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
  const rawPayload = {
    source: 'simulated-pecos-pipeline',
    method: 'npi-prefix-check',
    checkedAt: checkedAt.toISOString(),
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
    enrollmentType: persisted.enrollmentType,
    checkedAt: persisted.checkedAt,
    rawPayload: persisted.rawPayload,
  };
}

