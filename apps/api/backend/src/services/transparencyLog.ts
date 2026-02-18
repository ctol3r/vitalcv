import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { normalizeLifecycleState } from '../utils/lifecycleState';

export type TransparencyLogEntry = {
  fingerprint: string;
  merkleRoot: string;
  lifecycleState: string;
  createdAt: Date;
};

function normalizeArtifactSnapshot(artifact: {
  checksum: string;
  merkleRoot: string;
  lifecycleState: string;
}): {
  fingerprint: string;
  merkleRoot: string;
  lifecycleState: string;
} {
  const fingerprint = artifact.checksum.trim();
  const merkleRoot = artifact.merkleRoot.trim();
  const lifecycleState = normalizeLifecycleState(artifact.lifecycleState);
  return { fingerprint, merkleRoot, lifecycleState };
}

export async function appendTransparencyEntry(
  artifact: {
    id: string;
    checksum: string;
    merkleRoot: string | null;
    lifecycleState: string;
    organizationId?: string | null;
  },
  tx?: Prisma.TransactionClient,
): Promise<void> {
  if (!artifact.id.trim()) {
    throw new Error('artifact.id is required for transparency append.');
  }

  const { fingerprint, merkleRoot, lifecycleState } = normalizeArtifactSnapshot({
    checksum: artifact.checksum,
    merkleRoot: artifact.merkleRoot ?? '',
    lifecycleState: artifact.lifecycleState,
  });

  if (!fingerprint) {
    throw new Error('artifact.checksum is required for transparency append.');
  }
  if (!merkleRoot) {
    throw new Error('artifact.merkleRoot is required for transparency append.');
  }

  if (!lifecycleState) {
    throw new Error('artifact.lifecycleState is required for transparency append.');
  }

  const client = tx ?? prisma;

  await client.credentialTransparencyLog.create({
    data: {
      artifactId: artifact.id,
      fingerprint,
      merkleRoot,
      lifecycleState,
      organizationId: artifact.organizationId?.trim().length ? artifact.organizationId.trim() : null,
      createdAt: new Date(),
    },
  });
}

export async function getTransparencyEntries(
  artifactId: string,
  tx?: Prisma.TransactionClient,
): Promise<TransparencyLogEntry[]> {
  const normalizedArtifactId = artifactId.trim();
  if (!normalizedArtifactId) {
    return [];
  }

  const client = tx ?? prisma;

  const entries = await client.credentialTransparencyLog.findMany({
    where: { artifactId: normalizedArtifactId },
    select: {
      fingerprint: true,
      merkleRoot: true,
      lifecycleState: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return entries.map((entry: TransparencyLogEntry) => ({
    fingerprint: entry.fingerprint,
    merkleRoot: entry.merkleRoot,
    lifecycleState: entry.lifecycleState,
    createdAt: entry.createdAt,
  }));
}
