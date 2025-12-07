/**
 * B131F-GENAI-001: RiskCategory model service
 *
 * Service for managing GenAI risk categories aligned with NIST GenAI risk taxonomy.
 */

import { PrismaClient } from '@prisma/client';

// Use singleton pattern for Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export interface RiskCategory {
  id: string;
  riskId: string;
  category: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get all risk categories
 */
export async function getAllRiskCategories(): Promise<RiskCategory[]> {
  return prisma.riskCategory.findMany({
    orderBy: { category: 'asc' },
  });
}

/**
 * Get risk category by riskId
 */
export async function getRiskCategoryByRiskId(riskId: string): Promise<RiskCategory | null> {
  return prisma.riskCategory.findUnique({
    where: { riskId },
  });
}

/**
 * Get risk categories by IDs
 */
export async function getRiskCategoriesByIds(riskIds: string[]): Promise<RiskCategory[]> {
  return prisma.riskCategory.findMany({
    where: {
      riskId: {
        in: riskIds,
      },
    },
  });
}

/**
 * Create risk category
 */
export async function createRiskCategory(data: {
  riskId: string;
  category: string;
  description: string;
}): Promise<RiskCategory> {
  return prisma.riskCategory.create({
    data,
  });
}

/**
 * Update risk category
 */
export async function updateRiskCategory(
  riskId: string,
  data: {
    category?: string;
    description?: string;
  }
): Promise<RiskCategory> {
  return prisma.riskCategory.update({
    where: { riskId },
    data,
  });
}

/**
 * Delete risk category
 */
export async function deleteRiskCategory(riskId: string): Promise<void> {
  await prisma.riskCategory.delete({
    where: { riskId },
  });
}

