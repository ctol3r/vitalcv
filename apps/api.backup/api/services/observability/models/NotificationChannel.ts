/**
 * NotificationChannel Model
 * B245B-OBS-013: Defines notification channels for alert delivery
 */

import {
  PrismaClient,
  NotificationChannel as PrismaNotificationChannel,
  NotificationChannelType,
} from '@prisma/client';

export interface NotificationChannelConfig {
  // For EMAIL channel
  email?: string;

  // For SLACK channel
  slackToken?: string;
  slackChannel?: string;
  slackWebhookUrl?: string;

  // For WEBHOOK channel
  webhookUrl?: string;
  webhookSecret?: string;
  webhookHeaders?: Record<string, string>;

  // For PAGER channel (e.g., PagerDuty, Opsgenie)
  pagerServiceKey?: string;
  pagerIntegrationKey?: string;
}

export interface NotificationChannelCreateInput {
  type: NotificationChannelType;
  name: string;
  config: NotificationChannelConfig;
  isEnabled?: boolean;
}

export interface NotificationChannelUpdateInput {
  name?: string;
  config?: NotificationChannelConfig;
  isEnabled?: boolean;
}

export class NotificationChannelModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new notification channel
   */
  async create(data: NotificationChannelCreateInput): Promise<PrismaNotificationChannel> {
    // Validate config based on type
    this.validateConfig(data.type, data.config);

    return this.prisma.notificationChannel.create({
      data: {
        type: data.type,
        name: data.name,
        config: data.config as any,
        isEnabled: data.isEnabled ?? true,
      },
    });
  }

  /**
   * Get notification channel by ID
   */
  async findById(id: string): Promise<PrismaNotificationChannel | null> {
    return this.prisma.notificationChannel.findUnique({
      where: { id },
    });
  }

  /**
   * List all notification channels
   */
  async list(filters?: {
    type?: NotificationChannelType;
    isEnabled?: boolean;
  }): Promise<PrismaNotificationChannel[]> {
    return this.prisma.notificationChannel.findMany({
      where: {
        ...(filters?.type && { type: filters.type }),
        ...(filters?.isEnabled !== undefined && { isEnabled: filters.isEnabled }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all enabled channels of a specific type
   */
  async findEnabledByType(type: NotificationChannelType): Promise<PrismaNotificationChannel[]> {
    return this.prisma.notificationChannel.findMany({
      where: {
        type,
        isEnabled: true,
      },
    });
  }

  /**
   * Update notification channel
   */
  async update(id: string, data: NotificationChannelUpdateInput): Promise<PrismaNotificationChannel> {
    if (data.config) {
      const channel = await this.findById(id);
      if (!channel) {
        throw new Error('Notification channel not found');
      }
      this.validateConfig(channel.type, data.config);
    }

    return this.prisma.notificationChannel.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.config !== undefined && { config: data.config as any }),
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      },
    });
  }

  /**
   * Delete notification channel
   */
  async delete(id: string): Promise<void> {
    await this.prisma.notificationChannel.delete({
      where: { id },
    });
  }

  /**
   * Validate channel configuration based on type
   */
  private validateConfig(type: NotificationChannelType, config: NotificationChannelConfig): void {
    switch (type) {
      case 'EMAIL':
        if (!config.email) {
          throw new Error('Email address is required for EMAIL channel');
        }
        break;
      case 'SLACK':
        if (!config.slackWebhookUrl && !config.slackToken) {
          throw new Error('Slack webhook URL or token is required for SLACK channel');
        }
        break;
      case 'WEBHOOK':
        if (!config.webhookUrl) {
          throw new Error('Webhook URL is required for WEBHOOK channel');
        }
        break;
      case 'PAGER':
        if (!config.pagerServiceKey && !config.pagerIntegrationKey) {
          throw new Error('Pager service key or integration key is required for PAGER channel');
        }
        break;
    }
  }
}

