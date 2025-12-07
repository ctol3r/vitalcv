/**
 * B238A-LIFE-004: RenewalService
 *
 * Handles renewal requests: validates data, applies policy, triggers workflows.
 * Updates credential records upon approval and sends notifications.
 */

import { PrismaClient } from '@prisma/client';
import { RenewalRequestStatus, CreateRenewalRequestInput, UpdateRenewalRequestInput } from './models/RenewalRequest.js';
import { CredentialExpiryPolicy } from './models/CredentialExpiryPolicy.js';
import { AutoRenewalRules } from './models/AutoRenewalRules.js';

export interface RenewalValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  policy?: CredentialExpiryPolicy;
  autoRenewalRules?: AutoRenewalRules;
}

export class RenewalService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a renewal request
   */
  async createRenewalRequest(
    input: CreateRenewalRequestInput
  ): Promise<{ id: string; status: RenewalRequestStatus }> {
    // Validate credential exists and is active
    const credential = await this.prisma.credential.findUnique({
      where: { id: input.credentialId },
    });

    if (!credential) {
      throw new Error(`Credential not found: ${input.credentialId}`);
    }

    if (credential.status !== 'active') {
      throw new Error(`Credential is not active: ${credential.status}`);
    }

    // Check if there's already a pending renewal request
    const existingRequest = await this.prisma.renewalRequest.findFirst({
      where: {
        credentialId: input.credentialId,
        status: RenewalRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new Error(`Pending renewal request already exists: ${existingRequest.id}`);
    }

    // Create the renewal request
    const renewalRequest = await this.prisma.renewalRequest.create({
      data: {
        credentialId: input.credentialId,
        requesterId: input.requesterId,
        status: RenewalRequestStatus.PENDING,
        reason: input.reason,
        renewalData: input.renewalData as any,
      },
    });

    return {
      id: renewalRequest.id,
      status: renewalRequest.status,
    };
  }

  /**
   * Validate renewal request against policy
   */
  async validateRenewalRequest(
    renewalRequestId: string
  ): Promise<RenewalValidationResult> {
    const renewalRequest = await this.prisma.renewalRequest.findUnique({
      where: { id: renewalRequestId },
      include: {
        credential: true,
      },
    });

    if (!renewalRequest) {
      return {
        isValid: false,
        errors: ['Renewal request not found'],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Get policy for credential type
    const policy = await this.prisma.credentialExpiryPolicy.findUnique({
      where: { credentialType: renewalRequest.credential.type },
    });

    // Get auto-renewal rules
    const autoRenewalRules = await this.prisma.autoRenewalRules.findFirst({
      where: {
        credentialType: renewalRequest.credential.type,
      },
    });

    // Check if credential is expired beyond grace period
    if (renewalRequest.credential.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(renewalRequest.credential.expiresAt);
      const daysExpired = Math.ceil((now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24));

      if (policy) {
        if (daysExpired > policy.gracePeriod) {
          errors.push(`Credential expired beyond grace period (${policy.gracePeriod} days)`);
        }
      } else if (daysExpired > 0) {
        warnings.push('Credential is expired and no policy found');
      }
    }

    // Validate renewal requirements if policy exists
    if (policy?.renewalRequirements) {
      const requirements = policy.renewalRequirements as any;

      if (requirements.requiresDocumentation) {
        if (!renewalRequest.renewalData || !(renewalRequest.renewalData as any).documents) {
          errors.push('Documentation is required for renewal');
        }
      }

      if (requirements.requiresPayment) {
        if (!renewalRequest.renewalData || !(renewalRequest.renewalData as any).paymentConfirmed) {
          errors.push('Payment confirmation is required for renewal');
        }
      }

      if (requirements.requiredDocuments) {
        const providedDocs = (renewalRequest.renewalData as any)?.documents || [];
        const missingDocs = requirements.requiredDocuments.filter(
          (doc: string) => !providedDocs.includes(doc)
        );
        if (missingDocs.length > 0) {
          errors.push(`Missing required documents: ${missingDocs.join(', ')}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
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
      autoRenewalRules: autoRenewalRules
        ? {
            id: autoRenewalRules.id,
            orgId: autoRenewalRules.orgId,
            credentialType: autoRenewalRules.credentialType,
            autoRenew: autoRenewalRules.autoRenew,
            maxRenewals: autoRenewalRules.maxRenewals,
            notes: autoRenewalRules.notes,
            createdAt: autoRenewalRules.createdAt,
            updatedAt: autoRenewalRules.updatedAt,
          }
        : undefined,
    };
  }

  /**
   * Approve a renewal request
   */
  async approveRenewalRequest(
    renewalRequestId: string,
    approverId: string
  ): Promise<{ credentialId: string; newExpiryDate: Date }> {
    const renewalRequest = await this.prisma.renewalRequest.findUnique({
      where: { id: renewalRequestId },
      include: {
        credential: true,
      },
    });

    if (!renewalRequest) {
      throw new Error(`Renewal request not found: ${renewalRequestId}`);
    }

    if (renewalRequest.status !== RenewalRequestStatus.PENDING) {
      throw new Error(`Renewal request is not pending: ${renewalRequest.status}`);
    }

    // Validate before approving
    const validation = await this.validateRenewalRequest(renewalRequestId);
    if (!validation.isValid) {
      throw new Error(`Renewal request validation failed: ${validation.errors.join(', ')}`);
    }

    // Get policy to determine new expiry date
    const policy = await this.prisma.credentialExpiryPolicy.findUnique({
      where: { credentialType: renewalRequest.credential.type },
    });

    const validityPeriod = policy?.defaultValidityPeriod ?? 365; // Default 1 year
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + validityPeriod);

    // Update renewal request status
    await this.prisma.renewalRequest.update({
      where: { id: renewalRequestId },
      data: {
        status: RenewalRequestStatus.APPROVED,
        decisionAt: new Date(),
      },
    });

    // Update credential expiry date
    await this.prisma.credential.update({
      where: { id: renewalRequest.credentialId },
      data: {
        expiresAt: newExpiryDate,
        status: 'active', // Ensure it's active
      },
    });

    return {
      credentialId: renewalRequest.credentialId,
      newExpiryDate,
    };
  }

  /**
   * Deny a renewal request
   */
  async denyRenewalRequest(
    renewalRequestId: string,
    reason?: string
  ): Promise<void> {
    const renewalRequest = await this.prisma.renewalRequest.findUnique({
      where: { id: renewalRequestId },
    });

    if (!renewalRequest) {
      throw new Error(`Renewal request not found: ${renewalRequestId}`);
    }

    if (renewalRequest.status !== RenewalRequestStatus.PENDING) {
      throw new Error(`Renewal request is not pending: ${renewalRequest.status}`);
    }

    await this.prisma.renewalRequest.update({
      where: { id: renewalRequestId },
      data: {
        status: RenewalRequestStatus.DENIED,
        decisionAt: new Date(),
        reason: reason || renewalRequest.reason,
      },
    });
  }

  /**
   * Get renewal request by ID
   */
  async getRenewalRequest(renewalRequestId: string) {
    return this.prisma.renewalRequest.findUnique({
      where: { id: renewalRequestId },
      include: {
        credential: true,
      },
    });
  }

  /**
   * Get renewal requests for a credential
   */
  async getRenewalRequestsForCredential(credentialId: string) {
    return this.prisma.renewalRequest.findMany({
      where: { credentialId },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /**
   * Get pending renewal requests
   */
  async getPendingRenewalRequests() {
    return this.prisma.renewalRequest.findMany({
      where: { status: RenewalRequestStatus.PENDING },
      include: {
        credential: true,
      },
      orderBy: { submittedAt: 'asc' },
    });
  }
}

