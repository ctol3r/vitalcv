/**
 * B248B-PARTNER-017: PartnerMetricsService
 *
 * Aggregates data from opportunities, proposals, campaigns: conversion rates,
 * lead counts, revenue, time-to-close; generates monthly reports;
 * excludes patient or clinical data.
 */

import { PrismaClient } from '@prisma/client';

export interface PartnerMetrics {
  partnerId: string;
  period: {
    start: Date;
    end: Date;
  };
  opportunities: {
    total: number;
    byStatus: Record<string, number>;
    totalValue: number; // Sum of potentialValue in cents
    averageValue: number;
  };
  proposals: {
    total: number;
    byStatus: Record<string, number>;
    conversionRate: number; // accepted / submitted
    averageTimeToDecision: number; // days
  };
  campaigns: {
    total: number;
    active: number;
    completed: number;
    totalBudget: number; // Sum of budgets in cents
  };
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    completed: number;
    completionRate: number;
  };
  revenue: {
    recognized: number; // From opportunities won (in cents)
    potential: number; // From opportunities in_progress (in cents)
  };
  timeToClose: {
    average: number; // days from creation to won/lost
    median: number;
  };
}

export interface MonthlyReport {
  month: string; // YYYY-MM
  metrics: PartnerMetrics;
  trends: {
    opportunitiesGrowth: number; // percentage
    conversionRateChange: number; // percentage points
    revenueGrowth: number; // percentage
  };
}

