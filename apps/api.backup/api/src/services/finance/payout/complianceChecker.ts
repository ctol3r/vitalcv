/**
 * B225B-FIN-010: PayoutComplianceChecker
 * Ensures payouts respect regulatory constraints (e.g. anti-money-laundering, sanctions lists)
 * Logs exceptions and blocks suspect payouts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PayoutRequest {
  id: string;
  orgId: string;
  amount: number; // in cents
  currency: string;
  recipientType: 'organization' | 'individual';
  recipientId: string;
  recipientName: string;
  recipientAddress?: string;
  recipientCountry?: string;
  purpose: string;
  metadata?: Record<string, any>;
}

export interface ComplianceCheckResult {
  passed: boolean;
  blocked: boolean;
  warnings: string[];
  errors: string[];
  checks: {
    aml: ComplianceCheck;
    sanctions: ComplianceCheck;
    kyc: ComplianceCheck;
    amountLimit: ComplianceCheck;
  };
}

export interface ComplianceCheck {
  passed: boolean;
  reason?: string;
  details?: Record<string, any>;
}

export interface SanctionsListEntry {
  name: string;
  aliases: string[];
  country?: string;
  type: 'individual' | 'organization';
  list: 'OFAC' | 'EU' | 'UN' | 'OTHER';
}

/**
 * PayoutComplianceChecker service
 * Validates payouts against AML, sanctions, and other regulatory requirements
 */
export class PayoutComplianceChecker {
  // In production, these would be loaded from external sources or databases
  private sanctionsList: SanctionsListEntry[] = [];
  private amlThresholds = {
    dailyLimit: 10000000, // $100,000 in cents
    monthlyLimit: 100000000, // $1,000,000 in cents
    singleTransactionLimit: 10000000, // $100,000 in cents
  };

  constructor() {
    // Initialize sanctions list (in production, load from external API or database)
    this.initializeSanctionsList();
  }

  /**
   * Check payout compliance
   */
  async checkCompliance(payout: PayoutRequest): Promise<ComplianceCheckResult> {
    const checks = {
      aml: await this.checkAML(payout),
      sanctions: await this.checkSanctions(payout),
      kyc: await this.checkKYC(payout),
      amountLimit: await this.checkAmountLimits(payout),
    };

    const warnings: string[] = [];
    const errors: string[] = [];

    // Collect warnings and errors
    Object.entries(checks).forEach(([checkName, check]) => {
      if (!check.passed) {
        if (checkName === 'sanctions' || checkName === 'aml') {
          errors.push(`${checkName.toUpperCase()}: ${check.reason || 'Check failed'}`);
        } else {
          warnings.push(`${checkName}: ${check.reason || 'Check failed'}`);
        }
      }
    });

    // Block if critical checks fail
    const blocked = !checks.sanctions.passed || !checks.aml.passed;

    // Log compliance check
    await this.logComplianceCheck(payout, checks, blocked);

    return {
      passed: Object.values(checks).every((c) => c.passed),
      blocked,
      warnings,
      errors,
      checks,
    };
  }

