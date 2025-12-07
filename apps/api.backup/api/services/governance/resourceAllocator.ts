/**
 * B220C-GOV-013: ResourceAllocator
 *
 * Allocates compute/queue bandwidth among modules based on priority, stability,
 * and forecast. Interfaces with RateGovernor to enforce limits.
 */

import { PrismaClient, JobQueueType, JobQueueStatus } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import { getQueueHealthSnapshot } from '../queue/models/JobQueue.js';
import { SupervisorRateLimiter } from '../supervisor/limits/rateLimiter.js';

const prisma = new PrismaClient();
const logger = createLogger({ service: 'resource-allocator' });

/**
 * Module resource allocation
 */
export interface ModuleAllocation {
  moduleId: string;
  priority: number; // 0-100
  stability: number; // 0-1, higher = more stable
  forecastedLoad: number; // Expected jobs per hour
  allocatedBandwidth: number; // Percentage of total bandwidth (0-1)
  maxConcurrentJobs: number;
  maxPendingJobs: number;
}

/**
 * Resource allocation plan
 */
export interface AllocationPlan {
  totalBandwidth: number; // Total available bandwidth units
  allocations: ModuleAllocation[];
  timestamp: Date;
}

/**
 * Module stability metrics
 */
export interface ModuleStability {
  moduleId: string;
  successRate: number; // 0-1
  avgLatency: number; // milliseconds
  errorRate: number; // 0-1
  recentFailures: number;
}

/**
 * Forecast data for load prediction
 */
export interface LoadForecast {
  moduleId: string;
  predictedLoad: number; // Jobs per hour
  confidence: number; // 0-1
  timeHorizon: number; // Hours ahead
}

/**
 * RateGovernor interface for enforcing limits
 */
export class RateGovernor {
  private rateLimiter: SupervisorRateLimiter;
  private moduleLimits: Map<string, { maxConcurrent: number; maxPending: number }> = new Map();

  constructor() {
    this.rateLimiter = new SupervisorRateLimiter();
  }

  /**
   * Set limits for a module
   */
  setModuleLimits(
    moduleId: string,
    maxConcurrent: number,
    maxPending: number
  ): void {
    this.moduleLimits.set(moduleId, { maxConcurrent, maxPending });
    logger.info('Set module limits', { moduleId, maxConcurrent, maxPending });
  }

  /**
   * Check if module can accept more jobs
   */
  async canAcceptJobs(moduleId: string, count: number): Promise<boolean> {
    const limits = this.moduleLimits.get(moduleId);
    if (!limits) return true; // No limits set

    // Get current queue state
    const snapshot = await getQueueHealthSnapshot();
    const moduleJobs = await this.getModuleJobCounts(moduleId);

    return (
      moduleJobs.running < limits.maxConcurrent &&
      moduleJobs.pending + count <= limits.maxPending
    );
  }

  /**
   * Get current job counts for a module
   */
  private async getModuleJobCounts(moduleId: string): Promise<{
    running: number;
    pending: number;
  }> {
    // Map module IDs to job queue types
    const moduleJobTypes = this.getModuleJobTypes(moduleId);

      const [running, pending] = await Promise.all([
      prisma.jobQueue.count({
        where: {
          type: { in: moduleJobTypes },
          status: JobQueueStatus.RUNNING,
        },
      }),
      prisma.jobQueue.count({
        where: {
          type: { in: moduleJobTypes },
          status: JobQueueStatus.PENDING,
        },
      }),
    ]);

    return { running, pending };
  }

  /**
   * Map module ID to job queue types
   */
  private getModuleJobTypes(moduleId: string): JobQueueType[] {
    const mapping: Record<string, JobQueueType[]> = {
      psv: ['PSV_RUN'],
      safety: ['SAFETY_SWEEP'],
      compliance: ['DRIFT_SWEEP'],
      fusion: ['FUSION_UPDATE'],
      ehr: ['EHR_SYNC'],
      mobility: ['MOBILITY_EVALUATE_ORG'],
      nci: ['NCI_PUBLISH_PROOFS'],
      supervisor: ['SUPERVISOR_RUN'],
    };
    return mapping[moduleId] || [];
  }
}

