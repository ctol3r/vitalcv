/**
 * AutonomyPolicyFramework
 *
 * Defines allowable autonomous actions (issue, suspend, revoke, transfer credentials)
 * and conditions for each action. Supports nested policy overrides at org/clinician level.
 * Includes migration utilities for policy versioning.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';

const logger = createLogger({ service: 'autonomy-policy-framework' });
const prisma = new PrismaClient();

/**
 * Autonomous action types
 */
export enum AutonomousActionType {
  ISSUE = 'ISSUE',
  SUSPEND = 'SUSPEND',
  REVOKE = 'REVOKE',
  TRANSFER = 'TRANSFER',
  UPDATE = 'UPDATE',
  ARCHIVE = 'ARCHIVE',
}

/**
 * Policy scope - determines where policy applies
 */
export enum PolicyScope {
  GLOBAL = 'GLOBAL', // System-wide default
  ORGANIZATION = 'ORGANIZATION', // Organization-level override
  CLINICIAN = 'CLINICIAN', // Clinician-level override
  CREDENTIAL_TYPE = 'CREDENTIAL_TYPE', // Credential type-specific
}

/**
 * Condition operators for policy evaluation
 */
export enum ConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  CONTAINS = 'CONTAINS',
  EXISTS = 'EXISTS',
  NOT_EXISTS = 'NOT_EXISTS',
}

/**
 * Condition for policy evaluation
 */
export interface PolicyCondition {
  field: string; // e.g., 'credential.status', 'holder.riskScore', 'issuer.accreditation'
  operator: ConditionOperator;
  value: unknown; // Value to compare against
  description?: string;
}

/**
 * Policy rule defining when an autonomous action is allowed
 */
export interface PolicyRule {
  id: string;
  actionType: AutonomousActionType;
  scope: PolicyScope;
  scopeId?: string; // Organization ID, Clinician ID, or Credential Type
  name: string;
  description?: string;
  enabled: boolean;
  conditions: PolicyCondition[];
  requiresConsent: boolean; // Whether explicit consent is required
  requiresOverride: boolean; // Whether human override is required
  priority: number; // Higher priority = evaluated first
  version: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Policy evaluation context
 */
export interface PolicyEvaluationContext {
  actionType: AutonomousActionType;
  credentialId?: string;
  credentialType?: string;
  holderId?: string;
  holderDid?: string;
  issuerId?: string;
  issuerDid?: string;
  organizationId?: string;
  currentStatus?: string;
  riskScore?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  allowed: boolean;
  ruleId?: string;
  reason?: string;
  requiresConsent: boolean;
  requiresOverride: boolean;
  matchedConditions: PolicyCondition[];
  failedConditions: PolicyCondition[];
}

/**
 * Policy framework for autonomous credential actions
 */
export class AutonomyPolicyFramework {
  private policies: Map<string, PolicyRule> = new Map();
  private policyCache: Map<string, PolicyRule[]> = new Map(); // Cache by scope

  /**
   * Load policies from database
   */
  async loadPolicies(): Promise<void> {
    try {
      // In production, load from database
      // For now, initialize with default policies
      await this.initializeDefaultPolicies();
      logger.info('Policies loaded', { count: this.policies.size });
    } catch (error) {
      logger.error('Error loading policies', { error });
      throw error;
    }
  }

