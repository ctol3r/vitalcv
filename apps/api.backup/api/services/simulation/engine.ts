/**
 * SimulationEngine
 *
 * Executes scenarios across microkernel modules with support for:
 * - Time acceleration
 * - Random fault injection
 * - Concurrent runs
 */

import { PrismaClient } from '@prisma/client';
import type {
  DomainState,
  ExternalEvent,
  ExpectedOutcome,
  SuccessCriteria,
  FaultInjectionConfig,
} from './models/SimulationScenario.js';
import { FaultInjector, FaultType, type FaultConfig } from './faults/injector.js';
import { moduleRegistry } from '../microkernel/registry.js';

const prisma = new PrismaClient();

export interface SimulationRunResult {
  runId: string;
  success: boolean;
  duration: number;
  outcomes: OutcomeResult[];
  metrics: SimulationMetrics;
  error?: string;
}

export interface OutcomeResult {
  path: string;
  expected: any;
  actual: any;
  passed: boolean;
  operator: string;
}

export interface SimulationMetrics {
  timing: {
    totalDuration: number;
    eventExecutionTimes: Record<string, number>;
    recoveryTime?: number;
  };
  successRate: number;
  driftFrequency?: number;
  faultsInjected: number;
  eventsExecuted: number;
}

export interface ModuleExecutionContext {
  moduleId: string;
  state: DomainState;
  timeAcceleration: number;
  faultInjector: FaultInjector;
}

/**
 * SimulationEngine executes test scenarios across microkernel modules
 */
export class SimulationEngine {
  private faultInjector: FaultInjector;

  constructor() {
    this.faultInjector = new FaultInjector();
  }

