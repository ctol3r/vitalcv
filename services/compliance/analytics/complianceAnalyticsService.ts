/**
 * B239B-COM-019: ComplianceAnalyticsService
 *
 * Aggregates audit data for dashboards:
 * - Total events
 * - Distribution by obligation
 * - High-risk activities
 * Provides data for ComplianceOverviewDashboard.
 * Respects anonymity where applicable.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { queryAuditLogs, getAuditStatistics } from '../audit/auditLogQueryService.js';

const prisma = new PrismaClient();
const log = getServiceLogger('compliance/analytics');

export interface ComplianceAnalytics {
  period: { start: Date; end: Date };
  summary: {
    totalEvents: number;
    eventsByObligation: Record<string, number>;
    eventsByAction: Record<string, number>;
    eventsByEntityType: Record<string, number>;
  };
  trends: {
    dailyEvents: Array<{ date: string; count: number }>;
    obligationTrends: Record<string, Array<{ date: string; count: number }>>;
  };
  riskMetrics: {
    highRiskActions: number;
    failedAccessAttempts: number;
    dataExports: number;
    unauthorizedAccess: number;
  };
  topActors: Array<{
    actorId: string;
    eventCount: number;
    topActions: string[];
  }>;
  complianceScores: Record<string, number>; // obligationId -> score (0-100)
}

export interface AnalyticsOptions {
  orgId?: string;
  startDate: Date;
  endDate: Date;
  obligationIds?: string[];
  anonymize?: boolean; // Anonymize actor IDs for privacy
}

/**
 * Get compliance analytics for dashboard
 */
export async function getComplianceAnalytics(
  options: AnalyticsOptions
): Promise<ComplianceAnalytics> {
  try {
    const { startDate, endDate, orgId, obligationIds, anonymize = false } = options;

    // Get audit statistics
    const stats = await getAuditStatistics(startDate, endDate, {
      orgId,
      requireAccessRights: !!orgId,
    });

    // Get detailed audit logs for analysis
    const logs = await queryAuditLogs(
      {
        startDate,
        endDate,
        obligationId: obligationIds?.[0], // Can be expanded for multiple
      },
      { orgId, requireAccessRights: !!orgId }
    );

    // Build summary
    const summary = {
      totalEvents: stats.totalEvents,
      eventsByObligation: stats.byObligation,
      eventsByAction: stats.byAction,
      eventsByEntityType: stats.byEntityType,
    };

    // Calculate trends
    const trends = await calculateTrends(startDate, endDate, orgId, obligationIds);

    // Calculate risk metrics
    const riskMetrics = calculateRiskMetrics(logs.data);

    // Get top actors
    const topActors = await getTopActors(logs.data, anonymize);

    // Calculate compliance scores
    const complianceScores = await calculateComplianceScores(
      startDate,
      endDate,
      orgId,
      obligationIds
    );

    const analytics: ComplianceAnalytics = {
      period: { start: startDate, end: endDate },
      summary,
      trends,
      riskMetrics,
      topActors,
      complianceScores,
    };

    log.info('[getComplianceAnalytics] Analytics generated', {
      orgId,
      period: { start: startDate, end: endDate },
      totalEvents: stats.totalEvents,
    });

    return analytics;
  } catch (error) {
    log.error('[getComplianceAnalytics] Failed to generate analytics', {
      error,
      options,
    });
    throw error;
  }
}

async function calculateTrends(
  startDate: Date,
  endDate: Date,
  orgId?: string,
  obligationIds?: string[]
): Promise<ComplianceAnalytics['trends']> {
  const dailyEvents: Array<{ date: string; count: number }> = [];
  const obligationTrends: Record<string, Array<{ date: string; count: number }>> = {};

  // Generate date range
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Calculate daily event counts
  for (const date of dates) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayLogs = await queryAuditLogs(
      {
        startDate: dayStart,
        endDate: dayEnd,
      },
      { orgId, requireAccessRights: !!orgId }
    );

    dailyEvents.push({
      date: date.toISOString().split('T')[0],
      count: dayLogs.total,
    });

    // Calculate by obligation
    if (obligationIds) {
      for (const obligationId of obligationIds) {
        if (!obligationTrends[obligationId]) {
          obligationTrends[obligationId] = [];
        }

        const obligationLogs = await queryAuditLogs(
          {
            obligationId,
            startDate: dayStart,
            endDate: dayEnd,
          },
          { orgId, requireAccessRights: !!orgId }
        );

        obligationTrends[obligationId].push({
          date: date.toISOString().split('T')[0],
          count: obligationLogs.total,
        });
      }
    }
  }

  return { dailyEvents, obligationTrends };
}

