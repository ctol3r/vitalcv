/**
 * External Policy Evaluator Service
 * B226B-INT-009: Evaluates external policy requirements before issuing or accepting credentials
 *
 * Supports evaluation for:
 * - Payers (insurance companies)
 * - Licensing boards
 * - Partner hospitals
 * - Other external entities with policy requirements
 */

import { getServiceLogger } from '../../logging/serviceLogger';

const log = getServiceLogger('interop/policy/externalPolicyEvaluator');

/**
 * External entity types
 */
export type ExternalEntityType = 'payer' | 'board' | 'hospital' | 'partner' | 'other';

/**
 * Policy requirement types
 */
export type PolicyRequirementType =
  | 'credential_verification'
  | 'background_check'
  | 'malpractice_insurance'
  | 'continuing_education'
  | 'license_status'
  | 'board_certification'
  | 'peer_review'
  | 'quality_metrics'
  | 'compliance_certification'
  | 'custom';

/**
 * Policy requirement
 */
export interface PolicyRequirement {
  id: string;
  type: PolicyRequirementType;
  name: string;
  description: string;
  required: boolean;
  validationRules: ValidationRule[];
  metadata?: Record<string, any>;
}

/**
 * Validation rule
 */
export interface ValidationRule {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'regex';
  value: any;
  errorMessage?: string;
}

/**
 * External entity policy
 */
export interface ExternalEntityPolicy {
  entityId: string;
  entityType: ExternalEntityType;
  entityName: string;
  policyVersion: string;
  effectiveDate: Date;
  expirationDate?: Date;
  requirements: PolicyRequirement[];
  metadata?: Record<string, any>;
}

/**
 * Credential issuance context
 */
export interface CredentialIssuanceContext {
  credentialType: string;
  subjectId: string;
  issuerId: string;
  requestedBy?: string;
  metadata?: Record<string, any>;
}

/**
 * Credential acceptance context
 */
export interface CredentialAcceptanceContext {
  credentialId: string;
  credentialType: string;
  holderId: string;
  issuerId: string;
  verifierId: string;
  metadata?: Record<string, any>;
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  compliant: boolean;
  entityId: string;
  entityType: ExternalEntityType;
  evaluatedRequirements: EvaluatedRequirement[];
  overallCompliance: number; // 0-100
  errors: string[];
  warnings: string[];
  recommendations?: string[];
}

/**
 * Evaluated requirement
 */
export interface EvaluatedRequirement {
  requirementId: string;
  requirementName: string;
  compliant: boolean;
  validationResults: ValidationResult[];
  errorMessage?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  rule: ValidationRule;
  passed: boolean;
  actualValue?: any;
  errorMessage?: string;
}

/**
 * External Policy Evaluator Service
 */
export class ExternalPolicyEvaluator {
  private policies: Map<string, ExternalEntityPolicy> = new Map();
  private evaluationCache: Map<string, { result: PolicyEvaluationResult; expiresAt: Date }> = new Map();

  constructor() {
    log.info('External policy evaluator initialized');
  }

  /**
   * Register an external entity policy
   */
  registerPolicy(policy: ExternalEntityPolicy): void {
    this.policies.set(policy.entityId, policy);
    log.info('Registered external entity policy', {
      entityId: policy.entityId,
      entityType: policy.entityType,
      requirementCount: policy.requirements.length,
    });
  }

  /**
   * Get policy for an entity
   */
  getPolicy(entityId: string): ExternalEntityPolicy | undefined {
    return this.policies.get(entityId);
  }

  /**
   * Evaluate policy requirements before credential issuance
   */
  async evaluateIssuancePolicy(
    entityId: string,
    context: CredentialIssuanceContext
  ): Promise<PolicyEvaluationResult> {
    const policy = this.policies.get(entityId);
    if (!policy) {
      return {
        compliant: false,
        entityId,
        entityType: 'other',
        evaluatedRequirements: [],
        overallCompliance: 0,
        errors: [`No policy found for entity: ${entityId}`],
        warnings: [],
      };
    }

    // Check cache
    const cacheKey = `issuance:${entityId}:${context.subjectId}:${context.credentialType}`;
    const cached = this.evaluationCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      log.info('Returning cached policy evaluation result', { entityId });
      return cached.result;
    }

