import prisma from '../graphql/prisma_client';
import { runPecosCheck } from './pecosEngine';
import { runIndependentCrossCheck } from './crossCheckEngine';
import { getTransparencyEntries } from './transparencyLog';
import { hashDeterministicPayload } from '../utils/deterministic';

type CrossCheckBundlePayload = {
  artifactId: string;
  checksum: string;
  fingerprint: string;
  merkleRoot: string;
  lifecycleState: string;
  pecosEnrollmentStatus: boolean;
  nursysEventCount: number;
  transparencyEntries: Array<{
    fingerprint: string;
    merkleRoot: string;
    lifecycleState: string;
    createdAt: string;
  }>;
  crossCheckPass: boolean;
  generatedAt: string;
};

export type CrossCheckBundleCorePayload = Omit<CrossCheckBundlePayload, 'generatedAt' | 'checksum'>;

function normalizeTransparencyEntries(
  entries: CrossCheckBundlePayload['transparencyEntries'],
): CrossCheckBundlePayload['transparencyEntries'] {
  return [...entries].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt) || left.lifecycleState.localeCompare(right.lifecycleState),
  );
}

export function computeCrossCheckBundleChecksum(payload: CrossCheckBundleCorePayload): string {
  const normalizedPayload = {
    ...payload,
    transparencyEntries: normalizeTransparencyEntries(payload.transparencyEntries),
  };
  return hashDeterministicPayload(normalizedPayload);
}

export async function generateCrossCheckBundle(artifactId: string): Promise<CrossCheckBundlePayload> {
  const normalizedArtifactId = artifactId.trim();
  if (!normalizedArtifactId) {
    throw new Error('artifactId is required');
  }

  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: normalizedArtifactId },
    select: {
      id: true,
      npi: true,
      checksum: true,
      merkleRoot: true,
      lifecycleState: true,
    },
  });

  if (!artifact) {
    throw new Error('Artifact not found');
  }

  const crossCheckResult = await runIndependentCrossCheck(normalizedArtifactId);
  const pecos = await runPecosCheck(artifact.npi);
  const nursysEventCount = await prisma.nursysEvent.count({
    where: { npi: artifact.npi },
  });
  const transparencyEntries = (await getTransparencyEntries(normalizedArtifactId)).map((entry) => ({
    fingerprint: entry.fingerprint,
    merkleRoot: entry.merkleRoot,
    lifecycleState: entry.lifecycleState,
    createdAt: entry.createdAt.toISOString(),
  }));

  const generatedAt = new Date().toISOString();
  const bundlePayload = {
    artifactId: artifact.id,
    fingerprint: artifact.checksum,
    merkleRoot: artifact.merkleRoot ?? '',
    lifecycleState: artifact.lifecycleState,
    pecosEnrollmentStatus: pecos.enrolled,
    nursysEventCount,
    transparencyEntries,
    crossCheckPass: crossCheckResult.passed,
    generatedAt,
  };

  const { generatedAt: _, ...bundlePayloadForChecksum } = bundlePayload;
  const checksum = computeCrossCheckBundleChecksum(bundlePayloadForChecksum);

  await prisma.crossCheckBundle.create({
    data: {
      artifactId: artifact.id,
      checksum,
      crossCheckPass: crossCheckResult.passed,
    },
  });

  return {
    ...bundlePayload,
    checksum,
  };
}
