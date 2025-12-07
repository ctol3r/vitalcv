/**
 * B206A-WF-003: DemandForecastModel
 *
 * Supports multiple forecasting models:
 * - ARIMA-like time series decomposition
 * - Prophet-like decomposition (trend + seasonality)
 * - ML regressor (simple linear for now, extensible to more complex models)
 * - Deterministic mode for testing (returns fixed values)
 */

import { DemandFeatures } from '../extractors/demandFeatures.js';

export interface ForecastResult {
  predictedValue: number;
  lowerBound?: number;
  upperBound?: number;
  confidenceLevel?: number;
  modelType: string;
  modelVersion?: string;
  metadata?: any;
}

export type ModelType = 'arima' | 'prophet' | 'ml' | 'deterministic';

export interface ModelConfig {
  type: ModelType;
  version?: string;
  deterministicValue?: number; // For deterministic mode
  confidenceInterval?: number; // 0-1, default 0.95
  seasonalPeriods?: {
    daily?: number;
    weekly?: number;
    monthly?: number;
  };
}

/**
 * Simple ARIMA-like model using time series decomposition
 */
class ArimaModel {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  predict(features: DemandFeatures, historicalMean: number): ForecastResult {
    // ARIMA-like: Trend + Seasonality + Noise

    // Trend component
    const trend = features.trend30Day || 0;

    // Seasonal component
    const seasonal =
      (features.seasonalityDaily || 0) * 0.4 +
      (features.seasonalityWeekly || 0) * 0.4 +
      (features.seasonalityMonthly || 0) * 0.2;

    // Base prediction
    const baseValue = historicalMean || features.rollingMean30Day || 0;
    const predictedValue = baseValue * (1 + seasonal) + trend;

    // Confidence interval (simplified)
    const std = features.rollingStd30Day || 1;
    const zScore = 1.96; // 95% confidence
    const margin = std * zScore;

    return {
      predictedValue: Math.max(0, predictedValue),
      lowerBound: Math.max(0, predictedValue - margin),
      upperBound: predictedValue + margin,
      confidenceLevel: this.config.confidenceInterval || 0.95,
      modelType: 'arima',
      modelVersion: this.config.version,
    };
  }
}

/**
 * Prophet-like decomposition model
 */
class ProphetModel {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  predict(features: DemandFeatures, historicalMean: number): ForecastResult {
    // Prophet: y(t) = g(t) + s(t) + h(t) + ε(t)
    // where g = growth/trend, s = seasonality, h = holidays, ε = error

    const baseValue = historicalMean || features.rollingMean30Day || 0;

    // Growth/trend component
    const growth = (features.trend30Day || 0) * 1.0;

    // Seasonality component
    const weeklySeasonality = (features.seasonalityWeekly || 0) * baseValue * 0.15;
    const monthlySeasonality = (features.seasonalityMonthly || 0) * baseValue * 0.10;
    const dailySeasonality = (features.seasonalityDaily || 0) * baseValue * 0.05;

    // Holiday effect
    const holidayEffect = features.isHoliday ? baseValue * -0.2 : 0;
    const daysSinceHolidayEffect = features.daysSinceHoliday
      ? baseValue * Math.exp(-features.daysSinceHoliday / 7) * 0.1
      : 0;

    // Surge effect
    const surgeEffect = features.surgeIndicator * baseValue * 0.3;

    const predictedValue =
      baseValue +
      growth +
      weeklySeasonality +
      monthlySeasonality +
      dailySeasonality +
      holidayEffect +
      daysSinceHolidayEffect +
      surgeEffect;

    // Uncertainty increases with horizon
    const std = features.rollingStd30Day || 1;
    const uncertainty = std * 1.5; // Prophet-style uncertainty
    const zScore = 1.96;

    return {
      predictedValue: Math.max(0, predictedValue),
      lowerBound: Math.max(0, predictedValue - uncertainty * zScore),
      upperBound: predictedValue + uncertainty * zScore,
      confidenceLevel: this.config.confidenceInterval || 0.95,
      modelType: 'prophet',
      modelVersion: this.config.version,
    };
  }
}

/**
 * Machine learning regressor model (simple linear for now)
 */
class MLRegressorModel {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  predict(features: DemandFeatures, historicalMean: number): ForecastResult {
    // Simple linear regression with feature weights
    // In production, this could use scikit-learn, XGBoost, etc.