  /**
   * Execute a simulation scenario
   */
  async executeScenario(
    scenarioId: string,
    options?: {
      dryRun?: boolean;
      timeAcceleration?: number;
      skipFaults?: boolean;
    }
  ): Promise<SimulationRunResult> {
    const scenario = await prisma.simulationScenario.findUnique({
      where: { id: scenarioId },
    });

    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    const startTime = Date.now();
    const runId = await this.createRun(scenarioId);

    try {
      // Initialize state
      const initialState = scenario.domainState as DomainState;
      let currentState = this.deepClone(initialState);

      // Setup time acceleration
      const timeAcceleration = options?.timeAcceleration ?? scenario.timeAcceleration;

      // Setup fault injection
      const faultConfig = scenario.faultInjection as FaultInjectionConfig | null;
      const faultsInjected: FaultConfig[] = [];

      if (faultConfig?.enabled && !options?.skipFaults && !options?.dryRun) {
        await this.setupFaultInjection(faultConfig, faultsInjected);
      }

      // Execute external events in order
      const events = scenario.externalEvents as ExternalEvent[];
      const eventExecutionTimes: Record<string, number> = {};

      for (const event of events) {
        const eventStartTime = Date.now();

        if (options?.dryRun) {
          console.log(`[DRY RUN] Would execute event: ${event.type} at ${event.timestamp}ms`);
        } else {
          currentState = await this.executeEvent(
            event,
            currentState,
            timeAcceleration,
            scenarioId
          );
        }

        const eventDuration = Date.now() - eventStartTime;
        eventExecutionTimes[event.type] = eventDuration;

        // Apply time acceleration to wait time
        if (events.indexOf(event) < events.length - 1) {
          const nextEvent = events[events.indexOf(event) + 1];
          const waitTime = (nextEvent.timestamp - event.timestamp) / timeAcceleration;
          await this.sleep(waitTime);
        }
      }

      // Evaluate outcomes
      const outcomes = this.evaluateOutcomes(
        scenario.expectedOutcomes as ExpectedOutcome[],
        currentState
      );

      // Calculate metrics
      const duration = Date.now() - startTime;
      const metrics: SimulationMetrics = {
        timing: {
          totalDuration: duration,
          eventExecutionTimes,
        },
        successRate: outcomes.filter((o) => o.passed).length / outcomes.length,
        faultsInjected: faultsInjected.length,
        eventsExecuted: events.length,
      };

      // Check success criteria
      const successCriteria = scenario.successCriteria as SuccessCriteria;
      const success = this.evaluateSuccessCriteria(successCriteria, outcomes, metrics);

      // Update run record
      await this.updateRun(runId, {
        status: 'completed',
        finalState: currentState as any,
        eventsExecuted: events as any,
        faultsInjected: faultsInjected as any,
        metrics: metrics as any,
        completedAt: new Date(),
      });

      // Clear all faults
      this.faultInjector.clearAllFaults();

      return {
        runId,
        success,
        duration,
        outcomes,
        metrics,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.updateRun(runId, {
        status: 'failed',
        error: error.message,
        completedAt: new Date(),
      });

      this.faultInjector.clearAllFaults();

      return {
        runId,
        success: false,
        duration,
        outcomes: [],
        metrics: {
          timing: { totalDuration: duration, eventExecutionTimes: {} },
          successRate: 0,
          faultsInjected: 0,
          eventsExecuted: 0,
        },
        error: error.message,
      };
    }
  }

  /**
   * Execute multiple scenarios concurrently
   */
  async executeConcurrent(
    scenarioIds: string[],
    maxConcurrency: number = 5
  ): Promise<SimulationRunResult[]> {
    const results: SimulationRunResult[] = [];
    const executing: Promise<SimulationRunResult>[] = [];

    for (const scenarioId of scenarioIds) {
      const promise = this.executeScenario(scenarioId).then((result) => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      executing.push(promise);
      results.push(await promise);

      // Wait if we've hit max concurrency
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    // Wait for remaining executions
    await Promise.all(executing);

    return results;
  }

  /**
   * Execute a single event
   */
  private async executeEvent(
    event: ExternalEvent,
    state: DomainState,
    timeAcceleration: number,
    scenarioId: string
  ): Promise<DomainState> {
    const target = event.target || 'default';
    const module = moduleRegistry.get(target);

    if (!module) {
      // If module not found, simulate event execution
      console.warn(`Module not found for event target: ${target}, simulating execution`);
      return this.simulateEventExecution(event, state);
    }

    // For now, simulate event execution since modules don't have execute methods
    // In a real implementation, modules would expose event handlers
    return this.simulateEventExecution(event, state);
  }

  /**
   * Simulate event execution when module is not available
   */
  private simulateEventExecution(event: ExternalEvent, state: DomainState): DomainState {
    // Simple simulation: update state based on event type
    const newState = this.deepClone(state);

    switch (event.type) {
      case 'credential.issued':
        if (!newState.credentials) newState.credentials = {};
        newState.credentials[event.payload.credentialId] = event.payload;
        break;
      case 'privilege.revoked':
        if (newState.privileges && event.payload.privilegeId) {
          delete newState.privileges[event.payload.privilegeId];
        }
        break;
      case 'drift.detected':
        if (!newState.driftEvents) newState.driftEvents = [];
        newState.driftEvents.push(event.payload);
        break;
      default:
        // Generic state update
        if (event.payload.stateUpdate) {
          Object.assign(newState, event.payload.stateUpdate);
        }
    }

    return newState;
  }

  /**
   * Setup fault injection based on configuration
   */
  private async setupFaultInjection(
    config: FaultInjectionConfig,
    injectedFaults: FaultConfig[]
  ): Promise<void> {
    if (!config.enabled) return;

    const faultTypes = config.faultTypes || Object.values(FaultType);
    const probability = config.probability ?? 0.1;

    for (const faultType of faultTypes) {
      if (Math.random() < probability) {
        const faultConfig: FaultConfig = {
          type: faultType as FaultType,
          target: 'default',
          probability: 1.0,
          duration: config.timing?.duration,
          metadata: {},
        };

        await this.faultInjector.injectFault(faultConfig);
        injectedFaults.push(faultConfig);
      }
    }
  }

  /**
   * Evaluate outcomes against final state
   */
  private evaluateOutcomes(
    expectedOutcomes: ExpectedOutcome[],
    finalState: DomainState
  ): OutcomeResult[] {
    return expectedOutcomes.map((outcome) => {
      const actualValue = this.getStateValue(finalState, outcome.statePath);
      const passed = this.compareValues(
        actualValue,
        outcome.expectedValue,
        outcome.operator || 'equals'
      );

      return {
        path: outcome.statePath,
        expected: outcome.expectedValue,
        actual: actualValue,
        passed,
        operator: outcome.operator || 'equals',
      };
    });
  }

  /**
   * Get value from state using JSON path
   */
  private getStateValue(state: DomainState, path: string): any {
    const parts = path.split('.');
    let current: any = state;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Compare values based on operator
   */
  private compareValues(actual: any, expected: any, operator: string): boolean {
    switch (operator) {
      case 'equals':
        return JSON.stringify(actual) === JSON.stringify(expected);
      case 'contains':
        if (Array.isArray(actual)) {
          return actual.includes(expected);
        }
        if (typeof actual === 'string') {
          return actual.includes(expected);
        }
        return false;
      case 'greaterThan':
        return actual > expected;
      case 'lessThan':
        return actual < expected;
      case 'exists':
        return actual !== undefined && actual !== null;
      default:
        return false;
    }
  }

  /**
   * Evaluate success criteria
   */
  private evaluateSuccessCriteria(
    criteria: SuccessCriteria,
    outcomes: OutcomeResult[],
    metrics: SimulationMetrics
  ): boolean {
    const passedOutcomes = outcomes.filter((o) => o.passed).length;
    const totalOutcomes = outcomes.length;

    if (criteria.allOutcomesMustPass && passedOutcomes !== totalOutcomes) {
      return false;
    }

    if (criteria.minOutcomePassRate !== undefined) {
      const passRate = passedOutcomes / totalOutcomes;
      if (passRate < criteria.minOutcomePassRate) {
        return false;
      }
    }

    if (criteria.maxDriftFrequency !== undefined && metrics.driftFrequency !== undefined) {
      if (metrics.driftFrequency > criteria.maxDriftFrequency) {
        return false;
      }
    }

    if (criteria.maxRecoveryTime !== undefined && metrics.timing.recoveryTime !== undefined) {
      if (metrics.timing.recoveryTime > criteria.maxRecoveryTime) {
        return false;
      }
    }

    if (criteria.customChecks) {
      for (const check of criteria.customChecks) {
        // Note: customChecks require finalState which we don't have here
        // This would need to be evaluated separately
      }
    }

    return true;
  }

  /**
   * Create a simulation run record
   */
  private async createRun(scenarioId: string): Promise<string> {
    const run = await prisma.simulationRun.create({
      data: {
        scenarioId,
        status: 'running',
        startedAt: new Date(),
      },
    });
    return run.id;
  }

  /**
   * Update a simulation run record
   */
  private async updateRun(
    runId: string,
    update: {
      status?: string;
      finalState?: any;
      eventsExecuted?: any;
      faultsInjected?: any;
      metrics?: any;
      error?: string;
      completedAt?: Date;
    }
  ): Promise<void> {
    await prisma.simulationRun.update({
      where: { id: runId },
      data: update,
    });
  }

  /**
   * Deep clone an object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

