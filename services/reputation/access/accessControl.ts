/**
 * B224B-REP-007: ReputationAccessControl
 *
 * Enforces sharing policies: only recipients with proper consent see allowed metrics;
 * supports anonymised aggregate views.
 */

import { PrismaClient, RecipientType } from '@prisma/client';
import { ReputationSharingPolicyService } from '../models/ReputationSharingPolicy';
import { createLogger } from '@chai-vc/logging-core';

const logger = createLogger({ service: 'reputation-access-control' });

export interface ReputationMetrics {
  overallScore?: number;
  qualityScore?: number;
  credentialScore?: number;
  safetyScore?: number;
  [key: string]: any; // Allow additional metrics
}

export interface AccessRequest {
  clinicianId: string;
  recipientType: RecipientType;
  recipientId?: string;
  requestedMetrics?: string[];
}

export interface AccessResult {
  allowed: boolean;
  allowedMetrics: string[];
  deniedMetrics: string[];
  anonymized: boolean;
  reason?: string;
}

/**
 * ReputationAccessControl service
 */
export class ReputationAccessControl {
  private policyService: ReputationSharingPolicyService;

  constructor(private prisma: PrismaClient) {
    this.policyService = new ReputationSharingPolicyService(prisma);
  }

  /**
   * Check if a recipient has access to reputation metrics
   */
  async checkAccess(request: AccessRequest): Promise<AccessResult> {
    logger.info('Checking reputation access', {
      clinicianId: request.clinicianId,
      recipientType: request.recipientType,
      recipientId: request.recipientId,
    });

    // Get active policies for this clinician and recipient
    const policies = await this.policyService.getActivePolicies(
      request.clinicianId,
      request.recipientType,
      request.recipientId
    );

    if (policies.length === 0) {
      logger.warn('No active sharing policy found', {
        clinicianId: request.clinicianId,
        recipientType: request.recipientType,
      });
      return {
        allowed: false,
        allowedMetrics: [],
        deniedMetrics: request.requestedMetrics || [],
        anonymized: false,
        reason: 'No active sharing policy found',
      };
    }

    // Collect all allowed metrics from matching policies
    const allowedMetricsSet = new Set<string>();
    for (const policy of policies) {
      policy.allowedMetrics.forEach((metric) => allowedMetricsSet.add(metric));
    }

    const allowedMetrics = Array.from(allowedMetricsSet);

    // If specific metrics were requested, filter to only those
    let finalAllowedMetrics = allowedMetrics;
    let deniedMetrics: string[] = [];

    if (request.requestedMetrics && request.requestedMetrics.length > 0) {
      finalAllowedMetrics = request.requestedMetrics.filter((m) => allowedMetrics.includes(m));
      deniedMetrics = request.requestedMetrics.filter((m) => !allowedMetrics.includes(m));
    }

    if (finalAllowedMetrics.length === 0) {
      return {
        allowed: false,
        allowedMetrics: [],
        deniedMetrics,
        anonymized: false,
        reason: 'No requested metrics are allowed by sharing policy',
      };
    }

    return {
      allowed: true,
      allowedMetrics: finalAllowedMetrics,
      deniedMetrics,
      anonymized: false,
    };
  }

  /**
   * Get reputation metrics filtered by access control
   */
  async getReputationMetrics(
    request: AccessRequest,
    allMetrics: ReputationMetrics
  ): Promise<ReputationMetrics> {
    const accessResult = await this.checkAccess(request);

    if (!accessResult.allowed) {
      logger.warn('Access denied to reputation metrics', {
        clinicianId: request.clinicianId,
        recipientType: request.recipientType,
        reason: accessResult.reason,
      });
      return {};
    }

    // Filter metrics to only those allowed
    const filteredMetrics: ReputationMetrics = {};
    for (const metric of accessResult.allowedMetrics) {
      if (metric in allMetrics) {
        filteredMetrics[metric] = allMetrics[metric];
      }
    }

    return filteredMetrics;
  }

  /**
   * Get anonymized aggregate view of reputation metrics
   * This provides aggregate statistics without revealing individual clinician data
   */
  async getAnonymizedAggregateView(
    recipientType: RecipientType,
    recipientId: string,
    filters?: {
      specialty?: string;
      region?: string;
      minScore?: number;
      maxScore?: number;
    }
  ): Promise<{
    averageScore: number;
    medianScore: number;
    scoreDistribution: Record<string, number>;
    sampleSize: number;
    anonymized: true;
  }> {
    logger.info('Generating anonymized aggregate view', {
      recipientType,
      recipientId,
      filters,
    });

    // Query all clinicians who have shared metrics with this recipient
    const policies = await this.prisma.reputationSharingPolicy.findMany({
      where: {
        recipientType,
        consentGiven: true,
        AND: [
          {
            OR: [
              { recipientId: recipientId },
              { recipientId: null }, // Policies that apply to all recipients
            ],
          },
          {
            OR: [
              { expiryDate: null },
              { expiryDate: { gt: new Date() } },
            ],
          },
        ],
      },
      include: {
        // Note: This assumes ClinicianReputation model exists
        // In production, you'd join with the actual reputation table
      },
    });

    // In production, you would:
    // 1. Join with ClinicianReputation table
    // 2. Apply filters (specialty, region, etc.)
    // 3. Calculate aggregate statistics
    // 4. Return anonymized results

    // Placeholder implementation
    const sampleSize = policies.length;
    const averageScore = 75.0; // Placeholder
    const medianScore = 75.0; // Placeholder
    const scoreDistribution: Record<string, number> = {
      '0-50': 0,
      '51-70': 0,
      '71-85': 0,
      '86-100': 0,
    };

    return {
      averageScore,
      medianScore,
      scoreDistribution,
      sampleSize,
      anonymized: true,
    };
  }

  /**
   * Check if a specific metric is allowed for a recipient
   */
  async isMetricAllowed(
    clinicianId: string,
    metric: string,
    recipientType: RecipientType,
    recipientId?: string
  ): Promise<boolean> {
    const accessResult = await this.checkAccess({
      clinicianId,
      recipientType,
      recipientId,
      requestedMetrics: [metric],
    });

    return accessResult.allowed && accessResult.allowedMetrics.includes(metric);
  }
}

