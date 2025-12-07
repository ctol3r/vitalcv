/**
 * B223B-MARKET-009: RevenueDistributionEngine
 *
 * Calculates vendor payouts after platform commission and fees;
 * generates payout reports; supports refunds
 */

import { PrismaClient } from '@prisma/client';
import {
  getVendorTransactions,
  getTransaction,
  updateTransactionStatus,
} from '../models/OrderTransaction.js';

export interface PayoutCalculation {
  vendorId: string;
  grossRevenue: number;
  platformCommission: number;
  platformFee: number;
  netPayout: number;
  transactionCount: number;
  currency: string;
}

export interface PayoutReport {
  reportId: string;
  vendorId: string;
  periodStart: Date;
  periodEnd: Date;
  calculation: PayoutCalculation;
  transactions: string[]; // Transaction IDs included in this payout
  payoutStatus: 'pending' | 'processing' | 'completed' | 'failed';
  payoutDate?: Date;
  payoutReference?: string; // External payout reference (e.g., Stripe transfer ID)
  createdAt: Date;
}

export interface RevenueDistributionConfig {
  platformCommissionRate: number; // Percentage (e.g., 0.15 for 15%)
  platformFeeFixed: number; // Fixed fee in cents
  minimumPayoutAmount: number; // Minimum payout amount in cents
  payoutCurrency: string; // Default payout currency
}

/**
 * RevenueDistributionEngine handles vendor payout calculations
 */
export class RevenueDistributionEngine {
  private prisma: PrismaClient;
  private config: RevenueDistributionConfig;

  constructor(prisma: PrismaClient, config: RevenueDistributionConfig) {
    this.prisma = prisma;
    this.config = config;
  }

  /**
   * Calculate payout for a vendor for a given period
   */
  async calculatePayout(
    vendorId: string,
    periodStart: Date,
    periodEnd: Date,
    currency?: string
  ): Promise<PayoutCalculation> {
    // Get all completed transactions for vendor in period
    const transactions = await getVendorTransactions(this.prisma, vendorId, {
      status: 'completed',
      startDate: periodStart,
      endDate: periodEnd,
    });

    // Filter by currency if specified
    const filteredTransactions =
      currency && currency !== 'all'
        ? transactions.filter((t) => t.currency === currency)
        : transactions;

    // Calculate totals
    const grossRevenue = filteredTransactions.reduce(
      (sum, t) => sum + t.amount,
      0
    );

    // Calculate platform commission
    const platformCommission = Math.round(
      grossRevenue * this.config.platformCommissionRate
    );

    // Calculate platform fee
    const platformFee = this.config.platformFeeFixed * filteredTransactions.length;

    // Calculate net payout
    const netPayout = grossRevenue - platformCommission - platformFee;

    // Determine currency
    const payoutCurrency =
      currency && currency !== 'all'
        ? currency
        : filteredTransactions.length > 0
        ? filteredTransactions[0].currency
        : this.config.payoutCurrency;

    return {
      vendorId,
      grossRevenue,
      platformCommission,
      platformFee,
      netPayout: Math.max(0, netPayout), // Ensure non-negative
      transactionCount: filteredTransactions.length,
      currency: payoutCurrency,
    };
  }

  /**
   * Generate payout report
   */
  async generatePayoutReport(
    vendorId: string,
    periodStart: Date,
    periodEnd: Date,
    currency?: string
  ): Promise<PayoutReport> {
    const calculation = await this.calculatePayout(
      vendorId,
      periodStart,
      periodEnd,
      currency
    );

    // Get transaction IDs
    const transactions = await getVendorTransactions(this.prisma, vendorId, {
      status: 'completed',
      startDate: periodStart,
      endDate: periodEnd,
    });

    const filteredTransactions =
      currency && currency !== 'all'
        ? transactions.filter((t) => t.currency === currency)
        : transactions;

    const transactionIds = filteredTransactions.map((t) => t.id);

    const reportId = `payout_${vendorId}_${periodStart.getTime()}_${periodEnd.getTime()}`;

    return {
      reportId,
      vendorId,
      periodStart,
      periodEnd,
      calculation,
      transactions: transactionIds,
      payoutStatus: 'pending',
      createdAt: new Date(),
    };
  }

