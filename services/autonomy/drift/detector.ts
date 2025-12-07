/**
 * StateDriftDetector
 *
 * Compares expected vs actual module state; logs drift; escalates if persistent.
 */

import { PrismaClient, SupervisorTaskStatus } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';

const logger = createLogger({ service: 'state-drift-detector' });
const prisma = new PrismaClient();

/**
 * Expected state for a module
 */
export interface ExpectedModuleState {
  moduleId: string;
  expectedStatus: 'running' | 'stopped' | 'degraded';
  expectedTaskCount?: number;
  expectedMaxLatencyMs?: number;
  expectedErrorRate?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Actual state of a module
 */
export interface ActualModuleState {
  moduleId: string;
  actualStatus: 'running' | 'stopped' | 'degraded' | 'unknown';
  actualTaskCount: number;
  actualMaxLatencyMs: number;
  actualErrorRate: number;
  lastSeen: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Detected drift between expected and actual state
 */
export interface StateDrift {
  id: string;
  moduleId: string;
  driftType: 'status_mismatch' | 'task_count_mismatch' | 'latency_exceeded' | 'error_rate_exceeded' | 'stale_state';
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  expected: Partial<ExpectedModuleState>;
  actual: Partial<ActualModuleState>;
  description: string;
  persistenceCount: number;
  firstDetectedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for drift detection
 */
export interface DriftDetectionConfig {
  checkIntervalMs: number;
  persistenceThreshold: number; // Number of consecutive detections before escalation
  escalationActions: EscalationAction[];
  expectedStates: Map<string, ExpectedModuleState>;
}

/**
 * Escalation action to take when drift persists
 */
export interface EscalationAction {
  name: string;
  triggerAfterPersistenceCount: number;
  action: (drift: StateDrift) => Promise<void>;
}

/**
 * Default escalation actions
 */
const DEFAULT_ESCALATION_ACTIONS: EscalationAction[] = [
  {
    name: 'log_drift',
    triggerAfterPersistenceCount: 1,
    action: async (drift: StateDrift) => {
      logger.warn('State drift detected', {
        driftId: drift.id,
        moduleId: drift.moduleId,
        driftType: drift.driftType,
        severity: drift.severity,
        persistenceCount: drift.persistenceCount,
      });
    },
  },
  {
    name: 'alert_ops',
    triggerAfterPersistenceCount: 3,
    action: async (drift: StateDrift) => {
      logger.error('Persistent state drift - alerting operations', {
        driftId: drift.id,
        moduleId: drift.moduleId,
        driftType: drift.driftType,
        persistenceCount: drift.persistenceCount,
      });
      // In production, this would send alerts to ops team
    },
  },
  {
    name: 'trigger_remediation',
    triggerAfterPersistenceCount: 5,
    action: async (drift: StateDrift) => {
      logger.error('Critical persistent drift - triggering remediation', {
        driftId: drift.id,
        moduleId: drift.moduleId,
        driftType: drift.driftType,
        persistenceCount: drift.persistenceCount,
      });
      // In production, this would trigger autonomic remediation
    },
  },
];

/**
 * StateDriftDetector
 *
 * Monitors module states and detects drift from expected behavior.
 */
export class StateDriftDetector {
  private config: DriftDetectionConfig;
  private detectedDrifts: Map<string, StateDrift> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config?: Partial<DriftDetectionConfig>) {
    this.config = {
      checkIntervalMs: config?.checkIntervalMs ?? 60000, // 1 minute
      persistenceThreshold: config?.persistenceThreshold ?? 3,
      escalationActions: config?.escalationActions ?? DEFAULT_ESCALATION_ACTIONS,
      expectedStates: config?.expectedStates ?? new Map(),
    };
  }

  /**
   * Start drift detection
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('StateDriftDetector is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting StateDriftDetector', {
      checkIntervalMs: this.config.checkIntervalMs,
      expectedStatesCount: this.config.expectedStates.size,
    });

    // Run initial check immediately
    this.checkForDrift().catch((error) => {
      logger.error('Error in initial drift check', { error });
    });

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkForDrift().catch((error) => {
        logger.error('Error in periodic drift check', { error });
      });
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop drift detection
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

    logger.info('Stopped StateDriftDetector');
  }

  /**
   * Check for drift in all monitored modules
   */
  private async checkForDrift(): Promise<void> {
    try {
      // Get actual states for all modules
      const actualStates = await this.getActualModuleStates();

      // Compare with expected states
      for (const [moduleId, expectedState] of this.config.expectedStates) {
        const actualState = actualStates.get(moduleId);
        if (!actualState) {
          // Module not found - could be a drift
          const drift = this.createDrift({
            moduleId,
            driftType: 'stale_state',
            severity: 'medium',
            expected: expectedState,
            actual: {
              moduleId,
              actualStatus: 'unknown',
              actualTaskCount: 0,
              actualMaxLatencyMs: 0,
              actualErrorRate: 0,
              lastSeen: new Date(0),
            },
            description: `Module ${moduleId} not found or not reporting state`,
          });
          await this.recordDrift(drift);
          continue;
        }

        // Check for various types of drift
        const drifts = this.compareStates(expectedState, actualState);
        for (const drift of drifts) {
          await this.recordDrift(drift);
        }
      }
    } catch (error) {
      logger.error('Error checking for drift', { error });
    }
  }

