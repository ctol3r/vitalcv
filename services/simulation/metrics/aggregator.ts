/**
 * SimulationMetricsAggregator
 *
 * Collects simulation results: timing, success rates, drift frequency, recovery times
 * Integrates with global observability system
 */

import { PrismaClient } from '@prisma/client';
import type { SimulationMetrics, SimulationRunResult } from '../engine.js';

const prisma = new PrismaClient();

export interface AggregatedMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  averageDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  averageDriftFrequency?: number;
  averageRecoveryTime?: number;
  totalFaultsInjected: number;
  totalEventsExecuted: number;
  metricsByScenario: Record<string, ScenarioMetrics>;
  metricsByType: Record<string, ScenarioMetrics>;
  timestamp: Date;
}

export interface ScenarioMetrics {
  scenarioId: string;
  scenarioName?: string;
  scenarioType?: string;
  runCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDuration: number;
  averageDriftFrequency?: number;
  averageRecoveryTime?: number;
  totalFaultsInjected: number;
  totalEventsExecuted: number;
}

export interface MetricsQueryOptions {
  scenarioId?: string;
  scenarioType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/**
 * SimulationMetricsAggregator collects and aggregates simulation metrics
 */
export class SimulationMetricsAggregator {
  /**
   * Aggregate metrics from simulation runs
   */
  async aggregateMetrics(options?: MetricsQueryOptions): Promise<AggregatedMetrics> {
    const runs = await this.queryRuns(options);

    if (runs.length === 0) {
      return this.emptyMetrics();
    }

    const successfulRuns = runs.filter((r) => r.status === 'completed' && r.metrics);
    const failedRuns = runs.filter((r) => r.status === 'failed');

    const durations = successfulRuns
      .map((r) => {
        const metrics = r.metrics as SimulationMetrics | null;
        return metrics?.timing?.totalDuration ?? 0;
      })
      .filter((d) => d > 0)
      .sort((a, b) => a - b);

    const driftFrequencies = successfulRuns
      .map((r) => {
        const metrics = r.metrics as SimulationMetrics | null;
        return metrics?.driftFrequency;
      })
      .filter((f): f is number => f !== undefined);

    const recoveryTimes = successfulRuns
      .map((r) => {
        const metrics = r.metrics as SimulationMetrics | null;
        return metrics?.timing?.recoveryTime;
      })
      .filter((t): t is number => t !== undefined);

    const totalFaultsInjected = successfulRuns.reduce((sum, r) => {
      const metrics = r.metrics as SimulationMetrics | null;
      return sum + (metrics?.faultsInjected ?? 0);
    }, 0);

    const totalEventsExecuted = successfulRuns.reduce((sum, r) => {
      const metrics = r.metrics as SimulationMetrics | null;
      return sum + (metrics?.eventsExecuted ?? 0);
    }, 0);

    const metricsByScenario = await this.aggregateByScenario(runs);
    const metricsByType = await this.aggregateByType(runs);

    return {
      totalRuns: runs.length,
      successfulRuns: successfulRuns.length,
      failedRuns: failedRuns.length,
      successRate: successfulRuns.length / runs.length,
      averageDuration: this.average(durations),
      p50Duration: this.percentile(durations, 0.5),
      p95Duration: this.percentile(durations, 0.95),
      p99Duration: this.percentile(durations, 0.99),
      averageDriftFrequency: driftFrequencies.length > 0 ? this.average(driftFrequencies) : undefined,
      averageRecoveryTime: recoveryTimes.length > 0 ? this.average(recoveryTimes) : undefined,
      totalFaultsInjected,
      totalEventsExecuted,
      metricsByScenario,
      metricsByType,
      timestamp: new Date(),
    };
  }

