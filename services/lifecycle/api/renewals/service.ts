import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../../logging/serviceLogger.js';
import {
  CredentialLifecycleSchema,
  RenewalMethod,
  type CredentialLifecycle,
} from '../../models/CredentialLifecycle.js';
import type { CredentialExpiryPolicy } from '../../models/CredentialExpiryPolicy.js';
import { RenewalGuidanceAuditService } from '../../audit/renewalGuidanceAudit.js';
import { emitPulse } from '../../notifications/pulse.js';

export interface RenewalInstructionStep {
  title: string;
  description?: string;
  requires?: string[];
}

export interface RenewalInstructions {
  credentialId: string;
  renewalAuthorityId?: string;
  renewalMethod: RenewalMethod;
  recommendedStartDate?: Date;
  dueDate?: Date;
  steps: RenewalInstructionStep[];
  supportingDocuments?: string[];
  policy?: CredentialExpiryPolicy;
}

const log = getServiceLogger('lifecycle/api/renewals/service');

export class RenewalInstructionService {
  private auditService: RenewalGuidanceAuditService;

  constructor(private prisma: PrismaClient) {
    this.auditService = new RenewalGuidanceAuditService(prisma);
  }

  /**
   * Generate renewal instructions for a credential.
   */
  async getRenewalInstructions(credentialId: string): Promise<RenewalInstructions> {
    const credential = await this.prisma.credential.findUnique({
      where: { id: credentialId },
      include: {
        user: true,
      },
    });

    if (!credential) {
      throw new Error(`Credential not found: ${credentialId}`);
    }

    const lifecycle = this.buildLifecycleMetadata(credential);
    const policy = await this.prisma.credentialExpiryPolicy.findUnique({
      where: { credentialType: credential.type },
    });

    const steps = this.buildSteps(policy, lifecycle);
    const supportingDocuments = this.extractSupportingDocuments(policy);
    const recommendedStartDate = this.deriveRecommendedStartDate(
      lifecycle.expiresAt,
      policy?.renewalRequirements as any
    );

    const instructions: RenewalInstructions = {
      credentialId: lifecycle.credentialId,
      renewalAuthorityId: lifecycle.renewalAuthorityId,
      renewalMethod: lifecycle.renewalMethod || RenewalMethod.ONLINE,
      dueDate: lifecycle.expiresAt,
      recommendedStartDate,
      steps,
      supportingDocuments,
      policy: policy
        ? {
            id: policy.id,
            credentialType: policy.credentialType,
            defaultValidityPeriod: policy.defaultValidityPeriod,
            gracePeriod: policy.gracePeriod,
            renewalRequirements: policy.renewalRequirements as any,
            createdAt: policy.createdAt,
            updatedAt: policy.updatedAt,
          }
        : undefined,
    };

    await this.auditService.logGuidanceIssued({
      credentialId: lifecycle.credentialId,
      renewalAuthorityId: lifecycle.renewalAuthorityId,
      renewalMethod: instructions.renewalMethod,
      policyId: policy?.id,
      metadata: {
        recommendedStartDate: recommendedStartDate?.toISOString(),
        dueDate: lifecycle.expiresAt?.toISOString(),
      },
    });

    emitPulse({
      type: 'RENEWAL_INSTRUCTIONS_AVAILABLE',
      credentialId: lifecycle.credentialId,
      renewalAuthorityId: lifecycle.renewalAuthorityId,
      renewalMethod: instructions.renewalMethod,
      issuedAt: new Date(),
      metadata: {
        dueDate: lifecycle.expiresAt?.toISOString(),
        policyId: policy?.id,
      },
    });

    log.info('Renewal instructions prepared', {
      credentialId,
      renewalMethod: instructions.renewalMethod,
      renewalAuthorityId: instructions.renewalAuthorityId,
    });

    return instructions;
  }

  private buildLifecycleMetadata(credential: any): CredentialLifecycle {
    const renewalMethod =
      credential.renewalMethod ||
      credential?.metadata?.renewalMethod ||
      (credential?.metadata as any)?.renewal_method;

    const normalizedMethod = Object.values(RenewalMethod).includes(
      String(renewalMethod || RenewalMethod.ONLINE).toUpperCase() as RenewalMethod
    )
      ? (String(renewalMethod || RenewalMethod.ONLINE).toUpperCase() as RenewalMethod)
      : RenewalMethod.ONLINE;

    const lifecycleInput = {
      credentialId: credential.id,
      status: credential.status,
      expiresAt: credential.expiresAt ? new Date(credential.expiresAt) : undefined,
      renewalAuthorityId:
        credential.renewalAuthorityId ||
        credential?.metadata?.renewalAuthorityId ||
        credential.issuer ||
        credential.orgId,
      renewalMethod: normalizedMethod,
      metadata: credential.metadata as Record<string, unknown> | undefined,
    };

    return CredentialLifecycleSchema.parse(lifecycleInput);
  }

  private buildSteps(
    policy: any,
    lifecycle: CredentialLifecycle
  ): RenewalInstructionStep[] {
    const steps: RenewalInstructionStep[] = [];
    const requirements = policy?.renewalRequirements as any;

    steps.push({
      title: 'Confirm renewal authority',
      description: lifecycle.renewalAuthorityId
        ? `Submit renewal to ${lifecycle.renewalAuthorityId}`
        : 'Confirm the correct renewal authority before proceeding',
      requires: lifecycle.renewalAuthorityId ? undefined : ['authorityLookup'],
    });

    if (requirements?.requiresDocumentation || requirements?.requiredDocuments?.length) {
      steps.push({
        title: 'Assemble required documentation',
        description: 'Collect required documentation prior to submission',
        requires: requirements.requiredDocuments,
      });
    }

    if (requirements?.requiresTraining) {
      steps.push({
        title: 'Complete mandatory training',
        description: 'Finish required CE/CME or training modules before renewal submission',
      });
    }

    if (requirements?.requiresExamination) {
      steps.push({
        title: 'Schedule renewal examination',
        description: 'Book and complete any required examination for renewal eligibility',
      });
    }

    if (requirements?.requiresPayment) {
      steps.push({
        title: 'Prepare payment',
        description: 'Ensure payment instruments are ready for renewal fees',
      });
    }

    steps.push({
      title: 'Submit renewal',
      description:
        lifecycle.renewalMethod === RenewalMethod.MAIL
          ? 'Send renewal packet with tracking to the authority mailing address'
          : lifecycle.renewalMethod === RenewalMethod.IN_PERSON
          ? 'Schedule an in-person submission slot if required'
          : 'Submit via the designated online portal',
    });

    return steps;
  }

  private extractSupportingDocuments(policy: any): string[] | undefined {
    const requirements = policy?.renewalRequirements as any;
    if (!requirements?.requiredDocuments?.length) {
      return undefined;
    }
    return [...requirements.requiredDocuments];
  }

  private deriveRecommendedStartDate(
    expiresAt?: Date,
    renewalRequirements?: any
  ): Date | undefined {
    if (!expiresAt) {
      return undefined;
    }

    const minDaysBeforeExpiry = renewalRequirements?.minDaysBeforeExpiry ?? 30;
    const startDate = new Date(expiresAt);
    startDate.setDate(startDate.getDate() - minDaysBeforeExpiry);
    return startDate;
  }
}
