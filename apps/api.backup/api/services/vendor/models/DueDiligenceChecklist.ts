/**
 * B240B-VM-011: DueDiligenceChecklist model
 *
 * Defines the structure for due diligence checklists used to evaluate vendors.
 * Supports both weighted and boolean scoring methods.
 */

import { PrismaClient, ScoringMethod } from '@prisma/client';

export interface ChecklistItem {
  id: string;
  question: string;
  weight?: number; // For weighted scoring
  required?: boolean; // For boolean scoring
  category?: string;
}

export interface DueDiligenceChecklistInput {
  categoryId: string;
  items: ChecklistItem[];
  scoringMethod: ScoringMethod;
}

export interface DueDiligenceChecklist {
  id: string;
  categoryId: string;
  items: ChecklistItem[];
  scoringMethod: ScoringMethod;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new due diligence checklist
 */
export async function createDueDiligenceChecklist(
  prisma: PrismaClient,
  input: DueDiligenceChecklistInput
): Promise<DueDiligenceChecklist> {
  return prisma.dueDiligenceChecklist.create({
    data: {
      categoryId: input.categoryId,
      items: input.items as any,
      scoringMethod: input.scoringMethod,
    },
  });
}

/**
 * Get checklist by ID
 */
export async function getDueDiligenceChecklist(
  prisma: PrismaClient,
  id: string
): Promise<DueDiligenceChecklist | null> {
  return prisma.dueDiligenceChecklist.findUnique({
    where: { id },
  });
}

/**
 * Get checklists by category
 */
export async function getDueDiligenceChecklistsByCategory(
  prisma: PrismaClient,
  categoryId: string
): Promise<DueDiligenceChecklist[]> {
  return prisma.dueDiligenceChecklist.findMany({
    where: { categoryId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update a due diligence checklist
 */
export async function updateDueDiligenceChecklist(
  prisma: PrismaClient,
  id: string,
  input: Partial<DueDiligenceChecklistInput>
): Promise<DueDiligenceChecklist> {
  return prisma.dueDiligenceChecklist.update({
    where: { id },
    data: {
      ...(input.items && { items: input.items as any }),
      ...(input.scoringMethod && { scoringMethod: input.scoringMethod }),
    },
  });
}

/**
 * Delete a due diligence checklist
 */
export async function deleteDueDiligenceChecklist(
  prisma: PrismaClient,
  id: string
): Promise<void> {
  await prisma.dueDiligenceChecklist.delete({
    where: { id },
  });
}