  /**
   * Check Anti-Money Laundering (AML) compliance
   */
  private async checkAML(payout: PayoutRequest): Promise<ComplianceCheck> {
    // Check 1: Single transaction limit
    if (payout.amount > this.amlThresholds.singleTransactionLimit) {
      return {
        passed: false,
        reason: `Transaction amount exceeds single transaction limit of ${this.formatCurrency(this.amlThresholds.singleTransactionLimit)}`,
        details: {
          amount: payout.amount,
          limit: this.amlThresholds.singleTransactionLimit,
        },
      };
    }

    // Check 2: Daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayPayouts = await prisma.vitaLedger.findMany({
      where: {
        orgId: payout.orgId,
        type: 'payout',
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const todayTotal = todayPayouts.reduce((sum, p) => sum + Math.abs(p.amount), 0);
    const projectedTotal = todayTotal + payout.amount;

    if (projectedTotal > this.amlThresholds.dailyLimit) {
      return {
        passed: false,
        reason: `Daily payout limit would be exceeded. Current: ${this.formatCurrency(todayTotal)}, Limit: ${this.formatCurrency(this.amlThresholds.dailyLimit)}`,
        details: {
          todayTotal,
          projectedTotal,
          limit: this.amlThresholds.dailyLimit,
        },
      };
    }

    // Check 3: Monthly limit
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const monthPayouts = await prisma.vitaLedger.findMany({
      where: {
        orgId: payout.orgId,
        type: 'payout',
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const monthTotal = monthPayouts.reduce((sum, p) => sum + Math.abs(p.amount), 0);
    const projectedMonthTotal = monthTotal + payout.amount;

    if (projectedMonthTotal > this.amlThresholds.monthlyLimit) {
      return {
        passed: false,
        reason: `Monthly payout limit would be exceeded. Current: ${this.formatCurrency(monthTotal)}, Limit: ${this.formatCurrency(this.amlThresholds.monthlyLimit)}`,
        details: {
          monthTotal,
          projectedMonthTotal,
          limit: this.amlThresholds.monthlyLimit,
        },
      };
    }

    // Check 4: Suspicious patterns
    const suspiciousPatterns = await this.detectSuspiciousPatterns(payout);
    if (suspiciousPatterns.length > 0) {
      return {
        passed: false,
        reason: `Suspicious patterns detected: ${suspiciousPatterns.join(', ')}`,
        details: {
          patterns: suspiciousPatterns,
        },
      };
    }

    return {
      passed: true,
      details: {
        dailyTotal: todayTotal,
        monthlyTotal: monthTotal,
      },
    };
  }

  /**
   * Check sanctions list
   */
  private async checkSanctions(payout: PayoutRequest): Promise<ComplianceCheck> {
    const recipientName = payout.recipientName.toLowerCase();
    const recipientCountry = payout.recipientCountry?.toLowerCase();

    // Check against sanctions list
    for (const entry of this.sanctionsList) {
      // Check name match
      const nameMatch = entry.name.toLowerCase() === recipientName ||
        entry.aliases.some((alias) => alias.toLowerCase() === recipientName);

      // Check country match if specified
      const countryMatch = !entry.country || entry.country.toLowerCase() === recipientCountry;

      // Check type match
      const typeMatch = entry.type === payout.recipientType;

      if (nameMatch && countryMatch && typeMatch) {
        return {
          passed: false,
          reason: `Recipient matches sanctions list entry: ${entry.name} (${entry.list})`,
          details: {
            matchedEntry: entry,
            recipientName: payout.recipientName,
            recipientCountry: payout.recipientCountry,
          },
        };
      }
    }

    return {
      passed: true,
      details: {
        checkedAgainst: this.sanctionsList.length,
      },
    };
  }

  /**
   * Check KYC (Know Your Customer) compliance
   */
  private async checkKYC(payout: PayoutRequest): Promise<ComplianceCheck> {
    // Check if organization has completed KYC
    const org = await prisma.organization.findUnique({
      where: { id: payout.orgId },
    });

    if (!org) {
      return {
        passed: false,
        reason: 'Organization not found',
      };
    }

    // In production, check KYC status from a dedicated KYC table
    // For now, assume KYC is required for payouts above certain threshold
    if (payout.amount > 1000000) { // $10,000
      // Check if KYC is completed (placeholder check)
      const kycCompleted = true; // Would check actual KYC status

      if (!kycCompleted) {
        return {
          passed: false,
          reason: 'KYC verification required for payouts above $10,000',
          details: {
            amount: payout.amount,
            threshold: 1000000,
          },
        };
      }
    }

    return {
      passed: true,
    };
  }

  /**
   * Check amount limits
   */
  private async checkAmountLimits(payout: PayoutRequest): Promise<ComplianceCheck> {
    // Minimum payout amount
    if (payout.amount < 100) { // $1.00 minimum
      return {
        passed: false,
        reason: 'Payout amount below minimum threshold',
        details: {
          amount: payout.amount,
          minimum: 100,
        },
      };
    }

    // Maximum single payout (separate from AML limits)
    const maxSinglePayout = 50000000; // $500,000
    if (payout.amount > maxSinglePayout) {
      return {
        passed: false,
        reason: `Payout amount exceeds maximum single payout limit of ${this.formatCurrency(maxSinglePayout)}`,
        details: {
          amount: payout.amount,
          limit: maxSinglePayout,
        },
      };
    }

    return {
      passed: true,
    };
  }

  /**
   * Detect suspicious patterns
   */
  private async detectSuspiciousPatterns(payout: PayoutRequest): Promise<string[]> {
    const patterns: string[] = [];

    // Pattern 1: Round numbers (potential structuring)
    if (payout.amount % 10000 === 0 && payout.amount >= 100000) {
      patterns.push('round_number_pattern');
    }

    // Pattern 2: Rapid successive payouts
    const recentPayouts = await prisma.vitaLedger.findMany({
      where: {
        orgId: payout.orgId,
        type: 'payout',
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    if (recentPayouts.length >= 5) {
      patterns.push('rapid_successive_payouts');
    }

    // Pattern 3: Unusual recipient country
    const highRiskCountries = ['af', 'kp', 'sy', 'ir']; // Example high-risk countries
    if (payout.recipientCountry && highRiskCountries.includes(payout.recipientCountry.toLowerCase())) {
      patterns.push('high_risk_country');
    }

    return patterns;
  }

  /**
   * Log compliance check result
   */
  private async logComplianceCheck(
    payout: PayoutRequest,
    checks: ComplianceCheckResult['checks'],
    blocked: boolean
  ): Promise<void> {
    // Log to audit trail or dedicated compliance log table
    // For now, log to VitaLedger metadata
    await prisma.vitaLedger.create({
      data: {
        orgId: payout.orgId,
        amount: -payout.amount, // Negative for payout
        type: 'payout',
        reference: payout.id,
        metadata: {
          complianceCheck: {
            timestamp: new Date().toISOString(),
            blocked,
            checks: {
              aml: checks.aml.passed,
              sanctions: checks.sanctions.passed,
              kyc: checks.kyc.passed,
              amountLimit: checks.amountLimit.passed,
            },
            recipient: {
              type: payout.recipientType,
              id: payout.recipientId,
              name: payout.recipientName,
              country: payout.recipientCountry,
            },
            purpose: payout.purpose,
          },
        },
      },
    });
  }

  /**
   * Initialize sanctions list
   * In production, this would load from external API or database
   */
  private initializeSanctionsList(): void {
    // Example entries (in production, load from OFAC, EU, UN sanctions lists)
    this.sanctionsList = [
      {
        name: 'Example Sanctioned Entity',
        aliases: ['Example Entity', 'Example Corp'],
        country: 'XX',
        type: 'organization',
        list: 'OFAC',
      },
      // Add more entries from actual sanctions lists
    ];
  }

  /**
   * Format currency
   */
  private formatCurrency(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  /**
   * Update sanctions list (for periodic updates)
   */
  async updateSanctionsList(entries: SanctionsListEntry[]): Promise<void> {
    this.sanctionsList = entries;
    // In production, persist to database
  }

  /**
   * Get compliance statistics for an organization
   */
  async getComplianceStats(orgId: string, periodDays: number = 30): Promise<{
    totalPayouts: number;
    totalAmount: number;
    blockedPayouts: number;
    warnings: number;
    lastCheck: Date | null;
  }> {
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const payouts = await prisma.vitaLedger.findMany({
      where: {
        orgId,
        type: 'payout',
        createdAt: {
          gte: startDate,
        },
      },
    });

    let blockedCount = 0;
    let warningCount = 0;
    let lastCheck: Date | null = null;

    payouts.forEach((payout) => {
      if (payout.metadata) {
        const compliance = (payout.metadata as any).complianceCheck;
        if (compliance) {
          if (compliance.blocked) {
            blockedCount++;
          }
          if (compliance.warnings && compliance.warnings.length > 0) {
            warningCount++;
          }
          const checkDate = new Date(compliance.timestamp);
          if (!lastCheck || checkDate > lastCheck) {
            lastCheck = checkDate;
          }
        }
      }
    });

    return {
      totalPayouts: payouts.length,
      totalAmount: payouts.reduce((sum, p) => sum + Math.abs(p.amount), 0),
      blockedPayouts: blockedCount,
      warnings: warningCount,
      lastCheck,
    };
  }
}