  /**
   * Initialize default system policies
   */
  private async initializeDefaultPolicies(): Promise<void> {
    const defaultPolicies: PolicyRule[] = [
      {
        id: 'default-issue',
        actionType: AutonomousActionType.ISSUE,
        scope: PolicyScope.GLOBAL,
        name: 'Default Issue Policy',
        description: 'Allow autonomous issuance if holder is verified and risk score is low',
        enabled: true,
        conditions: [
          {
            field: 'holder.verified',
            operator: ConditionOperator.EQUALS,
            value: true,
            description: 'Holder must be verified',
          },
          {
            field: 'holder.riskScore',
            operator: ConditionOperator.LESS_THAN,
            value: 50,
            description: 'Risk score must be below 50',
          },
        ],
        requiresConsent: false,
        requiresOverride: false,
        priority: 100,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'default-suspend',
        actionType: AutonomousActionType.SUSPEND,
        scope: PolicyScope.GLOBAL,
        name: 'Default Suspend Policy',
        description: 'Allow autonomous suspension if risk score is high or credential expired',
        enabled: true,
        conditions: [
          {
            field: 'holder.riskScore',
            operator: ConditionOperator.GREATER_THAN,
            value: 75,
            description: 'Risk score exceeds threshold',
          },
        ],
        requiresConsent: true,
        requiresOverride: false,
        priority: 100,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'default-revoke',
        actionType: AutonomousActionType.REVOKE,
        scope: PolicyScope.GLOBAL,
        name: 'Default Revoke Policy',
        description: 'Require override for revocation',
        enabled: true,
        conditions: [
          {
            field: 'credential.status',
            operator: ConditionOperator.EQUALS,
            value: 'suspended',
            description: 'Credential must be suspended before revocation',
          },
        ],
        requiresConsent: true,
        requiresOverride: true,
        priority: 100,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'default-transfer',
        actionType: AutonomousActionType.TRANSFER,
        scope: PolicyScope.GLOBAL,
        name: 'Default Transfer Policy',
        description: 'Require consent and override for credential transfer',
        enabled: true,
        conditions: [
          {
            field: 'credential.status',
            operator: ConditionOperator.EQUALS,
            value: 'active',
            description: 'Credential must be active',
          },
        ],
        requiresConsent: true,
        requiresOverride: true,
        priority: 100,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const policy of defaultPolicies) {
      this.policies.set(policy.id, policy);
    }
  }

  /**
   * Evaluate policy for an autonomous action
   */
  async evaluatePolicy(
    context: PolicyEvaluationContext
  ): Promise<PolicyEvaluationResult> {
    // Get applicable policies (ordered by priority)
    const applicablePolicies = this.getApplicablePolicies(context);

    // Evaluate each policy in priority order
    for (const policy of applicablePolicies) {
      if (!policy.enabled) {
        continue;
      }

      const result = this.evaluateRule(policy, context);
      if (result.allowed) {
        return {
          ...result,
          ruleId: policy.id,
        };
      }
    }

    // No policy allowed the action
    return {
      allowed: false,
      reason: 'No applicable policy allows this action',
      requiresConsent: true,
      requiresOverride: true,
      matchedConditions: [],
      failedConditions: [],
    };
  }

  /**
   * Get applicable policies for a context (with nested override support)
   */
  private getApplicablePolicies(
    context: PolicyEvaluationContext
  ): PolicyRule[] {
    const policies: PolicyRule[] = [];

    // Priority order: CLINICIAN > ORGANIZATION > CREDENTIAL_TYPE > GLOBAL
    const scopes = [
      { scope: PolicyScope.CLINICIAN, id: context.holderId },
      { scope: PolicyScope.ORGANIZATION, id: context.organizationId },
      { scope: PolicyScope.CREDENTIAL_TYPE, id: context.credentialType },
      { scope: PolicyScope.GLOBAL, id: undefined },
    ];

    for (const { scope, id } of scopes) {
      const scopePolicies = Array.from(this.policies.values()).filter(
        (p) =>
          p.scope === scope &&
          p.actionType === context.actionType &&
          (id === undefined || p.scopeId === id)
      );
      policies.push(...scopePolicies);
    }

    // Sort by priority (higher first)
    return policies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate a single policy rule
   */
  private evaluateRule(
    rule: PolicyRule,
    context: PolicyEvaluationContext
  ): PolicyEvaluationResult {
    const matchedConditions: PolicyCondition[] = [];
    const failedConditions: PolicyCondition[] = [];

    // Evaluate all conditions
    for (const condition of rule.conditions) {
      const value = this.getFieldValue(context, condition.field);
      const passed = this.evaluateCondition(condition, value);

      if (passed) {
        matchedConditions.push(condition);
      } else {
        failedConditions.push(condition);
      }
    }

    // All conditions must pass
    const allowed = failedConditions.length === 0;

    return {
      allowed,
      reason: allowed
        ? `Policy rule "${rule.name}" allows this action`
        : `Policy rule "${rule.name}" failed: ${failedConditions.map((c) => c.description || c.field).join(', ')}`,
      requiresConsent: rule.requiresConsent,
      requiresOverride: rule.requiresOverride,
      matchedConditions,
      failedConditions,
    };
  }

  /**
   * Get field value from context (supports nested paths)
   */
  private getFieldValue(
    context: PolicyEvaluationContext,
    field: string
  ): unknown {
    const parts = field.split('.');
    let value: unknown = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: PolicyCondition,
    value: unknown
  ): boolean {
    switch (condition.operator) {
      case ConditionOperator.EQUALS:
        return value === condition.value;
      case ConditionOperator.NOT_EQUALS:
        return value !== condition.value;
      case ConditionOperator.GREATER_THAN:
        return (
          typeof value === 'number' &&
          typeof condition.value === 'number' &&
          value > condition.value
        );
      case ConditionOperator.LESS_THAN:
        return (
          typeof value === 'number' &&
          typeof condition.value === 'number' &&
          value < condition.value
        );
      case ConditionOperator.IN:
        return (
          Array.isArray(condition.value) &&
          condition.value.includes(value)
        );
      case ConditionOperator.NOT_IN:
        return (
          Array.isArray(condition.value) &&
          !condition.value.includes(value)
        );
      case ConditionOperator.CONTAINS:
        return (
          typeof value === 'string' &&
          typeof condition.value === 'string' &&
          value.includes(condition.value)
        );
      case ConditionOperator.EXISTS:
        return value !== undefined && value !== null;
      case ConditionOperator.NOT_EXISTS:
        return value === undefined || value === null;
      default:
        return false;
    }
  }

  /**
   * Add or update a policy rule
   */
  async addPolicy(rule: Omit<PolicyRule, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date();
    const policy: PolicyRule = {
      ...rule,
      createdAt: rule.createdAt || now,
      updatedAt: now,
    };

    this.policies.set(policy.id, policy);
    this.policyCache.clear(); // Clear cache

    logger.info('Policy added', { policyId: policy.id, scope: policy.scope });
  }

  /**
   * Remove a policy rule
   */
  async removePolicy(policyId: string): Promise<void> {
    this.policies.delete(policyId);
    this.policyCache.clear();
    logger.info('Policy removed', { policyId });
  }

  /**
   * Get all policies
   */
  getAllPolicies(): PolicyRule[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get policies by scope
   */
  getPoliciesByScope(
    scope: PolicyScope,
    scopeId?: string
  ): PolicyRule[] {
    return Array.from(this.policies.values()).filter(
      (p) => p.scope === scope && (scopeId === undefined || p.scopeId === scopeId)
    );
  }

  /**
   * Migrate policies to a new version
   */
  async migratePolicies(
    fromVersion: number,
    toVersion: number,
    migrationFn: (policies: PolicyRule[]) => PolicyRule[]
  ): Promise<void> {
    const policiesToMigrate = Array.from(this.policies.values()).filter(
      (p) => p.version === fromVersion
    );

    const migratedPolicies = migrationFn(policiesToMigrate);

    // Update policies
    for (const policy of migratedPolicies) {
      policy.version = toVersion;
      policy.updatedAt = new Date();
      this.policies.set(policy.id, policy);
    }

    logger.info('Policies migrated', {
      fromVersion,
      toVersion,
      count: migratedPolicies.length,
    });
  }
}

// Export singleton instance
export const policyFramework = new AutonomyPolicyFramework();

