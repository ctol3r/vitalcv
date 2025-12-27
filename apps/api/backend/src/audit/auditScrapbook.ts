import crypto from 'crypto';
import prisma from '../graphql/prisma_client';

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function logMatchComputed(params: {
  clinicianId: number;
  jobId: number;
  score: number;
  credentialOverlap: string[];
  matchedAt?: Date;
}): Promise<{ hash: string; createdAt: string }> {
  const createdAt = params.matchedAt ?? new Date();
  const hash = sha256Hex(
    JSON.stringify({
      type: 'MATCH_COMPUTED',
      userId: params.clinicianId,
      jobId: params.jobId,
      score: params.score,
      credentialOverlap: params.credentialOverlap,
      createdAt: createdAt.toISOString(),
    }),
  );

  await prisma.auditEvent.create({
    data: {
      type: 'MATCH_COMPUTED',
      hash,
      userId: params.clinicianId,
      metadata: {
        jobId: params.jobId,
        score: params.score,
        credentialOverlap: params.credentialOverlap,
        matchedAt: createdAt.toISOString(),
      },
      createdAt,
    },
  });

  return { hash, createdAt: createdAt.toISOString() };
}
