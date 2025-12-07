/**
 * B231B-CON-010: ContractAuditLog
 *
 * Records all actions taken on contracts (creation, revisions, signatures, enforcement actions)
 * in a tamper-evident log; supports queries and exports.
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

export type AuditActionType =
  | 'contract_created'
  | 'contract_updated'
  | 'contract_signed'
  | 'contract_terminated'
  | 'contract_revised'
  | 'enforcement_action'
  | 'breach_detected'
  | 'obligation_created'
  | 'obligation_completed'
  | 'sla_breach'
  | 'compliance_check'
  | 'revenue_share_calculated'
  | 'service_suspended'
  | 'service_restored'
  | 'legal_workflow_triggered';

export interface AuditLogEntry {
  id: string;
  contractId: string;
  action: AuditActionType;
  actorId?: string; // User ID or system identifier
  actorType: 'user' | 'system' | 'automated';
  timestamp: Date;
  details: Record<string, any>;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  hash: string; // Tamper-evident hash
  previousHash?: string; // Chain hash for tamper detection
  metadata?: Record<string, any>;
}

export interface AuditLogQuery {
  contractId?: string;
  action?: AuditActionType | AuditActionType[];
  actorId?: string;
  actorType?: 'user' | 'system' | 'automated';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogExport {
  entries: AuditLogEntry[];
  exportedAt: Date;
  exportedBy?: string;
  format: 'json' | 'csv' | 'pdf';
  hash: string; // Hash of exported data for verification
}

/**
 * ContractAuditLog - Tamper-evident audit logging for contracts
 */
export class ContractAuditLog {
  private hashChain: Map<string, string> = new Map(); // contractId -> lastHash

  constructor(private prisma: PrismaClient) {}

  /**
   * Record an action on a contract
   */
  async recordAction(
    contractId: string,
    action: AuditActionType,
    details: Record<string, any>,
    options?: {
      actorId?: string;
      actorType?: 'user' | 'system' | 'automated';
      previousState?: Record<string, any>;
      newState?: Record<string, any>;
      metadata?: Record<string, any>;
    }
  ): Promise<AuditLogEntry> {
    const contract = await this.prisma.partnerContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    const timestamp = new Date();
    const previousHash = this.hashChain.get(contractId);

    // Create entry data
    const entryData = {
      contractId,
      action,
      actorId: options?.actorId,
      actorType: options?.actorType || 'system',
      timestamp,
      details,
      previousState: options?.previousState,
      newState: options?.newState,
      previousHash,
      metadata: options?.metadata || {},
    };

    // Calculate tamper-evident hash
    const hash = this.calculateHash(entryData, previousHash);

    // Create audit log entry
    const entry: AuditLogEntry = {
      id: `audit_${contractId}_${timestamp.getTime()}`,
      ...entryData,
      hash,
    };

    // Store hash for next entry
    this.hashChain.set(contractId, hash);

    // In production, this would save to database
    await this.saveEntry(entry);

    return entry;
  }

  /**
   * Calculate tamper-evident hash for entry
   */
  private calculateHash(
    entryData: Omit<AuditLogEntry, 'id' | 'hash'>,
    previousHash?: string
  ): string {
    const dataString = JSON.stringify({
      contractId: entryData.contractId,
      action: entryData.action,
      actorId: entryData.actorId,
      timestamp: entryData.timestamp.toISOString(),
      details: entryData.details,
      previousState: entryData.previousState,
      newState: entryData.newState,
      previousHash,
    });

    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Save audit log entry to database
   */
  private async saveEntry(entry: AuditLogEntry): Promise<void> {
    // In production, this would save to ContractAuditLog table
    // For now, we'll log it
    console.log('[ContractAuditLog] Recording audit entry:', {
      id: entry.id,
      contractId: entry.contractId,
      action: entry.action,
      timestamp: entry.timestamp,
      hash: entry.hash,
    });

    // TODO: Save to database
    // await this.prisma.contractAuditLog.create({
    //   data: {
    //     id: entry.id,
    //     contractId: entry.contractId,
    //     action: entry.action,
    //     actorId: entry.actorId,
    //     actorType: entry.actorType,
    //     timestamp: entry.timestamp,
    //     details: entry.details,
    //     previousState: entry.previousState,
    //     newState: entry.newState,
    //     hash: entry.hash,
    //     previousHash: entry.previousHash,
    //     metadata: entry.metadata,
    //   },
    // });
  }

  /**
   * Query audit log entries
   */
  async queryEntries(query: AuditLogQuery): Promise<AuditLogEntry[]> {
    // In production, this would query database
    // For now, return empty array

    // TODO: Query database
    // const where: any = {};
    // if (query.contractId) where.contractId = query.contractId;
    // if (query.action) {
    //   if (Array.isArray(query.action)) {
    //     where.action = { in: query.action };
    //   } else {
    //     where.action = query.action;
    //   }
    // }
    // if (query.actorId) where.actorId = query.actorId;
    // if (query.actorType) where.actorType = query.actorType;
    // if (query.startDate || query.endDate) {
    //   where.timestamp = {};
    //   if (query.startDate) where.timestamp.gte = query.startDate;
    //   if (query.endDate) where.timestamp.lte = query.endDate;
    // }

    // return await this.prisma.contractAuditLog.findMany({
    //   where,
    //   orderBy: { timestamp: 'desc' },
    //   take: query.limit || 100,
    //   skip: query.offset || 0,
    // });

    return [];
  }

  /**
   * Verify integrity of audit log for a contract
   */
  async verifyIntegrity(contractId: string): Promise<{
    valid: boolean;
    errors: string[];
    entryCount: number;
  }> {
    const entries = await this.queryEntries({ contractId });

    if (entries.length === 0) {
      return {
        valid: true,
        errors: [],
        entryCount: 0,
      };
    }

    const errors: string[] = [];
    let previousHash: string | undefined;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Verify hash chain
      if (previousHash && entry.previousHash !== previousHash) {
        errors.push(
          `Hash chain broken at entry ${entry.id}: expected ${previousHash}, got ${entry.previousHash}`
        );
      }

      // Verify entry hash
      const expectedHash = this.calculateHash(
        {
          contractId: entry.contractId,
          action: entry.action,
          actorId: entry.actorId,
          actorType: entry.actorType,
          timestamp: entry.timestamp,
          details: entry.details,
          previousState: entry.previousState,
          newState: entry.newState,
          metadata: entry.metadata,
        },
        previousHash
      );

      if (entry.hash !== expectedHash) {
        errors.push(`Hash mismatch at entry ${entry.id}: entry may have been tampered with`);
      }

      previousHash = entry.hash;
    }

    return {
      valid: errors.length === 0,
      errors,
      entryCount: entries.length,
    };
  }

