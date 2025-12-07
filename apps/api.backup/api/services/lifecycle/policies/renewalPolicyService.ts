/**
 * B238B-LIFE-012: RenewalPolicyService
 *
 * Enforces organisation-level renewal rules: approval workflows, required documentation,
 * fee structures; integrates with RenewalService.
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getServiceLogger } from '../../logging/serviceLogger';

const log = getServiceLogger('lifecycle/policies/renewal');

/**
 * Renewal approval workflow type
 */
export enum RenewalApprovalWorkflowType {
  NONE = 'NONE',
  SINGLE_APPROVER = 'SINGLE_APPROVER',
  MULTI_STAGE = 'MULTI_STAGE',
  COMMITTEE = 'COMMITTEE',
}

/**
 * Required documentation type
 */
export enum RequiredDocumentationType {
  LICENSE_VERIFICATION = 'LICENSE_VERIFICATION',
  CONTINUING_EDUCATION = 'CONTINUING_EDUCATION',
  MALPRACTICE_INSURANCE = 'MALPRACTICE_INSURANCE',
  BOARD_CERTIFICATION = 'BOARD_CERTIFICATION',
  PEER_REVIEW = 'PEER_REVIEW',
  OTHER = 'OTHER',
}

/**
 * Renewal policy schema
 */
export const RenewalPolicySchema = z.object({
  id: z.string().optional(),
  orgId: z.string().min(1, 'Organization ID is required'),
  credentialType: z.string().min(1, 'Credential type is required'),
  approvalWorkflow: z.nativeEnum(RenewalApprovalWorkflowType).default(RenewalApprovalWorkflowType.SINGLE_APPROVER),
  requiredDocumentation: z.array(z.nativeEnum(RequiredDocumentationType)).default([]),
  feeAmount: z.number().min(0).optional(),
  feeCurrency: z.string().default('USD'),
  autoRenewalEnabled: z.boolean().default(false),
  gracePeriodDays: z.number().min(0).default(30),
  earlyRenewalDays: z.number().min(0).default(90),
  metadata: z.record(z.unknown()).optional(),
});

export type RenewalPolicy = z.infer<typeof RenewalPolicySchema>;
export type CreateRenewalPolicyInput = z.input<typeof RenewalPolicySchema>;

/**
 * Renewal request input
 */
export interface RenewalRequestInput {
  credentialId: string;
  credentialType: string;
  orgId: string;
  requestedBy: string;
  documentation?: Record<string, string>; // Map of document type to document ID/URL
  metadata?: Record<string, unknown>;
}

/**
 * Renewal request result
 */
export interface RenewalRequestResult {
  requestId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQUIRES_DOCUMENTATION';
  workflowSteps?: string[];
  missingDocumentation?: RequiredDocumentationType[];
  feeAmount?: number;
  feeCurrency?: string;
}

/**
 * RenewalPolicyService enforces organization-level renewal rules
 */
