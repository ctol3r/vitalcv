/**
 * feedbackService.ts — Wave 119: Feedback & Growth Loop
 */

import { PrismaClient } from '@prisma/client';
import { log } from '../../obs/logger';

const prisma = new PrismaClient();

export async function submitFeedback(
  type: 'nps' | 'bug' | 'feature',
  message: string,
  score?: number,
  email?: string,
): Promise<{ id: string }> {
  const record = await prisma.feedback.create({
    data: { type, message, score: score ?? null, email: email ?? null },
  });
  log('info', 'feedback_submitted', { type, score, id: record.id });
  return { id: record.id };
}

export async function getAverageNps(): Promise<number> {
  const result = await prisma.feedback.aggregate({
    where: { type: 'nps', score: { not: null } },
    _avg: { score: true },
  });
  return Math.round((result._avg.score ?? 0) * 10) / 10;
}

export async function getFeedbackByType(type: string) {
  return prisma.feedback.findMany({
    where: { type },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function getRecentFeedback(limit: number = 20) {
  return prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getFeedbackSummary() {
  const [nps, bugs, features, avgNps, total] = await Promise.all([
    prisma.feedback.count({ where: { type: 'nps' } }),
    prisma.feedback.count({ where: { type: 'bug' } }),
    prisma.feedback.count({ where: { type: 'feature' } }),
    getAverageNps(),
    prisma.feedback.count(),
  ]);
  return { total, nps, bugs, features, avgNps };
}
