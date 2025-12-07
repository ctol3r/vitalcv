/**
 * B225A-FIN-003: LedgerPostingService
 *
 * Posts entries to the VitaLedger table for marketplace purchases,
 * revenue share distributions, refunds. Enforces double-entry accounting.
 */

import { PrismaClient } from '@prisma/client';
import { LedgerEntry } from '../models/LedgerEntry';

export interface PostingRequest {
  orgId?: string | null;
  amount: number;
  currency?: string;
  type: 'credit' | 'debit';
  referenceId?: string | null;
  relatedEventId?: string | null;
  metadata?: Record<string, any> | null;
}

export interface DoubleEntryPosting {
  debit: PostingRequest;
  credit: PostingRequest;
}

export class LedgerPostingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Post a single ledger entry
   */
  async postEntry(request: PostingRequest): Promise<LedgerEntry> {
    return await LedgerEntry.create(this.prisma, {
      orgId: request.orgId ?? null,
      amount: request.amount,
      currency: request.currency ?? 'USD',
      type: request.type,
      referenceId: request.referenceId ?? null,
      relatedEventId: request.relatedEventId ?? null,
      metadata: request.metadata ?? null,
    });
  }

  /**
   * Post a double-entry transaction (debit and credit)
   * Enforces that debits equal credits
   */
  async postDoubleEntry(posting: DoubleEntryPosting): Promise<[LedgerEntry, LedgerEntry]> {
    if (posting.debit.amount !== posting.credit.amount) {
      throw new Error(
        `Double-entry accounting violation: debit amount (${posting.debit.amount}) must equal credit amount (${posting.credit.amount})`
      );
    }

    if (posting.debit.type !== 'debit') {
      throw new Error('Double-entry posting: debit entry must have type "debit"');
    }

    if (posting.credit.type !== 'credit') {
      throw new Error('Double-entry posting: credit entry must have type "credit"');
    }

    // Ensure same currency
    const currency = posting.debit.currency ?? posting.credit.currency ?? 'USD';
    if (posting.debit.currency && posting.credit.currency && posting.debit.currency !== posting.credit.currency) {
      throw new Error('Double-entry posting: debit and credit must use the same currency');
    }

    // Ensure same referenceId for linking
    const referenceId = posting.debit.referenceId ?? posting.credit.referenceId ?? null;
    const relatedEventId = posting.debit.relatedEventId ?? posting.credit.relatedEventId ?? null;

    const [debitEntry, creditEntry] = await this.prisma.$transaction([
      this.prisma.ledgerEntry.create({
        data: {
          orgId: posting.debit.orgId ?? null,
          amount: posting.debit.amount,
          currency,
          type: 'debit',
          referenceId,
          relatedEventId,
          metadata: posting.debit.metadata ?? null,
        },
      }),
      this.prisma.ledgerEntry.create({
        data: {
          orgId: posting.credit.orgId ?? null,
          amount: posting.credit.amount,
          currency,
          type: 'credit',
          referenceId,
          relatedEventId,
          metadata: posting.credit.metadata ?? null,
        },
      }),
    ]);

    return [
      new LedgerEntry(
        this.prisma,
        debitEntry.id,
        debitEntry.orgId,
        debitEntry.amount,
        debitEntry.currency,
        debitEntry.type as 'credit' | 'debit',
        debitEntry.referenceId,
        debitEntry.relatedEventId,
        debitEntry.metadata as Record<string, any> | null,
        debitEntry.createdAt
      ),
      new LedgerEntry(
        this.prisma,
        creditEntry.id,
        creditEntry.orgId,
        creditEntry.amount,
        creditEntry.currency,
        creditEntry.type as 'credit' | 'debit',
        creditEntry.referenceId,
        creditEntry.relatedEventId,
        creditEntry.metadata as Record<string, any> | null,
        creditEntry.createdAt
      ),
    ];
  }

  /**
   * Post a marketplace purchase transaction
   * Creates entries for: purchaser debit, vendor credit, platform fee credit
   */
  async postMarketplacePurchase(params: {
    purchaseId: string;
    purchaserOrgId: string;
    vendorOrgId: string;
    amount: number;
    currency?: string;
    platformFee?: number;
    metadata?: Record<string, any>;
  }): Promise<[LedgerEntry, LedgerEntry, LedgerEntry?]> {
    const currency = params.currency ?? 'USD';
    const platformFee = params.platformFee ?? 0;
    const vendorAmount = params.amount - platformFee;

    // Purchaser: debit (money out)
    const purchaserDebit = await this.postEntry({
      orgId: params.purchaserOrgId,
      amount: params.amount,
      currency,
      type: 'debit',
      referenceId: params.purchaseId,
      metadata: {
        ...params.metadata,
        transactionType: 'marketplace_purchase',
        vendorOrgId: params.vendorOrgId,
      },
    });

    // Vendor: credit (money in)
    const vendorCredit = await this.postEntry({
      orgId: params.vendorOrgId,
      amount: vendorAmount,
      currency,
      type: 'credit',
      referenceId: params.purchaseId,
      metadata: {
        ...params.metadata,
        transactionType: 'marketplace_sale',
        purchaserOrgId: params.purchaserOrgId,
      },
    });

    // Platform fee: credit (if applicable)
    let platformFeeEntry: LedgerEntry | undefined;
    if (platformFee > 0) {
      platformFeeEntry = await this.postEntry({
        orgId: null, // Platform revenue
        amount: platformFee,
        currency,
        type: 'credit',
        referenceId: params.purchaseId,
        metadata: {
          ...params.metadata,
          transactionType: 'platform_fee',
          purchaserOrgId: params.purchaserOrgId,
          vendorOrgId: params.vendorOrgId,
        },
      });
    }

    return [purchaserDebit, vendorCredit, platformFeeEntry];
  }

  /**
   * Post a revenue share distribution
   * Creates entries for: platform debit, vendor credit
   */
  async postRevenueShareDistribution(params: {
    distributionId: string;
    vendorOrgId: string;
    amount: number;
    currency?: string;
    basisPoints?: number;
    metadata?: Record<string, any>;
  }): Promise<[LedgerEntry, LedgerEntry]> {
    const currency = params.currency ?? 'USD';

    // Platform: debit (money out)
    const platformDebit = await this.postEntry({
      orgId: null, // Platform
      amount: params.amount,
      currency,
      type: 'debit',
      referenceId: params.distributionId,
      metadata: {
        ...params.metadata,
        transactionType: 'revenue_share_distribution',
        vendorOrgId: params.vendorOrgId,
        basisPoints: params.basisPoints,
      },
    });

    // Vendor: credit (money in)
    const vendorCredit = await this.postEntry({
      orgId: params.vendorOrgId,
      amount: params.amount,
      currency,
      type: 'credit',
      referenceId: params.distributionId,
      metadata: {
        ...params.metadata,
        transactionType: 'revenue_share_receipt',
        basisPoints: params.basisPoints,
      },
    });

    return [platformDebit, vendorCredit];
  }

  /**
   * Post a refund transaction
   * Creates entries for: vendor debit, purchaser credit, platform fee reversal
   */
  async postRefund(params: {
    refundId: string;
    purchaseId: string;
    purchaserOrgId: string;
    vendorOrgId: string;
    amount: number;
    currency?: string;
    platformFee?: number;
    metadata?: Record<string, any>;
  }): Promise<[LedgerEntry, LedgerEntry, LedgerEntry?]> {
    const currency = params.currency ?? 'USD';
    const platformFee = params.platformFee ?? 0;
    const vendorAmount = params.amount - platformFee;

    // Vendor: debit (money out)
    const vendorDebit = await this.postEntry({
      orgId: params.vendorOrgId,
      amount: vendorAmount,
      currency,
      type: 'debit',
      referenceId: params.refundId,
      relatedEventId: params.purchaseId,
      metadata: {
        ...params.metadata,
        transactionType: 'refund_payment',
        purchaserOrgId: params.purchaserOrgId,
      },
    });

    // Purchaser: credit (money back)
    const purchaserCredit = await this.postEntry({
      orgId: params.purchaserOrgId,
      amount: params.amount,
      currency,
      type: 'credit',
      referenceId: params.refundId,
      relatedEventId: params.purchaseId,
      metadata: {
        ...params.metadata,
        transactionType: 'refund_receipt',
        vendorOrgId: params.vendorOrgId,
      },
    });

    // Platform fee reversal: debit (if applicable)
    let platformFeeReversal: LedgerEntry | undefined;
    if (platformFee > 0) {
      platformFeeReversal = await this.postEntry({
        orgId: null, // Platform
        amount: platformFee,
        currency,
        type: 'debit',
        referenceId: params.refundId,
        relatedEventId: params.purchaseId,
        metadata: {
          ...params.metadata,
          transactionType: 'platform_fee_reversal',
          purchaserOrgId: params.purchaserOrgId,
          vendorOrgId: params.vendorOrgId,
        },
      });
    }

    return [vendorDebit, purchaserCredit, platformFeeReversal];
  }

  /**
   * Verify double-entry accounting balance
   * Returns true if all debits equal all credits for a given reference
   */
  async verifyBalance(referenceId: string): Promise<boolean> {
    const entries = await LedgerEntry.findByReferenceId(this.prisma, referenceId);

    const totalDebits = entries
      .filter((e) => e.type === 'debit')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalCredits = entries
      .filter((e) => e.type === 'credit')
      .reduce((sum, e) => sum + e.amount, 0);

    return totalDebits === totalCredits;
  }
}

