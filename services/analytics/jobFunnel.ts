const log = getServiceLogger('analytics/jobFunnel');
/**
 * Job Funnel Analytics Service
 *
 * Tracks and aggregates job funnel metrics:
 * views → clicks → applies → hired
 *
 * Provides analytics APIs for partners and employers to understand
 * their hiring funnel performance.
 */

import { EventEmitter } from 'events';
import { getServiceLogger } from '../logging/serviceLogger';

export interface JobFunnelEvent {
  jobId: string;
  partnerId: string;
  eventType: 'view' | 'click' | 'apply' | 'hired';
  timestamp: Date;
  candidateId?: string;
  applicationId?: string;
  metadata?: Record<string, any>;
}

export interface JobFunnelMetrics {
  jobId: string;
  partnerId: string;
  views: number;
  clicks: number;
  applies: number;
  hired: number;
  viewToClickRate: number;
  clickToApplyRate: number;
  applyToHireRate: number;
  overallConversionRate: number;
  lastUpdated: Date;
}

export interface PartnerFunnelMetrics {
  partnerId: string;
  totalJobs: number;
  totalViews: number;
  totalClicks: number;
  totalApplies: number;
  totalHired: number;
  avgViewToClickRate: number;
  avgClickToApplyRate: number;
  avgApplyToHireRate: number;
  avgOverallConversionRate: number;
  jobMetrics: JobFunnelMetrics[];
  lastUpdated: Date;
}

/**
 * In-memory storage for demo purposes
 * In production, this would use a time-series database like InfluxDB or TimescaleDB
 */
const funnelData = new Map<string, {
  views: Set<string>;
  clicks: Set<string>;
  applies: Set<string>;
  hired: Set<string>;
}>();

class JobFunnelAnalytics extends EventEmitter {
  private static instance: JobFunnelAnalytics;

  private constructor() {
    super();
  }

  public static getInstance(): JobFunnelAnalytics {
    if (!JobFunnelAnalytics.instance) {
      JobFunnelAnalytics.instance = new JobFunnelAnalytics();
    }
    return JobFunnelAnalytics.instance;
  }

  /**
   * Track a funnel event
   */
  public trackEvent(event: JobFunnelEvent): void {
    const key = `${event.partnerId}:${event.jobId}`;

    if (!funnelData.has(key)) {
      funnelData.set(key, {
        views: new Set(),
        clicks: new Set(),
        applies: new Set(),
        hired: new Set(),
      });
    }

    const data = funnelData.get(key)!;
    const eventId = event.candidateId || event.applicationId || `anon-${Date.now()}`;

    switch (event.eventType) {
      case 'view':
        data.views.add(eventId);
        break;
      case 'click':
        data.clicks.add(eventId);
        break;
      case 'apply':
        if (event.applicationId) {
          data.applies.add(event.applicationId);
        }
        break;
      case 'hired':
        if (event.applicationId) {
          data.hired.add(event.applicationId);
        }
        break;
    }

    this.emit('funnel:event', event);
    log.info(`[Job Funnel] ${event.eventType} - Job: ${event.jobId}, Partner: ${event.partnerId}`);
  }

