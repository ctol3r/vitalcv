/**
 * CredentialLifecycleAutomation
 *
 * Implements end-to-end credential workflows:
 * issue → update → suspend → revoke → archive
 * with no manual steps. Logs every decision with explanation.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import {
  AutonomousActionType,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  policyFramework,
} from '../framework/policyFramework.js';
import { RenewalInstructionService } from '../../lifecycle/api/renewals/service.js';

const logger = createLogger({ service: 'credential-lifecycle-automation' });
const prisma = new PrismaClient();

/**
 * Credential lifecycle states
 */
export enum CredentialLifecycleState {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
  ARCHIVED = 'ARCHIVED',
  EXPIRED = 'EXPIRED',
}

/**
 * Decision log entry
 */
export interface DecisionLog {
  id: string;
  timestamp: Date;
  action: AutonomousActionType;
  credentialId: string;
  previousState: CredentialLifecycleState;
  newState: CredentialLifecycleState;
  decision: 'ALLOWED' | 'DENIED' | 'REQUIRES_CONSENT' | 'REQUIRES_OVERRIDE';
  reason: string;
  explanation: string;
  policyRuleId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Credential lifecycle event
 */
export interface LifecycleEvent {
  type:
    | 'STATE_CHANGE'
    | 'POLICY_CHECK'
    | 'CONSENT_REQUIRED'
    | 'OVERRIDE_REQUIRED'
    | 'RENEWAL_INSTRUCTIONS';
  credentialId: string;
  action: AutonomousActionType;
  state: CredentialLifecycleState;
  timestamp: Date;
  details: Record<string, unknown>;
}

/**
 * Credential lifecycle automation engine
 */
export class CredentialLifecycleAutomation {
  private decisionLogs: Map<string, DecisionLog[]> = new Map();
  private eventHandlers: Map<string, ((event: LifecycleEvent) => Promise<void>)[]> = new Map();
  private renewalInstructionService = new RenewalInstructionService(prisma);

  /**
   * Initialize the automation engine
   */
  async initialize(): Promise<void> {
    await policyFramework.loadPolicies();
    logger.info('Credential lifecycle automation initialized');
  }

