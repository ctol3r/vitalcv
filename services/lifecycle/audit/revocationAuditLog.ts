/**
 * B238B-LIFE-018: RevocationAuditLog
 *
 * Logs all revocation actions with metadata (initiator, reason, effective date,
 * affected parties); supports queries for compliance and disputes.
 */

import { PrismaClient } from '@prisma/client';
import { RevocationReason, RevocationReasonData } from '../models/RevocationReason.js';
import { getServiceLogger } from '../../logging/serviceLogger';

const log = getServiceLogger('lifecycle/audit/revocation');

/**
 * Input for logging a revocation action
 */
export interface RevocationAuditLogInput {
  credentialId: string;
  reason: RevocationReason;
  reasonDetails?: string;
  initiatedBy: string;
  effectiveDate: Date;
  affectedParties?: string[]; // User IDs or email addresses
  orgId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Revocation audit log entry
 */
export interface RevocationAuditLogEntry {
  id: string;
  credentialId: string;
  reason: RevocationReason;
  reasonDetails?: string;
  initiatedBy: string;
  effectiveDate: Date;
  affectedParties: string[];
  orgId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * RevocationAuditLogService handles logging and querying revocation actions
 */
export class RevocationAuditLogService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log a revocation action
   */
  async logRevocation(input: RevocationAuditLogInput): Promise<RevocationAuditLogEntry> {
    const auditEntry = await this.prisma.revocationAuditLog.create({
      data: {
        credentialId: input.credentialId,
        reason: input.reason,
        reasonDetails: input.reasonDetails || null,
        initiatedBy: input.initiatedBy,
        effectiveDate: input.effectiveDate,
        affectedParties: input.affectedParties || [],
        orgId: input.orgId || null,
        metadata: input.metadata || {},
      },
    });

    log.info('Revocation logged', {
      auditId: auditEntry.id,
      credentialId: input.credentialId,
      reason: input.reason,
      initiatedBy: input.initiatedBy,
    });

    return {
      id: auditEntry.id,
      credentialId: auditEntry.credentialId,
      reason: auditEntry.reason as RevocationReason,
      reasonDetails: auditEntry.reasonDetails || undefined,
      initiatedBy: auditEntry.initiatedBy,
      effectiveDate: auditEntry.effectiveDate,
      affectedParties: auditEntry.affectedParties,
      orgId: auditEntry.orgId || undefined,
      metadata: auditEntry.metadata as Record<string, unknown>,
      createdAt: auditEntry.createdAt,
    };
  }

  /**
   * Get revocation audit log for a credential
   */
  async getRevocationHistory(credentialId: string): Promise<RevocationAuditLogEntry[]> {
    const entries = await this.prisma.revocationAuditLog.findMany({
      where: { credentialId },
      orderBy: { createdAt: 'desc' },
    });

    return entries.map(entry => ({
      id: entry.id,
      credentialId: entry.credentialId,
      reason: entry.reason as RevocationReason,
      reasonDetails: entry.reasonDetails || undefined,
      initiatedBy: entry.initiatedBy,
      effectiveDate: entry.effectiveDate,
      affectedParties: entry.affectedParties,
      orgId: entry.orgId || undefined,
      metadata: entry.metadata as Record<string, unknown>,
      createdAt: entry.createdAt,
    }));
  }

  /**
   * Query revocations by reason
   */
  async queryByReason(
    reason: RevocationReason,
    options?: {
      orgId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<RevocationAuditLogEntry[]> {
    const where: any = {
      reason,
      ...(options?.orgId && { orgId: options.orgId }),
      ...(options?.startDate && { createdAt: { gte: options.startDate } }),
      ...(options?.endDate && { createdAt: { lte: options.endDate } }),
    };

    const entries = await this.prisma.revocationAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
    });

    return entries.map(entry => ({
      id: entry.id,
      credentialId: entry.credentialId,
      reason: entry.reason as RevocationReason,
      reasonDetails: entry.reasonDetails || undefined,
      initiatedBy: entry.initiatedBy,
      effectiveDate: entry.effectiveDate,
      affectedParties: entry.affectedParties,
      orgId: entry.orgId || undefined,
      metadata: entry.metadata as Record<string, unknown>,
      createdAt: entry.createdAt,
    }));
  }

  /**
   * Query revocations by initiator
   */
  async queryByInitiator(
    initiatedBy: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<RevocationAuditLogEntry[]> {
    const where: any = {
      initiatedBy,
      ...(options?.startDate && { createdAt: { gte: options.startDate } }),
      ...(options?.endDate && { createdAt: { lte: options.endDate } }),
    };

    const entries = await this.prisma.revocationAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
    });

    return entries.map(entry => ({
      id: entry.id,
      credentialId: entry.credentialId,
      reason: entry.reason as RevocationReason,
      reasonDetails: entry.reasonDetails || undefined,
      initiatedBy: entry.initiatedBy,
      effectiveDate: entry.effectiveDate,
      affectedParties: entry.affectedParties,
      orgId: entry.orgId || undefined,
      metadata: entry.metadata as Record<string, unknown>,
      createdAt: entry.createdAt,
    }));
  }

  /**
   * Get revocation statistics for compliance reporting
   */
  async getRevocationStats(options?: {
    orgId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    total: number;
    byReason: Record<string, number>;
    byInitiator: Record<string, number>;
    byMonth: Record<string, number>;
  }> {
    const where: any = {
      ...(options?.orgId && { orgId: options.orgId }),
      ...(options?.startDate && { createdAt: { gte: options.startDate } }),
      ...(options?.endDate && { createdAt: { lte: options.endDate } }),
    };

    const entries = await this.prisma.revocationAuditLog.findMany({
      where,
    });

    const byReason: Record<string, number> = {};
    const byInitiator: Record<string, number> = {};
    const byMonth: Record<string, number> = {};

    entries.forEach(entry => {
      // Count by reason
      const reason = entry.reason;
      byReason[reason] = (byReason[reason] || 0) + 1;

      // Count by initiator
      byInitiator[entry.initiatedBy] = (byInitiator[entry.initiatedBy] || 0) + 1;

      // Count by month
      const monthKey = entry.createdAt.toISOString().substring(0, 7); // YYYY-MM
      byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
    });

    return {
      total: entries.length,
      byReason,
      byInitiator,
      byMonth,
    };
  }
}

