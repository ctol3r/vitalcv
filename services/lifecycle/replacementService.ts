/**
 * B238B-LIFE-017: CredentialReplacementService
 *
 * Handles replacement of credentials when expired or revoked: issues new credential,
 * links to original for audit, updates references across system.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger';
import { RevocationReason } from './models/RevocationReason.js';

const log = getServiceLogger('lifecycle/replacement');

/**
 * Replacement reason
 */
export enum ReplacementReason {
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  LOST = 'LOST',
  DAMAGED = 'DAMAGED',
  UPDATE_REQUIRED = 'UPDATE_REQUIRED',
  OTHER = 'OTHER',
}

/**
 * Replacement request input
 */
export interface ReplacementRequestInput {
  originalCredentialId: string;
  reason: ReplacementReason;
  reasonDetails?: string;
  requestedBy: string;
  orgId?: string;
  newExpirationDate?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Replacement result
 */
export interface ReplacementResult {
  newCredentialId: string;
  originalCredentialId: string;
  replacementId: string;
  status: 'PENDING' | 'ISSUED' | 'FAILED';
  error?: string;
}

/**
 * CredentialReplacementService handles credential replacement
 */
export class CredentialReplacementService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Replace a credential
   */
  async replaceCredential(input: ReplacementRequestInput): Promise<ReplacementResult> {
    // Verify original credential exists
    const originalCredential = await this.prisma.credential.findUnique({
      where: { id: input.originalCredentialId },
    });

    if (!originalCredential) {
      throw new Error(`Original credential ${input.originalCredentialId} not found`);
    }

    // Check if credential is eligible for replacement
    if (!this.isEligibleForReplacement(originalCredential, input.reason)) {
      throw new Error(
        `Credential ${input.originalCredentialId} is not eligible for replacement with reason ${input.reason}`
      );
    }

    // Create replacement record
    const replacement = await this.prisma.credentialReplacement.create({
      data: {
        originalCredentialId: input.originalCredentialId,
        reason: input.reason,
        reasonDetails: input.reasonDetails || null,
        requestedBy: input.requestedBy,
        orgId: input.orgId || null,
        status: 'PENDING',
        metadata: input.metadata || {},
      },
    });

    try {
      // Issue new credential based on original
      const newCredential = await this.issueReplacementCredential(
        originalCredential,
        input.newExpirationDate
      );

      // Update replacement record with new credential ID
      await this.prisma.credentialReplacement.update({
        where: { id: replacement.id },
        data: {
          newCredentialId: newCredential.id,
          status: 'ISSUED',
        },
      });

      // Link original to new credential
      await this.linkCredentials(originalCredential.id, newCredential.id, replacement.id);

      // Update references across system
      await this.updateReferences(originalCredential.id, newCredential.id);

      log.info('Credential replaced', {
        replacementId: replacement.id,
        originalCredentialId: input.originalCredentialId,
        newCredentialId: newCredential.id,
      });

      return {
        newCredentialId: newCredential.id,
        originalCredentialId: input.originalCredentialId,
        replacementId: replacement.id,
        status: 'ISSUED',
      };
    } catch (error) {
      // Update replacement record with error
      await this.prisma.credentialReplacement.update({
        where: { id: replacement.id },
        data: {
          status: 'FAILED',
          metadata: {
            ...(replacement.metadata as Record<string, unknown> || {}),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      });

      log.error('Credential replacement failed', {
        replacementId: replacement.id,
        originalCredentialId: input.originalCredentialId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        newCredentialId: '',
        originalCredentialId: input.originalCredentialId,
        replacementId: replacement.id,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if credential is eligible for replacement
   */
  private isEligibleForReplacement(credential: any, reason: ReplacementReason): boolean {
    // Check credential status
    if (credential.status === 'ACTIVE' && reason === ReplacementReason.EXPIRED) {
      return false; // Can't replace active credential as expired
    }

    if (credential.status === 'REVOKED' && reason === ReplacementReason.REVOKED) {
      return true; // Can replace revoked credential
    }

    if (credential.status === 'EXPIRED' && reason === ReplacementReason.EXPIRED) {
      return true; // Can replace expired credential
    }

    // Add other eligibility checks as needed
    return true;
  }

  /**
   * Issue replacement credential based on original
   */
  private async issueReplacementCredential(
    originalCredential: any,
    newExpirationDate?: Date
  ): Promise<any> {
    // Calculate new expiration date if not provided
    const expirationDate = newExpirationDate || this.calculateNewExpirationDate(originalCredential);

    // Create new credential based on original
    const newCredential = await this.prisma.credential.create({
      data: {
        credentialType: originalCredential.credentialType,
        ownerId: originalCredential.ownerId,
        orgId: originalCredential.orgId,
        issuedAt: new Date(),
        expirationDate,
        status: 'ACTIVE',
        metadata: {
          ...(originalCredential.metadata as Record<string, unknown> || {}),
          isReplacement: true,
          originalCredentialId: originalCredential.id,
        },
      },
    });

    return newCredential;
  }

  /**
   * Calculate new expiration date for replacement
   */
  private calculateNewExpirationDate(originalCredential: any): Date {
    // Default to 1 year from now, or use original expiration logic
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    return oneYearFromNow;
  }

  /**
   * Link original and new credentials for audit trail
   */
  private async linkCredentials(
    originalCredentialId: string,
    newCredentialId: string,
    replacementId: string
  ): Promise<void> {
    // Create link record (adjust based on your schema)
    await this.prisma.credentialLink.create({
      data: {
        sourceCredentialId: originalCredentialId,
        targetCredentialId: newCredentialId,
        linkType: 'REPLACEMENT',
        replacementId,
        metadata: {
          linkedAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Update references across system
   */
  private async updateReferences(originalCredentialId: string, newCredentialId: string): Promise<void> {
    // Update any references to the original credential
    // This is a placeholder - adjust based on your system's reference structure

    // Example: Update privilege assignments
    await this.prisma.privilegeAssignment.updateMany({
      where: { credentialId: originalCredentialId },
      data: { credentialId: newCredentialId },
    });

    // Example: Update enrollment records
    await this.prisma.payerEnrollment.updateMany({
      where: { credentialId: originalCredentialId },
      data: { credentialId: newCredentialId },
    });

    log.info('References updated', {
      originalCredentialId,
      newCredentialId,
    });
  }

  /**
   * Get replacement history for a credential
   */
  async getReplacementHistory(credentialId: string): Promise<any[]> {
    const replacements = await this.prisma.credentialReplacement.findMany({
      where: {
        OR: [
          { originalCredentialId: credentialId },
          { newCredentialId: credentialId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return replacements;
  }
}

