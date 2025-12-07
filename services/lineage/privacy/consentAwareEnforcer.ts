/**
 * B228B-LIN-008: ConsentAwareLineageEnforcer
 *
 * Enforces that lineage data is only exposed to parties with consent.
 * Masks or redacts lineage details based on ReputationSharingPolicy and local regulations.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import { ReputationSharingPolicyService } from '../../reputation/models/ReputationSharingPolicy';

const logger = createLogger({ service: 'consent-aware-lineage-enforcer' });

export interface LineageData {
  id: string;
  sourceSystem: string;
  sourceRecordId: string;
  targetRecordId: string;
  operationType: string;
  timestamp: Date;
  operatorId?: string | null;
  transformationId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface MaskedLineageData {
  id: string;
  sourceSystem: string;
  sourceRecordId: string; // May be masked
  targetRecordId: string; // May be masked
  operationType: string;
  timestamp: Date;
  operatorId?: string | null; // May be masked
  transformationId?: string | null;
  metadata?: Record<string, unknown> | null; // May be redacted
  maskingApplied: string[]; // List of fields that were masked/redacted
  reason?: string; // Why masking was applied
}

export interface ConsentCheck {
  hasConsent: boolean;
  policyId?: string;
  expiryDate?: Date;
  allowedMetrics?: string[];
  reason?: string;
}

export interface MaskingRule {
  field: string;
  maskType: 'full' | 'partial' | 'hash' | 'redact';
  maskValue?: string; // Custom mask value (e.g., '***')
  partialLength?: number; // For partial masking (show first N chars)
}

/**
 * ConsentAwareLineageEnforcer
 * Enforces consent-based access to lineage data
 */
export class ConsentAwareLineageEnforcer {
  constructor(
    private prisma: PrismaClient,
    private reputationPolicyService: ReputationSharingPolicyService,
    private maskingRules: MaskingRule[] = []
  ) {
    // Default masking rules
    this.maskingRules = [
      { field: 'sourceRecordId', maskType: 'partial', partialLength: 4 },
      { field: 'targetRecordId', maskType: 'partial', partialLength: 4 },
      { field: 'operatorId', maskType: 'hash' },
      { field: 'metadata', maskType: 'redact' },
    ];
  }

  /**
   * Check if requester has consent to access lineage data
   */
  async checkConsent(
    clinicianId: string,
    requesterId: string,
    requesterType: 'BOARD' | 'PAYER' | 'EMPLOYER' | 'SYSTEM',
    lineageData: LineageData
  ): Promise<ConsentCheck> {
    logger.info('Checking consent for lineage access', {
      clinicianId,
      requesterId,
      requesterType,
      lineageDataId: lineageData.id,
    });

    // System/internal requests may have different rules
    if (requesterType === 'SYSTEM') {
      return {
        hasConsent: true,
        reason: 'System/internal access granted',
      };
    }

    // Check reputation sharing policies
    try {
      const policies = await this.reputationPolicyService.getActivePolicies(
        clinicianId,
        requesterType as any,
        requesterId
      );

      if (policies.length === 0) {
        return {
          hasConsent: false,
          reason: 'No active consent policy found for this requester',
        };
      }

      // Check if lineage data access is allowed
      const policy = policies[0]; // Use first matching policy
      const hasLineageConsent = this.checkLineageConsent(policy, lineageData);

      if (!hasLineageConsent) {
        return {
          hasConsent: false,
          policyId: policy.id,
          reason: 'Lineage data access not included in consent policy',
        };
      }

      return {
        hasConsent: true,
        policyId: policy.id,
        expiryDate: policy.expiryDate || undefined,
        allowedMetrics: policy.allowedMetrics,
        reason: 'Consent granted via reputation sharing policy',
      };
    } catch (error) {
      logger.error('Error checking consent', { error });
      // Fail closed - no consent if error
      return {
        hasConsent: false,
        reason: 'Error checking consent policy',
      };
    }
  }

  /**
   * Enforce consent and mask lineage data if needed
   */
  async enforceConsent(
    clinicianId: string,
    requesterId: string,
    requesterType: 'BOARD' | 'PAYER' | 'EMPLOYER' | 'SYSTEM',
    lineageData: LineageData
  ): Promise<MaskedLineageData> {
    const consentCheck = await this.checkConsent(clinicianId, requesterId, requesterType, lineageData);

    if (!consentCheck.hasConsent) {
      // Apply full masking if no consent
      return this.applyMasking(lineageData, this.maskingRules, 'No consent granted');
    }

    // Apply selective masking based on policy
    const maskingRules = this.getMaskingRulesForPolicy(consentCheck);
    return this.applyMasking(lineageData, maskingRules, consentCheck.reason);
  }

