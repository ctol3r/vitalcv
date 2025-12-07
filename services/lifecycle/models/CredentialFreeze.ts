/**
 * B238B-LIFE-019: CredentialFreeze model & service
 *
 * Allows temporary suspension (freeze) of credentials: fields include id,
 * credentialId, startDate, endDate, reason; service to apply/unfreeze; logs actions.
 */

import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger';

const log = getServiceLogger('lifecycle/freeze');

/**
 * Schema for credential freeze
 */
export const CredentialFreezeSchema = z.object({
  id: z.string().optional(),
  credentialId: z.string().min(1, 'Credential ID is required'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  reason: z.string().min(1, 'Reason is required'),
  initiatedBy: z.string().min(1, 'Initiator is required'),
  orgId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CredentialFreeze = z.infer<typeof CredentialFreezeSchema>;
export type CreateCredentialFreezeInput = z.input<typeof CredentialFreezeSchema>;

/**
 * CredentialFreezeService handles freezing and unfreezing credentials
 */
export class CredentialFreezeService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Apply a freeze to a credential
   */
  async applyFreeze(input: CreateCredentialFreezeInput): Promise<CredentialFreeze> {
    const validated = CredentialFreezeSchema.parse({
      ...input,
      id: input.id || undefined,
    });

    // Check if credential exists (assuming Credential model exists)
    // This is a placeholder - adjust based on your actual credential model
    const credential = await this.prisma.credential.findUnique({
      where: { id: validated.credentialId },
    });

    if (!credential) {
      throw new Error(`Credential ${validated.credentialId} not found`);
    }

    // Check for existing active freeze
    const existingFreeze = await this.prisma.credentialFreeze.findFirst({
      where: {
        credentialId: validated.credentialId,
        startDate: { lte: new Date() },
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
    });

    if (existingFreeze) {
      throw new Error(`Credential ${validated.credentialId} is already frozen`);
    }

    // Create freeze record
    const freeze = await this.prisma.credentialFreeze.create({
      data: {
        credentialId: validated.credentialId,
        startDate: validated.startDate,
        endDate: validated.endDate || null,
        reason: validated.reason,
        initiatedBy: validated.initiatedBy,
        orgId: validated.orgId || null,
        metadata: validated.metadata || {},
      },
    });

    log.info('Credential freeze applied', {
      freezeId: freeze.id,
      credentialId: validated.credentialId,
      initiatedBy: validated.initiatedBy,
    });

    return {
      id: freeze.id,
      credentialId: freeze.credentialId,
      startDate: freeze.startDate,
      endDate: freeze.endDate || undefined,
      reason: freeze.reason,
      initiatedBy: freeze.initiatedBy,
      orgId: freeze.orgId || undefined,
      metadata: freeze.metadata as Record<string, unknown> | undefined,
    };
  }

  /**
   * Unfreeze a credential
   */
  async unfreeze(credentialId: string, unfrozenBy: string): Promise<void> {
    const activeFreeze = await this.prisma.credentialFreeze.findFirst({
      where: {
        credentialId,
        startDate: { lte: new Date() },
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
    });

    if (!activeFreeze) {
      throw new Error(`No active freeze found for credential ${credentialId}`);
    }

    await this.prisma.credentialFreeze.update({
      where: { id: activeFreeze.id },
      data: {
        endDate: new Date(),
        metadata: {
          ...(activeFreeze.metadata as Record<string, unknown> || {}),
          unfrozenBy,
          unfrozenAt: new Date().toISOString(),
        },
      },
    });

    log.info('Credential unfrozen', {
      freezeId: activeFreeze.id,
      credentialId,
      unfrozenBy,
    });
  }

  /**
   * Get active freeze for a credential
   */
  async getActiveFreeze(credentialId: string): Promise<CredentialFreeze | null> {
    const freeze = await this.prisma.credentialFreeze.findFirst({
      where: {
        credentialId,
        startDate: { lte: new Date() },
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
      orderBy: { startDate: 'desc' },
    });

    if (!freeze) {
      return null;
    }

    return {
      id: freeze.id,
      credentialId: freeze.credentialId,
      startDate: freeze.startDate,
      endDate: freeze.endDate || undefined,
      reason: freeze.reason,
      initiatedBy: freeze.initiatedBy,
      orgId: freeze.orgId || undefined,
      metadata: freeze.metadata as Record<string, unknown> | undefined,
    };
  }

  /**
   * Get all freezes for a credential
   */
  async getFreezeHistory(credentialId: string): Promise<CredentialFreeze[]> {
    const freezes = await this.prisma.credentialFreeze.findMany({
      where: { credentialId },
      orderBy: { startDate: 'desc' },
    });

    return freezes.map(freeze => ({
      id: freeze.id,
      credentialId: freeze.credentialId,
      startDate: freeze.startDate,
      endDate: freeze.endDate || undefined,
      reason: freeze.reason,
      initiatedBy: freeze.initiatedBy,
      orgId: freeze.orgId || undefined,
      metadata: freeze.metadata as Record<string, unknown> | undefined,
    }));
  }

  /**
   * Check if a credential is currently frozen
   */
  async isFrozen(credentialId: string): Promise<boolean> {
    const activeFreeze = await this.getActiveFreeze(credentialId);
    return activeFreeze !== null;
  }
}