  /**
   * Process refund and adjust payout
   */
  async processRefund(transactionId: string, refundAmount?: number): Promise<void> {
    const transaction = await getTransaction(this.prisma, transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.status !== 'completed') {
      throw new Error(`Cannot refund transaction with status: ${transaction.status}`);
    }

    const refundAmountToUse = refundAmount || transaction.amount;

    // Update transaction status
    await updateTransactionStatus(this.prisma, transactionId, 'refunded');

    // Note: In a production system, you would:
    // 1. Create a refund record
    // 2. Adjust vendor payout balance
    // 3. Create a negative payout entry
    // 4. Notify vendor of refund

    console.log(
      `Refund processed: ${transactionId}, Amount: ${refundAmountToUse} ${transaction.currency}`
    );
  }

  /**
   * Get payout summary for a vendor
   */
  async getVendorPayoutSummary(
    vendorId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalRevenue: number;
    totalCommission: number;
    totalFees: number;
    totalPayouts: number;
    transactionCount: number;
    currency: string;
  }> {
    const periodStart = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const periodEnd = endDate || new Date();

    const calculation = await this.calculatePayout(vendorId, periodStart, periodEnd);

    return {
      totalRevenue: calculation.grossRevenue,
      totalCommission: calculation.platformCommission,
      totalFees: calculation.platformFee,
      totalPayouts: calculation.netPayout,
      transactionCount: calculation.transactionCount,
      currency: calculation.currency,
    };
  }

  /**
   * List all vendors with pending payouts
   */
  async listVendorsWithPendingPayouts(
    minimumAmount?: number
  ): Promise<Array<{ vendorId: string; pendingAmount: number; currency: string }>> {
    // Get all vendors with completed transactions
    const transactions = await this.prisma.orderTransaction.findMany({
      where: {
        status: 'completed',
      },
      select: {
        vendorId: true,
        amount: true,
        currency: true,
      },
      distinct: ['vendorId'],
    });

    const vendorPayouts: Map<
      string,
      { amount: number; currency: string }
    > = new Map();

    for (const transaction of transactions) {
      const existing = vendorPayouts.get(transaction.vendorId) || {
        amount: 0,
        currency: transaction.currency,
      };
      vendorPayouts.set(transaction.vendorId, {
        amount: existing.amount + transaction.amount,
        currency: transaction.currency,
      });
    }

    const results: Array<{ vendorId: string; pendingAmount: number; currency: string }> = [];

    for (const [vendorId, data] of vendorPayouts.entries()) {
      const calculation = await this.calculatePayout(
        vendorId,
        new Date(0), // All time
        new Date()
      );

      if (
        !minimumAmount ||
        calculation.netPayout >= minimumAmount ||
        calculation.netPayout >= this.config.minimumPayoutAmount
      ) {
        results.push({
          vendorId,
          pendingAmount: calculation.netPayout,
          currency: calculation.currency,
        });
      }
    }

    return results;
  }

  /**
   * Export payout report as CSV
   */
  async exportPayoutReportCSV(report: PayoutReport): Promise<string> {
    const transactions = await this.prisma.orderTransaction.findMany({
      where: {
        id: { in: report.transactions },
      },
    });

    const headers = [
      'Transaction ID',
      'Module ID',
      'Purchaser ID',
      'Amount',
      'Currency',
      'Timestamp',
    ];

    const rows = transactions.map((t) => [
      t.transactionId,
      t.moduleId,
      t.purchaserId,
      t.amount.toString(),
      t.currency,
      t.timestamp.toISOString(),
    ]);

    const csvRows = [headers, ...rows].map((row) => row.join(',')).join('\n');

    return csvRows;
  }
}

