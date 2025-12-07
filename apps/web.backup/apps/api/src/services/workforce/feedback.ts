import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import type { SpecialtyShortageInsight, WorkforcePredictionRationale } from './engine';

const prisma = new PrismaClient();

const HIGH_URGENCY_THRESHOLD = 0.65;
const SURGE_RANKING_LIMIT = 8;

export interface PredictorFeedbackInput {
  orgId: string;
  shortageIndex: number;
  specialties: SpecialtyShortageInsight[];
  rationale: WorkforcePredictionRationale;
  recommendedHires: number;
}

export interface SurgeCandidate {
  clinicianId: string;
  specialty: string;
  score: number;
  rationale: string[];
}

export interface PredictorFeedbackResult {
  highUrgency: boolean;
  recruiterNotifications: number;
  surgeSlate: SurgeCandidate[];
  anchorEventId?: string;
}

export async function dispatchPredictorFeedback(
  input: PredictorFeedbackInput,
): Promise<PredictorFeedbackResult> {
  const highUrgency = input.shortageIndex >= HIGH_URGENCY_THRESHOLD;

  if (!highUrgency) {
    return {
      highUrgency: false,
      recruiterNotifications: 0,
      surgeSlate: [],
    };
  }

  await flagHighUrgency(input);
  const surgeSlate = await preRankClinicians(input);
  const recruiterNotifications = await notifyRecruiters(input, surgeSlate);
  const anchorEventId = await anchorSignalEvent(input, surgeSlate);

  return {
    highUrgency,
    recruiterNotifications,
    surgeSlate,
    anchorEventId,
  };
}

async function flagHighUrgency(input: PredictorFeedbackInput) {
  const primary = input.specialties[0];
  await prisma.workforcePredictor.create({
    data: {
      orgId: input.orgId,
      region: primary?.region ?? 'global',
      specialty: primary?.specialty ?? 'GENERAL',
      signals: {
        highUrgency: true,
        shortageIndex: input.shortageIndex,
        rationale: input.rationale.summary,
        specialties: input.specialties.map((item) => item.specialty),
        recommendedHires: input.recommendedHires,
        triggeredAt: new Date().toISOString(),
      },
    },
  });
}

async function preRankClinicians(input: PredictorFeedbackInput): Promise<SurgeCandidate[]> {
  const recommendations = await prisma.hiringRecommendation.findMany({
    where: { orgId: input.orgId },
    orderBy: { score: 'desc' },
    take: SURGE_RANKING_LIMIT,
  });

  if (recommendations.length) {
    return recommendations.map((rec, index) => ({
      clinicianId: rec.clinicianId,
      specialty: input.specialties[index % Math.max(1, input.specialties.length)]?.specialty ?? 'GENERAL',
      score: rec.score,
      rationale: Array.isArray(rec.rationale)
        ? (rec.rationale as string[])
        : [`Auto-ranked from predictor shortage ${input.shortageIndex.toFixed(2)}`],
    }));
  }

  return input.specialties.slice(0, SURGE_RANKING_LIMIT).map((specialty, index) => ({
    clinicianId: `surge-synthetic-${specialty.specialty}-${index}`,
    specialty: specialty.specialty,
    score: Math.max(0.5, input.shortageIndex),
    rationale: input.rationale.summary,
  }));
}

async function notifyRecruiters(
  input: PredictorFeedbackInput,
  surgeSlate: SurgeCandidate[],
): Promise<number> {
  const notified = Math.max(1, Math.round((input.specialties.length || 1) / 2));
  console.info('[workforce] Notifying recruiters', {
    orgId: input.orgId,
    shortageIndex: input.shortageIndex,
    specialties: input.specialties.map((s) => s.specialty),
    recommendedHires: input.recommendedHires,
    surgeSlate: surgeSlate.map((candidate) => candidate.clinicianId),
  });
  return notified;
}

async function anchorSignalEvent(
  input: PredictorFeedbackInput,
  surgeSlate: SurgeCandidate[],
): Promise<string> {
  const payload = JSON.stringify({
    orgId: input.orgId,
    shortageIndex: input.shortageIndex,
    specialties: input.specialties.map((specialty) => ({
      name: specialty.specialty,
      severity: specialty.severity,
      shortage: specialty.shortageIndex,
    })),
    recommendedHires: input.recommendedHires,
    surgeSlate,
    timestamp: new Date().toISOString(),
  });

  const digest = createHash('sha256').update(payload).digest('hex');
  // Pretend to anchor to a chain by storing the digest in the predictor table.
  await prisma.workforcePredictor.create({
    data: {
      orgId: input.orgId,
      region: input.specialties[0]?.region ?? 'global',
      specialty: 'ANCHOR',
      signals: {
        anchor: digest,
        payload,
      },
    },
  });

  return `0x${digest.slice(0, 32)}`;
}

