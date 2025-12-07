/**
 * B225A-FIN-005: SettlementProcessor
 *
 * Aggregates payable amounts to vendors/orgs; triggers payouts via BillingGateway;
 * logs settlementTxId in VitaLedger and RevenueRecognition tables.
 */

import { PrismaClient } from '@prisma/client';
import { LedgerPostingService } from '../ledger/postingService';
import { RevenueRecognitionEvent } from '../models/RevenueRecognitionEvent';

/**
 * BillingGateway interface for payout processing
 */
export interface BillingGateway {
  /**
   * Initiate a payout to an organization
   */
  initiatePayout(params: {
    orgId: string;
    amount: number;
    currency: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    settlementTxId: string;
    status: 'pending' | 'completed' | 'failed';
    estimatedCompletionDate?: Date;
  }>;

  /**
   * Check payout status
   */
  getPayoutStatus(settlementTxId: string): Promise<{
    status: 'pending' | 'completed' | 'failed';
    completedAt?: Date;
    failureReason?: string;
  }>;
}

export interface SettlementAggregation {
  orgId: string;
  totalAmount: number;
  currency: string;
  entryCount: number;
  pendingRecognitionIds: string[];
}

export interface SettlementRequest {
  orgId: string;
  currency?: string;
  minAmount?: number; // Minimum amount to trigger settlement
  description?: string;
  metadata?: Record<string, any>;
}

export class SettlementProcessor {
  private postingService: LedgerPostingService;

  constructor(
    private prisma: PrismaClient,
    private billingGateway: BillingGateway
  ) {
    this.postingService = new LedgerPostingService(prisma);
  }

  /**
   * Aggregate payable amounts for an organization
   */
  async aggregatePayables(
    orgId: string,
    currency: string = 'USD'
  ): Promise<SettlementAggregation> {
    // Get all pending revenue recognition events for this org
    const pendingEvents = await RevenueRecognitionEvent.findByOrgId(
      this.prisma,
      orgId,
      {
        status: 'pending',
        revenueType: currency === 'VITA' ? 'VITA' : 'FIAT',
      }
    );

    // Calculate total amount
    const totalAmount = pendingEvents.reduce(
      (sum, event) => sum + event.amount,
      0
    );

    return {
      orgId,
      totalAmount,
      currency,
      entryCount: pendingEvents.length,
      pendingRecognitionIds: pendingEvents.map((e) => e.id),
    };
  }

  /**
   * Process settlement for an organization
   */
  async processSettlement(
    request: SettlementRequest
  ): Promise<{
    settlementTxId: string;
    aggregation: SettlementAggregation;
    status: 'pending' | 'completed' | 'failed';
  }> {
    const currency = request.currency ?? 'USD';

    // Aggregate payables
    const aggregation = await this.aggregatePayables(request.orgId, currency);

    // Check minimum amount threshold
    if (request.minAmount && aggregation.totalAmount < request.minAmount) {
      throw new Error(
        `Settlement amount (${aggregation.totalAmount}) is below minimum threshold (${request.minAmount})`
      );
    }

    if (aggregation.totalAmount <= 0) {
      throw new Error('No payable amounts to settle');
    }

    // Initiate payout via BillingGateway
    const payoutResult = await this.billingGateway.initiatePayout({
      orgId: request.orgId,
      amount: aggregation.totalAmount,
      currency,
      description:
        request.description ??
        `Settlement for ${aggregation.entryCount} revenue recognition events`,
      metadata: {
        ...request.metadata,
        entryCount: aggregation.entryCount,
        pendingRecognitionIds: aggregation.pendingRecognitionIds,
      },
    });

    // Update revenue recognition events with settlement transaction ID
    // We need to update each event individually to preserve its metadata
    const events = await this.prisma.revenueRecognitionEvent.findMany({
      where: {
        id: { in: aggregation.pendingRecognitionIds },
      },
    });

    for (const event of events) {
      await this.prisma.revenueRecognitionEvent.update({
        where: { id: event.id },
        data: {
          status: 'settled',
          metadata: {
            ...(event.metadata as Record<string, any> || {}),
            settlementTxId: payoutResult.settlementTxId,
            settlementInitiatedAt: new Date().toISOString(),
          },
        },
      });
    }

    // Post settlement entry to ledger
    await this.postingService.postEntry({
      orgId: request.orgId,
      amount: aggregation.totalAmount,
      currency,
      type: 'credit',
      referenceId: payoutResult.settlementTxId,
      metadata: {
        transactionType: 'settlement_payout',
        entryCount: aggregation.entryCount,
        pendingRecognitionIds: aggregation.pendingRecognitionIds,
        ...request.metadata,
      },
    });

    // Update VitaLedger if applicable (for VITA settlements)
    if (currency === 'VITA') {
      await this.prisma.vitaLedger.create({
        data: {
          orgId: request.orgId,
          amount: aggregation.totalAmount,
          type: 'settlement',
          txId: payoutResult.settlementTxId,
          reference: payoutResult.settlementTxId,
          metadata: {
            entryCount: aggregation.entryCount,
            pendingRecognitionIds: aggregation.pendingRecognitionIds,
            ...request.metadata,
          },
        },
      });
    }

    return {
      settlementTxId: payoutResult.settlementTxId,
      aggregation,
      status: payoutResult.status,
    };
  }

