/**
 * B214B-TYPE-008: CausalGraph Microkernel Module
 *
 * Implements DomainModule interface for causal graph analysis.
 * Exposes analyzeRootCause(), simulateRipple(), computeCausalPath() capabilities.
 */

import type {
  DomainModule,
  DomainEvent,
  DomainTask,
  TaskResult,
  ModuleCapability,
} from '../microkernel/types.js';
import type {
  CausalGraphDomainModuleContract,
  AnalyzeRootCauseOptions,
  SimulateRippleOptions,
  RippleScenario,
  ComputeCausalPathOptions,
} from './contracts.js';
import { detectRootCauses } from './rootCauseDetector.js';
import { simulateWhatIf } from './whatIfSimulator.js';
import { explainPath } from './pathExplainer.js';
import type { CausalEventType, WhatIfResult } from './types.js';
import type { AnalyzeRootCauseResult, CausalPathResult } from './contracts.js';
import type { WhatIfScenario } from './whatIfSimulator.js';
import type { PathExplanation } from './pathExplainer.js';

/**
 * CausalGraphModule implements DomainModule interface and CausalGraphDomainModuleContract
 */
export class CausalGraphModule implements DomainModule, CausalGraphDomainModuleContract {
  readonly id = 'causal-graph';
  readonly name = 'CausalGraph';

  async handleEvent(event: DomainEvent): Promise<void> {
    try {
      // Handle events that might trigger graph updates or analyses
      if (
        event.type === 'DriftEvent' ||
        event.type === 'QualitySignal' ||
        event.type === 'SafetySignal' ||
        event.type === 'drift.detected' ||
        event.type === 'quality.signal' ||
        event.type === 'safety.signal'
      ) {
        // Events that might affect the causal graph are handled
        // Graph updates would happen automatically when events are recorded
        return;
      }
    } catch (error) {
      console.error('[CausalGraphModule] Error handling event:', error);
      throw error;
    }
  }

  async handleTask(task: DomainTask): Promise<TaskResult> {
    try {
      // Analyze root cause
      if (task.type === 'analyzeRootCause' || task.type === 'causal.analyzeRootCause') {
        const targetEventType = task.payload.targetEventType as CausalEventType;
        const options = task.payload.options as AnalyzeRootCauseOptions | undefined;
        const result = await this.analyzeRootCause(targetEventType, options);
        return {
          success: true,
          data: result,
        };
      }

      // Simulate ripple effects
      if (task.type === 'simulateRipple' || task.type === 'causal.simulateRipple') {
        const scenario = task.payload.scenario as RippleScenario;
        const options = task.payload.options as SimulateRippleOptions | undefined;
        const result = await this.simulateRipple(scenario, options);
        return {
          success: true,
          data: result,
        };
      }

      // Compute causal path
      if (task.type === 'computeCausalPath' || task.type === 'causal.computePath') {
        const fromEventType = task.payload.fromEventType as CausalEventType;
        const toEventType = task.payload.toEventType as CausalEventType;
        const options = task.payload.options as ComputeCausalPathOptions | undefined;
        const result = await this.computeCausalPath(fromEventType, toEventType, options);
        return {
          success: true,
          data: result,
        };
      }

      return {
        success: false,
        error: `Unknown task type: ${task.type}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Analyze root causes for a target event
   */
  async analyzeRootCause(
    targetEventType: CausalEventType,
    options?: AnalyzeRootCauseOptions
  ): Promise<AnalyzeRootCauseResult> {
    const result = await detectRootCauses(targetEventType, {
      maxDepth: options?.maxDepth,
      minConfidence: options?.minConfidence,
      maxPathsPerRoot: options?.maxPathsPerRoot,
    });

    return {
      targetEvent: result.targetEvent,
      rootCauses: result.rootCauses,
      totalPathsExplored: result.totalPathsExplored,
      detectionTime: result.detectionTime,
    };
  }

  /**
   * Simulate ripple effects of an intervention
   */
  async simulateRipple(scenario: RippleScenario, options?: SimulateRippleOptions): Promise<WhatIfResult> {
    // Convert RippleScenario to WhatIfScenario
    const whatIfScenario: WhatIfScenario = {
      description: scenario.description,
      intervention: scenario.intervention,
      currentState: scenario.currentState,
    };

    const result = await simulateWhatIf(whatIfScenario, {
      maxDepth: options?.maxDepth,
      timeHorizon: options?.timeHorizon,
      includeIndirectEffects: options?.includeIndirectEffects,
    });

    return result;
  }

  /**
   * Compute and explain causal path between events
   */
  async computeCausalPath(
    fromEventType: CausalEventType,
    toEventType: CausalEventType,
    options?: ComputeCausalPathOptions
  ): Promise<CausalPathResult[]> {
    const explanations = await explainPath(fromEventType, toEventType, {
      includeMetadata: options?.includeMetadata,
      maxPaths: options?.maxPaths,
      minConfidence: options?.minConfidence,
    });

    // Convert PathExplanation to CausalPathResult
    return explanations.map((explanation: PathExplanation): CausalPathResult => ({
      path: explanation.path,
      explanation: explanation.explanation,
      humanReadableSteps: explanation.humanReadableSteps,
      confidence: explanation.confidence,
      estimatedTimeToEffect: explanation.estimatedTimeToEffect,
    }));
  }

  getCapabilities(): ModuleCapability {
    return {
      name: this.name,
      description: 'Causal graph analysis with root cause detection, ripple effect simulation, and causal path computation',
      version: '1.0.0',
      supportedEvents: [
        'DriftEvent',
        'drift.detected',
        'QualitySignal',
        'quality.signal',
        'SafetySignal',
        'safety.signal',
      ],
      supportedTasks: [
        'analyzeRootCause',
        'causal.analyzeRootCause',
        'simulateRipple',
        'causal.simulateRipple',
        'computeCausalPath',
        'causal.computePath',
      ],
    };
  }
}

// Export singleton instance
export const causalGraphModule = new CausalGraphModule();

