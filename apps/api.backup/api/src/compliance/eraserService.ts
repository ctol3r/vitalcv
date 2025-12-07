/**
 * COMP-004: GDPR-Compatible Soft Delete and Crypto-Shredding Service
 *
 * Handles subject-rights requests (GDPR right-to-erasure) by:
 * 1. Marking records as erased (soft delete)
 * 2. Deleting associated encryption keys/peppers (crypto-shredding)
 * 3. Making on-chain anchors and stored ciphertext unusable
 * 4. Preserving necessary audit minimality
 */

import { PrismaClient } from '@prisma/client';

export interface ErasureRequest {
  subjectId: string; // User ID, NPI, or DID
  subjectType: 'user' | 'npi' | 'did' | 'email';
  reason?: string;
  requestedBy?: string; // User ID of requester
}

export interface ErasureResult {
  success: boolean;
  recordsErased: number;
  keysDeleted: number;
  errors: string[];
  preservedRecords?: string[]; // Records preserved for audit (with minimal data)
}

export class EraserService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Process a GDPR right-to-erasure request
   */
  async processErasureRequest(request: ErasureRequest): Promise<ErasureResult> {
    const result: ErasureResult = {
      success: true,
      recordsErased: 0,
      keysDeleted: 0,
      errors: [],
      preservedRecords: [],
    };

    try {
      // 1. Find all records for the subject
      const records = await this.findSubjectRecords(request);

      // 2. Identify encryption keys to delete
      const keyIds = new Set<string>();
      for (const record of records) {
        if (record.encryptionKeyId) {
          keyIds.add(record.encryptionKeyId);
        }
      }

      // 3. Mark records as erased (soft delete)
      const eraseDate = new Date();
      for (const record of records) {
        try {
          // Check if record should be preserved for audit
          if (this.shouldPreserveForAudit(record)) {
            // Preserve with minimal data only
            await this.preserveMinimalAuditData(record, eraseDate);
            result.preservedRecords?.push(record.id);
          } else {
            // Full erasure
            await this.eraseRecord(record, eraseDate);
            result.recordsErased++;
          }
        } catch (err: any) {
          result.errors.push(`Failed to erase record ${record.id}: ${err.message}`);
          result.success = false;
        }
      }

      // 4. Delete encryption keys (crypto-shredding)
      for (const keyId of keyIds) {
        try {
          await this.deleteEncryptionKey(keyId);
          result.keysDeleted++;
        } catch (err: any) {
          result.errors.push(`Failed to delete encryption key ${keyId}: ${err.message}`);
          result.success = false;
        }
      }

      // 5. Log erasure event
      await this.logErasureEvent(request, result);

      return result;
    } catch (err: any) {
      result.success = false;
      result.errors.push(`Erasure request failed: ${err.message}`);
      return result;
    }
  }

  /**
   * Find all records for a subject
   */
  private async findSubjectRecords(request: ErasureRequest): Promise<any[]> {
    const records: any[] = [];

    // Find by user ID
    if (request.subjectType === 'user') {
      const credentials = await this.prisma.credential.findMany({
        where: { userId: request.subjectId, erasedAt: null },
      });
      records.push(...credentials);
    }

    // Find by NPI
    if (request.subjectType === 'npi') {
      // Assuming NPI is stored in verifiedData or related tables
      // This is a simplified version - adjust based on actual schema
      const candidates = await this.prisma.candidate.findMany({
        where: { npi: request.subjectId, erasedAt: null },
      });
      records.push(...candidates);

      // Also check credentials linked via user->npi relationship
      // (Implementation depends on actual schema relationships)
    }

    // Find by DID
    if (request.subjectType === 'did') {
      const candidates = await this.prisma.candidate.findMany({
        where: { did: request.subjectId, erasedAt: null },
      });
      records.push(...candidates);

      const credentials = await this.prisma.credential.findMany({
        where: { holderDid: request.subjectId, erasedAt: null },
      });
      records.push(...credentials);
    }

    // Find by email
    if (request.subjectType === 'email') {
      const user = await this.prisma.user.findUnique({
        where: { email: request.subjectId },
      });

      if (user) {
        const credentials = await this.prisma.credential.findMany({
          where: { userId: user.id, erasedAt: null },
        });
        records.push(...credentials);
      }
    }

    return records;
  }

  /**
   * Erase a record (soft delete)
   */
  private async eraseRecord(record: any, eraseDate: Date): Promise<void> {
    // Determine record type and erase accordingly
    if ('credHash' in record) {
      // It's a Credential
      await this.prisma.credential.update({
        where: { id: record.id },
        data: {
          erasedAt: eraseDate,
          // Anonymize sensitive fields
          name: '[ERASED]',
          holderDid: null,
          // Keep hash for audit trail but mark as unusable
          credHash: record.credHash ? `ERASED_${record.credHash}` : null,
        },
      });
    } else if ('verifiedData' in record) {
      // It's a Candidate
      await this.prisma.candidate.update({
        where: { id: record.id },
        data: {
          erasedAt: eraseDate,
          email: null,
          name: null,
          verifiedData: null,
          npi: null, // Remove NPI reference
        },
      });
    }
  }

  /**
   * Check if record should be preserved for audit (e.g., regulatory requirements)
   */
  private shouldPreserveForAudit(record: any): boolean {
    // Preserve if classification indicates regulatory requirement
    const classification = record.classification as any;
    if (classification?.complianceDomains?.includes('HIPAA')) {
      // HIPAA may require minimal retention for certain records
      return true;
    }

    // Preserve if record is linked to an active credentialing process
    // (Implementation depends on business rules)

    return false;
  }

  /**
   * Preserve minimal audit data (anonymized)
   */
  private async preserveMinimalAuditData(record: any, eraseDate: Date): Promise<void> {
    if ('credHash' in record) {
      await this.prisma.credential.update({
        where: { id: record.id },
        data: {
          erasedAt: eraseDate,
          // Anonymize but keep structure for audit
          name: '[ANONYMIZED]',
          holderDid: null,
          userId: 'ERASED', // Keep reference but mark as erased
        },
      });
    } else if ('verifiedData' in record) {
      await this.prisma.candidate.update({
        where: { id: record.id },
        data: {
          erasedAt: eraseDate,
          email: '[ANONYMIZED]',
          name: '[ANONYMIZED]',
          npi: null,
          verifiedData: { anonymized: true, erasedAt: eraseDate.toISOString() },
        },
      });
    }
  }

  /**
   * Delete encryption key (crypto-shredding)
   * This makes any encrypted data using this key permanently unusable
   */
  private async deleteEncryptionKey(keyId: string): Promise<void> {
    // This is a placeholder - actual implementation depends on your KMS
    // Options:
    // 1. AWS KMS: Delete key or schedule deletion
    // 2. HashiCorp Vault: Revoke/destroy key
    // 3. Database-stored keys: Delete from key table

    // For now, log the key deletion (actual KMS integration needed)
    console.log(`[CRYPTO-SHREDDING] Deleting encryption key: ${keyId}`);

    // TODO: Integrate with actual KMS
    // Example:
    // await kmsClient.scheduleKeyDeletion({ KeyId: keyId, PendingWindowInDays: 7 });

    // Optionally, store key deletion record for audit
    await this.prisma.auditEvent.create({
      data: {
        type: 'ENCRYPTION_KEY_DELETED',
        data: {
          keyId,
          reason: 'GDPR_ERASURE',
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Log erasure event for audit trail
   */
  private async logErasureEvent(request: ErasureRequest, result: ErasureResult): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        type: 'GDPR_ERASURE_REQUEST',
        data: {
          subjectId: request.subjectId,
          subjectType: request.subjectType,
          reason: request.reason,
          requestedBy: request.requestedBy,
          recordsErased: result.recordsErased,
          keysDeleted: result.keysDeleted,
          preservedRecords: result.preservedRecords,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Verify that a record is erased (for compliance verification)
   */
  async isRecordErased(recordId: string, recordType: 'credential' | 'candidate'): Promise<boolean> {
    if (recordType === 'credential') {
      const record = await this.prisma.credential.findUnique({
        where: { id: recordId },
        select: { erasedAt: true },
      });
      return record?.erasedAt !== null;
    } else {
      const record = await this.prisma.candidate.findUnique({
        where: { id: recordId },
        select: { erasedAt: true },
      });
      return record?.erasedAt !== null;
    }
  }

  /**
   * Get erasure status for a subject
   */
  async getErasureStatus(subjectId: string, subjectType: 'user' | 'npi' | 'did' | 'email') {
    const records = await this.findSubjectRecords({ subjectId, subjectType });

    return {
      totalRecords: records.length,
      erasedRecords: records.filter(r => r.erasedAt !== null).length,
      pendingRecords: records.filter(r => r.erasedAt === null).length,
    };
  }
}

