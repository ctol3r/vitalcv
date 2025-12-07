/**
 * B203B-ML-006: PredictiveSafetyModel (stub with pluggable backend)
 *
 * Supports local logistic regression, gradient boosting, or external ML service.
 * Includes deterministic mode for tests.
 */

import type { SafetyFeatureVector, SafetyFeatures } from '../models/SafetyFeatureVector.js';
import { featureVectorToArray } from '../models/SafetyFeatureVector.js';

export type PredictionBackend = 'logistic_regression' | 'gradient_boosting' | 'external_service';

export interface PredictiveModelOptions {
  backend?: PredictionBackend;
  deterministic?: boolean;
  externalServiceUrl?: string;
  externalServiceApiKey?: string;
}

export interface ModelPrediction {
  predictedRisk: number; // 0-1 scale
  confidence: number; // 0-1 scale
  features: number[]; // Feature vector used
  backend: PredictionBackend;
  timestamp: Date;
}

export interface PredictiveModelBackend {
  predict(features: number[]): Promise<ModelPrediction>;
}

/**
 * Simple logistic regression model (stub implementation)
 */
class LogisticRegressionBackend implements PredictiveModelBackend {
  constructor(private deterministic: boolean = false) {}

  async predict(features: number[]): Promise<ModelPrediction> {
    if (this.deterministic) {
      // Deterministic mode: simple weighted sum
      const weights = [0.15, 0.12, 0.18, 0.10, 0.08, 0.08, 0.08, 0.06, 0.10, 0.05];
      let weightedSum = 0;
      for (let i = 0; i < features.length && i < weights.length; i++) {
        // Invert some features (where higher is better, e.g., freshness)
        const feature = i >= 4 && i <= 6 ? 1 - features[i] : features[i];
        weightedSum += feature * weights[i];
      }
      const predictedRisk = Math.min(1, Math.max(0, weightedSum));
      return {
        predictedRisk,
        confidence: 0.85,
        features,
        backend: 'logistic_regression',
        timestamp: new Date(),
      };
    }

    // Non-deterministic: add small random variation
    const weights = [0.15, 0.12, 0.18, 0.10, 0.08, 0.08, 0.08, 0.06, 0.10, 0.05];
    let weightedSum = 0;
    for (let i = 0; i < features.length && i < weights.length; i++) {
      const feature = i >= 4 && i <= 6 ? 1 - features[i] : features[i];
      weightedSum += feature * weights[i];
    }
    const noise = (Math.random() - 0.5) * 0.05; // ±2.5% noise
    const predictedRisk = Math.min(1, Math.max(0, weightedSum + noise));
    return {
      predictedRisk,
      confidence: 0.8 + Math.random() * 0.15,
      features,
      backend: 'logistic_regression',
      timestamp: new Date(),
    };
  }
}

/**
 * Gradient boosting model (stub implementation)
 */
class GradientBoostingBackend implements PredictiveModelBackend {
  constructor(private deterministic: boolean = false) {}

  async predict(features: number[]): Promise<ModelPrediction> {
    if (this.deterministic) {
      // Deterministic mode: ensemble-style prediction
      const trees = [
        // Tree 1: Focus on quality metrics
        features[0] * 0.2 + features[1] * 0.15 + features[2] * 0.25,
        // Tree 2: Focus on credential freshness
        (1 - features[4]) * 0.3 + (1 - features[5]) * 0.2 + (1 - features[6]) * 0.2,
        // Tree 3: Focus on compliance
        features[3] * 0.15 + features[8] * 0.2 + features[9] * 0.25,
      ];
      const predictedRisk = Math.min(1, Math.max(0, trees.reduce((a, b) => a + b, 0) / 3));
      return {
        predictedRisk,
        confidence: 0.9,
        features,
        backend: 'gradient_boosting',
        timestamp: new Date(),
      };
    }

    // Non-deterministic: ensemble with small variations
    const trees = [
      features[0] * 0.2 + features[1] * 0.15 + features[2] * 0.25,
      (1 - features[4]) * 0.3 + (1 - features[5]) * 0.2 + (1 - features[6]) * 0.2,
      features[3] * 0.15 + features[8] * 0.2 + features[9] * 0.25,
    ];
    const basePrediction = trees.reduce((a, b) => a + b, 0) / 3;
    const noise = (Math.random() - 0.5) * 0.03; // ±1.5% noise
    const predictedRisk = Math.min(1, Math.max(0, basePrediction + noise));
    return {
      predictedRisk,
      confidence: 0.85 + Math.random() * 0.1,
      features,
      backend: 'gradient_boosting',
      timestamp: new Date(),
    };
  }
}

/**
 * External ML service backend
 */
class ExternalServiceBackend implements PredictiveModelBackend {
  constructor(
    private serviceUrl: string,
    private apiKey?: string
  ) {}

  async predict(features: number[]): Promise<ModelPrediction> {
    try {
      const response = await fetch(`${this.serviceUrl}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ features }),
      });

      if (!response.ok) {
        throw new Error(`External ML service returned ${response.status}`);
      }

      const data = await response.json();
      return {
        predictedRisk: data.risk ?? data.predicted_risk ?? data.prediction ?? 0.5,
        confidence: data.confidence ?? 0.8,
        features,
        backend: 'external_service',
        timestamp: new Date(),
      };
    } catch (error) {
      // Fallback to deterministic logistic regression on error
      console.warn('[ExternalServiceBackend] Service unavailable, using fallback', error);
      const fallback = new LogisticRegressionBackend(true);
      return fallback.predict(features);
    }
  }
}

/**
 * Predictive Safety Model with pluggable backend
 */
export class PredictiveSafetyModel {
  private backend: PredictiveModelBackend;

  constructor(options: PredictiveModelOptions = {}) {
    const backendType = options.backend ?? 'logistic_regression';
    const deterministic = options.deterministic ?? false;

    switch (backendType) {
      case 'gradient_boosting':
        this.backend = new GradientBoostingBackend(deterministic);
        break;
      case 'external_service':
        if (!options.externalServiceUrl) {
          throw new Error('externalServiceUrl is required for external_service backend');
        }
        this.backend = new ExternalServiceBackend(
          options.externalServiceUrl,
          options.externalServiceApiKey
        );
        break;
      case 'logistic_regression':
      default:
        this.backend = new LogisticRegressionBackend(deterministic);
        break;
    }
  }

  /**
   * Predict safety risk from feature vector
   */
  async predict(vector: SafetyFeatureVector | SafetyFeatures): Promise<ModelPrediction> {
    const features = 'features' in vector ? featureVectorToArray(vector.features) : featureVectorToArray(vector);
    return this.backend.predict(features);
  }

  /**
   * Get the current backend type
   */
  getBackendType(): PredictionBackend {
    if (this.backend instanceof LogisticRegressionBackend) {
      return 'logistic_regression';
    }
    if (this.backend instanceof GradientBoostingBackend) {
      return 'gradient_boosting';
    }
    return 'external_service';
  }
}

/**
 * Default model instance (can be configured via environment variables)
 */
export const defaultModel = new PredictiveSafetyModel({
  backend: (process.env.PREDICTIVE_SAFETY_BACKEND as PredictionBackend) ?? 'logistic_regression',
  deterministic: process.env.NODE_ENV === 'test',
  externalServiceUrl: process.env.PREDICTIVE_SAFETY_SERVICE_URL,
  externalServiceApiKey: process.env.PREDICTIVE_SAFETY_API_KEY,
});

