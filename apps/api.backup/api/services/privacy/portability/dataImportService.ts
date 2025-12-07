/**
 * B237B-DP-012: DataImportService
 *
 * Allows importing data from external vaults or sources.
 * Validates schema, decrypts if needed, merges into existing vault.
 * Logs import events and handles conflicts.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { readFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { parse } from 'path';

export interface ImportSource {
  type: 'file' | 'external_vault' | 'api';
  path?: string; // For file imports
  connectionId?: string; // For external vault/API imports
  metadata?: Record<string, any>;
}

export interface ImportOptions {
  source: ImportSource;
  conflictResolution?: 'skip' | 'overwrite' | 'merge' | 'rename';
  validateSchema?: boolean;
  decryptPassword?: string; // If source is encrypted
}

export interface ImportResult {
  importId: string;
  recordCount: number;
  conflictCount: number;
  conflicts: Array<{
    recordId: string;
    reason: string;
    resolution: string;
  }>;
  status: 'completed' | 'partial' | 'failed';
}

export class DataImportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Import data into a vault
   */
  async importData(
    vaultId: string,
    userId: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    // Verify vault ownership
    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: vaultId },
      include: { records: true },
    });

    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    if (vault.ownerId !== userId) {
      throw new Error('Unauthorized: You do not own this vault');
    }

    // Create import event
    const importEvent = await this.prisma.dataImportEvent.create({
      data: {
        vaultId,
        userId,
        source: options.source.type,
        sourceFile: options.source.path,
        status: 'validating',
        metadata: options.source.metadata,
      },
    });

    try {
      // Load data based on source type
      let data: any;
      switch (options.source.type) {
        case 'file':
          data = await this.loadFromFile(options.source.path!, options.decryptPassword);
          break;
        case 'external_vault':
        case 'api':
          data = await this.loadFromConnection(options.source.connectionId!, options);
          break;
        default:
          throw new Error(`Unsupported source type: ${options.source.type}`);
      }

      // Validate schema if requested
      if (options.validateSchema !== false) {
        await this.validateSchema(data);
      }

      // Update status to importing
      await this.prisma.dataImportEvent.update({
        where: { id: importEvent.id },
        data: { status: 'importing' },
      });

      // Process and import records
      const result = await this.processRecords(
        vaultId,
        data,
        options.conflictResolution || 'skip'
      );

      // Update import event
      await this.prisma.dataImportEvent.update({
        where: { id: importEvent.id },
        data: {
          status: result.status === 'failed' ? 'failed' : 'completed',
          recordCount: result.recordCount,
          conflictCount: result.conflictCount,
          completedAt: new Date(),
          error: result.status === 'failed' ? 'Import completed with errors' : undefined,
        },
      });

      // Log import in audit trail
      await this.prisma.vaultAuditLog.create({
        data: {
          vaultId,
          actorId: userId,
          action: 'import',
          scope: `source:${options.source.type}`,
          metadata: {
            importId: importEvent.id,
            recordCount: result.recordCount,
            conflictCount: result.conflictCount,
          },
          hash: this.generateAuditHash(vaultId, userId, 'import', importEvent.id),
        },
      });

      return {
        importId: importEvent.id,
        ...result,
      };
    } catch (error: any) {
      await this.prisma.dataImportEvent.update({
        where: { id: importEvent.id },
        data: {
          status: 'failed',
          error: error.message || 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Load data from file
   */
  private async loadFromFile(
    filePath: string,
    password?: string
  ): Promise<any> {
    const fileContent = await readFile(filePath, 'utf-8');
    const ext = parse(filePath).ext.toLowerCase();

    let data: any;

    if (ext === '.json') {
      data = JSON.parse(fileContent);
    } else if (ext === '.zip') {
      // For ZIP files, we'd need to extract first
      // This is a simplified version - in production, use a ZIP library
      throw new Error('ZIP import not yet implemented');
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    // If password provided, attempt decryption
    if (password && data.encrypted) {
      data = await this.decryptData(data, password);
    }

    return data;
  }

  /**
   * Load data from external connection (OAuth/API)
   */
  private async loadFromConnection(
    connectionId: string,
    options: ImportOptions
  ): Promise<any> {
    const connection = await this.prisma.thirdPartyConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    if (connection.status !== 'active') {
      throw new Error(`Connection is not active: ${connection.status}`);
    }

    // In production, this would make an API call to the third-party service
    // For now, return a placeholder structure
    // You would use the connection's accessToken to authenticate

    // Log connection usage
    await this.prisma.connectionUsageLog.create({
      data: {
        connectionId,
        action: 'import',
        recordCount: 0, // Will be updated after import
        metadata: options.source.metadata,
      },
    });

    // Placeholder - in production, fetch from API
    return {
      records: [],
      metadata: {
        source: connection.providerName,
        importedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Validate import data schema
   */
  private async validateSchema(data: any): Promise<void> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format: expected object');
    }

    // Check for required fields
    if (!data.records || !Array.isArray(data.records)) {
      throw new Error('Invalid schema: missing or invalid records array');
    }

    // Validate each record
    for (const record of data.records) {
      if (!record.id || typeof record.id !== 'string') {
        throw new Error('Invalid record: missing or invalid id');
      }

      if (!record.type || typeof record.type !== 'string') {
        throw new Error('Invalid record: missing or invalid type');
      }

      // Type should be one of the DataRecordType enum values
      const validTypes = ['credential', 'contract', 'log', 'profile'];
      if (!validTypes.includes(record.type)) {
        throw new Error(`Invalid record type: ${record.type}`);
      }
    }
  }

  /**
   * Process and import records into vault
   */
  private async processRecords(
    vaultId: string,
    data: any,
    conflictResolution: 'skip' | 'overwrite' | 'merge' | 'rename'
  ): Promise<Omit<ImportResult, 'importId'>> {
    const records = data.records || [];
    const conflicts: ImportResult['conflicts'] = [];
    let importedCount = 0;
    let conflictCount = 0;

    // Get existing records to check for conflicts
    const existingRecords = await this.prisma.dataRecord.findMany({
      where: { vaultId },
      select: { id: true, type: true },
    });

    const existingIds = new Set(existingRecords.map(r => r.id));
    const existingByType = new Map<string, string[]>();
    existingRecords.forEach(r => {
      if (!existingByType.has(r.type)) {
        existingByType.set(r.type, []);
      }
      existingByType.get(r.type)!.push(r.id);
    });

    for (const record of records) {
      const isConflict = existingIds.has(record.id);

      if (isConflict) {
        conflictCount++;

        let resolution = conflictResolution;
        let shouldImport = false;

        switch (conflictResolution) {
          case 'skip':
            shouldImport = false;
            break;
          case 'overwrite':
            // Delete existing and import new
            await this.prisma.dataRecord.delete({
              where: { id: record.id },
            });
            shouldImport = true;
            break;
          case 'merge':
            // Merge metadata (simplified - in production, more sophisticated merging)
            const existing = await this.prisma.dataRecord.findUnique({
              where: { id: record.id },
            });
            if (existing) {
              await this.prisma.dataRecord.update({
                where: { id: record.id },
                data: {
                  metadata: {
                    ...(existing.metadata as any || {}),
                    ...(record.metadata || {}),
                    mergedAt: new Date().toISOString(),
                  },
                  version: existing.version + 1,
                },
              });
              importedCount++;
            }
            shouldImport = false;
            break;
          case 'rename':
            // Generate new ID
            record.id = crypto.randomUUID();
            shouldImport = true;
            break;
        }

        conflicts.push({
          recordId: record.id,
          reason: 'Record with same ID already exists',
          resolution,
        });

        if (!shouldImport) {
          continue;
        }
      }

      // Import record
      try {
        // Note: In production, you'd need to handle encryptedPayload properly
        // For now, we'll create records with metadata only
        await this.prisma.dataRecord.create({
          data: {
            id: record.id,
            vaultId,
            type: record.type as any,
            encryptedPayload: Buffer.from(JSON.stringify(record.data || {})), // Placeholder
            metadata: record.metadata || {},
            version: record.version || 1,
            checksum: record.checksum || this.generateChecksum(record),
          },
        });

        importedCount++;
      } catch (error: any) {
        conflicts.push({
          recordId: record.id,
          reason: error.message || 'Failed to import',
          resolution: 'error',
        });
      }
    }

    return {
      recordCount: importedCount,
      conflictCount,
      conflicts,
      status: conflicts.some(c => c.resolution === 'error') ? 'partial' : 'completed',
    };
  }

  /**
   * Decrypt data (simplified - in production, use proper encryption)
   */
  private async decryptData(encryptedData: any, password: string): Promise<any> {
    // This is a placeholder - in production, implement proper decryption
    // based on your encryption scheme
    if (encryptedData.algorithm === 'AES-GCM') {
      // Implement AES-GCM decryption
      throw new Error('AES-GCM decryption not yet implemented');
    }
    return encryptedData;
  }

  /**
   * Generate checksum for record
   */
  private generateChecksum(record: any): string {
    const data = JSON.stringify(record);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate audit hash
   */
  private generateAuditHash(
    vaultId: string,
    actorId: string,
    action: string,
    recordId?: string
  ): string {
    const data = `${vaultId}:${actorId}:${action}:${recordId || ''}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get import status
   */
  async getImportStatus(importId: string, userId: string) {
    const importEvent = await this.prisma.dataImportEvent.findUnique({
      where: { id: importId },
    });

    if (!importEvent) {
      throw new Error(`Import event not found: ${importId}`);
    }

    if (importEvent.userId !== userId) {
      throw new Error('Unauthorized');
    }

    return importEvent;
  }

  /**
   * List imports for a vault
   */
  async listImports(vaultId: string, userId: string) {
    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: vaultId },
    });

    if (!vault || vault.ownerId !== userId) {
      throw new Error('Unauthorized');
    }

    return this.prisma.dataImportEvent.findMany({
      where: { vaultId, userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

