import type { DocumentFingerprint, PrismaClient } from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';

import type { PixelDiffStats, TemplateRegionObservation } from '../fraud/tamper';

const prisma = new DefaultPrismaClient();

export interface DocumentFingerprintFeatures {
  checksum?: string;
  textDensity?: number;
  fontVariance?: number;
  templateRegions?: TemplateRegionObservation[];
  pixelDiffStats?: PixelDiffStats;
  [key: string]: unknown;
}

export interface FingerprintComparisonRequest {
  clinicianId: string;
  fingerprintHash: string;
  features?: DocumentFingerprintFeatures;
  threshold?: number;
  sampleSize?: number;
  scope?: 'clinician' | 'global';
  prisma?: PrismaClient;
}

export interface FingerprintCollision {
  fingerprintId: string;
  clinicianId: string;
  similarity: number;
  reason: string[];
  matchedFields: string[];
  recordedAt: string;
}

export interface FingerprintComparisonResult {
  collisions: FingerprintCollision[];
  duplicateScore: number;
  evaluatedAt: string;
  sampleSize: number;
}

export async function compareFingerprintAgainstLedger(
  request: FingerprintComparisonRequest,
): Promise<FingerprintComparisonResult> {
  if (!request.clinicianId) {
    throw new Error('clinicianId is required for fingerprint comparison');
  }
  if (!request.fingerprintHash) {
    throw new Error('fingerprintHash is required for fingerprint comparison');
  }

  const client = request.prisma ?? prisma;
  const sampleSize = request.sampleSize ?? 40;
  const threshold = request.threshold ?? 0.78;
  const scopeFilter =
    request.scope === 'clinician'
      ? { clinicianId: request.clinicianId }
      : { hash: { not: request.fingerprintHash } };

  const records = await client.documentFingerprint.findMany({
    where: scopeFilter,
    orderBy: { createdAt: 'desc' },
    take: sampleSize,
  });

  const baseFeatures = request.features ?? {};
  const collisions = records
    .map((record) => {
      const candidateFeatures = coerceFeatures(record);
      const { score, rationale, matchedFields } = computeSimilarity(
        baseFeatures,
        candidateFeatures,
        request.fingerprintHash,
        record.hash,
      );
      return {
        fingerprintId: record.id,
        clinicianId: record.clinicianId,
        similarity: score,
        reason: rationale,
        matchedFields,
        recordedAt: record.createdAt.toISOString(),
      };
    })
    .filter((collision) => collision.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);

  return {
    collisions,
    duplicateScore: collisions.at(0)?.similarity ?? 0,
    evaluatedAt: new Date().toISOString(),
    sampleSize: records.length,
  };
}

function coerceFeatures(record: DocumentFingerprint): DocumentFingerprintFeatures {
  const payload = record.features;
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  return payload as DocumentFingerprintFeatures;
}

function computeSimilarity(
  base: DocumentFingerprintFeatures,
  candidate: DocumentFingerprintFeatures,
  baseHash: string,
  candidateHash: string,
): { score: number; rationale: string[]; matchedFields: string[] } {
  if (!base && baseHash === candidateHash) {
    return { score: 1, rationale: ['identical_hash'], matchedFields: ['hash'] };
  }

  let score = 0;
  let weight = 0;
  const rationale: string[] = [];
  const matchedFields: string[] = [];

  if (baseHash === candidateHash) {
    return { score: 1, rationale: ['identical_hash'], matchedFields: ['hash'] };
  }

  if (base.checksum && candidate.checksum) {
    weight += 0.4;
    if (base.checksum === candidate.checksum) {
      score += 0.4;
      rationale.push('checksum_match');
      matchedFields.push('checksum');
    }
  }

  if (typeof base.textDensity === 'number' && typeof candidate.textDensity === 'number') {
    weight += 0.15;
    const delta = Math.abs(base.textDensity - candidate.textDensity);
    const similarity = clamp01(1 - delta / 0.25);
    score += similarity * 0.15;
    if (similarity > 0.8) {
      rationale.push('text_density');
      matchedFields.push('textDensity');
    }
  }

  if (typeof base.fontVariance === 'number' && typeof candidate.fontVariance === 'number') {
    weight += 0.15;
    const delta = Math.abs(base.fontVariance - candidate.fontVariance);
    const similarity = clamp01(1 - delta / 4);
    score += similarity * 0.15;
    if (similarity > 0.8) {
      rationale.push('font_variance');
      matchedFields.push('fontVariance');
    }
  }

  if (base.templateRegions?.length && candidate.templateRegions?.length) {
    weight += 0.2;
    const regionSimilarity = compareTemplateRegions(base.templateRegions, candidate.templateRegions);
    score += regionSimilarity * 0.2;
    if (regionSimilarity > 0.75) {
      rationale.push('template_regions');
      matchedFields.push('templateRegions');
    }
  }

  if (base.pixelDiffStats && candidate.pixelDiffStats) {
    weight += 0.1;
    const pixelSimilarity = comparePixelStats(base.pixelDiffStats, candidate.pixelDiffStats);
    score += pixelSimilarity * 0.1;
    if (pixelSimilarity > 0.7) {
      rationale.push('pixel_stats');
      matchedFields.push('pixelDiffStats');
    }
  }

  if (!weight) {
    return { score: 0, rationale: [], matchedFields: [] };
  }

  return {
    score: clamp01(score / weight),
    rationale,
    matchedFields,
  };
}

function compareTemplateRegions(
  base: TemplateRegionObservation[],
  candidate: TemplateRegionObservation[],
): number {
  const lookup = new Map<string, TemplateRegionObservation>();
  candidate.forEach((region) => lookup.set(region.regionId, region));

  const overlaps: number[] = [];
  base.forEach((region) => {
    const other = lookup.get(region.regionId);
    if (!other) return;
    const expectedDelta = Math.abs((region.expectedShapeScore ?? 0) - (other.expectedShapeScore ?? 0));
    const detectedDelta = Math.abs((region.detectedShapeScore ?? 0) - (other.detectedShapeScore ?? 0));
    const confidenceDelta = Math.abs((region.matchConfidence ?? 0) - (other.matchConfidence ?? 0));
    const similarity = clamp01(1 - (expectedDelta + detectedDelta + confidenceDelta) / 3);
    overlaps.push(similarity);
  });

  if (!overlaps.length) {
    return 0.2;
  }

  return overlaps.reduce((sum, value) => sum + value, 0) / overlaps.length;
}

function comparePixelStats(base: PixelDiffStats, candidate: PixelDiffStats): number {
  const noiseDelta = Math.abs((base.noiseRatio ?? 0) - (candidate.noiseRatio ?? 0));
  const cloneDelta = Math.abs(
    (base.clonePatchCount ?? 0) - (candidate.clonePatchCount ?? 0),
  );
  const edgeDelta = Math.abs((base.edgeDeviation ?? 0) - (candidate.edgeDeviation ?? 0));

  const noiseScore = clamp01(1 - noiseDelta);
  const cloneScore = clamp01(1 - cloneDelta / 6);
  const edgeScore = clamp01(1 - edgeDelta / 2);

  return clamp01(noiseScore * 0.4 + cloneScore * 0.35 + edgeScore * 0.25);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