export class PartnerMetricsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calculate metrics for a partner in a date range
   */
  async calculatePartnerMetrics(
    partnerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PartnerMetrics> {
    // Get opportunities in range
    const opportunities = await this.prisma.partnershipOpportunity.findMany({
      where: {
        partnerId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get proposals for these opportunities
    const opportunityIds = opportunities.map((o) => o.id);
    const proposals = await this.prisma.partnershipProposal.findMany({
      where: {
        opportunityId: { in: opportunityIds },
      },
    });

    // Get campaigns in range
    const campaigns = await this.prisma.coMarketingCampaign.findMany({
      where: {
        partnerId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get tasks in range
    const tasks = await this.prisma.collaborationTask.findMany({
      where: {
        partnerId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calculate opportunity metrics
    const opportunitiesByStatus: Record<string, number> = {};
    let totalValue = 0;
    let wonCount = 0;
    let wonOpportunities: Array<{ createdAt: Date; updatedAt: Date }> = [];

    opportunities.forEach((opp) => {
      opportunitiesByStatus[opp.status] =
        (opportunitiesByStatus[opp.status] || 0) + 1;
      if (opp.potentialValue) {
        totalValue += opp.potentialValue;
      }
      if (opp.status === 'won') {
        wonCount++;
        wonOpportunities.push(opp);
      }
    });

    const averageValue =
      opportunities.length > 0 ? totalValue / opportunities.length : 0;

    // Calculate proposal metrics
    const proposalsByStatus: Record<string, number> = {};
    let submittedCount = 0;
    let acceptedCount = 0;
    const decisionTimes: number[] = [];

    proposals.forEach((prop) => {
      proposalsByStatus[prop.status] =
        (proposalsByStatus[prop.status] || 0) + 1;
      if (prop.status === 'submitted') {
        submittedCount++;
      }
      if (prop.status === 'accepted') {
        acceptedCount++;
      }
      if (prop.submittedAt && prop.decisionAt) {
        const days =
          (prop.decisionAt.getTime() - prop.submittedAt.getTime()) /
          (1000 * 60 * 60 * 24);
        decisionTimes.push(days);
      }
    });

    const conversionRate =
      submittedCount > 0 ? (acceptedCount / submittedCount) * 100 : 0;
    const averageTimeToDecision =
      decisionTimes.length > 0
        ? decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length
        : 0;

    // Calculate campaign metrics
    const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
    const completedCampaigns = campaigns.filter(
      (c) => c.status === 'completed',
    ).length;
    const totalBudget =
      campaigns.reduce((sum, c) => sum + (c.budget || 0), 0);

    // Calculate task metrics
    const tasksByStatus: Record<string, number> = {};
    let completedTasks = 0;

    tasks.forEach((task) => {
      tasksByStatus[task.status] = (tasksByStatus[task.status] || 0) + 1;
      if (task.status === 'done') {
        completedTasks++;
      }
    });

    const completionRate =
      tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

    // Calculate revenue (from won opportunities)
    const recognizedRevenue = wonOpportunities.reduce(
      (sum, opp) => sum + ((opp as any).potentialValue || 0),
      0,
    );

    // Potential revenue from in-progress opportunities
    const inProgressOpps = opportunities.filter(
      (o) => o.status === 'in_progress',
    );
    const potentialRevenue = inProgressOpps.reduce(
      (sum, opp) => sum + (opp.potentialValue || 0),
      0,
    );

    // Calculate time to close
    const closeTimes: number[] = [];
    wonOpportunities.forEach((opp) => {
      const days =
        (opp.updatedAt.getTime() - opp.createdAt.getTime()) /
        (1000 * 60 * 60 * 24);
      closeTimes.push(days);
    });

    const averageTimeToClose =
      closeTimes.length > 0
        ? closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length
        : 0;

    const sortedCloseTimes = [...closeTimes].sort((a, b) => a - b);
    const medianTimeToClose =
      sortedCloseTimes.length > 0
        ? sortedCloseTimes[Math.floor(sortedCloseTimes.length / 2)]
        : 0;

    return {
      partnerId,
      period: { start: startDate, end: endDate },
      opportunities: {
        total: opportunities.length,
        byStatus: opportunitiesByStatus,
        totalValue,
        averageValue: Math.round(averageValue),
      },
      proposals: {
        total: proposals.length,
        byStatus: proposalsByStatus,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averageTimeToDecision: Math.round(averageTimeToDecision * 100) / 100,
      },
      campaigns: {
        total: campaigns.length,
        active: activeCampaigns,
        completed: completedCampaigns,
        totalBudget,
      },
      tasks: {
        total: tasks.length,
        byStatus: tasksByStatus,
        completed: completedTasks,
        completionRate: Math.round(completionRate * 100) / 100,
      },
      revenue: {
        recognized: recognizedRevenue,
        potential: potentialRevenue,
      },
      timeToClose: {
        average: Math.round(averageTimeToClose * 100) / 100,
        median: Math.round(medianTimeToClose * 100) / 100,
      },
    };
  }

  /**
   * Generate monthly report for a partner
   */
  async generateMonthlyReport(
    partnerId: string,
    year: number,
    month: number,
  ): Promise<MonthlyReport> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get current month metrics
    const currentMetrics = await this.calculatePartnerMetrics(
      partnerId,
      startDate,
      endDate,
    );

    // Get previous month for comparison
    const prevStartDate = new Date(year, month - 2, 1);
    const prevEndDate = new Date(year, month - 1, 0, 23, 59, 59);
    const previousMetrics = await this.calculatePartnerMetrics(
      partnerId,
      prevStartDate,
      prevEndDate,
    );

    // Calculate trends
    const opportunitiesGrowth =
      previousMetrics.opportunities.total > 0
        ? ((currentMetrics.opportunities.total -
            previousMetrics.opportunities.total) /
            previousMetrics.opportunities.total) *
          100
        : 0;

    const conversionRateChange =
      currentMetrics.proposals.conversionRate -
      previousMetrics.proposals.conversionRate;

    const revenueGrowth =
      previousMetrics.revenue.recognized > 0
        ? ((currentMetrics.revenue.recognized -
            previousMetrics.revenue.recognized) /
            previousMetrics.revenue.recognized) *
          100
        : 0;

    return {
      month: `${year}-${String(month).padStart(2, '0')}`,
      metrics: currentMetrics,
      trends: {
        opportunitiesGrowth: Math.round(opportunitiesGrowth * 100) / 100,
        conversionRateChange: Math.round(conversionRateChange * 100) / 100,
        revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      },
    };
  }

  /**
   * Get metrics for all partners (aggregated)
   */
  async getAllPartnersMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<Omit<PartnerMetrics, 'partnerId'>> {
    // Get all partners
    const partners = await this.prisma.partnerConfig.findMany({
      where: { isActive: true },
    });

    // Aggregate metrics across all partners
    let totalOpportunities = 0;
    let totalProposals = 0;
    let totalCampaigns = 0;
    let totalTasks = 0;
    let totalRevenue = 0;
    let totalPotentialRevenue = 0;

    for (const partner of partners) {
      const metrics = await this.calculatePartnerMetrics(
        partner.partnerId,
        startDate,
        endDate,
      );

      totalOpportunities += metrics.opportunities.total;
      totalProposals += metrics.proposals.total;
      totalCampaigns += metrics.campaigns.total;
      totalTasks += metrics.tasks.total;
      totalRevenue += metrics.revenue.recognized;
      totalPotentialRevenue += metrics.revenue.potential;
    }

    // Calculate averages
    const partnerCount = partners.length;
    const avgOpportunities =
      partnerCount > 0 ? totalOpportunities / partnerCount : 0;
    const avgProposals = partnerCount > 0 ? totalProposals / partnerCount : 0;

    return {
      period: { start: startDate, end: endDate },
      opportunities: {
        total: totalOpportunities,
        byStatus: {}, // Would need to aggregate across all partners
        totalValue: 0, // Would need to aggregate
        averageValue: 0,
      },
      proposals: {
        total: totalProposals,
        byStatus: {},
        conversionRate: 0, // Would need to calculate across all
        averageTimeToDecision: 0,
      },
      campaigns: {
        total: totalCampaigns,
        active: 0,
        completed: 0,
        totalBudget: 0,
      },
      tasks: {
        total: totalTasks,
        byStatus: {},
        completed: 0,
        completionRate: 0,
      },
      revenue: {
        recognized: totalRevenue,
        potential: totalPotentialRevenue,
      },
      timeToClose: {
        average: 0,
        median: 0,
      },
    };
  }
}

