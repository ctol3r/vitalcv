// B235B-API-012: APIKeyManagementService - Creates, rotates, revokes API keys

import { PrismaClient, APIKeyStatus } from '@prisma/client';
import {
  generateAPIKey,
  hashAPIKey,
  verifyAPIKey,
  APIKeyCreateInput,
  APIKeyResponse,
  APIKeyWithPlaintext,
} from './models/APIKey';

const MAX_KEYS_PER_ORG = 10; // Maximum API keys per organization

export class APIKeyManagementService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new API key for an organization
   * Enforces maximum keys per org limit
   */
  async createAPIKey(
    input: APIKeyCreateInput,
    createdBy: string // User ID who created the key
  ): Promise<APIKeyWithPlaintext> {
    // Check current key count
    const existingKeys = await this.prisma.aPIKey.count({
      where: {
        ownerOrgId: input.ownerOrgId,
        status: APIKeyStatus.ACTIVE,
      },
    });

    if (existingKeys >= MAX_KEYS_PER_ORG) {
      throw new Error(
        `Maximum API keys per organization (${MAX_KEYS_PER_ORG}) exceeded. Please revoke an existing key first.`
      );
    }

    // Generate new API key
    const { plaintext, hash, prefix } = generateAPIKey();

    // Create in database
    const apiKey = await this.prisma.aPIKey.create({
      data: {
        key: hash,
        keyPrefix: prefix,
        ownerOrgId: input.ownerOrgId,
        scopes: input.scopes,
        status: APIKeyStatus.ACTIVE,
        metadata: input.metadata || {},
      },
    });

    // Log action
    await this.logAction('create', apiKey.id, input.ownerOrgId, createdBy, {
      scopes: input.scopes,
    });

    // Send notification (async, don't await)
    this.sendNotification('created', apiKey.id, input.ownerOrgId).catch((err) => {
      console.error('Failed to send API key creation notification:', err);
    });

    return {
      id: apiKey.id,
      key: plaintext, // Only time plaintext is returned
      keyPrefix: apiKey.keyPrefix,
      ownerOrgId: apiKey.ownerOrgId,
      scopes: apiKey.scopes,
      status: apiKey.status,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
      metadata: apiKey.metadata as Record<string, any> | null,
    };
  }

  /**
   * Rotate an API key - creates new key and revokes old one
   */
  async rotateAPIKey(
    apiKeyId: string,
    ownerOrgId: string,
    rotatedBy: string
  ): Promise<APIKeyWithPlaintext> {
    // Verify ownership
    const existingKey = await this.prisma.aPIKey.findFirst({
      where: {
        id: apiKeyId,
        ownerOrgId,
        status: APIKeyStatus.ACTIVE,
      },
    });

    if (!existingKey) {
      throw new Error('API key not found or already revoked');
    }

    // Revoke old key
    await this.revokeAPIKey(apiKeyId, ownerOrgId, rotatedBy, 'Rotated to new key');

    // Create new key with same scopes
    const newKey = await this.createAPIKey(
      {
        ownerOrgId,
        scopes: existingKey.scopes,
        metadata: existingKey.metadata as Record<string, any> | undefined,
      },
      rotatedBy
    );

    // Log rotation
    await this.logAction('rotate', apiKeyId, ownerOrgId, rotatedBy, {
      newKeyId: newKey.id,
    });

    // Send notification
    this.sendNotification('rotated', apiKeyId, ownerOrgId, {
      newKeyId: newKey.id,
    }).catch((err) => {
      console.error('Failed to send API key rotation notification:', err);
    });

    return newKey;
  }

  /**
   * Revoke an API key
   */
  async revokeAPIKey(
    apiKeyId: string,
    ownerOrgId: string,
    revokedBy: string,
    reason?: string
  ): Promise<void> {
    const apiKey = await this.prisma.aPIKey.findFirst({
      where: {
        id: apiKeyId,
        ownerOrgId,
        status: APIKeyStatus.ACTIVE,
      },
    });

    if (!apiKey) {
      throw new Error('API key not found or already revoked');
    }

    await this.prisma.aPIKey.update({
      where: { id: apiKeyId },
      data: {
        status: APIKeyStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: reason || 'Revoked by administrator',
      },
    });

    // Log action
    await this.logAction('revoke', apiKeyId, ownerOrgId, revokedBy, {
      reason: reason || 'Revoked by administrator',
    });

    // Send notification
    this.sendNotification('revoked', apiKeyId, ownerOrgId, {
      reason: reason || 'Revoked by administrator',
    }).catch((err) => {
      console.error('Failed to send API key revocation notification:', err);
    });

    // TODO: Ensure active connections are terminated
    // This would involve tracking active sessions/connections and closing them
  }

  /**
   * List API keys for an organization
   */
  async listAPIKeys(ownerOrgId: string): Promise<APIKeyResponse[]> {
    const keys = await this.prisma.aPIKey.findMany({
      where: { ownerOrgId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((key) => ({
      id: key.id,
      keyPrefix: key.keyPrefix,
      ownerOrgId: key.ownerOrgId,
      scopes: key.scopes,
      status: key.status,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      metadata: key.metadata as Record<string, any> | null,
    }));
  }

  /**
   * Get API key by ID (for verification)
   */
  async getAPIKeyById(apiKeyId: string): Promise<APIKeyResponse | null> {
    const key = await this.prisma.aPIKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!key) return null;

    return {
      id: key.id,
      keyPrefix: key.keyPrefix,
      ownerOrgId: key.ownerOrgId,
      scopes: key.scopes,
      status: key.status,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      metadata: key.metadata as Record<string, any> | null,
    };
  }

  /**
   * Verify API key from Authorization header
   * Returns API key info if valid, null if invalid
   */
  async verifyAPIKey(plaintextKey: string): Promise<APIKeyResponse | null> {
    const hash = hashAPIKey(plaintextKey);

    const apiKey = await this.prisma.aPIKey.findUnique({
      where: { key: hash },
    });

    if (!apiKey || apiKey.status !== APIKeyStatus.ACTIVE) {
      return null;
    }

    // Update lastUsedAt
    await this.prisma.aPIKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: apiKey.id,
      keyPrefix: apiKey.keyPrefix,
      ownerOrgId: apiKey.ownerOrgId,
      scopes: apiKey.scopes,
      status: apiKey.status,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
      metadata: apiKey.metadata as Record<string, any> | null,
    };
  }

  /**
   * Reactivate a revoked API key
   */
  async reactivateAPIKey(
    apiKeyId: string,
    ownerOrgId: string,
    reactivatedBy: string
  ): Promise<APIKeyResponse> {
    const apiKey = await this.prisma.aPIKey.findFirst({
      where: {
        id: apiKeyId,
        ownerOrgId,
        status: APIKeyStatus.REVOKED,
      },
    });

    if (!apiKey) {
      throw new Error('API key not found or not revoked');
    }

    const reactivated = await this.prisma.aPIKey.update({
      where: { id: apiKeyId },
      data: {
        status: APIKeyStatus.ACTIVE,
        revokedAt: null,
        revokedReason: null,
      },
    });

    // Log action
    await this.logAction('reactivate', apiKeyId, ownerOrgId, reactivatedBy);

    return {
      id: reactivated.id,
      keyPrefix: reactivated.keyPrefix,
      ownerOrgId: reactivated.ownerOrgId,
      scopes: reactivated.scopes,
      status: reactivated.status,
      createdAt: reactivated.createdAt,
      lastUsedAt: reactivated.lastUsedAt,
      metadata: reactivated.metadata as Record<string, any> | null,
    };
  }

  /**
   * Log API key management actions
   */
  private async logAction(
    action: 'create' | 'rotate' | 'revoke' | 'reactivate',
    apiKeyId: string,
    orgId: string,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Log to audit system or database
    // For now, we'll use console.log, but in production this should go to an audit log table
    console.log('API Key Action:', {
      action,
      apiKeyId,
      orgId,
      userId,
      timestamp: new Date().toISOString(),
      metadata,
    });

    // TODO: Integrate with audit logging system
    // await this.prisma.auditLog.create({ ... });
  }

  /**
   * Send notifications for API key events
   */
  private async sendNotification(
    event: 'created' | 'rotated' | 'revoked',
    apiKeyId: string,
    orgId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // TODO: Integrate with notification service
    // This should send email/Slack notifications to org admins
    console.log('API Key Notification:', {
      event,
      apiKeyId,
      orgId,
      metadata,
    });
  }
}