/**
 * ResourceAllocator allocates compute/queue bandwidth among modules
 */
export class ResourceAllocator {
  private rateGovernor: RateGovernor;
  private allocations: Map<string, ModuleAllocation> = new Map();
  private stabilityCache: Map<string, ModuleStability> = new Map();
  private forecastCache: Map<string, LoadForecast> = new Map();

  constructor() {
    this.rateGovernor = new RateGovernor();
  }

  /**
   * Calculate allocation plan based on priority, stability, and forecast
   */
  async calculateAllocation(
    modules: Array<{ moduleId: string; priority: number }>,
    totalBandwidth: number = 100
  ): Promise<AllocationPlan> {
    // Load stability metrics
    await this.loadStabilityMetrics(modules.map((m) => m.moduleId));

    // Load forecasts
    await this.loadForecasts(modules.map((m) => m.moduleId));

    // Calculate allocations
    const allocations: ModuleAllocation[] = [];

    // Calculate weighted scores for each module
    const scores = modules.map((module) => {
      const stability = this.stabilityCache.get(module.moduleId) || {
        moduleId: module.moduleId,
        successRate: 0.9,
        avgLatency: 1000,
        errorRate: 0.1,
        recentFailures: 0,
      };
      const forecast = this.forecastCache.get(module.moduleId) || {
        moduleId: module.moduleId,
        predictedLoad: 10,
        confidence: 0.5,
        timeHorizon: 1,
      };

      // Composite score: priority * stability * forecast confidence
      const score =
        module.priority *
        stability.successRate *
        (1 - stability.errorRate) *
        forecast.confidence;

      return {
        module,
        stability,
        forecast,
        score,
      };
    });

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);

