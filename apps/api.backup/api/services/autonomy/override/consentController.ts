/**
 * Consent & Override Controller
 *
 * Allows clinicians/orgs to pre-set consent rules for autonomous actions.
 * Ensures human override via digital signatures.
 * Records all overrides for audit.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import {
  AutonomousActionType,
  PolicyScope,
  PolicyRule,
} from '../framework/policyFramework.js';

const logger = createLogger({ service: 'consent-override-controller' });
const prisma = new PrismaClient();

/**
 * Consent rule for autonomous actions
 */
export interface ConsentRule {
  id: string;
  scope: PolicyScope;
  scopeId: string; // Organization ID or Clinician ID
  actionTypes: AutonomousActionType[];
  enabled: boolean;
  requiresExplicitConsent: boolean; // If true, requires explicit consent per action
  autoApprove: boolean; // If true, automatically approves actions matching this rule
  conditions?: Record<string, unknown>; // Additional conditions
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

/**
 * Override request
 */
export interface OverrideRequest {
  id: string;
  credentialId: string;
  actionType: AutonomousActionType;
  requestedBy: string; // User ID
  requestedAt: Date;
  reason: string;
  digitalSignature?: string; // Digital signature of the override
  signatureAlgorithm?: string; // e.g., 'ECDSA', 'RSA'
  signaturePublicKey?: string; // Public key for verification
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Consent record for a specific action
 */
export interface ConsentRecord {
  id: string;
  credentialId: string;
  actionType: AutonomousActionType;
  consentedBy: string; // User ID
  consentedAt: Date;
  consentRuleId?: string; // If consent came from a rule
  digitalSignature?: string;
  signatureAlgorithm?: string;
  signaturePublicKey?: string;
  expiresAt?: Date; // Optional expiration
  revokedAt?: Date;
  revokedBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Consent & Override Controller
 */
export class ConsentOverrideController {
  private consentRules: Map<string, ConsentRule> = new Map();
  private overrideRequests: Map<string, OverrideRequest> = new Map();
  private consentRecords: Map<string, ConsentRecord[]> = new Map();

  /**
   * Initialize the controller
   */
  async initialize(): Promise<void> {
    await this.loadConsentRules();
    logger.info('Consent & Override Controller initialized');
  }

  /**
   * Load consent rules from database
   */
  private async loadConsentRules(): Promise<void> {
    // In production, load from database
    // For now, initialize empty
    logger.info('Consent rules loaded', { count: this.consentRules.size });
  }

