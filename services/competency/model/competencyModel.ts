/**
 * B205B-CCI-006: CompetencyModel
 *
 * Pluggable ML/regression/weighted model for competency scoring.
 * Supports linear weighted model, boosted model, or external ML engine.
 * Includes deterministic test mode for testing.
 */

export type ModelType = 'linear' | 'boosted' | 'ml' | 'test';

export interface CompetencyFeatures {
  // Clinical competency
  oppe_trend?: number; // -1 to 1 (negative = declining, positive = improving)
  fppe_outcomes?: number; // 0 to 1 (1 = all passed, 0 = all failed)
  complication_rate?: number; // 0 to 1 (normalized complication rate)

  // Credential freshness
  license_freshness?: number; // 0 to 1 (days until expiry, normalized)
  board_freshness?: number; // 0 to 1 (days until expiry, normalized)
  dea_expiry?: number; // 0 to 1 (days until expiry, normalized)

  // Compliance and enrollment
  pecos_status?: number; // 0 to 1 (1 = active, 0 = inactive/expired)
  payer_denials?: number; // 0 to 1 (normalized denial rate)

  // System integration
  ehr_mismatches?: number; // 0 to 1 (0 = no mismatches, 1 = many mismatches)
  drift_events?: number; // 0 to 1 (normalized drift event count)

  // Additional features
  years_experience?: number;
  privilege_coverage?: number; // 0 to 1 (coverage of required privileges)
  specialty_match?: number; // 0 to 1 (match to demand specialty)
}

export interface ModelConfig {
  type: ModelType;
  weights?: Record<string, number>; // For linear model
  modelVersion?: string;
  testMode?: boolean; // Deterministic test mode
}

export interface ModelResult {
  score: number; // 0-100 CCI score
  contributionMap: Record<string, number>; // Feature contributions
  confidence?: number; // 0-1 confidence in prediction
}

export interface CompetencyModel {
  predict(features: CompetencyFeatures, config: ModelConfig): ModelResult;
  getModelType(): ModelType;
}

/**
 * Linear weighted model
 */
export class LinearWeightedModel implements CompetencyModel {
  private defaultWeights: Record<string, number> = {
    oppe_trend: 0.15,
    fppe_outcomes: 0.20,
    complication_rate: -0.15, // Negative weight (lower is better)
    license_freshness: 0.10,
    board_freshness: 0.10,
    dea_expiry: 0.05,
    pecos_status: 0.10,
    payer_denials: -0.10, // Negative weight
    ehr_mismatches: -0.05, // Negative weight
    drift_events: -0.10, // Negative weight
    years_experience: 0.05,
    privilege_coverage: 0.10,
    specialty_match: 0.05,
  };

  predict(features: CompetencyFeatures, config: ModelConfig): ModelResult {
    const weights = config.weights || this.defaultWeights;
    const contributionMap: Record<string, number> = {};
    let rawScore = 0;

    // Handle missing data gracefully by using defaults or skipping
    for (const [feature, weight] of Object.entries(weights)) {
      const value = features[feature as keyof CompetencyFeatures];
      if (value !== undefined && value !== null) {
        const contribution = value * weight;
        contributionMap[feature] = contribution;
        rawScore += contribution;
      }
    }

    // Normalize to 0-100 range
    // Assuming features are normalized to 0-1 or -1 to 1
    // We scale the raw score to 0-100
    const normalizedScore = Math.max(0, Math.min(100, 50 + rawScore * 50));

    return {
      score: normalizedScore,
      contributionMap,
      confidence: 0.8, // Linear models have moderate confidence
    };
  }

  getModelType(): ModelType {
    return 'linear';
  }
}

/**
 * Boosted model (simplified gradient boosting simulation)
 */
export class BoostedModel implements CompetencyModel {
  predict(features: CompetencyFeatures, config: ModelConfig): ModelResult {
    // Simplified boosted model: multiple weak learners combined
    const linearModel = new LinearWeightedModel();
    const linearResult = linearModel.predict(features, config);

    // Apply boosting adjustments based on feature interactions
    let boost = 0;
    const contributionMap = { ...linearResult.contributionMap };

    // Interaction: High OPPE trend + High FPPE outcomes = boost
    if (features.oppe_trend && features.fppe_outcomes) {
      const interaction = (features.oppe_trend + 1) / 2 * features.fppe_outcomes;
      boost += interaction * 5;
      contributionMap['oppe_fppe_interaction'] = interaction * 5;
    }

    // Interaction: Low complications + High privilege coverage = boost
    if (features.complication_rate !== undefined && features.privilege_coverage) {
      const interaction = (1 - features.complication_rate) * features.privilege_coverage;
      boost += interaction * 3;
      contributionMap['complication_privilege_interaction'] = interaction * 3;
    }

    // Penalty: High drift + High EHR mismatches = penalty
    if (features.drift_events && features.ehr_mismatches) {
      const penalty = features.drift_events * features.ehr_mismatches * 5;
      boost -= penalty;
      contributionMap['drift_ehr_penalty'] = -penalty;
    }

    const boostedScore = Math.max(0, Math.min(100, linearResult.score + boost));

    return {
      score: boostedScore,
      contributionMap,
      confidence: 0.85, // Boosted models have slightly higher confidence
    };
  }

  getModelType(): ModelType {
    return 'boosted';
  }
}

/**
 * External ML engine adapter (placeholder for future ML service integration)
 */
export class ExternalMLEngine implements CompetencyModel {
  constructor(private apiEndpoint?: string) {}

  async predictAsync(features: CompetencyFeatures, config: ModelConfig): Promise<ModelResult> {
    // Placeholder: In production, this would call an external ML service
    // For now, fall back to linear model
    const linearModel = new LinearWeightedModel();
    return linearModel.predict(features, config);
  }

  predict(features: CompetencyFeatures, config: ModelConfig): ModelResult {
    // Synchronous fallback
    const linearModel = new LinearWeightedModel();
    return linearModel.predict(features, config);
  }

  getModelType(): ModelType {
    return 'ml';
  }
}

/**
 * Deterministic test model for testing
 */
export class TestModel implements CompetencyModel {
  predict(features: CompetencyFeatures, config: ModelConfig): ModelResult {
    // Deterministic test mode: returns predictable scores based on feature presence
    const contributionMap: Record<string, number> = {};
    let score = 50; // Base score

    // Deterministic rules for testing
    if (features.oppe_trend !== undefined) {
      contributionMap['oppe_trend'] = features.oppe_trend * 10;
      score += features.oppe_trend * 10;
    }
    if (features.fppe_outcomes !== undefined) {
      contributionMap['fppe_outcomes'] = features.fppe_outcomes * 20;
      score += features.fppe_outcomes * 20;
    }
    if (features.complication_rate !== undefined) {
      contributionMap['complication_rate'] = -features.complication_rate * 15;
      score -= features.complication_rate * 15;
    }

    // Normalize to 0-100
    const normalizedScore = Math.max(0, Math.min(100, score));

    return {
      score: normalizedScore,
      contributionMap,
      confidence: 1.0, // Test mode has full confidence (deterministic)
    };
  }

  getModelType(): ModelType {
    return 'test';
  }
}

/**
 * Model factory
 */
export function createCompetencyModel(config: ModelConfig): CompetencyModel {
  if (config.testMode || config.type === 'test') {
    return new TestModel();
  }

  switch (config.type) {
    case 'linear':
      return new LinearWeightedModel();
    case 'boosted':
      return new BoostedModel();
    case 'ml':
      return new ExternalMLEngine();
    default:
      return new LinearWeightedModel();
  }
}