  /**
   * Aggregate metrics by scenario
   */
  private async aggregateByScenario(
    runs: Array<{ scenarioId: string; status: string; metrics: any }>
  ): Promise<Record<string, ScenarioMetrics>> {
    const scenarioMap = new Map<string, ScenarioMetrics>();

    for (const run of runs) {
      const scenario = await prisma.simulationScenario.findUnique({
        where: { id: run.scenarioId },
        select: { id: true, name: true, scenarioType: true },
      });

      if (!scenario) continue;

      const existing = scenarioMap.get(run.scenarioId);
      const metrics = run.metrics as SimulationMetrics | null;
      const duration = metrics?.timing?.totalDuration ?? 0;

      if (existing) {
        existing.runCount++;
        if (run.status === 'completed' && metrics) {
          existing.successCount++;
          existing.averageDuration =
            (existing.averageDuration * (existing.runCount - existing.successCount) + duration) /
            existing.successCount;
          existing.totalFaultsInjected += metrics.faultsInjected ?? 0;
          existing.totalEventsExecuted += metrics.eventsExecuted ?? 0;
          if (metrics.driftFrequency !== undefined) {
            existing.averageDriftFrequency =
              (existing.averageDriftFrequency ?? 0) + metrics.driftFrequency;
          }
          if (metrics.timing.recoveryTime !== undefined) {
            existing.averageRecoveryTime =
              (existing.averageRecoveryTime ?? 0) + metrics.timing.recoveryTime;
          }
        } else {
          existing.failureCount++;
        }
        existing.successRate = existing.successCount / existing.runCount;
      } else {
        const scenarioMetrics: ScenarioMetrics = {
          scenarioId: run.scenarioId,
          scenarioName: scenario.name,
          scenarioType: scenario.scenarioType,
          runCount: 1,
          successCount: run.status === 'completed' && metrics ? 1 : 0,
          failureCount: run.status === 'failed' ? 1 : 0,
          successRate: run.status === 'completed' && metrics ? 1 : 0,
          averageDuration: duration,
          averageDriftFrequency: metrics?.driftFrequency,
          averageRecoveryTime: metrics?.timing?.recoveryTime,
          totalFaultsInjected: metrics?.faultsInjected ?? 0,
          totalEventsExecuted: metrics?.eventsExecuted ?? 0,
        };
        scenarioMap.set(run.scenarioId, scenarioMetrics);
      }
    }

    // Calculate averages for drift frequency and recovery time
    for (const metrics of scenarioMap.values()) {
      if (metrics.averageDriftFrequency !== undefined) {
        metrics.averageDriftFrequency /= metrics.successCount || 1;
      }
      if (metrics.averageRecoveryTime !== undefined) {
        metrics.averageRecoveryTime /= metrics.successCount || 1;
      }
    }

    return Object.fromEntries(scenarioMap);
  }

  /**
   * Aggregate metrics by scenario type
   */
  private async aggregateByType(
    runs: Array<{ scenarioId: string; status: string; metrics: any }>
  ): Promise<Record<string, ScenarioMetrics>> {
    const typeMap = new Map<string, ScenarioMetrics>();

    for (const run of runs) {
      const scenario = await prisma.simulationScenario.findUnique({
        where: { id: run.scenarioId },
        select: { scenarioType: true },
      });

      if (!scenario) continue;

      const type = scenario.scenarioType;
      const existing = typeMap.get(type);
      const metrics = run.metrics as SimulationMetrics | null;
      const duration = metrics?.timing?.totalDuration ?? 0;

      if (existing) {
        existing.runCount++;
        if (run.status === 'completed' && metrics) {
          existing.successCount++;
          existing.averageDuration =
            (existing.averageDuration * (existing.runCount - existing.successCount) + duration) /
            existing.successCount;
          existing.totalFaultsInjected += metrics.faultsInjected ?? 0;
          existing.totalEventsExecuted += metrics.eventsExecuted ?? 0;
          if (metrics.driftFrequency !== undefined) {
            existing.averageDriftFrequency =
              (existing.averageDriftFrequency ?? 0) + metrics.driftFrequency;
          }
          if (metrics.timing.recoveryTime !== undefined) {
            existing.averageRecoveryTime =
              (existing.averageRecoveryTime ?? 0) + metrics.timing.recoveryTime;
          }
        } else {
          existing.failureCount++;
        }
        existing.successRate = existing.successCount / existing.runCount;
      } else {
        const typeMetrics: ScenarioMetrics = {
          scenarioId: '', // Not applicable for type aggregation
          scenarioType: type,
          runCount: 1,
          successCount: run.status === 'completed' && metrics ? 1 : 0,
          failureCount: run.status === 'failed' ? 1 : 0,
          successRate: run.status === 'completed' && metrics ? 1 : 0,
          averageDuration: duration,
          averageDriftFrequency: metrics?.driftFrequency,
          averageRecoveryTime: metrics?.timing?.recoveryTime,
          totalFaultsInjected: metrics?.faultsInjected ?? 0,
          totalEventsExecuted: metrics?.eventsExecuted ?? 0,
        };
        typeMap.set(type, typeMetrics);
      }
    }

    // Calculate averages
    for (const metrics of typeMap.values()) {
      if (metrics.averageDriftFrequency !== undefined) {
        metrics.averageDriftFrequency /= metrics.successCount || 1;
      }
      if (metrics.averageRecoveryTime !== undefined) {
        metrics.averageRecoveryTime /= metrics.successCount || 1;
      }
    }

    return Object.fromEntries(typeMap);
  }