  /**
   * Get actual states for all modules
   */
  private async getActualModuleStates(): Promise<Map<string, ActualModuleState>> {
    const states = new Map<string, ActualModuleState>();

    try {
      // Get supervisor tasks grouped by type (as a proxy for module state)
      const tasksByType = await prisma.supervisorTask.groupBy({
        by: ['taskType'],
        _count: {
          id: true,
        },
        where: {
          status: 'RUNNING',
        },
      });

      // Get task statistics
      const allTasks = await prisma.supervisorTask.findMany({
        where: {
          status: {
            in: ['RUNNING', 'COMPLETED', 'FAILED'],
          },
        },
        select: {
          taskType: true,
          status: true,
          startedAt: true,
          completedAt: true,
          error: true,
        },
      });

      // Calculate metrics per module (task type)
      for (const taskGroup of tasksByType) {
        const moduleId = `module:${taskGroup.taskType}`;
        const moduleTasks = allTasks.filter((t) => t.taskType === taskGroup.taskType);

        // Calculate latency
        const completedTasks = moduleTasks.filter(
          (t) => t.status === 'COMPLETED' && t.startedAt && t.completedAt
        );
        const latencies = completedTasks.map((t) => {
          if (t.startedAt && t.completedAt) {
            return t.completedAt.getTime() - t.startedAt.getTime();
          }
          return 0;
        });
        const maxLatencyMs = latencies.length > 0 ? Math.max(...latencies) : 0;

        // Calculate error rate
        const failedTasks = moduleTasks.filter((t) => t.status === 'FAILED' || t.error !== null);
        const errorRate = moduleTasks.length > 0 ? failedTasks.length / moduleTasks.length : 0;

        // Determine status
        const runningCount = moduleTasks.filter((t) => t.status === 'RUNNING').length;
        const actualStatus: ActualModuleState['actualStatus'] =
          runningCount > 0 ? 'running' : moduleTasks.length === 0 ? 'stopped' : 'degraded';

        states.set(moduleId, {
          moduleId,
          actualStatus,
          actualTaskCount: moduleTasks.length,
          actualMaxLatencyMs: maxLatencyMs,
          actualErrorRate: errorRate,
          lastSeen: new Date(),
        });
      }
    } catch (error) {
      logger.error('Error getting actual module states', { error });
    }

    return states;
  }

