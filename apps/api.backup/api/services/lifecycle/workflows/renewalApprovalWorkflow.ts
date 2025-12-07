/**
 * B238B-LIFE-015: RenewalApprovalWorkflow integration
 *
 * Defines a workflow using WorkflowEngine for approval of renewal requests:
 * multi-stage approvals, document upload checks, final update of credential.
 */

import { WorkflowEngine, WorkflowStep, WorkflowStatus } from '../../../agents/workflowEngine.js';
import { RenewalPolicyService, RenewalApprovalWorkflowType } from '../policies/renewalPolicyService.js';
import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../../logging/serviceLogger';

const log = getServiceLogger('lifecycle/workflows/renewal');

/**
 * Renewal approval workflow context
 */
export interface RenewalApprovalContext {
  requestId: string;
  credentialId: string;
  credentialType: string;
  orgId: string;
  requestedBy: string;
  workflowType: RenewalApprovalWorkflowType;
  documentation: Record<string, string>;
  approvers?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * RenewalApprovalWorkflowService integrates with WorkflowEngine for renewal approvals
 */
export class RenewalApprovalWorkflowService {
  private workflowEngine: WorkflowEngine;
  private renewalPolicyService: RenewalPolicyService;

  constructor(private prisma: PrismaClient) {
    this.workflowEngine = WorkflowEngine.getInstance();
    this.renewalPolicyService = new RenewalPolicyService(prisma);
    this.registerWorkflows();
  }

  /**
   * Register renewal approval workflows
   */
  private registerWorkflows(): void {
    // Single approver workflow
    this.workflowEngine.registerWorkflow({
      id: 'renewal-approval-single',
      name: 'Renewal Approval - Single Approver',
      description: 'Single-stage approval workflow for credential renewal',
      steps: [
        {
          step: WorkflowStep.PLAN,
          name: 'Plan Review',
          description: 'Plan the renewal review process',
          requiredCapabilities: ['review'],
          requiredScopes: [],
          riskLevel: 'LOW' as any,
          dependsOn: [],
        },
        {
          step: WorkflowStep.IMPLEMENT,
          name: 'Document Check',
          description: 'Verify all required documentation is present',
          requiredCapabilities: ['document-verification'],
          requiredScopes: [],
          riskLevel: 'MEDIUM' as any,
          dependsOn: [WorkflowStep.PLAN],
        },
        {
          step: WorkflowStep.REVIEW,
          name: 'Approver Review',
          description: 'Review renewal request and make decision',
          requiredCapabilities: ['approval'],
          requiredScopes: [],
          riskLevel: 'MEDIUM' as any,
          dependsOn: [WorkflowStep.IMPLEMENT],
        },
      ],
    });

    // Multi-stage workflow
    this.workflowEngine.registerWorkflow({
      id: 'renewal-approval-multi',
      name: 'Renewal Approval - Multi-Stage',
      description: 'Multi-stage approval workflow for credential renewal',
      steps: [
        {
          step: WorkflowStep.PLAN,
          name: 'Plan Review',
          description: 'Plan the multi-stage renewal review process',
          requiredCapabilities: ['review'],
          requiredScopes: [],
          riskLevel: 'LOW' as any,
          dependsOn: [],
        },
        {
          step: WorkflowStep.IMPLEMENT,
          name: 'Initial Review',
          description: 'Initial review of renewal request and documentation',
          requiredCapabilities: ['document-verification'],
          requiredScopes: [],
          riskLevel: 'MEDIUM' as any,
          dependsOn: [WorkflowStep.PLAN],
        },
        {
          step: WorkflowStep.PROPOSE,
          name: 'Secondary Review',
          description: 'Secondary review and recommendation',
          requiredCapabilities: ['review'],
          requiredScopes: [],
          riskLevel: 'MEDIUM' as any,
          dependsOn: [WorkflowStep.IMPLEMENT],
        },
        {
          step: WorkflowStep.REVIEW,
          name: 'Final Approval',
          description: 'Final approval decision',
          requiredCapabilities: ['approval'],
          requiredScopes: [],
          riskLevel: 'HIGH' as any,
          dependsOn: [WorkflowStep.PROPOSE],
        },
      ],
    });

    // Committee workflow
    this.workflowEngine.registerWorkflow({
      id: 'renewal-approval-committee',
      name: 'Renewal Approval - Committee',
      description: 'Committee-based approval workflow for credential renewal',
      steps: [
        {
          step: WorkflowStep.PLAN,
          name: 'Plan Committee Review',
          description: 'Plan the committee review process',
          requiredCapabilities: ['review'],
          requiredScopes: [],
          riskLevel: 'LOW' as any,
          dependsOn: [],
        },
        {
          step: WorkflowStep.IMPLEMENT,
          name: 'Document Verification',
          description: 'Verify all required documentation',
          requiredCapabilities: ['document-verification'],
          requiredScopes: [],
          riskLevel: 'MEDIUM' as any,
          dependsOn: [WorkflowStep.PLAN],
        },
        {
          step: WorkflowStep.PROPOSE,
          name: 'Committee Review',
          description: 'Committee reviews renewal request',
          requiredCapabilities: ['review'],
          requiredScopes: [],
          riskLevel: 'HIGH' as any,
          dependsOn: [WorkflowStep.IMPLEMENT],
        },
        {
          step: WorkflowStep.REVIEW,
          name: 'Committee Vote',
          description: 'Committee votes on renewal approval',
          requiredCapabilities: ['approval'],
          requiredScopes: [],
          riskLevel: 'HIGH' as any,
          dependsOn: [WorkflowStep.PROPOSE],
        },
      ],
    });
  }

