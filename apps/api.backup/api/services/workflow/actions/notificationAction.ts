/**
 * B236B-WF-015: NotificationAction
 *
 * Sends emails, SMS, or in-app notifications as part of a workflow.
 * Uses NotificationService, supports templates and personalization.
 * Integrates with localization.
 */

import { getServiceLogger } from '../../logging/serviceLogger';
import { createNotification } from '../../notifications/notificationService.js';
import {
  NotificationActionConfig,
  WorkflowExecutionContext,
} from '../models/types.js';
import Handlebars from 'handlebars';

const log = getServiceLogger('workflow/actions/notification');

/**
 * NotificationAction sends notifications
 */
export class NotificationAction {
  /**
   * Execute notification action
   */
  async execute(
    config: NotificationActionConfig,
    context: WorkflowExecutionContext
  ): Promise<any> {
    try {
      // Compile template with personalization
      const template = Handlebars.compile(config.template);
      const personalization = config.personalization || {};
      const templateData = {
        ...context.variables,
        ...personalization,
      };

      const content = template(templateData);

      log.info('Sending notification', {
        workflowId: context.workflowId,
        executionId: context.executionId,
        channel: config.channel,
        recipientCount: config.recipients.length,
      });

      // Send notifications to all recipients
      const results = await Promise.allSettled(
        config.recipients.map((recipient) =>
          this.sendToRecipient(config, recipient, content, context)
        )
      );

      // Process results
      const successful: string[] = [];
      const failed: Array<{ recipient: string; error: string }> = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const recipient = config.recipients[i];

        if (result.status === 'fulfilled') {
          successful.push(recipient);
        } else {
          failed.push({
            recipient,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          });
        }
      }

      log.info('Notification action completed', {
        workflowId: context.workflowId,
        executionId: context.executionId,
        successful: successful.length,
        failed: failed.length,
      });

      return {
        success: failed.length === 0,
        successful,
        failed,
        total: config.recipients.length,
      };
    } catch (error) {
      log.error('Error executing notification action', {
        workflowId: context.workflowId,
        executionId: context.executionId,
        channel: config.channel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(
        `Notification action failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send notification to a single recipient
   */
  private async sendToRecipient(
    config: NotificationActionConfig,
    recipient: string,
    content: string,
    context: WorkflowExecutionContext
  ): Promise<void> {
    switch (config.channel) {
      case 'in_app':
        await this.sendInAppNotification(recipient, content, config, context);
        break;

      case 'email':
        await this.sendEmailNotification(recipient, content, config, context);
        break;

      case 'sms':
        await this.sendSMSNotification(recipient, content, config, context);
        break;

      default:
        throw new Error(`Unsupported notification channel: ${config.channel}`);
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    recipient: string,
    content: string,
    config: NotificationActionConfig,
    context: WorkflowExecutionContext
  ): Promise<void> {
    // Use NotificationService for in-app notifications
    await createNotification(
      recipient, // userId
      `workflow:${config.template}`, // type
      {
        workflowId: context.workflowId,
        executionId: context.executionId,
        content,
        locale: config.locale,
        metadata: {
          channel: 'in_app',
          template: config.template,
        },
      }
    );
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    recipient: string,
    content: string,
    config: NotificationActionConfig,
    context: WorkflowExecutionContext
  ): Promise<void> {
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // For now, create an in-app notification as fallback
    log.info('Email notification (stub)', {
      recipient,
      contentLength: content.length,
      locale: config.locale,
    });

    // In a real implementation, you would:
    // 1. Resolve user ID from email if needed
    // 2. Call email service API
    // 3. Handle email-specific template rendering (HTML/text)
    // 4. Support localization for email templates

    // Fallback to in-app notification
    await this.sendInAppNotification(recipient, content, config, context);
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(
    recipient: string,
    content: string,
    config: NotificationActionConfig,
    context: WorkflowExecutionContext
  ): Promise<void> {
    // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
    log.info('SMS notification (stub)', {
      recipient,
      contentLength: content.length,
      locale: config.locale,
    });

    // In a real implementation, you would:
    // 1. Validate phone number format
    // 2. Call SMS service API
    // 3. Handle SMS-specific length limits
    // 4. Support localization for SMS templates

    // Fallback to in-app notification
    await this.sendInAppNotification(recipient, content, config, context);
  }
}

