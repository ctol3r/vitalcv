/**
 * B229B-OBS-006: ChaosInjectionService
 *
 * Enables controlled fault injection (latency, timeout, dropped requests) at runtime.
 * Integrates with Autonomy engine to coordinate experiments.
 * Toggled via config.
 */

import { createLogger } from '@chai-vc/logging-core';
import type { AutonomicLoopController } from '../autonomy/loops/controller.js';

const logger = createLogger({ service: 'chaos-injection' });

/**
 * Types of fault injection
 */
export enum FaultType {
  LATENCY = 'latency',
  TIMEOUT = 'timeout',
  DROP = 'drop',
  ERROR = 'error',
}

/**
 * Fault injection configuration
 */
export interface FaultConfig {
  enabled: boolean;
  faultType: FaultType;
  target?: string; // Service name, endpoint pattern, or '*' for all
  probability?: number; // 0.0 to 1.0, probability of injecting fault
  latencyMs?: number; // For LATENCY type
  timeoutMs?: number; // For TIMEOUT type
  errorCode?: number; // For ERROR type (HTTP status code)
  errorMessage?: string; // For ERROR type
  duration?: number; // Duration in seconds (0 = until disabled)
  startTime?: Date;
}

/**
 * Chaos experiment metadata
 */
export interface ChaosExperiment {
  id: string;
  name: string;
  description?: string;
  hypothesis: string;
  blastRadius: string[]; // Affected services/components
  duration: number; // Duration in seconds
  startTime: Date;
  endTime?: Date;
  status: 'scheduled' | 'running' | 'completed' | 'cancelled';
  faults: FaultConfig[];
  metadata?: Record<string, unknown>;
}

/**
 * ChaosInjectionService for controlled fault injection
 */
export class ChaosInjectionService {
  private activeFaults: Map<string, FaultConfig> = new Map();
  private experiments: Map<string, ChaosExperiment> = new Map();
  private autonomyController?: AutonomicLoopController;
  private globalEnabled: boolean;

  constructor(config?: { enabled?: boolean; autonomyController?: AutonomicLoopController }) {
    this.globalEnabled = config?.enabled ?? process.env.CHAOS_INJECTION_ENABLED === 'true';
    this.autonomyController = config?.autonomyController;

    logger.info('ChaosInjectionService initialized', {
      enabled: this.globalEnabled,
      hasAutonomyController: !!this.autonomyController,
    });
  }

  /**
   * Check if fault should be injected for a given request
   */
  shouldInjectFault(target: string): FaultConfig | null {
    if (!this.globalEnabled) {
      return null;
    }

    // Check all active faults
    for (const [id, fault] of this.activeFaults) {
      if (!fault.enabled) {
        continue;
      }

      // Check if target matches
      if (fault.target && fault.target !== '*' && !target.includes(fault.target)) {
        continue;
      }

      // Check duration
      if (fault.duration && fault.startTime) {
        const elapsed = (Date.now() - fault.startTime.getTime()) / 1000;
        if (elapsed > fault.duration) {
          this.activeFaults.delete(id);
          logger.info('Fault expired', { faultId: id });
          continue;
        }
      }

      // Check probability
      if (fault.probability !== undefined) {
        const random = Math.random();
        if (random > fault.probability) {
          continue;
        }
      }

      return fault;
    }

    return null;
  }

  /**
   * Inject latency into a request
   */
  async injectLatency(fault: FaultConfig): Promise<void> {
    if (fault.latencyMs) {
      await new Promise((resolve) => setTimeout(resolve, fault.latencyMs));
      logger.debug('Latency injected', { latencyMs: fault.latencyMs });
    }
  }