  /**
   * Start renewal approval workflow
   */
  async startApprovalWorkflow(context: RenewalApprovalContext): Promise<string> {
    const workflowId = this.getWorkflowId(context.workflowType);

    const execution = await this.workflowEngine.executeWorkflow(workflowId, {
      requestId: context.requestId,
      credentialId: context.credentialId,
      credentialType: context.credentialType,
      orgId: context.orgId,
      requestedBy: context.requestedBy,
      documentation: context.documentation,
      approvers: context.approvers,
      ...context.metadata,
    });

    log.info('Renewal approval workflow started', {
      executionId: execution.id,
      workflowId,
      requestId: context.requestId,
    });

    // Update renewal request with workflow execution ID
    await this.prisma.renewalRequest.update({
      where: { id: context.requestId },
      data: {
        workflowExecutionId: execution.id,
        status: execution.status === WorkflowStatus.COMPLETED ? 'APPROVED' : 'PENDING',
      },
    });

    return execution.id;
  }

  /**
   * Get workflow ID based on workflow type
   */
  private getWorkflowId(workflowType: RenewalApprovalWorkflowType): string {
    switch (workflowType) {
      case RenewalApprovalWorkflowType.SINGLE_APPROVER:
        return 'renewal-approval-single';
      case RenewalApprovalWorkflowType.MULTI_STAGE:
        return 'renewal-approval-multi';
      case RenewalApprovalWorkflowType.COMMITTEE:
        return 'renewal-approval-committee';
      default:
        return 'renewal-approval-single';
    }
  }

  /**
   * Check workflow status
   */
  async getWorkflowStatus(executionId: string) {
    const execution = this.workflowEngine.getExecution(executionId);
    return execution;
  }

  /**
   * Complete workflow and update credential
   */
  async completeWorkflow(executionId: string, approved: boolean): Promise<void> {
    const execution = this.workflowEngine.getExecution(executionId);
    if (!execution) {
      throw new Error(`Workflow execution ${executionId} not found`);
    }

    // Get renewal request
    const renewalRequest = await this.prisma.renewalRequest.findFirst({
      where: { workflowExecutionId: executionId },
    });

    if (!renewalRequest) {
      throw new Error(`Renewal request for workflow ${executionId} not found`);
    }

    // Update renewal request status
    await this.prisma.renewalRequest.update({
      where: { id: renewalRequest.id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        completedAt: new Date(),
      },
    });

    // If approved, update credential expiration date
    if (approved) {
      // This is a placeholder - adjust based on your credential model
      // await this.updateCredentialExpiration(renewalRequest.credentialId);
      log.info('Credential renewal approved', {
        credentialId: renewalRequest.credentialId,
        requestId: renewalRequest.id,
      });
    } else {
      log.info('Credential renewal rejected', {
        credentialId: renewalRequest.credentialId,
        requestId: renewalRequest.id,
      });
    }
  }
}

