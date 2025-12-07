/**
 * AutonomyRuntimeGuard
 *
 * Intercepts autonomous actions and checks:
 * - Policies
 * - Risk scores
 * - State drift
 * - Concurrency limits
 * Aborts and triggers supervisor if violations detected.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import {
  AutonomousActionType,
  PolicyEvaluationContext,
  policyFramework,
} from './framework/policyFramework.js';
import { lifecycleAutomation } from './lifecycle/automation.js';
import { consentOverrideController } from './override/consentController.js';
import { enqueueJob } from '../../queue/producer.js';

const logger = createLogger({ service: 'autonomy-runtime-guard' });
const prisma = new PrismaClient();

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  riskScore: number; // 0-100
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
  recommendation: 'ALLOW' | 'REQUIRE_CONSENT' | 'REQUIRE_OVERRIDE' | 'BLOCK';
}

/**
 * Risk factor contributing to risk score
 */
export interface RiskFactor {
  type: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  weight: number;
}

/**
 * State drift detection result
 */
export interface DriftDetection {
  hasDrift: boolean;
  driftType?: 'STATUS_MISMATCH' | 'METADATA_MISMATCH' | 'STATE_INCONSISTENCY';
  description?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Concurrency check result
 */
export interface ConcurrencyCheck {
  allowed: boolean;
  currentCount: number;
  maxConcurrent: number;
  reason?: string;
}

/**
 * Guard check result
 */
export interface GuardCheckResult {
  allowed: boolean;
  blocked: boolean;
  requiresConsent: boolean;
  requiresOverride: boolean;
  supervisorTriggered: boolean;
  reasons: string[];
  riskAssessment?: RiskAssessment;
  driftDetection?: DriftDetection;
  concurrencyCheck?: ConcurrencyCheck;
}

/**
 * Autonomy Runtime Guard
 */
export class AutonomyRuntimeGuard {
  private activeActions: Map<string, Set<string>> = new Map(); // credentialId -> Set of actionIds
  private concurrencyLimits: Map<AutonomousActionType, number> = new Map();
  private riskThresholds: Map<string, number> = new Map();

  /**
   * Initialize the guard
   */
  async initialize(): Promise<void> {
    await policyFramework.loadPolicies();
    await consentOverrideController.initialize();

    // Set default concurrency limits
    this.concurrencyLimits.set(AutonomousActionType.ISSUE, 10);
    this.concurrencyLimits.set(AutonomousActionType.UPDATE, 20);
    this.concurrencyLimits.set(AutonomousActionType.SUSPEND, 5);
    this.concurrencyLimits.set(AutonomousActionType.REVOKE, 5);
    this.concurrencyLimits.set(AutonomousActionType.TRANSFER, 3);
    this.concurrencyLimits.set(AutonomousActionType.ARCHIVE, 10);

    // Set default risk thresholds
    this.riskThresholds.set('LOW', 30);
    this.riskThresholds.set('MEDIUM', 50);
    this.riskThresholds.set('HIGH', 75);
    this.riskThresholds.set('CRITICAL', 90);

    logger.info('Autonomy Runtime Guard initialized');
  }

