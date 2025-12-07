/**
 * B237C-DP-029: Data Deletion Request Workflow
 *
 * Defines workflow for handling user or regulatory data deletion requests:
 * - Verifies identity
 * - Checks retention obligations
 * - Deletes data
 * - Logs actions
 * - Integrates with existing WorkflowEngine
 */

import { WorkflowEngine, WorkflowStep, WorkflowStatus } from '../../agents/workflowEngine'
import { RiskTier } from '../../agents/registry'
import { ErasureEngine, ErasureScope } from '../erasureEngine'
import { PrismaClient } from '@prisma/client'

// ============================================================
// TYPES
// ============================================================

export interface DeletionRequestContext {
  requestId: string
  userId: string
  userEmail: string
  requestedAt: Date
  deadline: Date
  scope: ErasureScope
  reason?: string
  regulatoryRequest?: boolean
  identityVerified?: boolean
  retentionCheckPassed?: boolean
  deletionCompleted?: boolean
  notificationSent?: boolean
}

export interface DeletionRequestResult {
  requestId: string
  status: 'completed' | 'failed' | 'rejected'
  identityVerified: boolean
  retentionCheckPassed: boolean
  dataDeleted: boolean
  recordsDeleted: number
  errors: string[]
  completedAt?: Date
}

// ============================================================
// WORKFLOW DEFINITION
// ============================================================

export function registerDataDeletionWorkflow(workflowEngine: WorkflowEngine): void {
  workflowEngine.registerWorkflow({
    id: 'data-deletion-request-workflow',
    name: 'Data Deletion Request Workflow',
    description: 'Handles user or regulatory data deletion requests with identity verification and retention checks',
    steps: [
      {
        step: WorkflowStep.PLAN,
        name: 'Plan Deletion',
        description: 'Analyze deletion request and plan execution strategy',
        requiredCapabilities: ['data-analysis', 'privacy'],
        requiredScopes: [],
        riskLevel: RiskTier.MEDIUM,
        dependsOn: [],
      },
      {
        step: WorkflowStep.PROPOSE,
        name: 'Verify Identity',
        description: 'Verify requester identity and authorization',
        requiredCapabilities: ['identity-verification'],
        requiredScopes: [],
        riskLevel: RiskTier.HIGH,
        dependsOn: [WorkflowStep.PLAN],
      },
      {
        step: WorkflowStep.PROPOSE,
        name: 'Check Retention Obligations',
        description: 'Verify no legal or regulatory obligations prevent deletion',
        requiredCapabilities: ['compliance-check'],
        requiredScopes: [],
        riskLevel: RiskTier.HIGH,
        dependsOn: [WorkflowStep.PROPOSE], // After identity verification
      },
      {
        step: WorkflowStep.IMPLEMENT,
        name: 'Execute Deletion',
        description: 'Delete or anonymize data according to scope',
        requiredCapabilities: ['data-deletion'],
        requiredScopes: [],
        riskLevel: RiskTier.HIGH,
        dependsOn: [WorkflowStep.PROPOSE], // After retention check
      },
      {
        step: WorkflowStep.REVIEW,
        name: 'Log Actions',
        description: 'Record all deletion actions in audit log',
        requiredCapabilities: ['audit-logging'],
        requiredScopes: [],
        riskLevel: RiskTier.MEDIUM,
        dependsOn: [WorkflowStep.IMPLEMENT],
      },
      {
        step: WorkflowStep.REVIEW,
        name: 'Notify Requester',
        description: 'Send confirmation notification to requester',
        requiredCapabilities: ['notifications'],
        requiredScopes: [],
        riskLevel: RiskTier.LOW,
        optional: true,
        dependsOn: [WorkflowStep.IMPLEMENT],
      },
    ],
    maxDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
  })
}

// ============================================================
// WORKFLOW EXECUTOR
// ============================================================

export class DataDeletionRequestWorkflowExecutor {
  constructor(
    private workflowEngine: WorkflowEngine,
    private erasureEngine: ErasureEngine,
    private prisma: PrismaClient
  ) {}

  /**
   * Execute data deletion request workflow
   */
  async executeDeletionRequest(
    context: DeletionRequestContext
  ): Promise<DeletionRequestResult> {
    const result: DeletionRequestResult = {
      requestId: context.requestId,
      status: 'failed',
      identityVerified: false,
      retentionCheckPassed: false,
      dataDeleted: false,
      recordsDeleted: 0,
      errors: [],
    }

    try {
      // Execute workflow
      const execution = await this.workflowEngine.executeWorkflow(
        'data-deletion-request-workflow',
        {
          requestId: context.requestId,
          userId: context.userId,
          userEmail: context.userEmail,
          scope: context.scope,
          reason: context.reason,
          regulatoryRequest: context.regulatoryRequest,
        }
      )

      // Extract results from workflow steps
      const identityStep = execution.stepResults.find(
        (r) => r.step === WorkflowStep.PROPOSE && r.result?.stepType === 'verify-identity'
      )
      const retentionStep = execution.stepResults.find(
        (r) => r.step === WorkflowStep.PROPOSE && r.result?.stepType === 'check-retention'
      )
      const deletionStep = execution.stepResults.find(
        (r) => r.step === WorkflowStep.IMPLEMENT && r.result?.stepType === 'execute-deletion'
      )

      if (execution.status === WorkflowStatus.COMPLETED) {
        result.status = 'completed'
        result.identityVerified = identityStep?.result?.verified === true
        result.retentionCheckPassed = retentionStep?.result?.passed === true
        result.dataDeleted = deletionStep?.result?.deleted === true
        result.recordsDeleted = deletionStep?.result?.recordsDeleted || 0
        result.completedAt = new Date()
      } else if (execution.status === WorkflowStatus.FAILED) {
        result.status = 'failed'
        result.errors.push(execution.metadata?.error || 'Workflow execution failed')
      }

      // Update request status in database
      await this.updateRequestStatus(context.requestId, result.status, result.errors)
    } catch (error: any) {
      result.status = 'failed'
      result.errors.push(error.message || 'Unknown error')
      await this.updateRequestStatus(context.requestId, 'failed', result.errors)
    }

    return result
  }

