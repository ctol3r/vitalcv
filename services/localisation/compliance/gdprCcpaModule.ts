/**
 * B230B-INTL-008: GDPRCCPAModule
 *
 * Implements region-specific privacy compliance:
 * - Legal basis management
 * - Cookie consent
 * - Data access/deletion requests
 * - Integrates with DataDeletion API
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import { RegionalPolicyConfigService } from '../models/RegionalPolicyConfig';
import { DataDeletionService } from '../../../reputation/privacy/dataDeletion';

const logger = createLogger({ service: 'localisation-gdpr-ccpa' });

export type LegalBasis =
  | 'CONSENT'
  | 'CONTRACT'
  | 'LEGAL_OBLIGATION'
  | 'VITAL_INTERESTS'
  | 'PUBLIC_TASK'
  | 'LEGITIMATE_INTERESTS';

export type ConsentType = 'ESSENTIAL' | 'ANALYTICS' | 'MARKETING' | 'FUNCTIONAL';

export interface ConsentRecord {
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  legalBasis?: LegalBasis;
  metadata?: Record<string, unknown>;
}

export interface DataAccessRequest {
  userId: string;
  requestType: 'ACCESS' | 'PORTABILITY' | 'DELETION';
  requestedAt: Date;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  completedAt?: Date;
  exportUrl?: string;
  errorMessage?: string;
}

/**
 * GDPRCCPAModule
 *
 * Handles GDPR and CCPA compliance requirements
 */
export class GDPRCCPAModule {
  private policyService: RegionalPolicyConfigService;
  private deletionService: DataDeletionService;

  constructor(private prisma: PrismaClient) {
    this.policyService = new RegionalPolicyConfigService(prisma);
    this.deletionService = new DataDeletionService(prisma);
  }

  /**
   * Record user consent
   */
  async recordConsent(
    userId: string,
    consentType: ConsentType,
    granted: boolean,
    countryCode: string,
    regionCode?: string,
    legalBasis?: LegalBasis,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    logger.info('Recording consent', {
      userId,
      consentType,
      granted,
      countryCode,
      regionCode,
    });

    // Get policy to validate consent requirements
    const policy = await this.policyService.getPolicy(
      countryCode,
      regionCode
    );

    if (policy?.requiresExplicitConsent && granted && !legalBasis) {
      throw new Error(
        'Legal basis required for consent in this jurisdiction'
      );
    }

    // Store consent record (would typically be in a Consent table)
    // For now, we'll use AuditEvent to track consents
    await this.prisma.auditEvent.create({
      data: {
        userId,
        type: 'CONSENT_RECORDED',
        data: {
          consentType,
          granted,
          legalBasis,
          countryCode,
          regionCode,
          metadata,
        },
      },
    });
  }

  /**
   * Check if consent is required for a given operation
   */
  async requiresConsent(
    operation: string,
    countryCode: string,
    regionCode?: string,
    orgId?: string
  ): Promise<boolean> {
    const policy = await this.policyService.getPolicy(
      countryCode,
      regionCode,
      orgId
    );

    if (!policy) {
      return false;
    }

    // Check if operation requires explicit consent
    if (policy.requiresExplicitConsent) {
      const consentReqs =
        (policy.consentRequirements as Record<string, unknown>) || {};
      const requiredOps = (consentReqs.requiredOperations as string[]) || [];

      return requiredOps.includes(operation) || requiredOps.length === 0;
    }

    return false;
  }

  /**
   * Check if cookie consent is required
   */
  async requiresCookieConsent(
    countryCode: string,
    regionCode?: string,
    orgId?: string
  ): Promise<boolean> {
    const policy = await this.policyService.getPolicy(
      countryCode,
      regionCode,
      orgId
    );

    return policy?.requiresCookieConsent ?? false;
  }

