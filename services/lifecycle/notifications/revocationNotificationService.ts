/**
 * B238B-LIFE-014: RevocationNotificationService
 *
 * Sends notifications to affected parties when credentials are revoked or suspended;
 * includes reason and effective date; supports appeals link.
 */

import { PrismaClient } from '@prisma/client';
import { createNotification } from '../../notifications/notificationService.js';
import { RevocationReason, getRevocationReasonLabel } from '../models/RevocationReason.js';
import { getServiceLogger } from '../../logging/serviceLogger';

const log = getServiceLogger('lifecycle/notifications/revocation');

/**
 * Input for sending revocation notification
 */
export interface RevocationNotificationInput {
  credentialId: string;
  credentialType?: string;
  reason: RevocationReason;
  reasonDetails?: string;
  effectiveDate: Date;
  affectedParties: string[]; // User IDs
  orgId?: string;
  appealsLink?: string;
  metadata?: Record<string, unknown>;
}

/**
 * RevocationNotificationService handles sending notifications for revocations
 */
export class RevocationNotificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Send revocation notifications to affected parties
   */
  async sendRevocationNotification(input: RevocationNotificationInput): Promise<void> {
    const { credentialId, reason, reasonDetails, effectiveDate, affectedParties, appealsLink, orgId } = input;

    const reasonLabel = getRevocationReasonLabel(reason);
    const notificationMessage = this.buildNotificationMessage({
      credentialId,
      credentialType: input.credentialType,
      reason: reasonLabel,
      reasonDetails,
      effectiveDate,
      appealsLink,
    });

    // Send notification to each affected party
    const notificationPromises = affectedParties.map(async (userId) => {
      try {
        await createNotification(
          userId,
          'credential_revoked',
          {
            credentialId,
            credentialType: input.credentialType,
            reason,
            reasonLabel,
            reasonDetails,
            effectiveDate: effectiveDate.toISOString(),
            appealsLink,
            orgId,
            ...input.metadata,
          }
        );

        log.info('Revocation notification sent', {
          userId,
          credentialId,
          reason,
        });
      } catch (error) {
        log.error('Failed to send revocation notification', {
          userId,
          credentialId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.allSettled(notificationPromises);

    // Also notify organization admins if orgId is provided
    if (orgId) {
      try {
        const orgAdmins = await this.prisma.user.findMany({
          where: {
            orgId,
            roles: { has: 'ADMIN' },
          },
        });

        const adminNotificationPromises = orgAdmins.map(async (admin) => {
          await createNotification(
            admin.id,
            'credential_revoked_admin',
            {
              credentialId,
              credentialType: input.credentialType,
              reason,
              reasonLabel,
              reasonDetails,
              effectiveDate: effectiveDate.toISOString(),
              affectedParties,
              orgId,
              ...input.metadata,
            }
          );
        });

        await Promise.allSettled(adminNotificationPromises);
      } catch (error) {
        log.error('Failed to notify org admins', {
          orgId,
          credentialId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Send suspension notification (similar to revocation but different type)
   */
  async sendSuspensionNotification(input: RevocationNotificationInput): Promise<void> {
    const { credentialId, reason, reasonDetails, effectiveDate, affectedParties, appealsLink, orgId } = input;

    const reasonLabel = getRevocationReasonLabel(reason);
    const notificationMessage = this.buildNotificationMessage({
      credentialId,
      credentialType: input.credentialType,
      reason: reasonLabel,
      reasonDetails,
      effectiveDate,
      appealsLink,
      isSuspension: true,
    });

    const notificationPromises = affectedParties.map(async (userId) => {
      try {
        await createNotification(
          userId,
          'credential_suspended',
          {
            credentialId,
            credentialType: input.credentialType,
            reason,
            reasonLabel,
            reasonDetails,
            effectiveDate: effectiveDate.toISOString(),
            appealsLink,
            orgId,
            ...input.metadata,
          }
        );
      } catch (error) {
        log.error('Failed to send suspension notification', {
          userId,
          credentialId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.allSettled(notificationPromises);
  }

  /**
   * Build notification message
   */
  private buildNotificationMessage(options: {
    credentialId: string;
    credentialType?: string;
    reason: string;
    reasonDetails?: string;
    effectiveDate: Date;
    appealsLink?: string;
    isSuspension?: boolean;
  }): string {
    const action = options.isSuspension ? 'suspended' : 'revoked';
    const credentialTypeText = options.credentialType ? ` ${options.credentialType}` : '';

    let message = `Your${credentialTypeText} credential (${options.credentialId}) has been ${action}.`;
    message += `\n\nReason: ${options.reason}`;

    if (options.reasonDetails) {
      message += `\nDetails: ${options.reasonDetails}`;
    }

    message += `\nEffective Date: ${options.effectiveDate.toLocaleDateString()}`;

    if (options.appealsLink) {
      message += `\n\nYou may appeal this decision: ${options.appealsLink}`;
    }

    return message;
  }
}

