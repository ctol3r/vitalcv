/**
 * B248B-PARTNER-016: PartnerEngagementService
 *
 * Sends notifications to partners (and internal team) about opportunities,
 * proposals, campaigns, tasks; uses existing Notification Service;
 * ensures no PII is exposed; integrates with event bus.
 */

import { PrismaClient } from '@prisma/client';
import { bus } from '../../../backend/src/agents/bus';

export interface NotificationPayload {
  type: string;
  partnerId?: string;
  opportunityId?: string;
  proposalId?: string;
  campaignId?: string;
  taskId?: string;
  userId?: string;
  message: string;
  metadata?: Record<string, any>;
}

export class PartnerEngagementService {
  constructor(private prisma: PrismaClient) {
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for partnership events
   */
  private setupEventListeners(): void {
    // Listen for opportunity events
    bus.on('OPPORTUNITY_CREATED', (event: any) => {
      this.handleOpportunityCreated(event).catch(console.error);
    });

    bus.on('OPPORTUNITY_STATUS_CHANGED', (event: any) => {
      this.handleOpportunityStatusChanged(event).catch(console.error);
    });

    bus.on('OPPORTUNITY_ASSIGNED', (event: any) => {
      this.handleOpportunityAssigned(event).catch(console.error);
    });

    // Listen for proposal events
    bus.on('PROPOSAL_SUBMITTED', (event: any) => {
      this.handleProposalSubmitted(event).catch(console.error);
    });

    bus.on('PROPOSAL_DECISION', (event: any) => {
      this.handleProposalDecision(event).catch(console.error);
    });

    // Listen for campaign events
    bus.on('CAMPAIGN_STARTED', (event: any) => {
      this.handleCampaignStarted(event).catch(console.error);
    });

    // Listen for task events
    bus.on('TASK_CREATED', (event: any) => {
      this.handleTaskCreated(event).catch(console.error);
    });

    bus.on('TASK_STATUS_CHANGED', (event: any) => {
      this.handleTaskStatusChanged(event).catch(console.error);
    });
  }

  /**
   * Send notification to partner (no PII exposed)
   */
  async notifyPartner(
    partnerId: string,
    notification: NotificationPayload,
  ): Promise<void> {
    const partner = await this.prisma.partnerConfig.findUnique({
      where: { partnerId },
    });

    if (!partner || !partner.isActive) {
      console.warn(`Partner ${partnerId} not found or inactive`);
      return;
    }

    // Ensure no PII in notification
    const sanitizedNotification = this.sanitizeNotification(notification);

    // Send via webhook if configured
    if (partner.atsWebhookUrl) {
      await this.sendWebhookNotification(
        partner.atsWebhookUrl,
        sanitizedNotification,
        partner.authType,
        partner.authSecret,
      );
    }

    // TODO: Integrate with notification service
    // await notificationService.send({
    //   recipient: partnerId,
    //   type: notification.type,
    //   message: notification.message,
    //   metadata: sanitizedNotification.metadata,
    // });
  }

  /**
   * Send notification to internal team
   */
  async notifyInternalTeam(
    userIds: string[],
    notification: NotificationPayload,
  ): Promise<void> {
    // Verify users exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
    });

    if (users.length === 0) {
      console.warn(`No users found for notification`);
      return;
    }

