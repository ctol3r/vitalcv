/**
 * B235B-API-020: APIKeyRevocationProcess
 *
 * Defines procedure for revoking API keys:
 * - Triggers notifications
 * - Ensures active connections are terminated
 * - Logs revocation reason
 * - Provides reactivation path
 */

import { PrismaClient } from '@prisma/client';
import { APIKeyManagementService } from './apiKeyService';

export interface RevocationReason {
  type:
    | 'SECURITY_BREACH'
    | 'MISUSE'
    | 'ORGANIZATIONAL_CHANGE'
    | 'ROTATION'
    | 'MANUAL';
  description: string;
  initiatedBy: string; // User ID or system
}

export interface RevocationResult {
  keyId: string;
  revokedAt: Date;
  reason: RevocationReason;
  activeConnectionsTerminated: number;
  notificationsSent: boolean;
}

/**
 * In-memory store of active connections (use Redis in production)
 */
class ActiveConnectionStore {
  private connections: Map<string, Set<string>> = new Map(); // apiKeyId -> Set<connectionId>

  addConnection(apiKeyId: string, connectionId: string): void {
    const conns = this.connections.get(apiKeyId) || new Set();
    conns.add(connectionId);
    this.connections.set(apiKeyId, conns);
  }

  removeConnection(apiKeyId: string, connectionId: string): void {
    const conns = this.connections.get(apiKeyId);
    if (conns) {
      conns.delete(connectionId);
      if (conns.size === 0) {
        this.connections.delete(apiKeyId);
      }
    }
  }

  getConnections(apiKeyId: string): string[] {
    return Array.from(this.connections.get(apiKeyId) || []);
  }

  clearConnections(apiKeyId: string): void {
    this.connections.delete(apiKeyId);
  }
}

const activeConnections = new ActiveConnectionStore();

export class APIKeyRevocationProcess {
  constructor(
    private prisma: PrismaClient,
    private apiKeyService: APIKeyManagementService
  ) {}

  /**
   * Revoke API key with full process
   */
  async revokeKey(
    keyId: string,
    reason: RevocationReason
  ): Promise<RevocationResult> {
    // Step 1: Verify key exists and is active
    const apiKey = await this.apiKeyService.getAPIKey(keyId);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    if (apiKey.status === 'REVOKED') {
      throw new Error('API key is already revoked');
    }

    // Step 2: Get active connections
    const activeConnIds = activeConnections.getConnections(keyId);

    // Step 3: Terminate active connections
    const terminatedCount = await this.terminateConnections(keyId, activeConnIds);

    // Step 4: Revoke the key
    await this.apiKeyService.revokeAPIKey(keyId, reason.description);

    // Step 5: Send notifications
    const notificationsSent = await this.sendRevocationNotifications(
      keyId,
      apiKey.ownerOrgId,
      reason
    );

    // Step 6: Log revocation
    await this.logRevocation(keyId, reason, terminatedCount);

    return {
      keyId,
      revokedAt: new Date(),
      reason,
      activeConnectionsTerminated: terminatedCount,
      notificationsSent,
    };
  }

  /**
   * Terminate active connections
   */
  private async terminateConnections(
    apiKeyId: string,
    connectionIds: string[]
  ): Promise<number> {
    // In production, this would:
    // 1. Send termination signals to active WebSocket/SSE connections
    // 2. Invalidate active sessions
    // 3. Clear connection tracking

    // For now, just clear from memory store
    activeConnections.clearConnections(apiKeyId);

    // TODO: Implement actual connection termination
    // - WebSocket: Send close frame
    // - SSE: Close connection
    // - Long-polling: Return error response
    // - Session invalidation: Clear session store

    return connectionIds.length;
  }

  /**
   * Send revocation notifications
   */
  private async sendRevocationNotifications(
    keyId: string,
    orgId: string,
    reason: RevocationReason
  ): Promise<boolean> {
    try {
      // Send email notification to organization admins
      await this.sendEmailNotification(orgId, keyId, reason);

      // Send in-app notification
      await this.sendInAppNotification(orgId, keyId, reason);

      // Send webhook (if configured)
      await this.sendWebhookNotification(orgId, keyId, reason);

      return true;
    } catch (error) {
      console.error('Failed to send revocation notifications:', error);
      return false;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    orgId: string,
    keyId: string,
    reason: RevocationReason
  ): Promise<void> {
    // TODO: Integrate with email service
    console.log('[REVOCATION_EMAIL]', {
      orgId,
      keyId,
      reason: reason.type,
      message: `API key ${keyId} has been revoked. Reason: ${reason.description}`,
    });
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    orgId: string,
    keyId: string,
    reason: RevocationReason
  ): Promise<void> {
    // TODO: Create notification record in database
    console.log('[REVOCATION_NOTIFICATION]', {
      orgId,
      keyId,
      reason: reason.type,
    });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    orgId: string,
    keyId: string,
    reason: RevocationReason
  ): Promise<void> {
    // TODO: Send webhook to configured endpoint
    console.log('[REVOCATION_WEBHOOK]', {
      orgId,
      keyId,
      reason: reason.type,
    });
  }

  /**
   * Log revocation
   */
  private async logRevocation(
    keyId: string,
    reason: RevocationReason,
    terminatedConnections: number
  ): Promise<void> {
    console.log('[API_KEY_REVOCATION]', {
      keyId,
      reason: reason.type,
      description: reason.description,
      initiatedBy: reason.initiatedBy,
      terminatedConnections,
      timestamp: new Date().toISOString(),
    });

    // TODO: Store in audit log
    // await this.prisma.auditEvent.create({
    //   data: {
    //     eventType: 'API_KEY_REVOKED',
    //     subjectId: keyId,
    //     details: {
    //       reason,
    //       terminatedConnections,
    //     },
    //   },
    // });
  }

  /**
   * Reactivate a revoked key
   */
  async reactivateKey(keyId: string, reactivatedBy: string): Promise<void> {
    const apiKey = await this.apiKeyService.getAPIKey(keyId);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    if (apiKey.status === 'ACTIVE') {
      throw new Error('API key is already active');
    }

    // Reactivate the key
    await this.apiKeyService.reactivateAPIKey(keyId);

    // Send notification
    await this.sendReactivationNotification(
      apiKey.ownerOrgId,
      keyId,
      reactivatedBy
    );

    // Log reactivation
    console.log('[API_KEY_REACTIVATION]', {
      keyId,
      reactivatedBy,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send reactivation notification
   */
  private async sendReactivationNotification(
    orgId: string,
    keyId: string,
    reactivatedBy: string
  ): Promise<void> {
    console.log('[REACTIVATION_NOTIFICATION]', {
      orgId,
      keyId,
      reactivatedBy,
      message: `API key ${keyId} has been reactivated`,
    });
  }

  /**
   * Register active connection (call when connection is established)
   */
  static registerConnection(apiKeyId: string, connectionId: string): void {
    activeConnections.addConnection(apiKeyId, connectionId);
  }

  /**
   * Unregister connection (call when connection closes)
   */
  static unregisterConnection(apiKeyId: string, connectionId: string): void {
    activeConnections.removeConnection(apiKeyId, connectionId);
  }
}

