/**
 * B223B-MARKET-007: OrderTransaction Model
 *
 * Records each purchase: transactionId, moduleId, vendorId, purchaserId, amount, currency, timestamp, status
 */

import { PrismaClient } from '@prisma/client';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export interface OrderTransactionInput {
  transactionId: string; // External transaction ID (e.g., Stripe payment intent ID)
  moduleId: string; // Module/product ID being purchased
  vendorId: string; // Vendor/organization selling the module
  purchaserId: string; // Purchasing organization/user ID
  amount: number; // Amount in cents (for fiat) or smallest unit
  currency: string; // Currency code (e.g., 'USD', 'VITA')
  status?: TransactionStatus;
  receiptUrl?: string; // URL to receipt/invoice
  metadata?: Record<string, any>;
}

export interface OrderTransaction {
  id: string;
  transactionId: string;
  moduleId: string;
  vendorId: string;
  purchaserId: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  receiptUrl: string | null;
  metadata: any;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate transaction input
 */
export function validateTransactionInput(input: OrderTransactionInput): void {
  if (!input.transactionId) {
    throw new Error('transactionId is required');
  }
  if (!input.moduleId) {
    throw new Error('moduleId is required');
  }
  if (!input.vendorId) {
    throw new Error('vendorId is required');
  }
  if (!input.purchaserId) {
    throw new Error('purchaserId is required');
  }
  if (input.amount <= 0) {
    throw new Error(`amount must be positive, got ${input.amount}`);
  }
  if (!input.currency) {
    throw new Error('currency is required');
  }
}

/**
 * Create order transaction
 */
export async function createTransaction(
  prisma: PrismaClient,
  input: OrderTransactionInput
): Promise<OrderTransaction> {
  validateTransactionInput(input);

  return prisma.orderTransaction.create({
    data: {
      transactionId: input.transactionId,
      moduleId: input.moduleId,
      vendorId: input.vendorId,
      purchaserId: input.purchaserId,
      amount: input.amount,
      currency: input.currency,
      status: input.status ?? 'pending',
      receiptUrl: input.receiptUrl ?? null,
      metadata: input.metadata ?? {},
      timestamp: new Date(),
    },
  });
}

/**
 * Get transaction by ID
 */
export async function getTransaction(
  prisma: PrismaClient,
  transactionId: string
): Promise<OrderTransaction | null> {
  return prisma.orderTransaction.findUnique({
    where: { transactionId },
  });
}

/**
 * Get transaction by internal ID
 */
export async function getTransactionById(
  prisma: PrismaClient,
  id: string
): Promise<OrderTransaction | null> {
  return prisma.orderTransaction.findUnique({
    where: { id },
  });
}

/**
 * List transactions with filters
 */
export async function listTransactions(
  prisma: PrismaClient,
  filters?: {
    vendorId?: string;
    purchaserId?: string;
    moduleId?: string;
    status?: TransactionStatus;
    currency?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<OrderTransaction[]> {
  return prisma.orderTransaction.findMany({
    where: {
      ...(filters?.vendorId && { vendorId: filters.vendorId }),
      ...(filters?.purchaserId && { purchaserId: filters.purchaserId }),
      ...(filters?.moduleId && { moduleId: filters.moduleId }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.currency && { currency: filters.currency }),
      ...(filters?.startDate || filters?.endDate
        ? {
            timestamp: {
              ...(filters?.startDate && { gte: filters.startDate }),
              ...(filters?.endDate && { lte: filters.endDate }),
            },
          }
        : {}),
    },
    orderBy: { timestamp: 'desc' },
  });
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  prisma: PrismaClient,
  transactionId: string,
  status: TransactionStatus,
  receiptUrl?: string
): Promise<OrderTransaction> {
  return prisma.orderTransaction.update({
    where: { transactionId },
    data: {
      status,
      ...(receiptUrl && { receiptUrl }),
      updatedAt: new Date(),
    },
  });
}

/**
 * Get transactions for a vendor
 */
export async function getVendorTransactions(
  prisma: PrismaClient,
  vendorId: string,
  options?: {
    status?: TransactionStatus;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<OrderTransaction[]> {
  return listTransactions(prisma, {
    vendorId,
    ...options,
  });
}

/**
 * Get transactions for a purchaser
 */
export async function getPurchaserTransactions(
  prisma: PrismaClient,
  purchaserId: string,
  options?: {
    status?: TransactionStatus;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<OrderTransaction[]> {
  return listTransactions(prisma, {
    purchaserId,
    ...options,
  });
}

