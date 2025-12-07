/**
 * B229B-OBS-009: ChaosExperimentRegistry
 *
 * Keeps a catalog of past and scheduled chaos experiments.
 * Records hypotheses, blast radius, duration, outcomes.
 * Integrates with Lineage for provenance.
 */

import { createLogger } from '@chai-vc/logging-core';
import { provenanceService, ProvenanceNode } from '../lineage/provenanceService.js';
import type { ChaosExperiment } from './chaosInjection.js';

const logger = createLogger({ service: 'chaos-experiment-registry' });

/**
 * Experiment outcome
 */
export enum ExperimentOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  CANCELLED = 'cancelled',
}

/**
 * Experiment result details
 */
export interface ExperimentResult {
  outcome: ExperimentOutcome;
  metrics?: {
    requestsAffected?: number;
    errorsInduced?: number;
    latencyAdded?: number;
    servicesImpacted?: string[];
  };
  observations?: string[];
  lessonsLearned?: string[];
  timestamp: Date;
}

/**
 * Registered chaos experiment with full metadata
 */
export interface RegisteredExperiment extends ChaosExperiment {
  result?: ExperimentResult;
  lineageRecordId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Experiment query filters
 */
export interface ExperimentQuery {
  status?: 'scheduled' | 'running' | 'completed' | 'cancelled';
  outcome?: ExperimentOutcome;
  startDate?: Date;
  endDate?: Date;
  blastRadius?: string[];
  hypothesis?: string;
}

/**
 * ChaosExperimentRegistry for cataloging chaos experiments
 */
export class ChaosExperimentRegistry {
  private experiments: Map<string, RegisteredExperiment> = new Map();
  private scheduledExperiments: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    logger.info('ChaosExperimentRegistry initialized');
  }