  /**
   * Get funnel metrics for a specific job
   */
  public getJobMetrics(partnerId: string, jobId: string): JobFunnelMetrics | null {
    const key = `${partnerId}:${jobId}`;
    const data = funnelData.get(key);

    if (!data) {
      return null;
    }

    const views = data.views.size;
    const clicks = data.clicks.size;
    const applies = data.applies.size;
    const hired = data.hired.size;

    const viewToClickRate = views > 0 ? (clicks / views) * 100 : 0;
    const clickToApplyRate = clicks > 0 ? (applies / clicks) * 100 : 0;
    const applyToHireRate = applies > 0 ? (hired / applies) * 100 : 0;
    const overallConversionRate = views > 0 ? (hired / views) * 100 : 0;

    return {
      jobId,
      partnerId,
      views,
      clicks,
      applies,
      hired,
      viewToClickRate: Math.round(viewToClickRate * 100) / 100,
      clickToApplyRate: Math.round(clickToApplyRate * 100) / 100,
      applyToHireRate: Math.round(applyToHireRate * 100) / 100,
      overallConversionRate: Math.round(overallConversionRate * 100) / 100,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get aggregated funnel metrics for a partner across all jobs
   */
  public getPartnerMetrics(partnerId: string): PartnerFunnelMetrics {
    const jobMetrics: JobFunnelMetrics[] = [];
    let totalViews = 0;
    let totalClicks = 0;
    let totalApplies = 0;
    let totalHired = 0;

    for (const [key, data] of funnelData.entries()) {
      if (key.startsWith(`${partnerId}:`)) {
        const jobId = key.split(':')[1];
        const metrics = this.getJobMetrics(partnerId, jobId);
        if (metrics) {
          jobMetrics.push(metrics);
          totalViews += metrics.views;
          totalClicks += metrics.clicks;
          totalApplies += metrics.applies;
          totalHired += metrics.hired;
        }
      }
    }

    const avgViewToClickRate = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
    const avgClickToApplyRate = totalClicks > 0 ? (totalApplies / totalClicks) * 100 : 0;
    const avgApplyToHireRate = totalApplies > 0 ? (totalHired / totalApplies) * 100 : 0;
    const avgOverallConversionRate = totalViews > 0 ? (totalHired / totalViews) * 100 : 0;

    return {
      partnerId,
      totalJobs: jobMetrics.length,
      totalViews,
      totalClicks,
      totalApplies,
      totalHired,
      avgViewToClickRate: Math.round(avgViewToClickRate * 100) / 100,
      avgClickToApplyRate: Math.round(avgClickToApplyRate * 100) / 100,
      avgApplyToHireRate: Math.round(avgApplyToHireRate * 100) / 100,
      avgOverallConversionRate: Math.round(avgOverallConversionRate * 100) / 100,
      jobMetrics,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get funnel metrics for multiple jobs
   */
  public getMultipleJobMetrics(partnerId: string, jobIds: string[]): JobFunnelMetrics[] {
    return jobIds
      .map((jobId) => this.getJobMetrics(partnerId, jobId))
      .filter((metrics): metrics is JobFunnelMetrics => metrics !== null);
  }

  /**
   * Reset metrics for a job (for testing)
   */
  public resetJobMetrics(partnerId: string, jobId: string): void {
    const key = `${partnerId}:${jobId}`;
    funnelData.delete(key);
  }

  /**
   * Reset all metrics (for testing)
   */
  public resetAllMetrics(): void {
    funnelData.clear();
  }
}

// Export singleton instance
export const jobFunnelAnalytics = JobFunnelAnalytics.getInstance();

/**
 * Helper functions for tracking funnel events
 */

export function trackJobView(
  partnerId: string,
  jobId: string,
  candidateId?: string,
  metadata?: Record<string, any>
): void {
  jobFunnelAnalytics.trackEvent({
    jobId,
    partnerId,
    eventType: 'view',
    timestamp: new Date(),
    candidateId,
    metadata,
  });
}

export function trackJobClick(
  partnerId: string,
  jobId: string,
  candidateId?: string,
  metadata?: Record<string, any>
): void {
  jobFunnelAnalytics.trackEvent({
    jobId,
    partnerId,
    eventType: 'click',
    timestamp: new Date(),
    candidateId,
    metadata,
  });
}

export function trackJobApply(
  partnerId: string,
  jobId: string,
  applicationId: string,
  candidateId?: string,
  metadata?: Record<string, any>
): void {
  jobFunnelAnalytics.trackEvent({
    jobId,
    partnerId,
    eventType: 'apply',
    timestamp: new Date(),
    applicationId,
    candidateId,
    metadata,
  });
}

export function trackJobHired(
  partnerId: string,
  jobId: string,
  applicationId: string,
  candidateId: string,
  metadata?: Record<string, any>
): void {
  jobFunnelAnalytics.trackEvent({
    jobId,
    partnerId,
    eventType: 'hired',
    timestamp: new Date(),
    applicationId,
    candidateId,
    metadata,
  });
}

/**
 * API Route Handlers
 * These would typically be in a separate routes file
 */

export interface JobFunnelAPIRequest {
  partnerId: string;
  jobId?: string;
  jobIds?: string[];
}

export async function getJobFunnelStats(
  request: JobFunnelAPIRequest
): Promise<JobFunnelMetrics | PartnerFunnelMetrics | JobFunnelMetrics[]> {
  const { partnerId, jobId, jobIds } = request;

  if (jobId) {
    const metrics = jobFunnelAnalytics.getJobMetrics(partnerId, jobId);
    if (!metrics) {
      throw new Error(`No metrics found for job ${jobId}`);
    }
    return metrics;
  }

  if (jobIds && jobIds.length > 0) {
    return jobFunnelAnalytics.getMultipleJobMetrics(partnerId, jobIds);
  }

  // Return partner-level metrics
  return jobFunnelAnalytics.getPartnerMetrics(partnerId);
}