    // Allocate bandwidth proportionally
    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);

    for (const { module, stability, forecast, score } of scores) {
      const bandwidthShare = totalScore > 0 ? (score / totalScore) * totalBandwidth : 0;
      const allocatedBandwidth = bandwidthShare / totalBandwidth; // Normalize to 0-1

      // Calculate limits based on bandwidth share
      const maxConcurrentJobs = Math.max(1, Math.floor(allocatedBandwidth * 20));
      const maxPendingJobs = Math.max(10, Math.floor(allocatedBandwidth * 200));

      const allocation: ModuleAllocation = {
        moduleId: module.moduleId,
        priority: module.priority,
        stability: stability.successRate,
        forecastedLoad: forecast.predictedLoad,
        allocatedBandwidth: allocatedBandwidth,
        maxConcurrentJobs,
        maxPendingJobs,
      };

      allocations.push(allocation);
      this.allocations.set(module.moduleId, allocation);

      // Update rate governor limits
      this.rateGovernor.setModuleLimits(module.moduleId, maxConcurrentJobs, maxPendingJobs);
    }

    logger.info('Calculated resource allocation', {
      totalBandwidth,
      allocations: allocations.length,
    });

    return {
      totalBandwidth,
      allocations,
      timestamp: new Date(),
    };
  }

  /**
   * Get current allocation for a module
   */
  getAllocation(moduleId: string): ModuleAllocation | null {
    return this.allocations.get(moduleId) || null;
  }

  /**
   * Check if module can accept more jobs
   */
  async canModuleAcceptJobs(moduleId: string, count: number): Promise<boolean> {
    return this.rateGovernor.canAcceptJobs(moduleId, count);
  }

  /**
   * Update module priority
   */
  updateModulePriority(moduleId: string, priority: number): void {
    const allocation = this.allocations.get(moduleId);
    if (allocation) {
      allocation.priority = priority;
      logger.info('Updated module priority', { moduleId, priority });
    }
  }

  /**
   * Get allocation statistics
   */
  getAllocationStats(): {
    totalModules: number;
    totalBandwidth: number;
    averageStability: number;
    averageForecastedLoad: number;
  } {
    const allocations = Array.from(this.allocations.values());
    if (allocations.length === 0) {
      return {
        totalModules: 0,
        totalBandwidth: 0,
        averageStability: 0,
        averageForecastedLoad: 0,
      };
    }

    const totalBandwidth = allocations.reduce((sum, a) => sum + a.allocatedBandwidth, 0);
    const averageStability =
      allocations.reduce((sum, a) => sum + a.stability, 0) / allocations.length;
    const averageForecastedLoad =
      allocations.reduce((sum, a) => sum + a.forecastedLoad, 0) / allocations.length;

    return {
      totalModules: allocations.length,
      totalBandwidth,
      averageStability,
      averageForecastedLoad,
    };
  }

  /**
   * Load stability metrics for modules
   */
  private async loadStabilityMetrics(moduleIds: string[]): Promise<void> {
    for (const moduleId of moduleIds) {
      const jobTypes = this.getModuleJobTypes(moduleId);

      if (jobTypes.length === 0) {
        // Default stability
        this.stabilityCache.set(moduleId, {
          moduleId,
          successRate: 0.9,
          avgLatency: 1000,
          errorRate: 0.1,
          recentFailures: 0,
        });
        continue;
      }

      // Get recent job outcomes
      const recentJobs = await prisma.jobQueue.findMany({
        where: {
          type: { in: jobTypes },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
        },
        take: 100,
      });

      if (recentJobs.length === 0) {
        this.stabilityCache.set(moduleId, {
          moduleId,
          successRate: 0.9,
          avgLatency: 1000,
          errorRate: 0.1,
          recentFailures: 0,
        });
        continue;
      }

      const completed = recentJobs.filter((j) => j.status === JobQueueStatus.COMPLETED).length;
      const failed = recentJobs.filter((j) => j.status === JobQueueStatus.FAILED_FINAL).length;
      const successRate = completed / recentJobs.length;
      const errorRate = failed / recentJobs.length;

      // Calculate average latency
      const completedJobs = recentJobs.filter(
        (j) => j.startedAt && j.completedAt && j.status === JobQueueStatus.COMPLETED
      );
      const avgLatency =
        completedJobs.length > 0
          ? completedJobs.reduce(
              (sum, j) =>
                sum + (j.completedAt!.getTime() - j.startedAt!.getTime()),
              0
            ) / completedJobs.length
          : 1000;

      this.stabilityCache.set(moduleId, {
        moduleId,
        successRate,
        avgLatency,
        errorRate,
        recentFailures: failed,
      });
    }
  }

  /**
   * Load forecasts for modules (simplified - in production would use ML model)
   */
  private async loadForecasts(moduleIds: string[]): Promise<void> {
    for (const moduleId of moduleIds) {
      const jobTypes = this.getModuleJobTypes(moduleId);

      if (jobTypes.length === 0) {
        this.forecastCache.set(moduleId, {
          moduleId,
          predictedLoad: 10,
          confidence: 0.5,
          timeHorizon: 1,
        });
        continue;
      }

      // Simple forecast based on recent history
      const recentJobs = await prisma.jobQueue.count({
        where: {
          type: { in: jobTypes },
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
        },
      });

      this.forecastCache.set(moduleId, {
        moduleId,
        predictedLoad: recentJobs,
        confidence: 0.7,
        timeHorizon: 1,
      });
    }
  }

  /**
   * Map module ID to job queue types
   */
  private getModuleJobTypes(moduleId: string): JobQueueType[] {
    const mapping: Record<string, JobQueueType[]> = {
      psv: ['PSV_RUN'],
      safety: ['SAFETY_SWEEP'],
      compliance: ['DRIFT_SWEEP'],
      fusion: ['FUSION_UPDATE'],
      ehr: ['EHR_SYNC'],
      mobility: ['MOBILITY_EVALUATE_ORG'],
      nci: ['NCI_PUBLISH_PROOFS'],
      supervisor: ['SUPERVISOR_RUN'],
    };
    return mapping[moduleId] || [];
  }
}

// Export singleton instance
export const resourceAllocator = new ResourceAllocator();
export { RateGovernor };

