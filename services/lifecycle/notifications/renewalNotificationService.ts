/**
 * B238A-LIFE-006: RenewalNotificationService
 *
 * Sends reminders to credential owners and admins ahead of expiry and renewal deadlines.
 * Respects notification preferences and supports email/in-app channels.
 */

import { PrismaClient } from '@prisma/client';
import { ExpirationCheckResult } from '../schedulers/expirationScheduler.js';

export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  daysBeforeExpiry: number[]; // e.g., [30, 14, 7, 1] for notifications at these intervals
}

export interface NotificationChannel {
  type: 'email' | 'inApp';
  send: (recipient: string, subject: string, message: string, metadata?: any) => Promise<void>;
}

export interface RenewalNotificationConfig {
  defaultPreferences?: NotificationPreferences;
  channels?: NotificationChannel[];
}

export class RenewalNotificationService {
  private prisma: PrismaClient;
  private config: RenewalNotificationConfig;
  private defaultPreferences: NotificationPreferences;

  constructor(prisma: PrismaClient, config: RenewalNotificationConfig = {}) {
    this.prisma = prisma;
    this.config = config;
    this.defaultPreferences = config.defaultPreferences || {
      email: true,
      inApp: true,
      daysBeforeExpiry: [30, 14, 7, 1],
    };
  }

  /**
   * Send notification for expiring credential
   */
  async sendExpiryNotification(
    checkResult: ExpirationCheckResult,
    customMessage?: string
  ): Promise<void> {
    const credential = await this.prisma.credential.findUnique({
      where: { id: checkResult.credentialId },
      include: {
        user: true,
      },
    });

    if (!credential) {
      throw new Error(`Credential not found: ${checkResult.credentialId}`);
    }

    const preferences = await this.getNotificationPreferences(credential.userId);

    // Determine if we should send notification based on days until expiry
    const shouldNotify = this.shouldSendNotification(
      checkResult.daysUntilExpiry,
      preferences.daysBeforeExpiry
    );

    if (!shouldNotify) {
      return;
    }

    const subject = this.getNotificationSubject(checkResult);
    const message = customMessage || this.getNotificationMessage(checkResult);

    // Send via configured channels
    if (preferences.email && this.config.channels) {
      const emailChannel = this.config.channels.find((c) => c.type === 'email');
      if (emailChannel && credential.user.email) {
        await emailChannel.send(credential.user.email, subject, message, {
          credentialId: credential.id,
          credentialType: credential.type,
          daysUntilExpiry: checkResult.daysUntilExpiry,
        });
      }
    }

    if (preferences.inApp && this.config.channels) {
      const inAppChannel = this.config.channels.find((c) => c.type === 'inApp');
      if (inAppChannel) {
        await inAppChannel.send(credential.userId, subject, message, {
          credentialId: credential.id,
          credentialType: credential.type,
          daysUntilExpiry: checkResult.daysUntilExpiry,
        });
      }
    }

    // Log notification in database (if Notification model exists)
    await this.logNotification(credential.userId, credential.id, subject, message);
  }

  /**
   * Send batch notifications for multiple expiring credentials
   */
  async sendBatchExpiryNotifications(
    checkResults: ExpirationCheckResult[]
  ): Promise<{ sent: number; skipped: number }> {
    let sent = 0;
    let skipped = 0;

    for (const result of checkResults) {
      try {
        if (result.shouldNotify) {
          await this.sendExpiryNotification(result);
          sent++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Error sending notification for credential ${result.credentialId}:`, error);
        skipped++;
      }
    }

    return { sent, skipped };
  }

  /**
   * Send notification to admins about pending renewals
   */
  async notifyAdminsOfPendingRenewals(orgId?: string): Promise<void> {
    const renewalService = await import('../renewalService.js').then((m) => new m.RenewalService(this.prisma));
    const pendingRequests = await renewalService.getPendingRenewalRequests();

    if (pendingRequests.length === 0) {
      return;
    }

    const subject = `Pending Renewal Requests: ${pendingRequests.length}`;
    const message = this.formatPendingRenewalsMessage(pendingRequests);

    // Get admin users (this would need to be implemented based on your user model)
    // For now, we'll just log it
    console.log(`Admin notification: ${subject}\n${message}`);

    if (this.config.channels) {
      const emailChannel = this.config.channels.find((c) => c.type === 'email');
      if (emailChannel) {
        // In a real implementation, you'd get admin emails from the database
        // await emailChannel.send(adminEmail, subject, message);
      }
    }
  }

  /**
   * Get notification preferences for a user
   */
  private async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    // In a real implementation, you'd fetch this from a user preferences table
    // For now, return defaults
    return this.defaultPreferences;
  }

  /**
   * Determine if notification should be sent based on days until expiry
   */
  private shouldSendNotification(
    daysUntilExpiry: number,
    notificationDays: number[]
  ): boolean {
    // Send if we're within one of the notification intervals
    return notificationDays.some((day) => {
      return daysUntilExpiry <= day && daysUntilExpiry > day - 1;
    });
  }

  /**
   * Get notification subject
   */
  private getNotificationSubject(checkResult: ExpirationCheckResult): string {
    if (checkResult.isExpired) {
      return `URGENT: Your ${checkResult.credentialType} credential has expired`;
    } else if (checkResult.daysUntilExpiry <= 7) {
      return `Action Required: Your ${checkResult.credentialType} credential expires soon`;
    } else {
      return `Reminder: Your ${checkResult.credentialType} credential expires in ${checkResult.daysUntilExpiry} days`;
    }
  }

  /**
   * Get notification message
   */
  private getNotificationMessage(checkResult: ExpirationCheckResult): string {
    const credentialType = checkResult.credentialType;
    const days = checkResult.daysUntilExpiry;

    if (checkResult.isExpired) {
      return `Your ${credentialType} credential expired ${Math.abs(days)} day(s) ago. ` +
        `Please renew immediately to avoid service interruption.`;
    } else if (checkResult.isInGracePeriod) {
      return `Your ${credentialType} credential is in the grace period. ` +
        `It expired ${Math.abs(days)} day(s) ago. Please renew within the grace period.`;
    } else {
      return `Your ${credentialType} credential will expire in ${days} day(s). ` +
        `Please submit a renewal request to maintain your credential status.`;
    }
  }

  /**
   * Format message for pending renewals
   */
  private formatPendingRenewalsMessage(requests: any[]): string {
    let message = `There are ${requests.length} pending renewal requests:\n\n`;
    for (const request of requests.slice(0, 10)) {
      message += `- Credential ${request.credentialId} (${request.credential.type}) - ` +
        `Requested by ${request.requesterId} on ${request.submittedAt.toISOString()}\n`;
    }
    if (requests.length > 10) {
      message += `\n... and ${requests.length - 10} more`;
    }
    return message;
  }

  /**
   * Log notification in database
   */
  private async logNotification(
    userId: string,
    credentialId: string,
    subject: string,
    message: string
  ): Promise<void> {
    try {
      // Check if Notification model exists
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'credential_expiry',
          title: subject,
          message,
          metadata: {
            credentialId,
          } as any,
          read: false,
        },
      });
    } catch (error) {
      // Notification model might not exist, just log it
      console.log(`Notification logged: ${subject} for user ${userId}`);
    }
  }
}