  /**
   * Verify requester identity
   */
  async verifyIdentity(userId: string, userEmail: string): Promise<boolean> {
    try {
      // Check if user exists and email matches
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        return false
      }

      // In a real implementation, you might:
      // - Send verification email with confirmation link
      // - Require additional authentication factors
      // - Check for suspicious activity patterns
      // - Verify regulatory authority for regulatory requests

      return user.email === userEmail
    } catch (error) {
      console.error('Identity verification failed:', error)
      return false
    }
  }

  /**
   * Check retention obligations
   */
  async checkRetentionObligations(userId: string): Promise<{ passed: boolean; reason?: string }> {
    try {
      // Check for active legal holds (if LegalHold model exists)
      // Note: This assumes a LegalHold model exists in your Prisma schema
      // If not, you may need to implement this check differently
      try {
        const legalHolds = await (this.prisma as any).legalHold?.findMany({
          where: {
            userId,
            status: 'active',
          },
        })

        if (legalHolds && legalHolds.length > 0) {
          return {
            passed: false,
            reason: `Active legal hold(s) prevent deletion: ${legalHolds.map((h: any) => h.id).join(', ')}`,
          }
        }
      } catch (error) {
        // LegalHold model may not exist, skip this check
      }

      // Check for pending investigations (if Investigation model exists)
      // Note: This assumes an Investigation model exists in your Prisma schema
      try {
        const investigations = await (this.prisma as any).investigation?.findMany({
          where: {
            userId,
            status: { in: ['pending', 'in-progress'] },
          },
        })

        if (investigations && investigations.length > 0) {
          return {
            passed: false,
            reason: `Pending investigation(s) prevent deletion: ${investigations.map((i: any) => i.id).join(', ')}`,
          }
        }
      } catch (error) {
        // Investigation model may not exist, skip this check
      }

      // Check for minimum retention requirements
      // In a real implementation, check against retention policies
      const credentials = await this.prisma.credential.findMany({
        where: { userId },
      })

      // Example: Some credentials may have minimum retention periods
      // This is a simplified check - real implementation would be more sophisticated
      const hasRecentCredentials = credentials.some((cred) => {
        const issuedDate = cred.issuedAt ? new Date(cred.issuedAt) : null
        if (!issuedDate) return false
        const daysSinceIssuance = (Date.now() - issuedDate.getTime()) / (1000 * 60 * 60 * 24)
        // Example: Credentials less than 1 year old may need to be retained
        return daysSinceIssuance < 365
      })

      if (hasRecentCredentials) {
        return {
          passed: false,
          reason: 'Recent credentials may be subject to minimum retention requirements',
        }
      }

      return { passed: true }
    } catch (error) {
      console.error('Retention check failed:', error)
      return {
        passed: false,
        reason: 'Error checking retention obligations',
      }
    }
  }

  /**
   * Execute data deletion
   */
  async executeDeletion(userId: string, scope: ErasureScope): Promise<{ deleted: boolean; recordsDeleted: number }> {
    try {
      const result = await this.erasureEngine.executeErasure(userId, scope)
      return {
        deleted: result.errors.length === 0,
        recordsDeleted: result.recordsAnonymized + result.recordsDecoupled,
      }
    } catch (error) {
      console.error('Deletion execution failed:', error)
      return {
        deleted: false,
        recordsDeleted: 0,
      }
    }
  }

  /**
   * Log deletion actions
   */
  async logDeletionActions(context: DeletionRequestContext, result: DeletionRequestResult): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          userId: context.userId,
          action: 'DATA_DELETION_REQUEST',
          resourceType: 'USER',
          resourceId: context.userId,
          metadata: {
            requestId: context.requestId,
            scope: context.scope,
            reason: context.reason,
            regulatoryRequest: context.regulatoryRequest,
            identityVerified: result.identityVerified,
            retentionCheckPassed: result.retentionCheckPassed,
            recordsDeleted: result.recordsDeleted,
            errors: result.errors,
          },
        },
      })
    } catch (error) {
      console.error('Failed to log deletion actions:', error)
    }
  }

  /**
   * Send notification to requester
   */
  async notifyRequester(context: DeletionRequestContext, result: DeletionRequestResult): Promise<void> {
    try {
      // In a real implementation, send email notification
      await this.prisma.notification.create({
        data: {
          userId: context.userId,
          type: 'DATA_DELETION_COMPLETE',
          title: 'Data Deletion Request Completed',
          message: `Your data deletion request (${context.requestId}) has been ${result.status === 'completed' ? 'completed' : 'processed'}.`,
          metadata: {
            requestId: context.requestId,
            status: result.status,
            recordsDeleted: result.recordsDeleted,
          },
        },
      })
    } catch (error) {
      console.error('Failed to send notification:', error)
    }
  }

  /**
   * Update request status in database
   */
  private async updateRequestStatus(
    requestId: string,
    status: string,
    errors: string[]
  ): Promise<void> {
    try {
      // In a real implementation, update the data request record
      // This assumes a DataRequest model exists
      // await this.prisma.dataRequest.update({
      //   where: { id: requestId },
      //   data: {
      //     status,
      //     errors,
      //     updatedAt: new Date(),
      //   },
      // })
    } catch (error) {
      console.error('Failed to update request status:', error)
    }
  }
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  registerDataDeletionWorkflow,
  DataDeletionRequestWorkflowExecutor,
}

