/**
 * B247A-GAM-001: RewardPointsTransaction Model
 *
 * Defines schema for point transactions with id, userId, actionType (enum), points (int), description, createdAt
 */

import { PrismaClient } from '@prisma/client';

export enum RewardActionType {
  PROFILE_COMPLETE = 'PROFILE_COMPLETE',
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  CREDENTIAL_VERIFIED = 'CREDENTIAL_VERIFIED',
  TRAINING_COMPLETED = 'TRAINING_COMPLETED',
  COMMUNITY_POST = 'COMMUNITY_POST',
  REFERRAL = 'REFERRAL',
  DAILY_LOGIN = 'DAILY_LOGIN',
  REDEMPTION = 'REDEMPTION',
  EXPIRATION = 'EXPIRATION',
}

export interface RewardPointsTransactionInput {
  userId: string;
  actionType: RewardActionType;
  points: number;
  description: string;
}

export interface RewardPointsTransaction {
  id: string;
  userId: string;
  actionType: RewardActionType;
  points: number;
  description: string;
  createdAt: Date;
}

/**
 * Validate transaction input
 */
export function validateTransactionInput(input: RewardPointsTransactionInput): void {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new Error('userId is required');
  }
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
 * Create a reward points transaction
 */
export async function createRewardPointsTransaction(
  prisma: PrismaClient,
  input: RewardPointsTransactionInput
): Promise<RewardPointsTransaction> {
  validateTransactionInput(input);

  return prisma.rewardPointsTransaction.create({
    data: {
      userId: input.userId,
      actionType: input.actionType,
      points: input.points,
      description: input.description,
    },
  });
}

/**
 * Get transaction by ID
 */
export async function getTransactionById(
  prisma: PrismaClient,
  id: string
): Promise<RewardPointsTransaction | null> {
  return prisma.rewardPointsTransaction.findUnique({
    where: { id },
  });
}

/**
 * Get all transactions for a user
 */
export async function getUserTransactions(
  prisma: PrismaClient,
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    actionType?: RewardActionType;
    orderBy?: 'asc' | 'desc';
  }
): Promise<RewardPointsTransaction[]> {
  return prisma.rewardPointsTransaction.findMany({
    where: {
      userId,
      ...(options?.actionType && { actionType: options.actionType }),
    },
    orderBy: {
      createdAt: options?.orderBy || 'desc',
    },
    take: options?.limit,
    skip: options?.offset,
  });
}

/**
 * Calculate user's current balance
 */
export async function getUserBalance(
  prisma: PrismaClient,
  userId: string
): Promise<number> {
  const result = await prisma.rewardPointsTransaction.aggregate({
    where: { userId },
    _sum: {
      points: true,
    },
  });

  return result._sum.points || 0;
}

/**
 * Get transaction count for a user
 */
export async function getUserTransactionCount(
  prisma: PrismaClient,
  userId: string,
  actionType?: RewardActionType
): Promise<number> {
  return prisma.rewardPointsTransaction.count({
    where: {
      userId,
      ...(actionType && { actionType }),
    },
  });
}

