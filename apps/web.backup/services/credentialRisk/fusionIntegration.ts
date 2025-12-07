import { PrismaClient } from '@prisma/client';
import {
  getQualityCredentialFusion,
  QualityCredentialFusionRecord,
} from '../qualityFusion/models/QualityCredentialFusion';

const prisma = new PrismaClient();

export interface FusionRiskAdjustmentResult {
  clinicianId: string;
  baseScore: number;
  fusionScore: number | null;
  modifier: number;
  adjustedScore: number;
  recommendedActions: string[];
  lastCalculatedAt?: Date;
}

export interface ApplyFusionScoreOptions {
  client?: PrismaClient;
}

export async function applyFusionScoreToRiskScore(
  clinicianId: string,
  baseScore: number,
  options: ApplyFusionScoreOptions = {}
): Promise<FusionRiskAdjustmentResult> {
  const client = options.client ?? prisma;
  const fusionRecord = await getQualityCredentialFusion(
    clinicianId,
    client as any
  );

  if (!fusionRecord) {
    return {
      clinicianId,
      baseScore: clampScore(baseScore),
      fusionScore: null,
      modifier: 0,
      adjustedScore: clampScore(baseScore),
      recommendedActions: [],
    };
  }

  const modifier = computeFusionModifier(fusionRecord.compositeScore);
  const adjustedScore = clampScore(baseScore + modifier);

  return {
    clinicianId,
    baseScore: clampScore(baseScore),
    fusionScore: fusionRecord.compositeScore,
    modifier,
    adjustedScore,
    recommendedActions: fusionRecord.recommendedActions ?? [],
    lastCalculatedAt: fusionRecord.lastCalculatedAt,
  };
}

export function computeFusionModifier(fusionScore: number): number {
  if (!Number.isFinite(fusionScore)) return 0;
  const score = Math.max(0, Math.min(100, Math.round(fusionScore)));

  if (score < 35) {
    return -Math.round((35 - score) * 0.2);
  }
  if (score < 60) {
    return Math.round((score - 35) * 0.4);
  }
  if (score < 80) {
    return Math.round(10 + (score - 60) * 0.8);
  }
  return Math.round(26 + (score - 80) * 1.1);
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
}

export const __testUtils = {
  clampScore,
};