  /**
   * Check if lineage data access is included in consent policy
   */
  private checkLineageConsent(policy: any, lineageData: LineageData): boolean {
    // If allowedMetrics is empty, assume all metrics are allowed
    if (!policy.allowedMetrics || policy.allowedMetrics.length === 0) {
      return true;
    }

    // Check if lineage-related metrics are allowed
    const lineageMetrics = ['lineage', 'data_lineage', 'provenance', 'data_access'];
    return policy.allowedMetrics.some((metric: string) =>
      lineageMetrics.some((lm) => metric.toLowerCase().includes(lm))
    );
  }

  /**
   * Get masking rules based on policy
   */
  private getMaskingRulesForPolicy(consentCheck: ConsentCheck): MaskingRule[] {
    // If full consent, apply minimal masking
    if (consentCheck.allowedMetrics && consentCheck.allowedMetrics.length === 0) {
      return [
        { field: 'metadata', maskType: 'redact' }, // Always redact sensitive metadata
      ];
    }

    // Otherwise apply standard masking rules
    return this.maskingRules;
  }

  /**
   * Apply masking to lineage data
   */
  private applyMasking(
    lineageData: LineageData,
    rules: MaskingRule[],
    reason?: string
  ): MaskedLineageData {
    const masked: MaskedLineageData = {
      ...lineageData,
      maskingApplied: [],
      reason,
    };

    for (const rule of rules) {
      switch (rule.field) {
        case 'sourceRecordId':
          if (rule.maskType === 'partial' && rule.partialLength) {
            masked.sourceRecordId = this.partialMask(
              lineageData.sourceRecordId,
              rule.partialLength
            );
            masked.maskingApplied.push('sourceRecordId');
          } else if (rule.maskType === 'full') {
            masked.sourceRecordId = rule.maskValue || '***';
            masked.maskingApplied.push('sourceRecordId');
          } else if (rule.maskType === 'hash') {
            masked.sourceRecordId = this.hashValue(lineageData.sourceRecordId);
            masked.maskingApplied.push('sourceRecordId');
          }
          break;

        case 'targetRecordId':
          if (rule.maskType === 'partial' && rule.partialLength) {
            masked.targetRecordId = this.partialMask(
              lineageData.targetRecordId,
              rule.partialLength
            );
            masked.maskingApplied.push('targetRecordId');
          } else if (rule.maskType === 'full') {
            masked.targetRecordId = rule.maskValue || '***';
            masked.maskingApplied.push('targetRecordId');
          } else if (rule.maskType === 'hash') {
            masked.targetRecordId = this.hashValue(lineageData.targetRecordId);
            masked.maskingApplied.push('targetRecordId');
          }
          break;

        case 'operatorId':
          if (rule.maskType === 'hash' && lineageData.operatorId) {
            masked.operatorId = this.hashValue(lineageData.operatorId);
            masked.maskingApplied.push('operatorId');
          } else if (rule.maskType === 'full') {
            masked.operatorId = null;
            masked.maskingApplied.push('operatorId');
          }
          break;

        case 'metadata':
          if (rule.maskType === 'redact') {
            // Remove sensitive fields from metadata
            masked.metadata = this.redactMetadata(lineageData.metadata);
            masked.maskingApplied.push('metadata');
          }
          break;
      }
    }

    return masked;
  }

  /**
   * Partially mask a value (show first N characters)
   */
  private partialMask(value: string, length: number): string {
    if (value.length <= length) {
      return '***';
    }
    return value.substring(0, length) + '***';
  }

  /**
   * Hash a value
   */
  private hashValue(value: string): string {
    // Simple hash (in production, use crypto.createHash)
    const hash = value.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    }, 0);
    return `hash_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Redact sensitive fields from metadata
   */
  private redactMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!metadata) {
      return null;
    }

    const sensitiveFields = ['ssn', 'email', 'phone', 'address', 'phi', 'pii'];
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const keyLower = key.toLowerCase();
      if (sensitiveFields.some((field) => keyLower.includes(field))) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Batch enforce consent for multiple lineage records
   */
  async enforceConsentBatch(
    clinicianId: string,
    requesterId: string,
    requesterType: 'BOARD' | 'PAYER' | 'EMPLOYER' | 'SYSTEM',
    lineageDataList: LineageData[]
  ): Promise<MaskedLineageData[]> {
    return Promise.all(
      lineageDataList.map((data) => this.enforceConsent(clinicianId, requesterId, requesterType, data))
    );
  }
}

