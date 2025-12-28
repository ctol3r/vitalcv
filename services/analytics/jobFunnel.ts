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
  eventType: 'view' | 'click' | 'apply' | 'interview' | 'offer' | 'hire' | 'hired';
  timestamp: Date;
  candidateId?: string;
  applicationId?: string;
  credentialId?: string;
  issuerDid?: string;
  metadata?: Record<string, any>;
}

export interface JobFunnelMetrics {
  jobId: string;
  partnerId: string;
  views: number;
  clicks: number;
  applies: number;
  interviews: number;
  offers: number;
  hired: number;
  hires: number;
  viewToClickRate: number;
  clickToApplyRate: number;
  applyToInterviewRate: number;
  interviewToOfferRate: number;
  offerToHireRate: number;
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
  totalInterviews: number;
  totalOffers: number;
  totalHired: number;
  avgViewToClickRate: number;
  avgClickToApplyRate: number;
  avgApplyToInterviewRate: number;
  avgInterviewToOfferRate: number;
  avgOfferToHireRate: number;
  avgApplyToHireRate: number;
  avgOverallConversionRate: number;
  jobMetrics: JobFunnelMetrics[];
  lastUpdated: Date;
}

export interface FunnelDimensionMetrics {
  dimension: 'credential' | 'issuer';
  id: string;
  views: number;
  clicks: number;
  applies: number;
  interviews: number;
  offers: number;
  hires: number;
  viewToClickRate: number;
  clickToApplyRate: number;
  applyToInterviewRate: number;
  interviewToOfferRate: number;
  offerToHireRate: number;
  applyToHireRate: number;
  overallConversionRate: number;
  lastUpdated: Date;
}

/**
 * In-memory storage for demo purposes
 * In production, this would use a time-series database like InfluxDB or TimescaleDB
 */
type FunnelBucket = {
  views: Set<string>;
  clicks: Set<string>;
  applies: Set<string>;
  interviews: Set<string>;
  offers: Set<string>;
  hires: Set<string>;
};

const funnelData = new Map<string, FunnelBucket>();
const credentialFunnelData = new Map<string, FunnelBucket>();
const issuerFunnelData = new Map<string, FunnelBucket>();

function createBucket(): FunnelBucket {
  return {
    views: new Set(),
    clicks: new Set(),
    applies: new Set(),
    interviews: new Set(),
    offers: new Set(),
    hires: new Set(),
  };
}

function resolveBucket(store: Map<string, FunnelBucket>, key: string): FunnelBucket {
  if (!store.has(key)) {
    store.set(key, createBucket());
  }
  return store.get(key)!;
}

function applyEventToBucket(
  bucket: FunnelBucket,
  eventType: JobFunnelEvent['eventType'] | 'hired',
  eventId: string
): void {
  switch (eventType) {
    case 'view':
      bucket.views.add(eventId);
      break;
    case 'click':
      bucket.clicks.add(eventId);
      break;
    case 'apply':
      bucket.applies.add(eventId);
      break;
    case 'interview':
      bucket.interviews.add(eventId);
      break;
    case 'offer':
      bucket.offers.add(eventId);
      break;
    case 'hire':
    case 'hired':
      bucket.hires.add(eventId);
      break;
  }
}