    const weights = {
      intercept: historicalMean || features.rollingMean30Day || 0,
      lag1Day: 0.3,
      lag7Day: 0.4,
      lag30Day: 0.2,
      rollingMean7Day: 0.5,
      rollingMean30Day: 0.3,
      trend7Day: 0.2,
      trend30Day: 0.1,
      dayOfWeek: 0.15,
      month: 0.1,
      isWeekend: -0.1,
      isHoliday: -0.2,
      surgeIndicator: 0.3,
      backlogIndicator: 0.2,
    };

    let predictedValue = weights.intercept;

    if (features.lag1Day !== null) predictedValue += features.lag1Day * weights.lag1Day;
    if (features.lag7Day !== null) predictedValue += features.lag7Day * weights.lag7Day;
    if (features.lag30Day !== null) predictedValue += features.lag30Day * weights.lag30Day;
    if (features.rollingMean7Day !== null) predictedValue += features.rollingMean7Day * weights.rollingMean7Day;
    if (features.rollingMean30Day !== null) predictedValue += features.rollingMean30Day * weights.rollingMean30Day;
    if (features.trend7Day !== null) predictedValue += features.trend7Day * weights.trend7Day;
    if (features.trend30Day !== null) predictedValue += features.trend30Day * weights.trend30Day;

    // Day of week effect (Sunday = 0)
    const dayOfWeekEffect = Math.sin((features.dayOfWeek / 7) * 2 * Math.PI) * weights.dayOfWeek;
    predictedValue += dayOfWeekEffect * historicalMean;

    // Month effect (seasonal)
    const monthEffect = Math.sin(((features.month - 1) / 12) * 2 * Math.PI) * weights.month;
    predictedValue += monthEffect * historicalMean;

    if (features.isWeekend) predictedValue *= (1 + weights.isWeekend);
    if (features.isHoliday) predictedValue *= (1 + weights.isHoliday);
    if (features.surgeIndicator > 0) predictedValue *= (1 + weights.surgeIndicator);
    if (features.backlogIndicator !== null) predictedValue += features.backlogIndicator * weights.backlogIndicator;

    // Confidence based on feature availability
    const std = features.rollingStd30Day || 1;
    const uncertainty = std * 1.2;
    const zScore = 1.96;

    return {
      predictedValue: Math.max(0, predictedValue),
      lowerBound: Math.max(0, predictedValue - uncertainty * zScore),
      upperBound: predictedValue + uncertainty * zScore,
      confidenceLevel: this.config.confidenceInterval || 0.95,
      modelType: 'ml',
      modelVersion: this.config.version,
    };
  }
}

/**
 * Deterministic model for testing
 */
class DeterministicModel {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  predict(_features: DemandFeatures, _historicalMean: number): ForecastResult {
    // Always return the configured deterministic value
    const value = this.config.deterministicValue || 100;

    return {
      predictedValue: value,
      lowerBound: value * 0.9,
      upperBound: value * 1.1,
      confidenceLevel: 1.0, // Perfect confidence in deterministic mode
      modelType: 'deterministic',
      modelVersion: this.config.version || 'test-1.0',
      metadata: {
        deterministic: true,
      },
    };
  }
}

/**
 * DemandForecastModel - Main model interface
 */
export class DemandForecastModel {
  private model: ArimaModel | ProphetModel | MLRegressorModel | DeterministicModel;

  constructor(config: ModelConfig) {
    switch (config.type) {
      case 'arima':
        this.model = new ArimaModel(config);
        break;
      case 'prophet':
        this.model = new ProphetModel(config);
        break;
      case 'ml':
        this.model = new MLRegressorModel(config);
        break;
      case 'deterministic':
        this.model = new DeterministicModel(config);
        break;
      default:
        throw new Error(`Unsupported model type: ${config.type}`);
    }
  }

  /**
   * Generate forecast prediction
   */
  predict(
    features: DemandFeatures,
    historicalMean?: number
  ): ForecastResult {
    return this.model.predict(features, historicalMean || 0);
  }

  /**
   * Create a model instance with default config
   */
  static create(type: ModelType, options?: Partial<ModelConfig>): DemandForecastModel {
    const config: ModelConfig = {
      type,
      confidenceInterval: 0.95,
      ...options,
    };

    return new DemandForecastModel(config);
  }

  /**
   * Create deterministic model for testing
   */
  static createDeterministic(value: number): DemandForecastModel {
    return new DemandForecastModel({
      type: 'deterministic',
      deterministicValue: value,
      version: 'test-1.0',
    });
  }
}

