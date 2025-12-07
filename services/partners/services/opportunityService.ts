/**
 * B248B-PARTNER-012: PartnershipOpportunityService
 *
 * Manages partnership opportunities: create/update, assign internal owners,
 * update status; integrates with CRM (e.g. SalesHub); triggers notifications.
 */

import { PrismaClient } from '@prisma/client';
import {
  CreatePartnershipOpportunity,
  UpdatePartnershipOpportunity,
  OpportunityStatus,
  validateCreatePartnershipOpportunity,
  validateUpdatePartnershipOpportunity,
} from '../models/PartnershipOpportunity';
import { emitEvent } from '../../../backend/src/agents/bus';

export interface OpportunityFilters {
  partnerId?: string;
  status?: OpportunityStatus;
  assignedTo?: string;
  createdBy?: string;
  limit?: number;
  offset?: number;
}

export interface OpportunityListResult {
  opportunities: Array<{
    id: string;
    partnerId: string;
    title: string;
    description: string | null;
    status: string;
    potentialValue: number | null;
    assignedTo: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
}

export class PartnershipOpportunityService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new partnership opportunity
   */
  async createOpportunity(
    data: CreatePartnershipOpportunity,
  ): Promise<{ id: string }> {
    const validated = validateCreatePartnershipOpportunity(data);

    // Verify partner exists
    const partner = await this.prisma.partnerConfig.findUnique({
      where: { partnerId: validated.partnerId },
    });

    if (!partner) {
      throw new Error(`Partner with ID ${validated.partnerId} not found`);
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: validated.createdBy },
    });

    if (!user) {
      throw new Error(`User with ID ${validated.createdBy} not found`);
    }

    const opportunity = await this.prisma.partnershipOpportunity.create({
      data: {
        partnerId: validated.partnerId,
        title: validated.title,
        description: validated.description || null,
        status: validated.status || OpportunityStatus.NEW,
        potentialValue: validated.potentialValue || null,
        assignedTo: validated.assignedTo || null,
        createdBy: validated.createdBy,
      },
    });

    // Emit event for notifications
    emitEvent({
      type: 'OPPORTUNITY_CREATED',
      opportunityId: opportunity.id,
      partnerId: opportunity.partnerId,
      assignedTo: opportunity.assignedTo,
    });

    // Integrate with CRM (SalesHub) - placeholder
    await this.syncToCRM(opportunity.id, 'create');

    return { id: opportunity.id };
  }

  /**
   * Update an opportunity
   */
  async updateOpportunity(
    id: string,
    data: UpdatePartnershipOpportunity,
  ): Promise<void> {
    const validated = validateUpdatePartnershipOpportunity(data);

    const existing = await this.prisma.partnershipOpportunity.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Opportunity with ID ${id} not found`);
    }

    const oldStatus = existing.status;
    const newStatus = validated.status;

    await this.prisma.partnershipOpportunity.update({
      where: { id },
      data: {
        title: validated.title,
        description: validated.description,
        status: validated.status,
        potentialValue: validated.potentialValue,
        assignedTo: validated.assignedTo,
      },
    });

    // Emit event if status changed
    if (newStatus && newStatus !== oldStatus) {
      emitPartnershipEvent({
        type: 'OPPORTUNITY_STATUS_CHANGED',
        opportunityId: id,
        partnerId: existing.partnerId,
        oldStatus,
        newStatus,
      });
    }

    // Sync to CRM
    await this.syncToCRM(id, 'update');
  }

  /**
   * Assign an internal owner to an opportunity
   */
  async assignOwner(opportunityId: string, userId: string): Promise<void> {
    const opportunity = await this.prisma.partnershipOpportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      throw new Error(`Opportunity with ID ${opportunityId} not found`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    await this.prisma.partnershipOpportunity.update({
      where: { id: opportunityId },
      data: { assignedTo: userId },
    });

    // Emit event for notifications
    emitEvent({
      type: 'OPPORTUNITY_ASSIGNED',
      opportunityId,
      partnerId: opportunity.partnerId,
      assignedTo: userId,
    });
  }

  /**
   * Update opportunity status
   */
  async updateStatus(
    opportunityId: string,
    status: OpportunityStatus,
  ): Promise<void> {
    const opportunity = await this.prisma.partnershipOpportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      throw new Error(`Opportunity with ID ${opportunityId} not found`);
    }

    const oldStatus = opportunity.status;

    await this.prisma.partnershipOpportunity.update({
      where: { id: opportunityId },
      data: { status },
    });

    // Emit event for notifications
    emitEvent({
      type: 'OPPORTUNITY_STATUS_CHANGED',
      opportunityId,
      partnerId: opportunity.partnerId,
      oldStatus,
      newStatus: status,
    });

    // Sync to CRM
    await this.syncToCRM(opportunityId, 'update');
  }

  /**
   * Get opportunity by ID
   */
  async getOpportunity(id: string) {
    return this.prisma.partnershipOpportunity.findUnique({
      where: { id },
      include: {
        proposals: true,
        tasks: true,
      },
    });
  }

  /**
   * List opportunities with filtering and pagination
   */
  async listOpportunities(
    filters: OpportunityFilters = {},
  ): Promise<OpportunityListResult> {
    const where: any = {};

    if (filters.partnerId) {
      where.partnerId = filters.partnerId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
    }

    const [opportunities, total] = await Promise.all([
      this.prisma.partnershipOpportunity.findMany({
        where,
        take: filters.limit || 50,
        skip: filters.offset || 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.partnershipOpportunity.count({ where }),
    ]);

    return {
      opportunities: opportunities.map((opp) => ({
        id: opp.id,
        partnerId: opp.partnerId,
        title: opp.title,
        description: opp.description,
        status: opp.status,
        potentialValue: opp.potentialValue,
        assignedTo: opp.assignedTo,
        createdBy: opp.createdBy,
        createdAt: opp.createdAt,
        updatedAt: opp.updatedAt,
      })),
      total,
    };
  }

  /**
   * Sync opportunity to CRM (SalesHub integration)
   * This is a placeholder - integrate with actual CRM API
   */
  private async syncToCRM(
    opportunityId: string,
    action: 'create' | 'update',
  ): Promise<void> {
    // TODO: Integrate with SalesHub or other CRM
    // Example:
    // await salesHubClient.syncOpportunity(opportunityId, action);
    console.log(`[CRM Sync] ${action} opportunity ${opportunityId}`);
  }
}

