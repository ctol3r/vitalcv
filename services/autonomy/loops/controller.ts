/**
 * AutonomicLoopController
 *
 * Monitors modules, queues, databases; triggers remediation tasks on anomaly;
 * supports pluggable policies for different remediation strategies.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import { getQueueHealthSnapshot } from '../../queue/models/JobQueue.js';
import type { JobQueueType } from '../../queue/models/JobQueue.js';
import { enqueueJob } from '../../queue/producer.js';

const logger = createLogger({ service: 'autonomic-loop-controller' });
const prisma = new PrismaClient();

/**
 * Health status for monitored resources
 */
export interface ResourceHealth {
  resourceId: string;
  resourceType: 'module' | 'queue' | 'database';
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: Record<string, unknown>;
  lastChecked: Date;
  anomalies: Anomaly[];
}

/**
 * Anomaly detected in a resource
 */
export interface Anomaly {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Remediation policy interface
 */
export interface RemediationPolicy {
  /**
   * Policy name/identifier
   */
  name: string;

  /**
   * Check if this policy applies to the given anomaly
   */
  appliesTo(anomaly: Anomaly, resource: ResourceHealth): boolean;

  /**
   * Generate remediation tasks for the anomaly
   */
  generateRemediationTasks(
    anomaly: Anomaly,
    resource: ResourceHealth
  ): RemediationTask[];
}

/**
 * Remediation task to be executed
 */
export interface RemediationTask {
  taskType: JobQueueType | 'RESTART_MODULE' | 'CLEAR_CACHE' | 'FAILOVER';
  priority: number;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  checkIntervalMs: number;
  moduleTimeoutMs: number;
  queueThresholds: {
    maxPending: number;
    maxRunning: number;
    maxDeadLetter: number;
    maxAvgLatencyMs: number;
  };
  databaseThresholds: {
    maxConnectionPoolUsage: number;
    maxQueryLatencyMs: number;
  };
  policies: RemediationPolicy[];
}

/**
 * Default monitoring configuration
 */
const DEFAULT_CONFIG: MonitoringConfig = {
  checkIntervalMs: 30000, // 30 seconds
  moduleTimeoutMs: 60000, // 1 minute
  queueThresholds: {
    maxPending: 1000,
    maxRunning: 100,
    maxDeadLetter: 50,
    maxAvgLatencyMs: 5000,
  },
  databaseThresholds: {
    maxConnectionPoolUsage: 0.8,
    maxQueryLatencyMs: 1000,
  },
  policies: [],
};

/**
 * Default remediation policies
 */
class DefaultRemediationPolicy implements RemediationPolicy {
  name = 'default';

  appliesTo(anomaly: Anomaly): boolean {
    return true;
  }

  generateRemediationTasks(
    anomaly: Anomaly,
    resource: ResourceHealth
  ): RemediationTask[] {
    const tasks: RemediationTask[] = [];

    if (resource.resourceType === 'queue') {
      if (anomaly.type === 'high_pending_count') {
        tasks.push({
          taskType: 'SUPERVISOR_RUN',
          priority: 10,
          payload: {
            action: 'scale_workers',
            queueType: resource.resourceId,
          },
        });
      } else if (anomaly.type === 'high_latency') {
        tasks.push({
          taskType: 'SUPERVISOR_RUN',
          priority: 8,
          payload: {
            action: 'optimize_queue',
            queueType: resource.resourceId,
          },
        });
      } else if (anomaly.type === 'dead_letter_overflow') {
        tasks.push({
          taskType: 'SUPERVISOR_RUN',
          priority: 9,
          payload: {
            action: 'investigate_failures',
            queueType: resource.resourceId,
          },
        });
      }
    } else if (resource.resourceType === 'module') {
      if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
        tasks.push({
          taskType: 'RESTART_MODULE',
          priority: 10,
          payload: {
            moduleId: resource.resourceId,
            reason: anomaly.description,
          },
        });
      }
    } else if (resource.resourceType === 'database') {
      if (anomaly.type === 'connection_pool_exhausted') {
        tasks.push({
          taskType: 'SUPERVISOR_RUN',
          priority: 7,
          payload: {
            action: 'scale_connections',
            databaseId: resource.resourceId,
          },
        });
      } else if (anomaly.type === 'high_query_latency') {
        tasks.push({
          taskType: 'CLEAR_CACHE',
          priority: 6,
          payload: {
            cacheType: 'query_cache',
            databaseId: resource.resourceId,
          },
        });
      }
    }

