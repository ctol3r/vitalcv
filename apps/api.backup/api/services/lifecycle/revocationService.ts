/**
 * B238A-LIFE-008: RevocationService
 *
 * Executes revocation process: validates reason, updates credential status,
 * records revocation, triggers notifications and workflows.
 * Prevents use after effective date.
 */

import { PrismaClient } from '@prisma/client';
import { RevocationStatus, CreateRevocationInput } from './models/Revocation.js';

export interface RevocationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class RevocationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a revocation request
   */
  async createRevocation(input: CreateRevocationInput): Promise<{ id: string; status: RevocationStatus }> {
    // Validate credential exists
    const credential = await this.prisma.credential.findUnique({
      where: { id: input.credentialId },
    });

    if (!credential) {
      throw new Error(`Credential not found: ${input.credentialId}`);
    }

    // Check if credential is already revoked
    if (credential.status === 'revoked') {
      throw new Error(`Credential is already revoked: ${input.credentialId}`);
    }

    // Check if there's already a pending revocation
    const existingRevocation = await this.prisma.revocation.findFirst({
      where: {
        credentialId: input.credentialId,
        status: RevocationStatus.PENDING,
      },
    });

    if (existingRevocation) {
      throw new Error(`Pending revocation already exists: ${existingRevocation.id}`);
    }

    // Validate effective date is in the future or now
    const now = new Date();
    if (input.effectiveAt < now) {
      throw new Error('Effective date must be in the future or present');
    }

    // Create the revocation
    const revocation = await this.prisma.revocation.create({
      data: {
        credentialId: input.credentialId,
        initiatorId: input.initiatorId,
        reason: input.reason,
        status: RevocationStatus.PENDING,
        effectiveAt: input.effectiveAt,
      },
    });

    return {
      id: revocation.id,
      status: revocation.status,
    };
  }

  /**
   * Validate revocation request
   */
  async validateRevocation(revocationId: string): Promise<RevocationValidationResult> {
    const revocation = await this.prisma.revocation.findUnique({
      where: { id: revocationId },
      include: {
        credential: true,
      },
    });

    if (!revocation) {
      return {
        isValid: false,
        errors: ['Revocation not found'],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if reason is provided and meaningful
    if (!revocation.reason || revocation.reason.trim().length < 10) {
      errors.push('Revocation reason must be at least 10 characters');
    }

    // Check if credential is already revoked
    if (revocation.credential.status === 'revoked') {
      errors.push('Credential is already revoked');
    }

    // Check if effective date is valid
    const now = new Date();
    if (revocation.effectiveAt < now) {
      warnings.push('Effective date is in the past');
    }

    // Check if there are pending renewal requests
    const pendingRenewals = await this.prisma.renewalRequest.findFirst({
      where: {
        credentialId: revocation.credentialId,
        status: 'PENDING',
      },
    });

    if (pendingRenewals) {
      warnings.push('There is a pending renewal request for this credential');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Execute revocation (change status from PENDING to REVOKED)
   */
  async executeRevocation(revocationId: string): Promise<{ credentialId: string; effectiveAt: Date }> {
    const revocation = await this.prisma.revocation.findUnique({
      where: { id: revocationId },
      include: {
        credential: true,
      },
    });

    if (!revocation) {
      throw new Error(`Revocation not found: ${revocationId}`);
    }

    if (revocation.status !== RevocationStatus.PENDING) {
      throw new Error(`Revocation is not pending: ${revocation.status}`);
    }

    // Validate before executing
    const validation = await this.validateRevocation(revocationId);
    if (!validation.isValid) {
      throw new Error(`Revocation validation failed: ${validation.errors.join(', ')}`);
    }

    const now = new Date();

    // Only execute if effective date has passed or is now
    if (revocation.effectiveAt > now) {
      throw new Error(`Revocation effective date has not been reached: ${revocation.effectiveAt.toISOString()}`);
    }

    // Update revocation status
    await this.prisma.revocation.update({
      where: { id: revocationId },
      data: {
        status: RevocationStatus.REVOKED,
      },
    });

    // Update credential status
    await this.prisma.credential.update({
      where: { id: revocation.credentialId },
      data: {
        status: 'revoked',
      },
    });

    // Cancel any pending renewal requests
    await this.prisma.renewalRequest.updateMany({
      where: {
        credentialId: revocation.credentialId,
        status: 'PENDING',
      },
      data: {
        status: 'DENIED',
        decisionAt: now,
        reason: 'Credential revoked',
      },
    });

    return {
      credentialId: revocation.credentialId,
      effectiveAt: revocation.effectiveAt,
    };
  }

  /**
   * Check if credential can be used (not revoked and effective date hasn't passed)
   */
  async canUseCredential(credentialId: string): Promise<{ canUse: boolean; reason?: string }> {
    const credential = await this.prisma.credential.findUnique({
      where: { id: credentialId },
    });

    if (!credential) {
      return { canUse: false, reason: 'Credential not found' };
    }

    if (credential.status === 'revoked') {
      return { canUse: false, reason: 'Credential is revoked' };
    }

    if (credential.status === 'expired') {
      return { canUse: false, reason: 'Credential is expired' };
    }

    // Check for pending revocations that have become effective
    const effectiveRevocation = await this.prisma.revocation.findFirst({
      where: {
        credentialId,
        status: RevocationStatus.PENDING,
        effectiveAt: {
          lte: new Date(),
        },
      },
    });

    if (effectiveRevocation) {
      // Auto-execute the revocation
      try {
        await this.executeRevocation(effectiveRevocation.id);
        return { canUse: false, reason: 'Credential has been revoked' };
      } catch (error) {
        console.error('Error auto-executing revocation:', error);
        return { canUse: false, reason: 'Credential revocation is pending' };
      }
    }

    return { canUse: true };
  }

  /**
   * Get revocation by ID
   */
  async getRevocation(revocationId: string) {
    return this.prisma.revocation.findUnique({
      where: { id: revocationId },
      include: {
        credential: true,
      },
    });
  }

  /**
   * Get revocations for a credential
   */
  async getRevocationsForCredential(credentialId: string) {
    return this.prisma.revocation.findMany({
      where: { credentialId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get pending revocations that need to be executed
   */
  async getPendingRevocationsToExecute(): Promise<any[]> {
    const now = new Date();
    return this.prisma.revocation.findMany({
      where: {
        status: RevocationStatus.PENDING,
        effectiveAt: {
          lte: now,
        },
      },
      include: {
        credential: true,
      },
    });
  }

  /**
   * Process all pending revocations that are due
   */
  async processPendingRevocations(): Promise<{ processed: number; errors: number }> {
    const pendingRevocations = await this.getPendingRevocationsToExecute();
    let processed = 0;
    let errors = 0;

    for (const revocation of pendingRevocations) {
      try {
        await this.executeRevocation(revocation.id);
        processed++;
      } catch (error) {
        console.error(`Error processing revocation ${revocation.id}:`, error);
        errors++;
      }
    }

    return { processed, errors };
  }
}

