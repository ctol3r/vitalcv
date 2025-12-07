/**
 * B247A-GAM-003: ActionPointsDefinition Model
 *
 * Stores point value per action: id, actionType, points, description, isActive
 * Allows dynamic changes without code deployments
 */

import { PrismaClient } from '@prisma/client';
import { RewardActionType } from './RewardPointsTransaction';

export interface ActionPointsDefinitionInput {
  actionType: RewardActionType;
  points: number;
  description: string;
  isActive?: boolean;
}

export interface ActionPointsDefinition {
  id: string;
  actionType: RewardActionType;
  points: number;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate action points definition input
 */
export function validateActionPointsInput(input: ActionPointsDefinitionInput): void {
  if (!Object.values(RewardActionType).includes(input.actionType)) {
    throw new Error(`Invalid actionType: ${input.actionType}`);
  }
  if (typeof input.points !== 'number' || !Number.isInteger(input.points)) {
    throw new Error('points must be an integer');
  }
  if (!input.description || input.description.trim().length === 0) {
    throw new Error('description is required');
  }
}

/**
 * Create or update an action points definition
 */
export async function upsertActionPointsDefinition(
  prisma: PrismaClient,
  input: ActionPointsDefinitionInput
): Promise<ActionPointsDefinition> {
  validateActionPointsInput(input);

  return prisma.actionPointsDefinition.upsert({
    where: { actionType: input.actionType },
    update: {
      points: input.points,
      description: input.description,
      isActive: input.isActive ?? true,
      updatedAt: new Date(),
    },
    create: {
      actionType: input.actionType,
      points: input.points,
      description: input.description,
      isActive: input.isActive ?? true,
    },
  });
}

/**
 * Get action points definition by action type
 */
export async function getActionPointsDefinition(
  prisma: PrismaClient,
  actionType: RewardActionType
): Promise<ActionPointsDefinition | null> {
  return prisma.actionPointsDefinition.findUnique({
    where: { actionType },
  });
}

/**
 * Get all active action points definitions
 */
export async function getAllActiveActionPoints(
  prisma: PrismaClient
): Promise<ActionPointsDefinition[]> {
  return prisma.actionPointsDefinition.findMany({
    where: { isActive: true },
    orderBy: { actionType: 'asc' },
  });
}

/**
 * Get all action points definitions (including inactive)
 */
export async function getAllActionPoints(
  prisma: PrismaClient
): Promise<ActionPointsDefinition[]> {
  return prisma.actionPointsDefinition.findMany({
    orderBy: { actionType: 'asc' },
  });
}

/**
 * Deactivate an action points definition
 */
export async function deactivateActionPoints(
  prisma: PrismaClient,
  actionType: RewardActionType
): Promise<ActionPointsDefinition> {
  return prisma.actionPointsDefinition.update({
    where: { actionType },
    data: { isActive: false, updatedAt: new Date() },
  });
}

/**
 * Activate an action points definition
 */
export async function activateActionPoints(
  prisma: PrismaClient,
  actionType: RewardActionType
): Promise<ActionPointsDefinition> {
  return prisma.actionPointsDefinition.update({
    where: { actionType },
    data: { isActive: true, updatedAt: new Date() },
  });
}