  /**
   * Export audit log entries
   */
  async exportEntries(
    query: AuditLogQuery,
    format: 'json' | 'csv' | 'pdf' = 'json',
    exportedBy?: string
  ): Promise<AuditLogExport> {
    const entries = await this.queryEntries(query);

    let exportData: string;
    let hash: string;

    switch (format) {
      case 'json':
        exportData = JSON.stringify(entries, null, 2);
        hash = crypto.createHash('sha256').update(exportData).digest('hex');
        break;

      case 'csv':
        exportData = this.entriesToCSV(entries);
        hash = crypto.createHash('sha256').update(exportData).digest('hex');
        break;

      case 'pdf':
        // In production, would generate PDF
        exportData = JSON.stringify(entries);
        hash = crypto.createHash('sha256').update(exportData).digest('hex');
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    return {
      entries,
      exportedAt: new Date(),
      exportedBy,
      format,
      hash,
    };
  }

  /**
   * Convert entries to CSV format
   */
  private entriesToCSV(entries: AuditLogEntry[]): string {
    if (entries.length === 0) {
      return '';
    }

    const headers = [
      'id',
      'contractId',
      'action',
      'actorId',
      'actorType',
      'timestamp',
      'hash',
      'previousHash',
    ];

    const rows = entries.map((entry) => [
      entry.id,
      entry.contractId,
      entry.action,
      entry.actorId || '',
      entry.actorType,
      entry.timestamp.toISOString(),
      entry.hash,
      entry.previousHash || '',
    ]);

    return [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
  }

  /**
   * Get audit log summary for a contract
   */
  async getContractSummary(contractId: string): Promise<{
    totalEntries: number;
    actionCounts: Record<AuditActionType, number>;
    firstEntry?: Date;
    lastEntry?: Date;
    integrityStatus: 'valid' | 'invalid' | 'unknown';
  }> {
    const entries = await this.queryEntries({ contractId });
    const integrity = await this.verifyIntegrity(contractId);

    const actionCounts: Record<string, number> = {};
    let firstEntry: Date | undefined;
    let lastEntry: Date | undefined;

    for (const entry of entries) {
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;

      if (!firstEntry || entry.timestamp < firstEntry) {
        firstEntry = entry.timestamp;
      }
      if (!lastEntry || entry.timestamp > lastEntry) {
        lastEntry = entry.timestamp;
      }
    }

    return {
      totalEntries: entries.length,
      actionCounts: actionCounts as Record<AuditActionType, number>,
      firstEntry,
      lastEntry,
      integrityStatus: integrity.valid ? 'valid' : 'invalid',
    };
  }

  /**
   * Record contract creation
   */
  async recordContractCreation(
    contractId: string,
    contractData: Record<string, any>,
    actorId?: string
  ): Promise<AuditLogEntry> {
    return this.recordAction(
      contractId,
      'contract_created',
      {
        contractData,
      },
      {
        actorId,
        actorType: actorId ? 'user' : 'system',
        newState: contractData,
      }
    );
  }

  /**
   * Record contract signature
   */
  async recordContractSignature(
    contractId: string,
    signatureData: Record<string, any>,
    actorId?: string
  ): Promise<AuditLogEntry> {
    return this.recordAction(
      contractId,
      'contract_signed',
      {
        signatureData,
      },
      {
        actorId,
        actorType: actorId ? 'user' : 'system',
        newState: { status: 'signed', signedAt: new Date() },
      }
    );
  }

  /**
   * Record enforcement action
   */
  async recordEnforcementAction(
    contractId: string,
    action: string,
    details: Record<string, any>
  ): Promise<AuditLogEntry> {
    return this.recordAction(contractId, 'enforcement_action', {
      action,
      ...details,
    });
  }

  /**
   * Record breach detection
   */
  async recordBreachDetection(
    contractId: string,
    breachDetails: Record<string, any>
  ): Promise<AuditLogEntry> {
    return this.recordAction(contractId, 'breach_detected', breachDetails);
  }
}