  /**
   * Issue a credential autonomously
   */
  async issueCredential(params: {
    credentialType: string;
    holderId: string;
    holderDid?: string;
    issuerId: string;
    issuerDid?: string;
    organizationId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ credentialId: string; state: CredentialLifecycleState; decisionLog: DecisionLog }> {
    const context: PolicyEvaluationContext = {
      actionType: AutonomousActionType.ISSUE,
      credentialType: params.credentialType,
      holderId: params.holderId,
      holderDid: params.holderDid,
      issuerId: params.issuerId,
      issuerDid: params.issuerDid,
      organizationId: params.organizationId,
      metadata: params.metadata,
    };

    // Evaluate policy
    const policyResult = await policyFramework.evaluatePolicy(context);

    // Create decision log
    const decisionLog: DecisionLog = {
      id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action: AutonomousActionType.ISSUE,
      credentialId: '', // Will be set after creation
      previousState: CredentialLifecycleState.PENDING,
      newState: policyResult.allowed
        ? CredentialLifecycleState.ACTIVE
        : CredentialLifecycleState.PENDING,
      decision: policyResult.allowed
        ? 'ALLOWED'
        : policyResult.requiresConsent
        ? 'REQUIRES_CONSENT'
        : policyResult.requiresOverride
        ? 'REQUIRES_OVERRIDE'
        : 'DENIED',
      reason: policyResult.reason || 'Policy evaluation completed',
      explanation: this.buildExplanation(policyResult, context),
      policyRuleId: policyResult.ruleId,
      metadata: params.metadata,
    };

    if (!policyResult.allowed) {
      logger.warn('Credential issuance denied', {
        holderId: params.holderId,
        reason: policyResult.reason,
        requiresConsent: policyResult.requiresConsent,
        requiresOverride: policyResult.requiresOverride,
      });

      // Emit event
      await this.emitEvent({
        type: policyResult.requiresConsent ? 'CONSENT_REQUIRED' : policyResult.requiresOverride ? 'OVERRIDE_REQUIRED' : 'POLICY_CHECK',
        credentialId: '',
        action: AutonomousActionType.ISSUE,
        state: CredentialLifecycleState.PENDING,
        timestamp: new Date(),
        details: { policyResult, context },
      });

      throw new Error(`Credential issuance denied: ${policyResult.reason}`);
    }

    // Create credential
    const credential = await prisma.credential.create({
      data: {
        name: params.credentialType,
        issuer: params.issuerId,
        issuerDid: params.issuerDid,
        holderDid: params.holderDid,
        type: params.credentialType,
        status: 'active',
        userId: params.holderId,
        version: 1,
        issuedAt: new Date(),
      },
    });

    decisionLog.credentialId = credential.id;
    this.logDecision(credential.id, decisionLog);

    logger.info('Credential issued autonomously', {
      credentialId: credential.id,
      holderId: params.holderId,
      explanation: decisionLog.explanation,
    });

    // Emit event
    await this.emitEvent({
      type: 'STATE_CHANGE',
      credentialId: credential.id,
      action: AutonomousActionType.ISSUE,
      state: CredentialLifecycleState.ACTIVE,
      timestamp: new Date(),
      details: { credential, decisionLog },
    });

    // Pre-compute renewal guidance and surface it through lifecycle events
    try {
      const renewalInstructions =
        await this.renewalInstructionService.getRenewalInstructions(credential.id);
      await this.emitEvent({
        type: 'RENEWAL_INSTRUCTIONS',
        credentialId: credential.id,
        action: AutonomousActionType.ISSUE,
        state: CredentialLifecycleState.ACTIVE,
        timestamp: new Date(),
        details: { renewalInstructions },
      });
    } catch (error) {
      logger.warn('Failed to generate renewal instructions during issuance', {
        credentialId: credential.id,
        error,
      });
    }

    return {
      credentialId: credential.id,
      state: CredentialLifecycleState.ACTIVE,
      decisionLog,
    };
  }

  /**
   * Update a credential autonomously
   */
  async updateCredential(params: {
    credentialId: string;
    updates: Record<string, unknown>;
    issuerId?: string;
  }): Promise<{ success: boolean; decisionLog: DecisionLog }> {
    const credential = await prisma.credential.findUnique({
      where: { id: params.credentialId },
    });

    if (!credential) {
      throw new Error(`Credential not found: ${params.credentialId}`);
    }

    const previousState = this.mapStatusToLifecycleState(credential.status);

    const context: PolicyEvaluationContext = {
      actionType: AutonomousActionType.UPDATE,
      credentialId: params.credentialId,
      credentialType: credential.type,
      holderId: credential.userId,
      holderDid: credential.holderDid || undefined,
      issuerId: params.issuerId || credential.issuer,
      issuerDid: credential.issuerDid || undefined,
      currentStatus: credential.status,
      metadata: params.updates,
    };

    const policyResult = await policyFramework.evaluatePolicy(context);

    const decisionLog: DecisionLog = {
      id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action: AutonomousActionType.UPDATE,
      credentialId: params.credentialId,
      previousState,
      newState: previousState, // State doesn't change on update
      decision: policyResult.allowed ? 'ALLOWED' : 'DENIED',
      reason: policyResult.reason || 'Policy evaluation completed',
      explanation: this.buildExplanation(policyResult, context),
      policyRuleId: policyResult.ruleId,
      metadata: params.updates,
    };

    if (!policyResult.allowed) {
      this.logDecision(params.credentialId, decisionLog);
      throw new Error(`Credential update denied: ${policyResult.reason}`);
    }

    // Update credential
    await prisma.credential.update({
      where: { id: params.credentialId },
      data: {
        ...params.updates,
        version: credential.version + 1,
      },
    });

    this.logDecision(params.credentialId, decisionLog);

    logger.info('Credential updated autonomously', {
      credentialId: params.credentialId,
      explanation: decisionLog.explanation,
    });

    await this.emitEvent({
      type: 'STATE_CHANGE',
      credentialId: params.credentialId,
      action: AutonomousActionType.UPDATE,
      state: previousState,
      timestamp: new Date(),
      details: { updates: params.updates, decisionLog },
    });

    return { success: true, decisionLog };
  }

  /**
   * Suspend a credential autonomously
   */
  async suspendCredential(params: {
    credentialId: string;
    reason?: string;
    issuerId?: string;
  }): Promise<{ success: boolean; decisionLog: DecisionLog }> {
    return this.transitionCredential(
      params.credentialId,
      AutonomousActionType.SUSPEND,
      CredentialLifecycleState.SUSPENDED,
      params.reason,
      params.issuerId
    );
  }

  /**
   * Revoke a credential autonomously
   */
  async revokeCredential(params: {
    credentialId: string;
    reason?: string;
    issuerId?: string;
  }): Promise<{ success: boolean; decisionLog: DecisionLog }> {
    return this.transitionCredential(
      params.credentialId,
      AutonomousActionType.REVOKE,
      CredentialLifecycleState.REVOKED,
      params.reason,
      params.issuerId
    );
  }

  /**
   * Archive a credential autonomously
   */
  async archiveCredential(params: {
    credentialId: string;
    reason?: string;
    issuerId?: string;
  }): Promise<{ success: boolean; decisionLog: DecisionLog }> {
    return this.transitionCredential(
      params.credentialId,
      AutonomousActionType.ARCHIVE,
      CredentialLifecycleState.ARCHIVED,
      params.reason,
      params.issuerId
    );
  }

  /**
   * Transfer a credential to a new holder
   */
  async transferCredential(params: {
    credentialId: string;
    newHolderId: string;
    newHolderDid?: string;
    reason?: string;
    issuerId?: string;
  }): Promise<{ success: boolean; decisionLog: DecisionLog }> {
    const credential = await prisma.credential.findUnique({
      where: { id: params.credentialId },
    });

    if (!credential) {
      throw new Error(`Credential not found: ${params.credentialId}`);
    }

    const previousState = this.mapStatusToLifecycleState(credential.status);

    const context: PolicyEvaluationContext = {
      actionType: AutonomousActionType.TRANSFER,
      credentialId: params.credentialId,
      credentialType: credential.type,
      holderId: credential.userId,
      holderDid: credential.holderDid || undefined,
      issuerId: params.issuerId || credential.issuer,
      issuerDid: credential.issuerDid || undefined,
      currentStatus: credential.status,
      metadata: {
        newHolderId: params.newHolderId,
        newHolderDid: params.newHolderDid,
        reason: params.reason,
      },
    };

    const policyResult = await policyFramework.evaluatePolicy(context);

    const decisionLog: DecisionLog = {
      id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action: AutonomousActionType.TRANSFER,
      credentialId: params.credentialId,
      previousState,
      newState: previousState, // State doesn't change on transfer
      decision: policyResult.allowed ? 'ALLOWED' : 'DENIED',
      reason: policyResult.reason || 'Policy evaluation completed',
      explanation: this.buildExplanation(policyResult, context),
      policyRuleId: policyResult.ruleId,
      metadata: {
        newHolderId: params.newHolderId,
        newHolderDid: params.newHolderDid,
        reason: params.reason,
      },
    };

    if (!policyResult.allowed) {
      this.logDecision(params.credentialId, decisionLog);
      throw new Error(`Credential transfer denied: ${policyResult.reason}`);
    }

    // Transfer credential
    await prisma.credential.update({
      where: { id: params.credentialId },
      data: {
        userId: params.newHolderId,
        holderDid: params.newHolderDid || null,
        version: credential.version + 1,
      },
    });

    this.logDecision(params.credentialId, decisionLog);

    logger.info('Credential transferred autonomously', {
      credentialId: params.credentialId,
      newHolderId: params.newHolderId,
      explanation: decisionLog.explanation,
    });

    await this.emitEvent({
      type: 'STATE_CHANGE',
      credentialId: params.credentialId,
      action: AutonomousActionType.TRANSFER,
      state: previousState,
      timestamp: new Date(),
      details: { newHolderId: params.newHolderId, decisionLog },
    });

    return { success: true, decisionLog };
  }

  /**
   * Transition credential to a new state
   */
  private async transitionCredential(
    credentialId: string,
    action: AutonomousActionType,
    targetState: CredentialLifecycleState,
    reason?: string,
    issuerId?: string
  ): Promise<{ success: boolean; decisionLog: DecisionLog }> {
    const credential = await prisma.credential.findUnique({
      where: { id: credentialId },
    });

    if (!credential) {
      throw new Error(`Credential not found: ${credentialId}`);
    }

    const previousState = this.mapStatusToLifecycleState(credential.status);

    const context: PolicyEvaluationContext = {
      actionType: action,
      credentialId,
      credentialType: credential.type,
      holderId: credential.userId,
      holderDid: credential.holderDid || undefined,
      issuerId: issuerId || credential.issuer,
      issuerDid: credential.issuerDid || undefined,
      currentStatus: credential.status,
      metadata: { reason },
    };

    const policyResult = await policyFramework.evaluatePolicy(context);

    const decisionLog: DecisionLog = {
      id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action,
      credentialId,
      previousState,
      newState: targetState,
      decision: policyResult.allowed ? 'ALLOWED' : 'DENIED',
      reason: policyResult.reason || 'Policy evaluation completed',
      explanation: this.buildExplanation(policyResult, context),
      policyRuleId: policyResult.ruleId,
      metadata: { reason },
    };

    if (!policyResult.allowed) {
      this.logDecision(credentialId, decisionLog);
      throw new Error(`Credential transition denied: ${policyResult.reason}`);
    }

    // Update credential status
    const statusMap: Record<CredentialLifecycleState, string> = {
      [CredentialLifecycleState.PENDING]: 'pending',
      [CredentialLifecycleState.ACTIVE]: 'active',
      [CredentialLifecycleState.SUSPENDED]: 'suspended',
      [CredentialLifecycleState.REVOKED]: 'revoked',
      [CredentialLifecycleState.ARCHIVED]: 'archived',
      [CredentialLifecycleState.EXPIRED]: 'expired',
    };

    await prisma.credential.update({
      where: { id: credentialId },
      data: {
        status: statusMap[targetState],
        version: credential.version + 1,
      },
    });

    this.logDecision(credentialId, decisionLog);

    logger.info('Credential transitioned autonomously', {
      credentialId,
      action,
      previousState,
      targetState,
      explanation: decisionLog.explanation,
    });

    await this.emitEvent({
      type: 'STATE_CHANGE',
      credentialId,
      action,
      state: targetState,
      timestamp: new Date(),
      details: { previousState, decisionLog },
    });

    return { success: true, decisionLog };
  }

  /**
   * Build explanation for decision log
   */
  private buildExplanation(
    policyResult: PolicyEvaluationResult,
    context: PolicyEvaluationContext
  ): string {
    const parts: string[] = [];

    parts.push(`Action: ${context.actionType}`);
    parts.push(`Reason: ${policyResult.reason || 'Policy evaluation completed'}`);

    if (policyResult.matchedConditions.length > 0) {
      parts.push(`Matched conditions: ${policyResult.matchedConditions.length}`);
    }

    if (policyResult.failedConditions.length > 0) {
      parts.push(`Failed conditions: ${policyResult.failedConditions.length}`);
    }

    if (context.credentialType) {
      parts.push(`Credential type: ${context.credentialType}`);
    }

    if (context.riskScore !== undefined) {
      parts.push(`Risk score: ${context.riskScore}`);
    }

    return parts.join('. ');
  }

  /**
   * Log a decision
   */
  private logDecision(credentialId: string, decisionLog: DecisionLog): void {
    if (!this.decisionLogs.has(credentialId)) {
      this.decisionLogs.set(credentialId, []);
    }
    this.decisionLogs.get(credentialId)!.push(decisionLog);

    // In production, persist to database
    logger.info('Decision logged', {
      credentialId,
      decision: decisionLog.decision,
      action: decisionLog.action,
    });
  }

  /**
   * Get decision logs for a credential
   */
  getDecisionLogs(credentialId: string): DecisionLog[] {
    return this.decisionLogs.get(credentialId) || [];
  }

  /**
   * Map database status to lifecycle state
   */
  private mapStatusToLifecycleState(status: string): CredentialLifecycleState {
    const statusMap: Record<string, CredentialLifecycleState> = {
      pending: CredentialLifecycleState.PENDING,
      active: CredentialLifecycleState.ACTIVE,
      suspended: CredentialLifecycleState.SUSPENDED,
      revoked: CredentialLifecycleState.REVOKED,
      archived: CredentialLifecycleState.ARCHIVED,
      expired: CredentialLifecycleState.EXPIRED,
    };

    return statusMap[status.toLowerCase()] || CredentialLifecycleState.PENDING;
  }

  /**
   * Expose renewal guidance for downstream orchestrations
   */
  async getRenewalInstructions(
    credentialId: string
  ): Promise<{ credentialId: string; instructions: Record<string, unknown> }> {
    const instructions = await this.renewalInstructionService.getRenewalInstructions(
      credentialId
    );

    await this.emitEvent({
      type: 'RENEWAL_INSTRUCTIONS',
      credentialId,
      action: AutonomousActionType.UPDATE,
      state: CredentialLifecycleState.ACTIVE,
      timestamp: new Date(),
      details: { renewalInstructions: instructions },
    });

    return { credentialId, instructions };
  }

  /**
   * Emit lifecycle event
   */
  private async emitEvent(event: LifecycleEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        logger.error('Error in event handler', { eventType: event.type, error });
      }
    }
  }

  /**
   * Register event handler
   */
  onEvent(
    eventType: LifecycleEvent['type'],
    handler: (event: LifecycleEvent) => Promise<void>
  ): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }
}

// Export singleton instance
export const lifecycleAutomation = new CredentialLifecycleAutomation();
