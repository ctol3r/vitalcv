/**
 * DistributedStateReconciler
 *
 * Across regions, reconciles queue offsets, supervisor context, module health;
 * resolves conflicts via CRDT (Conflict-free Replicated Data Type).
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import { getQueueHealthSnapshot } from '../../queue/models/JobQueue.js';

const logger = createLogger({ service: 'distributed-state-reconciler' });
const prisma = new PrismaClient();

/**
 * Region identifier
 */
export type RegionId = string;

/**
 * Queue offset state
 */
export interface QueueOffsetState {
  queueId: string;
  offset: number;
  regionId: RegionId;
  timestamp: Date;
  version: number; // CRDT version vector
}

/**
 * Supervisor context state
 */
export interface SupervisorContextState {
  contextId: string;
  state: Record<string, unknown>;
  regionId: RegionId;
  timestamp: Date;
  version: number;
}

/**
 * Module health state
 */
export interface ModuleHealthState {
  moduleId: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  regionId: RegionId;
  timestamp: Date;
  version: number;
  metrics: Record<string, unknown>;
}

/**
 * CRDT merge strategy
 */
export type MergeStrategy = 'last_write_wins' | 'max_value' | 'union' | 'merge_objects';

/**
 * Reconciliation configuration
 */
export interface ReconciliationConfig {
  regionId: RegionId;
  reconciliationIntervalMs: number;
  conflictResolution: {
    queueOffsets: MergeStrategy;
    supervisorContext: MergeStrategy;
    moduleHealth: MergeStrategy;
  };
  peers: RegionId[]; // Other regions to reconcile with
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ReconciliationConfig = {
  regionId: 'us-east-1',
  reconciliationIntervalMs: 60000, // 1 minute
  conflictResolution: {
    queueOffsets: 'max_value', // Use maximum offset (most progress)
    supervisorContext: 'last_write_wins', // Use most recent context
    moduleHealth: 'union', // Union of all health states
  },
  peers: [],
};

/**
 * Distributed state snapshot
 */
export interface DistributedStateSnapshot {
  queueOffsets: Map<string, QueueOffsetState[]>;
  supervisorContexts: Map<string, SupervisorContextState[]>;
  moduleHealth: Map<string, ModuleHealthState[]>;
  reconciledAt: Date;
}

/**
 * DistributedStateReconciler
 *
 * Reconciles distributed state across regions using CRDT principles.
 */
export class DistributedStateReconciler {
  private config: ReconciliationConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private localState: DistributedStateSnapshot = {
    queueOffsets: new Map(),
    supervisorContexts: new Map(),
    moduleHealth: new Map(),
    reconciledAt: new Date(),
  };

  constructor(config?: Partial<ReconciliationConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Start reconciliation loop
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('DistributedStateReconciler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting DistributedStateReconciler', {
      regionId: this.config.regionId,
      reconciliationIntervalMs: this.config.reconciliationIntervalMs,
      peerCount: this.config.peers.length,
    });

    // Run initial reconciliation immediately
    this.reconcile().catch((error) => {
      logger.error('Error in initial reconciliation', { error });
    });

    // Schedule periodic reconciliation
    this.intervalId = setInterval(() => {
      this.reconcile().catch((error) => {
        logger.error('Error in periodic reconciliation', { error });
      });
    }, this.config.reconciliationIntervalMs);
  }

  /**
   * Stop reconciliation loop
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

    logger.info('Stopped DistributedStateReconciler');
  }

  /**
   * Perform reconciliation with peer regions
   */
  private async reconcile(): Promise<void> {
    try {
      // Collect local state
      await this.collectLocalState();

      // Reconcile with each peer (in production, this would fetch from peer regions)
      for (const peerRegionId of this.config.peers) {
        await this.reconcileWithPeer(peerRegionId);
      }

      // Resolve conflicts using CRDT merge strategies
      await this.resolveConflicts();

      // Persist reconciled state
      await this.persistReconciledState();

      this.localState.reconciledAt = new Date();
    } catch (error) {
      logger.error('Error during reconciliation', { error });
    }
  }

  /**
   * Collect local state from database and queues
   */
  private async collectLocalState(): Promise<void> {
    try {
      // Collect queue offsets
      await this.collectQueueOffsets();

      // Collect supervisor contexts
      await this.collectSupervisorContexts();

      // Collect module health
      await this.collectModuleHealth();
    } catch (error) {
      logger.error('Error collecting local state', { error });
    }
  }

