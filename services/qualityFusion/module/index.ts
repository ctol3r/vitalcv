/**
 * B211B-MK-009: Fusion Engine Microkernel Module
 *
 * Implements DomainModule interface for quality fusion analysis.
 * Exposes runFusion(), calculateCompositeRisk(), pushFusionEvent().
 */

import { PrismaClient } from '@prisma/client';
import type {
  DomainModule,
  DomainEvent,
  DomainTask,
  TaskResult,
  ModuleCapability,
} from '../../microkernel/types.js';
import { FusionEngine, type FusionEngineRunInput, type FusionEngineResult } from '../fusionEngine.js';
import { eventBus } from '../../../backend/src/services/notifications/eventBus.js';

export interface CompositeRiskInput {
  clinicianId: string;
  lookbackDays?: number;
  weights?: {
    quality?: number;
    drift?: number;
    safety?: number;
  };
}

export interface CompositeRiskResult {
  clinicianId: string;
  compositeRisk: number; // 0-1 scale, higher = more risk
  breakdown: Array<{
    domain: 'quality' | 'drift' | 'safety';
    risk: number;
    weight: number;
    contribution: number;
  }>;
  evaluatedAt: Date;
}

export interface FusionEventPayload {
  clinicianId: string;
  fusionScore: number;
  breakdown: Array<{ label: string; score: number; weight: number }>;
  qualitySignals: number;
  driftOpen: number;
  safetyAlerts: number;
  timestamp: Date;
}

export class FusionEngineModule implements DomainModule {
  readonly id = 'fusion-engine';
  readonly name = 'FusionEngine';

  private engine: FusionEngine;
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
    this.engine = new FusionEngine(this.prisma);
  }

  async handleEvent(event: DomainEvent): Promise<void> {
    try {
      // Handle quality signal events
      if (event.type === 'QualitySignal' || event.type === 'quality.signal') {
        const signal = event.payload as { clinicianId: string };
        if (signal.clinicianId) {
          // Trigger fusion recalculation when quality signals change
          await this.runFusion({
            clinicianId: signal.clinicianId,
            lookbackDays: 90,
          });
        }
        return;
      }

      // Handle drift events
      if (event.type === 'DriftEvent' || event.type === 'drift.detected') {
        const driftEvent = event.payload as { clinicianId?: string; metadata?: { clinicianId?: string } };
        const clinicianId = driftEvent.clinicianId || driftEvent.metadata?.clinicianId;
        if (clinicianId) {
          await this.runFusion({
            clinicianId,
            lookbackDays: 90,
          });
        }
        return;
      }

      // Handle safety signal events
      if (event.type === 'SafetySignal' || event.type === 'safety.signal') {
        const signal = event.payload as { clinicianId: string };
        if (signal.clinicianId) {
          await this.runFusion({
            clinicianId: signal.clinicianId,
            lookbackDays: 90,
          });
        }
        return;
      }
    } catch (error) {
      console.error('[FusionEngineModule] Error handling event:', error);
      throw error;
    }
  }

  async handleTask(task: DomainTask): Promise<TaskResult> {
    try {
      // Run fusion
      if (task.type === 'runFusion' || task.type === 'fusion.run') {
        const input = task.payload as FusionEngineRunInput;
        const result = await this.runFusion(input);
        return {
          success: true,
          data: result,
        };
      }

      // Calculate composite risk
      if (task.type === 'calculateCompositeRisk' || task.type === 'fusion.compositeRisk') {
        const input = task.payload as CompositeRiskInput;
        const result = await this.calculateCompositeRisk(input);
        return {
          success: true,
          data: result,
        };
      }

      // Push fusion event
      if (task.type === 'pushFusionEvent' || task.type === 'fusion.pushEvent') {
        const payload = task.payload as FusionEventPayload;
        await this.pushFusionEvent(payload);
        return {
          success: true,
          data: { published: true },
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
   * Run fusion analysis for a clinician
   */
  async runFusion(input: FusionEngineRunInput): Promise<FusionEngineResult> {
    const result = await this.engine.run(input);

    // Automatically push fusion event
    await this.pushFusionEvent({
      clinicianId: result.clinicianId,
      fusionScore: result.fusionScore,
      breakdown: result.breakdown,
      qualitySignals: result.qualitySignals.length,
      driftOpen: result.driftOpen,
      safetyAlerts: result.safetyAlerts,
      timestamp: result.evaluatedAt,
    });

    return result;
  }

  /**
   * Calculate composite risk score
   */
  async calculateCompositeRisk(input: CompositeRiskInput): Promise<CompositeRiskResult> {
    const fusionResult = await this.engine.run({
      clinicianId: input.clinicianId,
      lookbackDays: input.lookbackDays,
    });

    // Default weights
    const weights = {
      quality: input.weights?.quality ?? 0.5,
      drift: input.weights?.drift ?? 0.2,
      safety: input.weights?.safety ?? 0.3,
    };

    // Normalize weights to sum to 1
    const totalWeight = weights.quality + weights.drift + weights.safety;
    const normalizedWeights = {
      quality: weights.quality / totalWeight,
      drift: weights.drift / totalWeight,
      safety: weights.safety / totalWeight,
    };

    // Calculate risk (inverse of score)
    const breakdown = fusionResult.breakdown.map((entry) => {
      const risk = 1 - entry.score; // Convert score to risk
      return {
        domain: entry.label as 'quality' | 'drift' | 'safety',
        risk,
        weight: normalizedWeights[entry.label as keyof typeof normalizedWeights],
        contribution: risk * normalizedWeights[entry.label as keyof typeof normalizedWeights],
      };
    });

    const compositeRisk = breakdown.reduce((sum, entry) => sum + entry.contribution, 0);

    return {
      clinicianId: input.clinicianId,
      compositeRisk: Math.min(1, Math.max(0, compositeRisk)),
      breakdown,
      evaluatedAt: new Date(),
    };
  }

  /**
   * Push fusion event to event bus
   */
  async pushFusionEvent(payload: FusionEventPayload): Promise<void> {
    await eventBus.publish('FusionScoreCalculated', {
      clinicianId: payload.clinicianId,
      fusionScore: payload.fusionScore,
      breakdown: payload.breakdown,
      qualitySignals: payload.qualitySignals,
      driftOpen: payload.driftOpen,
      safetyAlerts: payload.safetyAlerts,
      timestamp: payload.timestamp.toISOString(),
    });
  }

  getCapabilities(): ModuleCapability {
    return {
      name: this.name,
      description: 'Quality fusion analysis with composite risk calculation and event publishing',
      version: '1.0.0',
      supportedEvents: [
        'QualitySignal',
        'quality.signal',
        'DriftEvent',
        'drift.detected',
        'SafetySignal',
        'safety.signal',
      ],
      supportedTasks: [
        'runFusion',
        'fusion.run',
        'calculateCompositeRisk',
        'fusion.compositeRisk',
        'pushFusionEvent',
        'fusion.pushEvent',
      ],
    };
  }
}

export const fusionEngineModule = new FusionEngineModule();

