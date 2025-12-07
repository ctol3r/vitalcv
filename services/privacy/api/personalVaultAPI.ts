/**
 * B237B-DP-019: PersonalVaultAPI
 *
 * Exposes endpoints to list, read, create, update, delete vault records.
 * Supports export/import and sharing actions.
 * Enforces auth, scopes, and retention rules.
 */

import { PrismaClient } from '@prisma/client';
import { DataExportService } from '../portability/dataExportService';
import { DataImportService } from '../portability/dataImportService';
import { SharedAccessTokenService } from '../models/SharedAccessToken';
import { ExternalDataSharingPolicy } from '../policies/externalDataSharingPolicy';

export interface VaultRecord {
  id: string;
  type: 'credential' | 'contract' | 'log' | 'profile';
  metadata: Record<string, any>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRecordRequest {
  type: 'credential' | 'contract' | 'log' | 'profile';
  data: Record<string, any>; // Will be encrypted
  metadata?: Record<string, any>;
}

export interface UpdateRecordRequest {
  data?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class PersonalVaultAPI {
  private exportService: DataExportService;
  private importService: DataImportService;
  private tokenService: SharedAccessTokenService;
  private policy: ExternalDataSharingPolicy;

  constructor(
    private prisma: PrismaClient,
    private authService?: any // Authentication service interface
  ) {
    this.exportService = new DataExportService(prisma);
    this.importService = new DataImportService(prisma);
    this.tokenService = new SharedAccessTokenService(prisma);
    this.policy = new ExternalDataSharingPolicy(prisma);
  }

  /**
   * List records in a vault
   */
  async listRecords(
    vaultId: string,
    userId: string,
    token?: string,
    options?: {
      type?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ records: VaultRecord[]; total: number }> {
    // Authenticate and authorize
    await this.authenticateAndAuthorize(vaultId, userId, token, 'read:all');

    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: vaultId },
      include: {
        records: {
          where: {
            deletedAt: null,
            ...(options?.type ? { type: options.type as any } : {}),
          },
          take: options?.limit || 50,
          skip: options?.offset || 0,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vault) {
      throw new Error('Vault not found');
    }

    // Log access
    await this.logAccess(vaultId, userId, token, 'list', vault.records.length);

    return {
      records: vault.records.map(r => ({
        id: r.id,
        type: r.type,
        metadata: r.metadata as Record<string, any>,
        version: r.version,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total: vault.records.length,
    };
  }

  /**
   * Get a specific record
   */
  async getRecord(
    vaultId: string,
    recordId: string,
    userId: string,
    token?: string
  ): Promise<VaultRecord> {
    await this.authenticateAndAuthorize(vaultId, userId, token, 'read:all');

    const record = await this.prisma.dataRecord.findUnique({
      where: { id: recordId },
      include: { vault: true },
    });

    if (!record) {
      throw new Error('Record not found');
    }

    if (record.vaultId !== vaultId) {
      throw new Error('Record does not belong to this vault');
    }

    if (record.deletedAt) {
      throw new Error('Record has been deleted');
    }

    // Log access
    await this.logAccess(vaultId, userId, token, 'read', 1, recordId);

    return {
      id: record.id,
      type: record.type,
      metadata: record.metadata as Record<string, any>,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Create a new record
   */
  async createRecord(
    vaultId: string,
    userId: string,
    request: CreateRecordRequest
  ): Promise<VaultRecord> {
    // Only vault owner can create records (no token access allowed)

    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: vaultId },
    });

    if (!vault || vault.ownerId !== userId) {
      throw new Error('Unauthorized');
    }

    // Encrypt data (simplified - in production, use proper encryption)
    const encryptedPayload = Buffer.from(JSON.stringify(request.data));

    // Create record
    const record = await this.prisma.dataRecord.create({
      data: {
        vaultId,
        type: request.type,
        encryptedPayload,
        metadata: request.metadata || {},
        version: 1,
        checksum: this.generateChecksum(request.data),
      },
    });

    // Log creation
    await this.logAccess(vaultId, userId, undefined, 'create', 1, record.id);

    return {
      id: record.id,
      type: record.type,
      metadata: record.metadata as Record<string, any>,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Update a record
   */
  async updateRecord(
    vaultId: string,
    recordId: string,
    userId: string,
    request: UpdateRecordRequest,
    token?: string
  ): Promise<VaultRecord> {
    // Check if token has write access
    if (token) {
      await this.authenticateAndAuthorize(vaultId, userId, token, 'write:all');
    } else {
      // Only owner can update without token
      const vault = await this.prisma.personalDataVault.findUnique({
        where: { id: vaultId },
      });
      if (!vault || vault.ownerId !== userId) {
        throw new Error('Unauthorized');
      }
    }

    const existing = await this.prisma.dataRecord.findUnique({
      where: { id: recordId },
    });

    if (!existing || existing.vaultId !== vaultId) {
      throw new Error('Record not found');
    }

    if (existing.deletedAt) {
      throw new Error('Cannot update deleted record');
    }

    // Update record (create new version)
    const updated = await this.prisma.dataRecord.create({
      data: {
        vaultId,
        type: existing.type,
        encryptedPayload: request.data
          ? Buffer.from(JSON.stringify(request.data))
          : existing.encryptedPayload,
        metadata: {
          ...(existing.metadata as any || {}),
          ...(request.metadata || {}),
        },
        version: existing.version + 1,
        previousVersionId: existing.id,
        checksum: request.data ? this.generateChecksum(request.data) : existing.checksum,
      },
    });

    // Log update
    await this.logAccess(vaultId, userId, token, 'update', 1, recordId);

    return {
      id: updated.id,
      type: updated.type,
      metadata: updated.metadata as Record<string, any>,
      version: updated.version,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Delete a record (soft delete)
   */
  async deleteRecord(
    vaultId: string,
    recordId: string,
    userId: string,
    token?: string
  ): Promise<void> {
    if (token) {
      await this.authenticateAndAuthorize(vaultId, userId, token, 'write:all');
    } else {
      const vault = await this.prisma.personalDataVault.findUnique({
        where: { id: vaultId },
      });
      if (!vault || vault.ownerId !== userId) {
        throw new Error('Unauthorized');
      }
    }

    await this.prisma.dataRecord.update({
      where: { id: recordId },
      data: { deletedAt: new Date() },
    });

    await this.logAccess(vaultId, userId, token, 'delete', 1, recordId);
  }

  /**
   * Request export
   */
  async requestExport(
    vaultId: string,
    userId: string,
    format: 'ZIP' | 'JSON' | 'PDF',
    recordIds?: string[]
  ): Promise<{ exportId: string }> {
    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: vaultId },
    });

    if (!vault || vault.ownerId !== userId) {
      throw new Error('Unauthorized');
    }

    // Evaluate policy
    const policyResult = await this.policy.evaluate({
      vaultId,
      action: 'export',
      dataTypes: recordIds ? ['all'] : ['all'],
      purpose: 'user_export',
      destination: 'user_device',
    });

    if (!policyResult.allowed) {
      throw new Error(`Export not allowed: ${policyResult.reason}`);
    }

    const result = await this.exportService.requestExport(vaultId, userId, {
      format,
      recordIds,
    });

    return { exportId: result.exportId };
  }

  /**
   * Confirm and execute export
   */
  async confirmExport(
    exportId: string,
    userId: string,
    password?: string
  ): Promise<{ fileLocation: string; checksum: string }> {
    const result = await this.exportService.confirmAndExport(exportId, userId, password);
    return {
      fileLocation: result.fileLocation,
      checksum: result.checksum,
    };
  }

  /**
   * Import data
   */
  async importData(
    vaultId: string,
    userId: string,
    source: { type: 'file' | 'external_vault' | 'api'; path?: string; connectionId?: string },
    options?: { conflictResolution?: 'skip' | 'overwrite' | 'merge' | 'rename' }
  ): Promise<{ importId: string }> {
    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: vaultId },
    });

    if (!vault || vault.ownerId !== userId) {
      throw new Error('Unauthorized');
    }

    const result = await this.importService.importData(vaultId, userId, {
      source,
      conflictResolution: options?.conflictResolution,
    });

    return { importId: result.importId };
  }

  /**
   * Share vault with token
   */
  async shareVault(
    vaultId: string,
    ownerId: string,
    granteeId?: string,
    granteeEmail?: string,
    scopes: string[] = ['read:all'],
    expiryDate?: Date
  ): Promise<{ token: string; tokenId: string }> {
    // Evaluate policy
    const policyResult = await this.policy.evaluate({
      vaultId,
      action: 'share',
      dataTypes: ['all'],
      recipient: granteeId || granteeEmail,
      purpose: 'shared_access',
    });

    if (!policyResult.allowed) {
      throw new Error(`Sharing not allowed: ${policyResult.reason}`);
    }

    const result = await this.tokenService.createToken(ownerId, {
      vaultId,
      granteeId,
      granteeEmail,
      scopes,
      expiryDate,
    });

    return result;
  }

  // Helper methods

  private async authenticateAndAuthorize(
    vaultId: string,
    userId: string,
    token: string | undefined,
    requiredScope: string
  ): Promise<void> {
    if (token) {
      // Validate token
      const validation = await this.tokenService.validateToken(token);
      if (!validation.valid) {
        throw new Error(`Invalid token: ${validation.error}`);
      }

      if (validation.token!.vaultId !== vaultId) {
        throw new Error('Token not valid for this vault');
      }

      // Check scope
      if (!this.tokenService.hasScope(validation.token!.scopes, requiredScope)) {
        throw new Error(`Insufficient scope: requires ${requiredScope}`);
      }
    } else {
      // Direct user access - verify ownership
      const vault = await this.prisma.personalDataVault.findUnique({
        where: { id: vaultId },
      });

      if (!vault || vault.ownerId !== userId) {
        throw new Error('Unauthorized');
      }
    }
  }

  private async logAccess(
    vaultId: string,
    userId: string,
    token: string | undefined,
    action: string,
    recordCount: number,
    recordId?: string
  ): Promise<void> {
    // Log to audit trail
    await this.prisma.vaultAuditLog.create({
      data: {
        vaultId,
        actorId: userId,
        action,
        recordId,
        scope: token ? 'token_access' : 'direct_access',
        metadata: {
          tokenUsed: !!token,
          recordCount,
        },
        hash: this.generateAuditHash(vaultId, userId, action, recordId),
      },
    });

    // Log token usage if applicable
    if (token) {
      const validation = await this.tokenService.validateToken(token);
      if (validation.valid && validation.token) {
        await this.tokenService.logUsage(
          validation.token.id,
          action,
          recordCount,
          undefined, // ipAddress
          undefined, // userAgent
          { recordId }
        );
      }
    }
  }

  private generateChecksum(data: any): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private generateAuditHash(vaultId: string, actorId: string, action: string, recordId?: string): string {
    const crypto = require('crypto');
    const data = `${vaultId}:${actorId}:${action}:${recordId || ''}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

