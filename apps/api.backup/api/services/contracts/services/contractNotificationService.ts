/**
 * B251B-CON-019: ContractNotificationService
 *
 * Sends notifications to parties and admins for events (review, signature needed,
 * activation, change requests); uses existing Notification Service;
 * configurable templates.
 */

import { createNotification } from '../../notifications/notificationService.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const log = getServiceLogger('contracts/notifications');

export type NotificationEventType =
  | 'contract.created'
  | 'contract.under_review'
  | 'contract.activated'
  | 'contract.terminated'
  | 'contract.expired'
  | 'contract.draft'
  | 'contract.party_invited'
  | 'contract.signature_needed'
  | 'contract.signature_completed'
  | 'contract.change_request_created'
  | 'contract.change_request_approved'
  | 'contract.change_request_rejected'
  | 'contract.milestone_reminder'
  | 'contract.milestone_overdue'
  | 'contract.milestone_completed';

export interface NotificationPayload {
  contractId: string;
  contractTitle: string;
  [key: string]: any;
}

export class ContractNotificationService {
  /**
   * Send a notification
   */
  async sendNotification(
    recipientId: string,
    eventType: NotificationEventType,
    payload: NotificationPayload
  ): Promise<void> {
    log.info('Sending contract notification', {
      recipientId,
      eventType,
      contractId: payload.contractId,
    });

    try {
      await createNotification(recipientId, eventType, payload);
      log.info('Contract notification sent', {
        recipientId,
        eventType,
        contractId: payload.contractId,
      });
    } catch (error) {
      log.error('Failed to send contract notification', {
        recipientId,
        eventType,
        contractId: payload.contractId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - notification failure shouldn't break contract operations
    }
  }

  /**
   * Send notification to all parties of a contract
   */
  async notifyAllParties(
    contractId: string,
    eventType: NotificationEventType,
    payload: NotificationPayload
  ): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          parties: true,
        },
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      // Notify all parties
      for (const party of contract.parties) {
        if (party.contactEmail) {
          await this.sendNotification(
            party.contactEmail,
            eventType,
            payload
          );
        }
      }

      // Also notify contract author
      await this.sendNotification(contract.authorId, eventType, payload);
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Send signature needed notification
   */
  async notifySignatureNeeded(
    contractId: string,
    partyId: string,
    partyEmail: string
  ): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { id: true, title: true },
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      await this.sendNotification(
        partyEmail,
        'contract.signature_needed',
        {
          contractId,
          contractTitle: contract.title,
          partyId,
        }
      );
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Send change request notification
   */
  async notifyChangeRequest(
    contractId: string,
    changeRequestId: string,
    action: 'created' | 'approved' | 'rejected',
    recipientId: string
  ): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { id: true, title: true },
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      const eventType =
        action === 'created'
          ? 'contract.change_request_created'
          : action === 'approved'
          ? 'contract.change_request_approved'
          : 'contract.change_request_rejected';

      await this.sendNotification(recipientId, eventType, {
        contractId,
        contractTitle: contract.title,
        changeRequestId,
        action,
      });
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Export singleton instance
export const contractNotificationService = new ContractNotificationService();

