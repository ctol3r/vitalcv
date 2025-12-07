/**
 * BadgeNotificationsService
 * B247B-GAM-017: Sends notifications (in-app/email) to users upon earning badges; uses event bus to listen for badgeAwarded events; configurable notification templates; tested with mock channels
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { BadgeAwardedEvent } from './badgeAssignmentService';

export interface NotificationChannel {
  send(recipient: string, subject: string, message: string, metadata?: any): Promise<void>;
}

export interface NotificationTemplate {
  subject: string;
  body: string;
  inAppMessage?: string;
}

export class BadgeNotificationsService {
  private channels: Map<string, NotificationChannel> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private isListening: boolean = false;

  constructor(
    private prisma: PrismaClient,
    private eventBus: EventEmitter
  ) {
    this.setupDefaultTemplates();
  }

  /**
   * Start listening for badgeAwarded events
   */
  start(): void {
    if (this.isListening) {
      return;
    }

    this.eventBus.on('badgeAwarded', this.handleBadgeAwarded.bind(this));
    this.isListening = true;
  }

  /**
   * Stop listening for events
   */
  stop(): void {
    if (!this.isListening) {
      return;
    }

    this.eventBus.off('badgeAwarded', this.handleBadgeAwarded.bind(this));
    this.isListening = false;
  }

  /**
   * Register a notification channel
   */
  registerChannel(name: string, channel: NotificationChannel): void {
    this.channels.set(name, channel);
  }

  /**
   * Register a notification template
   */
  registerTemplate(badgeSlug: string, template: NotificationTemplate): void {
    this.templates.set(badgeSlug, template);
  }

  /**
   * Handle badgeAwarded event
   */
  private async handleBadgeAwarded(event: BadgeAwardedEvent): Promise<void> {
    try {
      // Get user email
      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        select: { email: true, name: true },
      });

      if (!user) {
        console.error(`[BadgeNotificationsService] User not found: ${event.userId}`);
        return;
      }

      // Get template (use default if not found)
      const template = this.templates.get(event.badgeSlug) || this.getDefaultTemplate(event);

      // Send notifications through all registered channels
      const notificationPromises: Promise<void>[] = [];

      // In-app notification
      if (template.inAppMessage) {
        notificationPromises.push(
          this.sendInAppNotification(event.userId, template.inAppMessage, {
            badgeId: event.badgeId,
            badgeName: event.badgeName,
            badgeSlug: event.badgeSlug,
          })
        );
      }

      // Email notification
      const emailChannel = this.channels.get('email');
      if (emailChannel) {
        notificationPromises.push(
          emailChannel.send(
            user.email,
            template.subject,
            template.body,
            {
              badgeId: event.badgeId,
              badgeName: event.badgeName,
              badgeSlug: event.badgeSlug,
              userName: user.name,
            }
          )
        );
      }

      // Other channels
      for (const [name, channel] of this.channels.entries()) {
        if (name !== 'email') {
          notificationPromises.push(
            channel.send(
              event.userId,
              template.subject,
              template.body,
              {
                badgeId: event.badgeId,
                badgeName: event.badgeName,
                badgeSlug: event.badgeSlug,
              }
            )
          );
        }
      }

      await Promise.allSettled(notificationPromises);
    } catch (error) {
      console.error('[BadgeNotificationsService] Error handling badgeAwarded event:', error);
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    userId: string,
    message: string,
    metadata: any
  ): Promise<void> {
    try {
      // Check if Notification model exists
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          type: 'badge_awarded',
          payload: {
            message,
            ...metadata,
          },
          read: false,
        },
      });

      console.log(`[BadgeNotificationsService] In-app notification created: ${notification.id}`);
    } catch (error: any) {
      // Notification model might not exist, log and continue
      console.warn('[BadgeNotificationsService] Could not create in-app notification:', error.message);
    }
  }

  /**
   * Get default notification template
   */
  private getDefaultTemplate(event: BadgeAwardedEvent): NotificationTemplate {
    return {
      subject: `🎉 You earned a badge: ${event.badgeName}!`,
      body: `Congratulations! You've earned the "${event.badgeName}" badge. Keep up the great work!`,
      inAppMessage: `You earned the "${event.badgeName}" badge! 🎉`,
    };
  }

  /**
   * Setup default notification templates
   */
  private setupDefaultTemplates(): void {
    // Example templates for common badge types
    this.registerTemplate('first_steps', {
      subject: '🎉 Welcome! You earned your first badge',
      body: 'Congratulations on taking your first steps! You\'ve earned the "First Steps" badge.',
      inAppMessage: 'You earned your first badge! 🎉',
    });

    this.registerTemplate('power_user', {
      subject: '🌟 You\'re a Power User!',
      body: 'Amazing work! You\'ve earned the "Power User" badge for your consistent engagement.',
      inAppMessage: 'You\'re now a Power User! 🌟',
    });

    this.registerTemplate('streak_master', {
      subject: '🔥 Streak Master!',
      body: 'Incredible! You\'ve maintained a streak and earned the "Streak Master" badge.',
      inAppMessage: 'You\'re a Streak Master! 🔥',
    });
  }
}