  /**
   * Check if an autonomous action is allowed
   */
  async checkAction(params: {
    actionType: AutonomousActionType;
    credentialId?: string;
    credentialType?: string;
    holderId?: string;
    holderDid?: string;
    issuerId?: string;
    issuerDid?: string;
    organizationId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<GuardCheckResult> {
    const reasons: string[] = [];
    let allowed = true;
    let blocked = false;
    let requiresConsent = false;
    let requiresOverride = false;
    let supervisorTriggered = false;

    // 1. Check policies
    const policyContext: PolicyEvaluationContext = {
      actionType: params.actionType,
      credentialId: params.credentialId,
      credentialType: params.credentialType,
      holderId: params.holderId,
      holderDid: params.holderDid,
      issuerId: params.issuerId,
      issuerDid: params.issuerDid,
      organizationId: params.organizationId,
      metadata: params.metadata,
    };

    const policyResult = await policyFramework.evaluatePolicy(policyContext);

    if (!policyResult.allowed) {
      allowed = false;
      reasons.push(`Policy check failed: ${policyResult.reason}`);
    }

    if (policyResult.requiresConsent) {
      requiresConsent = true;
      reasons.push('Policy requires consent');
    }

    if (policyResult.requiresOverride) {
      requiresOverride = true;
      reasons.push('Policy requires override');
    }

    // 2. Check risk assessment
    let riskAssessment: RiskAssessment | undefined;
    if (params.credentialId || params.holderId) {
      riskAssessment = await this.assessRisk(params);
      if (riskAssessment.recommendation === 'BLOCK') {
        allowed = false;
        blocked = true;
        reasons.push(`Risk assessment blocked: ${riskAssessment.severity} risk`);
        supervisorTriggered = true;
      } else if (riskAssessment.recommendation === 'REQUIRE_OVERRIDE') {
        requiresOverride = true;
        reasons.push(`Risk assessment requires override: ${riskAssessment.severity} risk`);
      } else if (riskAssessment.recommendation === 'REQUIRE_CONSENT') {
        requiresConsent = true;
        reasons.push(`Risk assessment requires consent: ${riskAssessment.severity} risk`);
      }
    }

    // 3. Check state drift
    let driftDetection: DriftDetection | undefined;
    if (params.credentialId) {
      driftDetection = await this.detectDrift(params.credentialId);
      if (driftDetection.hasDrift && driftDetection.severity === 'CRITICAL') {
        allowed = false;
        blocked = true;
        reasons.push(`Critical state drift detected: ${driftDetection.description}`);
        supervisorTriggered = true;
      } else if (driftDetection.hasDrift && driftDetection.severity === 'HIGH') {
        requiresOverride = true;
        reasons.push(`High state drift detected: ${driftDetection.description}`);
      }
    }

    // 4. Check concurrency limits
    const concurrencyCheck = await this.checkConcurrency(params.actionType, params.credentialId);
    if (!concurrencyCheck.allowed) {
      allowed = false;
      reasons.push(`Concurrency limit exceeded: ${concurrencyCheck.reason}`);
    }

    // 5. Check consent requirements
    if (params.credentialId) {
      const consentCheck = await consentOverrideController.checkConsentRequired({
        credentialId: params.credentialId,
        actionType: params.actionType,
        holderId: params.holderId,
        organizationId: params.organizationId,
      });

      if (consentCheck.required) {
        requiresConsent = true;
        reasons.push(`Consent required: ${consentCheck.reason}`);
      }
    }

    // Trigger supervisor if needed
    if (supervisorTriggered) {
      await this.triggerSupervisor({
        actionType: params.actionType,
        credentialId: params.credentialId,
        reason: reasons.join('; '),
        riskAssessment,
        driftDetection,
      });
    }

    const result: GuardCheckResult = {
      allowed: allowed && !blocked,
      blocked,
      requiresConsent,
      requiresOverride,
      supervisorTriggered,
      reasons,
      riskAssessment,
      driftDetection,
      concurrencyCheck,
    };

    logger.info('Guard check completed', {
      actionType: params.actionType,
      allowed: result.allowed,
      blocked: result.blocked,
      requiresConsent: result.requiresConsent,
      requiresOverride: result.requiresOverride,
      reasons: result.reasons,
    });

    return result;
  }

  /**
   * Assess risk for an action
   */
  private async assessRisk(params: {
    credentialId?: string;
    holderId?: string;
    credentialType?: string;
  }): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    let riskScore = 0;

    // Check credential status
    if (params.credentialId) {
      const credential = await prisma.credential.findUnique({
        where: { id: params.credentialId },
      });

      if (credential) {
        if (credential.status === 'suspended') {
          factors.push({
            type: 'CREDENTIAL_SUSPENDED',
            description: 'Credential is currently suspended',
            severity: 'HIGH',
            weight: 30,
          });
          riskScore += 30;
        }

        if (credential.status === 'revoked') {
          factors.push({
            type: 'CREDENTIAL_REVOKED',
            description: 'Credential is revoked',
            severity: 'CRITICAL',
            weight: 50,
          });
          riskScore += 50;
        }

        // Check expiration
        if (credential.expiresAt && credential.expiresAt < new Date()) {
          factors.push({
            type: 'CREDENTIAL_EXPIRED',
            description: 'Credential has expired',
            severity: 'HIGH',
            weight: 25,
          });
          riskScore += 25;
        }
      }
    }

    // Check holder risk (if available)
    if (params.holderId) {
      // In production, check holder's risk score from risk service
      // For now, use default low risk
      factors.push({
        type: 'HOLDER_RISK',
        description: 'Holder risk assessment',
        severity: 'LOW',
        weight: 10,
      });
      riskScore += 10;
    }

    // Determine severity
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (riskScore >= this.riskThresholds.get('CRITICAL')!) {
      severity = 'CRITICAL';
    } else if (riskScore >= this.riskThresholds.get('HIGH')!) {
      severity = 'HIGH';
    } else if (riskScore >= this.riskThresholds.get('MEDIUM')!) {
      severity = 'MEDIUM';
    }

    // Determine recommendation
    let recommendation: 'ALLOW' | 'REQUIRE_CONSENT' | 'REQUIRE_OVERRIDE' | 'BLOCK' = 'ALLOW';
    if (severity === 'CRITICAL') {
      recommendation = 'BLOCK';
    } else if (severity === 'HIGH') {
      recommendation = 'REQUIRE_OVERRIDE';
    } else if (severity === 'MEDIUM') {
      recommendation = 'REQUIRE_CONSENT';
    }

    return {
      riskScore: Math.min(100, riskScore),
      severity,
      factors,
      recommendation,
    };
  }

  /**
   * Detect state drift
   */
  private async detectDrift(credentialId: string): Promise<DriftDetection> {
    const credential = await prisma.credential.findUnique({
      where: { id: credentialId },
    });

    if (!credential) {
      return {
        hasDrift: false,
      };
    }

    // Check for status inconsistencies
    // In production, compare with expected state from state reconciler
    const expectedStatus = 'active'; // Default expected status
    if (credential.status !== expectedStatus) {
      return {
        hasDrift: true,
        driftType: 'STATUS_MISMATCH',
        description: `Credential status "${credential.status}" does not match expected "${expectedStatus}"`,
        severity: credential.status === 'revoked' ? 'CRITICAL' : 'HIGH',
      };
    }

    return {
      hasDrift: false,
    };
  }

  /**
   * Check concurrency limits
   */
  private async checkConcurrency(
    actionType: AutonomousActionType,
    credentialId?: string
  ): Promise<ConcurrencyCheck> {
    const maxConcurrent = this.concurrencyLimits.get(actionType) || 10;

    // Count active actions of this type
    let currentCount = 0;
    if (credentialId) {
      // Count actions for this specific credential
      const actions = this.activeActions.get(credentialId);
      currentCount = actions ? actions.size : 0;
    } else {
      // Count all active actions of this type
      for (const actions of this.activeActions.values()) {
        currentCount += actions.size;
      }
    }

    const allowed = currentCount < maxConcurrent;

    return {
      allowed,
      currentCount,
      maxConcurrent,
      reason: allowed
        ? undefined
        : `Concurrency limit exceeded: ${currentCount}/${maxConcurrent}`,
    };
  }

  /**
   * Track an active action
   */
  trackAction(credentialId: string, actionId: string): void {
    if (!this.activeActions.has(credentialId)) {
      this.activeActions.set(credentialId, new Set());
    }
    this.activeActions.get(credentialId)!.add(actionId);
  }

  /**
   * Untrack an active action
   */
  untrackAction(credentialId: string, actionId: string): void {
    const actions = this.activeActions.get(credentialId);
    if (actions) {
      actions.delete(actionId);
      if (actions.size === 0) {
        this.activeActions.delete(credentialId);
      }
    }
  }

  /**
   * Trigger supervisor for investigation
   */
  private async triggerSupervisor(params: {
    actionType: AutonomousActionType;
    credentialId?: string;
    reason: string;
    riskAssessment?: RiskAssessment;
    driftDetection?: DriftDetection;
  }): Promise<void> {
    try {
      await enqueueJob('SUPERVISOR_RUN', {
        action: 'investigate_autonomy_violation',
        actionType: params.actionType,
        credentialId: params.credentialId,
        reason: params.reason,
        riskAssessment: params.riskAssessment,
        driftDetection: params.driftDetection,
        timestamp: new Date().toISOString(),
      });

      logger.warn('Supervisor triggered', {
        actionType: params.actionType,
        credentialId: params.credentialId,
        reason: params.reason,
      });
    } catch (error) {
      logger.error('Error triggering supervisor', { error, params });
    }
  }

  /**
   * Set concurrency limit for an action type
   */
  setConcurrencyLimit(
    actionType: AutonomousActionType,
    limit: number
  ): void {
    this.concurrencyLimits.set(actionType, limit);
    logger.info('Concurrency limit set', { actionType, limit });
  }

  /**
   * Set risk threshold
   */
  setRiskThreshold(
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    threshold: number
  ): void {
    this.riskThresholds.set(severity, threshold);
    logger.info('Risk threshold set', { severity, threshold });
  }
}

// Export singleton instance
export const runtimeGuard = new AutonomyRuntimeGuard();

