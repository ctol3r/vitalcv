/**
 * B131F-GENAI-002: ModelCard model service
 *
 * Service for managing GenAI model cards with risk categories and mitigations.
 */

import { PrismaClient } from '@prisma/client';

// Use singleton pattern for Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export interface ModelCard {
  id: string;
  modelId: string;
  provider: string;
  version: string;
  trainingDataSummary?: string;
  mitigations: string[];
  metadata?: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  risks?: ModelRisk[];
}

export interface ModelRisk {
  id: string;
  modelCardId: string;
  riskCategoryId: string;
  severity: string;
  notes?: string;
  riskCategory?: {
    riskId: string;
    category: string;
    description: string;
  };
}

/**
 * Get all model cards
 */
export async function getAllModelCards(includeRisks: boolean = true): Promise<ModelCard[]> {
  return prisma.modelCard.findMany({
    where: { isActive: true },
    include: {
      risks: includeRisks
        ? {
            include: {
              riskCategory: {
                select: {
                  riskId: true,
                  category: true,
                  description: true,
                },
              },
            },
          }
        : false,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get model card by modelId
 */
export async function getModelCardByModelId(modelId: string, includeRisks: boolean = true): Promise<ModelCard | null> {
  return prisma.modelCard.findUnique({
    where: { modelId },
    include: {
      risks: includeRisks
        ? {
            include: {
              riskCategory: {
                select: {
                  riskId: true,
                  category: true,
                  description: true,
                },
              },
            },
          }
        : false,
    },
  });
}

/**
 * Get model card by ID
 */
export async function getModelCardById(id: string, includeRisks: boolean = true): Promise<ModelCard | null> {
  return prisma.modelCard.findUnique({
    where: { id },
    include: {
      risks: includeRisks
        ? {
            include: {
              riskCategory: {
                select: {
                  riskId: true,
                  category: true,
                  description: true,
                },
              },
            },
          }
        : false,
    },
  });
}

/**
 * Create model card
 */
export async function createModelCard(data: {
  modelId: string;
  provider: string;
  version: string;
  trainingDataSummary?: string;
  mitigations?: string[];
  metadata?: any;
  risks?: Array<{
    riskCategoryId: string;
    severity: string;
    notes?: string;
  }>;
}): Promise<ModelCard> {
  return prisma.modelCard.create({
    data: {
      modelId: data.modelId,
      provider: data.provider,
      version: data.version,
      trainingDataSummary: data.trainingDataSummary,
      mitigations: data.mitigations || [],
      metadata: data.metadata,
      risks: data.risks
        ? {
            create: data.risks.map((risk) => ({
              riskCategoryId: risk.riskCategoryId,
              severity: risk.severity,
              notes: risk.notes,
            })),
          }
        : undefined,
    },
    include: {
      risks: {
        include: {
          riskCategory: {
            select: {
              riskId: true,
              category: true,
              description: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Update model card
 */
export async function updateModelCard(
  modelId: string,
  data: {
    provider?: string;
    version?: string;
    trainingDataSummary?: string;
    mitigations?: string[];
    metadata?: any;
    isActive?: boolean;
  }
): Promise<ModelCard> {
  return prisma.modelCard.update({
    where: { modelId },
    data,
    include: {
      risks: {
        include: {
          riskCategory: {
            select: {
              riskId: true,
              category: true,
              description: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Add risk to model card
 */
export async function addRiskToModelCard(
  modelId: string,
  riskCategoryId: string,
  severity: string,
  notes?: string
): Promise<ModelRisk> {
  // Get model card ID
  const modelCard = await prisma.modelCard.findUnique({
    where: { modelId },
  });

  if (!modelCard) {
    throw new Error(`Model card not found: ${modelId}`);
  }

  return prisma.modelRisk.create({
    data: {
      modelCardId: modelCard.id,
      riskCategoryId,
      severity,
      notes,
    },
    include: {
      riskCategory: {
        select: {
          riskId: true,
          category: true,
          description: true,
        },
      },
    },
  });
}

/**
 * Remove risk from model card
 */
export async function removeRiskFromModelCard(modelId: string, riskCategoryId: string): Promise<void> {
  const modelCard = await prisma.modelCard.findUnique({
    where: { modelId },
  });

  if (!modelCard) {
    throw new Error(`Model card not found: ${modelId}`);
  }

  await prisma.modelRisk.deleteMany({
    where: {
      modelCardId: modelCard.id,
      riskCategoryId,
    },
  });
}

/**
 * Get decision count for model
 */
export async function getDecisionCountForModel(modelId: string): Promise<number> {
  return prisma.decisionLog.count({
    where: { modelId },
  });
}

/**
 * Get override count for model
 */
export async function getOverrideCountForModel(modelId: string): Promise<number> {
  return prisma.decisionLog.count({
    where: {
      modelId,
      humanOverride: true,
    },
  });
}

