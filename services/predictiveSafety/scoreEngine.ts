/**
 * B203B-ML-007: SafetyScoreEngine
 *
 * Outputs predictedRisk 0–1 + recommendedActions.
 * Integrates with SafetyFeatureVector + model predictions.
 */

import type { SafetyFeatureVector } from './models/SafetyFeatureVector.js';
import { PredictiveSafetyModel, type ModelPrediction } from './model/predictiveModel.js';
import { featureVectorToArray } from './models/SafetyFeatureVector.js';

export interface RecommendedAction {
  action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  rationale: string;
  feature?: string; // Which feature triggered this action
}

export interface SafetyScoreResult {
  clinicianId: string;
  predictedRisk: number; // 0-1 scale
  confidence: number; // 0-1 scale
  recommendedActions: RecommendedAction[];
  features: {
    name: string;
    value: number;
    contribution: number; // How much this feature contributed to risk (0-1)
  }[];
  modelBackend: string;
  timestamp: Date;
}

const FEATURE_NAMES = [
  'oppe_trend',
  'fppe_outcomes',
  'complication_rate',
  'drift_events',
  'license_freshness',
  'board_freshness',
  'dea_expiry',
  'pecos_status',
  'payer_denials',
  'ehr_mismatches',
] as const;

/**
 * Safety Score Engine
 */
export class SafetyScoreEngine {
  constructor(private model: PredictiveSafetyModel = new PredictiveSafetyModel()) {}

  /**
   * Calculate safety score from feature vector
   */
  async calculateScore(vector: SafetyFeatureVector): Promise<SafetyScoreResult> {
    const prediction = await this.model.predict(vector);
    const features = featureVectorToArray(vector.features);

    // Calculate feature contributions (simplified: based on feature values and weights)
    const weights = [0.15, 0.12, 0.18, 0.10, 0.08, 0.08, 0.08, 0.06, 0.10, 0.05];
    const featureContributions = features.map((value, index) => {
      // For freshness features (4-6), invert since lower freshness = higher risk
      const adjustedValue = index >= 4 && index <= 6 ? 1 - value : value;
      const contribution = adjustedValue * weights[index];
      return {
        name: FEATURE_NAMES[index] ?? `feature_${index}`,
        value,
        contribution: contribution / prediction.predictedRisk || 0, // Normalize to 0-1
      };
    });

    const recommendedActions = this.generateActions(vector, prediction, featureContributions);

    return {
      clinicianId: vector.clinicianId,
      predictedRisk: prediction.predictedRisk,
      confidence: prediction.confidence,
      recommendedActions,
      features: featureContributions,
      modelBackend: prediction.backend,
      timestamp: prediction.timestamp,
    };
  }

  /**
   * Generate recommended actions based on features and risk
   */
  private generateActions(
    vector: SafetyFeatureVector,
    prediction: ModelPrediction,
    featureContributions: Array<{ name: string; value: number; contribution: number }>
  ): RecommendedAction[] {
    const actions: RecommendedAction[] = [];
    const { features } = vector;

    // Critical risk threshold
    if (prediction.predictedRisk >= 0.8) {
      actions.push({
        action: 'IMMEDIATE_REVIEW',
        priority: 'critical',
        rationale: 'Predicted risk exceeds critical threshold. Immediate safety committee review required.',
      });
    }

    // High risk threshold
    if (prediction.predictedRisk >= 0.6 && prediction.predictedRisk < 0.8) {
      actions.push({
        action: 'SCHEDULE_FPPE',
        priority: 'high',
        rationale: 'Elevated risk detected. Schedule focused professional practice evaluation.',
      });
    }

    // Feature-specific actions
    if (features.complication_rate >= 0.7) {
      actions.push({
        action: 'REVIEW_COMPLICATIONS',
        priority: 'high',
        rationale: 'Complication rate is elevated. Review recent cases and outcomes.',
        feature: 'complication_rate',
      });
    }

    if (features.oppe_trend < -0.3) {
      actions.push({
        action: 'OPPE_INTERVENTION',
        priority: 'medium',
        rationale: 'OPPE trend declining. Implement quality improvement interventions.',
        feature: 'oppe_trend',
      });
    }

    if (features.fppe_outcomes < 0.5) {
      actions.push({
        action: 'FPPE_REMEDIATION',
        priority: 'high',
        rationale: 'FPPE outcomes below threshold. Consider remediation plan.',
        feature: 'fppe_outcomes',
      });
    }

    if (features.license_freshness < 0.3) {
      actions.push({
        action: 'RENEW_LICENSE',
        priority: 'high',
        rationale: 'License expiring soon. Ensure renewal process is initiated.',
        feature: 'license_freshness',
      });
    }

    if (features.board_freshness < 0.3) {
      actions.push({
        action: 'RENEW_BOARD_CERT',
        priority: 'medium',
        rationale: 'Board certification expiring soon. Check renewal status.',
        feature: 'board_freshness',
      });
    }

    if (features.dea_expiry < 0.3) {
      actions.push({
        action: 'RENEW_DEA',
        priority: 'high',
        rationale: 'DEA registration expiring soon. Renewal required for prescribing.',
        feature: 'dea_expiry',
      });
    }

    if (features.drift_events >= 0.6) {
      actions.push({
        action: 'ADDRESS_DRIFT',
        priority: 'medium',
        rationale: 'Multiple drift events detected. Review and address credentialing gaps.',
        feature: 'drift_events',
      });
    }

    if (features.payer_denials >= 0.5) {
      actions.push({
        action: 'REVIEW_PAYER_DENIALS',
        priority: 'medium',
        rationale: 'Elevated payer denial rate. Review billing and coding practices.',
        feature: 'payer_denials',
      });
    }

    if (features.ehr_mismatches >= 0.5) {
      actions.push({
        action: 'RECONCILE_EHR',
        priority: 'high',
        rationale: 'EHR privilege mismatches detected. Synchronize privilege rosters.',
        feature: 'ehr_mismatches',
      });
    }

    if (features.pecos_status < 0.5) {
      actions.push({
        action: 'VERIFY_PECOS',
        priority: 'medium',
        rationale: 'PECOS enrollment may be inactive. Verify Medicare enrollment status.',
        feature: 'pecos_status',
      });
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }
}

/**
 * Default score engine instance
 */
export const defaultScoreEngine = new SafetyScoreEngine();

