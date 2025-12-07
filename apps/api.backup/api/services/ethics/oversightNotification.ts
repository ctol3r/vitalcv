/**
 * B222B-ETH-010: OversightNotificationService
 *
 * Notifies stakeholders (clinicians, orgs, boards) of autonomous actions and any ethics/compliance flags;
 * includes links to explanation graphs.
 */

import { createLogger } from '@chai-vc/logging-core';
import { PrismaClient } from '@prisma/client';
import { createNotification } from '../notifications/notificationService.js';

const logger = createLogger({ service: 'ethics-oversight-notification' });
const prisma = new PrismaClient();

/**
 * Notification types
 */
export enum OversightNotificationType {
  AUTONOMOUS_ACTION = 'ethics.autonomous_action',
  BIAS_DETECTED = 'ethics.bias_detected',
  COMPLIANCE_VIOLATION = 'ethics.compliance_violation',
  KILL_SWITCH_ACTIVATED = 'ethics.kill_switch_activated',
  OVERSIGHT_REVIEW_REQUIRED = 'ethics.oversight_review_required',
}

/**
 * Stakeholder types
 */
export enum StakeholderType {
  CLINICIAN = 'clinician',
  ORGANIZATION = 'organization',
  BOARD = 'board',
  COMPLIANCE_OFFICER = 'compliance_officer',
  ETHICS_BOARD = 'ethics_board',
}

/**
 * Notification context
 */
export interface NotificationContext {
  /** Notification type */
  type: OversightNotificationType;
  /** Related action ID */
  actionId?: string;
  /** Related decision ID */
  decisionId?: string;
  /** Organization ID */
  orgId?: string;
  /** Region */
  region?: string;
  /** Clinician ID (if applicable) */
  clinicianId?: string;
  /** User ID (if applicable) */
  userId?: string;
  /** Explanation graph link */
  explanationGraphLink?: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Stakeholder notification preferences
 */
export interface StakeholderPreferences {
  /** Stakeholder type */
  type: StakeholderType;
  /** Notification channels */
  channels: ('email' | 'in_app' | 'sms')[];
  /** Notification types to receive */
  notificationTypes: OversightNotificationType[];
  /** Urgency threshold */
  urgencyThreshold: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * OversightNotificationService configuration
 */
export interface OversightNotificationConfig {
  /** Base URL for explanation graph links */
  explanationGraphBaseUrl?: string;
  /** Default notification channels */
  defaultChannels: ('email' | 'in_app' | 'sms')[];
  /** Enable email notifications */
  enableEmail: boolean;
  /** Enable SMS notifications */
  enableSMS: boolean;
}

/**
 * Default notification configuration
 */
const DEFAULT_CONFIG: OversightNotificationConfig = {
  explanationGraphBaseUrl: process.env.EXPLANATION_GRAPH_BASE_URL || 'https://app.example.com/explain',
  defaultChannels: ['in_app', 'email'],
  enableEmail: true,
  enableSMS: false,
};

/**
 * OversightNotificationService
 *
 * Notifies stakeholders of autonomous actions and ethics/compliance flags.
 */
export class OversightNotificationService {
  private config: OversightNotificationConfig;

