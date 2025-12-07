/**
 * AlertNotificationService
 * B245B-OBS-014: Sends alert messages via channels
 * Integrates with email service and messaging integrations
 * Ensures delivery with retries
 */

import { PrismaClient, NotificationChannelType } from '@prisma/client';
import { NotificationChannelModel, NotificationChannelConfig } from '../models/NotificationChannel';

export interface AlertNotificationInput {
  channelId: string;
  incidentId?: string;
  alertRuleId?: string;
  message: string;
  metricName?: string;
  currentValue?: number;
  threshold?: number;
  comparator?: string;
}

interface NotificationResult {
  success: boolean;
  error?: string;
}

/**
 * Service for sending alert notifications via various channels
 */
export class AlertNotificationService {
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 5000; // 5 seconds

  constructor(private prisma: PrismaClient) {}

  /**
   * Send an alert notification
   */
  async sendAlert(input: AlertNotificationInput): Promise<void> {
    const channelModel = new NotificationChannelModel(this.prisma);
    const channel = await channelModel.findById(input.channelId);

    if (!channel) {
      throw new Error(`Notification channel not found: ${input.channelId}`);
    }

    if (!channel.isEnabled) {
      throw new Error(`Notification channel is disabled: ${input.channelId}`);
    }

    // Attempt to send with retries
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.sendViaChannel(channel.type, channel.config as NotificationChannelConfig, input);

        // Record successful notification
        await this.recordNotification(input, 'sent');
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.MAX_RETRIES) {
          // Wait before retry
          await this.sleep(this.RETRY_DELAY_MS * attempt); // Exponential backoff
          // Record retry attempt
          await this.recordNotification(input, 'retrying', lastError.message);
        } else {
          // Final attempt failed
          await this.recordNotification(input, 'failed', lastError.message);
          throw lastError;
        }
      }
    }
  }

  /**
   * Send notification via specific channel type
   */
  private async sendViaChannel(
    type: NotificationChannelType,
    config: NotificationChannelConfig,
    input: AlertNotificationInput
  ): Promise<void> {
    switch (type) {
      case 'EMAIL':
        await this.sendEmail(config, input);
        break;
      case 'SLACK':
        await this.sendSlack(config, input);
        break;
      case 'WEBHOOK':
        await this.sendWebhook(config, input);
        break;
      case 'PAGER':
        await this.sendPager(config, input);
        break;
      default:
        throw new Error(`Unsupported notification channel type: ${type}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(config: NotificationChannelConfig, input: AlertNotificationInput): Promise<void> {
    if (!config.email) {
      throw new Error('Email address not configured');
    }

    // TODO: Integrate with actual email service (SendGrid, SES, etc.)
    // For now, log the email
    console.log(`[AlertNotificationService] Sending email to ${config.email}`);
    console.log(`[AlertNotificationService] Subject: Alert: ${input.alertRuleId}`);
    console.log(`[AlertNotificationService] Body: ${input.message}`);

    // In production, use an email service:
    // await emailService.send({
    //   to: config.email,
    //   subject: `Alert: ${input.metricName || 'System Alert'}`,
    //   text: input.message,
    //   html: this.formatEmailHtml(input),
    // });
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(config: NotificationChannelConfig, input: AlertNotificationInput): Promise<void> {
    const webhookUrl = config.slackWebhookUrl;
    const token = config.slackToken;
    const channel = config.slackChannel || '#alerts';

    if (!webhookUrl && !token) {
      throw new Error('Slack webhook URL or token not configured');
    }

    // TODO: Integrate with Slack API
    // For now, log the Slack message
    console.log(`[AlertNotificationService] Sending Slack message to ${channel}`);
    console.log(`[AlertNotificationService] Message: ${input.message}`);

    // In production, use Slack API:
    // if (webhookUrl) {
    //   await fetch(webhookUrl, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       text: input.message,
    //       channel: channel,
    //     }),
    //   });
    // } else if (token) {
    //   // Use Slack Web API
    //   await slackClient.chat.postMessage({
    //     token,
    //     channel,
    //     text: input.message,
    //   });
    // }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(config: NotificationChannelConfig, input: AlertNotificationInput): Promise<void> {
    if (!config.webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      alertRuleId: input.alertRuleId,
      incidentId: input.incidentId,
      message: input.message,
      metricName: input.metricName,
      currentValue: input.currentValue,
      threshold: input.threshold,
      comparator: input.comparator,
      timestamp: new Date().toISOString(),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config.webhookHeaders || {}),
    };

    // Add signature if secret is configured
    if (config.webhookSecret) {
      // TODO: Implement HMAC signature
      // const signature = createHmac('sha256', config.webhookSecret)
      //   .update(JSON.stringify(payload))
      //   .digest('hex');
      // headers['X-Signature'] = signature;
    }

    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned status ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      throw new Error(`Failed to send webhook: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send pager notification (e.g., PagerDuty, Opsgenie)
   */
  private async sendPager(config: NotificationChannelConfig, input: AlertNotificationInput): Promise<void> {
    if (!config.pagerServiceKey && !config.pagerIntegrationKey) {
      throw new Error('Pager service key or integration key not configured');
    }

    // TODO: Integrate with PagerDuty/Opsgenie API
    // For now, log the pager alert
    console.log(`[AlertNotificationService] Sending pager alert`);
    console.log(`[AlertNotificationService] Message: ${input.message}`);

    // In production, use PagerDuty/Opsgenie API:
    // await pagerService.trigger({
    //   serviceKey: config.pagerServiceKey || config.pagerIntegrationKey,
    //   summary: input.message,
    //   severity: 'critical',
    //   source: input.metricName,
    // });
  }

  /**
   * Record notification in database
   */
  private async recordNotification(
    input: AlertNotificationInput,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    await this.prisma.alertNotification.create({
      data: {
        channelId: input.channelId,
        incidentId: input.incidentId,
        alertRuleId: input.alertRuleId,
        message: input.message,
        status,
        errorMessage,
        retryCount: status === 'retrying' ? 1 : 0,
      },
    });
  }

  /**
   * Format HTML email
   */
  private formatEmailHtml(input: AlertNotificationInput): string {
    return `
      <html>
        <body>
          <h2>Alert Notification</h2>
          <p>${input.message.replace(/\n/g, '<br>')}</p>
          ${input.currentValue !== undefined ? `<p><strong>Current Value:</strong> ${input.currentValue}</p>` : ''}
          ${input.threshold !== undefined ? `<p><strong>Threshold:</strong> ${input.comparator} ${input.threshold}</p>` : ''}
        </body>
      </html>
    `;
  }

  /**
   * Sleep helper for retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