    return tasks;
  }
}

/**
 * AutonomicLoopController
 *
 * Continuously monitors system resources and triggers remediation when anomalies are detected.
 */
export class AutonomicLoopController {
  private config: MonitoringConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private monitoredResources: Map<string, ResourceHealth> = new Map();

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      policies: [
        ...(config?.policies ?? []),
        new DefaultRemediationPolicy(),
      ],
    };
  }

  /**
   * Start the monitoring loop
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('AutonomicLoopController is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting AutonomicLoopController', {
      checkIntervalMs: this.config.checkIntervalMs,
      policyCount: this.config.policies.length,
    });

    // Run initial check immediately
    this.checkResources().catch((error) => {
      logger.error('Error in initial resource check', { error });
    });

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkResources().catch((error) => {
        logger.error('Error in periodic resource check', { error });
      });
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop the monitoring loop
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('Stopped AutonomicLoopController');
  }

  /**
   * Check all monitored resources for anomalies
   */
  private async checkResources(): Promise<void> {
    try {
      // Check modules
      await this.checkModules();

      // Check queues
      await this.checkQueues();

      // Check databases
      await this.checkDatabases();

      // Process detected anomalies
      await this.processAnomalies();
    } catch (error) {
      logger.error('Error checking resources', { error });
    }
  }

  /**
   * Check module health
   */
  private async checkModules(): Promise<void> {
    try {
      // Get running supervisor tasks as a proxy for module health
      const runningTasks = await prisma.supervisorTask.findMany({
        where: {
          status: 'RUNNING',
        },
        select: {
          id: true,
          taskType: true,
          startedAt: true,
        },
      });

      // Check for stuck tasks (running too long)
      const now = new Date();
      for (const task of runningTasks) {
        if (task.startedAt) {
          const runtimeMs = now.getTime() - task.startedAt.getTime();
          if (runtimeMs > this.config.moduleTimeoutMs) {
            const resourceId = `module:${task.taskType}`;
            const resource = this.getOrCreateResource(resourceId, 'module');

            resource.anomalies.push({
              id: `stuck-task-${task.id}`,
              type: 'stuck_task',
              severity: 'high',
              detectedAt: now,
              description: `Task ${task.id} has been running for ${runtimeMs}ms`,
              metadata: {
                taskId: task.id,
                taskType: task.taskType,
                runtimeMs,
              },
            });

            resource.status = 'degraded';
            resource.lastChecked = now;
            this.monitoredResources.set(resourceId, resource);
          }
        }
      }
    } catch (error) {
      logger.error('Error checking modules', { error });
    }
  }

  /**
   * Check queue health
   */
  private async checkQueues(): Promise<void> {
    try {
      const queueHealth = await getQueueHealthSnapshot({
        latencySampleSize: 20,
        errorLimit: 10,
      });

      const resourceId = 'queue:global';
      const resource = this.getOrCreateResource(resourceId, 'queue');
      const anomalies: Anomaly[] = [];

      // Check pending count
      if (queueHealth.waiting > this.config.queueThresholds.maxPending) {
        anomalies.push({
          id: `high-pending-${Date.now()}`,
          type: 'high_pending_count',
          severity: queueHealth.waiting > this.config.queueThresholds.maxPending * 2 ? 'critical' : 'high',
          detectedAt: new Date(),
          description: `Queue has ${queueHealth.waiting} pending jobs (threshold: ${this.config.queueThresholds.maxPending})`,
          metadata: {
            pending: queueHealth.waiting,
            threshold: this.config.queueThresholds.maxPending,
          },
        });
      }

      // Check running count
      if (queueHealth.running > this.config.queueThresholds.maxRunning) {
        anomalies.push({
          id: `high-running-${Date.now()}`,
          type: 'high_running_count',
          severity: 'medium',
          detectedAt: new Date(),
          description: `Queue has ${queueHealth.running} running jobs (threshold: ${this.config.queueThresholds.maxRunning})`,
          metadata: {
            running: queueHealth.running,
            threshold: this.config.queueThresholds.maxRunning,
          },
        });
      }

      // Check dead letter queue
      if (queueHealth.deadLetter > this.config.queueThresholds.maxDeadLetter) {
        anomalies.push({
          id: `dead-letter-${Date.now()}`,
          type: 'dead_letter_overflow',
          severity: 'high',
          detectedAt: new Date(),
          description: `Dead letter queue has ${queueHealth.deadLetter} jobs (threshold: ${this.config.queueThresholds.maxDeadLetter})`,
          metadata: {
            deadLetter: queueHealth.deadLetter,
            threshold: this.config.queueThresholds.maxDeadLetter,
            lastErrors: queueHealth.lastErrors,
          },
        });
      }

      // Check latency
      if (
        queueHealth.avgLatencyMs !== null &&
        queueHealth.avgLatencyMs > this.config.queueThresholds.maxAvgLatencyMs
      ) {
        anomalies.push({
          id: `high-latency-${Date.now()}`,
          type: 'high_latency',
          severity: 'medium',
          detectedAt: new Date(),
          description: `Average queue latency is ${queueHealth.avgLatencyMs}ms (threshold: ${this.config.queueThresholds.maxAvgLatencyMs}ms)`,
          metadata: {
            avgLatencyMs: queueHealth.avgLatencyMs,
            threshold: this.config.queueThresholds.maxAvgLatencyMs,
            sampleSize: queueHealth.latencySampleSize,
          },
        });
      }

      resource.anomalies = anomalies;
      resource.metrics = {
        waiting: queueHealth.waiting,
        running: queueHealth.running,
        deadLetter: queueHealth.deadLetter,
        avgLatencyMs: queueHealth.avgLatencyMs,
        lastErrors: queueHealth.lastErrors,
      };
      resource.status =
        anomalies.length === 0
          ? 'healthy'
          : anomalies.some((a) => a.severity === 'critical' || a.severity === 'high')
          ? 'unhealthy'
          : 'degraded';
      resource.lastChecked = new Date();
      this.monitoredResources.set(resourceId, resource);
    } catch (error) {
      logger.error('Error checking queues', { error });
    }
  }

  /**
   * Check database health
   */
  private async checkDatabases(): Promise<void> {
    try {
      const resourceId = 'database:primary';
      const resource = this.getOrCreateResource(resourceId, 'database');
      const anomalies: Anomaly[] = [];

      // Check database connection and query latency
      const startTime = Date.now();
      try {
        await prisma.$queryRaw`SELECT 1`;
        const queryLatencyMs = Date.now() - startTime;

        if (queryLatencyMs > this.config.databaseThresholds.maxQueryLatencyMs) {
          anomalies.push({
            id: `high-query-latency-${Date.now()}`,
            type: 'high_query_latency',
            severity: 'medium',
            detectedAt: new Date(),
            description: `Database query latency is ${queryLatencyMs}ms (threshold: ${this.config.databaseThresholds.maxQueryLatencyMs}ms)`,
            metadata: {
              queryLatencyMs,
              threshold: this.config.databaseThresholds.maxQueryLatencyMs,
            },
          });
        }

        resource.metrics = {
          queryLatencyMs,
          lastCheck: new Date(),
        };
      } catch (error) {
        anomalies.push({
          id: `db-connection-error-${Date.now()}`,
          type: 'connection_error',
          severity: 'critical',
          detectedAt: new Date(),
          description: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
          metadata: {
            error: String(error),
          },
        });
      }

      resource.anomalies = anomalies;
      resource.status =
        anomalies.length === 0
          ? 'healthy'
          : anomalies.some((a) => a.severity === 'critical')
          ? 'unhealthy'
          : 'degraded';
      resource.lastChecked = new Date();
      this.monitoredResources.set(resourceId, resource);
    } catch (error) {
      logger.error('Error checking databases', { error });
    }
  }

  /**
   * Process detected anomalies and trigger remediation
   */
  private async processAnomalies(): Promise<void> {
    for (const [resourceId, resource] of this.monitoredResources) {
      if (resource.anomalies.length === 0) {
        continue;
      }

      for (const anomaly of resource.anomalies) {
        // Find applicable policies
        const applicablePolicies = this.config.policies.filter((policy) =>
          policy.appliesTo(anomaly, resource)
        );

        if (applicablePolicies.length === 0) {
          logger.warn('No remediation policy found for anomaly', {
            anomalyId: anomaly.id,
            anomalyType: anomaly.type,
            resourceId,
          });
          continue;
        }

        // Generate remediation tasks from all applicable policies
        const tasks: RemediationTask[] = [];
        for (const policy of applicablePolicies) {
          const policyTasks = policy.generateRemediationTasks(anomaly, resource);
          tasks.push(...policyTasks);
        }

        // Execute remediation tasks
        for (const task of tasks) {
          try {
            await this.executeRemediationTask(task, anomaly, resource);
          } catch (error) {
            logger.error('Error executing remediation task', {
              taskType: task.taskType,
              anomalyId: anomaly.id,
              error,
            });
          }
        }
      }

      // Clear processed anomalies
      resource.anomalies = [];
    }
  }

  /**
   * Execute a remediation task
   */
  private async executeRemediationTask(
    task: RemediationTask,
    anomaly: Anomaly,
    resource: ResourceHealth
  ): Promise<void> {
    logger.info('Executing remediation task', {
      taskType: task.taskType,
      priority: task.priority,
      anomalyId: anomaly.id,
      resourceId: resource.resourceId,
    });

    if (task.taskType === 'RESTART_MODULE') {
      // For now, log the restart action
      // In production, this would trigger actual module restart
      logger.warn('Module restart requested', {
        moduleId: task.payload.moduleId,
        reason: task.payload.reason,
      });
    } else if (task.taskType === 'CLEAR_CACHE') {
      // For now, log the cache clear action
      logger.info('Cache clear requested', {
        cacheType: task.payload.cacheType,
        databaseId: task.payload.databaseId,
      });
    } else if (task.taskType === 'FAILOVER') {
      // For now, log the failover action
      logger.warn('Failover requested', {
        resourceId: resource.resourceId,
        metadata: task.metadata,
      });
    } else {
      // Enqueue as a supervisor job
      await enqueueJob(task.taskType, task.payload, {
        maxAttempts: 3,
      });
    }
  }

  /**
   * Get or create a resource health record
   */
  private getOrCreateResource(
    resourceId: string,
    resourceType: 'module' | 'queue' | 'database'
  ): ResourceHealth {
    const existing = this.monitoredResources.get(resourceId);
    if (existing) {
      return existing;
    }

    const resource: ResourceHealth = {
      resourceId,
      resourceType,
      status: 'healthy',
      metrics: {},
      lastChecked: new Date(),
      anomalies: [],
    };

    this.monitoredResources.set(resourceId, resource);
    return resource;
  }

  /**
   * Get current resource health status
   */
  getResourceHealth(resourceId: string): ResourceHealth | undefined {
    return this.monitoredResources.get(resourceId);
  }

  /**
   * Get all monitored resources
   */
  getAllResourceHealth(): ResourceHealth[] {
    return Array.from(this.monitoredResources.values());
  }

  /**
   * Add a custom remediation policy
   */
  addPolicy(policy: RemediationPolicy): void {
    this.config.policies.push(policy);
    logger.info('Added remediation policy', { policyName: policy.name });
  }
}