  /**
   * Create a consent rule
   */
  async createConsentRule(params: {
    scope: PolicyScope;
    scopeId: string;
    actionTypes: AutonomousActionType[];
    enabled?: boolean;
    requiresExplicitConsent?: boolean;
    autoApprove?: boolean;
    conditions?: Record<string, unknown>;
    createdBy: string;
    metadata?: Record<string, unknown>;
  }): Promise<ConsentRule> {
    const rule: ConsentRule = {
      id: `consent-rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      scope: params.scope,
      scopeId: params.scopeId,
      actionTypes: params.actionTypes,
      enabled: params.enabled ?? true,
      requiresExplicitConsent: params.requiresExplicitConsent ?? false,
      autoApprove: params.autoApprove ?? false,
      conditions: params.conditions,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: params.createdBy,
      metadata: params.metadata,
    };

    this.consentRules.set(rule.id, rule);

    logger.info('Consent rule created', {
      ruleId: rule.id,
      scope: rule.scope,
      scopeId: rule.scopeId,
      actionTypes: rule.actionTypes,
    });

    return rule;
  }

  /**
   * Update a consent rule
   */
  async updateConsentRule(
    ruleId: string,
    updates: Partial<Omit<ConsentRule, 'id' | 'createdAt' | 'createdBy'>>
  ): Promise<ConsentRule> {
    const rule = this.consentRules.get(ruleId);
    if (!rule) {
      throw new Error(`Consent rule not found: ${ruleId}`);
    }

    const updatedRule: ConsentRule = {
      ...rule,
      ...updates,
      updatedAt: new Date(),
    };

    this.consentRules.set(ruleId, updatedRule);

    logger.info('Consent rule updated', { ruleId, updates });

    return updatedRule;
  }

  /**
   * Delete a consent rule
   */
  async deleteConsentRule(ruleId: string): Promise<void> {
    if (!this.consentRules.has(ruleId)) {
      throw new Error(`Consent rule not found: ${ruleId}`);
    }

    this.consentRules.delete(ruleId);
    logger.info('Consent rule deleted', { ruleId });
  }

  /**
   * Check if consent is required for an action
   */
  async checkConsentRequired(params: {
    credentialId: string;
    actionType: AutonomousActionType;
    holderId?: string;
    organizationId?: string;
  }): Promise<{ required: boolean; ruleId?: string; reason?: string }> {
    // Check for applicable consent rules
    const applicableRules = this.getApplicableConsentRules(params);

    for (const rule of applicableRules) {
      if (!rule.enabled) {
        continue;
      }

      if (rule.requiresExplicitConsent) {
        // Check if explicit consent exists
        const hasConsent = await this.hasExplicitConsent(
          params.credentialId,
          params.actionType
        );

        if (!hasConsent) {
          return {
            required: true,
            ruleId: rule.id,
            reason: `Explicit consent required by rule "${rule.id}"`,
          };
        }
      }

      // If autoApprove is true, no consent needed
      if (rule.autoApprove) {
        return {
          required: false,
          ruleId: rule.id,
          reason: `Auto-approved by rule "${rule.id}"`,
        };
      }
    }

    // Default: consent not required
    return { required: false };
  }

  /**
   * Record explicit consent for an action
   */
  async recordConsent(params: {
    credentialId: string;
    actionType: AutonomousActionType;
    consentedBy: string;
    consentRuleId?: string;
    digitalSignature?: string;
    signatureAlgorithm?: string;
    signaturePublicKey?: string;
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<ConsentRecord> {
    const record: ConsentRecord = {
      id: `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      credentialId: params.credentialId,
      actionType: params.actionType,
      consentedBy: params.consentedBy,
      consentedAt: new Date(),
      consentRuleId: params.consentRuleId,
      digitalSignature: params.digitalSignature,
      signatureAlgorithm: params.signatureAlgorithm,
      signaturePublicKey: params.signaturePublicKey,
      expiresAt: params.expiresAt,
      metadata: params.metadata,
    };

    if (!this.consentRecords.has(params.credentialId)) {
      this.consentRecords.set(params.credentialId, []);
    }
    this.consentRecords.get(params.credentialId)!.push(record);

    logger.info('Consent recorded', {
      credentialId: params.credentialId,
      actionType: params.actionType,
      consentedBy: params.consentedBy,
      hasSignature: !!params.digitalSignature,
    });

    return record;
  }

  /**
   * Check if explicit consent exists
   */
  private async hasExplicitConsent(
    credentialId: string,
    actionType: AutonomousActionType
  ): Promise<boolean> {
    const records = this.consentRecords.get(credentialId) || [];
    const now = new Date();

    return records.some(
      (record) =>
        record.actionType === actionType &&
        !record.revokedAt &&
        (!record.expiresAt || record.expiresAt > now)
    );
  }

  /**
   * Revoke consent
   */
  async revokeConsent(
    credentialId: string,
    consentId: string,
    revokedBy: string
  ): Promise<void> {
    const records = this.consentRecords.get(credentialId) || [];
    const record = records.find((r) => r.id === consentId);

    if (!record) {
      throw new Error(`Consent record not found: ${consentId}`);
    }

    record.revokedAt = new Date();
    record.revokedBy = revokedBy;

    logger.info('Consent revoked', {
      credentialId,
      consentId,
      revokedBy,
    });
  }

