/**
 * B248A-PARTNER-009: PartnerAuditLogService
 *
 * Logs changes to partner profiles, contact persons, agreements; defines model with id,
 * entityType, entityId, action (create/update/delete), userId, timestamp, changes (JSON);
 * ensures log persists for compliance; tests verify logging behaviour
 */

import { PrismaClient, AuditAction } from '@prisma/client';

export interface AuditLogEntry {
  entityType: 'PartnerProfile' | 'ContactPerson' | 'PartnershipAgreement';
  entityId: string;
  partnerId?: string;
  action: AuditAction;
  userId?: string;
  changes?: Record<string, any>;
}

export class PartnerAuditLogService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log an audit event
   */
  async logEvent(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.partnerAuditLog.create({
        data: {
          entityType: entry.entityType,
          entityId: entry.entityId,
          partnerId: entry.partnerId ?? null,
          action: entry.action,
          userId: entry.userId ?? null,
          changes: entry.changes ?? null,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      // Log error but don't throw - audit logging should not break main flow
      console.error('Failed to log audit event:', error);
    }
  }

  /**
   * Log partner profile creation
   */
  async logPartnerProfileCreated(
    partnerId: string,
    data: Record<string, any>,
    userId?: string
  ): Promise<void> {
    await this.logEvent({
      entityType: 'PartnerProfile',
      entityId: partnerId,
      partnerId,
      action: AuditAction.create,
      userId,
      changes: { created: data },
    });
  }

  /**
   * Log partner profile update
   */
  async logPartnerProfileUpdated(
    partnerId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    userId?: string
  ): Promise<void> {
    const changes = this.computeChanges(oldData, newData);
    await this.logEvent({
      entityType: 'PartnerProfile',
      entityId: partnerId,
      partnerId,
      action: AuditAction.update,
      userId,
      changes,
    });
  }

  /**
   * Log contact person creation
   */
  async logContactPersonCreated(
    contactPersonId: string,
    partnerId: string,
    data: Record<string, any>,
    userId?: string
  ): Promise<void> {
    await this.logEvent({
      entityType: 'ContactPerson',
      entityId: contactPersonId,
      partnerId,
      action: AuditAction.create,
      userId,
      changes: { created: data },
    });
  }

  /**
   * Log contact person update
   */
  async logContactPersonUpdated(
    contactPersonId: string,
    partnerId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    userId?: string
  ): Promise<void> {
    const changes = this.computeChanges(oldData, newData);
    await this.logEvent({
      entityType: 'ContactPerson',
      entityId: contactPersonId,
      partnerId,
      action: AuditAction.update,
      userId,
      changes,
    });
  }

  /**
   * Log agreement creation
   */
  async logAgreementCreated(
    agreementId: string,
    partnerId: string,
    data: Record<string, any>,
    userId?: string
  ): Promise<void> {
    await this.logEvent({
      entityType: 'PartnershipAgreement',
      entityId: agreementId,
      partnerId,
      action: AuditAction.create,
      userId,
      changes: { created: data },
    });
  }

  /**
   * Log agreement update
   */
  async logAgreementUpdated(
    agreementId: string,
    partnerId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    userId?: string
  ): Promise<void> {
    const changes = this.computeChanges(oldData, newData);
    await this.logEvent({
      entityType: 'PartnershipAgreement',
      entityId: agreementId,
      partnerId,
      action: AuditAction.update,
      userId,
      changes,
    });
  }

  /**
   * Log entity deletion
   */
  async logEntityDeleted(
    entityType: 'PartnerProfile' | 'ContactPerson' | 'PartnershipAgreement',
    entityId: string,
    partnerId: string | undefined,
    userId?: string
  ): Promise<void> {
    await this.logEvent({
      entityType,
      entityId,
      partnerId,
      action: AuditAction.delete,
      userId,
    });
  }

  /**
   * Get audit logs for an entity
   */
  async getAuditLogs(
    entityType: string,
    entityId: string
  ): Promise<Array<{
    id: string;
    action: AuditAction;
    userId: string | null;
    changes: any;
    timestamp: Date;
  }>> {
    return this.prisma.partnerAuditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        action: true,
        userId: true,
        changes: true,
        timestamp: true,
      },
    });
  }

  /**
   * Get audit logs for a partner
   */
  async getPartnerAuditLogs(partnerId: string): Promise<Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: AuditAction;
    userId: string | null;
    timestamp: Date;
  }>> {
    return this.prisma.partnerAuditLog.findMany({
      where: { partnerId },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        action: true,
        userId: true,
        timestamp: true,
      },
    });
  }

  /**
   * Compute changes between old and new data
   */
  private computeChanges(
    oldData: Record<string, any>,
    newData: Record<string, any>
  ): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    for (const key of allKeys) {
      const oldValue = oldData[key];
      const newValue = newData[key];
      if (oldValue !== newValue) {
        changes[key] = { from: oldValue, to: newValue };
      }
    }

    return changes;
  }
}

