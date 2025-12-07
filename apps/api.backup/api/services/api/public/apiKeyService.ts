/**
 * B235B-API-012: APIKeyManagementService
 *
 * Service for creating, rotating, revoking API keys.
 * Enforces maximum keys per organization, logs actions, and sends notifications.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const MAX_KEYS_PER_ORG = 10; // Maximum API keys per organization

export interface CreateAPIKeyInput {
  ownerOrgId: string;
  scopes: string[];
  name?: string;
  description?: string;
}

export interface APIKeyResult {
  id: string;
  key: string; // Only returned once on creation
  keyPrefix: string;
  ownerOrgId: string;
  scopes: string[];
  status: 'ACTIVE' | 'REVOKED';
  createdAt: Date;
}

export interface RotateAPIKeyResult {
  oldKeyId: string;
  newKey: APIKeyResult;
}

export class APIKeyManagementService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate a secure API key
   */
  private generateAPIKey(): string {
    // Generate a 32-byte random key and encode as base64
    const randomBytes = crypto.randomBytes(32);
    return `sk_live_${randomBytes.toString('base64url')}`;
  }

  /**
   * Hash API key for storage (SHA-256)
   */
  private hashAPIKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Extract key prefix (first 8 chars after prefix) for identification
   */
  private extractKeyPrefix(key: string): string {
    const parts = key.split('_');
    if (parts.length >= 3) {
      return parts.slice(0, 3).join('_') + '_' + parts[2].substring(0, 8);
    }
    return key.substring(0, 16);
  }

  /**
   * Create a new API key for an organization
   */
  async createAPIKey(input: CreateAPIKeyInput): Promise<APIKeyResult> {
    // Check current key count for organization
    const currentKeyCount = await this.prisma.aPIKey.count({
      where: {
        ownerOrgId: input.ownerOrgId,
        status: 'ACTIVE',
      },
    });

    if (currentKeyCount >= MAX_KEYS_PER_ORG) {
      throw new Error(
        `Maximum API key limit reached. Organizations can have up to ${MAX_KEYS_PER_ORG} active keys.`
      );
    }

    // Generate new API key
    const plainKey = this.generateAPIKey();
    const keyHash = this.hashAPIKey(plainKey);
    const keyPrefix = this.extractKeyPrefix(plainKey);

    // Create API key record
    const apiKey = await this.prisma.aPIKey.create({
      data: {
        key: keyHash,
        keyPrefix,
        ownerOrgId: input.ownerOrgId,
        scopes: input.scopes,
        status: 'ACTIVE',
        metadata: {
          name: input.name,
          description: input.description,
        },
      },
    });

    // Log action
    await this.logAction('CREATE', apiKey.id, input.ownerOrgId, {
      scopes: input.scopes,
      name: input.name,
    });

    // Send notification (async, don't await)
    this.sendNotification('API_KEY_CREATED', input.ownerOrgId, {
      keyId: apiKey.id,
      keyPrefix: apiKey.keyPrefix,
    }).catch((err) => console.error('Failed to send notification:', err));

    return {
      id: apiKey.id,
      key: plainKey, // Return plain key only once
      keyPrefix: apiKey.keyPrefix,
      ownerOrgId: apiKey.ownerOrgId,
      scopes: apiKey.scopes,
      status: apiKey.status as 'ACTIVE' | 'REVOKED',
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * Rotate an API key (create new, optionally revoke old)
   */
  async rotateAPIKey(
    keyId: string,
    revokeOld: boolean = true
  ): Promise<RotateAPIKeyResult> {
    const oldKey = await this.prisma.aPIKey.findUnique({
      where: { id: keyId },
    });

    if (!oldKey) {
      throw new Error('API key not found');
    }

    if (oldKey.status === 'REVOKED') {
      throw new Error('Cannot rotate a revoked API key');
    }

    // Create new key
    const newKeyResult = await this.createAPIKey({
      ownerOrgId: oldKey.ownerOrgId,
      scopes: oldKey.scopes,
      name: (oldKey.metadata as any)?.name,
      description: (oldKey.metadata as any)?.description,
    });

    // Optionally revoke old key
    if (revokeOld) {
      await this.revokeAPIKey(keyId, 'Rotated to new key');
    }

    // Log action
    await this.logAction('ROTATE', keyId, oldKey.ownerOrgId, {
      newKeyId: newKeyResult.id,
      revokedOld: revokeOld,
    });

    // Send notification
    this.sendNotification('API_KEY_ROTATED', oldKey.ownerOrgId, {
      oldKeyId: keyId,
      newKeyId: newKeyResult.id,
      keyPrefix: newKeyResult.keyPrefix,
    }).catch((err) => console.error('Failed to send notification:', err));

    return {
      oldKeyId: keyId,
      newKey: newKeyResult,
    };
  }

  /**
   * Revoke an API key
   */
  async revokeAPIKey(keyId: string, reason?: string): Promise<void> {
    const apiKey = await this.prisma.aPIKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    if (apiKey.status === 'REVOKED') {
      throw new Error('API key is already revoked');
    }

    await this.prisma.aPIKey.update({
      where: { id: keyId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    // Log action
    await this.logAction('REVOKE', keyId, apiKey.ownerOrgId, {
      reason,
    });

    // Send notification
    this.sendNotification('API_KEY_REVOKED', apiKey.ownerOrgId, {
      keyId,
      keyPrefix: apiKey.keyPrefix,
      reason,
    }).catch((err) => console.error('Failed to send notification:', err));
  }

  /**
   * Reactivate a revoked API key
   */
  async reactivateAPIKey(keyId: string): Promise<void> {
    const apiKey = await this.prisma.aPIKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    if (apiKey.status === 'ACTIVE') {
      throw new Error('API key is already active');
    }

    await this.prisma.aPIKey.update({
      where: { id: keyId },
      data: {
        status: 'ACTIVE',
        revokedAt: null,
        revokedReason: null,
      },
    });

    // Log action
    await this.logAction('REACTIVATE', keyId, apiKey.ownerOrgId, {});

    // Send notification
    this.sendNotification('API_KEY_REACTIVATED', apiKey.ownerOrgId, {
      keyId,
      keyPrefix: apiKey.keyPrefix,
    }).catch((err) => console.error('Failed to send notification:', err));
  }

  /**
   * List API keys for an organization
   */
  async listAPIKeys(ownerOrgId: string, includeRevoked: boolean = false) {
    return this.prisma.aPIKey.findMany({
      where: {
        ownerOrgId,
        ...(includeRevoked ? {} : { status: 'ACTIVE' }),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        keyPrefix: true,
        scopes: true,
        status: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        revokedReason: true,
        metadata: true,
      },
    });
  }

  /**
   * Get API key by ID (without exposing the hash)
   */
  async getAPIKey(keyId: string) {
    const apiKey = await this.prisma.aPIKey.findUnique({
      where: { id: keyId },
      select: {
        id: true,
        keyPrefix: true,
        ownerOrgId: true,
        scopes: true,
        status: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        revokedReason: true,
        metadata: true,
      },
    });

    return apiKey;
  }

  /**
   * Update API key scopes
   */
  async updateScopes(keyId: string, scopes: string[]): Promise<void> {
    const apiKey = await this.prisma.aPIKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    await this.prisma.aPIKey.update({
      where: { id: keyId },
      data: { scopes },
    });

    // Log action
    await this.logAction('UPDATE_SCOPES', keyId, apiKey.ownerOrgId, {
      oldScopes: apiKey.scopes,
      newScopes: scopes,
    });
  }

  /**
   * Log action to audit trail
   */
  private async logAction(
    action: string,
    keyId: string,
    orgId: string,
    details: Record<string, any>
  ): Promise<void> {
    // In production, this would write to an audit log table
    // For now, we'll use console logging
    console.log('[API_KEY_ACTION]', {
      action,
      keyId,
      orgId,
      timestamp: new Date().toISOString(),
      details,
    });

    // TODO: Write to AuditEvent table or dedicated APIKeyAuditLog table
  }

  /**
   * Send notification (integrate with notification service)
   */
  private async sendNotification(
    eventType: string,
    orgId: string,
    data: Record<string, any>
  ): Promise<void> {
    // TODO: Integrate with notification service
    // This could send emails, in-app notifications, webhooks, etc.
    console.log('[API_KEY_NOTIFICATION]', {
      eventType,
      orgId,
      data,
      timestamp: new Date().toISOString(),
    });
  }
}

