/**
 * B225B-FIN-007: AccountingComplianceRules
 * Defines rules to ensure GAAP/IFRS compliance: e.g., revenue recognized when earned,
 * deferred revenue balances; integrated into LedgerPostingService
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export enum AccountingStandard {
  GAAP = 'GAAP',
  IFRS = 'IFRS',
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  standard: AccountingStandard;
  validate: (transaction: any) => Promise<ComplianceResult>;
}

export interface ComplianceResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, any>;
}

export interface RevenueRecognitionRule {
  eventId: string;
  eventType: string;
  amount: number;
  recognizedAt: Date;
  orgId?: string;
}

/**
 * AccountingComplianceRules service
 * Ensures GAAP/IFRS compliance for financial transactions
 */
export class AccountingComplianceRules {
  private standard: AccountingStandard;

  constructor(standard: AccountingStandard = AccountingStandard.GAAP) {
    this.standard = standard;
  }

  /**
   * Validate revenue recognition compliance
   * GAAP/IFRS: Revenue should be recognized when earned, not when cash is received
   */
  async validateRevenueRecognition(transaction: RevenueRecognitionRule): Promise<ComplianceResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Rule 1: Revenue must be recognized when earned (service delivered, not when paid)
    const event = await prisma.revenueRecognition.findUnique({
      where: { id: transaction.eventId },
    });

    if (!event) {
      errors.push('Revenue recognition event not found');
      return { passed: false, errors, warnings };
    }

    // Check if revenue is recognized before cash settlement (for deferred revenue)
    if (event.cashSettledAt && event.recognizedAt > event.cashSettledAt) {
      warnings.push('Revenue recognized after cash settlement - verify service delivery date');
    }

    // Rule 2: Deferred revenue balance check
    // If cash received before service delivery, it should be deferred revenue
    if (event.cashSettledAt && event.cashSettledAt < event.recognizedAt) {
      // This is correct - cash received before recognition should be deferred
      // Verify deferred revenue balance exists
      const deferredBalance = await this.getDeferredRevenueBalance(event.orgId || '');
      if (deferredBalance === 0) {
        warnings.push('Deferred revenue balance should exist for cash received before recognition');
      }
    }

    // Rule 3: Revenue amount must match event amount
    if (event.amount !== transaction.amount) {
      errors.push(`Revenue amount mismatch: expected ${transaction.amount}, got ${event.amount}`);
    }

    // Rule 4: Revenue recognition date must be within reasonable timeframe
    const daysDiff = Math.abs(
      (event.recognizedAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > 365) {
      warnings.push('Revenue recognition date is more than 1 year in the past or future');
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: {
        eventId: event.id,
        recognizedAt: event.recognizedAt,
        cashSettledAt: event.cashSettledAt,
      },
    };
  }

  /**
   * Get deferred revenue balance for an organization
   */
  async getDeferredRevenueBalance(orgId: string): Promise<number> {
    // Calculate deferred revenue: cash received but not yet recognized
    const deferredRevenues = await prisma.revenueRecognition.findMany({
      where: {
        orgId,
        cashSettledAt: { not: null },
        status: 'pending', // Not yet recognized
      },
    });

    return deferredRevenues.reduce((sum, r) => sum + r.amount, 0);
  }

  /**
   * Validate ledger posting compliance
   * Ensures double-entry bookkeeping principles
   */
  async validateLedgerPosting(
    debitAccount: string,
    creditAccount: string,
    amount: number
  ): Promise<ComplianceResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Rule 1: Debits must equal credits (double-entry)
    if (amount <= 0) {
      errors.push('Transaction amount must be positive');
    }

    // Rule 2: Accounts must be valid
    // In production, validate against chart of accounts
    if (!debitAccount || !creditAccount) {
      errors.push('Both debit and credit accounts must be specified');
    }

