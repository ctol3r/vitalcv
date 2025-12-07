/**
 * B249B-LRN-019: ContinuingEducationRequirement Model
 *
 * Schema: id, profession (string), requirementName, creditHoursRequired (decimal),
 * period (yearly/biannual), createdAt, updatedAt; used to track CEU compliance
 */

import { PrismaClient } from '@prisma/client';

export enum CEUPeriod {
  YEARLY = 'YEARLY',
  BIANNUAL = 'BIANNUAL',
}

export interface ContinuingEducationRequirementInput {
  profession: string;
  requirementName: string;
  creditHoursRequired: number;
  period: CEUPeriod;
}

export interface ContinuingEducationRequirement {
  id: string;
  profession: string;
  requirementName: string;
  creditHoursRequired: number;
  period: CEUPeriod;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create continuing education requirement
 */
export async function createContinuingEducationRequirement(
  prisma: PrismaClient,
  input: ContinuingEducationRequirementInput
): Promise<ContinuingEducationRequirement> {
  if (!input.profession || input.profession.trim().length === 0) {
    throw new Error('profession is required');
  }
  if (!input.requirementName || input.requirementName.trim().length === 0) {
    throw new Error('requirementName is required');
  }
  if (typeof input.creditHoursRequired !== 'number' || input.creditHoursRequired < 0) {
    throw new Error('creditHoursRequired must be a non-negative number');
  }
  if (!Object.values(CEUPeriod).includes(input.period)) {
    throw new Error(`period must be one of: ${Object.values(CEUPeriod).join(', ')}`);
  }

  return prisma.continuingEducationRequirement.create({
    data: {
      profession: input.profession,
      requirementName: input.requirementName,
      creditHoursRequired: input.creditHoursRequired,
      period: input.period,
    },
  });
}

/**
 * Get requirement by ID
 */
export async function getContinuingEducationRequirement(
  prisma: PrismaClient,
  requirementId: string
): Promise<ContinuingEducationRequirement | null> {
  return prisma.continuingEducationRequirement.findUnique({
    where: { id: requirementId },
  });
}

/**
 * List requirements by profession
 */
export async function listContinuingEducationRequirements(
  prisma: PrismaClient,
  profession?: string
): Promise<ContinuingEducationRequirement[]> {
  return prisma.continuingEducationRequirement.findMany({
    where: profession ? { profession } : {},
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update requirement
 */
export async function updateContinuingEducationRequirement(
  prisma: PrismaClient,
  requirementId: string,
  updates: Partial<ContinuingEducationRequirementInput>
): Promise<ContinuingEducationRequirement> {
  if (updates.creditHoursRequired !== undefined && updates.creditHoursRequired < 0) {
    throw new Error('creditHoursRequired must be non-negative');
  }
  if (updates.period && !Object.values(CEUPeriod).includes(updates.period)) {
    throw new Error(`period must be one of: ${Object.values(CEUPeriod).join(', ')}`);
  }

  return prisma.continuingEducationRequirement.update({
    where: { id: requirementId },
    data: {
      ...(updates.profession && { profession: updates.profession }),
      ...(updates.requirementName && { requirementName: updates.requirementName }),
      ...(updates.creditHoursRequired !== undefined && {
        creditHoursRequired: updates.creditHoursRequired,
      }),
      ...(updates.period && { period: updates.period }),
    },
  });
}

/**
 * Delete requirement
 */
export async function deleteContinuingEducationRequirement(
  prisma: PrismaClient,
  requirementId: string
): Promise<ContinuingEducationRequirement> {
  return prisma.continuingEducationRequirement.delete({
    where: { id: requirementId },
  });
}

