/**
 * B237B-DP-016: ConsentManagement Enhancements
 *
 * Adds granular consent records for shared vault data.
 * Tracks what data is shared, with whom, for what purpose and duration.
 * Supports revocation and auditing.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface ConsentOptions {
  vaultId: string;
  sharedWith: string; // User ID or email
  dataTypes: string[]; // e.g., ["credentials", "profile"]
  purpose: string; // e.g., "credential verification", "job application"
  duration?: string; // e.g., "30 days", "indefinite"
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface ConsentQuery {
  vaultId?: string;
  sharedWith?: string;
  status?: 'active' | 'revoked' | 'expired';
  purpose?: string;
}

export class ConsentManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new consent record
   */
  async createConsent(
    ownerId: string,
    options: ConsentOptions
  ): Promise<{ consentId: string }> {
    // Verify vault ownership
    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: options.vaultId },
    });

    if (!vault) {
      throw new Error(`Vault not found: ${options.vaultId}`);
    }

    if (vault.ownerId !== ownerId) {
      throw new Error('Unauthorized: You do not own this vault');
    }

    // Validate data types
    this.validateDataTypes(options.dataTypes);

    // Create consent record
    const consent = await this.prisma.consentRecord.create({
      data: {
        vaultId: options.vaultId,
        sharedWith: options.sharedWith,
        dataTypes: options.dataTypes,
        purpose: options.purpose,
        duration: options.duration,
        expiresAt: options.expiresAt,
        status: 'active',
        metadata: options.metadata,
      },
    });

    // Log consent creation
    await this.prisma.vaultAuditLog.create({
      data: {
        vaultId: options.vaultId,
        actorId: ownerId,
        action: 'consent_granted',
        scope: `consent:${consent.id}`,
        metadata: {
          consentId: consent.id,
          sharedWith: options.sharedWith,
          dataTypes: options.dataTypes,
          purpose: options.purpose,
        },
        hash: this.generateAuditHash(options.vaultId, ownerId, 'consent_granted', consent.id),
      },
    });

    return { consentId: consent.id };
  }

  /**
   * Revoke consent
   */
  async revokeConsent(
    consentId: string,
    ownerId: string
  ): Promise<void> {
    const consent = await this.prisma.consentRecord.findUnique({
      where: { id: consentId },
      include: { vault: true },
    });

    if (!consent) {
      throw new Error('Consent not found');
    }

    if (consent.vault.ownerId !== ownerId) {
      throw new Error('Unauthorized: You do not own this vault');
    }

    if (consent.status !== 'active') {
      throw new Error(`Consent is already ${consent.status}`);
    }

    await this.prisma.consentRecord.update({
      where: { id: consentId },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    });

    // Revoke associated tokens
    await this.prisma.sharedAccessToken.updateMany({
      where: {
        vaultId: consent.vaultId,
        granteeId: consent.sharedWith.includes('@') ? null : consent.sharedWith,
        granteeEmail: consent.sharedWith.includes('@') ? consent.sharedWith : null,
        status: 'active',
      },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    });

    // Log revocation
    await this.prisma.vaultAuditLog.create({
      data: {
        vaultId: consent.vaultId,
        actorId: ownerId,
        action: 'consent_revoked',
        scope: `consent:${consentId}`,
        hash: this.generateAuditHash(consent.vaultId, ownerId, 'consent_revoked', consentId),
      },
    });
  }

  /**
   * Check if consent exists and is valid
   */
  async checkConsent(
    vaultId: string,
    sharedWith: string,
    dataType: string,
    purpose?: string
  ): Promise<{ hasConsent: boolean; consentId?: string; reason?: string }> {
    const consent = await this.prisma.consentRecord.findFirst({
      where: {
        vaultId,
        sharedWith,
        status: 'active',
        dataTypes: { has: dataType },
        ...(purpose ? { purpose } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!consent) {
      return { hasConsent: false, reason: 'No consent record found' };
    }

    // Check expiration
    if (consent.expiresAt && consent.expiresAt < new Date()) {
      // Auto-expire
      await this.prisma.consentRecord.update({
        where: { id: consent.id },
        data: { status: 'expired' },
      });
      return { hasConsent: false, reason: 'Consent expired' };
    }

    return { hasConsent: true, consentId: consent.id };
  }

  /**
   * Query consent records
   */
  async queryConsents(
    ownerId: string,
    query: ConsentQuery
  ): Promise<any[]> {
    // Build where clause
    const where: any = {};

    if (query.vaultId) {
      // Verify ownership
      const vault = await this.prisma.personalDataVault.findUnique({
        where: { id: query.vaultId },
      });

      if (!vault || vault.ownerId !== ownerId) {
        throw new Error('Unauthorized');
      }

      where.vaultId = query.vaultId;
    } else {
      // Get all vaults owned by user
      const vaults = await this.prisma.personalDataVault.findMany({
        where: { ownerId },
        select: { id: true },
      });
      where.vaultId = { in: vaults.map(v => v.id) };
    }

    if (query.sharedWith) {
      where.sharedWith = query.sharedWith;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.purpose) {
      where.purpose = { contains: query.purpose, mode: 'insensitive' };
    }

    return this.prisma.consentRecord.findMany({
      where,
      include: {
        vault: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get consent statistics for a vault
   */
  async getConsentStats(vaultId: string, ownerId: string): Promise<{
    total: number;
    active: number;
    revoked: number;
    expired: number;
    byDataType: Record<string, number>;
    byPurpose: Record<string, number>;
  }> {
    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: vaultId },
    });

    if (!vault || vault.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    const consents = await this.prisma.consentRecord.findMany({
      where: { vaultId },
    });

    const stats = {
      total: consents.length,
      active: 0,
      revoked: 0,
      expired: 0,
      byDataType: {} as Record<string, number>,
      byPurpose: {} as Record<string, number>,
    };

    for (const consent of consents) {
      if (consent.status === 'active') stats.active++;
      else if (consent.status === 'revoked') stats.revoked++;
      else if (consent.status === 'expired') stats.expired++;

      for (const dataType of consent.dataTypes) {
        stats.byDataType[dataType] = (stats.byDataType[dataType] || 0) + 1;
      }

      stats.byPurpose[consent.purpose] = (stats.byPurpose[consent.purpose] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clean up expired consents (should be run periodically)
   */
  async cleanupExpiredConsents(): Promise<number> {
    const result = await this.prisma.consentRecord.updateMany({
      where: {
        status: 'active',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'expired',
      },
    });

    return result.count;
  }

  // Helper methods

  private validateDataTypes(dataTypes: string[]): void {
    const validTypes = ['credential', 'contract', 'log', 'profile'];

    for (const type of dataTypes) {
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid data type: ${type}`);
      }
    }
  }

  private generateAuditHash(
    vaultId: string,
    actorId: string,
    action: string,
    recordId?: string
  ): string {
    const data = `${vaultId}:${actorId}:${action}:${recordId || ''}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

