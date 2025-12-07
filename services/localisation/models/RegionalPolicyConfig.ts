/**
 * B230B-INTL-006: RegionalPolicyConfig model
 *
 * Stores country/region-specific policy settings:
 * - Data retention periods
 * - Privacy rules
 * - Consent requirements
 * - Supports overrides per organization
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';

const logger = createLogger({ service: 'localisation-regional-policy' });

export interface RegionalPolicyConfigInput {
  countryCode: string;
  regionCode?: string;
  orgId?: string;
  dataRetentionDays?: number;
  requiresExplicitConsent?: boolean;
  requiresCookieConsent?: boolean;
  allowedDataJurisdictions?: string[];
  privacyRules?: Record<string, unknown>;
  consentRequirements?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface RegionalPolicyConfigOutput {
  id: string;
  countryCode: string;
  regionCode?: string;
  orgId?: string;
  dataRetentionDays: number;
  requiresExplicitConsent: boolean;
  requiresCookieConsent: boolean;
  allowedDataJurisdictions: string[];
  privacyRules?: Record<string, unknown>;
  consentRequirements?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * RegionalPolicyConfigService
 *
 * Manages regional policy configurations with support for organization overrides
 */
export class RegionalPolicyConfigService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get policy configuration for a country/region, with optional org override
   */
  async getPolicy(
    countryCode: string,
    regionCode?: string,
    orgId?: string
  ): Promise<RegionalPolicyConfigOutput | null> {
    logger.info('Getting regional policy', { countryCode, regionCode, orgId });

    // First try org-specific override
    if (orgId) {
      const orgPolicy = await this.prisma.regionalPolicyConfig.findUnique({
        where: {
          countryCode_regionCode_orgId: {
            countryCode,
            regionCode: regionCode || null,
            orgId,
          },
        },
      });

      if (orgPolicy) {
        return this.mapToOutput(orgPolicy);
      }
    }

    // Fall back to region-specific default
    if (regionCode) {
      const regionPolicy = await this.prisma.regionalPolicyConfig.findUnique({
        where: {
          countryCode_regionCode_orgId: {
            countryCode,
            regionCode,
            orgId: null,
          },
        },
      });

      if (regionPolicy) {
        return this.mapToOutput(regionPolicy);
      }
    }

    // Fall back to country default
    const countryPolicy = await this.prisma.regionalPolicyConfig.findUnique({
      where: {
        countryCode_regionCode_orgId: {
          countryCode,
          regionCode: null,
          orgId: null,
        },
      },
    });

    return countryPolicy ? this.mapToOutput(countryPolicy) : null;
  }

  /**
   * Create or update a policy configuration
   */
  async upsertPolicy(
    input: RegionalPolicyConfigInput
  ): Promise<RegionalPolicyConfigOutput> {
    logger.info('Upserting regional policy', {
      countryCode: input.countryCode,
      regionCode: input.regionCode,
      orgId: input.orgId,
    });

    const policy = await this.prisma.regionalPolicyConfig.upsert({
      where: {
        countryCode_regionCode_orgId: {
          countryCode: input.countryCode,
          regionCode: input.regionCode || null,
          orgId: input.orgId || null,
        },
      },
      create: {
        countryCode: input.countryCode,
        regionCode: input.regionCode || null,
        orgId: input.orgId || null,
        dataRetentionDays: input.dataRetentionDays ?? 2555,
        requiresExplicitConsent: input.requiresExplicitConsent ?? true,
        requiresCookieConsent: input.requiresCookieConsent ?? true,
        allowedDataJurisdictions: input.allowedDataJurisdictions || [],
        privacyRules: input.privacyRules || null,
        consentRequirements: input.consentRequirements || null,
        metadata: input.metadata || null,
      },
      update: {
        dataRetentionDays: input.dataRetentionDays,
        requiresExplicitConsent: input.requiresExplicitConsent,
        requiresCookieConsent: input.requiresCookieConsent,
        allowedDataJurisdictions: input.allowedDataJurisdictions,
        privacyRules: input.privacyRules,
        consentRequirements: input.consentRequirements,
        metadata: input.metadata,
      },
    });

    return this.mapToOutput(policy);
  }

  /**
   * Delete a policy configuration
   */
  async deletePolicy(
    countryCode: string,
    regionCode?: string,
    orgId?: string
  ): Promise<boolean> {
    logger.info('Deleting regional policy', { countryCode, regionCode, orgId });

    try {
      await this.prisma.regionalPolicyConfig.delete({
        where: {
          countryCode_regionCode_orgId: {
            countryCode,
            regionCode: regionCode || null,
            orgId: orgId || null,
          },
        },
      });

      return true;
    } catch (error: any) {
      if (error.code === 'P2025') {
        // Record not found
        return false;
      }
      throw error;
    }
  }

  /**
   * List all policies for a country
   */
  async listPoliciesByCountry(
    countryCode: string
  ): Promise<RegionalPolicyConfigOutput[]> {
    const policies = await this.prisma.regionalPolicyConfig.findMany({
      where: { countryCode },
      orderBy: [
        { orgId: 'asc' }, // Org-specific first
        { regionCode: 'asc' },
      ],
    });

    return policies.map((p) => this.mapToOutput(p));
  }

  /**
   * Get default policy for a country (no region, no org)
   */
  async getDefaultPolicy(
    countryCode: string
  ): Promise<RegionalPolicyConfigOutput | null> {
    const policy = await this.prisma.regionalPolicyConfig.findUnique({
      where: {
        countryCode_regionCode_orgId: {
          countryCode,
          regionCode: null,
          orgId: null,
        },
      },
    });

    return policy ? this.mapToOutput(policy) : null;
  }

  private mapToOutput(policy: any): RegionalPolicyConfigOutput {
    return {
      id: policy.id,
      countryCode: policy.countryCode,
      regionCode: policy.regionCode || undefined,
      orgId: policy.orgId || undefined,
      dataRetentionDays: policy.dataRetentionDays,
      requiresExplicitConsent: policy.requiresExplicitConsent,
      requiresCookieConsent: policy.requiresCookieConsent,
      allowedDataJurisdictions: policy.allowedDataJurisdictions || [],
      privacyRules: (policy.privacyRules as Record<string, unknown>) || undefined,
      consentRequirements:
        (policy.consentRequirements as Record<string, unknown>) || undefined,
      metadata: (policy.metadata as Record<string, unknown>) || undefined,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    };
  }
}