export class RenewalPolicyService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create or update a renewal policy
   */
  async upsertPolicy(input: CreateRenewalPolicyInput): Promise<RenewalPolicy> {
    const validated = RenewalPolicySchema.parse(input);

    const policy = await this.prisma.renewalPolicy.upsert({
      where: {
        orgId_credentialType: {
          orgId: validated.orgId,
          credentialType: validated.credentialType,
        },
      },
      create: {
        orgId: validated.orgId,
        credentialType: validated.credentialType,
        approvalWorkflow: validated.approvalWorkflow,
        requiredDocumentation: validated.requiredDocumentation,
        feeAmount: validated.feeAmount || null,
        feeCurrency: validated.feeCurrency,
        autoRenewalEnabled: validated.autoRenewalEnabled,
        gracePeriodDays: validated.gracePeriodDays,
        earlyRenewalDays: validated.earlyRenewalDays,
        metadata: validated.metadata || {},
      },
      update: {
        approvalWorkflow: validated.approvalWorkflow,
        requiredDocumentation: validated.requiredDocumentation,
        feeAmount: validated.feeAmount || null,
        feeCurrency: validated.feeCurrency,
        autoRenewalEnabled: validated.autoRenewalEnabled,
        gracePeriodDays: validated.gracePeriodDays,
        earlyRenewalDays: validated.earlyRenewalDays,
        metadata: validated.metadata || {},
      },
    });

    log.info('Renewal policy upserted', {
      policyId: policy.id,
      orgId: validated.orgId,
      credentialType: validated.credentialType,
    });

    return {
      id: policy.id,
      orgId: policy.orgId,
      credentialType: policy.credentialType,
      approvalWorkflow: policy.approvalWorkflow as RenewalApprovalWorkflowType,
      requiredDocumentation: policy.requiredDocumentation as RequiredDocumentationType[],
      feeAmount: policy.feeAmount || undefined,
      feeCurrency: policy.feeCurrency,
      autoRenewalEnabled: policy.autoRenewalEnabled,
      gracePeriodDays: policy.gracePeriodDays,
      earlyRenewalDays: policy.earlyRenewalDays,
      metadata: policy.metadata as Record<string, unknown> | undefined,
    };
  }

  /**
   * Get renewal policy for organization and credential type
   */
  async getPolicy(orgId: string, credentialType: string): Promise<RenewalPolicy | null> {
    const policy = await this.prisma.renewalPolicy.findUnique({
      where: {
        orgId_credentialType: {
          orgId,
          credentialType,
        },
      },
    });

    if (!policy) {
      return null;
    }

    return {
      id: policy.id,
      orgId: policy.orgId,
      credentialType: policy.credentialType,
      approvalWorkflow: policy.approvalWorkflow as RenewalApprovalWorkflowType,
      requiredDocumentation: policy.requiredDocumentation as RequiredDocumentationType[],
      feeAmount: policy.feeAmount || undefined,
      feeCurrency: policy.feeCurrency,
      autoRenewalEnabled: policy.autoRenewalEnabled,
      gracePeriodDays: policy.gracePeriodDays,
      earlyRenewalDays: policy.earlyRenewalDays,
      metadata: policy.metadata as Record<string, unknown> | undefined,
    };
  }

  /**
   * Process a renewal request according to policy
   */
  async processRenewalRequest(input: RenewalRequestInput): Promise<RenewalRequestResult> {
    const policy = await this.getPolicy(input.orgId, input.credentialType);

    if (!policy) {
      throw new Error(`No renewal policy found for org ${input.orgId} and credential type ${input.credentialType}`);
    }

    // Check required documentation
    const missingDocumentation = this.checkRequiredDocumentation(
      policy.requiredDocumentation,
      input.documentation || {}
    );

    if (missingDocumentation.length > 0) {
      return {
        requestId: `req-${Date.now()}`,
        status: 'REQUIRES_DOCUMENTATION',
        missingDocumentation,
        feeAmount: policy.feeAmount,
        feeCurrency: policy.feeCurrency,
      };
    }

    // Determine workflow steps based on approval workflow type
    const workflowSteps = this.getWorkflowSteps(policy.approvalWorkflow);

    // Create renewal request
    const requestId = `req-${Date.now()}`;
    await this.prisma.renewalRequest.create({
      data: {
        id: requestId,
        credentialId: input.credentialId,
        credentialType: input.credentialType,
        orgId: input.orgId,
        requestedBy: input.requestedBy,
        status: 'PENDING',
        workflowType: policy.approvalWorkflow,
        documentation: input.documentation || {},
        feeAmount: policy.feeAmount,
        feeCurrency: policy.feeCurrency,
        metadata: input.metadata || {},
      },
    });

    log.info('Renewal request processed', {
      requestId,
      credentialId: input.credentialId,
      status: 'PENDING',
      workflowType: policy.approvalWorkflow,
    });

    return {
      requestId,
      status: 'PENDING',
      workflowSteps,
      feeAmount: policy.feeAmount,
      feeCurrency: policy.feeCurrency,
    };
  }

  /**
   * Check if required documentation is provided
   */
  private checkRequiredDocumentation(
    required: RequiredDocumentationType[],
    provided: Record<string, string>
  ): RequiredDocumentationType[] {
    return required.filter(docType => !provided[docType]);
  }

  /**
   * Get workflow steps based on approval workflow type
   */
  private getWorkflowSteps(workflowType: RenewalApprovalWorkflowType): string[] {
    switch (workflowType) {
      case RenewalApprovalWorkflowType.NONE:
        return ['AUTO_APPROVE'];

      case RenewalApprovalWorkflowType.SINGLE_APPROVER:
        return ['SUBMIT', 'APPROVER_REVIEW', 'APPROVE_OR_REJECT'];

      case RenewalApprovalWorkflowType.MULTI_STAGE:
        return ['SUBMIT', 'INITIAL_REVIEW', 'SECONDARY_REVIEW', 'FINAL_APPROVAL'];

      case RenewalApprovalWorkflowType.COMMITTEE:
        return ['SUBMIT', 'COMMITTEE_REVIEW', 'COMMITTEE_VOTE', 'FINAL_APPROVAL'];

      default:
        return ['SUBMIT', 'REVIEW', 'APPROVE'];
    }
  }

  /**
   * Get all policies for an organization
   */
  async getPoliciesByOrg(orgId: string): Promise<RenewalPolicy[]> {
    const policies = await this.prisma.renewalPolicy.findMany({
      where: { orgId },
    });

    return policies.map(policy => ({
      id: policy.id,
      orgId: policy.orgId,
      credentialType: policy.credentialType,
      approvalWorkflow: policy.approvalWorkflow as RenewalApprovalWorkflowType,
      requiredDocumentation: policy.requiredDocumentation as RequiredDocumentationType[],
      feeAmount: policy.feeAmount || undefined,
      feeCurrency: policy.feeCurrency,
      autoRenewalEnabled: policy.autoRenewalEnabled,
      gracePeriodDays: policy.gracePeriodDays,
      earlyRenewalDays: policy.earlyRenewalDays,
      metadata: policy.metadata as Record<string, unknown> | undefined,
    }));
  }
}

