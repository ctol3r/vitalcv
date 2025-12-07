/**
 * B211B-MK-007: PredictiveSafety Microkernel Module
 *
 * Implements DomainModule interface for predictive safety analysis.
 * Supports runForecast(), detectMicroSignals(); subscribes to drift + OPPE events.
 */

import { PrismaClient } from '@prisma/client';
import type {
  DomainModule,
  DomainEvent,
  DomainTask,
  TaskResult,
  ModuleCapability,
} from '../../microkernel/types.js';
import { FeatureExtractor } from '../extractors/featureExtractor.js';
import { SafetyScoreEngine } from '../scoreEngine.js';
import { createSafetyFeatureVector } from '../models/SafetyFeatureVector.js';
import type { SafetyFeatureVector } from '../models/SafetyFeatureVector.js';
import { eventBus } from '../../../backend/src/services/notifications/eventBus.js';

export interface ForecastInput {
  clinicianId: string;
  lookbackDays?: number;
  horizonDays?: number;
}

export interface ForecastResult {
  clinicianId: string;
  currentRisk: number;
  forecastedRisk: number;
  confidence: number;
  trend: 'improving' | 'stable' | 'declining';
  recommendedActions: Array<{
    action: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    rationale: string;
  }>;
  timestamp: Date;
}

export interface MicroSignal {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  feature: string;
  value: number;
  threshold: number;
}

export class PredictiveSafetyModule implements DomainModule {
  readonly id = 'predictive-safety';
  readonly name = 'PredictiveSafety';