  /**
   * Request an override for an autonomous action
   */
  async requestOverride(params: {
    credentialId: string;
    actionType: AutonomousActionType;
    requestedBy: string;
    reason: string;
    digitalSignature?: string;
    signatureAlgorithm?: string;
    signaturePublicKey?: string;
    metadata?: Record<string, unknown>;
  }): Promise<OverrideRequest> {
    const request: OverrideRequest = {
      id: `override-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      credentialId: params.credentialId,
      actionType: params.actionType,
      requestedBy: params.requestedBy,
      requestedAt: new Date(),
      reason: params.reason,
      digitalSignature: params.digitalSignature,
      signatureAlgorithm: params.signatureAlgorithm,
      signaturePublicKey: params.signaturePublicKey,
      status: 'PENDING',
      metadata: params.metadata,
    };

    this.overrideRequests.set(request.id, request);

    logger.info('Override requested', {
      overrideId: request.id,
      credentialId: params.credentialId,
      actionType: params.actionType,
      requestedBy: params.requestedBy,
      hasSignature: !!params.digitalSignature,
    });

    return request;
  }

  /**
   * Approve an override request
   */
  async approveOverride(
    overrideId: string,
    approvedBy: string,
    digitalSignature?: string,
    signatureAlgorithm?: string,
    signaturePublicKey?: string
  ): Promise<OverrideRequest> {
    const request = this.overrideRequests.get(overrideId);
    if (!request) {
      throw new Error(`Override request not found: ${overrideId}`);
    }

    if (request.status !== 'PENDING') {
      throw new Error(`Override request is not pending: ${request.status}`);
    }

    request.status = 'APPROVED';
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();
    request.digitalSignature = digitalSignature || request.digitalSignature;
    request.signatureAlgorithm = signatureAlgorithm || request.signatureAlgorithm;
    request.signaturePublicKey = signaturePublicKey || request.signaturePublicKey;

    logger.info('Override approved', {
      overrideId,
      approvedBy,
      hasSignature: !!digitalSignature,
    });

    return request;
  }

  /**
   * Reject an override request
   */
  async rejectOverride(
    overrideId: string,
    rejectedBy: string,
    reason: string
  ): Promise<OverrideRequest> {
    const request = this.overrideRequests.get(overrideId);
    if (!request) {
      throw new Error(`Override request not found: ${overrideId}`);
    }

    if (request.status !== 'PENDING') {
      throw new Error(`Override request is not pending: ${request.status}`);
    }

    request.status = 'REJECTED';
    request.rejectionReason = reason;

    logger.info('Override rejected', {
      overrideId,
      rejectedBy,
      reason,
    });

    return request;
  }

  /**
   * Verify digital signature
   */
  async verifySignature(
    signature: string,
    publicKey: string,
    data: string,
    algorithm?: string
  ): Promise<boolean> {
    // In production, implement actual signature verification
    // For now, return true if signature exists
    if (!signature || !publicKey) {
      return false;
    }

    logger.info('Signature verification', {
      algorithm: algorithm || 'unknown',
      hasSignature: !!signature,
      hasPublicKey: !!publicKey,
    });

    // TODO: Implement actual signature verification
    return true;
  }

  /**
   * Get applicable consent rules
   */
  private getApplicableConsentRules(params: {
    credentialId: string;
    actionType: AutonomousActionType;
    holderId?: string;
    organizationId?: string;
  }): ConsentRule[] {
    const applicable: ConsentRule[] = [];

    for (const rule of this.consentRules.values()) {
      if (!rule.actionTypes.includes(params.actionType)) {
        continue;
      }

      // Check scope match
      if (rule.scope === PolicyScope.CLINICIAN && rule.scopeId === params.holderId) {
        applicable.push(rule);
      } else if (
        rule.scope === PolicyScope.ORGANIZATION &&
        rule.scopeId === params.organizationId
      ) {
        applicable.push(rule);
      } else if (rule.scope === PolicyScope.GLOBAL) {
        applicable.push(rule);
      }
    }

    return applicable;
  }

  /**
   * Get all consent rules
   */
  getAllConsentRules(): ConsentRule[] {
    return Array.from(this.consentRules.values());
  }

  /**
   * Get consent rules by scope
   */
  getConsentRulesByScope(
    scope: PolicyScope,
    scopeId?: string
  ): ConsentRule[] {
    return Array.from(this.consentRules.values()).filter(
      (r) => r.scope === scope && (scopeId === undefined || r.scopeId === scopeId)
    );
  }

  /**
   * Get override requests
   */
  getOverrideRequests(
    status?: OverrideRequest['status']
  ): OverrideRequest[] {
    const requests = Array.from(this.overrideRequests.values());
    return status ? requests.filter((r) => r.status === status) : requests;
  }

  /**
   * Get consent records for a credential
   */
  getConsentRecords(credentialId: string): ConsentRecord[] {
    return this.consentRecords.get(credentialId) || [];
  }
}

// Export singleton instance
export const consentOverrideController = new ConsentOverrideController();

