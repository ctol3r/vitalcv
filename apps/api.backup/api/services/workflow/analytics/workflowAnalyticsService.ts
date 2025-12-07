/**
 * B236B-WF-017: WorkflowAnalyticsService
 *
 * Aggregates execution metrics: runs, success/failure rate, average duration, trigger distribution.
 * Stores analytics, exposes query methods.
 */

import { getServiceLogger } from '../../logging/serviceLogger';
import { PrismaClient } from '@prisma/client';
import {
  WorkflowExecutionResult,
  WorkflowExecutionStatus,
  TriggerType,
} from '../models/types.js';

const log = getServiceLogger('workflow/analytics');
const prisma = new PrismaClient();

/**
 * Workflow execution metrics
 */
export interface WorkflowMetrics {
  workflowId: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  cancelledRuns: number;
  successRate: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  triggerDistribution: Record<string, number>;
  stepSuccessRate: Record<string, number>;
  lastExecutedAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
}

/**
 * Time range for analytics queries
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * WorkflowAnalyticsService aggregates and queries workflow execution metrics
 */
export class WorkflowAnalyticsService {
  /**
   * Record workflow execution
   */
  async recordExecution(result: WorkflowExecutionResult, triggerType: TriggerType): Promise<void> {
    try {
      const duration = result.duration || 0;
      const isSuccess = result.status === WorkflowExecutionStatus.COMPLETED;

      // Store execution record
      await prisma.$executeRaw`
        INSERT INTO "WorkflowExecution" (
          execution_id,
          workflow_id,
          status,
          trigger_type,
          duration_ms,
          started_at,
          completed_at,
          error_message,
          step_results
        )
        VALUES (
          ${result.executionId},
          ${result.workflowId},
          ${result.status},
          ${triggerType},
          ${duration},
          ${result.startedAt},
          ${result.completedAt || null},
          ${result.error || null},
          ${JSON.stringify(result.stepResults)}::jsonb
        )
      `;

      log.debug('Recorded workflow execution', {
        workflowId: result.workflowId,
        executionId: result.executionId,
        status: result.status,
        duration,
      });
    } catch (error) {
      log.error('Error recording workflow execution', {
        workflowId: result.workflowId,
        executionId: result.executionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get metrics for a workflow
   */
  async getWorkflowMetrics(
    workflowId: string,
    timeRange?: TimeRange
  ): Promise<WorkflowMetrics> {
    try {
      const whereClause = timeRange
        ? `WHERE workflow_id = $1 AND started_at >= $2 AND started_at <= $3`
        : `WHERE workflow_id = $1`;

      const params = timeRange
        ? [workflowId, timeRange.start, timeRange.end]
        : [workflowId];

      // Get execution statistics
      const stats = await prisma.$queryRaw<Array<{
        status: string;
        count: bigint;
        avg_duration: number;
        min_duration: number;
        max_duration: number;
        trigger_type: string;
        last_executed: Date;
      }>>`
        SELECT
          status,
          COUNT(*) as count,
          AVG(duration_ms) as avg_duration,
          MIN(duration_ms) as min_duration,
          MAX(duration_ms) as max_duration,
          trigger_type,
          MAX(started_at) as last_executed
        FROM "WorkflowExecution"
        ${whereClause}
        GROUP BY status, trigger_type
      `;

      // Calculate metrics
      let totalRuns = 0;
      let successfulRuns = 0;
      let failedRuns = 0;
      let cancelledRuns = 0;
      let totalDuration = 0;
      let durationCount = 0;
      let minDuration = Infinity;
      let maxDuration = 0;
      const triggerDistribution: Record<string, number> = {};
      let lastExecutedAt: Date | undefined;

      for (const stat of stats) {
        const count = Number(stat.count);
        totalRuns += count;

        if (stat.status === WorkflowExecutionStatus.COMPLETED) {
          successfulRuns += count;
        } else if (stat.status === WorkflowExecutionStatus.FAILED) {
          failedRuns += count;
        } else if (stat.status === WorkflowExecutionStatus.CANCELLED) {
          cancelledRuns += count;
        }

        if (stat.avg_duration) {
          totalDuration += stat.avg_duration * count;
          durationCount += count;
          minDuration = Math.min(minDuration, stat.min_duration || Infinity);
          maxDuration = Math.max(maxDuration, stat.max_duration || 0);
        }

        if (stat.trigger_type) {
          triggerDistribution[stat.trigger_type] =
            (triggerDistribution[stat.trigger_type] || 0) + count;
        }

        if (stat.last_executed && (!lastExecutedAt || stat.last_executed > lastExecutedAt)) {
          lastExecutedAt = stat.last_executed;
        }
      }

      const averageDuration = durationCount > 0 ? totalDuration / durationCount : 0;
      const successRate = totalRuns > 0 ? successfulRuns / totalRuns : 0;

      // Get step success rates
      const stepSuccessRate = await this.getStepSuccessRates(workflowId, timeRange);

      // Get last success and failure times
      const lastSuccessAt = await this.getLastExecutionTime(
        workflowId,
        WorkflowExecutionStatus.COMPLETED,
        timeRange
      );
      const lastFailureAt = await this.getLastExecutionTime(
        workflowId,
        WorkflowExecutionStatus.FAILED,
        timeRange
      );

      return {
        workflowId,
        totalRuns,
        successfulRuns,
        failedRuns,
        cancelledRuns,
        successRate,
        averageDuration,
        minDuration: minDuration === Infinity ? 0 : minDuration,
        maxDuration,
        triggerDistribution,
        stepSuccessRate,
        lastExecutedAt,
        lastSuccessAt,
        lastFailureAt,
      };
    } catch (error) {
      log.error('Error getting workflow metrics', {
        workflowId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return empty metrics on error
      return {
        workflowId,
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        cancelledRuns: 0,
        successRate: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        triggerDistribution: {},
        stepSuccessRate: {},
      };
    }
  }

  /**
   * Get step success rates
   */
  private async getStepSuccessRates(
    workflowId: string,
    timeRange?: TimeRange
  ): Promise<Record<string, number>> {
    try {
      const whereClause = timeRange
        ? `WHERE workflow_id = $1 AND started_at >= $2 AND started_at <= $3`
        : `WHERE workflow_id = $1`;

      const params = timeRange
        ? [workflowId, timeRange.start, timeRange.end]
        : [workflowId];

      const stepStats = await prisma.$queryRaw<Array<{
        step_id: string;
        total: bigint;
        successful: bigint;
      }>>`
        SELECT
          step_id,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful
        FROM "WorkflowExecution",
        LATERAL jsonb_array_elements(step_results) AS step_result
        ${whereClause}
        GROUP BY step_id
      `;

      const rates: Record<string, number> = {};
      for (const stat of stepStats) {
        const total = Number(stat.total);
        const successful = Number(stat.successful);
        rates[stat.step_id] = total > 0 ? successful / total : 0;
      }

      return rates;
    } catch (error) {
      log.warn('Error getting step success rates', {
        workflowId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get last execution time for a status
   */
  private async getLastExecutionTime(
    workflowId: string,
    status: WorkflowExecutionStatus,
    timeRange?: TimeRange
  ): Promise<Date | undefined> {
    try {
      const whereClause = timeRange
        ? `WHERE workflow_id = $1 AND status = $2 AND started_at >= $3 AND started_at <= $4`
        : `WHERE workflow_id = $1 AND status = $2`;

      const params = timeRange
        ? [workflowId, status, timeRange.start, timeRange.end]
        : [workflowId, status];

      const result = await prisma.$queryRaw<Array<{ last_executed: Date }>>`
        SELECT MAX(started_at) as last_executed
        FROM "WorkflowExecution"
        ${whereClause}
      `;

      return result[0]?.last_executed;
    } catch (error) {
      log.warn('Error getting last execution time', {
        workflowId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return undefined;
    }
  }

  /**
   * Get metrics for all workflows
   */
  async getAllWorkflowsMetrics(timeRange?: TimeRange): Promise<WorkflowMetrics[]> {
    try {
      // Get list of workflows
      const workflows = await prisma.$queryRaw<Array<{ workflow_id: string }>>`
        SELECT DISTINCT workflow_id
        FROM "WorkflowExecution"
        ${timeRange ? `WHERE started_at >= $1 AND started_at <= $2` : ''}
      `;

      // Get metrics for each workflow
      const metrics = await Promise.all(
        workflows.map((w) => this.getWorkflowMetrics(w.workflow_id, timeRange))
      );

      return metrics;
    } catch (error) {
      log.error('Error getting all workflows metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }
}