  /**
   * Query simulation runs from database
   */
  private async queryRuns(options?: MetricsQueryOptions) {
    const where: any = {};

    if (options?.scenarioId) {
      where.scenarioId = options.scenarioId;
    }

    if (options?.scenarioType) {
      where.scenario = {
        scenarioType: options.scenarioType,
      };
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    return prisma.simulationRun.findMany({
      where,
      include: {
        scenario: {
          select: {
            id: true,
            name: true,
            scenarioType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit ?? 1000,
    });
  }

  /**
   * Calculate average of array
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil(values.length * p) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
  }

  /**
   * Return empty metrics structure
   */
  private emptyMetrics(): AggregatedMetrics {
    return {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      successRate: 0,
      averageDuration: 0,
      p50Duration: 0,
      p95Duration: 0,
      p99Duration: 0,
      totalFaultsInjected: 0,
      totalEventsExecuted: 0,
      metricsByScenario: {},
      metricsByType: {},
      timestamp: new Date(),
    };
  }

  /**
   * Export metrics to observability system
   * Integrates with global observability (Prometheus, DataDog, etc.)
   */
  async exportToObservability(metrics: AggregatedMetrics): Promise<void> {
    // In a real implementation, this would send metrics to:
    // - Prometheus
    // - DataDog
    // - CloudWatch
    // - Custom observability endpoints

    // For now, log metrics (can be extended to actual observability integration)
    console.log('Simulation Metrics:', {
      totalRuns: metrics.totalRuns,
      successRate: metrics.successRate,
      averageDuration: metrics.averageDuration,
      p95Duration: metrics.p95Duration,
      averageDriftFrequency: metrics.averageDriftFrequency,
      averageRecoveryTime: metrics.averageRecoveryTime,
    });

    // Example: Send to Prometheus-style metrics endpoint
    // await fetch('/metrics', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     'simulation.runs.total': metrics.totalRuns,
    //     'simulation.success.rate': metrics.successRate,
    //     'simulation.duration.avg': metrics.averageDuration,
    //     'simulation.duration.p95': metrics.p95Duration,
    //   }),
    // });
  }

  /**
   * Get metrics for a specific scenario
   */
  async getScenarioMetrics(scenarioId: string): Promise<ScenarioMetrics | null> {
    const aggregated = await this.aggregateMetrics({ scenarioId });
    const scenarioMetrics = aggregated.metricsByScenario[scenarioId];
    return scenarioMetrics || null;
  }

  /**
   * Get metrics for a scenario type
   */
  async getTypeMetrics(scenarioType: string): Promise<ScenarioMetrics | null> {
    const aggregated = await this.aggregateMetrics({ scenarioType });
    const typeMetrics = aggregated.metricsByType[scenarioType];
    return typeMetrics || null;
  }
}

// Export singleton instance
export const simulationMetricsAggregator = new SimulationMetricsAggregator();

