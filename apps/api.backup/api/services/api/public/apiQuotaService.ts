/**
 * B235B-API-013: APIQuotaService
 *
 * Tracks total requests, data transfer, and special operation usage per API key.
 * Applies quotas and notifies clients when they approach limits.
 */

import { PrismaClient } from '@prisma/client';

export interface QuotaConfig {
  requestsPerMonth: number;
  dataTransferBytesPerMonth: number;
  specialOperationsPerMonth: number;
}

export interface QuotaStatus {
  quotaType: string;
  limit: number;
  currentUsage: number;
  remaining: number;
  percentageUsed: number;
  resetAt: Date;
  isExceeded: boolean;
  isWarning: boolean; // >80% usage
}

export interface UsageStats {
  totalRequests: number;
  totalDataTransfer: number;
  totalSpecialOps: number;
  periodStart: Date;
  periodEnd: Date;
}

const DEFAULT_QUOTAS: QuotaConfig = {
  requestsPerMonth: 10000,
  dataTransferBytesPerMonth: 10 * 1024 * 1024 * 1024, // 10 GB
  specialOperationsPerMonth: 100,
};

const WARNING_THRESHOLD = 0.8; // 80% usage triggers warning

export class APIQuotaService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Initialize quotas for an API key
   */
  async initializeQuotas(
    apiKeyId: string,
    customQuotas?: Partial<QuotaConfig>
  ): Promise<void> {
    const quotas = { ...DEFAULT_QUOTAS, ...customQuotas };
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Create quota records for each type
    await Promise.all([
      this.prisma.aPIQuota.create({
        data: {
          apiKeyId,
          quotaType: 'requests',
          limit: quotas.requestsPerMonth,
          currentUsage: 0,
          periodStart: now,
          periodEnd,
          resetAt: periodEnd,
        },
      }),
      this.prisma.aPIQuota.create({
        data: {
          apiKeyId,
          quotaType: 'dataTransfer',
          limit: quotas.dataTransferBytesPerMonth,
          currentUsage: 0,
          periodStart: now,
          periodEnd,
          resetAt: periodEnd,
        },
      }),
      this.prisma.aPIQuota.create({
        data: {
          apiKeyId,
          quotaType: 'specialOperations',
          limit: quotas.specialOperationsPerMonth,
          currentUsage: 0,
          periodStart: now,
          periodEnd,
          resetAt: periodEnd,
        },
      }),
    ]);
  }

  /**
   * Check if request is allowed (within quota)
   */
  async checkQuota(
    apiKeyId: string,
    quotaType: 'requests' | 'dataTransfer' | 'specialOperations',
    amount: number = 1
  ): Promise<{ allowed: boolean; status: QuotaStatus }> {
    const quota = await this.getQuota(apiKeyId, quotaType);

    if (!quota) {
      // Initialize quotas if they don't exist
      await this.initializeQuotas(apiKeyId);
      return this.checkQuota(apiKeyId, quotaType, amount);
    }

    // Check if quota period has expired
    if (new Date() > quota.resetAt) {
      await this.resetQuota(apiKeyId, quotaType);
      return this.checkQuota(apiKeyId, quotaType, amount);
    }

    const newUsage = quota.currentUsage + amount;
    const allowed = newUsage <= quota.limit;
    const percentageUsed = quota.limit > 0 ? newUsage / quota.limit : 0;

    const status: QuotaStatus = {
      quotaType,
      limit: quota.limit,
      currentUsage: newUsage,
      remaining: Math.max(0, quota.limit - newUsage),
      percentageUsed,
      resetAt: quota.resetAt,
      isExceeded: !allowed,
      isWarning: percentageUsed >= WARNING_THRESHOLD,
    };

    // Send warning notification if approaching limit
    if (status.isWarning && !quota.warningSent) {
      await this.sendQuotaWarning(apiKeyId, status);
      await this.prisma.aPIQuota.update({
        where: { id: quota.id },
        data: { warningSent: true },
      });
    }

    return { allowed, status };
  }

  /**
   * Record usage (call after successful request)
   */
  async recordUsage(
    apiKeyId: string,
    quotaType: 'requests' | 'dataTransfer' | 'specialOperations',
    amount: number
  ): Promise<void> {
    const quota = await this.getQuota(apiKeyId, quotaType);

    if (!quota) {
      await this.initializeQuotas(apiKeyId);
      return this.recordUsage(apiKeyId, quotaType, amount);
    }

    // Reset if period expired
    if (new Date() > quota.resetAt) {
      await this.resetQuota(apiKeyId, quotaType);
      await this.recordUsage(apiKeyId, quotaType, amount);
      return;
    }

    await this.prisma.aPIQuota.update({
      where: { id: quota.id },
      data: {
        currentUsage: {
          increment: amount,
        },
      },
    });
  }

  /**
   * Get quota status for an API key
   */
  async getQuotaStatus(apiKeyId: string): Promise<QuotaStatus[]> {
    const quotas = await this.prisma.aPIQuota.findMany({
      where: { apiKeyId },
    });

    return quotas.map((q) => {
      const percentageUsed = q.limit > 0 ? q.currentUsage / q.limit : 0;
      return {
        quotaType: q.quotaType,
        limit: q.limit,
        currentUsage: q.currentUsage,
        remaining: Math.max(0, q.limit - q.currentUsage),
        percentageUsed,
        resetAt: q.resetAt,
        isExceeded: q.currentUsage >= q.limit,
        isWarning: percentageUsed >= WARNING_THRESHOLD,
      };
    });
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(apiKeyId: string): Promise<UsageStats> {
    const quotas = await this.prisma.aPIQuota.findMany({
      where: { apiKeyId },
    });

    const requestsQuota = quotas.find((q) => q.quotaType === 'requests');
    const dataTransferQuota = quotas.find(
      (q) => q.quotaType === 'dataTransfer'
    );
    const specialOpsQuota = quotas.find(
      (q) => q.quotaType === 'specialOperations'
    );

    return {
      totalRequests: requestsQuota?.currentUsage || 0,
      totalDataTransfer: dataTransferQuota?.currentUsage || 0,
      totalSpecialOps: specialOpsQuota?.currentUsage || 0,
      periodStart: requestsQuota?.periodStart || new Date(),
      periodEnd: requestsQuota?.periodEnd || new Date(),
    };
  }

  /**
   * Reset quota for a new period
   */
  private async resetQuota(
    apiKeyId: string,
    quotaType: string
  ): Promise<void> {
    const quota = await this.prisma.aPIQuota.findFirst({
      where: { apiKeyId, quotaType },
    });

    if (!quota) {
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.prisma.aPIQuota.update({
      where: { id: quota.id },
      data: {
        currentUsage: 0,
        periodStart: now,
        periodEnd,
        resetAt: periodEnd,
        warningSent: false,
      },
    });
  }

  /**
   * Get quota record
   */
  private async getQuota(apiKeyId: string, quotaType: string) {
    return this.prisma.aPIQuota.findFirst({
      where: { apiKeyId, quotaType },
    });
  }

  /**
   * Send quota warning notification
   */
  private async sendQuotaWarning(
    apiKeyId: string,
    status: QuotaStatus
  ): Promise<void> {
    const apiKey = await this.prisma.aPIKey.findUnique({
      where: { id: apiKeyId },
      select: { ownerOrgId: true, keyPrefix: true },
    });

    if (!apiKey) {
      return;
    }

    // TODO: Integrate with notification service
    console.log('[QUOTA_WARNING]', {
      apiKeyId,
      orgId: apiKey.ownerOrgId,
      quotaType: status.quotaType,
      percentageUsed: (status.percentageUsed * 100).toFixed(2) + '%',
      remaining: status.remaining,
      resetAt: status.resetAt,
    });

    // Send notification to organization
    // await notificationService.send({
    //   orgId: apiKey.ownerOrgId,
    //   type: 'QUOTA_WARNING',
    //   data: { apiKeyId, status },
    // });
  }
}

