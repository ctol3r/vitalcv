import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = initializePrisma();

export interface TemplateRegionObservation {
  regionId: string;
  expectedShapeScore: number;
  detectedShapeScore: number;
  matchConfidence: number;
}

export interface PixelDiffStats {
  noiseRatio: number;
  clonePatchCount: number;
  edgeDeviation: number;
}

export interface TamperDetectionPayload {
  clinicianId: string;
  documentId: string;
  hash: string;
  checksum?: string;
  textDensity?: number;
  fontSizes?: number[];
  templateRegions?: TemplateRegionObservation[];
  pixelDiffStats?: PixelDiffStats;
  metadata?: Record<string, unknown>;
}

export interface TamperDetectionResult {
  tamperLikelihood: number;
  reasons: string[];
  signals: {
    fontInstability: number;
    pixelManipulation: number;
    templateDeviation: number;
  };
  fingerprintId?: string;
  evaluatedAt: string;
}

export async function detectTampering(
  payload: TamperDetectionPayload,
): Promise<TamperDetectionResult> {
  if (!payload.clinicianId) {
    throw new Error('clinicianId is required for tamper detection');
  }
  if (!payload.documentId) {
    throw new Error('documentId is required for tamper detection');
  }

  const fontInstability = computeFontInstability(payload.fontSizes);
  const pixelManipulation = computePixelManipulation(payload.pixelDiffStats);
  const templateDeviation = computeTemplateDeviation(payload.templateRegions);

  const weights = {
    font: 0.35,
    pixel: 0.4,
    template: 0.25,
  };

  const tamperLikelihood = clamp01(
    fontInstability * weights.font +
      pixelManipulation * weights.pixel +
      templateDeviation * weights.template,
  );

  const reasons: string[] = [];
  if (fontInstability > 0.4) {
    reasons.push('Inconsistent font sizing between headers and credential body text.');
  }
  if (pixelManipulation > 0.35) {
    reasons.push('Pixel-level artifacts detected around seals and signatures.');
  }
  if (templateDeviation > 0.3) {
    reasons.push('Template region outlines deviate from canonical license layout.');
  }
  if (!reasons.length && tamperLikelihood > 0.2) {
    reasons.push('Minor anomalies observed that merit manual review.');
  }

  const fingerprintRecord = await persistFingerprint({
    clinicianId: payload.clinicianId,
    hash: payload.hash || hashFromDocument(payload),
    features: {
      checksum: payload.checksum ?? hashFromDocument(payload),
      textDensity: payload.textDensity ?? estimateTextDensity(payload.fontSizes),
      fontVariance: Number(computeVariance(payload.fontSizes).toFixed(4)),
      templateRegions: payload.templateRegions ?? [],
      pixelDiffStats: payload.pixelDiffStats ?? null,
      metadata: payload.metadata ?? {},
      updatedAt: new Date().toISOString(),
    },
  });

  return {
    tamperLikelihood,
    reasons,
    signals: {
      fontInstability: Number(fontInstability.toFixed(4)),
      pixelManipulation: Number(pixelManipulation.toFixed(4)),
      templateDeviation: Number(templateDeviation.toFixed(4)),
    },
    fingerprintId: fingerprintRecord?.id,
    evaluatedAt: new Date().toISOString(),
  };
}

function computeFontInstability(fontSizes?: number[]): number {
  if (!fontSizes?.length) {
    return 0;
  }
  const variance = computeVariance(fontSizes);
  const normalized = Math.min(variance / 8, 1); // variance over 8pt swings is suspicious
  return normalized;
}

function computePixelManipulation(stats?: PixelDiffStats): number {
  if (!stats) {
    return 0.1; // neutral baseline when we have no pixel data
  }
  const noiseSignal = clamp01(stats.noiseRatio);
  const cloneSignal = clamp01(stats.clonePatchCount / 6); // assume 6+ patches is severe
  const edgeSignal = clamp01(Math.abs(stats.edgeDeviation));
  return clamp01(noiseSignal * 0.45 + cloneSignal * 0.35 + edgeSignal * 0.2);
}

function computeTemplateDeviation(regions?: TemplateRegionObservation[]): number {
  if (!regions?.length) {
    return 0.15;
  }
  const deviations = regions.map((region) => {
    const expected = region.expectedShapeScore || 1;
    const detected = region.detectedShapeScore || 0;
    const raw = Math.abs(expected - detected);
    const confidencePenalty = 1 - clamp01(region.matchConfidence);
    return clamp01(raw * 0.7 + confidencePenalty * 0.3);
  });

  const average = deviations.reduce((sum, val) => sum + val, 0) / deviations.length;
  return clamp01(average);
}

function computeVariance(values?: number[]): number {
  if (!values?.length || values.length === 1) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return variance;
}

function estimateTextDensity(fontSizes?: number[]): number {
  if (!fontSizes?.length) {
    return 0.62;
  }
  const baseline = fontSizes.reduce((sum, value) => sum + value, 0) / fontSizes.length;
  return clamp01(baseline / 18); // assume 18pt = 100% density
}

function hashFromDocument(payload: TamperDetectionPayload): string {
  const seed = JSON.stringify({
    clinicianId: payload.clinicianId,
    documentId: payload.documentId,
    fontSizes: payload.fontSizes ?? [],
  });
  return createHash('sha256').update(seed).digest('hex');
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function initializePrisma(): PrismaClient | null {
  try {
    return new PrismaClient();
  } catch (error) {
    console.warn('[fraud][tamper] Prisma unavailable, running in stateless mode', error);
    return null;
  }
}

async function persistFingerprint(record: {
  clinicianId: string;
  hash: string;
  features: Record<string, unknown>;
}) {
  if (!prisma) {
    return null;
  }

  const delegate = (prisma as any).documentFingerprint;
  if (!delegate?.upsert) {
    return null;
  }

  try {
    return await delegate.upsert({
      where: { hash: record.hash },
      update: {
        clinicianId: record.clinicianId,
        features: record.features,
      },
      create: {
        clinicianId: record.clinicianId,
        hash: record.hash,
        features: record.features,
      },
    });
  } catch (error) {
    console.warn('[fraud][tamper] Failed to persist fingerprint', error);
    return null;
  }
}










