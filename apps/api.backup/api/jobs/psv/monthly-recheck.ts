/**
 * Continuous Monthly Rechecks Scheduler
 * Runs monthly rechecks and appends evidence
 */

import { getPSVChecksForProvider, storePSVCheck, PSVCheck } from './evidence';
import { getSource } from './registry';
import { getFreshnessManager, FreshnessPolicyManager } from './freshness';
import { createEvidenceBundle } from './evidence';

export interface RecheckJob {
  id: string;
  providerId: string;
  checkType: string;
  scheduledAt: number;
  executedAt?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: 'verified' | 'failed' | 'pending';
  error?: string;
}

export interface RecheckDelta {
  providerId: string;
  checkId: string;
  checkType: string;
  previousResult: 'verified' | 'failed' | 'pending';
  newResult: 'verified' | 'failed' | 'pending';
  changed: boolean;
  timestamp: number;
}

/**
 * Monthly rechecks scheduler
 */
export class MonthlyRecheckScheduler {
  private jobs: Map<string, RecheckJob>;
  private deltas: RecheckDelta[];
  private freshnessManager: FreshnessPolicyManager;

  constructor() {
    this.jobs = new Map();
    this.deltas = [];
    this.freshnessManager = getFreshnessManager();
  }

  /**
   * Schedule monthly recheck for a provider
   */
  scheduleRecheck(providerId: string, checkType: string): RecheckJob {
    const jobId = `recheck-${providerId}-${checkType}-${Date.now()}`;

    const job: RecheckJob = {
      id: jobId,
      providerId,
      checkType,
      scheduledAt: Date.now(),
      status: 'pending',
    };

    this.jobs.set(jobId, job);
    return job;
  }

  /**
   * Execute recheck job
   */
  async executeRecheck(jobId: string): Promise<{ success: boolean; delta?: RecheckDelta; error?: string }> {
    const job = this.jobs.get(jobId);

    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    if (job.status === 'running') {
      return { success: false, error: 'Job already running' };
    }

    job.status = 'running';
    job.executedAt = Date.now();

    try {
      // Get existing PSV checks for provider
      const existingChecks = getPSVChecksForProvider(job.providerId);
      const existingCheck = existingChecks.find(c => c.checkType === job.checkType);

      if (!existingCheck) {
        job.status = 'failed';
        job.error = 'No existing check found';
        return { success: false, error: 'No existing check found' };
      }

      // Get source configuration
      const source = getSource(existingCheck.sourceId);
      if (!source) {
        job.status = 'failed';
        job.error = 'Source not found';
        return { success: false, error: 'Source not found' };
      }

      // Perform recheck (in production, call actual API)
      const request = { providerId: job.providerId, checkType: job.checkType };
      const response = { status: 'verified', timestamp: Date.now() }; // Mock response

      // Create new evidence bundle
      const evidenceBundle = createEvidenceBundle(
        source,
        request,
        response,
        'NCQA-2025',
        'system', // Reviewer
        response.status === 'verified' ? 'verified' : 'failed'
      );

      // Create new PSV check
      const newCheck: PSVCheck = {
        id: `check-${job.providerId}-${job.checkType}-${Date.now()}`,
        providerId: job.providerId,
        checkType: job.checkType,
        sourceId: existingCheck.sourceId,
        evidenceBundle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Store new check
      storePSVCheck(newCheck);

      // Check for deltas
      const previousResult = existingCheck.evidenceBundle.result;
      const newResult = newCheck.evidenceBundle.result;
      const changed = previousResult !== newResult;

      let delta: RecheckDelta | undefined;

      if (changed) {
        delta = {
          providerId: job.providerId,
          checkId: newCheck.id,
          checkType: job.checkType,
          previousResult,
          newResult,
          changed: true,
          timestamp: Date.now(),
        };

        this.deltas.push(delta);

        // Emit alert on delta
        console.log('[ALERT] PSV check result changed:', delta);
      }

      job.status = 'completed';
      job.result = newResult;

      return { success: true, delta };
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: job.error };
    }
  }

  /**
   * Run monthly rechecks for all providers
   */
  async runMonthlyRechecks(): Promise<{ completed: number; failed: number; deltas: RecheckDelta[] }> {
    // In production, get all providers from database
    // For now, use existing checks to determine providers
    const providers = new Set<string>();
    // This would query the database in production

    const jobs: RecheckJob[] = [];
    const checkTypes = ['CR1', 'CR2'];

    // Schedule jobs for all providers
    providers.forEach(providerId => {
      checkTypes.forEach(checkType => {
        const job = this.scheduleRecheck(providerId, checkType);
        jobs.push(job);
      });
    });

    // Execute all jobs
    const results = await Promise.allSettled(
      jobs.map(job => this.executeRecheck(job.id))
    );

    const completed = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    const deltas = results
      .filter(r => r.status === 'fulfilled' && r.value.delta)
      .map(r => (r as PromiseFulfilledResult<{ delta?: RecheckDelta }>).value.delta!)
      .filter(Boolean);

    return { completed, failed, deltas };
  }

  /**
   * Get deltas since last run
   */
  getDeltas(since?: number): RecheckDelta[] {
    if (since) {
      return this.deltas.filter(d => d.timestamp >= since);
    }
    return [...this.deltas];
  }
}

// Singleton instance
let scheduler: MonthlyRecheckScheduler | null = null;

export function getRecheckScheduler(): MonthlyRecheckScheduler {
  if (!scheduler) {
    scheduler = new MonthlyRecheckScheduler();
  }
  return scheduler;
}

/**
 * Cron job wrapper for monthly rechecks
 * Call this from a cron scheduler (e.g., node-cron)
 */
export async function runMonthlyRecheckCron() {
  const scheduler = getRecheckScheduler();
  const result = await scheduler.runMonthlyRechecks();

  console.log('[MONTHLY RECHECK]', {
    completed: result.completed,
    failed: result.failed,
    deltas: result.deltas.length,
    timestamp: new Date().toISOString(),
  });

  // Emit alerts on deltas
  result.deltas.forEach(delta => {
    console.log('[ALERT] PSV delta detected:', delta);
  });

  return result;
}