function summarizeBucket(bucket: FunnelBucket): {
  views: number;
  clicks: number;
  applies: number;
  interviews: number;
  offers: number;
  hires: number;
  viewToClickRate: number;
  clickToApplyRate: number;
  applyToInterviewRate: number;
  interviewToOfferRate: number;
  offerToHireRate: number;
  applyToHireRate: number;
  overallConversionRate: number;
} {
  const views = bucket.views.size;
  const clicks = bucket.clicks.size;
  const applies = bucket.applies.size;
  const interviews = bucket.interviews.size;
  const offers = bucket.offers.size;
  const hires = bucket.hires.size;

  const viewToClickRate = views > 0 ? (clicks / views) * 100 : 0;
  const clickToApplyRate = clicks > 0 ? (applies / clicks) * 100 : 0;
  const applyToInterviewRate = applies > 0 ? (interviews / applies) * 100 : 0;
  const interviewToOfferRate = interviews > 0 ? (offers / interviews) * 100 : 0;
  const offerToHireRate = offers > 0 ? (hires / offers) * 100 : 0;
  const applyToHireRate = applies > 0 ? (hires / applies) * 100 : 0;
  const overallConversionRate = views > 0 ? (hires / views) * 100 : 0;

  return {
    views,
    clicks,
    applies,
    interviews,
    offers,
    hires,
    viewToClickRate,
    clickToApplyRate,
    applyToInterviewRate,
    interviewToOfferRate,
    offerToHireRate,
    applyToHireRate,
    overallConversionRate,
  };
}

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

    const jobBucket = resolveBucket(funnelData, key);
    const eventId = event.applicationId || event.candidateId || `anon-${Date.now()}`;
    const normalizedEventType = event.eventType === 'hire' ? 'hired' : event.eventType;

    applyEventToBucket(jobBucket, normalizedEventType, eventId);

    if (event.credentialId) {
      const credentialBucket = resolveBucket(credentialFunnelData, event.credentialId);
      applyEventToBucket(credentialBucket, normalizedEventType, eventId);
    }

    if (event.issuerDid) {
      const issuerBucket = resolveBucket(issuerFunnelData, event.issuerDid);
      applyEventToBucket(issuerBucket, normalizedEventType, eventId);
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

    const summary = summarizeBucket(data);

    return {
      jobId,
      partnerId,
      views: summary.views,
      clicks: summary.clicks,
      applies: summary.applies,
      interviews: summary.interviews,
      offers: summary.offers,
      hired: summary.hires,
      hires: summary.hires,
      viewToClickRate: Math.round(summary.viewToClickRate * 100) / 100,
      clickToApplyRate: Math.round(summary.clickToApplyRate * 100) / 100,
      applyToInterviewRate: Math.round(summary.applyToInterviewRate * 100) / 100,
      interviewToOfferRate: Math.round(summary.interviewToOfferRate * 100) / 100,
      offerToHireRate: Math.round(summary.offerToHireRate * 100) / 100,
      applyToHireRate: Math.round(summary.applyToHireRate * 100) / 100,
      overallConversionRate: Math.round(summary.overallConversionRate * 100) / 100,
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
    let totalInterviews = 0;
    let totalOffers = 0;
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
          totalInterviews += metrics.interviews;
          totalOffers += metrics.offers;
          totalHired += metrics.hires;
        }
      }
    }

    const avgViewToClickRate = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
    const avgClickToApplyRate = totalClicks > 0 ? (totalApplies / totalClicks) * 100 : 0;
    const avgApplyToInterviewRate = totalApplies > 0 ? (totalInterviews / totalApplies) * 100 : 0;
    const avgInterviewToOfferRate =
      totalInterviews > 0 ? (totalOffers / totalInterviews) * 100 : 0;
    const avgOfferToHireRate = totalOffers > 0 ? (totalHired / totalOffers) * 100 : 0;
    const avgApplyToHireRate = totalApplies > 0 ? (totalHired / totalApplies) * 100 : 0;
    const avgOverallConversionRate = totalViews > 0 ? (totalHired / totalViews) * 100 : 0;

    return {
      partnerId,
      totalJobs: jobMetrics.length,
      totalViews,
      totalClicks,
      totalApplies,
      totalInterviews,
      totalOffers,
      totalHired,
      avgViewToClickRate: Math.round(avgViewToClickRate * 100) / 100,
      avgClickToApplyRate: Math.round(avgClickToApplyRate * 100) / 100,
      avgApplyToInterviewRate: Math.round(avgApplyToInterviewRate * 100) / 100,
      avgInterviewToOfferRate: Math.round(avgInterviewToOfferRate * 100) / 100,
      avgOfferToHireRate: Math.round(avgOfferToHireRate * 100) / 100,
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

  public getCredentialMetrics(credentialId: string): FunnelDimensionMetrics | null {
    const data = credentialFunnelData.get(credentialId);
    if (!data) {
      return null;
    }
    const summary = summarizeBucket(data);
    return {
      dimension: 'credential',
      id: credentialId,
      ...summary,
      viewToClickRate: Math.round(summary.viewToClickRate * 100) / 100,
      clickToApplyRate: Math.round(summary.clickToApplyRate * 100) / 100,
      applyToInterviewRate: Math.round(summary.applyToInterviewRate * 100) / 100,
      interviewToOfferRate: Math.round(summary.interviewToOfferRate * 100) / 100,
      offerToHireRate: Math.round(summary.offerToHireRate * 100) / 100,
      applyToHireRate: Math.round(summary.applyToHireRate * 100) / 100,
      overallConversionRate: Math.round(summary.overallConversionRate * 100) / 100,
      lastUpdated: new Date(),
    };
  }

  public getIssuerMetrics(issuerDid: string): FunnelDimensionMetrics | null {
    const data = issuerFunnelData.get(issuerDid);
    if (!data) {
      return null;
    }
    const summary = summarizeBucket(data);
    return {
      dimension: 'issuer',
      id: issuerDid,
      ...summary,
      viewToClickRate: Math.round(summary.viewToClickRate * 100) / 100,
      clickToApplyRate: Math.round(summary.clickToApplyRate * 100) / 100,
      applyToInterviewRate: Math.round(summary.applyToInterviewRate * 100) / 100,
      interviewToOfferRate: Math.round(summary.interviewToOfferRate * 100) / 100,
      offerToHireRate: Math.round(summary.offerToHireRate * 100) / 100,
      applyToHireRate: Math.round(summary.applyToHireRate * 100) / 100,
      overallConversionRate: Math.round(summary.overallConversionRate * 100) / 100,
      lastUpdated: new Date(),
    };
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
    credentialFunnelData.clear();
    issuerFunnelData.clear();
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
  credentialId?: string,
  issuerDid?: string,
  metadata?: Record<string, any>
): void {
  jobFunnelAnalytics.trackEvent({
    jobId,
    partnerId,
    eventType: 'view',
    timestamp: new Date(),
    candidateId,
    credentialId,
    issuerDid,
    metadata,
  });
}

export function trackJobClick(
  partnerId: string,
  jobId: string,
  candidateId?: string,
  credentialId?: string,
  issuerDid?: string,
  metadata?: Record<string, any>
): void {
  jobFunnelAnalytics.trackEvent({
    jobId,
    partnerId,
    eventType: 'click',
    timestamp: new Date(),
    candidateId,
    credentialId,
    issuerDid,
    metadata,
  });
}

export function trackJobApply(
  partnerId: string,
  jobId: string,
  applicationId: string,
  candidateId?: string,
  credentialId?: string,
  issuerDid?: string,
  metadata?: Record<string, any>
): void {
  jobFunnelAnalytics.trackEvent({
    jobId,
    partnerId,
    eventType: 'apply',
    timestamp: new Date(),
    applicationId,
    candidateId,
    credentialId,
    issuerDid,
    metadata,
  });
}

export function trackJobHired(
  partnerId: string,
  jobId: string,
  applicationId: string,
  candidateId: string,
  credentialId?: string,
  issuerDid?: string,
  metadata?: Record<string, any>
): void {
  jobFunnelAnalytics.trackEvent({
    jobId,
    partnerId,
    eventType: 'hired',
    timestamp: new Date(),
    applicationId,
    candidateId,
    credentialId,
    issuerDid,
    metadata,
  });
}

export function trackJobInterviewScheduled(
  partnerId: string,
  jobId: string,
  applicationId: string,
  candidateId?: string,
  credentialId?: string,
  issuerDid?: string,
  metadata?: Record<string, any>
): void {
  jobFunnelAnalytics.trackEvent({
    jobId,
    partnerId,
    eventType: 'interview',
    timestamp: new Date(),
    applicationId,
    candidateId,
    credentialId,
    issuerDid,
    metadata,
  });
}

export function trackJobOfferExtended(
  partnerId: string,
  jobId: string,
  applicationId: string,
  candidateId?: string,
  credentialId?: string,
  issuerDid?: string,
  metadata?: Record<string, any>
): void {
  jobFunnelAnalytics.trackEvent({
    jobId,
    partnerId,
    eventType: 'offer',
    timestamp: new Date(),
    applicationId,
    candidateId,
    credentialId,
    issuerDid,
    metadata,
  });
}

export function trackJobHire(
  partnerId: string,
  jobId: string,
  applicationId: string,
  candidateId?: string,
  credentialId?: string,
  issuerDid?: string,
  metadata?: Record<string, any>
): void {
  jobFunnelAnalytics.trackEvent({
    jobId,
    partnerId,
    eventType: 'hire',
    timestamp: new Date(),
    applicationId,
    candidateId,
    credentialId,
    issuerDid,
    metadata,
  });
}

/**
 * API Route Handlers
 * These would typically be in a separate routes file
 */

export interface JobFunnelAPIRequest {
  partnerId?: string;
  jobId?: string;
  jobIds?: string[];
  credentialId?: string;
  issuerDid?: string;
}

export async function getJobFunnelStats(
  request: JobFunnelAPIRequest
): Promise<JobFunnelMetrics | PartnerFunnelMetrics | JobFunnelMetrics[] | FunnelDimensionMetrics> {
  const { partnerId, jobId, jobIds, credentialId, issuerDid } = request;

  if (credentialId) {
    const metrics = jobFunnelAnalytics.getCredentialMetrics(credentialId);
    if (!metrics) {
      throw new Error(`No metrics found for credential ${credentialId}`);
    }
    return metrics;
  }

  if (issuerDid) {
    const metrics = jobFunnelAnalytics.getIssuerMetrics(issuerDid);
    if (!metrics) {
      throw new Error(`No metrics found for issuer ${issuerDid}`);
    }
    return metrics;
  }

  if (jobId) {
    if (!partnerId) {
      throw new Error('partnerId is required for job metrics');
    }
    const metrics = jobFunnelAnalytics.getJobMetrics(partnerId, jobId);
    if (!metrics) {
      throw new Error(`No metrics found for job ${jobId}`);
    }
    return metrics;
  }

  if (jobIds && jobIds.length > 0) {
    if (!partnerId) {
      throw new Error('partnerId is required for job metrics');
    }
    return jobFunnelAnalytics.getMultipleJobMetrics(partnerId, jobIds);
  }

  // Return partner-level metrics
  if (!partnerId) {
    throw new Error('partnerId is required for partner metrics');
  }
  return jobFunnelAnalytics.getPartnerMetrics(partnerId);
}
