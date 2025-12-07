/**
 * AlertRule Model
 * B245B-OBS-011: Defines alert rules with metric evaluation criteria
 */

import { PrismaClient, AlertRule as PrismaAlertRule, AlertComparator } from '@prisma/client';

export interface AlertRuleCreateInput {
  name: string;
  metricName: string;
  comparator: AlertComparator;
  threshold: number;
  duration: number; // Duration in minutes
  channelId: string;
  isEnabled?: boolean;
  description?: string;
}

export interface AlertRuleUpdateInput {
  name?: string;
  metricName?: string;
  comparator?: AlertComparator;
  threshold?: number;
  duration?: number;
  channelId?: string;
  isEnabled?: boolean;
  description?: string;
}

export interface AlertRuleWithChannel extends PrismaAlertRule {
  channel: {
    id: string;
    type: string;
    name: string;
    isEnabled: boolean;
  };
}

export class AlertRuleModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new alert rule
   */
  async create(data: AlertRuleCreateInput): Promise<PrismaAlertRule> {
    return this.prisma.alertRule.create({
      data: {
        name: data.name,
        metricName: data.metricName,
        comparator: data.comparator,
        threshold: data.threshold,
        duration: data.duration,
        channelId: data.channelId,
        isEnabled: data.isEnabled ?? true,
        description: data.description,
      },
    });
  }

  /**
   * Get alert rule by ID
   */
  async findById(id: string): Promise<AlertRuleWithChannel | null> {
    return this.prisma.alertRule.findUnique({
      where: { id },
      include: {
        channel: {
          select: {
            id: true,
            type: true,
            name: true,
            isEnabled: true,
          },
        },
      },
    });
  }

  /**
   * List all alert rules (optionally filtered by enabled status or metric)
   */
  async list(filters?: {
    isEnabled?: boolean;
    metricName?: string;
    channelId?: string;
  }): Promise<AlertRuleWithChannel[]> {
    return this.prisma.alertRule.findMany({
      where: {
        ...(filters?.isEnabled !== undefined && { isEnabled: filters.isEnabled }),
        ...(filters?.metricName && { metricName: filters.metricName }),
        ...(filters?.channelId && { channelId: filters.channelId }),
      },
      include: {
        channel: {
          select: {
            id: true,
            type: true,
            name: true,
            isEnabled: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all enabled alert rules for a specific metric
   */
  async findEnabledByMetric(metricName: string): Promise<AlertRuleWithChannel[]> {
    return this.prisma.alertRule.findMany({
      where: {
        metricName,
        isEnabled: true,
      },
      include: {
        channel: {
          select: {
            id: true,
            type: true,
            name: true,
            isEnabled: true,
          },
        },
      },
    });
  }

  /**
   * Update alert rule
   */
  async update(id: string, data: AlertRuleUpdateInput): Promise<PrismaAlertRule> {
    return this.prisma.alertRule.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.metricName !== undefined && { metricName: data.metricName }),
        ...(data.comparator !== undefined && { comparator: data.comparator }),
        ...(data.threshold !== undefined && { threshold: data.threshold }),
        ...(data.duration !== undefined && { duration: data.duration }),
        ...(data.channelId !== undefined && { channelId: data.channelId }),
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });
  }

  /**
   * Delete alert rule
   */
  async delete(id: string): Promise<void> {
    await this.prisma.alertRule.delete({
      where: { id },
    });
  }
}