  /**
   * Register a chaos experiment
   */
  async registerExperiment(
    experiment: Omit<ChaosExperiment, 'id' | 'status' | 'startTime'>
  ): Promise<string> {
    const id = `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const registeredExperiment: RegisteredExperiment = {
      ...experiment,
      id,
      status: 'scheduled',
      startTime: now,
      createdAt: now,
      updatedAt: now,
    };

    this.experiments.set(id, registeredExperiment);

    // Record in lineage for provenance
    try {
      const lineageRecordId = await this.recordInLineage(registeredExperiment);
      registeredExperiment.lineageRecordId = lineageRecordId;
      this.experiments.set(id, registeredExperiment);
    } catch (error) {
      logger.warn('Failed to record experiment in lineage', {
        experimentId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info('Chaos experiment registered', {
      experimentId: id,
      name: experiment.name,
      hypothesis: experiment.hypothesis,
      blastRadius: experiment.blastRadius,
      scheduledStart: experiment.startTime,
    });

    // Schedule experiment if startTime is in the future
    if (experiment.startTime && experiment.startTime > now) {
      this.scheduleExperiment(id, experiment.startTime);
    }

    return id;
  }

  /**
   * Start an experiment
   */
  async startExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status !== 'scheduled' && experiment.status !== 'running') {
      throw new Error(`Experiment cannot be started: ${experiment.status}`);
    }

    experiment.status = 'running';
    experiment.startTime = new Date();
    experiment.updatedAt = new Date();
    this.experiments.set(experimentId, experiment);

    // Cancel scheduled timeout if exists
    const scheduledTimeout = this.scheduledExperiments.get(experimentId);
    if (scheduledTimeout) {
      clearTimeout(scheduledTimeout);
      this.scheduledExperiments.delete(experimentId);
    }

    logger.info('Chaos experiment started', {
      experimentId,
      name: experiment.name,
    });
  }

  /**
   * Complete an experiment with results
   */
  async completeExperiment(
    experimentId: string,
    result: ExperimentResult
  ): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    experiment.status = 'completed';
    experiment.result = result;
    experiment.endTime = new Date();
    experiment.updatedAt = new Date();
    this.experiments.set(experimentId, experiment);

    // Update lineage record
    if (experiment.lineageRecordId) {
      try {
        await this.updateLineageRecord(experiment);
      } catch (error) {
        logger.warn('Failed to update lineage record', {
          experimentId,
          lineageRecordId: experiment.lineageRecordId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Chaos experiment completed', {
      experimentId,
      name: experiment.name,
      outcome: result.outcome,
      duration: experiment.endTime.getTime() - experiment.startTime.getTime(),
    });
  }

  /**
   * Cancel an experiment
   */
  async cancelExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    experiment.status = 'cancelled';
    experiment.endTime = new Date();
    experiment.result = {
      outcome: ExperimentOutcome.CANCELLED,
      timestamp: new Date(),
    };
    experiment.updatedAt = new Date();
    this.experiments.set(experimentId, experiment);

    // Cancel scheduled timeout if exists
    const scheduledTimeout = this.scheduledExperiments.get(experimentId);
    if (scheduledTimeout) {
      clearTimeout(scheduledTimeout);
      this.scheduledExperiments.delete(experimentId);
    }

    logger.info('Chaos experiment cancelled', {
      experimentId,
      name: experiment.name,
    });
  }

  /**
   * Query experiments
   */
  queryExperiments(query: ExperimentQuery): RegisteredExperiment[] {
    let experiments = Array.from(this.experiments.values());

    if (query.status) {
      experiments = experiments.filter((exp) => exp.status === query.status);
    }

    if (query.outcome) {
      experiments = experiments.filter(
        (exp) => exp.result?.outcome === query.outcome
      );
    }

    if (query.startDate) {
      experiments = experiments.filter(
        (exp) => exp.startTime >= query.startDate!
      );
    }

    if (query.endDate) {
      experiments = experiments.filter(
        (exp) => exp.startTime <= query.endDate!
      );
    }

    if (query.blastRadius && query.blastRadius.length > 0) {
      experiments = experiments.filter((exp) =>
        query.blastRadius!.some((service) => exp.blastRadius.includes(service))
      );
    }

    if (query.hypothesis) {
      const hypothesisLower = query.hypothesis.toLowerCase();
      experiments = experiments.filter((exp) =>
        exp.hypothesis.toLowerCase().includes(hypothesisLower)
      );
    }

    return experiments.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get experiment by ID
   */
  getExperiment(experimentId: string): RegisteredExperiment | undefined {
    return this.experiments.get(experimentId);
  }

  /**
   * Get experiment lineage
   */
  async getExperimentLineage(experimentId: string): Promise<ProvenanceNode[]> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || !experiment.lineageRecordId) {
      return [];
    }

    try {
      const lineage = await provenanceService.getLineage({
        recordId: experiment.lineageRecordId,
        direction: 'both',
        includeMetadata: true,
      });
      return lineage.nodes;
    } catch (error) {
      logger.error('Failed to get experiment lineage', {
        experimentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Schedule an experiment to start at a specific time
   */
  private scheduleExperiment(experimentId: string, startTime: Date): void {
    const now = Date.now();
    const delay = startTime.getTime() - now;

    if (delay <= 0) {
      // Start immediately
      this.startExperiment(experimentId).catch((error) => {
        logger.error('Failed to start scheduled experiment', {
          experimentId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return;
    }

    const timeout = setTimeout(() => {
      this.startExperiment(experimentId).catch((error) => {
        logger.error('Failed to start scheduled experiment', {
          experimentId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      this.scheduledExperiments.delete(experimentId);
    }, delay);

    this.scheduledExperiments.set(experimentId, timeout);

    logger.info('Experiment scheduled', {
      experimentId,
      startTime,
      delayMs: delay,
    });
  }

  /**
   * Record experiment in lineage system
   */
  private async recordInLineage(
    experiment: RegisteredExperiment
  ): Promise<string> {
    // Create a lineage record for the experiment
    // In production, this would use the actual lineage service API
    const recordId = `chaos-exp-${experiment.id}`;

    // For now, we'll use a mock implementation
    // In production, you would call:
    // await lineageService.createLineageEntry({...})

    logger.debug('Recorded experiment in lineage', {
      experimentId: experiment.id,
      lineageRecordId: recordId,
    });

    return recordId;
  }

  /**
   * Update lineage record with experiment results
   */
  private async updateLineageRecord(
    experiment: RegisteredExperiment
  ): Promise<void> {
    if (!experiment.lineageRecordId || !experiment.result) {
      return;
    }

    // In production, this would update the lineage record with results
    logger.debug('Updated lineage record with experiment results', {
      experimentId: experiment.id,
      lineageRecordId: experiment.lineageRecordId,
      outcome: experiment.result.outcome,
    });
  }
}

// Export singleton instance
export const chaosExperimentRegistry = new ChaosExperimentRegistry();