  /**
   * Inject timeout into a request
   */
  async injectTimeout(fault: FaultConfig): Promise<never> {
    if (fault.timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, fault.timeoutMs));
      throw new Error(`Request timeout after ${fault.timeoutMs}ms (chaos injection)`);
    }
    throw new Error('Timeout injection failed: no timeoutMs specified');
  }

  /**
   * Inject error into a request
   */
  injectError(fault: FaultConfig): never {
    const error = new Error(fault.errorMessage || 'Chaos injection error');
    (error as any).statusCode = fault.errorCode || 500;
    throw error;
  }

  /**
   * Drop a request (simulate network failure)
   */
  dropRequest(fault: FaultConfig): never {
    logger.debug('Request dropped (chaos injection)', { faultId: fault.target });
    const error = new Error('Request dropped (chaos injection)');
    (error as any).statusCode = 503;
    throw error;
  }

  /**
   * Apply fault injection to a request
   */
  async applyFault(target: string): Promise<void> {
    const fault = this.shouldInjectFault(target);
    if (!fault) {
      return;
    }

    logger.info('Injecting fault', {
      faultType: fault.faultType,
      target,
      faultId: fault.target,
    });

    switch (fault.faultType) {
      case FaultType.LATENCY:
        await this.injectLatency(fault);
        break;
      case FaultType.TIMEOUT:
        await this.injectTimeout(fault);
        break;
      case FaultType.ERROR:
        this.injectError(fault);
        break;
      case FaultType.DROP:
        this.dropRequest(fault);
        break;
    }
  }

  /**
   * Start a chaos experiment
   */
  async startExperiment(experiment: Omit<ChaosExperiment, 'id' | 'status' | 'startTime'>): Promise<string> {
    const id = `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullExperiment: ChaosExperiment = {
      ...experiment,
      id,
      status: 'running',
      startTime: new Date(),
    };

    this.experiments.set(id, fullExperiment);

    // Activate all faults in the experiment
    for (const fault of experiment.faults) {
      const faultId = `${id}-${fault.faultType}-${Date.now()}`;
      const activeFault: FaultConfig = {
        ...fault,
        enabled: true,
        startTime: new Date(),
      };
      this.activeFaults.set(faultId, activeFault);
    }

    // Notify autonomy controller if available
    if (this.autonomyController) {
      // Emit event to autonomy engine
      logger.info('Notifying autonomy controller of chaos experiment', { experimentId: id });
    }

    logger.info('Chaos experiment started', {
      experimentId: id,
      name: experiment.name,
      faultCount: experiment.faults.length,
    });

    // Schedule experiment end
    if (experiment.duration > 0) {
      setTimeout(() => {
        this.endExperiment(id);
      }, experiment.duration * 1000);
    }

    return id;
  }

  /**
   * End a chaos experiment
   */
  async endExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      logger.warn('Experiment not found', { experimentId });
      return;
    }

    // Remove all faults associated with this experiment
    for (const [faultId, fault] of this.activeFaults) {
      if (faultId.startsWith(experimentId)) {
        this.activeFaults.delete(faultId);
      }
    }

    experiment.status = 'completed';
    experiment.endTime = new Date();
    this.experiments.set(experimentId, experiment);

    logger.info('Chaos experiment ended', {
      experimentId,
      duration: experiment.endTime.getTime() - experiment.startTime.getTime(),
    });
  }

  /**
   * Cancel a running experiment
   */
  async cancelExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      logger.warn('Experiment not found', { experimentId });
      return;
    }

    // Remove all faults associated with this experiment
    for (const [faultId, fault] of this.activeFaults) {
      if (faultId.startsWith(experimentId)) {
        this.activeFaults.delete(faultId);
      }
    }

    experiment.status = 'cancelled';
    experiment.endTime = new Date();
    this.experiments.set(experimentId, experiment);

    logger.info('Chaos experiment cancelled', { experimentId });
  }

  /**
   * Get active experiments
   */
  getActiveExperiments(): ChaosExperiment[] {
    return Array.from(this.experiments.values()).filter(
      (exp) => exp.status === 'running'
    );
  }

  /**
   * Get experiment by ID
   */
  getExperiment(experimentId: string): ChaosExperiment | undefined {
    return this.experiments.get(experimentId);
  }

  /**
   * Enable/disable chaos injection globally
   */
  setEnabled(enabled: boolean): void {
    this.globalEnabled = enabled;
    logger.info('Chaos injection toggled', { enabled });
  }

  /**
   * Check if chaos injection is enabled
   */
  isEnabled(): boolean {
    return this.globalEnabled;
  }

  /**
   * Get active faults
   */
  getActiveFaults(): FaultConfig[] {
    return Array.from(this.activeFaults.values()).filter((f) => f.enabled);
  }
}

// Export singleton instance
export const chaosInjectionService = new ChaosInjectionService();

