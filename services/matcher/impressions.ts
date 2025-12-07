import { getServiceLogger } from '../logging/serviceLogger';
const log = getServiceLogger('matcher/impressions');
/**
 * B132A-IMPRESSION-015: Match impression logging (jobId, rank, clicked/applied)
 *
 * Impressions saved; simple CTR computed; read-API exports stats
 */

export interface Impression {
  id: string;
  clinicianDid: string;
  jobId: string;
  rank?: number;
  action: 'matched' | 'viewed' | 'clicked' | 'applied';
  timestamp: Date;
  metadata?: any;
}

export interface ImpressionStats {
  jobId: string;
  impressions: number;
  clicks: number;
  applications: number;
  ctr: number; // Click-through rate
  conversionRate: number; // Application rate
}

// In-memory store (in production, use database)
const impressions: Impression[] = [];

/**
 * Log an impression for one or more jobs
 */
export async function logImpression(
  clinicianDid: string,
  jobIds: string[],
  action: 'matched' | 'viewed' | 'clicked' | 'applied',
  metadata?: any
): Promise<void> {
  const timestamp = new Date();

  for (const jobId of jobIds) {
    const impression: Impression = {
      id: `imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      clinicianDid,
      jobId,
      action,
      timestamp,
      metadata,
    };

    impressions.push(impression);
  }

  log.info(`[impressions] Logged ${action} for ${jobIds.length} job(s) by ${clinicianDid}`);
}

/**
 * Log a single impression with rank
 */
export async function logImpressionWithRank(
  clinicianDid: string,
  jobId: string,
  rank: number,
  action: 'matched' | 'viewed' | 'clicked' | 'applied',
  metadata?: any
): Promise<void> {
  const impression: Impression = {
    id: `imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    clinicianDid,
    jobId,
    rank,
    action,
    timestamp: new Date(),
    metadata,
  };

  impressions.push(impression);
  log.info(`[impressions] Logged ${action} for job ${jobId} (rank ${rank}) by ${clinicianDid}`);
}

/**
 * Get impression stats for a job
 */
export function getJobImpressionStats(jobId: string): ImpressionStats {
  const jobImpressions = impressions.filter(imp => imp.jobId === jobId);

  const total = jobImpressions.length;
  const matched = jobImpressions.filter(imp => imp.action === 'matched').length;
  const clicks = jobImpressions.filter(imp => imp.action === 'clicked').length;
  const applications = jobImpressions.filter(imp => imp.action === 'applied').length;

  // Calculate CTR (clicks / impressions)
  const ctr = matched > 0 ? clicks / matched : 0;

  // Calculate conversion rate (applications / clicks or applications / impressions)
  const conversionRate = clicks > 0 ? applications / clicks : (matched > 0 ? applications / matched : 0);

  return {
    jobId,
    impressions: matched,
    clicks,
    applications,
    ctr,
    conversionRate,
  };
}

/**
 * Get impression stats for all jobs
 */
export function getAllImpressionStats(): ImpressionStats[] {
  const jobIds = new Set(impressions.map(imp => imp.jobId));
  return Array.from(jobIds).map(jobId => getJobImpressionStats(jobId));
}

/**
 * Get impression stats for a clinician
 */
export function getClinicianImpressions(clinicianDid: string): {
  totalMatched: number;
  totalClicked: number;
  totalApplied: number;
  jobsMatched: string[];
  jobsClicked: string[];
  jobsApplied: string[];
} {
  const clinicianImps = impressions.filter(imp => imp.clinicianDid === clinicianDid);

  return {
    totalMatched: clinicianImps.filter(imp => imp.action === 'matched').length,
    totalClicked: clinicianImps.filter(imp => imp.action === 'clicked').length,
    totalApplied: clinicianImps.filter(imp => imp.action === 'applied').length,
    jobsMatched: [...new Set(clinicianImps.filter(imp => imp.action === 'matched').map(imp => imp.jobId))],
    jobsClicked: [...new Set(clinicianImps.filter(imp => imp.action === 'clicked').map(imp => imp.jobId))],
    jobsApplied: [...new Set(clinicianImps.filter(imp => imp.action === 'applied').map(imp => imp.jobId))],
  };
}

/**
 * Get recent impressions
 */
export function getRecentImpressions(
  limit: number = 100,
  action?: 'matched' | 'viewed' | 'clicked' | 'applied'
): Impression[] {
  let filtered = impressions;

  if (action) {
    filtered = filtered.filter(imp => imp.action === action);
  }

  return filtered
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

/**
 * Clear old impressions (for cleanup)
 */
export function clearOldImpressions(olderThanDays: number = 90): number {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const initialLength = impressions.length;
  const filtered = impressions.filter(imp => imp.timestamp >= cutoffDate);

  impressions.splice(0, impressions.length, ...filtered);

  const removed = initialLength - impressions.length;
  log.info(`[impressions] Cleared ${removed} old impressions`);

  return removed;
}

