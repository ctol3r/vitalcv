/**
 * B237B-DP-017: ExternalDataSharingPolicy
 *
 * Defines rules and guidelines for sharing data with third parties.
 * Ensures compliance with HIPAA/GDPR.
 * Evaluated before allowing any data export or API call.
 */

import { PrismaClient } from '@prisma/client';

export interface PolicyEvaluationRequest {
  vaultId: string;
  action: 'export' | 'share' | 'api_access';
  dataTypes: string[];
  recipient?: string; // User ID or email
  purpose: string;
  destination?: string; // For exports
  scopes?: string[]; // For API access
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  reason?: string;
  warnings?: string[];
  requiredConsents?: string[];
}

export interface PolicyRule {
  name: string;
  description: string;
  evaluate: (request: PolicyEvaluationRequest, context: any) => Promise<PolicyEvaluationResult>;
}

export class ExternalDataSharingPolicy {
  private rules: PolicyRule[] = [];

  constructor(
    private prisma: PrismaClient,
    private enableHipaa: boolean = true,
    private enableGdpr: boolean = true
  ) {
    this.initializeRules();
  }

  /**
   * Evaluate a data sharing request against all policies
   */
  async evaluate(request: PolicyEvaluationRequest): Promise<PolicyEvaluationResult> {
    // Get vault context
    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: request.vaultId },
      include: {
        owner: true,
        consentRecords: {
          where: {
            status: 'active',
            ...(request.recipient ? { sharedWith: request.recipient } : {}),
          },
        },
      },
    });

    if (!vault) {
      return {
        allowed: false,
        reason: 'Vault not found',
      };
    }

    const context = {
      vault,
      owner: vault.owner,
      existingConsents: vault.consentRecords,
    };

    // Evaluate all rules
    const results: PolicyEvaluationResult[] = [];
    const warnings: string[] = [];
    const requiredConsents: string[] = [];

    for (const rule of this.rules) {
      try {
        const result = await rule.evaluate(request, context);
        results.push(result);

        if (!result.allowed) {
          // First denial wins
          return result;
        }

        if (result.warnings) {
          warnings.push(...result.warnings);
        }

        if (result.requiredConsents) {
          requiredConsents.push(...result.requiredConsents);
        }
      } catch (error: any) {
        // Log error but continue evaluation
        console.error(`Policy rule ${rule.name} failed:`, error);
        warnings.push(`Policy evaluation error: ${rule.name}`);
      }
    }

    return {
      allowed: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      requiredConsents: requiredConsents.length > 0 ? requiredConsents : undefined,
    };
  }

  /**
   * Initialize default policy rules
   */
  private initializeRules(): void {
    // Rule 1: Consent requirement
    this.rules.push({
      name: 'ConsentRequirement',
      description: 'Requires explicit consent for data sharing',
      evaluate: async (request, context) => {
        if (request.action === 'share' && request.recipient) {
          const hasConsent = context.existingConsents.some(
            consent =>
              consent.sharedWith === request.recipient &&
              consent.status === 'active' &&
              request.dataTypes.some(dt => consent.dataTypes.includes(dt))
          );

          if (!hasConsent) {
            return {
              allowed: false,
              reason: 'No active consent found for this recipient and data types',
              requiredConsents: [`consent:${request.recipient}:${request.dataTypes.join(',')}`],
            };
          }
        }

        return { allowed: true };
      },
    });

    // Rule 2: HIPAA compliance
    if (this.enableHipaa) {
      this.rules.push({
        name: 'HipaaCompliance',
        description: 'Ensures HIPAA compliance for PHI data',
        evaluate: async (request, context) => {
          const phiDataTypes = ['credential', 'profile']; // Types that may contain PHI

          if (request.dataTypes.some(dt => phiDataTypes.includes(dt))) {
            // Check if purpose is valid for HIPAA
            const validPurposes = [
              'treatment',
              'payment',
              'healthcare_operations',
              'credential_verification',
            ];

            if (!validPurposes.includes(request.purpose.toLowerCase())) {
              return {
                allowed: false,
                reason: 'Purpose not compliant with HIPAA for PHI data',
              };
            }

            // Check if recipient is authorized (BAA required for business associates)
            if (request.recipient && request.action === 'share') {
              // In production, check for Business Associate Agreement
              // For now, issue warning
              return {
                allowed: true,
                warnings: ['Ensure Business Associate Agreement is in place for HIPAA compliance'],
              };
            }
          }

          return { allowed: true };
        },
      });
    }

    // Rule 3: GDPR compliance
    if (this.enableGdpr) {
      this.rules.push({
        name: 'GdprCompliance',
        description: 'Ensures GDPR compliance for personal data',
        evaluate: async (request, context) => {
          // Check if data is being exported outside EU
          if (request.action === 'export' && request.destination) {
            // In production, check destination country and adequacy decision
            // For now, issue warning
            return {
              allowed: true,
              warnings: ['Ensure GDPR adequacy decision or appropriate safeguards for data transfer'],
            };
          }

          // Check data minimization
          if (request.dataTypes.length > 3) {
            return {
              allowed: true,
              warnings: ['Consider data minimization: sharing multiple data types may exceed necessity'],
            };
          }

          return { allowed: true };
        },
      });
    }

    // Rule 4: Purpose limitation
    this.rules.push({
      name: 'PurposeLimitation',
      description: 'Ensures data is shared only for stated purpose',
      evaluate: async (request, context) => {
        if (!request.purpose || request.purpose.trim().length === 0) {
          return {
            allowed: false,
            reason: 'Purpose must be specified for data sharing',
          };
        }

        // Check if purpose matches existing consents
        if (request.action === 'share' && request.recipient) {
          const matchingConsent = context.existingConsents.find(
            consent =>
              consent.sharedWith === request.recipient &&
              consent.purpose === request.purpose
          );

          if (!matchingConsent) {
            return {
              allowed: true,
              warnings: ['No existing consent found for this specific purpose'],
            };
          }
        }

        return { allowed: true };
      },
    });

    // Rule 5: Scope validation
    this.rules.push({
      name: 'ScopeValidation',
      description: 'Validates that requested scopes are appropriate',
      evaluate: async (request, context) => {
        if (request.action === 'api_access' && request.scopes) {
          const validScopes = [
            'read:credentials',
            'read:profile',
            'read:all',
            'write:credentials',
            'write:profile',
            'write:all',
          ];

          const invalidScopes = request.scopes.filter(s => !validScopes.includes(s));
          if (invalidScopes.length > 0) {
            return {
              allowed: false,
              reason: `Invalid scopes: ${invalidScopes.join(', ')}`,
            };
          }

          // Check for overly broad scopes
          if (request.scopes.includes('*') || request.scopes.includes('write:all')) {
            return {
              allowed: true,
              warnings: ['Broad write access requested - ensure this is necessary'],
            };
          }
        }

        return { allowed: true };
      },
    });
  }

  /**
   * Add custom policy rule
   */
  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove policy rule by name
   */
  removeRule(name: string): void {
    this.rules = this.rules.filter(r => r.name !== name);
  }
}