  private featureExtractor: FeatureExtractor;
  private scoreEngine: SafetyScoreEngine;
  private prisma: PrismaClient;
  private unsubscribeHandlers: Array<() => void> = [];

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
    this.featureExtractor = new FeatureExtractor();
    this.scoreEngine = new SafetyScoreEngine();
    this.subscribeToEvents();
  }

  /**
   * Subscribe to drift and OPPE events
   */
  private subscribeToEvents(): void {
    // Subscribe to drift events
    const driftUnsub = eventBus.subscribe('CredentialDiscrepancyFound', async (payload) => {
      if (payload.issue === 'DRIFT' || payload.metadata?.type === 'drift') {
        await this.handleDriftEvent(payload);
      }
    });
    this.unsubscribeHandlers.push(driftUnsub);

    // Subscribe to OPPE events (via quality signals or custom events)
    const oppeUnsub = eventBus.subscribeToAll(async (event) => {
      if (event.type === 'OPPECompleted' || event.type === 'OPPEUpdated') {
        await this.handleOPPEEvent(event.payload);
      }
    });
    this.unsubscribeHandlers.push(oppeUnsub);
  }

  private async handleDriftEvent(payload: any): Promise<void> {
    const clinicianId = payload.clinicianId || payload.metadata?.clinicianId;
    if (!clinicianId) return;

    // Trigger micro-signal detection when drift is detected
    await this.detectMicroSignals({ clinicianId });
  }

  private async handleOPPEEvent(payload: any): Promise<void> {
    const clinicianId = payload.clinicianId || payload.metadata?.clinicianId;
    if (!clinicianId) return;

    // Re-run forecast when OPPE data is updated
    await this.runForecast({ clinicianId });
  }

  async handleEvent(event: DomainEvent): Promise<void> {
    try {
      // Handle drift events
      if (event.type === 'DriftEvent' || event.type === 'drift.detected' || event.type === 'CredentialDiscrepancyFound') {
        await this.handleDriftEvent(event.payload);
        return;
      }

      // Handle OPPE events
      if (event.type === 'OPPECompleted' || event.type === 'OPPEUpdated' || event.type === 'oppe.completed') {
        await this.handleOPPEEvent(event.payload);
        return;
      }

      // Handle quality signals that may contain OPPE data
      if (event.type === 'QualitySignal' || event.type === 'quality.signal') {
        const signal = event.payload as { clinicianId: string; signalType?: string };
        if (signal.signalType === 'OPPE_LOW' || signal.signalType === 'OPPE_TREND') {
          await this.handleOPPEEvent(event.payload);
        }
        return;
      }
    } catch (error) {
      console.error('[PredictiveSafetyModule] Error handling event:', error);
      throw error;
    }
  }

  async handleTask(task: DomainTask): Promise<TaskResult> {
    try {
      // Run forecast
      if (task.type === 'runForecast' || task.type === 'predictive.forecast') {
        const input = task.payload as ForecastInput;
        const result = await this.runForecast(input);
        return {
          success: true,
          data: result,
        };
      }

      // Detect micro signals
      if (task.type === 'detectMicroSignals' || task.type === 'predictive.detectMicroSignals') {
        const input = task.payload as { clinicianId: string };
        const signals = await this.detectMicroSignals(input);
        return {
          success: true,
          data: signals,
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
   * Run forecast for a clinician
   */
  async runForecast(input: ForecastInput): Promise<ForecastResult> {
    const lookbackDays = input.lookbackDays ?? 90;
    const horizonDays = input.horizonDays ?? 30;

    // Extract features
    const features = await this.featureExtractor.extractFeatures(
      { clinicianId: input.clinicianId },
      {
        oppe: await this.fetchOPPEData(input.clinicianId),
        fppe: await this.fetchFPPEData(input.clinicianId),
        drift: await this.fetchDriftData(input.clinicianId, lookbackDays),
        compliance: await this.fetchComplianceData(input.clinicianId),
        enrollment: await this.fetchEnrollmentData(input.clinicianId),
        risk: await this.fetchRiskData(input.clinicianId),
        ehr: await this.fetchEHRData(input.clinicianId),
      }
    );

    const vector = this.featureExtractor.createFeatureVector(
      input.clinicianId,
      features
    );

    // Calculate current risk
    const currentScore = await this.scoreEngine.calculateScore(vector);

    // Simple forecast: assume trend continues
    const trendFactor = features.oppe_trend < -0.2 ? 1.1 : features.oppe_trend > 0.2 ? 0.9 : 1.0;
    const forecastedRisk = Math.min(1, Math.max(0, currentScore.predictedRisk * trendFactor));

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining';
    if (features.oppe_trend > 0.1) {
      trend = 'improving';
    } else if (features.oppe_trend < -0.1) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return {
      clinicianId: input.clinicianId,
      currentRisk: currentScore.predictedRisk,
      forecastedRisk,
      confidence: currentScore.confidence,
      trend,
      recommendedActions: currentScore.recommendedActions,
      timestamp: new Date(),
    };
  }

  /**
   * Detect micro signals from feature vectors
   */
  async detectMicroSignals(input: { clinicianId: string }): Promise<MicroSignal[]> {
    const features = await this.featureExtractor.extractFeatures(
      { clinicianId: input.clinicianId },
      {
        oppe: await this.fetchOPPEData(input.clinicianId),
        fppe: await this.fetchFPPEData(input.clinicianId),
        drift: await this.fetchDriftData(input.clinicianId),
        compliance: await this.fetchComplianceData(input.clinicianId),
        enrollment: await this.fetchEnrollmentData(input.clinicianId),
        risk: await this.fetchRiskData(input.clinicianId),
        ehr: await this.fetchEHRData(input.clinicianId),
      }
    );

    const signals: MicroSignal[] = [];

    // Check each feature for micro-signals
    const thresholds: Record<string, { low: number; high: number }> = {
      oppe_trend: { low: -0.3, high: 0.3 },
      fppe_outcomes: { low: 0.5, high: 0.8 },
      complication_rate: { low: 0.3, high: 0.7 },
      drift_events: { low: 0.2, high: 0.6 },
      license_freshness: { low: 0.3, high: 0.7 },
      board_freshness: { low: 0.3, high: 0.7 },
      dea_expiry: { low: 0.3, high: 0.7 },
      pecos_status: { low: 0.5, high: 0.8 },
      payer_denials: { low: 0.2, high: 0.5 },
      ehr_mismatches: { low: 0.2, high: 0.5 },
    };

    for (const [featureName, value] of Object.entries(features)) {
      const threshold = thresholds[featureName];
      if (!threshold) continue;

      if (value < threshold.low || value > threshold.high) {
        const severity = value < threshold.low ? 'high' : value > threshold.high ? 'medium' : 'low';
        signals.push({
          type: 'micro_signal',
          severity: severity as 'low' | 'medium' | 'high' | 'critical',
          description: `${featureName} is ${value < threshold.low ? 'below' : 'above'} expected range`,
          feature: featureName,
          value,
          threshold: value < threshold.low ? threshold.low : threshold.high,
        });
      }
    }

    return signals;
  }

  // Helper methods to fetch data (stubbed - should be implemented based on actual data sources)
  private async fetchOPPEData(clinicianId: string): Promise<any> {
    // Stub - implement based on actual OPPE data source
    return null;
  }

  private async fetchFPPEData(clinicianId: string): Promise<any> {
    // Stub - implement based on actual FPPE data source
    return null;
  }

  private async fetchDriftData(clinicianId: string, lookbackDays?: number): Promise<any[]> {
    // Stub - implement based on actual drift data source
    return [];
  }

  private async fetchComplianceData(clinicianId: string): Promise<any> {
    // Stub - implement based on actual compliance data source
    return null;
  }

  private async fetchEnrollmentData(clinicianId: string): Promise<any> {
    // Stub - implement based on actual enrollment data source
    return null;
  }

  private async fetchRiskData(clinicianId: string): Promise<any> {
    // Stub - implement based on actual risk data source
    return null;
  }

  private async fetchEHRData(clinicianId: string): Promise<any> {
    // Stub - implement based on actual EHR data source
    return null;
  }

  getCapabilities(): ModuleCapability {
    return {
      name: this.name,
      description: 'Predictive safety analysis with forecasting and micro-signal detection',
      version: '1.0.0',
      supportedEvents: [
        'DriftEvent',
        'drift.detected',
        'CredentialDiscrepancyFound',
        'OPPECompleted',
        'OPPEUpdated',
        'oppe.completed',
        'QualitySignal',
        'quality.signal',
      ],
      supportedTasks: [
        'runForecast',
        'predictive.forecast',
        'detectMicroSignals',
        'predictive.detectMicroSignals',
      ],
    };
  }

  /**
   * Cleanup subscriptions
   */
  destroy(): void {
    this.unsubscribeHandlers.forEach((unsub) => unsub());
    this.unsubscribeHandlers = [];
  }
}

export const predictiveSafetyModule = new PredictiveSafetyModule();

