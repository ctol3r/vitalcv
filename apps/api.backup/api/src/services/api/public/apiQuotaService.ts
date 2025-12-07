// B235B-API-013: APIQuotaService - Tracks usage and applies quotas

import { PrismaClient } from '@prisma/client';

export interface QuotaConfig {
  requests?: number; // Requests per period
  dataTransfer?: number; // Bytes per period
  specialOperations?: number; // Special operations per period
  periodDays?: number; // Quota period in days (default: 30)
}

export interface QuotaStatus {
  quotaType: string;
  limit: number;
  currentUsage: number;
  remaining: number;
  resetAt: Date;
  isExceeded: boolean;
  percentageUsed: number;
}

export interface UsageUpdate {
  requests?: number;
  dataTransferBytes?: number;
  isSpecialOp?: boolean;
}

export class APIQuotaService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Initialize quotas for an API key
   */
  async initializeQuotas(
    apiKeyId: string,
    config: QuotaConfig
  ): Promise<void> {
    const periodDays = config.periodDays || 30;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + periodDays);
    const resetAt = new Date(periodEnd);

    const quotas = [];

    if (config.requests !== undefined) {
      quotas.push({
        apiKeyId,
        quotaType: 'requests',
        limit: config.requests,
        currentUsage: 0,
        periodStart: now,
        periodEnd,
        resetAt,
      });
    }

    if (config.dataTransfer !== undefined) {
      quotas.push({
        apiKeyId,
        quotaType: 'dataTransfer',
        limit: config.dataTransfer,
        currentUsage: 0,
        periodStart: now,
        periodEnd,
        resetAt,
      });
    }

    if (config.specialOperations !== undefined) {
      quotas.push({
        apiKeyId,
        quotaType: 'specialOperations',
        limit: config.specialOperations,
        currentUsage: 0,
        periodStart: now,
        periodEnd,
        resetAt,
      });
    }

    if (quotas.length > 0) {
      await this.prisma.aPIQuota.createMany({
        data: quotas,
      });
    }
  }

  /**
   * Check if quota allows the operation
   */
  async checkQuota(
    apiKeyId: string,
    usage: UsageUpdate
  ): Promise<{ allowed: boolean; exceededQuotas: string[] }> {
    const now = new Date();
    const exceededQuotas: string[] = [];

    // Get active quotas
    const quotas = await this.prisma.aPIQuota.findMany({
      where: {
        apiKeyId,
        resetAt: { gt: now }, // Not expired
      },
    });

    // Check each quota type
    if (usage.requests !== undefined) {
      const quota = quotas.find((q) => q.quotaType === 'requests');
      if (quota && quota.currentUsage + usage.requests > quota.limit) {
        exceededQuotas.push('requests');
      }
    }

    if (usage.dataTransferBytes !== undefined) {
      const quota = quotas.find((q) => q.quotaType === 'dataTransfer');
      if (quota && quota.currentUsage + usage.dataTransferBytes > quota.limit) {
        exceededQuotas.push('dataTransfer');
      }
    }

    if (usage.isSpecialOp) {
      const quota = quotas.find((q) => q.quotaType === 'specialOperations');
      if (quota && quota.currentUsage + 1 > quota.limit) {
        exceededQuotas.push('specialOperations');
      }
    }

    return {
      allowed: exceededQuotas.length === 0,
      exceededQuotas,
    };
  }

  /**
   * Record usage and update quotas
   */
  async recordUsage(
    apiKeyId: string,
    usage: UsageUpdate
  ): Promise<void> {
    const now = new Date();

    // Reset expired quotas
    await this.resetExpiredQuotas(apiKeyId, now);

    // Update quotas
    const updates: Promise<any>[] = [];

    if (usage.requests !== undefined) {
      updates.push(
        this.prisma.aPIQuota.updateMany({
          where: {
            apiKeyId,
            quotaType: 'requests',
            resetAt: { gt: now },
          },
          data: {
            currentUsage: { increment: usage.requests },
          },
        })
      );
    }

    if (usage.dataTransferBytes !== undefined) {
      updates.push(
        this.prisma.aPIQuota.updateMany({
          where: {
            apiKeyId,
            quotaType: 'dataTransfer',
            resetAt: { gt: now },
          },
          data: {
            currentUsage: { increment: usage.dataTransferBytes },
          },
        })
      );
    }

    if (usage.isSpecialOp) {
      updates.push(
        this.prisma.aPIQuota.updateMany({
          where: {
            apiKeyId,
            quotaType: 'specialOperations',
            resetAt: { gt: now },
          },
          data: {
            currentUsage: { increment: 1 },
          },
        })
      );
    }

    await Promise.all(updates);

    // Check if approaching limits and notify
    await this.checkAndNotifyApproachingLimits(apiKeyId);
  }

  /**
   * Get quota status for an API key
   */
  async getQuotaStatus(apiKeyId: string): Promise<QuotaStatus[]> {
    const now = new Date();

    // Reset expired quotas first
    await this.resetExpiredQuotas(apiKeyId, now);

    const quotas = await this.prisma.aPIQuota.findMany({
      where: {
        apiKeyId,
        resetAt: { gt: now },
      },
    });

    return quotas.map((quota) => {
      const remaining = Math.max(0, quota.limit - quota.currentUsage);
      const percentageUsed = (quota.currentUsage / quota.limit) * 100;

      return {
        quotaType: quota.quotaType,
        limit: quota.limit,
        currentUsage: quota.currentUsage,
        remaining,
        resetAt: quota.resetAt,
        isExceeded: quota.currentUsage >= quota.limit,
        percentageUsed,
      };
    });
  }

  /**
   * Reset expired quotas
   */
  private async resetExpiredQuotas(
    apiKeyId: string,
    now: Date
  ): Promise<void> {
    const expiredQuotas = await this.prisma.aPIQuota.findMany({
      where: {
        apiKeyId,
        resetAt: { lte: now },
      },
    });

    if (expiredQuotas.length === 0) return;

    // Create new quota periods for expired ones
    const newQuotas = expiredQuotas.map((quota) => {
      const periodDays = 30; // Default period
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + periodDays);
      const resetAt = new Date(periodEnd);

      return {
        apiKeyId: quota.apiKeyId,
        quotaType: quota.quotaType,
        limit: quota.limit, // Keep same limit
        currentUsage: 0,
        periodStart: now,
        periodEnd,
        resetAt,
      };
    });

    // Delete old quotas and create new ones
    await this.prisma.$transaction([
      this.prisma.aPIQuota.deleteMany({
        where: {
          id: { in: expiredQuotas.map((q) => q.id) },
        },
      }),
      this.prisma.aPIQuota.createMany({
        data: newQuotas,
      }),
    ]);
  }

  /**
   * Check if quotas are approaching limits and notify clients
   */
  private async checkAndNotifyApproachingLimits(
    apiKeyId: string
  ): Promise<void> {
    const statuses = await this.getQuotaStatus(apiKeyId);
    const WARNING_THRESHOLD = 80; // Notify at 80% usage

    for (const status of statuses) {
      if (
        status.percentageUsed >= WARNING_THRESHOLD &&
        status.percentageUsed < 100
      ) {
        // Send notification
        await this.notifyApproachingLimit(apiKeyId, status);
      }
    }
  }

  /**
   * Notify client that they're approaching quota limits
   */
  private async notifyApproachingLimit(
    apiKeyId: string,
    quotaStatus: QuotaStatus
  ): Promise<void> {
    // TODO: Integrate with notification service
    // This should send email/webhook notifications
    console.log('Quota Warning:', {
      apiKeyId,
      quotaType: quotaStatus.quotaType,
      percentageUsed: quotaStatus.percentageUsed,
      remaining: quotaStatus.remaining,
      resetAt: quotaStatus.resetAt,
    });

    // Check if we've already notified recently (avoid spam)
    // In production, track last notification time
  }
}

