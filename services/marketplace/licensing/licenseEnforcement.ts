/**
 * B223B-MARKET-010: LicenseEnforcementMiddleware
 *
 * When a module is loaded by the microkernel, verifies license validity and usage limits;
 * rejects with error on invalid license
 */

import { PrismaClient } from '@prisma/client';
import { DomainModule, DomainEvent, DomainTask, TaskResult } from '../../microkernel/types.js';
import { getTransaction, listTransactions } from '../models/OrderTransaction.js';

export interface LicenseCheckResult {
  valid: boolean;
  reason?: string;
  expiresAt?: Date;
  usageLimit?: number;
  currentUsage?: number;
}

export interface LicenseInfo {
  moduleId: string;
  purchaserId: string;
  vendorId: string;
  licenseType: 'purchase' | 'subscription';
  status: 'active' | 'expired' | 'cancelled' | 'invalid';
  expiresAt?: Date;
  usageLimit?: number;
  currentUsage: number;
}

/**
 * LicenseEnforcementMiddleware verifies licenses when modules are loaded
 */
export class LicenseEnforcementMiddleware {
  private prisma: PrismaClient;
  private licenseCache: Map<string, { license: LicenseInfo; cachedAt: Date }> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Check if a license is valid for module loading
   */
  async checkLicense(
    moduleId: string,
    purchaserId: string
  ): Promise<LicenseCheckResult> {
    try {
      const license = await this.getLicenseInfo(moduleId, purchaserId);

      if (!license) {
        return {
          valid: false,
          reason: 'No valid license found for this module',
        };
      }

      // Check license status
      if (license.status !== 'active') {
        return {
          valid: false,
          reason: `License status is ${license.status}`,
        };
      }

      // Check expiration
      if (license.expiresAt && license.expiresAt < new Date()) {
        return {
          valid: false,
          reason: 'License has expired',
          expiresAt: license.expiresAt,
        };
      }

      // Check usage limits
      if (license.usageLimit !== undefined) {
        if (license.currentUsage >= license.usageLimit) {
          return {
            valid: false,
            reason: 'Usage limit exceeded',
            usageLimit: license.usageLimit,
            currentUsage: license.currentUsage,
          };
        }
      }

      return {
        valid: true,
        expiresAt: license.expiresAt,
        usageLimit: license.usageLimit,
        currentUsage: license.currentUsage,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        reason: `License check failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Get license information for a module and purchaser
   */
  async getLicenseInfo(
    moduleId: string,
    purchaserId: string
  ): Promise<LicenseInfo | null> {
    // Check cache first
    const cacheKey = `${moduleId}:${purchaserId}`;
    const cached = this.licenseCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt.getTime() < this.cacheTTL) {
      return cached.license;
    }

    // Get completed transactions for this module and purchaser
    const transactions = await listTransactions(this.prisma, {
      moduleId,
      purchaserId,
      status: 'completed',
    });

    if (transactions.length === 0) {
      return null;
    }

    // Get the most recent transaction
    const latestTransaction = transactions[0];

    // Check if there's a subscription (would be in metadata)
    const isSubscription =
      latestTransaction.metadata?.subscriptionType === 'recurring' ||
      latestTransaction.metadata?.stripeSubscriptionId;

    // Determine license type and expiration
    let licenseType: 'purchase' | 'subscription' = 'purchase';
    let expiresAt: Date | undefined;
    let status: 'active' | 'expired' | 'cancelled' | 'invalid' = 'active';

    if (isSubscription) {
      licenseType = 'subscription';
      // For subscriptions, check if there's a current period end
      const subscriptionId = latestTransaction.metadata?.stripeSubscriptionId as string;
      if (subscriptionId) {
        // In a real implementation, you'd fetch subscription details from Stripe
        // For now, we'll assume active if transaction is recent
        const transactionAge = Date.now() - latestTransaction.timestamp.getTime();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (transactionAge > thirtyDays) {
          status = 'expired';
        }
      }
    } else {
      // For one-time purchases, check if there's an expiration in metadata
      if (latestTransaction.metadata?.expiresAt) {
        expiresAt = new Date(latestTransaction.metadata.expiresAt as string);
        if (expiresAt < new Date()) {
          status = 'expired';
        }
      }
    }

    // Check for refunds/cancellations
    const refundedTransactions = await listTransactions(this.prisma, {
      moduleId,
      purchaserId,
      status: 'refunded',
    });

    if (refundedTransactions.length > 0) {
      // If latest transaction is refunded, license is invalid
      const latestRefund = refundedTransactions[0];
      if (latestRefund.timestamp > latestTransaction.timestamp) {
        status = 'cancelled';
      }
    }

    // Calculate usage (number of times module was loaded)
    // In a real implementation, you'd track this separately
    const currentUsage = 0; // Placeholder

    // Get usage limit from metadata
    const usageLimit = latestTransaction.metadata?.usageLimit as number | undefined;

    const license: LicenseInfo = {
      moduleId,
      purchaserId,
      vendorId: latestTransaction.vendorId,
      licenseType,
      status,
      expiresAt,
      usageLimit,
      currentUsage,
    };

    // Cache the result
    this.licenseCache.set(cacheKey, {
      license,
      cachedAt: new Date(),
    });

    return license;
  }

  /**
   * Increment usage count for a license
   */
  async incrementUsage(moduleId: string, purchaserId: string): Promise<void> {
    // In a real implementation, you'd update a usage tracking table
    // For now, we'll just clear the cache to force a refresh
    const cacheKey = `${moduleId}:${purchaserId}`;
    this.licenseCache.delete(cacheKey);
  }

  /**
   * Clear license cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.licenseCache.clear();
  }

  /**
   * Create middleware function for microkernel module loading
   */
  createMiddleware() {
    return async (
      module: DomainModule,
      task: DomainTask
    ): Promise<TaskResult> => {
      // Extract module ID and purchaser ID from task metadata
      const moduleId = task.metadata?.moduleId as string;
      const purchaserId = task.metadata?.purchaserId as string;

      if (!moduleId || !purchaserId) {
        // If no license info in metadata, allow (for backward compatibility)
        // In production, you might want to require license info
        return {
          success: true,
          data: { message: 'No license check required' },
        };
      }

      // Check license
      const licenseCheck = await this.checkLicense(moduleId, purchaserId);

      if (!licenseCheck.valid) {
        return {
          success: false,
          error: `License validation failed: ${licenseCheck.reason}`,
          metadata: {
            licenseCheck,
          },
        };
      }

      // Increment usage
      await this.incrementUsage(moduleId, purchaserId);

      // License is valid, proceed with module loading
      return {
        success: true,
        data: {
          message: 'License validated',
          licenseInfo: licenseCheck,
        },
      };
    };
  }

  /**
   * Wrap a domain module with license enforcement
   */
  wrapModule(module: DomainModule): DomainModule {
    const middleware = this.createMiddleware();

    return {
      ...module,
      handleTask: async (task: DomainTask): Promise<TaskResult> => {
        // Run license check middleware
        const licenseResult = await middleware(module, task);
        if (!licenseResult.success) {
          return licenseResult;
        }

        // If license is valid, proceed with original task handling
        return module.handleTask(task);
      },
    };
  }
}

