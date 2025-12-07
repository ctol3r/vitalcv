/**
 * B205B-CCI-007: CCI computation engine
 *
 * Outputs CCI 0-100; contribution map for transparency;
 * handles missing data gracefully.
 */

import { createCompetencyModel, type CompetencyFeatures, type ModelConfig, type ModelResult } from './model/competencyModel.js';
import { getServiceLogger } from '../logging/serviceLogger.js';

const log = getServiceLogger('services/competency/calcCCI');

export interface CCICalculationResult {
  cciScore: number; // 0-100
  contributionMap: Record<string, number>; // Feature contributions
  confidence?: number;
  modelType: string;
  modelVersion?: string;
  features: CompetencyFeatures;
  missingFeatures: string[]; // Features that were missing
}

export interface CCICalculationOptions {
  modelConfig?: ModelConfig;
  handleMissingData?: 'skip' | 'default' | 'impute';
  defaultValues?: Partial<CompetencyFeatures>;
}

/**
 * Calculate CCI score from competency features
 */
export function calculateCCI(
  features: CompetencyFeatures,
  options: CCICalculationOptions = {}
): CCICalculationResult {
  const {
    modelConfig = { type: 'linear' },
    handleMissingData = 'skip',
    defaultValues = {},
  } = options;

  // Handle missing data
  const processedFeatures = { ...features };
  const missingFeatures: string[] = [];

  // Define expected features
  const expectedFeatures: (keyof CompetencyFeatures)[] = [
    'oppe_trend',
    'fppe_outcomes',
    'complication_rate',
    'license_freshness',
    'board_freshness',
    'dea_expiry',
    'pecos_status',
    'payer_denials',
    'ehr_mismatches',
    'drift_events',
    'years_experience',
    'privilege_coverage',
    'specialty_match',
  ];

  // Process missing features
  for (const feature of expectedFeatures) {
    if (processedFeatures[feature] === undefined || processedFeatures[feature] === null) {
      missingFeatures.push(feature);

      switch (handleMissingData) {
        case 'default':
          if (defaultValues[feature] !== undefined) {
            processedFeatures[feature] = defaultValues[feature];
          }
          break;
        case 'impute':
          // Simple imputation: use median/default values
          processedFeatures[feature] = getDefaultValue(feature);
          break;
        case 'skip':
        default:
          // Leave undefined, model will skip it
          break;
      }
    }
  }

  // Create model and predict
  const model = createCompetencyModel(modelConfig);
  const result: ModelResult = model.predict(processedFeatures, modelConfig);

  log.debug('CCI calculated', {
    score: result.score,
    modelType: model.getModelType(),
    missingFeatures: missingFeatures.length,
  });

  return {
    cciScore: result.score,
    contributionMap: result.contributionMap,
    confidence: result.confidence,
    modelType: model.getModelType(),
    modelVersion: modelConfig.modelVersion,
    features: processedFeatures,
    missingFeatures,
  };
}

/**
 * Get default value for a feature (for imputation)
 */
function getDefaultValue(feature: keyof CompetencyFeatures): number {
  const defaults: Partial<Record<keyof CompetencyFeatures, number>> = {
    oppe_trend: 0, // Neutral trend
    fppe_outcomes: 0.8, // Assume mostly passed
    complication_rate: 0.1, // Low complication rate
    license_freshness: 0.8, // Assume license is fresh
    board_freshness: 0.8, // Assume board cert is fresh
    dea_expiry: 0.8, // Assume DEA is fresh
    pecos_status: 0.7, // Assume mostly active
    payer_denials: 0.1, // Low denial rate
    ehr_mismatches: 0.1, // Few mismatches
    drift_events: 0.1, // Few drift events
    years_experience: 10, // Assume 10 years
    privilege_coverage: 0.8, // Assume good coverage
    specialty_match: 0.7, // Assume decent match
  };

  return defaults[feature] ?? 0.5;
}

/**
 * Normalize feature values to expected ranges
 */
export function normalizeFeatures(features: CompetencyFeatures): CompetencyFeatures {
  const normalized: CompetencyFeatures = { ...features };

  // Normalize OPPE trend to -1 to 1
  if (normalized.oppe_trend !== undefined) {
    normalized.oppe_trend = Math.max(-1, Math.min(1, normalized.oppe_trend));
  }

  // Normalize rates and freshness to 0 to 1
  const rateFeatures: (keyof CompetencyFeatures)[] = [
    'fppe_outcomes',
    'complication_rate',
    'license_freshness',
    'board_freshness',
    'dea_expiry',
    'pecos_status',
    'payer_denials',
    'ehr_mismatches',
    'drift_events',
    'privilege_coverage',
    'specialty_match',
  ];

  for (const feature of rateFeatures) {
    if (normalized[feature] !== undefined) {
      normalized[feature] = Math.max(0, Math.min(1, normalized[feature] as number));
    }
  }

  return normalized;
}