  /**
   * Compare expected and actual states, returning detected drifts
   */
  private compareStates(
    expected: ExpectedModuleState,
    actual: ActualModuleState
  ): StateDrift[] {
    const drifts: StateDrift[] = [];

    // Check status mismatch
    if (expected.expectedStatus !== actual.actualStatus) {
      const severity =
        expected.expectedStatus === 'running' && actual.actualStatus === 'stopped'
          ? 'critical'
          : expected.expectedStatus === 'running' && actual.actualStatus === 'degraded'
          ? 'high'
          : 'medium';

      drifts.push(
        this.createDrift({
          moduleId: expected.moduleId,
          driftType: 'status_mismatch',
          severity,
          expected: { expectedStatus: expected.expectedStatus },
          actual: { actualStatus: actual.actualStatus },
          description: `Expected status ${expected.expectedStatus}, but actual is ${actual.actualStatus}`,
        })
      );
    }

    // Check task count mismatch
    if (
      expected.expectedTaskCount !== undefined &&
      actual.actualTaskCount !== expected.expectedTaskCount
    ) {
      const severity =
        actual.actualTaskCount === 0 && expected.expectedTaskCount > 0
          ? 'high'
          : Math.abs(actual.actualTaskCount - expected.expectedTaskCount) >
            expected.expectedTaskCount * 0.5
          ? 'medium'
          : 'low';

      drifts.push(
        this.createDrift({
          moduleId: expected.moduleId,
          driftType: 'task_count_mismatch',
          severity,
          expected: { expectedTaskCount: expected.expectedTaskCount },
          actual: { actualTaskCount: actual.actualTaskCount },
          description: `Expected ${expected.expectedTaskCount} tasks, but found ${actual.actualTaskCount}`,
        })
      );
    }

    // Check latency exceeded
    if (
      expected.expectedMaxLatencyMs !== undefined &&
      actual.actualMaxLatencyMs > expected.expectedMaxLatencyMs
    ) {
      const severity =
        actual.actualMaxLatencyMs > expected.expectedMaxLatencyMs * 2
          ? 'high'
          : actual.actualMaxLatencyMs > expected.expectedMaxLatencyMs * 1.5
          ? 'medium'
          : 'low';

      drifts.push(
        this.createDrift({
          moduleId: expected.moduleId,
          driftType: 'latency_exceeded',
          severity,
          expected: { expectedMaxLatencyMs: expected.expectedMaxLatencyMs },
          actual: { actualMaxLatencyMs: actual.actualMaxLatencyMs },
          description: `Max latency ${actual.actualMaxLatencyMs}ms exceeds expected ${expected.expectedMaxLatencyMs}ms`,
        })
      );
    }

    // Check error rate exceeded
    if (
      expected.expectedErrorRate !== undefined &&
      actual.actualErrorRate > expected.expectedErrorRate
    ) {
      const severity =
        actual.actualErrorRate > expected.expectedErrorRate * 2
          ? 'critical'
          : actual.actualErrorRate > expected.expectedErrorRate * 1.5
          ? 'high'
          : 'medium';

      drifts.push(
        this.createDrift({
          moduleId: expected.moduleId,
          driftType: 'error_rate_exceeded',
          severity,
          expected: { expectedErrorRate: expected.expectedErrorRate },
          actual: { actualErrorRate: actual.actualErrorRate },
          description: `Error rate ${(actual.actualErrorRate * 100).toFixed(2)}% exceeds expected ${(expected.expectedErrorRate * 100).toFixed(2)}%`,
        })
      );
    }

    return drifts;
  }

  /**
   * Create a drift record
   */
  private createDrift(params: {
    moduleId: string;
    driftType: StateDrift['driftType'];
    severity: StateDrift['severity'];
    expected: Partial<ExpectedModuleState>;
    actual: Partial<ActualModuleState>;
    description: string;
  }): StateDrift {
    const driftKey = `${params.moduleId}:${params.driftType}`;
    const existing = this.detectedDrifts.get(driftKey);

    if (existing) {
      // Increment persistence count
      existing.persistenceCount += 1;
      existing.detectedAt = new Date();
      return existing;
    }

    // Create new drift
    const drift: StateDrift = {
      id: `drift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      moduleId: params.moduleId,
      driftType: params.driftType,
      severity: params.severity,
      detectedAt: new Date(),
      expected: params.expected,
      actual: params.actual,
      description: params.description,
      persistenceCount: 1,
      firstDetectedAt: new Date(),
    };

    return drift;
  }

  /**
   * Record a drift and handle escalation
   */
  private async recordDrift(drift: StateDrift): Promise<void> {
    const driftKey = `${drift.moduleId}:${drift.driftType}`;
    this.detectedDrifts.set(driftKey, drift);

    // Log the drift
    logger.warn('State drift detected', {
      driftId: drift.id,
      moduleId: drift.moduleId,
      driftType: drift.driftType,
      severity: drift.severity,
      persistenceCount: drift.persistenceCount,
      description: drift.description,
    });

    // Check for escalation actions
    for (const escalationAction of this.config.escalationActions) {
      if (drift.persistenceCount >= escalationAction.triggerAfterPersistenceCount) {
        try {
          await escalationAction.action(drift);
        } catch (error) {
          logger.error('Error executing escalation action', {
            actionName: escalationAction.name,
            driftId: drift.id,
            error,
          });
        }
      }
    }

    // If drift is resolved (no longer detected), remove it
    if (drift.persistenceCount === 0) {
      this.detectedDrifts.delete(driftKey);
    }
  }

  /**
   * Register an expected state for a module
   */
  registerExpectedState(state: ExpectedModuleState): void {
    this.config.expectedStates.set(state.moduleId, state);
    logger.info('Registered expected state', {
      moduleId: state.moduleId,
      expectedStatus: state.expectedStatus,
    });
  }

  /**
   * Get all detected drifts
   */
  getDetectedDrifts(): StateDrift[] {
    return Array.from(this.detectedDrifts.values());
  }

  /**
   * Get drifts for a specific module
   */
  getDriftsForModule(moduleId: string): StateDrift[] {
    return Array.from(this.detectedDrifts.values()).filter(
      (drift) => drift.moduleId === moduleId
    );
  }

  /**
   * Clear resolved drifts (for testing)
   */
  clearDrifts(): void {
    this.detectedDrifts.clear();
  }
}

