import { createHash } from 'crypto';
import type { DocumentFingerprint, PrismaClient, Prisma } from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';

import { buildSignalId, clampScore, ForensicsSignal, severityFromScore } from './types';

const prisma = new DefaultPrismaClient();
const DEFAULT_SAMPLE_SIZE = 120;
const DEFAULT_THRESHOLD = 0.92;

export interface DocumentReuseDetectorOptions {
  prisma?: PrismaClient;
  clinicianId: string;
  fingerprintId?: string;
  fingerprintHash?: string;
  features?: Prisma.JsonValue | null;
  sampleSize?: number;
}

export async function detectDocumentFingerprintReuse(
  options: DocumentReuseDetectorOptions,
): Promise<ForensicsSignal | null> {
  if (!options.clinicianId) {
    throw new Error('clinicianId is required to run fingerprint deduplication');
  }

  const client = options.prisma ?? prisma;
  const baseRecord = options.fingerprintId
    ? await client.documentFingerprint.findUnique({ where: { id: options.fingerprintId } })
    : null;

  const baseHash = options.fingerprintHash ?? baseRecord?.hash;
  const baseFeatures = coerceFeatures(options.features ?? baseRecord?.features ?? null);
  if (!baseHash) {
    return null;
  }

  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const candidates = await client.documentFingerprint.findMany({
    where: {
      clinicianId: { not: options.clinicianId },
    },
    orderBy: { createdAt: 'desc' },
    take: sampleSize,
  });

  const basePhash = computePerceptualHash(baseHash, baseFeatures);
  const collisions = candidates
    .map((record) => {
      const similarity = computeSimilarity(basePhash, record);
      return {
        fingerprintId: record.id,
        clinicianId: record.clinicianId,
        similarity,
        recordedAt: record.createdAt?.toISOString() ?? new Date().toISOString(),
        matchedFields: highlightOverlap(baseFeatures, coerceFeatures(record.features)),
      };
    })
    .filter((collision) => collision.similarity >= DEFAULT_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);

  if (!collisions.length) {
    return null;
  }

  const top = collisions[0];
  const score = clampScore(top.similarity);

  return {
    id: buildSignalId('document', 'fingerprint_reuse'),
    clinicianId: options.clinicianId,
    category: 'document',
    type: 'fingerprint_reuse',
    severity: severityFromScore(score),
    score,
    description:
      top.similarity > 0.97
        ? 'Document fingerprint matches artifacts issued to other clinicians.'
        : 'Perceptual hashing shows near-duplicate credential artifacts across clinicians.',
    observedAt: new Date().toISOString(),
    metadata: {
      referenceFingerprintId: options.fingerprintId ?? null,
      collisions,
      sampleSize: candidates.length,
      threshold: DEFAULT_THRESHOLD,
    },
  };
}

function coerceFeatures(input: Prisma.JsonValue | DocumentFingerprint['features'] | null): Record<string, unknown> {
  if (!input || typeof input !== 'object') {
    return {};
  }
  return { ...(input as Record<string, unknown>) };
}

function computePerceptualHash(
  hash: string,
  features: Record<string, unknown>,
): Buffer {
  const payload = {
    hash,
    checksum: features.checksum ?? null,
    textDensity: features.textDensity ?? null,
    fontVariance: features.fontVariance ?? null,
    templateRegions: Array.isArray(features.templateRegions)
      ? (features.templateRegions as unknown[]).length
      : 0,
    pixelDiffStats: features.pixelDiffStats ?? null,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest();
}

function computeSimilarity(basePhash: Buffer, record: DocumentFingerprint): number {
  const candidateHash = computePerceptualHash(record.hash, coerceFeatures(record.features));
  const bits = basePhash.length * 8;
  let distance = 0;
  for (let index = 0; index < basePhash.length; index += 1) {
    const xor = basePhash[index] ^ candidateHash[index];
    distance += countBits(xor);
  }
  return clampScore(1 - distance / bits);
}

function countBits(value: number): number {
  let count = 0;
  let temp = value;
  while (temp) {
    count += temp & 1;
    temp >>= 1;
  }
  return count;
}

function highlightOverlap(
  baseline: Record<string, unknown>,
  candidate: Record<string, unknown>,
): string[] {
  const matched: string[] = [];
  if (baseline.checksum && baseline.checksum === candidate.checksum) {
    matched.push('checksum');
  }
  if (
    typeof baseline.textDensity === 'number' &&
    typeof candidate.textDensity === 'number' &&
    Math.abs((baseline.textDensity as number) - (candidate.textDensity as number)) < 0.05
  ) {
    matched.push('textDensity');
  }
  if (
    typeof baseline.fontVariance === 'number' &&
    typeof candidate.fontVariance === 'number' &&
    Math.abs((baseline.fontVariance as number) - (candidate.fontVariance as number)) < 0.5
  ) {
    matched.push('fontVariance');
  }
  if (Array.isArray(baseline.templateRegions) && Array.isArray(candidate.templateRegions)) {
    matched.push('templateRegions');
  }
  if (baseline.pixelDiffStats && candidate.pixelDiffStats) {
    matched.push('pixelDiffStats');
  }
  return matched;
}










