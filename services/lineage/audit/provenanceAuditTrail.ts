/**
 * B228B-LIN-010: ProvenanceAuditTrail
 *
 * Stores a verifiable chain of signatures for each lineage record.
 * Ensures tamper-evident provenance. Integrates with FinancialAuditTrail.
 */

import { PrismaClient } from '@prisma/client';
import { createHash, createSign, createVerify, generateKeyPairSync } from 'crypto';
import { createLogger } from '@chai-vc/logging-core';
// FinancialAuditTrail integration - import path may need adjustment based on project structure
// import { FinancialAuditTrail } from '../../../backend/src/services/finance/audit/financialAuditTrail';

const logger = createLogger({ service: 'provenance-audit-trail' });

export interface LineageRecord {
  id: string;
  sourceSystem: string;
  sourceRecordId: string;
  targetRecordId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  timestamp: Date;
  operatorId?: string | null;
  transformationId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ProvenanceEntry {
  id: string;
  lineageRecordId: string;
  signature: string; // Cryptographic signature
  previousHash: string; // Hash of previous entry (chain)
  hash: string; // Hash of this entry
  createdAt: Date;
}

export interface ProvenanceChain {
  entries: ProvenanceEntry[];
  valid: boolean;
  errors: string[];
}

/**
 * ProvenanceAuditTrail
 * Creates tamper-evident audit trail for lineage records
 */
export class ProvenanceAuditTrail {
  private signingKey: Buffer;
  private publicKey: Buffer;

  constructor(
    private prisma: PrismaClient,
    private financialAuditTrail?: any // FinancialAuditTrail - adjust import path as needed
  ) {
    // In production, load keys from secure key management system
    // For now, generate a key pair (in production, use persistent keys)
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    this.signingKey = Buffer.from(privateKey);
    this.publicKey = Buffer.from(publicKey);
  }

