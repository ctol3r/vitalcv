/**
 * SimulationPolicyOverrider
 *
 * Allows scenarios to override policies (e.g. safety thresholds,
 * privilege rules) to test edge cases and boundary conditions.
 */

export interface PolicyOverride {
  id: string;
  policyKey: string;
  originalValue: any;
  overrideValue: any;
  scope?: 'global' | 'organization' | 'user' | 'scenario';
  scopeId?: string;
  active: boolean;
  timestamp: number;
}

export interface PolicyDefinition {
  key: string;
  type: 'number' | 'string' | 'boolean' | 'object' | 'array';
  defaultValue: any;
  description?: string;
  constraints?: {
    min?: number;
    max?: number;
    enum?: any[];
    pattern?: string;
  };
}

export class SimulationPolicyOverrider {
  private overrides: Map<string, PolicyOverride> = new Map();
  private policyDefinitions: Map<string, PolicyDefinition> = new Map();
  private originalPolicies: Map<string, any> = new Map();

  /**
   * Register a policy definition
   */
  registerPolicy(policy: PolicyDefinition): void {
    this.policyDefinitions.set(policy.key, policy);
    if (!this.originalPolicies.has(policy.key)) {
      this.originalPolicies.set(policy.key, policy.defaultValue);
    }
  }

  /**
   * Override a policy value
   */
  overridePolicy(
    policyKey: string,
    overrideValue: any,
    scope: 'global' | 'organization' | 'user' | 'scenario' = 'scenario',
    scopeId?: string
  ): string {
    const policy = this.policyDefinitions.get(policyKey);
    if (!policy) {
      throw new Error(`Policy not found: ${policyKey}`);
    }

    // Validate override value
    this.validatePolicyValue(policy, overrideValue);

    // Get original value if not already stored
    if (!this.originalPolicies.has(policyKey)) {
      this.originalPolicies.set(policyKey, policy.defaultValue);
    }

    const overrideId = `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const override: PolicyOverride = {
      id: overrideId,
      policyKey,
      originalValue: this.originalPolicies.get(policyKey),
      overrideValue,
      scope,
      scopeId,
      active: true,
      timestamp: Date.now(),
    };

    this.overrides.set(overrideId, override);
    return overrideId;
  }

  /**
   * Get effective policy value (considering overrides)
   */
  getPolicyValue(
    policyKey: string,
    scope?: { type: 'global' | 'organization' | 'user' | 'scenario'; id?: string }
  ): any {
    const policy = this.policyDefinitions.get(policyKey);
    if (!policy) {
      throw new Error(`Policy not found: ${policyKey}`);
    }

    // Find most specific override
    if (scope) {
      // Check for scope-specific override
      const scopeOverride = this.findOverride(policyKey, scope.type, scope.id);
      if (scopeOverride) {
        return scopeOverride.overrideValue;
      }
    }

    // Check for global override
    const globalOverride = this.findOverride(policyKey, 'global');
    if (globalOverride) {
      return globalOverride.overrideValue;
    }

    // Return original/default value
    return this.originalPolicies.get(policyKey) || policy.defaultValue;
  }

  /**
   * Restore original policy value
   */
  restorePolicy(overrideId: string): boolean {
    const override = this.overrides.get(overrideId);
    if (!override) {
      return false;
    }

    override.active = false;
    return true;
  }

  /**
   * Restore all overrides for a policy
   */
  restoreAllOverrides(policyKey: string): number {
    let count = 0;
    for (const override of this.overrides.values()) {
      if (override.policyKey === policyKey && override.active) {
        override.active = false;
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all overrides
   */
  clearAllOverrides(): void {
    for (const override of this.overrides.values()) {
      override.active = false;
    }
  }

  /**
   * Get all active overrides
   */
  getActiveOverrides(): PolicyOverride[] {
    return Array.from(this.overrides.values()).filter((o) => o.active);
  }

  /**
   * Get override by ID
   */
  getOverride(overrideId: string): PolicyOverride | undefined {
    return this.overrides.get(overrideId);
  }

  /**
   * Batch override multiple policies
   */
  batchOverride(
    overrides: Array<{
      policyKey: string;
      value: any;
      scope?: 'global' | 'organization' | 'user' | 'scenario';
      scopeId?: string;
    }>
  ): string[] {
    return overrides.map((override) =>
      this.overridePolicy(
        override.policyKey,
        override.value,
        override.scope || 'scenario',
        override.scopeId
      )
    );
  }

  /**
   * Initialize common policies
   */
  initializeCommonPolicies(): void {
    // Safety thresholds
    this.registerPolicy({
      key: 'safety.minConfidenceThreshold',
      type: 'number',
      defaultValue: 0.9,
      description: 'Minimum confidence threshold for safety checks',
      constraints: { min: 0, max: 1 },
    });

    this.registerPolicy({
      key: 'safety.maxRiskScore',
      type: 'number',
      defaultValue: 0.7,
      description: 'Maximum allowed risk score',
      constraints: { min: 0, max: 1 },
    });

    // Privilege rules
    this.registerPolicy({
      key: 'privilege.autoApproveThreshold',
      type: 'number',
      defaultValue: 0.95,
      description: 'Confidence threshold for auto-approval',
      constraints: { min: 0, max: 1 },
    });

    this.registerPolicy({
      key: 'privilege.requireManualReview',
      type: 'boolean',
      defaultValue: true,
      description: 'Require manual review for privilege requests',
    });

    // Rate limiting
    this.registerPolicy({
      key: 'rateLimit.requestsPerMinute',
      type: 'number',
      defaultValue: 100,
      description: 'Maximum requests per minute',
      constraints: { min: 1 },
    });

    // Timeouts
    this.registerPolicy({
      key: 'timeout.defaultOperation',
      type: 'number',
      defaultValue: 30000,
      description: 'Default operation timeout in milliseconds',
      constraints: { min: 1000 },
    });
  }

  // Private helper methods

  private findOverride(
    policyKey: string,
    scope: 'global' | 'organization' | 'user' | 'scenario',
    scopeId?: string
  ): PolicyOverride | undefined {
    for (const override of this.overrides.values()) {
      if (
        override.policyKey === policyKey &&
        override.active &&
        override.scope === scope &&
        (scope === 'global' || override.scopeId === scopeId)
      ) {
        return override;
      }
    }
    return undefined;
  }

  private validatePolicyValue(policy: PolicyDefinition, value: any): void {
    // Type validation
    if (policy.type === 'number' && typeof value !== 'number') {
      throw new Error(`Policy ${policy.key} expects number, got ${typeof value}`);
    }
    if (policy.type === 'string' && typeof value !== 'string') {
      throw new Error(`Policy ${policy.key} expects string, got ${typeof value}`);
    }
    if (policy.type === 'boolean' && typeof value !== 'boolean') {
      throw new Error(`Policy ${policy.key} expects boolean, got ${typeof value}`);
    }

    // Constraint validation
    if (policy.constraints) {
      if (policy.constraints.min !== undefined && value < policy.constraints.min) {
        throw new Error(
          `Policy ${policy.key} value ${value} is below minimum ${policy.constraints.min}`
        );
      }
      if (policy.constraints.max !== undefined && value > policy.constraints.max) {
        throw new Error(
          `Policy ${policy.key} value ${value} is above maximum ${policy.constraints.max}`
        );
      }
      if (policy.constraints.enum && !policy.constraints.enum.includes(value)) {
        throw new Error(
          `Policy ${policy.key} value ${value} is not in allowed enum values`
        );
      }
    }
  }
}