    // Rule 3: Same account cannot be both debit and credit
    if (debitAccount === creditAccount) {
      errors.push('Debit and credit accounts cannot be the same');
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: {
        debitAccount,
        creditAccount,
        amount,
      },
    };
  }

  /**
   * Validate expense recognition compliance
   * Expenses should be recognized when incurred, not when paid
   */
  async validateExpenseRecognition(
    expenseId: string,
    incurredDate: Date,
    paidDate?: Date
  ): Promise<ComplianceResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Rule 1: Expense must be recognized when incurred
    if (incurredDate > new Date()) {
      errors.push('Expense cannot be recognized in the future');
    }

    // Rule 2: If paid before incurred, it's a prepaid expense
    if (paidDate && paidDate < incurredDate) {
      warnings.push('Expense paid before incurred - should be recorded as prepaid expense');
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: {
        expenseId,
        incurredDate,
        paidDate,
      },
    };
  }

  /**
   * Check if organization is compliant with all rules
   */
  async checkOrganizationCompliance(orgId: string): Promise<ComplianceResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check revenue recognition compliance
    const recentRevenues = await prisma.revenueRecognition.findMany({
      where: {
        orgId,
        recognizedAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        },
      },
      take: 100,
    });

    for (const revenue of recentRevenues) {
      const result = await this.validateRevenueRecognition({
        eventId: revenue.id,
        eventType: revenue.eventType,
        amount: revenue.amount,
        recognizedAt: revenue.recognizedAt,
        orgId: revenue.orgId || undefined,
      });

      if (!result.passed) {
        errors.push(...result.errors);
      }
      warnings.push(...result.warnings);
    }

    // Check deferred revenue balance
    const deferredBalance = await this.getDeferredRevenueBalance(orgId);
    if (deferredBalance < 0) {
      errors.push('Deferred revenue balance cannot be negative');
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      metadata: {
        orgId,
        deferredRevenueBalance: deferredBalance,
        recentRevenuesChecked: recentRevenues.length,
      },
    };
  }

  /**
   * Get compliance rules for the current accounting standard
   */
  getRules(): ComplianceRule[] {
    const rules: ComplianceRule[] = [
      {
        id: 'revenue-recognition',
        name: 'Revenue Recognition',
        description: 'Revenue must be recognized when earned, not when cash is received',
        standard: this.standard,
        validate: async (transaction) => {
          return this.validateRevenueRecognition(transaction);
        },
      },
      {
        id: 'double-entry',
        name: 'Double-Entry Bookkeeping',
        description: 'All transactions must have equal debits and credits',
        standard: this.standard,
        validate: async (transaction) => {
          return this.validateLedgerPosting(
            transaction.debitAccount,
            transaction.creditAccount,
            transaction.amount
          );
        },
      },
    ];

    return rules;
  }
}

/**
 * LedgerPostingService integration
 * This service should be called before posting to ledger to ensure compliance
 */
export class LedgerPostingService {
  private complianceRules: AccountingComplianceRules;

  constructor(standard: AccountingStandard = AccountingStandard.GAAP) {
    this.complianceRules = new AccountingComplianceRules(standard);
  }

  /**
   * Post a transaction to ledger with compliance validation
   */
  async postTransaction(
    debitAccount: string,
    creditAccount: string,
    amount: number,
    reference: string,
    metadata?: any
  ): Promise<{ success: boolean; errors: string[]; ledgerEntryId?: string }> {
    // Validate compliance before posting
    const compliance = await this.complianceRules.validateLedgerPosting(
      debitAccount,
      creditAccount,
      amount
    );

    if (!compliance.passed) {
      return {
        success: false,
        errors: compliance.errors,
      };
    }

    // Post to VitaLedger
    const ledgerEntry = await prisma.vitaLedger.create({
      data: {
        amount,
        type: 'transaction',
        reference,
        metadata: {
          ...metadata,
          debitAccount,
          creditAccount,
          complianceCheck: {
            passed: true,
            timestamp: new Date().toISOString(),
          },
        },
      },
    });

    return {
      success: true,
      errors: [],
      ledgerEntryId: ledgerEntry.id,
    };
  }
}