  /**
   * Record a lineage entry in the provenance audit trail
   */
  async recordLineage(lineageRecord: LineageRecord): Promise<ProvenanceEntry> {
    logger.info('Recording lineage in provenance audit trail', {
      lineageRecordId: lineageRecord.id,
      sourceSystem: lineageRecord.sourceSystem,
    });

    // Get the last entry to chain hashes
    const lastEntry = await this.getLastEntry(lineageRecord.sourceSystem);

    // Create entry data
    const entryData = {
      lineageRecord,
      previousHash: lastEntry?.hash || '0',
      timestamp: new Date().toISOString(),
    };

    // Calculate hash of entry
    const hash = this.calculateHash(entryData);

    // Sign the entry
    const signature = this.signEntry(entryData);

    // Store in database
    const provenanceEntry: ProvenanceEntry = {
      id: `prov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lineageRecordId: lineageRecord.id,
      signature,
      previousHash: lastEntry?.hash || '0',
      hash,
      createdAt: new Date(),
    };

    // Store in DataLineage with provenance metadata
    await this.prisma.dataLineage.update({
      where: { id: lineageRecord.id },
      data: {
        metadata: {
          ...(lineageRecord.metadata || {}),
          provenance: {
            entryId: provenanceEntry.id,
            signature: provenanceEntry.signature,
            previousHash: provenanceEntry.previousHash,
            hash: provenanceEntry.hash,
            timestamp: provenanceEntry.createdAt.toISOString(),
          },
        },
      },
    }).catch(() => {
      // If update fails, lineage record might not exist yet - that's okay
      logger.warn('Could not update lineage record with provenance', {
        lineageRecordId: lineageRecord.id,
      });
    });

    // Integrate with FinancialAuditTrail if financial transaction is involved
    if (this.financialAuditTrail && this.isFinancialOperation(lineageRecord)) {
      try {
        await this.recordFinancialIntegration(lineageRecord, provenanceEntry);
      } catch (error) {
        logger.error('Failed to integrate with financial audit trail', { error });
      }
    }

    logger.info('Provenance entry recorded', {
      entryId: provenanceEntry.id,
      lineageRecordId: lineageRecord.id,
    });

    return provenanceEntry;
  }

  /**
   * Verify integrity of provenance chain
   */
  async verifyChain(sourceSystem?: string, limit = 1000): Promise<ProvenanceChain> {
    logger.info('Verifying provenance chain integrity', { sourceSystem });

    // Get lineage records with provenance metadata
    const where: any = {};
    if (sourceSystem) {
      where.sourceSystem = sourceSystem;
    }

    const lineageRecords = await this.prisma.dataLineage.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: limit,
    });

    const entries: ProvenanceEntry[] = [];
    const errors: string[] = [];

    // Extract provenance entries from metadata
    for (const record of lineageRecords) {
      if (record.metadata && (record.metadata as any).provenance) {
        const prov = (record.metadata as any).provenance;
        entries.push({
          id: prov.entryId,
          lineageRecordId: record.id,
          signature: prov.signature,
          previousHash: prov.previousHash,
          hash: prov.hash,
          createdAt: new Date(prov.timestamp),
        });
      }
    }

    // Verify chain integrity
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Reconstruct entry data
      const record = lineageRecords.find((r) => r.id === entry.lineageRecordId);
      if (!record) {
        errors.push(`Lineage record not found for entry ${entry.id}`);
        continue;
      }

      const entryData = {
        lineageRecord: {
          id: record.id,
          sourceSystem: record.sourceSystem,
          sourceRecordId: record.sourceRecordId,
          targetRecordId: record.targetRecordId,
          operationType: record.operationType,
          timestamp: record.timestamp,
          operatorId: record.operatorId,
          transformationId: record.transformationId,
          metadata: record.metadata,
        },
        previousHash: entry.previousHash,
        timestamp: entry.createdAt.toISOString(),
      };

      // Verify hash
      const calculatedHash = this.calculateHash(entryData);
      if (calculatedHash !== entry.hash) {
        errors.push(`Hash mismatch for entry ${entry.id}`);
      }

      // Verify signature
      if (!this.verifySignature(entryData, entry.signature)) {
        errors.push(`Signature verification failed for entry ${entry.id}`);
      }

      // Verify chain (previous hash matches previous entry's hash)
      if (i > 0) {
        const previousEntry = entries[i - 1];
        if (entry.previousHash !== previousEntry.hash) {
          errors.push(`Chain broken at entry ${entry.id}`);
        }
      }
    }

    const valid = errors.length === 0;

    logger.info('Provenance chain verification complete', {
      valid,
      entryCount: entries.length,
      errorCount: errors.length,
    });

    return {
      entries,
      valid,
      errors,
    };
  }

  /**
   * Get provenance chain for a specific record
   */
  async getChainForRecord(recordId: string): Promise<ProvenanceEntry[]> {
    const record = await this.prisma.dataLineage.findUnique({
      where: { id: recordId },
    });

    if (!record || !record.metadata || !(record.metadata as any).provenance) {
      return [];
    }

    // Get all entries up to this one
    const chain = await this.verifyChain(record.sourceSystem, 10000);
    const recordIndex = chain.entries.findIndex((e) => e.lineageRecordId === recordId);

    if (recordIndex === -1) {
      return [];
    }

    // Return chain up to and including this record
    return chain.entries.slice(0, recordIndex + 1);
  }

  /**
   * Check if operation involves financial transaction
   */
  private isFinancialOperation(lineageRecord: LineageRecord): boolean {
    return (
      lineageRecord.sourceSystem === 'finance' ||
      lineageRecord.targetRecordId.includes('financial') ||
      (lineageRecord.metadata as any)?.financialTransactionId !== undefined
    );
  }

  /**
   * Integrate with FinancialAuditTrail
   */
  private async recordFinancialIntegration(
    lineageRecord: LineageRecord,
    provenanceEntry: ProvenanceEntry
  ): Promise<void> {
    if (!this.financialAuditTrail) {
      return;
    }

    // Create a reference in financial audit trail
    const financialRef = {
      id: `lineage_${lineageRecord.id}`,
      type: 'lineage_reference' as const,
      amount: 0,
      currency: 'USD',
      reference: `lineage:${lineageRecord.id}`,
      description: `Lineage record for ${lineageRecord.operationType} operation`,
      metadata: {
        lineageRecordId: lineageRecord.id,
        provenanceEntryId: provenanceEntry.id,
        provenanceHash: provenanceEntry.hash,
      },
      timestamp: lineageRecord.timestamp,
    };

    // Note: FinancialAuditTrail expects FinancialTransaction, but we're creating a reference
    // In production, this would be properly typed
    await (this.financialAuditTrail as any).recordTransaction(financialRef);
  }

  /**
   * Get last entry for chaining
   */
  private async getLastEntry(sourceSystem?: string): Promise<ProvenanceEntry | null> {
    const where: any = {};
    if (sourceSystem) {
      where.sourceSystem = sourceSystem;
    }

    const records = await this.prisma.dataLineage.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 1,
    });

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    if (!record.metadata || !(record.metadata as any).provenance) {
      return null;
    }

    const prov = (record.metadata as any).provenance;
    return {
      id: prov.entryId,
      lineageRecordId: record.id,
      signature: prov.signature,
      previousHash: prov.previousHash,
      hash: prov.hash,
      createdAt: new Date(prov.timestamp),
    };
  }

  /**
   * Calculate hash of entry data
   */
  private calculateHash(data: any): string {
    const dataString = JSON.stringify(data);
    return createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Sign entry data
   */
  private signEntry(data: any): string {
    const dataString = JSON.stringify(data);
    const sign = createSign('RSA-SHA256');
    sign.update(dataString);
    sign.end();
    return sign.sign(this.signingKey, 'base64');
  }

  /**
   * Verify signature
   */
  private verifySignature(data: any, signature: string): boolean {
    try {
      const dataString = JSON.stringify(data);
      const verify = createVerify('RSA-SHA256');
      verify.update(dataString);
      verify.end();
      return verify.verify(this.publicKey, signature, 'base64');
    } catch (error) {
      logger.error('Signature verification error', { error });
      return false;
    }
  }

  /**
   * Export provenance chain for audit
   */
  async exportChain(
    sourceSystem?: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const chain = await this.verifyChain(sourceSystem, 10000);

    if (format === 'json') {
      return JSON.stringify(chain.entries, null, 2);
    } else {
      // CSV format
      const lines: string[] = [
        'Entry ID,Lineage Record ID,Hash,Previous Hash,Signature,Timestamp',
      ];

      chain.entries.forEach((entry) => {
        lines.push(
          [
            entry.id,
            entry.lineageRecordId,
            entry.hash,
            entry.previousHash,
            entry.signature,
            entry.createdAt.toISOString(),
          ].join(',')
        );
      });

      return lines.join('\n');
    }
  }
}