  constructor(config?: Partial<OversightNotificationConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Notify stakeholders of an autonomous action
   */
  async notifyAutonomousAction(context: NotificationContext): Promise<void> {
    logger.info('Notifying stakeholders of autonomous action', {
      actionId: context.actionId,
      orgId: context.orgId,
    });

    const stakeholders = await this.getStakeholders(context);

    for (const stakeholder of stakeholders) {
      await this.sendNotification(
        stakeholder.userId,
        OversightNotificationType.AUTONOMOUS_ACTION,
        {
          title: 'Autonomous Action Executed',
          message: `An autonomous action has been executed${context.actionId ? ` (ID: ${context.actionId})` : ''}`,
          actionId: context.actionId,
          explanationGraphLink: context.explanationGraphLink,
          data: context.data,
        },
        stakeholder.preferences
      );
    }
  }

  /**
   * Notify stakeholders of bias detection
   */
  async notifyBiasDetected(context: NotificationContext & {
    biasType: string;
    severity: number;
    description: string;
  }): Promise<void> {
    logger.warn('Notifying stakeholders of bias detection', {
      decisionId: context.decisionId,
      biasType: context.biasType,
      severity: context.severity,
    });

    const stakeholders = await this.getStakeholders(context);

    for (const stakeholder of stakeholders) {
      await this.sendNotification(
        stakeholder.userId,
        OversightNotificationType.BIAS_DETECTED,
        {
          title: 'Bias Detected in Autonomous Decision',
          message: `Bias detected: ${context.description}`,
          decisionId: context.decisionId,
          biasType: context.biasType,
          severity: context.severity,
          explanationGraphLink: context.explanationGraphLink,
          data: context.data,
        },
        stakeholder.preferences
      );
    }
  }

  /**
   * Notify stakeholders of compliance violation
   */
  async notifyComplianceViolation(context: NotificationContext & {
    failedFramework: string;
    violations: Array<{
      framework: string;
      rule: string;
      severity: string;
    }>;
  }): Promise<void> {
    logger.error('Notifying stakeholders of compliance violation', {
      actionId: context.actionId,
      failedFramework: context.failedFramework,
    });

    const stakeholders = await this.getStakeholders(context);

    for (const stakeholder of stakeholders) {
      await this.sendNotification(
        stakeholder.userId,
        OversightNotificationType.COMPLIANCE_VIOLATION,
        {
          title: 'Compliance Violation Detected',
          message: `Compliance violation in framework: ${context.failedFramework}`,
          actionId: context.actionId,
          failedFramework: context.failedFramework,
          violations: context.violations,
          explanationGraphLink: context.explanationGraphLink,
          data: context.data,
        },
        stakeholder.preferences
      );
    }
  }

  /**
   * Notify stakeholders of kill switch activation
   */
  async notifyKillSwitchActivated(context: NotificationContext & {
    activatedBy: string;
    reason: string;
    region?: string;
  }): Promise<void> {
    logger.warn('Notifying stakeholders of kill switch activation', {
      actionId: context.actionId,
      activatedBy: context.activatedBy,
      region: context.region,
    });

    // Get all stakeholders (kill switch affects everyone)
    const stakeholders = await this.getAllStakeholders(context.orgId, context.region);

    for (const stakeholder of stakeholders) {
      await this.sendNotification(
        stakeholder.userId,
        OversightNotificationType.KILL_SWITCH_ACTIVATED,
        {
          title: 'Emergency Stop Activated',
          message: `Autonomous actions have been halted${context.region ? ` in region ${context.region}` : ' globally'}. Reason: ${context.reason}`,
          actionId: context.actionId,
          activatedBy: context.activatedBy,
          reason: context.reason,
          region: context.region,
          explanationGraphLink: context.explanationGraphLink,
          data: context.data,
        },
        stakeholder.preferences
      );
    }
  }

  /**
   * Notify stakeholders that oversight review is required
   */
  async notifyOversightReviewRequired(context: NotificationContext & {
    reviewType: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    logger.info('Notifying stakeholders that oversight review is required', {
      actionId: context.actionId,
      reviewType: context.reviewType,
      urgency: context.urgency,
    });

    // Get oversight board members
    const stakeholders = await this.getOversightBoardMembers(context.orgId);

    for (const stakeholder of stakeholders) {
      // Only notify if urgency meets threshold
      if (
        this.compareUrgency(context.urgency, stakeholder.preferences.urgencyThreshold) >= 0
      ) {
        await this.sendNotification(
          stakeholder.userId,
          OversightNotificationType.OVERSIGHT_REVIEW_REQUIRED,
          {
            title: 'Oversight Review Required',
            message: `Oversight review required for ${context.reviewType}`,
            actionId: context.actionId,
            decisionId: context.decisionId,
            reviewType: context.reviewType,
            urgency: context.urgency,
            explanationGraphLink: context.explanationGraphLink,
            data: context.data,
          },
          stakeholder.preferences
        );
      }
    }
  }

  /**
   * Get stakeholders for a notification context
   */
  private async getStakeholders(context: NotificationContext): Promise<
    Array<{
      userId: string;
      type: StakeholderType;
      preferences: StakeholderPreferences;
    }>
  > {
    const stakeholders: Array<{
      userId: string;
      type: StakeholderType;
      preferences: StakeholderPreferences;
    }> = [];

    // Add clinician if applicable
    if (context.clinicianId) {
      const clinician = await this.getClinicianStakeholder(context.clinicianId);
      if (clinician) {
        stakeholders.push(clinician);
      }
    }

    // Add organization admins
    if (context.orgId) {
      const orgStakeholders = await this.getOrganizationStakeholders(context.orgId);
      stakeholders.push(...orgStakeholders);
    }

    // Add compliance officers
    const complianceOfficers = await this.getComplianceOfficers(context.orgId);
    stakeholders.push(...complianceOfficers);

    return stakeholders;
  }

  /**
   * Get all stakeholders (for kill switch notifications)
   */
  private async getAllStakeholders(
    orgId?: string,
    region?: string
  ): Promise<
    Array<{
      userId: string;
      type: StakeholderType;
      preferences: StakeholderPreferences;
    }>
  > {
    const stakeholders: Array<{
      userId: string;
      type: StakeholderType;
      preferences: StakeholderPreferences;
    }> = [];

    // Get all organization admins
    if (orgId) {
      const orgStakeholders = await this.getOrganizationStakeholders(orgId);
      stakeholders.push(...orgStakeholders);
    }

    // Get all compliance officers
    const complianceOfficers = await this.getComplianceOfficers(orgId);
    stakeholders.push(...complianceOfficers);

    // Get all ethics board members
    const ethicsBoard = await this.getEthicsBoardMembers(orgId);
    stakeholders.push(...ethicsBoard);

    return stakeholders;
  }

  /**
   * Get clinician stakeholder
   */
  private async getClinicianStakeholder(
    clinicianId: string
  ): Promise<{
    userId: string;
    type: StakeholderType;
    preferences: StakeholderPreferences;
  } | null> {
    // In production, would query database
    // For now, return placeholder
    logger.debug('Getting clinician stakeholder', { clinicianId });
    return null;
  }

  /**
   * Get organization stakeholders
   */
  private async getOrganizationStakeholders(
    orgId: string
  ): Promise<
    Array<{
      userId: string;
      type: StakeholderType;
      preferences: StakeholderPreferences;
    }>
  > {
    // In production, would query database for org admins
    logger.debug('Getting organization stakeholders', { orgId });
    return [];
  }

  /**
   * Get compliance officers
   */
  private async getComplianceOfficers(
    orgId?: string
  ): Promise<
    Array<{
      userId: string;
      type: StakeholderType;
      preferences: StakeholderPreferences;
    }>
  > {
    // In production, would query database
    logger.debug('Getting compliance officers', { orgId });
    return [];
  }

  /**
   * Get ethics board members
   */
  private async getEthicsBoardMembers(
    orgId?: string
  ): Promise<
    Array<{
      userId: string;
      type: StakeholderType;
      preferences: StakeholderPreferences;
    }>
  > {
    // In production, would query database
    logger.debug('Getting ethics board members', { orgId });
    return [];
  }

  /**
   * Get oversight board members
   */
  private async getOversightBoardMembers(
    orgId?: string
  ): Promise<
    Array<{
      userId: string;
      type: StakeholderType;
      preferences: StakeholderPreferences;
    }>
  > {
    // In production, would query database
    logger.debug('Getting oversight board members', { orgId });
    return [];
  }

  /**
   * Send notification to a stakeholder
   */
  private async sendNotification(
    userId: string,
    type: OversightNotificationType,
    payload: {
      title: string;
      message: string;
      [key: string]: unknown;
    },
    preferences?: StakeholderPreferences
  ): Promise<void> {
    try {
      // Determine notification channels
      const channels =
        preferences?.channels || this.config.defaultChannels;

      // Send in-app notification
      if (channels.includes('in_app')) {
        await createNotification(userId, type, payload);
      }

      // Send email notification
      if (channels.includes('email') && this.config.enableEmail) {
        await this.sendEmailNotification(userId, payload);
      }

      // Send SMS notification
      if (channels.includes('sms') && this.config.enableSMS) {
        await this.sendSMSNotification(userId, payload);
      }

      logger.info('Notification sent', {
        userId,
        type,
        channels,
      });
    } catch (error) {
      logger.error('Error sending notification', {
        userId,
        type,
        error,
      });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    userId: string,
    payload: {
      title: string;
      message: string;
      explanationGraphLink?: string;
      [key: string]: unknown;
    }
  ): Promise<void> {
    // In production, would integrate with email service
    logger.debug('Sending email notification', {
      userId,
      title: payload.title,
    });

    // TODO: Integrate with email service
    // await emailService.send({
    //   to: userEmail,
    //   subject: payload.title,
    //   body: payload.message,
    //   link: payload.explanationGraphLink,
    // });
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(
    userId: string,
    payload: {
      title: string;
      message: string;
      [key: string]: unknown;
    }
  ): Promise<void> {
    // In production, would integrate with SMS service
    logger.debug('Sending SMS notification', {
      userId,
      title: payload.title,
    });

    // TODO: Integrate with SMS service
    // await smsService.send({
    //   to: userPhone,
    //   message: `${payload.title}: ${payload.message}`,
    // });
  }

  /**
   * Compare urgency levels
   */
  private compareUrgency(
    a: 'low' | 'medium' | 'high' | 'critical',
    b: 'low' | 'medium' | 'high' | 'critical'
  ): number {
    const levels = { low: 0, medium: 1, high: 2, critical: 3 };
    return levels[a] - levels[b];
  }

  /**
   * Generate explanation graph link
   */
  generateExplanationGraphLink(graphId: string): string {
    return `${this.config.explanationGraphBaseUrl}/${graphId}`;
  }
}

/**
 * Create a new OversightNotificationService instance
 */
export function createOversightNotificationService(
  config?: Partial<OversightNotificationConfig>
): OversightNotificationService {
  return new OversightNotificationService(config);
}