  /**
   * Collect queue offset states
   */
  private async collectQueueOffsets(): Promise<void> {
    try {
      const queueHealth = await getQueueHealthSnapshot();

      // Create queue offset state
      const offsetState: QueueOffsetState = {
        queueId: 'global',
        offset: queueHealth.waiting + queueHealth.running, // Approximate offset
        regionId: this.config.regionId,
        timestamp: new Date(),
        version: Date.now(), // Simple version vector using timestamp
      };

      const existing = this.localState.queueOffsets.get('global') || [];
      existing.push(offsetState);
      this.localState.queueOffsets.set('global', existing);
    } catch (error) {
      logger.error('Error collecting queue offsets', { error });
    }
  }

  /**
   * Collect supervisor context states
   */
  private async collectSupervisorContexts(): Promise<void> {
    try {
      // Get running supervisor tasks as context
      const runningTasks = await prisma.supervisorTask.findMany({
        where: {
          status: 'RUNNING',
        },
        select: {
          id: true,
          taskType: true,
          metadata: true,
        },
        take: 100, // Limit to avoid memory issues
      });

      const contextState: SupervisorContextState = {
        contextId: `supervisor:${this.config.regionId}`,
        state: {
          runningTasks: runningTasks.length,
          taskTypes: runningTasks.map((t) => t.taskType),
        },
        regionId: this.config.regionId,
        timestamp: new Date(),
        version: Date.now(),
      };

      const existing = this.localState.supervisorContexts.get(contextState.contextId) || [];
      existing.push(contextState);
      this.localState.supervisorContexts.set(contextState.contextId, existing);
    } catch (error) {
      logger.error('Error collecting supervisor contexts', { error });
    }
  }

  /**
   * Collect module health states
   */
  private async collectModuleHealth(): Promise<void> {
    try {
      // Get task statistics grouped by type (as proxy for module health)
      const tasksByType = await prisma.supervisorTask.groupBy({
        by: ['taskType', 'status'],
        _count: {
          id: true,
        },
      });

      for (const taskGroup of tasksByType) {
        const moduleId = `module:${taskGroup.taskType}`;
        const health: ModuleHealthState['health'] =
          taskGroup.status === 'RUNNING' ? 'healthy' :
          taskGroup.status === 'FAILED' ? 'unhealthy' : 'degraded';

        const healthState: ModuleHealthState = {
          moduleId,
          health,
          regionId: this.config.regionId,
          timestamp: new Date(),
          version: Date.now(),
          metrics: {
            status: taskGroup.status,
            count: taskGroup._count.id,
          },
        };

        const existing = this.localState.moduleHealth.get(moduleId) || [];
        existing.push(healthState);
        this.localState.moduleHealth.set(moduleId, existing);
      }
    } catch (error) {
      logger.error('Error collecting module health', { error });
    }
  }

  /**
   * Reconcile with a peer region (mock implementation - in production would fetch from peer)
   */
  private async reconcileWithPeer(peerRegionId: RegionId): Promise<void> {
    logger.debug('Reconciling with peer region', { peerRegionId });

    // In production, this would:
    // 1. Fetch state from peer region via API
    // 2. Merge peer state into local state
    // 3. Handle network failures gracefully

    // For now, we simulate by creating mock peer state
    // In real implementation, this would be:
    // const peerState = await fetchPeerState(peerRegionId);
    // this.mergePeerState(peerState);
  }

  /**
   * Resolve conflicts using CRDT merge strategies
   */
  private async resolveConflicts(): Promise<void> {
    // Resolve queue offset conflicts
    for (const [queueId, states] of this.localState.queueOffsets) {
      const resolved = this.mergeQueueOffsets(states);
      this.localState.queueOffsets.set(queueId, [resolved]);
    }

    // Resolve supervisor context conflicts
    for (const [contextId, states] of this.localState.supervisorContexts) {
      const resolved = this.mergeSupervisorContexts(states);
      this.localState.supervisorContexts.set(contextId, [resolved]);
    }

    // Resolve module health conflicts
    for (const [moduleId, states] of this.localState.moduleHealth) {
      const resolved = this.mergeModuleHealth(states);
      this.localState.moduleHealth.set(moduleId, [resolved]);
    }
  }

  /**
   * Merge queue offsets using CRDT strategy
   */
  private mergeQueueOffsets(states: QueueOffsetState[]): QueueOffsetState {
    if (states.length === 0) {
      throw new Error('Cannot merge empty states');
    }

    if (states.length === 1) {
      return states[0];
    }

    const strategy = this.config.conflictResolution.queueOffsets;

    switch (strategy) {
      case 'max_value':
        // Use maximum offset (most progress)
        return states.reduce((max, state) =>
          state.offset > max.offset ? state : max
        );

      case 'last_write_wins':
        // Use most recent timestamp
        return states.reduce((latest, state) =>
          state.timestamp > latest.timestamp ? state : latest
        );

      default:
        // Default to max_value
        return states.reduce((max, state) =>
          state.offset > max.offset ? state : max
        );
    }
  }

