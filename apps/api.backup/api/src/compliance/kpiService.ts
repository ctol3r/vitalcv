/**
 * METRIC-010: Core KPIs Service for Credentialing Lifecycle
 *
 * Provides aggregation and computation of KPIs:
 * - TimeToCredential (from initial application/verification request to completed credential packet)
 * - VerificationEvent (per VC check with outcome)
 * - ApplicationFunnel (sourcing → apply → verified → hired)
 */

import { PrismaClient } from '@prisma/client';

export interface TimeToCredentialStats {
  median: number | null;
  mean: number | null;
  p95: number | null;
  total: number;
  completed: number;
  inProgress: number;
}

export interface VerificationEventStats {
  total: number;
  verified: number;
  failed: number;
  pending: number;
  byType: Record<string, number>;
  failureRate: number;
}

export interface ApplicationFunnelStats {
  sourced: number;
  applied: number;
  verified: number;
  hired: number;
  conversionRates: {
    sourcedToApplied: number;
    appliedToVerified: number;
    verifiedToHired: number;
    overall: number;
  };
}

export class KpiService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Compute TimeToCredential statistics
   */
  async computeTimeToCredentialStats(params: {
    organizationId?: string;
    providerType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<TimeToCredentialStats> {
    const where: any = {};

    if (params.organizationId) {
      where.organizationId = params.organizationId;
    }

    if (params.providerType) {
      where.providerType = params.providerType;
    }

    if (params.startDate || params.endDate) {
      where.startedAt = {};
      if (params.startDate) {
        where.startedAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.startedAt.lte = params.endDate;
      }
    }

    const records = await this.prisma.timeToCredential.findMany({
      where,
    });

    const completed = records.filter(r => r.status === 'completed' && r.timeToCredentialDays !== null);
    const completedDays = completed.map(r => r.timeToCredentialDays!).sort((a, b) => a - b);

    let median: number | null = null;
    let mean: number | null = null;
    let p95: number | null = null;

    if (completedDays.length > 0) {
      // Calculate median
      const mid = Math.floor(completedDays.length / 2);
      median = completedDays.length % 2 === 0
        ? (completedDays[mid - 1] + completedDays[mid]) / 2
        : completedDays[mid];

      // Calculate mean
      mean = completedDays.reduce((sum, days) => sum + days, 0) / completedDays.length;

      // Calculate 95th percentile
      const p95Index = Math.ceil(completedDays.length * 0.95) - 1;
      p95 = completedDays[p95Index] || null;
    }

    return {
      median,
      mean,
      p95,
      total: records.length,
      completed: completed.length,
      inProgress: records.filter(r => r.status === 'in_progress').length,
    };
  }

  /**
   * Compute VerificationEvent statistics
   */
  async computeVerificationEventStats(params: {
    organizationId?: string;
    credentialId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<VerificationEventStats> {
    const where: any = {};

    if (params.organizationId) {
      where.verifierOrgId = params.organizationId;
    }

    if (params.credentialId) {
      where.credentialId = params.credentialId;
    }

    if (params.startDate || params.endDate) {
      where.verifiedAt = {};
      if (params.startDate) {
        where.verifiedAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.verifiedAt.lte = params.endDate;
      }
    }

    const events = await this.prisma.verificationEvent.findMany({
      where,
    });

    const byType: Record<string, number> = {};
    let verified = 0;
    let failed = 0;
    let pending = 0;

    for (const event of events) {
      // Count by type
      byType[event.verificationType] = (byType[event.verificationType] || 0) + 1;

      // Count by result
      if (event.result === 'VERIFIED') {
        verified++;
      } else if (event.result === 'FAILED') {
        failed++;
      } else if (event.result === 'PENDING') {
        pending++;
      }
    }

    const total = events.length;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;

    return {
      total,
      verified,
      failed,
      pending,
      byType,
      failureRate,
    };
  }

  /**
   * Compute ApplicationFunnel statistics
   */
  async computeApplicationFunnelStats(params: {
    organizationId?: string;
    providerType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ApplicationFunnelStats> {
    const where: any = {};

    if (params.organizationId) {
      where.organizationId = params.organizationId;
    }

    if (params.providerType) {
      where.providerType = params.providerType;
    }

    if (params.startDate || params.endDate) {
      where.appliedAt = {};
      if (params.startDate) {
        where.appliedAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.appliedAt.lte = params.endDate;
      }
    }

    const funnelRecords = await this.prisma.applicationFunnel.findMany({
      where,
    });

    const sourced = funnelRecords.filter(r => r.sourcedAt !== null).length;
    const applied = funnelRecords.length;
    const verified = funnelRecords.filter(r => r.verifiedAt !== null).length;
    const hired = funnelRecords.filter(r => r.hiredAt !== null).length;

    const conversionRates = {
      sourcedToApplied: sourced > 0 ? (applied / sourced) * 100 : 0,
      appliedToVerified: applied > 0 ? (verified / applied) * 100 : 0,
      verifiedToHired: verified > 0 ? (hired / verified) * 100 : 0,
      overall: sourced > 0 ? (hired / sourced) * 100 : 0,
    };

    return {
      sourced,
      applied,
      verified,
      hired,
      conversionRates,
    };
  }

  /**
   * Track time to credential (create or update record)
   */
  async trackTimeToCredential(params: {
    credentialId: string;
    applicationId?: string;
    organizationId?: string;
    providerType?: string;
    startedAt: Date;
    completedAt?: Date;
  }): Promise<string> {
    const timeToCredentialDays = params.completedAt
      ? Math.ceil(
          (params.completedAt.getTime() - params.startedAt.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

    const status = params.completedAt ? 'completed' : 'in_progress';

    const record = await this.prisma.timeToCredential.upsert({
      where: {
        credentialId: params.credentialId,
      },
      create: {
        credentialId: params.credentialId,
        applicationId: params.applicationId,
        organizationId: params.organizationId,
        providerType: params.providerType,
        startedAt: params.startedAt,
        completedAt: params.completedAt,
        timeToCredentialDays,
        status,
      },
      update: {
        completedAt: params.completedAt,
        timeToCredentialDays,
        status,
      },
    });

    return record.id;
  }

  /**
   * Record a verification event
   */
  async recordVerificationEvent(params: {
    credentialId?: string;
    verifierOrgId?: string;
    verifierUserId?: string;
    verificationType: string;
    result: string;
    reason?: string;
    credentialHash?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const event = await this.prisma.verificationEvent.create({
      data: {
        credentialId: params.credentialId,
        verifierOrgId: params.verifierOrgId,
        verifierUserId: params.verifierUserId,
        verificationType: params.verificationType,
        result: params.result,
        reason: params.reason,
        credentialHash: params.credentialHash,
        metadata: params.metadata as any,
      },
    });

    return event.id;
  }

  /**
   * Track application funnel progression
   */
  async trackApplicationFunnel(params: {
    applicationId: string;
    organizationId?: string;
    providerType?: string;
    stage: 'sourced' | 'applied' | 'verified' | 'hired' | 'rejected';
    timestamp?: Date;
  }): Promise<string> {
    const now = params.timestamp || new Date();

    const existing = await this.prisma.applicationFunnel.findUnique({
      where: { applicationId: params.applicationId },
    });

    const stageTimestamps = existing?.stageTimestamps as Record<string, string> || {};
    stageTimestamps[params.stage] = now.toISOString();

    // Set appropriate timestamp fields
    const updateData: any = {
      stageCurrent: params.stage,
      stageTimestamps: stageTimestamps as any,
    };

    if (params.stage === 'sourced') {
      updateData.sourcedAt = now;
    } else if (params.stage === 'applied') {
      updateData.appliedAt = now;
    } else if (params.stage === 'verified') {
      updateData.verifiedAt = now;
    } else if (params.stage === 'hired') {
      updateData.hiredAt = now;
    }

    const record = await this.prisma.applicationFunnel.upsert({
      where: {
        applicationId: params.applicationId,
      },
      create: {
        applicationId: params.applicationId,
        organizationId: params.organizationId,
        providerType: params.providerType,
        appliedAt: params.stage === 'applied' ? now : new Date(), // Default to now if not set
        ...updateData,
      },
      update: updateData,
    });

    return record.id;
  }

  /**
   * Get comprehensive KPI dashboard data
   */
  async getDashboardData(params: {
    organizationId?: string;
    providerType?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const [timeToCredential, verificationEvents, applicationFunnel] = await Promise.all([
      this.computeTimeToCredentialStats(params),
      this.computeVerificationEventStats(params),
      this.computeApplicationFunnelStats(params),
    ]);

    return {
      timeToCredential,
      verificationEvents,
      applicationFunnel,
      computedAt: new Date(),
    };
  }
}