  /**
   * Create a data access request (GDPR Article 15)
   */
  async createDataAccessRequest(
    userId: string,
    countryCode: string,
    regionCode?: string
  ): Promise<string> {
    logger.info('Creating data access request', { userId, countryCode, regionCode });

    // Check if this is a GDPR/CCPA jurisdiction
    const policy = await this.policyService.getPolicy(
      countryCode,
      regionCode
    );

    if (!policy) {
      throw new Error('No policy found for jurisdiction');
    }

    // Create portability request (which includes access)
    const requestId = await this.deletionService.createRequest({
      clinicianId: userId,
      requestType: 'PORTABILITY',
      metadata: {
        requestType: 'DATA_ACCESS',
        countryCode,
        regionCode,
      },
    });

    return requestId;
  }

  /**
   * Create a data deletion request (GDPR Article 17 / CCPA)
   */
  async createDataDeletionRequest(
    userId: string,
    countryCode: string,
    regionCode?: string,
    legalBasis?: LegalBasis
  ): Promise<string> {
    logger.info('Creating data deletion request', {
      userId,
      countryCode,
      regionCode,
      legalBasis,
    });

    // Validate legal basis if required
    const policy = await this.policyService.getPolicy(
      countryCode,
      regionCode
    );

    if (policy?.requiresExplicitConsent && !legalBasis) {
      throw new Error('Legal basis required for data deletion request');
    }

    // Create deletion request via DataDeletionService
    const requestId = await this.deletionService.createRequest({
      clinicianId: userId,
      requestType: 'DELETION',
      metadata: {
        countryCode,
        regionCode,
        legalBasis,
      },
    });

    return requestId;
  }

  /**
   * Get status of a data request
   */
  async getRequestStatus(requestId: string): Promise<DataAccessRequest | null> {
    const status = await this.deletionService.getRequestStatus(requestId);

    if (!status) {
      return null;
    }

    return {
      userId: status.id, // Note: this would need to be mapped correctly
      requestType:
        status.requestType === 'DELETION' ? 'DELETION' : 'PORTABILITY',
      requestedAt: status.requestedAt,
      status: status.status as
        | 'PENDING'
        | 'IN_PROGRESS'
        | 'COMPLETED'
        | 'FAILED',
      completedAt: status.completedAt,
      exportUrl: status.exportUrl,
      errorMessage: status.errorMessage,
    };
  }

  /**
   * Get legal basis for data processing
   */
  async getLegalBasis(
    operation: string,
    countryCode: string,
    regionCode?: string,
    orgId?: string
  ): Promise<LegalBasis | null> {
    const policy = await this.policyService.getPolicy(
      countryCode,
      regionCode,
      orgId
    );

    if (!policy) {
      return null;
    }

    const privacyRules =
      (policy.privacyRules as Record<string, unknown>) || {};
    const legalBases =
      (privacyRules.legalBases as Record<string, LegalBasis>) || {};

    return legalBases[operation] || null;
  }

  /**
   * Validate legal basis for an operation
   */
  async validateLegalBasis(
    operation: string,
    legalBasis: LegalBasis,
    countryCode: string,
    regionCode?: string,
    orgId?: string
  ): Promise<boolean> {
    const requiredBasis = await this.getLegalBasis(
      operation,
      countryCode,
      regionCode,
      orgId
    );

    if (!requiredBasis) {
      // No specific requirement
      return true;
    }

    return legalBasis === requiredBasis;
  }

  /**
   * Get data retention period for a jurisdiction
   */
  async getDataRetentionPeriod(
    countryCode: string,
    regionCode?: string,
    orgId?: string
  ): Promise<number> {
    const policy = await this.policyService.getPolicy(
      countryCode,
      regionCode,
      orgId
    );

    return policy?.dataRetentionDays ?? 2555; // Default 7 years
  }

  /**
   * Check if data should be deleted based on retention policy
   */
  async shouldDeleteData(
    dataCreatedAt: Date,
    countryCode: string,
    regionCode?: string,
    orgId?: string
  ): Promise<boolean> {
    const retentionDays = await this.getDataRetentionPeriod(
      countryCode,
      regionCode,
      orgId
    );

    const retentionDate = new Date(dataCreatedAt);
    retentionDate.setDate(retentionDate.getDate() + retentionDays);

    return new Date() > retentionDate;
  }
}

