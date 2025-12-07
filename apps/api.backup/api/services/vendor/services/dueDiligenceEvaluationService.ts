/**
 * B240B-VM-011: Due Diligence Evaluation Service
 *
 * Evaluates vendor responses to due diligence checklists.
 * Scores vendor responses without using sensitive personal data.
 */

import { PrismaClient, ScoringMethod } from '@prisma/client';
import { ChecklistItem } from '../models/DueDiligenceChecklist';

export interface EvaluationResponse {
  itemId: string;
  answer: string | boolean | number;
  score?: number;
  notes?: string;
}

export interface EvaluationInput {
  vendorId: string;
  checklistId: string;
  responses: EvaluationResponse[];
  evaluatedBy?: string;
}

export interface EvaluationResult {
  id: string;
  vendorId: string;
  checklistId: string;
  totalScore: number;
  maxScore: number;
  percentageScore: number;
  responses: EvaluationResponse[];
  evaluatedAt: Date;
}

/**
 * Evaluate vendor responses to a due diligence checklist
 * Avoids using sensitive personal data in scoring calculations
 */
export async function evaluateDueDiligence(
  prisma: PrismaClient,
  input: EvaluationInput
): Promise<EvaluationResult> {
  // Get the checklist
  const checklist = await prisma.dueDiligenceChecklist.findUnique({
    where: { id: input.checklistId },
  });

  if (!checklist) {
    throw new Error(`Checklist ${input.checklistId} not found`);
  }

  const items = checklist.items as ChecklistItem[];
  const scoringMethod = checklist.scoringMethod;

  // Calculate scores based on method
  let totalScore = 0;
  let maxScore = 0;
  const scoredResponses: EvaluationResponse[] = [];

  for (const response of input.responses) {
    const item = items.find((i) => i.id === response.itemId);
    if (!item) {
      continue; // Skip unknown items
    }

    let itemScore = 0;
    let itemMaxScore = 0;

    if (scoringMethod === ScoringMethod.WEIGHTED) {
      // Weighted scoring: use weight if provided, otherwise default to 1
      const weight = item.weight ?? 1;
      itemMaxScore = weight;

      // Score based on answer type
      if (typeof response.answer === 'boolean') {
        itemScore = response.answer ? weight : 0;
      } else if (typeof response.answer === 'number') {
        // Normalize to 0-1, then multiply by weight
        itemScore = Math.min(Math.max(response.answer, 0), 1) * weight;
      } else if (typeof response.answer === 'string') {
        // For string answers, check if it's a valid response (non-empty)
        itemScore = response.answer.trim().length > 0 ? weight : 0;
      }

      // Use provided score if available (override calculation)
      if (response.score !== undefined) {
        itemScore = response.score;
      }
    } else {
      // Boolean scoring: pass/fail
      itemMaxScore = 1;
      if (typeof response.answer === 'boolean') {
        itemScore = response.answer ? 1 : 0;
      } else if (typeof response.answer === 'string') {
        itemScore = response.answer.trim().length > 0 ? 1 : 0;
      } else if (typeof response.answer === 'number') {
        itemScore = response.answer > 0 ? 1 : 0;
      }

      // Use provided score if available
      if (response.score !== undefined) {
        itemScore = response.score > 0 ? 1 : 0;
      }
    }

    totalScore += itemScore;
    maxScore += itemMaxScore;

    scoredResponses.push({
      ...response,
      score: itemScore,
    });
  }

  // Create evaluation record
  const evaluation = await prisma.dueDiligenceEvaluation.create({
    data: {
      vendorId: input.vendorId,
      checklistId: input.checklistId,
      responses: scoredResponses as any,
      totalScore,
      maxScore,
      evaluatedBy: input.evaluatedBy,
    },
  });

  const percentageScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  return {
    id: evaluation.id,
    vendorId: evaluation.vendorId,
    checklistId: evaluation.checklistId,
    totalScore,
    maxScore,
    percentageScore,
    responses: scoredResponses,
    evaluatedAt: evaluation.evaluatedAt,
  };
}

/**
 * Get evaluation by ID
 */
export async function getDueDiligenceEvaluation(
  prisma: PrismaClient,
  id: string
): Promise<EvaluationResult | null> {
  const evaluation = await prisma.dueDiligenceEvaluation.findUnique({
    where: { id },
    include: {
      checklist: true,
    },
  });

  if (!evaluation) {
    return null;
  }

  const totalScore = evaluation.totalScore ?? 0;
  const maxScore = evaluation.maxScore ?? 0;
  const percentageScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  return {
    id: evaluation.id,
    vendorId: evaluation.vendorId,
    checklistId: evaluation.checklistId,
    totalScore,
    maxScore,
    percentageScore,
    responses: evaluation.responses as EvaluationResponse[],
    evaluatedAt: evaluation.evaluatedAt,
  };
}

/**
 * Get all evaluations for a vendor
 */
export async function getVendorDueDiligenceEvaluations(
  prisma: PrismaClient,
  vendorId: string
): Promise<EvaluationResult[]> {
  const evaluations = await prisma.dueDiligenceEvaluation.findMany({
    where: { vendorId },
    orderBy: { evaluatedAt: 'desc' },
    include: {
      checklist: true,
    },
  });

  return evaluations.map((evaluation) => {
    const totalScore = evaluation.totalScore ?? 0;
    const maxScore = evaluation.maxScore ?? 0;
    const percentageScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    return {
      id: evaluation.id,
      vendorId: evaluation.vendorId,
      checklistId: evaluation.checklistId,
      totalScore,
      maxScore,
      percentageScore,
      responses: evaluation.responses as EvaluationResponse[],
      evaluatedAt: evaluation.evaluatedAt,
    };
  });
}