function calculateRiskMetrics(
  events: Array<{ action: string; details: unknown }>
): ComplianceAnalytics['riskMetrics'] {
  let highRiskActions = 0;
  let failedAccessAttempts = 0;
  let dataExports = 0;
  let unauthorizedAccess = 0;

  for (const event of events) {
    // High-risk actions
    if (['delete', 'revoke', 'reject'].includes(event.action)) {
      highRiskActions++;
    }

    // Failed access attempts
    if (event.action === 'access') {
      const details = event.details as Record<string, unknown> | null;
      if (details?.success === false || details?.accessDenied === true) {
        failedAccessAttempts++;
      }
      if (details?.unauthorized === true) {
        unauthorizedAccess++;
      }
    }

    // Data exports
    if (event.action === 'export' || event.entityType === 'data_export') {
      dataExports++;
    }
  }

  return {
    highRiskActions,
    failedAccessAttempts,
    dataExports,
    unauthorizedAccess,
  };
}

async function getTopActors(
  events: Array<{ actorId: string | null; action: string }>,
  anonymize: boolean
): Promise<ComplianceAnalytics['topActors']> {
  const actorCounts: Record<string, { count: number; actions: Set<string> }> = {};

  for (const event of events) {
    if (!event.actorId) continue;

    const actorId = anonymize ? anonymizeActorId(event.actorId) : event.actorId;

    if (!actorCounts[actorId]) {
      actorCounts[actorId] = { count: 0, actions: new Set() };
    }

    actorCounts[actorId].count++;
    actorCounts[actorId].actions.add(event.action);
  }

  return Object.entries(actorCounts)
    .map(([actorId, data]) => ({
      actorId,
      eventCount: data.count,
      topActions: Array.from(data.actions).slice(0, 5),
    }))
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 10);
}

function anonymizeActorId(actorId: string): string {
  // Simple anonymization - hash the actor ID
  // In production, use a proper hashing function
  const hash = actorId.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);
  return `actor_${Math.abs(hash).toString(36)}`;
}

async function calculateComplianceScores(
  startDate: Date,
  endDate: Date,
  orgId?: string,
  obligationIds?: string[]
): Promise<Record<string, number>> {
  const scores: Record<string, number> = {};

  const obligations = obligationIds || ['GDPR', 'HIPAA', 'SOC2'];

  for (const obligationId of obligations) {
    const logs = await queryAuditLogs(
      {
        obligationId,
        startDate,
        endDate,
      },
      { orgId, requireAccessRights: !!orgId }
    );

    // Simple scoring: based on event coverage and absence of issues
    // In production, this would use more sophisticated logic
    const totalEvents = logs.total;
    const highRiskEvents = logs.data.filter((e) =>
      ['delete', 'revoke', 'reject'].includes(e.action)
    ).length;

    // Score decreases with high-risk events
    let score = 100;
    if (totalEvents > 0) {
      const riskRatio = highRiskEvents / totalEvents;
      score = Math.max(0, 100 - riskRatio * 50);
    }

    scores[obligationId] = Math.round(score);
  }

  return scores;
}

/**
 * Get real-time compliance metrics (last 24 hours)
 */
export async function getRealtimeComplianceMetrics(
  orgId?: string
): Promise<{
  last24Hours: {
    totalEvents: number;
    highRiskActions: number;
    failedAccessAttempts: number;
  };
  complianceStatus: Record<string, 'compliant' | 'warning' | 'non_compliant'>;
}> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

  const logs = await queryAuditLogs(
    {
      startDate,
      endDate,
    },
    { orgId, requireAccessRights: !!orgId }
  );

  const highRiskActions = logs.data.filter((e) =>
    ['delete', 'revoke', 'reject'].includes(e.action)
  ).length;

  const failedAccessAttempts = logs.data.filter((e) => {
    if (e.action !== 'access') return false;
    const details = e.details as Record<string, unknown> | null;
    return details?.success === false || details?.accessDenied === true;
  }).length;

  // Simple compliance status based on metrics
  const complianceStatus: Record<string, 'compliant' | 'warning' | 'non_compliant'> = {};
  if (failedAccessAttempts > 20) {
    complianceStatus['access_control'] = 'non_compliant';
  } else if (failedAccessAttempts > 10) {
    complianceStatus['access_control'] = 'warning';
  } else {
    complianceStatus['access_control'] = 'compliant';
  }

  return {
    last24Hours: {
      totalEvents: logs.total,
      highRiskActions,
      failedAccessAttempts,
    },
    complianceStatus,
  };
}