  /**
   * Update settlement status from BillingGateway
   */
  async updateSettlementStatus(settlementTxId: string): Promise<void> {
    const status = await this.billingGateway.getPayoutStatus(settlementTxId);

    // Find revenue recognition events with this settlement transaction ID
    const events = await this.prisma.revenueRecognitionEvent.findMany({
      where: {
        metadata: {
          path: ['settlementTxId'],
          equals: settlementTxId,
        },
      },
    });

    if (events.length === 0) {
      console.warn(`No revenue recognition events found for settlement: ${settlementTxId}`);
      return;
    }

    // Update status based on payout status
    if (status.status === 'completed') {
      for (const event of events) {
        await this.prisma.revenueRecognitionEvent.update({
          where: { id: event.id },
          data: {
            status: 'settled',
            metadata: {
              ...(event.metadata as Record<string, any> || {}),
              settlementCompletedAt: status.completedAt?.toISOString(),
            },
          },
        });
      }
    } else if (status.status === 'failed') {
      // Revert to recognized status if settlement failed
      for (const event of events) {
        await this.prisma.revenueRecognitionEvent.update({
          where: { id: event.id },
          data: {
            status: 'recognized', // Revert to recognized, can retry settlement
            metadata: {
              ...(event.metadata as Record<string, any> || {}),
              settlementFailedAt: new Date().toISOString(),
              settlementFailureReason: status.failureReason,
            },
          },
        });
      }
    }
  }

  /**
   * Get settlement summary for an organization
   */
  async getSettlementSummary(
    orgId: string,
    currency: string = 'USD'
  ): Promise<{
    pending: SettlementAggregation;
    totalPending: number;
    canSettle: boolean;
  }> {
    const pending = await this.aggregatePayables(orgId, currency);

    return {
      pending,
      totalPending: pending.totalAmount,
      canSettle: pending.totalAmount > 0,
    };
  }

  /**
   * Process settlements for all organizations with pending payables
   */
  async processAllSettlements(options?: {
    minAmount?: number;
    currency?: string;
    limit?: number;
  }): Promise<
    Array<{
      orgId: string;
      settlementTxId: string;
      status: string;
    }>
  > {
    const currency = options?.currency ?? 'USD';
    const minAmount = options?.minAmount ?? 0;

    // Get all organizations with pending revenue recognition events
    const orgsWithPending = await this.prisma.revenueRecognitionEvent.findMany({
      where: {
        status: 'pending',
        revenueType: currency === 'VITA' ? 'VITA' : 'FIAT',
        orgId: { not: null },
      },
      select: {
        orgId: true,
      },
      distinct: ['orgId'],
      take: options?.limit,
    });

    const results = [];

    for (const org of orgsWithPending) {
      if (!org.orgId) continue;

      try {
        const result = await this.processSettlement({
          orgId: org.orgId,
          currency,
          minAmount,
        });

        results.push({
          orgId: org.orgId,
          settlementTxId: result.settlementTxId,
          status: result.status,
        });
      } catch (error) {
        console.error(
          `Failed to process settlement for org ${org.orgId}:`,
          error
        );
      }
    }

    return results;
  }
}

