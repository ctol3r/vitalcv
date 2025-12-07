/**
 * B225B-FIN-008: FinancialAuditTrail
 * Stores an immutable record of all financial transactions and adjustments
 * Supports audit queries; protected by cryptographic signatures
 */

import { PrismaClient } from '@prisma/client';
import { createHash, createSign, createVerify, generateKeyPairSync } from 'crypto';
import { promisify } from 'util';

const prisma = new PrismaClient();

export interface FinancialTransaction {
  id: string;
  type: 'revenue' | 'expense' | 'adjustment' | 'refund' | 'payout';
  amount: number; // in cents
  currency: string;
  orgId?: string;
  reference: string; // Reference to source transaction
  description: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface AuditTrailEntry {
  id: string;
  transaction: FinancialTransaction;
  signature: string; // Cryptographic signature
  previousHash: string; // Hash of previous entry (chain)
  hash: string; // Hash of this entry
  createdAt: Date;
}

export interface AuditQuery {
  orgId?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  reference?: string;
  limit?: number;
  offset?: number;
}

/**
 * FinancialAuditTrail service
 * Creates immutable audit trail with cryptographic signatures
 */
export class FinancialAuditTrail {
  private signingKey: Buffer;
  private publicKey: Buffer;

  constructor() {
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
   * Record a financial transaction in the audit trail
   */
  async recordTransaction(transaction: FinancialTransaction): Promise<AuditTrailEntry> {
    // Get the last entry to chain hashes
    const lastEntry = await this.getLastEntry(transaction.orgId);

    // Create entry data
    const entryData = {
      transaction,
      previousHash: lastEntry?.hash || '0',
      timestamp: new Date().toISOString(),
    };

    // Calculate hash of entry
    const hash = this.calculateHash(entryData);

    // Sign the entry
    const signature = this.signEntry(entryData);

    // Store in database (in production, use a dedicated audit trail table)
    // For now, we'll use a JSON structure stored in metadata
    const auditEntry: AuditTrailEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transaction,
      signature,
      previousHash: lastEntry?.hash || '0',
      hash,
      createdAt: new Date(),
    };

    // Store in VitaLedger with audit metadata
    await prisma.vitaLedger.create({
      data: {
        orgId: transaction.orgId,
        amount: transaction.amount,
        type: transaction.type,
        reference: transaction.reference,
        metadata: {
          auditTrail: {
            entryId: auditEntry.id,
            signature: auditEntry.signature,
            previousHash: auditEntry.previousHash,
            hash: auditEntry.hash,
            timestamp: auditEntry.createdAt.toISOString(),
          },
          transaction: {
            description: transaction.description,
            currency: transaction.currency,
            ...transaction.metadata,
          },
        },
      },
    });

    return auditEntry;
  }

  /**
   * Record an adjustment to a previous transaction
   */
  async recordAdjustment(
    originalTransactionId: string,
    adjustment: {
      amount: number;
      reason: string;
      adjustedBy: string;
      metadata?: Record<string, any>;
    }
  ): Promise<AuditTrailEntry> {
    // Get original transaction
    const original = await this.getTransactionById(originalTransactionId);
    if (!original) {
      throw new Error(`Original transaction not found: ${originalTransactionId}`);
    }

    // Create adjustment transaction
    const adjustmentTransaction: FinancialTransaction = {
      id: `adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'adjustment',
      amount: adjustment.amount,
      currency: original.transaction.currency,
      orgId: original.transaction.orgId,
      reference: `adjustment_${originalTransactionId}`,
      description: `Adjustment: ${adjustment.reason}`,
      metadata: {
        originalTransactionId,
        adjustedBy: adjustment.adjustedBy,
        ...adjustment.metadata,
      },
      timestamp: new Date(),
    };

    return this.recordTransaction(adjustmentTransaction);
  }

  /**
   * Query audit trail
   */
  async queryAuditTrail(query: AuditQuery): Promise<AuditTrailEntry[]> {
    // Query VitaLedger with audit trail metadata
    const where: any = {};

    if (query.orgId) {
      where.orgId = query.orgId;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.createdAt.lte = query.endDate;
      }
    }

    if (query.reference) {
      where.reference = { contains: query.reference };
    }

    const ledgerEntries = await prisma.vitaLedger.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: query.limit || 100,
      skip: query.offset || 0,
    });

    // Reconstruct audit trail entries from ledger entries
    const auditEntries: AuditTrailEntry[] = [];

    for (const entry of ledgerEntries) {
      if (entry.metadata && (entry.metadata as any).auditTrail) {
        const auditTrail = (entry.metadata as any).auditTrail;
        const transaction = (entry.metadata as any).transaction;

        auditEntries.push({
          id: auditTrail.entryId,
          transaction: {
            id: entry.id,
            type: entry.type as any,
            amount: entry.amount,
            currency: transaction?.currency || 'USD',
            orgId: entry.orgId || undefined,
            reference: entry.reference || '',
            description: transaction?.description || '',
            metadata: transaction,
            timestamp: entry.createdAt,
          },
          signature: auditTrail.signature,
          previousHash: auditTrail.previousHash,
          hash: auditTrail.hash,
          createdAt: entry.createdAt,
        });
      }
    }

    return auditEntries;
  }

  /**
   * Verify integrity of audit trail
   */
  async verifyIntegrity(orgId?: string): Promise<{
    valid: boolean;
    errors: string[];
    entryCount: number;
  }> {
    const entries = await this.queryAuditTrail({ orgId, limit: 10000 });
    const errors: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Verify hash
      const entryData = {
        transaction: entry.transaction,
        previousHash: entry.previousHash,
        timestamp: entry.createdAt.toISOString(),
      };
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

    return {
      valid: errors.length === 0,
      errors,
      entryCount: entries.length,
    };
  }

  /**
   * Get transaction by ID
   */
  private async getTransactionById(id: string): Promise<AuditTrailEntry | null> {
    const entries = await this.queryAuditTrail({ reference: id, limit: 1 });
    return entries.length > 0 ? entries[0] : null;
  }

  /**
   * Get last entry for chaining
   */
  private async getLastEntry(orgId?: string): Promise<AuditTrailEntry | null> {
    const entries = await this.queryAuditTrail({ orgId, limit: 1 });
    return entries.length > 0 ? entries[0] : null;
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
      return false;
    }
  }

  /**
   * Export audit trail for external audit
   */
  async exportAuditTrail(
    query: AuditQuery,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const entries = await this.queryAuditTrail(query);

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    } else {
      // CSV format
      const lines: string[] = [
        'Entry ID,Transaction ID,Type,Amount,Currency,Org ID,Reference,Description,Hash,Previous Hash,Signature,Timestamp',
      ];

      entries.forEach((entry) => {
        lines.push(
          [
            entry.id,
            entry.transaction.id,
            entry.transaction.type,
            entry.transaction.amount,
            entry.transaction.currency,
            entry.transaction.orgId || '',
            entry.transaction.reference,
            entry.transaction.description.replace(/,/g, ';'), // Escape commas
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