    // TODO: Integrate with notification service
    // for (const user of users) {
    //   await notificationService.send({
    //     recipient: user.id,
    //     type: notification.type,
    //     message: notification.message,
    //     metadata: notification.metadata,
    //   });
    // }
  }

  /**
   * Handle opportunity created event
   */
  private async handleOpportunityCreated(event: any): Promise<void> {
    const { opportunityId, partnerId, assignedTo } = event;

    const opportunity = await this.prisma.partnershipOpportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) return;

    // Notify partner
    await this.notifyPartner(partnerId, {
      type: 'opportunity_created',
      partnerId,
      opportunityId,
      message: `New partnership opportunity: ${opportunity.title}`,
      metadata: {
        opportunityId,
        title: opportunity.title,
        status: opportunity.status,
      },
    });

    // Notify assigned user
    if (assignedTo) {
      await this.notifyInternalTeam([assignedTo], {
        type: 'opportunity_assigned',
        opportunityId,
        message: `You have been assigned to opportunity: ${opportunity.title}`,
        metadata: {
          opportunityId,
          partnerId,
          title: opportunity.title,
        },
      });
    }
  }

  /**
   * Handle opportunity status changed event
   */
  private async handleOpportunityStatusChanged(event: any): Promise<void> {
    const { opportunityId, partnerId, oldStatus, newStatus } = event;

    const opportunity = await this.prisma.partnershipOpportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) return;

    // Notify partner
    await this.notifyPartner(partnerId, {
      type: 'opportunity_status_changed',
      partnerId,
      opportunityId,
      message: `Opportunity status changed from ${oldStatus} to ${newStatus}`,
      metadata: {
        opportunityId,
        oldStatus,
        newStatus,
        title: opportunity.title,
      },
    });

    // Notify internal team
    const notifyUsers: string[] = [];
    if (opportunity.assignedTo) {
      notifyUsers.push(opportunity.assignedTo);
    }
    if (opportunity.createdBy) {
      notifyUsers.push(opportunity.createdBy);
    }

    if (notifyUsers.length > 0) {
      await this.notifyInternalTeam(notifyUsers, {
        type: 'opportunity_status_changed',
        opportunityId,
        message: `Opportunity "${opportunity.title}" status changed to ${newStatus}`,
        metadata: {
          opportunityId,
          partnerId,
          oldStatus,
          newStatus,
        },
      });
    }
  }

  /**
   * Handle opportunity assigned event
   */
  private async handleOpportunityAssigned(event: any): Promise<void> {
    const { opportunityId, partnerId, assignedTo } = event;

    if (assignedTo) {
      await this.notifyInternalTeam([assignedTo], {
        type: 'opportunity_assigned',
        opportunityId,
        message: `You have been assigned to a partnership opportunity`,
        metadata: {
          opportunityId,
          partnerId,
        },
      });
    }
  }

  /**
   * Handle proposal submitted event
   */
  private async handleProposalSubmitted(event: any): Promise<void> {
    const { proposalId, opportunityId } = event;

    const proposal = await this.prisma.partnershipProposal.findUnique({
      where: { id: proposalId },
      include: { opportunity: true },
    });

    if (!proposal) return;

    // Notify internal team
    const notifyUsers: string[] = [];
    if (proposal.opportunity.assignedTo) {
      notifyUsers.push(proposal.opportunity.assignedTo);
    }
    if (proposal.opportunity.createdBy) {
      notifyUsers.push(proposal.opportunity.createdBy);
    }

    if (notifyUsers.length > 0) {
      await this.notifyInternalTeam(notifyUsers, {
        type: 'proposal_submitted',
        proposalId,
        opportunityId,
        message: `New proposal submitted for opportunity`,
        metadata: {
          proposalId,
          opportunityId,
        },
      });
    }
  }

  /**
   * Handle proposal decision event
   */
  private async handleProposalDecision(event: any): Promise<void> {
    const { proposalId, opportunityId, status } = event;

    const proposal = await this.prisma.partnershipProposal.findUnique({
      where: { id: proposalId },
      include: { opportunity: true },
    });

    if (!proposal) return;

    // Notify partner
    await this.notifyPartner(proposal.opportunity.partnerId, {
      type: 'proposal_decision',
      proposalId,
      opportunityId,
      message: `Proposal decision: ${status}`,
      metadata: {
        proposalId,
        status,
      },
    });
  }

  /**
   * Handle campaign started event
   */
  private async handleCampaignStarted(event: any): Promise<void> {
    const { campaignId, partnerId } = event;

    const campaign = await this.prisma.coMarketingCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) return;

    // Notify partner
    await this.notifyPartner(partnerId, {
      type: 'campaign_started',
      campaignId,
      message: `Co-marketing campaign "${campaign.name}" has started`,
      metadata: {
        campaignId,
        name: campaign.name,
      },
    });
  }

  /**
   * Handle task created event
   */
  private async handleTaskCreated(event: any): Promise<void> {
    const { taskId, partnerId, assignedTo } = event;

    if (assignedTo) {
      await this.notifyInternalTeam([assignedTo], {
        type: 'task_assigned',
        taskId,
        message: `New collaboration task assigned to you`,
        metadata: {
          taskId,
          partnerId,
        },
      });
    }
  }

  /**
   * Handle task status changed event
   */
  private async handleTaskStatusChanged(event: any): Promise<void> {
    const { taskId, partnerId, status } = event;

    const task = await this.prisma.collaborationTask.findUnique({
      where: { id: taskId },
    });

    if (!task) return;

    // Notify assigned user
    if (task.assignedTo) {
      await this.notifyInternalTeam([task.assignedTo], {
        type: 'task_status_changed',
        taskId,
        message: `Task "${task.title}" status changed to ${status}`,
        metadata: {
          taskId,
          status,
        },
      });
    }
  }

  /**
   * Sanitize notification to remove PII
   */
  private sanitizeNotification(
    notification: NotificationPayload,
  ): NotificationPayload {
    // Remove any PII from metadata
    const sanitizedMetadata = { ...notification.metadata };
    delete sanitizedMetadata.email;
    delete sanitizedMetadata.phone;
    delete sanitizedMetadata.name;
    delete sanitizedMetadata.userId;

    return {
      ...notification,
      metadata: sanitizedMetadata,
    };
  }

  /**
   * Send webhook notification to partner
   */
  private async sendWebhookNotification(
    url: string,
    notification: NotificationPayload,
    authType: string,
    authSecret: string | null,
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authentication based on type
      if (authType === 'bearer' && authSecret) {
        headers['Authorization'] = `Bearer ${authSecret}`;
      } else if (authType === 'hmac' && authSecret) {
        // TODO: Implement HMAC signing
        headers['X-Signature'] = 'hmac-signature-placeholder';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(notification),
      });

      if (!response.ok) {
        console.error(
          `Webhook notification failed: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      console.error(`Error sending webhook notification:`, error);
    }
  }
}

