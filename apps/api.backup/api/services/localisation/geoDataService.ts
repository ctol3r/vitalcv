/**
 * B230B-INTL-007: GeoDataLocalizationService
 *
 * Ensures sensitive data is stored and processed within allowed jurisdictions.
 * Enforces data localization rules based on RegionalPolicyConfig.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import { RegionalPolicyConfigService } from './models/RegionalPolicyConfig';

const logger = createLogger({ service: 'localisation-geo-data' });

export interface DataLocation {
  countryCode: string;
  regionCode?: string;
  dataCenterId?: string;
}

export interface DataLocalizationCheck {
  allowed: boolean;
  reason?: string;
  requiredJurisdiction?: string;
  currentJurisdiction?: string;
}

/**
 * GeoDataLocalizationService
 *
 * Enforces data localization rules to ensure compliance with regional policies
 */
export class GeoDataLocalizationService {
  private policyService: RegionalPolicyConfigService;

  constructor(private prisma: PrismaClient) {
    this.policyService = new RegionalPolicyConfigService(prisma);
  }

  /**
   * Check if data can be stored/processed in a given jurisdiction
   */
  async canStoreData(
    dataSubjectCountry: string,
    dataSubjectRegion: string | undefined,
    targetJurisdiction: string,
    orgId?: string
  ): Promise<DataLocalizationCheck> {
    logger.info('Checking data storage permission', {
      dataSubjectCountry,
      dataSubjectRegion,
      targetJurisdiction,
      orgId,
    });

    // Get policy for data subject's location
    const policy = await this.policyService.getPolicy(
      dataSubjectCountry,
      dataSubjectRegion,
      orgId
    );

    if (!policy) {
      // No policy found - default to allowing but log warning
      logger.warn('No policy found for data subject location', {
        dataSubjectCountry,
        dataSubjectRegion,
      });
      return {
        allowed: true,
        reason: 'No policy configured for data subject location',
      };
    }

    // Check if target jurisdiction is in allowed list
    const allowedJurisdictions = policy.allowedDataJurisdictions || [];

    // If no restrictions specified, allow all
    if (allowedJurisdictions.length === 0) {
      return {
        allowed: true,
        reason: 'No jurisdiction restrictions configured',
      };
    }

    // Check if target is allowed
    const isAllowed = allowedJurisdictions.includes(targetJurisdiction);

    if (!isAllowed) {
      logger.warn('Data storage not allowed in target jurisdiction', {
        dataSubjectCountry,
        targetJurisdiction,
        allowedJurisdictions,
      });

      return {
        allowed: false,
        reason: `Data localization policy prohibits storage in ${targetJurisdiction}`,
        requiredJurisdiction: allowedJurisdictions[0],
        currentJurisdiction: targetJurisdiction,
      };
    }

    return {
      allowed: true,
      reason: 'Target jurisdiction is in allowed list',
    };
  }

  /**
   * Get required data storage jurisdiction for a data subject
   */
  async getRequiredJurisdiction(
    countryCode: string,
    regionCode?: string,
    orgId?: string
  ): Promise<string | null> {
    const policy = await this.policyService.getPolicy(
      countryCode,
      regionCode,
      orgId
    );

    if (!policy) {
      return null;
    }

    const allowedJurisdictions = policy.allowedDataJurisdictions || [];

    // Return first allowed jurisdiction, or null if no restrictions
    return allowedJurisdictions.length > 0 ? allowedJurisdictions[0] : null;
  }

  /**
   * Validate data transfer between jurisdictions
   */
  async validateDataTransfer(
    sourceJurisdiction: string,
    targetJurisdiction: string,
    dataSubjectCountry: string,
    dataSubjectRegion?: string,
    orgId?: string
  ): Promise<DataLocalizationCheck> {
    logger.info('Validating data transfer', {
      sourceJurisdiction,
      targetJurisdiction,
      dataSubjectCountry,
      dataSubjectRegion,
      orgId,
    });

    // Check if target jurisdiction is allowed
    const check = await this.canStoreData(
      dataSubjectCountry,
      dataSubjectRegion,
      targetJurisdiction,
      orgId
    );

    if (!check.allowed) {
      return check;
    }

    // Additional validation: ensure source is also compliant
    const sourceCheck = await this.canStoreData(
      dataSubjectCountry,
      dataSubjectRegion,
      sourceJurisdiction,
      orgId
    );

    if (!sourceCheck.allowed) {
      return {
        allowed: false,
        reason: `Source jurisdiction ${sourceJurisdiction} is not compliant`,
        currentJurisdiction: sourceJurisdiction,
      };
    }

    return {
      allowed: true,
      reason: 'Data transfer is compliant with localization rules',
    };
  }

  /**
   * Get all allowed jurisdictions for a data subject
   */
  async getAllowedJurisdictions(
    countryCode: string,
    regionCode?: string,
    orgId?: string
  ): Promise<string[]> {
    const policy = await this.policyService.getPolicy(
      countryCode,
      regionCode,
      orgId
    );

    if (!policy) {
      return [];
    }

    return policy.allowedDataJurisdictions || [];
  }

  /**
   * Check if data processing is allowed in a jurisdiction
   */
  async canProcessData(
    dataSubjectCountry: string,
    dataSubjectRegion: string | undefined,
    processingJurisdiction: string,
    orgId?: string
  ): Promise<DataLocalizationCheck> {
    // Processing follows same rules as storage
    return this.canStoreData(
      dataSubjectCountry,
      dataSubjectRegion,
      processingJurisdiction,
      orgId
    );
  }
}