    try {
      const result = await this.evaluateRequirements(policy, context, 'issuance');

      // Cache result for 5 minutes
      this.evaluationCache.set(cacheKey, {
        result,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      log.info('Evaluated issuance policy', {
        entityId,
        compliant: result.compliant,
        compliance: result.overallCompliance,
      });

      return result;
    } catch (error) {
      log.error('Error evaluating issuance policy', { error, entityId });
      return {
        compliant: false,
        entityId,
        entityType: policy.entityType,
        evaluatedRequirements: [],
        overallCompliance: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
      };
    }
  }

  /**
   * Evaluate policy requirements before credential acceptance
   */
  async evaluateAcceptancePolicy(
    entityId: string,
    context: CredentialAcceptanceContext
  ): Promise<PolicyEvaluationResult> {
    const policy = this.policies.get(entityId);
    if (!policy) {
      return {
        compliant: false,
        entityId,
        entityType: 'other',
        evaluatedRequirements: [],
        overallCompliance: 0,
        errors: [`No policy found for entity: ${entityId}`],
        warnings: [],
      };
    }

    // Check cache
    const cacheKey = `acceptance:${entityId}:${context.credentialId}:${context.verifierId}`;
    const cached = this.evaluationCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      log.info('Returning cached policy evaluation result', { entityId });
      return cached.result;
    }

    try {
      const result = await this.evaluateRequirements(policy, context, 'acceptance');

      // Cache result for 5 minutes
      this.evaluationCache.set(cacheKey, {
        result,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      log.info('Evaluated acceptance policy', {
        entityId,
        compliant: result.compliant,
        compliance: result.overallCompliance,
      });

      return result;
    } catch (error) {
      log.error('Error evaluating acceptance policy', { error, entityId });
      return {
        compliant: false,
        entityId,
        entityType: policy.entityType,
        evaluatedRequirements: [],
        overallCompliance: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
      };
    }
  }

  /**
   * Evaluate all requirements for a policy
   */
  private async evaluateRequirements(
    policy: ExternalEntityPolicy,
    context: CredentialIssuanceContext | CredentialAcceptanceContext,
    evaluationType: 'issuance' | 'acceptance'
  ): Promise<PolicyEvaluationResult> {
    const evaluatedRequirements: EvaluatedRequirement[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let compliantCount = 0;
    let totalRequiredCount = 0;

    for (const requirement of policy.requirements) {
      // Skip non-required requirements if they fail
      if (!requirement.required && evaluationType === 'acceptance') {
        continue;
      }

      if (requirement.required) {
        totalRequiredCount++;
      }

      const validationResults = await this.validateRequirement(requirement, context);
      const allPassed = validationResults.every(r => r.passed);

      if (requirement.required && allPassed) {
        compliantCount++;
      }

      if (requirement.required && !allPassed) {
        const errorMessages = validationResults
          .filter(r => !r.passed)
          .map(r => r.errorMessage || `Validation failed: ${r.rule.field}`)
          .join('; ');
        errors.push(`${requirement.name}: ${errorMessages}`);
      }

      if (!requirement.required && !allPassed) {
        warnings.push(`${requirement.name}: Validation failed but not required`);
      }

      evaluatedRequirements.push({
        requirementId: requirement.id,
        requirementName: requirement.name,
        compliant: allPassed,
        validationResults,
        ...(!allPassed && requirement.required && {
          errorMessage: validationResults
            .filter(r => !r.passed)
            .map(r => r.errorMessage || `Validation failed: ${r.rule.field}`)
            .join('; '),
        }),
      });
    }

    const overallCompliance = totalRequiredCount > 0
      ? Math.round((compliantCount / totalRequiredCount) * 100)
      : 100;

    const compliant = compliantCount === totalRequiredCount && totalRequiredCount > 0;

    return {
      compliant,
      entityId: policy.entityId,
      entityType: policy.entityType,
      evaluatedRequirements,
      overallCompliance,
      errors,
      warnings,
      ...(!compliant && {
        recommendations: this.generateRecommendations(evaluatedRequirements),
      }),
    };
  }

  /**
   * Validate a requirement against context
   */
  private async validateRequirement(
    requirement: PolicyRequirement,
    context: CredentialIssuanceContext | CredentialAcceptanceContext
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const rule of requirement.validationRules) {
      const actualValue = this.extractValue(context, rule.field);
      const passed = this.evaluateRule(rule, actualValue);

      results.push({
        rule,
        passed,
        actualValue,
        ...(!passed && {
          errorMessage: rule.errorMessage || `Validation failed for ${rule.field}`,
        }),
      });
    }

    return results;
  }

  /**
   * Extract value from context based on field path
   */
  private extractValue(
    context: CredentialIssuanceContext | CredentialAcceptanceContext,
    field: string
  ): any {
    // Simple field extraction - in production, use a proper path resolver
    const parts = field.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as any)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Evaluate a validation rule
   */
  private evaluateRule(rule: ValidationRule, actualValue: any): boolean {
    switch (rule.operator) {
      case 'equals':
        return actualValue === rule.value;
      case 'contains':
        return typeof actualValue === 'string' && actualValue.includes(rule.value);
      case 'greater_than':
        return typeof actualValue === 'number' && actualValue > rule.value;
      case 'less_than':
        return typeof actualValue === 'number' && actualValue < rule.value;
      case 'exists':
        return actualValue !== undefined && actualValue !== null;
      case 'regex':
        return typeof actualValue === 'string' && new RegExp(rule.value).test(actualValue);
      default:
        return false;
    }
  }

  /**
   * Generate recommendations based on failed requirements
   */
  private generateRecommendations(
    evaluatedRequirements: EvaluatedRequirement[]
  ): string[] {
    const recommendations: string[] = [];

    for (const req of evaluatedRequirements) {
      if (!req.compliant && req.errorMessage) {
        recommendations.push(`Address requirement: ${req.requirementName} - ${req.errorMessage}`);
      }
    }

    return recommendations;
  }

  /**
   * Clear evaluation cache
   */
  clearCache(): void {
    this.evaluationCache.clear();
    log.info('Cleared policy evaluation cache');
  }

  /**
   * Clear cache for specific entity
   */
  clearCacheForEntity(entityId: string): void {
    const keysToDelete: string[] = [];
    for (const [key, value] of this.evaluationCache.entries()) {
      if (key.includes(entityId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.evaluationCache.delete(key));
    log.info('Cleared policy evaluation cache for entity', { entityId });
  }
}

/**
 * Default instance export
 */
export const externalPolicyEvaluator = new ExternalPolicyEvaluator();