  /**
   * Merge supervisor contexts using CRDT strategy
   */
  private mergeSupervisorContexts(states: SupervisorContextState[]): SupervisorContextState {
    if (states.length === 0) {
      throw new Error('Cannot merge empty states');
    }

    if (states.length === 1) {
      return states[0];
    }

    const strategy = this.config.conflictResolution.supervisorContext;

    switch (strategy) {
      case 'last_write_wins':
        // Use most recent context
        const latest = states.reduce((latest, state) =>
          state.timestamp > latest.timestamp ? state : latest
        );
        return latest;

      case 'merge_objects':
        // Merge all context states
        const merged = states.reduce((acc, state) => {
          return {
            ...acc,
            ...state.state,
            // Merge arrays/lists
            taskTypes: [
              ...(acc.state.taskTypes as string[] || []),
              ...(state.state.taskTypes as string[] || []),
            ],
          };
        }, states[0]);
        return {
          ...states[0],
          state: merged.state,
          version: Math.max(...states.map((s) => s.version)),
        };

      default:
        // Default to last_write_wins
        return states.reduce((latest, state) =>
          state.timestamp > latest.timestamp ? state : latest
        );
    }
  }

  /**
   * Merge module health states using CRDT strategy
   */
  private mergeModuleHealth(states: ModuleHealthState[]): ModuleHealthState {
    if (states.length === 0) {
      throw new Error('Cannot merge empty states');
    }

    if (states.length === 1) {
      return states[0];
    }

    const strategy = this.config.conflictResolution.moduleHealth;

    switch (strategy) {
      case 'union':
        // Use worst health status (most conservative)
        const healthPriority: Record<ModuleHealthState['health'], number> = {
          unhealthy: 3,
          degraded: 2,
          healthy: 1,
        };

        const worstHealth = states.reduce((worst, state) =>
          healthPriority[state.health] > healthPriority[worst.health] ? state : worst
        );

        // Merge metrics
        const mergedMetrics = states.reduce((acc, state) => {
          return {
            ...acc,
            ...state.metrics,
            [`${state.regionId}_health`]: state.health,
            [`${state.regionId}_timestamp`]: state.timestamp.toISOString(),
          };
        }, {} as Record<string, unknown>);

        return {
          ...worstHealth,
          metrics: mergedMetrics,
          version: Math.max(...states.map((s) => s.version)),
        };

      case 'last_write_wins':
        // Use most recent health
        return states.reduce((latest, state) =>
          state.timestamp > latest.timestamp ? state : latest
        );

      default:
        // Default to union
        return this.mergeModuleHealth(states);
    }
  }

  /**
   * Persist reconciled state to database
   */
  private async persistReconciledState(): Promise<void> {
    try {
      // In production, this would persist to a distributed state store
      // For now, we just log the reconciled state
      logger.debug('Reconciled state', {
        queueOffsetsCount: this.localState.queueOffsets.size,
        supervisorContextsCount: this.localState.supervisorContexts.size,
        moduleHealthCount: this.localState.moduleHealth.size,
        reconciledAt: this.localState.reconciledAt,
      });
    } catch (error) {
      logger.error('Error persisting reconciled state', { error });
    }
  }

  /**
   * Get current reconciled state snapshot
   */
  getReconciledState(): DistributedStateSnapshot {
    return {
      queueOffsets: new Map(this.localState.queueOffsets),
      supervisorContexts: new Map(this.localState.supervisorContexts),
      moduleHealth: new Map(this.localState.moduleHealth),
      reconciledAt: this.localState.reconciledAt,
    };
  }

  /**
   * Register a peer region for reconciliation
   */
  registerPeer(peerRegionId: RegionId): void {
    if (!this.config.peers.includes(peerRegionId)) {
      this.config.peers.push(peerRegionId);
      logger.info('Registered peer region', { peerRegionId });
    }
  }

  /**
   * Unregister a peer region
   */
  unregisterPeer(peerRegionId: RegionId): void {
    const index = this.config.peers.indexOf(peerRegionId);
    if (index > -1) {
      this.config.peers.splice(index, 1);
      logger.info('Unregistered peer region', { peerRegionId });
    }
  }
}

