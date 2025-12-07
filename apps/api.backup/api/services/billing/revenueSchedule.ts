/**
 * B119C-ROI-024: Revenue Recognition Schedule
 *
 * Maps billing events to revenue recognition entries.
 * Ensures VITA revenue is only realized on cash settlement.
 */

import { PrismaClient } from '@prisma/client';

export type RevenueType = 'VITA' | 'FIAT';
export type RecognitionStatus = 'pending' | 'recognized' | 'settled';

export interface RevenueRecognitionInput {
  eventId: string;
  eventType: string;
  orgId?: string;
  revenueType: RevenueType;
  amount: number; // in cents (for fiat) or tokens (for VITA)
  recognizedAt?: Date;
  metadata?: Record<string, any>;
}

export interface RevenueRecognition {
  id: string;
  eventId: string;
  eventType: string;
  orgId: string | null;
  revenueType: RevenueType;
  amount: number;
  recognizedAt: Date;
  cashSettledAt: Date | null;
  settlementTxId: string | null;
  status: RecognitionStatus;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create revenue recognition entry from billing event
 */
export async function createRevenueRecognition(
  prisma: PrismaClient,
  input: RevenueRecognitionInput
): Promise<RevenueRecognition> {
  // For FIAT, revenue is recognized immediately
  // For VITA, revenue is recognized but not settled until cash settlement
  const status: RecognitionStatus = input.revenueType === 'FIAT' ? 'recognized' : 'pending';

  return prisma.revenueRecognition.create({
    data: {
      eventId: input.eventId,
      eventType: input.eventType,
      orgId: input.orgId ?? null,
      revenueType: input.revenueType,
      amount: input.amount,
      recognizedAt: input.recognizedAt ?? new Date(),
      status,
      metadata: input.metadata ?? {},
    },
  });
}

/**
 * Record cash settlement for VITA revenue
 * This marks VITA revenue as realized (cash settled)
 */
export async function recordCashSettlement(
  prisma: PrismaClient,
  recognitionId: string,
  settlementTxId: string
): Promise<RevenueRecognition> {
  const recognition = await prisma.revenueRecognition.findUnique({
    where: { id: recognitionId },
  });

  if (!recognition) {
    throw new Error(`Revenue recognition ${recognitionId} not found`);
  }

  if (recognition.revenueType !== 'VITA') {
    throw new Error(`Cash settlement only applies to VITA revenue, got ${recognition.revenueType}`);
  }

  if (recognition.status === 'settled') {
    throw new Error(`Revenue recognition ${recognitionId} already settled`);
  }

  return prisma.revenueRecognition.update({
    where: { id: recognitionId },
    data: {
      cashSettledAt: new Date(),
      settlementTxId,
      status: 'settled',
      updatedAt: new Date(),
    },
  });
}

/**
 * Generate revenue recognition schedule from billing events
 */
export async function generateRevenueSchedule(
  prisma: PrismaClient,
  eventId: string,
  eventType: string,
  orgId: string | undefined,
  revenueType: RevenueType,
  amount: number,
  metadata?: Record<string, any>
): Promise<RevenueRecognition> {
  return createRevenueRecognition(prisma, {
    eventId,
    eventType,
    orgId,
    revenueType,
    amount,
    metadata,
  });
}

/**
 * Get revenue recognition entries for an organization
 */
export async function getRevenueRecognitionForOrg(
  prisma: PrismaClient,
  orgId: string,
  options?: {
    revenueType?: RevenueType;
    status?: RecognitionStatus;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<RevenueRecognition[]> {
  return prisma.revenueRecognition.findMany({
    where: {
      orgId,
      ...(options?.revenueType && { revenueType: options.revenueType }),
      ...(options?.status && { status: options.status }),
      ...(options?.startDate && { recognizedAt: { gte: options.startDate } }),
      ...(options?.endDate && { recognizedAt: { lte: options.endDate } }),
    },
    orderBy: { recognizedAt: 'desc' },
  });
}

/**
 * Get pending VITA revenue recognitions awaiting cash settlement
 */
export async function getPendingVitaRecognitions(
  prisma: PrismaClient,
  orgId?: string
): Promise<RevenueRecognition[]> {
  return prisma.revenueRecognition.findMany({
    where: {
      revenueType: 'VITA',
      status: { in: ['pending', 'recognized'] },
      ...(orgId && { orgId }),
    },
    orderBy: { recognizedAt: 'asc' },
  });
}

/**
 * Calculate total recognized revenue for an organization
 */
export async function calculateTotalRevenue(
  prisma: PrismaClient,
  orgId: string,
  options?: {
    revenueType?: RevenueType;
    includePending?: boolean;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<number> {
  const recognitions = await getRevenueRecognitionForOrg(prisma, orgId, {
    revenueType: options?.revenueType,
    status: options?.includePending ? undefined : 'settled',
    startDate: options?.startDate,
    endDate: options?.endDate,
  });

  return recognitions.reduce((sum, rec) => sum + rec.amount, 0);
}

